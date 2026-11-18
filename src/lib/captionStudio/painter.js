/**
 * Canvas caption painter. One implementation draws captions for BOTH the modal's live preview and the burned-in export,
 * so what you see is what you render. It mirrors the timeline's CaptionsLayer: font height = fontSize % of the frame
 * height, block centred at 8 / 50 / 82 % for top / middle / bottom, word highlight, boxed words and karaoke wipe,
 * plus the Capite looks' scale / pop / bounce / glow motion.
 */
import { captionPages, pageAt } from './model.js';
import { capiteStyleById } from './styles.js';
import { layoutCaptionFrame } from './layout.js';

/** Which Capite motion a style uses ('highlight' | 'scale' | 'pop' | 'bounce' | 'glow' | 'box' | 'karaoke'). */
export function captionAnimation(style = {}) {
  if (style.karaoke || style.preset === 'karaoke') return 'karaoke';
  if (style.boxed || style.preset === 'box') return 'box';
  const id = typeof style.preset === 'string' && style.preset.startsWith('capite-') ? style.preset.slice(7) : null;
  return (id && capiteStyleById(id)?.animationType) || 'highlight';
}

/** Script → Google Font that has its glyphs. Latin, Cyrillic and Greek are covered by the caption font itself or by Noto Sans. */
const SCRIPT_FONTS = [
  [/[\u3040-\u30ff]/, 'Noto Sans JP'], [/[\uac00-\ud7af\u1100-\u11ff]/, 'Noto Sans KR'], [/[\u4e00-\u9fff]/, 'Noto Sans SC'],
  [/[\u0600-\u06ff\u0750-\u077f]/, 'Noto Sans Arabic'], [/[\u0900-\u097f]/, 'Noto Sans Devanagari'], [/[\u0e00-\u0e7f]/, 'Noto Sans Thai'],
  [/[\u0590-\u05ff]/, 'Noto Sans Hebrew'], [/[\u0980-\u09ff]/, 'Noto Sans Bengali'], [/[\u0b80-\u0bff]/, 'Noto Sans Tamil'], [/[\u0c00-\u0c7f]/, 'Noto Sans Telugu'],
];
/** The fallback families a piece of text needs (for example ['Noto Sans JP'] for Japanese). */
export const scriptFontsFor = (text = '') => SCRIPT_FONTS.filter(([re]) => re.test(text)).map(([, f]) => f);
const FALLBACKS = ['Noto Sans', ...SCRIPT_FONTS.map(([, f]) => `"${f}"`), 'Arial', 'sans-serif'];
export const captionFont = (style, px) => `${style.italic ? 'italic ' : ''}${style.bold ? 800 : 500} ${px}px "${style.fontFamily || 'Inter'}", ${FALLBACKS.join(', ')}`;

export { layoutWords, layoutCaptionFrame, activePageAt } from './layout.js';

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
};

/** The style the layout understands: the preset's motion is resolved once here so layout.js needs no knowledge of the looks. */
export const frameStyle = (style = {}) => ({ ...style, animation: captionAnimation(style) });

