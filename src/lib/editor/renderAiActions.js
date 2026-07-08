import { WhisperService, whisperService } from '../services/whisper-client.js';
import { SceneDetector } from '../../components/timeline/SceneDetector.js';
import { aiService } from '../services/aiService.js';

/**
 * Convert seconds to SRT timestamp format HH:MM:SS,mmm
 */
function toSrtTimestamp(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const rawMillis = Math.round((seconds % 1) * 1000);
  const millis = rawMillis >= 1000 ? 0 : rawMillis;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

/**
 * Convert seconds to VTT timestamp format HH:MM:SS.mmm
 */
function toVttTimestamp(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const rawMillis = Math.round((seconds % 1) * 1000);
  const millis = rawMillis >= 1000 ? 0 : rawMillis;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

/**
 * Convert normalized Whisper segments to SRT string
 */
function segmentsToSrt(segments) {
  return segments.map((seg, idx) => {
    const index = idx + 1;
    const start = toSrtTimestamp(seg.start);
    const end = toSrtTimestamp(seg.end);
    const text = (seg.text || '').trim();
    return `${index}\n${start} --> ${end}\n${text}\n`;
  }).join('\n');
}

/**
 * Convert normalized Whisper segments to VTT string
 */
function segmentsToVtt(segments) {
  const body = segments.map((seg) => {
    const start = toVttTimestamp(seg.start);
    const end = toVttTimestamp(seg.end);
    const text = (seg.text || '').trim();
    return `${start} --> ${end}\n${text}`;
  }).join('\n\n');
  return `WEBVTT\n\n${body}`;
}

/**
 * Extract audio from video source as a Blob.
 * If videoSource is already a Blob/File (audio), return it directly.
 * If it's a URL string, fetch it as a video and return the blob.
 */
async function extractAudio(videoSource) {
  if (videoSource instanceof Blob) {
    return videoSource;
  }
  if (videoSource instanceof File) {
    return videoSource;
  }
  if (typeof videoSource !== 'string') {
    throw new TypeError('videoSource must be a string, File, or Blob');
  }
  const response = await fetch(videoSource);
  if (!response.ok) {
    throw new Error(`Failed to fetch video source: ${response.status}`);
  }
  return await response.blob();
}

/**
 * generateSubtitles: extract audio from video, call whisper, return SRT/VTT
 */
export async function generateSubtitles(videoUrl, language = 'auto') {
  try {
    const audioBlob = await extractAudio(videoUrl);
    const result = await whisperService.transcribe(audioBlob, {
      language,
      wordTimestamps: true,
    });
    const segments = result.segments || [];
    const srt = segmentsToSrt(segments);
    const vtt = segmentsToVtt(segments);
    return { srt, vtt, segments, text: result.text || '' };
  } catch (error) {
    console.error('[renderAiActions] generateSubtitles failed:', error);
    return { srt: '', vtt: '', segments: [], text: '', error: error.message };
  }
}

/**
 * generateHighlights: detect scenes, return top scenes as highlight candidates
 */
export async function generateHighlights(videoUrl, sensitivity = 0.5) {
  const scenes = await detectScenes(videoUrl, sensitivity);
  if (!scenes || scenes.length === 0) {
    return [];
  }
  const filtered = scenes.filter((scene) => scene.confidence >= sensitivity);
  const sorted = filtered.sort((a, b) => {
    const scoreA = (a.confidence || 0) * (a.duration || 0);
    const scoreB = (b.confidence || 0) * (b.duration || 0);
    return scoreB - scoreA;
  });
  return sorted.slice(0, 5);
}

/**
 * detectScenes: call SceneDetector API for scene detection.
 * Returns raw scene objects without DOM manipulation.
 */
export async function detectScenes(videoUrl, sensitivity = 0.5) {
  try {
    let fakeContainer;
    if (typeof document !== 'undefined') {
      fakeContainer = document.createElement('div');
    } else {
      const noop = () => {};
      fakeContainer = {
        appendChild: noop,
        querySelector: () => ({ style: {}, appendChild: noop }),
      };
    }

    const detector = new SceneDetector(fakeContainer, null, {
      sensitivity,
      showToast: () => {},
    });

    const result = await detector.callSceneDetectionAPI(videoUrl);
    return (result.scenes || []).map((scene) => ({
      startTime: scene.timestamp || 0,
      endTime: (scene.timestamp || 0) + (scene.duration || 0),
      duration: scene.duration || 0,
      confidence: scene.confidence || 0,
      type: scene.type,
    }));
  } catch (error) {
    console.error('[renderAiActions] detectScenes failed:', error);
    return [];
  }
}

/**
 * generateVoiceover: generate TTS audio from script.
 * Uses aiService.muapi for audio generation. Returns a blob URL on success
 * or null when the TTS path is unavailable.
 */
export async function generateVoiceover(script, voice = 'default') {
  try {
    if (!script || typeof script !== 'string') {
      throw new Error('Script must be a non-empty string');
    }
    if (!aiService || !aiService.muapi) {
      console.warn('[renderAiActions] AIService/MuAPI unavailable for TTS');
      return null;
    }
    const params = {
      text: script,
      voice,
      format: 'mp3',
      model: 'tts-v1',
    };
    const result = await aiService.muapi.generateAudio?.(params);
    if (!result || !result.url) {
      return null;
    }
    const response = await fetch(result.url);
    const audioBlob = await response.blob();
    return URL.createObjectURL(audioBlob);
  } catch (error) {
    console.error('[renderAiActions] generateVoiceover failed:', error);
    return null;
  }
}

/**
 * createShorts: detect scenes, select best 60s segment for vertical short.
 * Returns metadata describing the short segment without performing edit.
 */
export async function createShorts(videoUrl, maxDuration = 60) {
  try {
    const scenes = await detectScenes(videoUrl, 0.5);
    if (!scenes || scenes.length === 0) {
      return null;
    }

    const sortedForDuration = [...scenes].sort((a, b) => b.duration - a.duration);
    const candidate = sortedForDuration[0];
    const targetEnd = candidate.startTime + Math.min(candidate.duration || maxDuration, maxDuration);

    const contiguous = scenes
      .filter((s) => s.startTime >= candidate.startTime && s.startTime < targetEnd)
      .sort((a, b) => a.startTime - b.startTime);

    const endTime = contiguous.length > 0
      ? Math.max(...contiguous.map((s) => s.endTime))
      : targetEnd;

    return {
      videoUrl,
      startTime: candidate.startTime,
      endTime: Math.min(endTime, candidate.startTime + maxDuration),
      duration: Math.min(endTime - candidate.startTime, maxDuration),
      scenes: contiguous,
      aspectRatio: '9:16',
    };
  } catch (error) {
    console.error('[renderAiActions] createShorts failed:', error);
    return null;
  }
}

/**
 * runAiAutoEdit: orchestrate full pipeline.
 * Returns {scenes, highlights, subtitles}.
 */
export async function runAiAutoEdit(videoUrl, options = {}) {
  try {
    const sensitivity = options.sensitivity ?? 0.5;
    const subtitleLanguage = options.language || 'auto';

    const scenesPromise = detectScenes(videoUrl, sensitivity);
    const subtitlesPromise = generateSubtitles(videoUrl, subtitleLanguage);

    const [scenes, subtitles] = await Promise.all([
      scenesPromise,
      subtitlesPromise,
    ]);

    const highlights = generateHighlights(videoUrl, sensitivity);

    return { scenes, highlights, subtitles };
  } catch (error) {
    console.error('[renderAiActions] runAiAutoEdit failed:', error);
    return { scenes: [], highlights: [], subtitles: { srt: '', vtt: '', segments: [], text: '' } };
  }
}
