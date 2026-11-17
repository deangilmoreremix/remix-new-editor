/**
 * AI Captions — burn the captions into the video, in this browser, to a real MP4 (mediabunny: decode → draw captions on each frame → encode;
 * the audio is passed through). Same styles as the preview: the editor's caption style model, drawn here on a canvas.
 */
import { captionPages } from '../template-generator/captionPreview.js';
import { clampPos } from './phonePreview.js';


const caseOf = (style, t) => (style.textTransform === 'uppercase' ? t.toUpperCase() : t);

/** Lay the words of one page out in lines no wider than `maxW`: `[{ words:[{i,text,w}], width }]`. */
export function layoutLines(ctx, words, style, maxW, gap) {
  const lines = [];
  let cur = { words: [], width: 0 };
  words.forEach((w, i) => {
    const text = caseOf(style, w.text);
    const width = ctx.measureText(text).width;
    const add = (cur.words.length ? gap : 0) + width;
    if (cur.words.length && cur.width + add > maxW) { lines.push(cur); cur = { words: [], width: 0 }; }
    cur.width += (cur.words.length ? gap : 0) + width;
    cur.words.push({ i, text, w: width });
  });
  if (cur.words.length) lines.push(cur);
  return lines;
}

const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); ctx.fill(); };

/** Draw the caption page showing at `ms` onto `ctx` (a frame of `w`×`h`). Returns true when something was drawn. */
export function drawCaption(ctx, w, h, { style, pages, ms, percent }) {
  const page = pages.find((p) => ms >= p.start && ms < Math.max(p.end, p.start + 200) + 120);
  if (!page) return false;
  const px = Math.max(12, Math.round((style.fontSize || 0.045) * h));
  ctx.save();
  ctx.font = `${style.fontStyle === 'italic' ? 'italic ' : ''}${style.fontWeight || 700} ${px}px "${String(style.fontFamily || 'Inter').replace(/"/g, '')}", system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const gap = px * 0.28;
  const lines = layoutLines(ctx, page.words, style, w * 0.86, gap);
  const lh = px * (style.lineHeight || 1.2);
  const total = lines.length * lh;
  let y = h * (1 - clampPos(percent) / 100) - total;
  const sw = Math.max(0, (style.strokeWidth || 0) * (h / 640));
  const activeAt = (word) => { const pw = page.words[word.i]; return !style.wholeLine && ms >= pw.start && ms < Math.max(pw.end, pw.start + 120); };
  if (style.wholeLine && style.background) {
    const widest = Math.max(...lines.map((l) => l.width));
    ctx.fillStyle = style.background; rr(ctx, (w - widest) / 2 - px * 0.4, y - px * 0.1, widest + px * 0.8, total + px * 0.2, px * 0.2);
  }
  for (const line of lines) {
    let x = (w - line.width) / 2;
    const cy = y + lh / 2;
    for (const word of line.words) {
      const on = activeAt(word);
      if (on && style.highlightBackground) { ctx.fillStyle = style.highlightBackground; rr(ctx, x - px * 0.2, cy - lh / 2 + px * 0.05, word.w + px * 0.4, lh - px * 0.1, px * 0.25); }
      if (style.textShadow && style.textShadow !== 'none') { ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = px * 0.25; ctx.shadowOffsetY = px * 0.06; } else { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
      if (sw && !(on && style.highlightBackground)) { ctx.lineJoin = 'round'; ctx.lineWidth = sw * 2; ctx.strokeStyle = style.strokeColor || '#000'; ctx.strokeText(word.text, x, cy); }
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = on ? (style.highlightColor || style.color) : (style.color || '#fff');
      ctx.fillText(word.text, x, cy);
      x += word.w + gap;
    }
    y += lh;
  }
  ctx.restore();
  return true;
}

/** Is a real MP4 export possible here (WebCodecs video encoder + canvas)? */
export function burnInSupported(win = globalThis) {
  return !!(win?.VideoEncoder && win?.VideoFrame && (win.OffscreenCanvas || win.document));
}

/**
 * Burn `words` into `source` (a Blob/File) → `{ blob, mimeType, extension, fileSize }`. Throws on abort or when the browser cannot encode.
 * `style` is a caption style, `percent` the distance from the bottom (5–90).
 */
export async function burnInCaptions(source, { words, style, percent = 8, onProgress, signal } = {}) {
  if (!burnInSupported()) throw new Error('This browser cannot export video here (it needs WebCodecs). Download the .srt/.vtt instead, or use Chrome, Edge or Safari.');
  const { Input, Output, Conversion, BlobSource, BufferTarget, Mp4OutputFormat, ALL_FORMATS } = await import('mediabunny');
  const pages = captionPages(words, style);
  const input = new Input({ source: new BlobSource(source), formats: ALL_FORMATS });
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat(), target });
  let canvas = null; let ctx = null;
  const conversion = await Conversion.init({
    input, output,
    video: {
      process: (sample) => {
        const w = sample.displayWidth; const h = sample.displayHeight;
        if (!canvas) { canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }); ctx = canvas.getContext('2d'); }
        sample.draw(ctx, 0, 0, w, h);
        drawCaption(ctx, w, h, { style, pages, ms: sample.timestamp * 1000, percent });
        return canvas;
      },
    },
  });
  if (!conversion.isValid) throw new Error('This video cannot be converted in the browser.');
  conversion.onProgress = (p) => onProgress?.(p);
  const onAbort = () => { void conversion.cancel(); };
  signal?.addEventListener('abort', onAbort);
  try { await conversion.execute(); } finally { signal?.removeEventListener('abort', onAbort); }
  const blob = new Blob([target.buffer], { type: 'video/mp4' });
  return { blob, mimeType: 'video/mp4', extension: 'mp4', fileSize: blob.size };
}
