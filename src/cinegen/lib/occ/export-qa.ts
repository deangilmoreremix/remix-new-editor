// [remix] Export QA in the browser. OpenChatCut's server step (/api/export-qa: FFmpeg blackdetect / freezedetect / silencedetect /
// volumedetect on the rendered file) is replaced by sampling the rendered blob here; their own `assessExportQuality`
// (openchatcut/export/quality.ts) turns the measurements into the report, unchanged.
import { assessExportQuality, type ExportQaAnalysis, type ExportQaExpectations, type ExportQaInterval, type ExportQaReport } from '../../../openchatcut/export/quality';
import { rmsEnvelope } from '../../../openchatcut/audio/silence';

const BLACK_LUMA = 26;          // ffmpeg blackdetect pix_th 0.10
const BLACK_PICTURE = 0.98;     // …pic_th 0.98
const FROZEN_DIFF = 0.6;        // mean absolute luma difference (0–255) below which consecutive samples count as still
const SILENCE_DB = -50;         // ffmpeg silencedetect noise floor
const WINDOW_MS = 50;
const MAX_SAMPLES = 180;

function once(el: HTMLMediaElement, ok: string, bad = 'error'): Promise<void> {
  return new Promise((res, rej) => {
    const done = () => { el.removeEventListener(ok, onOk); el.removeEventListener(bad, onBad); };
    const onOk = () => { done(); res(); };
    const onBad = () => { done(); rej(new Error('This browser cannot decode the rendered file for analysis.')); };
    el.addEventListener(ok, onOk); el.addEventListener(bad, onBad);
  });
}

function merge(times: number[], step: number): ExportQaInterval[] {
  const out: ExportQaInterval[] = [];
  let start = -1; let prev = -1;
  for (const t of times) {
    if (start < 0) { start = t; prev = t; continue; }
    if (t - prev <= step * 1.5) { prev = t; continue; }
    out.push({ startSeconds: start, endSeconds: prev + step, durationSeconds: prev + step - start });
    start = t; prev = t;
  }
  if (start >= 0) out.push({ startSeconds: start, endSeconds: prev + step, durationSeconds: prev + step - start });
  return out;
}

/** Measure a rendered video blob: duration, size, black / still spans (frame sampling), silence and peak level (decoded audio). */
export async function analyzeExportBlob(blob: Blob, expectedFps: number, onProgress?: (p: number) => void): Promise<ExportQaAnalysis> {
  const url = URL.createObjectURL(blob);
  try {
    const v = document.createElement('video');
    v.muted = true; v.preload = 'auto'; v.src = url;
    await once(v, 'loadeddata');
    const durationSeconds = Number.isFinite(v.duration) ? v.duration : 0;
    const hasVideo = v.videoWidth > 0 && v.videoHeight > 0;
    const step = Math.max(0.25, durationSeconds / MAX_SAMPLES);
    const black: number[] = []; const still: number[] = [];
    if (hasVideo) {
      const c = document.createElement('canvas'); c.width = 48; c.height = 27;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      let prev: Uint8ClampedArray | null = null;
      const total = Math.max(1, Math.floor(durationSeconds / step));
      for (let i = 0; i < total; i++) {
        const t = Math.min(durationSeconds - 0.02, i * step + 0.01);
        await new Promise<void>((res) => { const d = () => { v.removeEventListener('seeked', d); res(); }; v.addEventListener('seeked', d); v.currentTime = t; });
        ctx.drawImage(v, 0, 0, c.width, c.height);
        const px = ctx.getImageData(0, 0, c.width, c.height).data;
        const luma = new Uint8ClampedArray(px.length / 4); let dark = 0;
        for (let k = 0; k < luma.length; k++) { const y = 0.2126 * px[k * 4] + 0.7152 * px[k * 4 + 1] + 0.0722 * px[k * 4 + 2]; luma[k] = y; if (y < BLACK_LUMA) dark++; }
        if (dark / luma.length >= BLACK_PICTURE) black.push(i * step);
        if (prev) { let d = 0; for (let k = 0; k < luma.length; k++) d += Math.abs(luma[k] - prev[k]); if (d / luma.length < FROZEN_DIFF) still.push(i * step); }
        prev = luma;
        onProgress?.((i + 1) / total * 0.8);
      }
    }
    let hasAudio = false; let meanVolumeDb: number | undefined; let maxVolumeDb: number | undefined; let silence: ExportQaInterval[] = [];
    try {
      const ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const buf = await ac.decodeAudioData(await blob.arrayBuffer());
      void ac.close();
      hasAudio = buf.numberOfChannels > 0 && buf.length > 0;
      if (hasAudio) {
        const mono = new Float32Array(buf.length); let peak = 0; let sum = 0;
        for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < buf.length; i++) { const s = d[i] / buf.numberOfChannels; mono[i] += s; } }
        for (let i = 0; i < mono.length; i++) { const a = Math.abs(mono[i]); if (a > peak) peak = a; sum += mono[i] * mono[i]; }
        maxVolumeDb = peak > 0 ? 20 * Math.log10(peak) : -91;
        meanVolumeDb = sum > 0 ? 10 * Math.log10(sum / mono.length) : -91;
        const env = rmsEnvelope(mono, buf.sampleRate, WINDOW_MS);
        const floor = Math.pow(10, SILENCE_DB / 20); const quiet: number[] = [];
        env.forEach((r, i) => { if (r < floor) quiet.push((i * WINDOW_MS) / 1000); });
        silence = merge(quiet, WINDOW_MS / 1000);
      }
    } catch { /* no audio stream, or the browser cannot decode it */ }
    onProgress?.(1);
    return {
      durationSeconds, width: v.videoWidth, height: v.videoHeight, fps: expectedFps, hasVideo, hasAudio,
      blackFrames: merge(black, step), frozenFrames: merge(still, step), silence, meanVolumeDb, maxVolumeDb,
    };
  } finally { URL.revokeObjectURL(url); }
}

/** Measure the render, then judge it with OpenChatCut's own rules. */
export async function runExportQaInBrowser(blob: Blob, expected: ExportQaExpectations, onProgress?: (p: number) => void): Promise<ExportQaReport> {
  return assessExportQuality(await analyzeExportBlob(blob, expected.fps, onProgress), expected);
}
