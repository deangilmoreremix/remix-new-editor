// [remix] Browser-side analysis for a clip's media, built on OpenChatCut's pure cores (src/openchatcut/{color,audio,scene}).
// OpenChatCut runs FFmpeg/ffprobe on its server for scene detection and auto-grade; here the only replaced step is
// "get frames / samples": a hidden <video> and WebAudio decoding. Thresholds, scoring and recommendations are theirs.
import { analyzeRgbaPixels, describeScopeStats, type ColorScopeStats } from '../../../openchatcut/color/scopes';
import { recommendAutoGrade } from '../../../openchatcut/color/autoGradeCore';
import { normalizeSceneCandidates, DEFAULT_SCENE_THRESHOLD, DEFAULT_MIN_SCENE_MS, type SceneChange, type RawSceneCandidate } from '../../../openchatcut/scene/detect';
import { detectSilentSpans, rmsEnvelope, type SilenceSpan } from '../../../openchatcut/audio/silence';
import { integratedLoudnessFromSamples, gainForTarget } from '../../../openchatcut/audio/loudness';
import { analyzeBeats, type BeatAnalysis } from '../../../openchatcut/audio/beats';
import { findLag, downsample, TARGET_RATE } from '../../../openchatcut/multicam/align';
import type { Clip, Timeline } from '@cinegen/types/timeline';

export { describeScopeStats, DEFAULT_SCENE_THRESHOLD, DEFAULT_MIN_SCENE_MS, gainForTarget };
export type { ColorScopeStats, SceneChange, SilenceSpan, BeatAnalysis };

