/**
 * Local waveform-based audio-to-video sync fallback.
 *
 * Uses simplified peak-detection heuristics:
 *  - If both video and audio waveforms are available, find the best
 *    alignment offset by comparing the audio waveform to a shifted
 *    version of the video's audio track waveform via cross-correlation.
 *  - If only the audio waveform is available, detect the first strong
 *    peak and use the video's start time as the reference point.
 *
 * Returns { offsetSeconds, confidence }.
 *
 * Note: this is a best-effort heuristic. For accurate sync, integrate
 * with a dedicated audio alignment service (e.g. MuAPI sync endpoint).
 */

import { extractWaveform } from './metadataExtractor.js';

const DEFAULT_TARGET_POINTS = 1000;
const PEAK_THRESHOLD = 0.15;
const MIN_CONFIDENCE = 0.3;
const MAX_CONFIDENCE = 1.0;

export async function computeAudioOffset(videoUrl, audioUrl) {
  if (!videoUrl || !audioUrl) {
    throw new Error('videoUrl and audioUrl are required for audio sync');
  }

  let videoWaveform = null;
  let audioWaveform = null;

  try {
    videoWaveform = await extractWaveformFromUrl(videoUrl);
  } catch (e) {
    videoWaveform = null;
  }

  try {
    audioWaveform = await extractWaveformFromUrl(audioUrl);
  } catch (e) {
    audioWaveform = null;
  }

  if (!audioWaveform || !audioWaveform.peaks || audioWaveform.peaks.length === 0) {
    return { offsetSeconds: 0, confidence: 0 };
  }

  const audioPeaks = audioWaveform.peaks;
  const videoPeaks = videoWaveform && videoWaveform.peaks && videoWaveform.peaks.length > 0
    ? videoWaveform.peaks
    : null;

  if (videoPeaks) {
    return computeOffsetWithCrossCorrelation(videoPeaks, audioPeaks, videoWaveform, audioWaveform);
  }

  return computeOffsetFromFirstPeak(audioPeaks, audioWaveform);
}

async function extractWaveformFromUrl(url) {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') {
    throw new Error('extractWaveformFromUrl requires a browser environment');
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const blob = await response.blob();
  return extractWaveform(blob, { targetPoints: DEFAULT_TARGET_POINTS });
}

function computeOffsetWithCrossCorrelation(videoPeaks, audioPeaks, videoWaveform, audioWaveform) {
  const vLen = videoPeaks.length;
  const aLen = audioPeaks.length;

  if (vLen === 0 || aLen === 0) {
    return { offsetSeconds: 0, confidence: 0 };
  }

  const searchWindow = Math.min(aLen, vLen);
  let bestOffset = 0;
  let bestScore = -Infinity;

  const maxLag = Math.floor(searchWindow * 0.25);

  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let score = 0;
    let count = 0;
    for (let i = 0; i < searchWindow; i++) {
      const vIdx = i;
      const aIdx = i - lag;
      if (aIdx >= 0 && aIdx < aLen) {
        score += videoPeaks[vIdx] * audioPeaks[aIdx];
        count++;
      }
    }
    if (count > 0 && score > bestScore) {
      bestScore = score;
      bestOffset = lag;
    }
  }

  if (bestScore <= 0) {
    return { offsetSeconds: 0, confidence: 0 };
  }

  const maxPossibleScore = searchWindow;
  const rawConfidence = Math.min(MAX_CONFIDENCE, Math.max(MIN_CONFIDENCE, Math.abs(bestScore) / maxPossibleScore));
  const confidence = Math.round(rawConfidence * 100) / 100;

  const vDuration = (videoWaveform && videoWaveform.duration) || 0;
  const aDuration = (audioWaveform && audioWaveform.duration) || 0;
  const referenceDuration = aDuration || vDuration || estimateDurationFromPeaks(audioPeaks);

  const offsetSeconds = referenceDuration > 0 && aLen > 0
    ? (bestOffset / aLen) * referenceDuration
    : bestOffset * 0.05;

  return {
    offsetSeconds: Math.round(offsetSeconds * 1000) / 1000,
    confidence,
  };
}

function computeOffsetFromFirstPeak(audioPeaks, audioWaveform) {
  const firstStrongPeakIndex = audioPeaks.findIndex((p) => p >= PEAK_THRESHOLD);
  if (firstStrongPeakIndex < 0) {
    return { offsetSeconds: 0, confidence: 0 };
  }

  const aDuration = (audioWaveform && audioWaveform.duration) || 0;
  const estimatedDuration = aDuration || estimateDurationFromPeaks(audioPeaks);
  const offsetSeconds = estimatedDuration > 0 && audioPeaks.length > 0
    ? (firstStrongPeakIndex / audioPeaks.length) * estimatedDuration
    : firstStrongPeakIndex * 0.05;

  const confidence = Math.round(Math.min(MAX_CONFIDENCE, Math.max(MIN_CONFIDENCE, 0.5)) * 100) / 100;

  return {
    offsetSeconds: Math.round(offsetSeconds * 1000) / 1000,
    confidence,
  };
}

function estimateDurationFromPeaks(peaks) {
  if (!peaks || peaks.length === 0) return 0;
  return Math.max(1, peaks.length / 20);
}

/**
 * Given a list of selected clip IDs and the full clips array, return
 * linked video+audio pairs found in the selection.
 *
 * Each pair is { videoClip, audioClip }.
 */
export function findLinkedAudioVideoPairs(selectedClipIds, clips) {
  const selected = new Set(selectedClipIds);
  const clipMap = new Map((clips || []).map((c) => [c.id, c]));
  const pairs = [];
  const seen = new Set();

  for (const id of selected) {
    if (seen.has(id)) continue;
    const clip = clipMap.get(id);
    if (!clip) continue;
    const linkedIds = clip.linkedClipIds || [];
    for (const linkedId of linkedIds) {
      if (selected.has(linkedId) && !seen.has(linkedId)) {
        const linked = clipMap.get(linkedId);
        if (!linked) continue;
        const videoClip = clip.type === 'video' ? clip : linked;
        const audioClip = clip.type === 'audio' ? clip : linked;
        if (videoClip && audioClip) {
          pairs.push({ videoClip, audioClip });
          seen.add(id);
          seen.add(linkedId);
          break;
        }
      }
    }
  }

  return pairs;
}
