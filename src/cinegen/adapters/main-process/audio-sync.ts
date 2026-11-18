// [remix] CineGen's audio sync (electron/workers/audio-sync.ts), run in the browser. The correlation,
// vote-summary, filename-similarity and batch-matching code is copied as is. ffmpeg/ffprobe/fpcalc are not
// available in a browser, so audio is decoded with WebAudio and the full-file waveform correlation (CineGen's own
// fallback path) is used; timecode and fingerprint shortcuts are skipped.
import { decodeAudioAt } from '../../../lib/editor/ml/audio.js';

// [remix] The two node:path calls this file's filename scoring uses.
const path = {
  basename(p: string, ext = ''): string {
    const base = p.split(/[\\/]/).pop() ?? p;
    return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base;
  },
  extname(p: string): string {
    const base = p.split(/[\\/]/).pop() ?? p;
    const i = base.lastIndexOf('.');
    return i > 0 ? base.slice(i) : '';
  },
};

const SYNC_SAMPLE_RATE = 8000;
const FAST_SYNC_WINDOW_SECONDS = 20;
const FAST_SYNC_MIN_PAIR_CONFIDENCE = 0.4;
const FAST_SYNC_ACCEPT_CONFIDENCE = 0.55;

interface AnalysisWindow {
  label: 'start' | 'middle' | 'end';
  startSeconds: number;
  durationSeconds: number;
}


interface OffsetVote {
  offsetSeconds: number;
  confidence: number;
  label: string;
}

/** Seconds represented by each fingerprint index (fpcalc resolution) */
export const FP_INDEX_TO_SECONDS = 0.1238;

export interface CorrelationResult {
  /** Offset in abstract index units (fingerprint or window). */
  offsetIndex: number;
  /** Similarity score 0-1, where 1 = identical */
  confidence: number;
  /** Offset in seconds (set by PCM correlator, 0 for fingerprint). */
  _offsetSeconds: number;
}


/**
 * Standard dynamic-programming Levenshtein distance.
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  // dp[i][j] = edit distance between a[0..i-1] and b[0..j-1]
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Normalized similarity score between two filenames (ignoring extensions).
 * Returns 1.0 for identical basenames, 0.0 for completely different.
 */
/** Strip extension from a filename, treating dotfiles (e.g. `.mov`) as pure-extension names with an empty stem. */
function stemOf(file: string): string {
  const name = path.basename(file);
  const ext = path.extname(name);
  // path.extname('.mov') returns '' because Node treats it as a dotfile;
  // detect the pattern manually: starts with dot, no other dots → empty stem.
  if (ext === '' && name.startsWith('.')) return '';
  return path.basename(name, ext);
}

export function scoreFilenameSimilarity(fileA: string, fileB: string): number {
  const baseA = stemOf(fileA).toLowerCase();
  const baseB = stemOf(fileB).toLowerCase();

  if (baseA.length === 0 && baseB.length === 0) return 1.0;

  const dist = levenshteinDistance(baseA, baseB);
  const maxLen = Math.max(baseA.length, baseB.length);
  if (maxLen === 0) return 1.0;

  return 1 - dist / maxLen;
}

// ─── FFprobe / fpcalc Wrappers ───────────────────────────────────────────────

interface FfprobeOutput {
  format?: {
    duration?: string;
    tags?: Record<string, string>;
  };
  streams?: Array<{
    codec_type?: string;
    r_frame_rate?: string;
    tags?: Record<string, string>;
  }>;
}


function summarizeOffsetVotes(
  votes: OffsetVote[],
  label: string,
): CorrelationResult {
  if (votes.length === 0) {
    console.log(`[audio-sync] ${label}: no valid matches found`);
    return { offsetIndex: 0, confidence: 0, _offsetSeconds: 0 };
  }

  console.log(`[audio-sync] ${label} votes:`, votes.map((vote) =>
    `${vote.label}: offset=${vote.offsetSeconds.toFixed(2)}s conf=${vote.confidence.toFixed(3)}`
  ).join(' | '));

  votes.sort((a, b) => a.offsetSeconds - b.offsetSeconds);
  let bestGroup: OffsetVote[] = [];
  let bestGroupScore = -Infinity;

  for (let i = 0; i < votes.length; i++) {
    const group = [votes[i]];
    for (let j = i + 1; j < votes.length; j++) {
      if (Math.abs(votes[j].offsetSeconds - votes[i].offsetSeconds) < 1.5) {
        group.push(votes[j]);
      }
    }
    const avgConfidence = group.reduce((sum, vote) => sum + vote.confidence, 0) / group.length;
    const score = group.length * avgConfidence;
    if (score > bestGroupScore) {
      bestGroupScore = score;
      bestGroup = group;
    }
  }

  const totalConfidence = bestGroup.reduce((sum, vote) => sum + vote.confidence, 0);
  const weightedOffset =
    bestGroup.reduce((sum, vote) => sum + vote.offsetSeconds * vote.confidence, 0) / totalConfidence;
  const avgConfidence = totalConfidence / bestGroup.length;

  console.log(
    `[audio-sync] ${label} result: offset=${weightedOffset.toFixed(3)}s confidence=${avgConfidence.toFixed(3)} (${bestGroup.length}/${votes.length} votes agreed)`,
  );

  return {
    offsetIndex: 0,
    confidence: Math.min(1.0, avgConfidence),
    _offsetSeconds: weightedOffset,
  };
}


