/**
 * Template Generator — how a word-timed caption looks in the wizard (the style tiles and the live preview).
 * Pure string builders: a caption style from the editor's list (`CaptionStyle`, Capite's 27 among them) → inline CSS and HTML.
 * The timeline itself draws the same style with the editor's own caption renderer; this is its in-modal twin.
 */
import { paginate, activePage } from '../../../openchatcut/captions/types';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** The words, as pages (a few at a time) ready to show: `[{ words, start, end }]`. */
export function captionPages(words, style) {
  return paginate(words || [], 'phrase', style?.wordsPerPage || 4);
}

/** Inline CSS of the caption text itself, for a frame `frameH` pixels tall. */
export function captionTextCss(style, frameH = 360) {
  const px = Math.max(9, Math.round((style.fontSize || 0.045) * frameH));
  const sw = Math.max(0, (style.strokeWidth || 0) * (frameH / 640));
  return [
    `font-family:'${String(style.fontFamily || 'Inter').replace(/'/g, '')}',system-ui,sans-serif`,
    `font-size:${px}px`,
    `font-weight:${style.fontWeight || 700}`,
    style.fontStyle ? `font-style:${style.fontStyle}` : '',
    `color:${style.color || '#fff'}`,
    `letter-spacing:${style.letterSpacing || 0}px`,
    `line-height:${style.lineHeight || 1.15}`,
    style.textTransform === 'uppercase' ? 'text-transform:uppercase' : '',
    sw ? `-webkit-text-stroke:${sw.toFixed(2)}px ${style.strokeColor || '#000'};paint-order:stroke fill` : '',
    style.textShadow && style.textShadow !== 'none' ? `text-shadow:${style.textShadow}` : '',
  ].filter(Boolean).join(';');
}

/** One caption page with the word that is being spoken at `ms` picked out. */
export function captionPageHTML(style, page, ms, { motion = 'pop' } = {}) {
  if (!page) return '';
  const whole = !!style.wholeLine;
  const spans = page.words.map((w) => {
    const on = !whole && ms >= w.start && ms < Math.max(w.end, w.start + 120);
    const css = on
      ? [`color:${style.highlightColor || style.color}`, style.highlightBackground ? `background:${style.highlightBackground};border-radius:.28em;padding:0 .22em;-webkit-text-stroke:0` : '', motion !== 'none' && motion !== 'fade-up' ? 'display:inline-block;transform:scale(1.1)' : ''].filter(Boolean).join(';')
      : '';
    return `<span class="tg-cw${on ? ' is-on' : ''}"${css ? ` style="${css}"` : ''}>${esc(w.text)}</span>`;
  });
  return spans.join(' ');
}

/** The page showing at `ms` for a track (`{ style, words, motion }`), or null. */
export function captionAt(pages, ms) {
  return activePage(pages, ms);
}

/** A little sample for a style tile: the same words, the middle one picked out. */
export function captionSampleHTML(style, text = 'Make it pop') {
  const words = text.split(' ').map((t, i) => ({ text: t, start: i * 1000, end: i * 1000 + 1000 }));
  // one inline wrapper: inside a flex tile the bare word spans would be separate items and lose the spaces between them
  return `<span class="tg-capline">${captionPageHTML(style, { words, start: 0, end: words.length * 1000 }, 1500, { motion: style.motion || 'pop' })}</span>`;
}

const stamp = (ms) => { const t = Math.max(0, Math.round(ms)); const p = (n, w = 2) => String(n).padStart(w, '0'); return `${p(Math.floor(t / 3600000))}:${p(Math.floor((t % 3600000) / 60000))}:${p(Math.floor((t % 60000) / 1000))},${p(t % 1000, 3)}`; };

const vttEscape = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const vttStamp = (ms) => stamp(ms).replace(',', '.');

/** The caption pages as a WebVTT (.vtt) file: the same cues as the .srt, with the WEBVTT header, dot milliseconds and escaped text. */
export function pagesToVtt(pages) {
  return `WEBVTT\n\n${pages.map((pg, i) => `${i + 1}\n${vttStamp(pg.start)} --> ${vttStamp(Math.max(pg.end, pg.start + 200))}\n${vttEscape(pg.words.map((w) => w.text).join(' '))}`).join('\n\n')}${pages.length ? '\n' : ''}`;
}

/** The caption pages as an .srt file (one cue per page, the way they show on the video). */
export function pagesToSrt(pages) {
  return `${pages.map((pg, i) => `${i + 1}\n${stamp(pg.start)} --> ${stamp(Math.max(pg.end, pg.start + 200))}\n${pg.words.map((w) => w.text).join(' ')}`).join('\n\n')}${pages.length ? '\n' : ''}`;
}