/** Draw a laid-out frame (see layoutCaptionFrame) onto a 2D context. */
export function drawCaptionFrame(ctx, frame, style = {}) {
  const { fontPx, lineH } = frame;
  ctx.save();
  ctx.font = captionFont(style, fontPx);
  ctx.textAlign = 'left';
  ctx.lineJoin = 'round';
  // A CSS line box centres the font's ascent+descent, not the em square (canvas 'middle'). Fonts such as Anton or Bebas Neue are
  // lopsided, so 'middle' drew them several px higher than the Timeline and personalization (both DOM). Use the font's own metrics so
  // all three place text identically; fall back to 'middle' where the browser does not report them.
  const m = ctx.measureText('Hg');
  const hasMetrics = Number.isFinite(m.fontBoundingBoxAscent) && Number.isFinite(m.fontBoundingBoxDescent);
  ctx.textBaseline = hasMetrics ? 'alphabetic' : 'middle';
  const baseline = hasMetrics ? (m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2 : 0;
  frame.lineBoxes.forEach((b) => { ctx.fillStyle = b.color; roundRect(ctx, b.x, b.y, b.w, b.h, b.r); ctx.fill(); });
  frame.words.forEach((w) => {
    ctx.save();
    ctx.translate(w.cx, w.cy);
    ctx.scale(w.scale, w.scale);
    const lx = -w.width / 2;
    if (w.box) { ctx.fillStyle = w.box.color; roundRect(ctx, w.box.x, w.box.y, w.box.w, w.box.h, w.box.r); ctx.fill(); }
    const draw = (color, clipFraction) => {
      ctx.save();
      if (clipFraction != null) { ctx.beginPath(); ctx.rect(lx, -lineH, w.width * clipFraction, lineH * 2); ctx.clip(); }
      if (w.outlinePx) {
        ctx.lineWidth = w.outlinePx * 2; // the stroke is centred on the glyph edge, so half of it shows outside
        ctx.strokeStyle = w.outlineColor;
        ctx.shadowColor = 'transparent';
        ctx.strokeText(w.text, lx, baseline);
      }
      if (w.shadow) { ctx.shadowColor = w.shadow.color; ctx.shadowBlur = w.shadow.blur; ctx.shadowOffsetY = w.shadow.offsetY; }
      ctx.fillStyle = color;
      ctx.fillText(w.text, lx, baseline);
      ctx.restore();
    };
    draw(w.color);
    if (w.wipe) draw(w.wipe.color, w.wipe.fraction);
    ctx.restore();
  });
  ctx.restore();
}

/**
 * Draw the caption page showing at `ms` (relative to the video start) onto ctx.
 * @returns {boolean} true when something was drawn
 */
export function paintCaptions(ctx, W, H, captions, style = {}, ms = 0, { pages } = {}) {
  const page = pageAt(pages || captionPages(captions, style), ms);
  if (!page) return false;
  const fs = frameStyle(style);
  const fontPx = (Math.max(1, Number(style.fontSize) || 6) / 100) * H;
  ctx.save();
  ctx.font = captionFont(style, fontPx); // measuring happens at the caption's real size
  const frame = layoutCaptionFrame({ page, style: fs, ms, width: W, height: H, measure: (t) => ctx.measureText(t).width });
  ctx.restore();
  if (!frame) return false;
  drawCaptionFrame(ctx, frame, style);
  return true;
}

const loaded = new Set();
const addFontLink = (family, spec) => {
  const id = `csm-font-${family.replace(/\W+/g, '-')}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id; link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}${spec}&display=swap`;
  document.head.appendChild(link);
};
/**
 * Make sure the caption font can be drawn on a canvas (canvas never waits for a web font). Google Fonts are loaded on demand, and so are
 * the fonts the caption text needs for its script (Japanese, Korean, Chinese, Arabic, Devanagari, Thai, …). A font that cannot be loaded
 * falls back to Arial instead of blocking the render.
 * @param {string} [text]  the caption text, to pick script fonts
 */
export async function ensureCaptionFont(style = {}, text = '') {
  if (typeof document === 'undefined' || !document.fonts) return;
  const family = style.fontFamily || 'Inter';
  const scripts = scriptFontsFor(text);
  const key = `${family}|${style.bold ? 1 : 0}|${style.italic ? 1 : 0}|${scripts.join(',')}`;
  if (loaded.has(key)) return;
  try {
    if (!document.fonts.check(`16px "${family}"`)) addFontLink(family, ':ital,wght@0,500;0,800;1,500;1,800');
    scripts.forEach((f) => { if (!document.fonts.check(`16px "${f}"`)) addFontLink(f, ':wght@500;800'); });
    await Promise.race([
      Promise.all([document.fonts.load(captionFont(style, 32), text || undefined), ...scripts.map((f) => document.fonts.load(`800 32px "${f}"`, text))]),
      new Promise((r) => setTimeout(r, 5000)),
    ]);
  } catch { /* fall back to the system font */ }
  loaded.add(key);
}
