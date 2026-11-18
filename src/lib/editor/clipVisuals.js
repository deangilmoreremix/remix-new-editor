/**
 * Real clip visuals for the timeline (ported from CineGen's waveform and
 * filmstrip, done in the browser): audio peaks drawn on audio/video clips,
 * thumbnail filmstrips on video clips, and low-res proxy files for smoother
 * preview playback. Everything is cached per media URL and computed lazily,
 * one job at a time, so the timeline stays responsive.
 */
import { decodeAudioAt } from './ml/audio.js';
import { grabFrame, canvasToBlob } from './ml/frameGrab.js';

const PEAKS_PER_SEC = 40;
const peaksCache = new Map(); // src → Promise<{ peaks: Float32Array, rate, duration }>
const thumbsCache = new Map(); // `${src}|${t}` → Promise<string (object URL)>

// One heavy media job at a time.
let queue = Promise.resolve();
const enqueue = (fn) => {
  const p = queue.then(fn, fn);
  queue = p.catch(() => {});
  return p;
};

/** Peak amplitude (0–1) per 1/PEAKS_PER_SEC seconds. */
export function computePeaks(pcm, sampleRate, perSec = PEAKS_PER_SEC) {
  const win = Math.max(1, Math.floor(sampleRate / perSec));
  const out = new Float32Array(Math.ceil(pcm.length / win));
  for (let i = 0; i < out.length; i += 1) {
    let m = 0;
    const end = Math.min(pcm.length, (i + 1) * win);
    for (let j = i * win; j < end; j += 1) { const a = Math.abs(pcm[j]); if (a > m) m = a; }
    out[i] = m;
  }
  let max = 0;
  for (const v of out) if (v > max) max = v;
  if (max > 0) for (let i = 0; i < out.length; i += 1) out[i] /= max;
  return out;
}

export function getPeaks(src) {
  if (!src) return Promise.resolve(null);
  if (!peaksCache.has(src)) {
    const p = enqueue(async () => {
      const pcm = await decodeAudioAt(src, { sampleRate: 8000 });
      return { peaks: computePeaks(pcm, 8000), rate: PEAKS_PER_SEC, duration: pcm.length / 8000 };
    });
    p.catch(() => peaksCache.delete(src));
    peaksCache.set(src, p);
  }
  return peaksCache.get(src);
}

/** Peaks for the part of the source a clip shows, resampled to `bars` values. */
export function peaksForRange({ peaks, rate }, fromSec, toSec, bars) {
  const a = Math.max(0, Math.floor(fromSec * rate));
  const b = Math.min(peaks.length, Math.max(a + 1, Math.ceil(toSec * rate)));
  const out = new Array(bars).fill(0);
  if (b <= a) return out;
  for (let i = 0; i < bars; i += 1) {
    const s = a + Math.floor(((b - a) * i) / bars);
    const e = Math.max(s + 1, a + Math.floor(((b - a) * (i + 1)) / bars));
    let m = 0;
    for (let j = s; j < e && j < peaks.length; j += 1) if (peaks[j] > m) m = peaks[j];
    out[i] = m;
  }
  return out;
}

/** Draw bars into a .clip-wave element (replaces the decorative ones). */
export function drawWave(el, values) {
  if (!el) return;
  el.innerHTML = '';
  el.dataset.real = '1';
  const frag = document.createDocumentFragment();
  values.forEach((v) => {
    const bar = document.createElement('span');
    bar.style.height = `${Math.max(4, Math.round(v * 100))}%`;
    frag.appendChild(bar);
  });
  el.appendChild(frag);
}

/** A small thumbnail (object URL) of a video at `sec`. */
export function getThumb(src, sec) {
  const key = `${src}|${Math.round(sec * 2) / 2}`;
  if (!thumbsCache.has(key)) {
    const p = enqueue(async () => URL.createObjectURL(await canvasToBlob(await grabFrame(src, sec, { maxSize: 160 }), 'image/jpeg', 0.7)));
    p.catch(() => thumbsCache.delete(key));
    thumbsCache.set(key, p);
  }
  return thumbsCache.get(key);
}

