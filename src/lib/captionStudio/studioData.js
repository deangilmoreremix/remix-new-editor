/**
 * The hand-off format between the Caption Studio and a host that draws captions itself (the personalization editor). The host gets
 * ready-made PAGES (words already grouped the way the Studio shows them, with their times) and a plain STYLE, so it needs no
 * captioning library of its own: it just feeds them to layoutCaptionFrame (layout.js).
 */
import { captionPages, sortCaptions, normalizeCaption } from './model.js';
import { captionAnimation } from './painter.js';

/** Style fields that cross the boundary. Everything else in a Studio style is editor-only state. */
export const STUDIO_STYLE_KEYS = ['preset', 'fontFamily', 'fontSize', 'position', 'positionY', 'color', 'highlightColor', 'strokeColor', 'backgroundColor',
  'bold', 'italic', 'uppercase', 'stroke', 'background', 'highlightActive', 'combineMs'];

/** @returns {{ pages: { startMs: number, durationMs: number, tokens: { text: string, fromMs: number, toMs: number }[] }[], style: object }} */
export function studioPayload(captions, style = {}) {
  const sorted = sortCaptions(captions);
  const pages = captionPages(sorted, style).map((p) => ({
    startMs: p.startMs, durationMs: p.durationMs,
    tokens: p.tokens.map((t) => ({ text: t.text, fromMs: t.fromMs, toMs: t.toMs })),
  }));
  const out = {};
  STUDIO_STYLE_KEYS.forEach((k) => { if (style[k] !== undefined) out[k] = style[k]; });
  out.animation = captionAnimation(style); // resolved once so the host never needs the looks table
  return { pages, style: out };
}

/** Word-level captions back out of pages (to reopen the Studio on something it made earlier). */
export function captionsFromPages(pages = []) {
  const out = [];
  pages.forEach((p) => p.tokens.forEach((t) => {
    out.push(normalizeCaption({ text: (out.length ? ' ' : '') + t.text.trim(), startMs: t.fromMs, endMs: Math.max(t.toMs, t.fromMs + 1) }));
  }));
  return out;
}
