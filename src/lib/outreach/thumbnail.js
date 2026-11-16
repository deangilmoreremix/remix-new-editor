// src/lib/outreach/thumbnail.js
//
// Email thumbnails: a still of the video (or the contact's website with the camera bubble, when
// the campaign uses website backgrounds), a play button, and a short personalized line such as
// "Hi Mike, this is for you". Drawn on a canvas in the browser, saved as JPEG.
import { fillTemplate, contactValues } from './draft.js';

export const THUMB_W = 960;
export const THUMB_H = 540;
// Animated GIF: 3 seconds at 12 fps, 480×270 (small enough for email).
export const GIF_W = 480;
export const GIF_H = 270;
export const GIF_SECONDS = 3;
export const GIF_FPS = 12;

export const PLAY_STYLES = ['solid', 'outline', 'glass'];

/** Thumbnail settings with defaults (stored in draft.email.thumb). */
export function thumbSettings(t = {}) {
  const play = t.play || {};
  return {
    type: t.type === 'static' ? 'static' : 'gif',
    start: Math.max(0, Number(t.start) || 0),
    // What is behind the camera bubble: 'auto' (as in the video: their website when it uses one), 'video'
    // (just your recording, full frame) or 'image' (your own picture, `image`, behind the bubble).
    background: ['auto', 'video', 'image'].includes(t.background) ? (t.background === 'image' && !/^https:\/\/\S+$/i.test(t.image || '') ? 'auto' : t.background) : 'auto',
    image: /^https:\/\/\S+$/i.test(t.image || '') ? t.image : '',
    logo: t.logo !== false,
    play: {
      show: play.show !== false,
      style: PLAY_STYLES.includes(play.style) ? play.style : 'solid',
      color: /^#[0-9a-f]{6}$/i.test(play.color || '') ? play.color : '#4f46e5',
      opacity: Math.max(0.2, Math.min(1, Number(play.opacity ?? 1) || 1)),
    },
  };
}

/** The picture behind the bubble for a contact: their website (auto), none (your video full frame) or your image. */
export function thumbBackground(settings, websiteShot = '') {
  if (settings.background === 'video') return '';
  if (settings.background === 'image') return settings.image;
  return websiteShot || '';
}

/** The times (seconds) of the frames a thumbnail uses. */
export function frameTimes({ type, start }, duration = Infinity) {
  const last = Number.isFinite(duration) ? Math.max(0, duration - 0.05) : Infinity;
  if (type === 'static') return [Math.min(start, last)];
  const count = GIF_SECONDS * GIF_FPS;
  const s = Number.isFinite(duration) ? Math.max(0, Math.min(start, duration - GIF_SECONDS)) : start;
  return Array.from({ length: count }, (_, i) => Math.min(s + i / GIF_FPS, last));
}

/** The line written on a contact's thumbnail. */
export function thumbnailText(template, contact, fallbacks = {}) {
  return fillTemplate(template || '', contactValues(contact), fallbacks).slice(0, 80);
}

/** Contacts who would get the same picture share one image (same text and background). */
export function thumbnailKey(text, siteUrl, logoUrl = '') {
  return `${siteUrl || ''}\u0001${logoUrl || ''}\u0001${text}`;
}

