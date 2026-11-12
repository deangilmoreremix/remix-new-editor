/**
 * Where an animation sits in the frame (one source of truth for the editor preview, the drag handles and the export).
 *
 * geom = { x, y, scale, fit }  (all optional; missing = the animation's default placement)
 *   x, y   offset in % of the frame width / height (positive = right / down)
 *   scale  multiplier on top of the fit (0.1 to 4)
 *   fit    'contain'      whole animation inside the frame, centred (default for full-frame animations)
 *          'cover'        fills the frame, cropping the overflow
 *          'width-bottom' fits the frame WIDTH and sits on the bottom edge, scaled about its bottom-left corner:
 *                         a lower third stays at the bottom in 16:9, 9:16 and 1:1. In frames narrower than 16:9 it is also enlarged
 *                         (up to 2.2x) so it does not look tiny on a phone-shaped video; the user's size multiplies on top
 */
export const HF_FITS = ['contain', 'cover', 'width-bottom'];
export const HF_FIT_LABELS = { contain: 'Fit inside the frame', cover: 'Fill the frame', 'width-bottom': 'Match width, sit at the bottom (lower third)' };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v, d) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);

export function normalizeGeom(g, defaultFit = 'contain') {
  return {
    x: clamp(num(g?.x, 0), -150, 150), y: clamp(num(g?.y, 0), -150, 150), scale: clamp(num(g?.scale, 1), 0.1, 4),
    fit: HF_FITS.includes(g?.fit) ? g.fit : (HF_FITS.includes(defaultFit) ? defaultFit : 'contain'),
  };
}

/** Box of the animation (its native bw x bh canvas, scaled) in frame pixels. */
export function hfPlacement(W, H, bw, bh, geom, defaultFit = 'contain') {
  const g = normalizeGeom(geom, defaultFit); const X = (g.x / 100) * W; const Y = (g.y / 100) * H;
  const narrow = g.fit === 'width-bottom' && W / H < 16 / 9 ? clamp(Math.pow(16 / 9 / (W / H), 0.8), 1, 2.2) : 1;
  const base = g.fit === 'cover' ? Math.max(W / bw, H / bh) : g.fit === 'width-bottom' ? (W / bw) * narrow : Math.min(W / bw, H / bh);
  const k = base * g.scale; const w = bw * k; const h = bh * k;
  const left = g.fit === 'width-bottom' ? X : (W - w) / 2 + X;
  const top = g.fit === 'width-bottom' ? H - h + Y : (H - h) / 2 + Y;
  return { left, top, w, h, k, geom: g };
}

/** Lower thirds and tickers: they belong at the bottom of the frame whatever its shape. */
export function defaultFitFor(item) {
  const id = String(item?.id || ''); const tags = item?.tags || [];
  if (/^(lt-|lower-third|yt-lower-third|news-ticker|rui:lower-third)/.test(id) || /lower-third|broadcast/.test(String(item?.category || '')) || tags.includes('lower-third')) return 'width-bottom';
  return 'contain';
}

/** Items drawn by vendored React code (RemotionUI `rui:` and the template repos `tpl:`) rather than HyperFrames HTML. */
export const isReactItem = (id) => /^(rui|tpl):/.test(String(id || ''));
