/**
 * Caption frame layout: the ONE place that decides where every caption word goes and how it looks at a given moment. Pure functions,
 * no imports, no DOM and no canvas, so the identical file runs in the Caption Studio (drawn on a canvas), in the personalization
 * composition (drawn as DOM, which the browser exporter can rasterize), and in tests. Copied verbatim into
 * src/features/personalization/shared/personalization/captions/studioLayout.js (a test fails if the copies differ).
 *
 * Geometry mirrors the Timeline's captions layer: font height = fontSize % of the frame height, block centred at 8 / 50 / 82 % for
 * top / middle / bottom (or at `positionY`), word highlight, boxed words, karaoke wipe, and the scale / pop / bounce / glow motions.
 */

const POSITION_Y = { top: 0.08, middle: 0.5, bottom: 0.82 };
const clamp01 = (n) => Math.max(0, Math.min(1, n));
const easeOutBack = (t) => { const c = 1.70158; const x = t - 1; return 1 + (c + 1) * x * x * x + c * x * x; };

/**
 * The page (a group of words shown together) showing at `ms`, or null. Same rule as the Timeline's pageAt: a page stays up a little
 * after its last word (holdMs) so the line does not vanish the instant it is spoken.
 * @param {{ startMs: number, durationMs: number, tokens: { fromMs: number, toMs: number }[] }[]} pages
 */
export function activePageAt(pages, ms, holdMs = 600) {
  for (let i = pages.length - 1; i >= 0; i -= 1) {
    const p = pages[i];
    if (ms >= p.startMs) {
      const lastToken = p.tokens.length ? p.tokens[p.tokens.length - 1].toMs : p.startMs;
      const end = Math.min(p.startMs + p.durationMs, lastToken + holdMs);
      return ms < Math.max(end, lastToken) ? p : null;
    }
  }
  return null;
}

const RTL_CHAR = /[\u0590-\u05ff\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]/;
/** A line reads right-to-left when most of its words are Hebrew / Arabic script. */
const isRtlLine = (line) => line.words.filter((w) => RTL_CHAR.test(w.text)).length * 2 > line.words.length;

/** Word-wrap a page's tokens into lines that fit maxWidth. `measure(text) => width` is the only thing that touches a font. */
export function layoutWords(tokens, measure, maxWidth, uppercase) {
  const words = tokens.map((t) => ({ token: t, text: uppercase ? t.text.trim().toUpperCase() : t.text.trim() })).filter((w) => w.text);
  const space = measure(' ');
  const lines = [];
  let line = null;
  words.forEach((w) => {
    w.width = measure(w.text);
    if (!line || line.width + space + w.width > maxWidth) { line = { words: [], width: 0 }; lines.push(line); }
    line.width += (line.words.length ? space : 0) + w.width;
    line.words.push(w);
  });
  return { lines, space };
}

/**
 * Lay out one frame.
 * @param {object} o
 * @param {{ tokens: { text: string, fromMs: number, toMs: number }[] }} o.page  the page to show (see activePageAt)
 * @param {object} o.style  caption style: fontSize (% of height), position | positionY, color, highlightColor, strokeColor, backgroundColor,
 *   uppercase, stroke, background, highlightActive, animation ('highlight' | 'scale' | 'pop' | 'bounce' | 'glow' | 'box' | 'karaoke')
 * @param {number} o.ms  time since the start of the video
 * @param {number} o.width @param {number} o.height  frame size in px
 * @param {(text: string) => number} o.measure  text width in px at the caption font size (`fontPx` of the returned frame)
 * @returns {null | { fontPx: number, lineH: number, anim: string, lineBoxes: object[], words: object[] }}
 */
export function layoutCaptionFrame({ page, style = {}, ms, width: W, height: H, measure }) {
  if (!page?.tokens?.length) return null;
  const fontPx = (Math.max(1, Number(style.fontSize) || 6) / 100) * H;
  const anim = style.animation || 'highlight';
  const boxed = anim === 'box';
  const lineBgColor = style.background && !boxed ? (style.backgroundColor || 'rgba(0,0,0,0.6)') : null;
  const base = style.color || '#FFFFFF';
  const hi = style.highlightColor || '#FFE14D';
  const lineH = fontPx * 1.25;
  const { lines, space } = layoutWords(page.tokens, measure, W * 0.88, !!style.uppercase);
  if (!lines.length) return null;

  const blockH = lines.length * lineH;
  const centreY = Number.isFinite(style.positionY) ? clamp01(style.positionY) : (POSITION_Y[style.position] ?? POSITION_Y.bottom);
  const top = Math.max(H * 0.02, Math.min(H * 0.98 - blockH, centreY * H - blockH / 2));
  const outlined = !!style.stroke && !lineBgColor && !boxed;

  const lineBoxes = [];
  const words = [];
  lines.forEach((line, li) => {
    const cy = top + li * lineH + lineH / 2;
    const x0 = (W - line.width) / 2;
    const rtl = isRtlLine(line);
    const xs = [];
    let cursor = x0;
    (rtl ? line.words.map((_, i) => i).reverse() : line.words.map((_, i) => i)).forEach((i) => { xs[i] = cursor; cursor += line.words[i].width + space; });
    if (lineBgColor) lineBoxes.push({ x: x0 - fontPx * 0.35, y: cy - lineH / 2 + fontPx * 0.06, w: line.width + fontPx * 0.7, h: lineH - fontPx * 0.12, r: fontPx * 0.18, color: lineBgColor });
    line.words.forEach((w, wi) => {
      const x = xs[wi];
      const { fromMs, toMs } = w.token;
      const active = style.highlightActive !== false && ms >= fromMs && ms < toMs;
      const spoken = anim === 'karaoke' && ms >= fromMs;
      const progress = clamp01((ms - fromMs) / Math.max(1, Math.min(240, toMs - fromMs)));
      let scale = 1; let dy = 0;
      if (active) {
        if (anim === 'scale') scale = 1 + 0.15 * progress;
        else if (anim === 'pop') scale = 0.85 + 0.3 * easeOutBack(progress);
        else if (anim === 'bounce') dy = -Math.sin(progress * Math.PI) * fontPx * 0.18;
      }
      const glow = anim === 'glow' && active;
      let wipe = null;
      if (anim === 'karaoke') {
        const f = ms >= toMs ? 1 : ms >= fromMs ? clamp01((ms - fromMs) / Math.max(1, toMs - fromMs)) : 0;
        if (f > 0) wipe = { fraction: f, color: hi };
      }
      words.push({
        text: w.text, width: w.width, cx: x + w.width / 2, cy: cy + dy, scale, rtl,
        // boxed words get a pill behind them, drawn relative to the word's centre
        box: boxed ? { x: -w.width / 2 - fontPx * 0.15, y: -lineH / 2 + fontPx * 0.1, w: w.width + fontPx * 0.3, h: lineH - fontPx * 0.2, r: fontPx * 0.15, color: active ? hi : (style.backgroundColor || 'rgba(0,0,0,0.6)') } : null,
        color: boxed ? '#FFFFFF' : anim === 'karaoke' ? base : ((active || spoken) ? hi : base),
        wipe,
        outlinePx: outlined ? fontPx * 0.06 : 0,
        outlineColor: outlined ? (style.strokeColor || '#000000') : null,
        shadow: !lineBgColor && !boxed ? { color: glow ? hi : 'rgba(0,0,0,0.55)', blur: glow ? fontPx * 0.5 : fontPx * 0.2, offsetY: glow ? 0 : 2 } : null,
      });
    });
  });
  return { fontPx, lineH, anim, lineBoxes, words };
}