/** Break text into at most `maxLines` lines that fit `maxWidth`. */
export function wrapLines(measure, text, maxWidth, maxLines = 2) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (measure(next) <= maxWidth || !line) line = next;
    else { lines.push(line); line = w; }
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    let last = lines[maxLines - 1];
    while (last && measure(`${last}…`) > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

const cover = (ctx, img, x, y, w, h, alignTop = false) => {
  const iw = img.videoWidth || img.naturalWidth || img.width;
  const ih = img.videoHeight || img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const s = Math.max(w / iw, h / ih);
  const dw = iw * s; const dh = ih * s;
  ctx.drawImage(img, x + (w - dw) / 2, alignTop ? y : y + (h - dh) / 2, dw, dh);
};

/**
 * Draw a thumbnail. `frame` is a video frame (video element, image or canvas) of the presenter;
 * `site` an optional website screenshot (the presenter goes in a round bubble); `logo` an
 * optional company logo for the top-right corner. Pure canvas drawing, so it can be tested with
 * a fake context. `progress` (0..1) scrolls the website a little in animated thumbnails.
 */
export function drawThumbnail(ctx, { frame, site = null, logo = null, text = '', width = THUMB_W, height = THUMB_H, play = thumbSettings().play, progress = 0 }) {
  ctx.fillStyle = '#0b0b0f';
  ctx.fillRect(0, 0, width, height);
  if (site) {
    const iw = site.naturalWidth || site.width; const ih = site.naturalHeight || site.height;
    const s = iw && ih ? Math.max(width / iw, height / ih) : 1;
    const overflow = Math.max(0, ih * s - height);
    ctx.drawImage(site, (width - iw * s) / 2, -Math.min(overflow, height * 0.4) * progress, iw * s, ih * s);
    // Camera bubble bottom-left, like the video.
    const d = Math.round(height * 0.46);
    const cx = Math.round(width * 0.03) + d / 2;
    const cy = height - Math.round(height * 0.05) - d / 2;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
    if (frame) cover(ctx, frame, cx - d / 2, cy - d / 2, d, d);
    ctx.restore();
    ctx.lineWidth = Math.max(2, height / 90); ctx.strokeStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2); ctx.stroke();
  } else if (frame) {
    cover(ctx, frame, 0, 0, width, height);
  }
  // Darken the top for the text.
  const g = ctx.createLinearGradient(0, 0, 0, height * 0.55);
  g.addColorStop(0, 'rgba(0,0,0,0.82)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height * 0.55);
  const logoBox = logo ? drawLogo(ctx, logo, width, height) : 0;
  if (text) {
    const size = Math.round(height * 0.085);
    ctx.font = `800 ${size}px Inter, system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'top';
    const lines = wrapLines((t) => ctx.measureText(t).width, text, width * 0.84 - logoBox, 2);
    // A dark plate under the words, so they stay readable over a busy website or recording.
    const x = width * 0.06; const y = height * 0.07; const lh = size * 1.2;
    const padX = size * 0.55; const padY = size * 0.4;
    const textW = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const plateW = textW + padX * 2; const plateH = lines.length * lh - (lh - size) + padY * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.86)';
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x - padX, y - padY, plateW, plateH, size * 0.35); ctx.fill(); } else ctx.fillRect(x - padX, y - padY, plateW, plateH);
    ctx.fillStyle = '#fff';
    lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
  }
  if (play?.show !== false) drawPlay(ctx, width / 2, height / 2, Math.round(height * 0.11), play || {});
}

/** The prospect's logo on a white plate, top-right. Returns the width it takes. */
function drawLogo(ctx, logo, width, height) {
  const iw = logo.naturalWidth || logo.width; const ih = logo.naturalHeight || logo.height;
  if (!iw || !ih) return 0;
  const boxH = Math.round(height * 0.16);
  const pad = Math.round(boxH * 0.14);
  const s = Math.min((boxH - pad * 2) / ih, (width * 0.24 - pad * 2) / iw);
  const w = iw * s; const h = ih * s;
  const boxW = w + pad * 2;
  const x = width - boxW - width * 0.04; const y = height * 0.06;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, boxW, boxH, boxH * 0.18); ctx.fill(); } else ctx.fillRect(x, y, boxW, boxH);
  ctx.drawImage(logo, x + pad, y + (boxH - h) / 2, w, h);
  return boxW + width * 0.03;
}

/** Play button: solid disc, outlined ring, or frosted glass, in the chosen colour and opacity. */
function drawPlay(ctx, px, py, r, { style = 'solid', color = '#4f46e5', opacity = 1 }) {
  ctx.save();
  ctx.globalAlpha = opacity;
  if (style === 'outline') {
    ctx.lineWidth = Math.max(2, r * 0.12); ctx.strokeStyle = color;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color;
  } else if (style === 'glass') {
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = Math.max(1.5, r * 0.05); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.stroke();
    ctx.fillStyle = '#fff';
  } else {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
  }
  ctx.beginPath();
  ctx.moveTo(px - r * 0.32, py - r * 0.48);
  ctx.lineTo(px + r * 0.52, py);
  ctx.lineTo(px - r * 0.32, py + r * 0.48);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

export const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('Could not load a picture for the thumbnail.'));
  img.src = src;
});

/** A video element ready for seeking (CORS-enabled source required to export the canvas). */
export function openVideo(src) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.onloadedmetadata = () => resolve(v);
    v.onerror = () => reject(new Error('Could not read the video for the thumbnail.'));
    v.src = src;
  });
}

const seek = (v, t) => new Promise((resolve) => {
  const done = () => { v.removeEventListener('seeked', done); resolve(); };
  v.addEventListener('seeked', done);
  v.currentTime = t;
});

/** Video frames at `times`, each copied to a canvas of `width`×`height` (cover). */
export async function grabFrames(src, times, { width = GIF_W, height = GIF_H, signal } = {}) {
  const v = await openVideo(src);
  const frames = [];
  for (const t of times) {
    if (signal?.aborted) throw Object.assign(new Error('Stopped'), { name: 'AbortError' });
    await seek(v, t);
    const c = document.createElement('canvas');
    c.width = width; c.height = height;
    cover(c.getContext('2d'), v, 0, 0, width, height);
    frames.push(c);
  }
  return frames;
}

/** A still of the video at `at` seconds (kept for callers that want the element). */
export async function videoFrame(src, at = 1) {
  const v = await openVideo(src);
  await seek(v, Math.min(at, Math.max(0, (v.duration || at) - 0.1)));
  return v;
}

/** Encode RGBA frames as an animated GIF (gifenc, a palette per frame). */
export async function encodeGif(frames, width, height, fps = GIF_FPS) {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
  const gif = GIFEncoder();
  const delay = Math.round(1000 / fps);
  for (const rgba of frames) {
    const palette = quantize(rgba, 256);
    gif.writeFrame(applyPalette(rgba, palette), width, height, { palette, delay });
  }
  gif.finish();
  return new Blob([gif.bytes()], { type: 'image/gif' });
}

/**
 * One contact's thumbnail. `frames` are canvases from grabFrames (one for a still, many for a
 * GIF). Returns a JPEG (still) or GIF Blob.
 */
export async function renderThumbnail({ frames, siteUrl, logoUrl, text, settings = thumbSettings() }) {
  const [site, logo] = await Promise.all([
    siteUrl ? loadImage(siteUrl).catch(() => null) : null,
    settings.logo && logoUrl ? loadImage(logoUrl).catch(() => null) : null,
  ]);
  const still = settings.type === 'static';
  const width = still ? THUMB_W : GIF_W;
  const height = still ? THUMB_H : GIF_H;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: !still });
  const draw = (frame, progress) => drawThumbnail(ctx, { frame, site, logo, text, width, height, play: settings.play, progress });
  if (still) {
    draw(frames[0], 0);
    return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the thumbnail.'))), 'image/jpeg', 0.86));
  }
  const rgba = frames.map((f, i) => {
    draw(f, frames.length > 1 ? i / (frames.length - 1) : 0);
    return ctx.getImageData(0, 0, width, height).data;
  });
  return encodeGif(rgba, width, height);
}