/** Paint up to `count` thumbnails across a .clip-thumb element. */
export async function drawFilmstrip(el, src, fromSec, toSec, count) {
  if (!el || !src) return;
  const n = Math.max(1, Math.min(8, count));
  const urls = [];
  for (let i = 0; i < n; i += 1) urls.push(await getThumb(src, fromSec + ((toSec - fromSec) * (i + 0.5)) / n));
  if (!el.isConnected) return;
  el.dataset.real = '1';
  el.style.backgroundImage = urls.map((u) => `url("${u}")`).join(',');
  el.style.backgroundSize = urls.map(() => `${100 / n}% 100%`).join(',');
  el.style.backgroundPosition = urls.map((_, i) => `${n === 1 ? 0 : (i * 100) / (n - 1)}% 0`).join(',');
  el.style.backgroundRepeat = 'no-repeat';
  el.querySelector('.grad')?.style.setProperty('opacity', '0.35');
}

/**
 * Decorate one timeline clip element with real visuals. `info`:
 * { src, type: 'video'|'audio', fromSec, toSec, widthPx }. Skips work when
 * the element already shows the same range.
 */
export function decorateClip(clipEl, info) {
  if (!clipEl || !info?.src || !(info.toSec > info.fromSec)) return;
  const key = `${info.src}|${info.fromSec.toFixed(2)}|${info.toSec.toFixed(2)}|${Math.round(info.widthPx / 40)}`;
  if (clipEl.dataset.visualKey === key) return;
  clipEl.dataset.visualKey = key;
  const wave = clipEl.querySelector('.clip-wave');
  if (wave) {
    getPeaks(info.src).then((p) => {
      if (p && clipEl.dataset.visualKey === key) drawWave(wave, peaksForRange(p, info.fromSec, info.toSec, Math.max(12, Math.min(160, Math.round(info.widthPx / 4)))));
    }).catch(() => {});
  }
  const thumb = clipEl.querySelector('.clip-thumb');
  if (thumb && info.type === 'video') {
    drawFilmstrip(thumb, info.src, info.fromSec, info.toSec, Math.round(info.widthPx / 90)).catch(() => {});
  }
}

// ------------------------------------------------------------------ proxies

const proxies = new Map(); // src → Promise<string> (object URL of a low-res WebM)
const ready = new Map(); // src → url, for the synchronous composition lookup

/** Map(src → proxy URL) of finished proxies (pass to timelineToComposition for preview). */
export const proxyMap = () => ready;

/** Make a ≤540p proxy of a video (VP9 WebM) in the browser. */
export function makeProxy(src, { onProgress, height = 540 } = {}) {
  if (!src) return Promise.reject(new Error('No media'));
  if (!proxies.has(src)) {
    const p = enqueue(async () => {
      const mb = await import('mediabunny');
      const res = await fetch(src);
      if (!res.ok) throw new Error(`Couldn't load the clip (HTTP ${res.status})`);
      const input = new mb.Input({ source: new mb.BlobSource(await res.blob()), formats: mb.ALL_FORMATS });
      const vt = await input.getPrimaryVideoTrack();
      if (!vt) throw new Error('No video track');
      if (vt.displayHeight <= height) return src; // already small: use as is
      const output = new mb.Output({ format: new mb.WebMOutputFormat(), target: new mb.BufferTarget() });
      const conversion = await mb.Conversion.init({
        input,
        output,
        video: { height, codec: 'vp9', bitrate: mb.QUALITY_LOW, forceTranscode: true },
        audio: { codec: 'opus', bitrate: mb.QUALITY_LOW },
      });
      if (!conversion.isValid) throw new Error('This browser cannot make a proxy for this clip');
      conversion.onProgress = (v) => onProgress?.(v);
      await conversion.execute();
      return URL.createObjectURL(new Blob([output.target.buffer], { type: 'video/webm' }));
    });
    p.then((url) => ready.set(src, url)).catch(() => proxies.delete(src));
    proxies.set(src, p);
  }
  return proxies.get(src);
}

export const hasProxy = (src) => ready.has(src);
export function clearProxies() {
  ready.forEach((url, src) => { if (url !== src && String(url).startsWith('blob:')) URL.revokeObjectURL(url); });
  ready.clear();
  proxies.clear();
}