/**
 * Cross-correlate two PCM waveforms to find the best time offset.
 *
 * The offset tells you: target audio starts at (offset) seconds relative to source.
 * Positive offset = target starts later than source (audio recording started after camera).
 * Negative offset = target starts earlier than source (audio recording started before camera).
 *
 * Strategy: take anchors from the SHORTER file and search the ENTIRE longer file.
 * This handles cases where the audio recording only covers part of the video
 * (e.g., audio started mid-way through, or audio is longer than video).
 *
 * Uses coarse-then-fine Pearson NCC for speed + sub-frame accuracy.
 */
export function crossCorrelatePcm(
  source: Float32Array,
  target: Float32Array,
  sampleRate: number,
): CorrelationResult {
  const coarseStep = Math.floor(sampleRate * 0.25); // 0.25s coarse scan
  const fineStep = Math.floor(sampleRate * 0.01);   // 10ms fine refinement

  // Use the SHORTER file for anchors, search the LONGER file
  // This ensures we find overlap even if audio only covers part of video
  const shorter = source.length <= target.length ? source : target;
  const longer = source.length <= target.length ? target : source;
  const flipped = source.length > target.length; // if true, offset sign needs flipping

  console.log(`[audio-sync] Anchor file: ${(shorter.length / sampleRate).toFixed(1)}s, Search file: ${(longer.length / sampleRate).toFixed(1)}s${flipped ? ' (flipped)' : ''}`);

  // Pick anchors from start, middle, and end of the shorter file
  const skipEdge = Math.min(5 * sampleRate, Math.floor(shorter.length * 0.05));
  const usableLen = shorter.length - 2 * skipEdge;
  const desiredAnchorSamples = 10 * sampleRate;
  const minAnchorSamples = Math.max(1, Math.floor(sampleRate * 2));
  const anchorSamples = Math.max(
    Math.min(desiredAnchorSamples, usableLen),
    Math.min(minAnchorSamples, usableLen),
  );
  const numAnchors = Math.min(6, Math.max(1, Math.floor(usableLen / Math.max(1, anchorSamples))));

  if (usableLen <= 0 || anchorSamples <= 0 || longer.length < anchorSamples) {
    return { offsetIndex: 0, confidence: 0, _offsetSeconds: 0 };
  }

  const anchorSpacing = Math.floor((usableLen - anchorSamples) / Math.max(1, numAnchors - 1));
  const votes: OffsetVote[] = [];

  for (let a = 0; a < numAnchors; a++) {
    const anchorStart = skipEdge + a * anchorSpacing;
    const anchorEnd = Math.min(anchorStart + anchorSamples, shorter.length);
    const anchor = shorter.subarray(anchorStart, anchorEnd);
    const anchorLen = anchor.length;
    if (anchorLen < anchorSamples * 0.5) continue;

    // Precompute anchor stats for Pearson NCC
    let aSum = 0, aSum2 = 0;
    for (let i = 0; i < anchorLen; i++) {
      aSum += anchor[i];
      aSum2 += anchor[i] * anchor[i];
    }
    const aMean = aSum / anchorLen;
    const aVar = aSum2 / anchorLen - aMean * aMean;
    if (aVar < 1e-10) continue; // silence, skip

    const computeNCC = (pos: number): number => {
      let tSum = 0, tSum2 = 0, cross = 0;
      for (let i = 0; i < anchorLen; i++) {
        const t = longer[pos + i];
        tSum += t;
        tSum2 += t * t;
        cross += anchor[i] * t;
      }
      const tMean = tSum / anchorLen;
      const tVar = tSum2 / anchorLen - tMean * tMean;
      if (tVar < 1e-10) return -1;
      return (cross / anchorLen - aMean * tMean) / Math.sqrt(aVar * tVar);
    };

    // Search the ENTIRE longer file (no maxOffset limit since overlap could be anywhere)
    const searchEnd = longer.length - anchorLen;
    let bestNCC = -Infinity;
    let bestPos = 0;

    // Coarse pass
    for (let pos = 0; pos <= searchEnd; pos += coarseStep) {
      const ncc = computeNCC(pos);
      if (ncc > bestNCC) { bestNCC = ncc; bestPos = pos; }
    }

    // Fine pass around coarse best (±0.5s)
    const fineStart = Math.max(0, bestPos - coarseStep * 2);
    const fineEnd = Math.min(searchEnd, bestPos + coarseStep * 2);
    for (let pos = fineStart; pos <= fineEnd; pos += fineStep) {
      const ncc = computeNCC(pos);
      if (ncc > bestNCC) { bestNCC = ncc; bestPos = pos; }
    }

    if (bestNCC > 0.15) {
      const rawOffset = (bestPos - anchorStart) / sampleRate;
      const finalOffset = flipped ? rawOffset : -rawOffset;
      votes.push({ offsetSeconds: finalOffset, confidence: bestNCC, label: `a${a}` });
    }
  }

  return summarizeOffsetVotes(votes, 'PCM anchor');
}


