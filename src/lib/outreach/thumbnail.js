// src/lib/outreach/thumbnail.js
//
// Email thumbnails: a still of the video (or the contact's website with the camera bubble, when
// the campaign uses website backgrounds), a play button, and a short personalized line such as
// "Hi Mike, this is for you". Drawn on a canvas in the browser, saved as JPEG.
import { fillTemplate, contactValues } from './draft.js';

export const THUMB_W = 960;
export const THUMB_H = 540;

/** The line written on a contact's thumbnail. */
export function thumbnailText(template, contact, fallbacks = {}) {
  return fillTemplate(template || '', contactValues(contact), fallbacks).slice(0, 80);
}

/** Contacts who would get the same picture share one image (same text and background). */
export function thumbnailKey(text, siteUrl) {
  return `${siteUrl || ''}\u0001${text}`;
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
 * Draw a thumbnail. `frame` is a video element (or image) showing the presenter; `site` an
 * optional website screenshot. Pure canvas drawing, so it can be tested with a fake context.
 */
export function drawThumbnail(ctx, { frame, site = null, text = '', width = THUMB_W, height = THUMB_H, accent = '#4f46e5' }) {
  ctx.fillStyle = '#0b0b0f';
  ctx.fillRect(0, 0, width, height);
  if (site) {
    cover(ctx, site, 0, 0, width, height, true);
    // Camera bubble bottom-left, like the video.
    const d = Math.round(height * 0.46);
    const cx = Math.round(width * 0.03) + d / 2;
    const cy = height - Math.round(height * 0.05) - d / 2;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
    if (frame) cover(ctx, frame, cx - d / 2, cy - d / 2, d, d);
    ctx.restore();
    ctx.lineWidth = 6; ctx.strokeStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2); ctx.stroke();
  } else if (frame) {
    cover(ctx, frame, 0, 0, width, height);
  }
  // Darken the top for the text.
  const g = ctx.createLinearGradient(0, 0, 0, height * 0.5);
  g.addColorStop(0, 'rgba(0,0,0,0.65)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height * 0.5);
  if (text) {
    const size = Math.round(height * 0.085);
    ctx.font = `800 ${size}px Inter, system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'top';
    const lines = wrapLines((t) => ctx.measureText(t).width, text, width * 0.86, 2);
    lines.forEach((l, i) => ctx.fillText(l, width * 0.06, height * 0.07 + i * size * 1.2));
  }
  // Play button.
  const r = Math.round(height * 0.11);
  const px = width / 2; const py = height / 2;
  ctx.fillStyle = accent;
  ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(px - r * 0.32, py - r * 0.48);
  ctx.lineTo(px + r * 0.52, py);
  ctx.lineTo(px - r * 0.32, py + r * 0.48);
  ctx.closePath(); ctx.fill();
}

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('Could not load the website picture for the thumbnail.'));
  img.src = src;
});

/** A still of the video at `at` seconds (CORS-enabled source required to export the canvas). */
export function videoFrame(src, at = 1) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.onloadedmetadata = () => { v.currentTime = Math.min(at, Math.max(0, (v.duration || at) - 0.1)); };
    v.onseeked = () => resolve(v);
    v.onerror = () => reject(new Error('Could not read the video for the thumbnail.'));
    v.src = src;
  });
}

/** Render one thumbnail to a JPEG Blob. */
export async function renderThumbnail({ frame, siteUrl, text }) {
  const site = siteUrl ? await loadImage(siteUrl).catch(() => null) : null;
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_W; canvas.height = THUMB_H;
  drawThumbnail(canvas.getContext('2d'), { frame, site, text });
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the thumbnail.'))), 'image/jpeg', 0.86));
}