// ── frames ──────────────────────────────────────────────────────────────────
async function openVideo(src: string): Promise<HTMLVideoElement> {
  const v = document.createElement('video');
  v.muted = true; v.preload = 'auto'; v.playsInline = true; v.crossOrigin = 'anonymous';
  v.src = src;
  await new Promise<void>((res, rej) => {
    v.onloadeddata = () => res();
    v.onerror = () => rej(new Error('This media could not be opened for analysis.'));
  });
  return v;
}
function seek(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((res) => {
    if (Math.abs(v.currentTime - t) < 1e-3) return res();
    const done = () => { v.removeEventListener('seeked', done); res(); };
    v.addEventListener('seeked', done);
    v.currentTime = t;
  });
}
function pixels(v: HTMLVideoElement, w: number): ImageData {
  const h = Math.max(1, Math.round((w * (v.videoHeight || 9)) / (v.videoWidth || 16)));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(v, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/** Colour statistics of one source frame (OpenChatCut's scopes). */
export async function scopesAt(src: string, sourceTimeSec: number): Promise<ColorScopeStats> {
  const v = await openVideo(src);
  try { await seek(v, Math.max(0, Math.min(sourceTimeSec, (v.duration || 1) - 0.05))); return analyzeRgbaPixels(pixels(v, 320).data); }
  finally { v.removeAttribute('src'); v.load(); }
}

/** OpenChatCut's technical-cleanup recommendation computed from frame statistics (their server ran ffprobe for this). */
export function autoGradeFromScopes(s: ColorScopeStats) {
  return recommendAutoGrade({ sampleCount: s.sampledPixels, yMean: s.meanLuma, yRange: s.whitePoint - s.blackPoint, saturationMean: s.saturationMean }, { hdr: false });
}

/** Cut candidates from frame-to-frame change (replaces their FFmpeg `select='gt(scene,…)'` step); filtering/merging is theirs. */
export async function detectSceneChanges(
  src: string, opts: { threshold?: number; minSceneMs?: number; stepSec?: number; onProgress?: (p: number) => void } = {},
): Promise<SceneChange[]> {
  const v = await openVideo(src);
  try {
    const dur = v.duration || 0;
    const step = opts.stepSec ?? 0.2;
    const cands: RawSceneCandidate[] = [];
    let prev: Uint8ClampedArray | null = null;
    for (let t = 0; t < dur; t += step) {
      await seek(v, t);
      const d = pixels(v, 64).data;
      if (prev) {
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += (Math.abs(d[i] - prev[i]) + Math.abs(d[i + 1] - prev[i + 1]) + Math.abs(d[i + 2] - prev[i + 2])) / 765;
        cands.push({ timeMs: t * 1000, score: sum / (d.length / 4) });
      }
      prev = d;
      opts.onProgress?.(Math.min(1, t / dur));
    }
    return normalizeSceneCandidates(cands, { threshold: opts.threshold ?? DEFAULT_SCENE_THRESHOLD, minSceneMs: opts.minSceneMs ?? DEFAULT_MIN_SCENE_MS, durationMs: dur * 1000 });
  } finally { v.removeAttribute('src'); v.load(); }
}

// ── audio ───────────────────────────────────────────────────────────────────
async function decodeMono(src: string): Promise<{ samples: Float32Array; sampleRate: number }> {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Could not load audio (HTTP ${res.status}).`);
  const buf = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(await res.arrayBuffer());
  const out = new Float32Array(buf.length);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < buf.length; i++) out[i] += d[i] / buf.numberOfChannels; }
  return { samples: out, sampleRate: buf.sampleRate };
}
/** Beat This (OpenChatCut's neural beat/downbeat tracker, ≈83 MB ONNX model downloaded on demand from Hugging Face; WebGPU with WASM fallback). */
export async function beatThisOf(src: string, onProgress?: (p: number) => void, signal?: AbortSignal) {
  const { samples, sampleRate } = await decodeMono(src);
  const { analyzeBeatThis } = await import('../../../openchatcut/audio/intelligence/beatThisClient');
  return analyzeBeatThis(samples, sampleRate, onProgress, signal);
}
/** Quiet stretches (RMS only: candidates, not a verdict that nobody is speaking). */
export async function quietSpans(src: string): Promise<SilenceSpan[]> {
  const { samples, sampleRate } = await decodeMono(src);
  return detectSilentSpans(rmsEnvelope(samples, sampleRate, 50), 50);
}
export async function loudnessLufs(src: string): Promise<number> {
  const { samples, sampleRate } = await decodeMono(src);
  return integratedLoudnessFromSamples(samples, sampleRate);
}
export async function beatsOf(src: string): Promise<BeatAnalysis> {
  const { samples, sampleRate } = await decodeMono(src);
  return analyzeBeats(samples, sampleRate);
}

// ── timeline helpers ────────────────────────────────────────────────────────
/** Source seconds → timeline seconds for this clip, or null if outside the clip's visible window. */
export function sourceToTimeline(clip: Clip, sourceSec: number): number | null {
  const rel = sourceSec - clip.trimStart;
  const t = clip.startTime + rel / (clip.speed || 1);
  const end = clip.startTime + (clip.duration - clip.trimStart - clip.trimEnd) / (clip.speed || 1);
  return t > clip.startTime + 1e-3 && t < end - 1e-3 ? t : null;
}
export function addMarkers(tl: Timeline, times: number[], label: string, color: string): Timeline {
  const existing = tl.markers ?? [];
  const fresh = times.filter((t) => !existing.some((m) => Math.abs(m.time - t) < 0.01))
    .map((time, i) => ({ id: `${label}-${Math.round(time * 1000)}-${i}`, time, color, label }));
  return fresh.length ? { ...tl, markers: [...existing, ...fresh] } : tl;
}

// ── multicam: align one clip's audio to another (OpenChatCut's cross-correlation) ──
export async function audioLagSeconds(refSrc: string, otherSrc: string): Promise<{ lagSeconds: number; confidence: number }> {
  const [a, b] = await Promise.all([decodeMono(refSrc), decodeMono(otherSrc)]);
  const cap = (x: { samples: Float32Array; sampleRate: number }) => downsample(x.samples.subarray(0, Math.floor(x.sampleRate * 45)), x.sampleRate, TARGET_RATE);
  const r = findLag(cap(a), cap(b));
  return { lagSeconds: r.lagSeconds, confidence: r.confidence };
}

// ── speech-aware silences: OpenChatCut's Silero VAD (opt-in; downloads nothing at runtime, model ships in /models/silero-vad) ──
import { installSileroVad } from '../../../openchatcut/audio/silero-vad';
import { obtainVadEvidence, removableSilenceFromEvidence, VAD_MODEL, VAD_MODEL_VERSION } from '../../../openchatcut/audio/vad';
export async function speechAwareQuietSpans(src: string, assetId: string): Promise<{ spans: SilenceSpan[]; status: string }> {
  const { samples, sampleRate } = await decodeMono(src);
  const rmsQuiet = detectSilentSpans(rmsEnvelope(samples, sampleRate, 50), 50);
  installSileroVad();
  const evidence = await obtainVadEvidence({ assetId, sourceRevision: 'v1', model: VAD_MODEL, modelVersion: VAD_MODEL_VERSION, threshold: 0.5 }, samples, sampleRate);
  if (evidence.status !== 'ready') return { spans: [], status: evidence.reason };
  return { spans: removableSilenceFromEvidence(rmsQuiet, evidence, { featureEnabled: true }), status: 'ok' };
}