export interface SyncResult {
  offsetSeconds: number;
  method: 'timecode' | 'waveform';
  confidence: number;
}


async function pcmOf(src: string): Promise<Float32Array> {
  return (await decodeAudioAt(src, { sampleRate: SYNC_SAMPLE_RATE })) as Float32Array;
}

/** Offset of `targetAudioPath` relative to `sourceVideoPath` by waveform cross-correlation. */
export async function computeSyncOffset(sourceVideoPath: string, targetAudioPath: string, ..._unused: unknown[]): Promise<SyncResult> {
  const [sourcePcm, targetPcm] = await Promise.all([pcmOf(sourceVideoPath), pcmOf(targetAudioPath)]);
  const correlation = crossCorrelatePcm(sourcePcm, targetPcm, SYNC_SAMPLE_RATE);
  return { offsetSeconds: correlation._offsetSeconds, method: 'waveform', confidence: correlation.confidence };
}

export interface BatchProgress {
  completedPairs: number;
  totalPairs: number;
  currentVideoName: string;
  currentAudioName: string;
}

export interface BatchPair {
  videoAssetId: string;
  audioAssetId: string;
  offsetSeconds: number;
  matchMethod: 'timecode' | 'waveform';
  nameScore: number;
  waveformScore: number;
}

export interface BatchResult {
  pairs: BatchPair[];
  unmatchedVideos: string[];
  unmatchedAudio: string[];
}

export async function computeBatchMatch(
  videoAssets: Array<{ id: string; filePath: string; name: string }>,
  audioAssets: Array<{ id: string; filePath: string; name: string }>,
  ffmpegPath: string,
  ffprobePath: string,
  fpcalcPath: string,
  onProgress?: (progress: BatchProgress) => void,
): Promise<BatchResult> {
  const pairs: BatchPair[] = [];
  const usedAudioIds = new Set<string>();
  const totalPairs = videoAssets.length;

  for (let vi = 0; vi < videoAssets.length; vi++) {
    const video = videoAssets[vi];

    const candidates = audioAssets
      .filter((a) => !usedAudioIds.has(a.id))
      .map((a) => ({
        audio: a,
        nameScore: scoreFilenameSimilarity(video.name, a.name),
      }))
      .sort((a, b) => b.nameScore - a.nameScore);

    let matched = false;

    for (const candidate of candidates) {
      onProgress?.({
        completedPairs: vi,
        totalPairs,
        currentVideoName: video.name,
        currentAudioName: candidate.audio.name,
      });

      try {
        const syncResult = await computeSyncOffset(
          video.filePath,
          candidate.audio.filePath,
          ffmpegPath,
          ffprobePath,
          fpcalcPath,
        );

        if (syncResult.confidence >= 0.4) {
          pairs.push({
            videoAssetId: video.id,
            audioAssetId: candidate.audio.id,
            offsetSeconds: syncResult.offsetSeconds,
            matchMethod: syncResult.method,
            nameScore: candidate.nameScore,
            waveformScore: syncResult.confidence,
          });
          usedAudioIds.add(candidate.audio.id);
          matched = true;
          break;
        }
      } catch {
        continue;
      }
    }

    void matched; // suppress unused variable warning
  }

  const matchedVideoIds = new Set(pairs.map((p) => p.videoAssetId));
  const unmatchedVideos = videoAssets.filter((v) => !matchedVideoIds.has(v.id)).map((v) => v.id);
  const unmatchedAudio = audioAssets.filter((a) => !usedAudioIds.has(a.id)).map((a) => a.id);

  onProgress?.({ completedPairs: totalPairs, totalPairs, currentVideoName: '', currentAudioName: '' });

  return { pairs, unmatchedVideos, unmatchedAudio };
}


