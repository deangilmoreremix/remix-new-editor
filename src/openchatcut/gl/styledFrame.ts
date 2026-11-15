// [remix] Fix A: draw one clip's picture into a 2D canvas the way the clip is composited on the timeline (CSS transform list with %, inset crop
// clip-path, flip, zoom about the focal point, opacity) so a GL transition can blend the clips as they LOOK, not their raw frames.
// Pure canvas code shared by the editor preview (GlClipLayer) and the export (GlTransitionLayer). No DOM besides the canvas passed in.

export interface StyledLook {
  /** CSS transform list as the editor / composition produce it: `scale(a, b) translate(x%, y%) rotate(rdeg) scale(s)` (origin = frame centre) */
  cssTransform?: string;
  /** CSS clip-path `inset(t r b l)` in % (crop), clipped in the element's own (pre-transform) space */
  clipPath?: string;
  opacity?: number;
  /** mirror applied to the picture inside the pose (export semantics) */
  flip?: { h?: boolean; v?: boolean };
  /** scale about a focal point, 0..1 */
  zoom?: { magnification: number; focalX: number; focalY: number };
}

const num = (s: string | undefined, fallback = 0) => { const n = parseFloat(s ?? ''); return Number.isFinite(n) ? n : fallback; };
const len = (s: string | undefined, full: number) => (s === undefined ? 0 : s.trim().endsWith('%') ? (num(s) / 100) * full : num(s));

/** Apply a CSS transform list (translate with %/px, rotate deg, scale, with the default 50% 50% origin) to a 2D context. */
export function applyCssTransform(ctx: CanvasRenderingContext2D, css: string | undefined, W: number, H: number): void {
  if (!css) return;
  ctx.translate(W / 2, H / 2);
  const re = /([a-zA-Z]+)\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    const args = m[2].split(',').map((s) => s.trim());
    switch (m[1]) {
      case 'translate': ctx.translate(len(args[0], W), len(args[1], H)); break;
      case 'translateX': ctx.translate(len(args[0], W), 0); break;
      case 'translateY': ctx.translate(0, len(args[0], H)); break;
      case 'rotate': ctx.rotate((num(args[0]) * Math.PI) / 180); break;
      case 'scale': ctx.scale(num(args[0], 1), args[1] !== undefined ? num(args[1], 1) : num(args[0], 1)); break;
      case 'scaleX': ctx.scale(num(args[0], 1), 1); break;
      case 'scaleY': ctx.scale(1, num(args[0], 1)); break;
      default: break;
    }
  }
  ctx.translate(-W / 2, -H / 2);
}

/** `inset(top right bottom left)` in % -> fractions of the frame, or null. */
export function parseInset(clipPath: string | undefined): { t: number; r: number; b: number; l: number } | null {
  const m = clipPath ? /inset\(\s*([^)]+)\)/.exec(clipPath) : null;
  if (!m) return null;
  const p = m[1].trim().split(/\s+/).map((s) => num(s) / 100);
  if (!p.length || p.some((n) => !Number.isFinite(n))) return null;
  const [t, r = t, b = t, l = r] = p;
  return { t, r, b, l };
}

/**
 * Clear `ctx` (or fill it with `bg`) and draw `picture` (already laid out for the frame: fit applied, effects applied) with `look`.
 * The result is opaque when `bg` is given, so the picture composites over the background colour the way it does at the bottom of the stack.
 */
export function drawStyledFrame(ctx: CanvasRenderingContext2D, picture: CanvasImageSource, look: StyledLook, bg?: string): void {
  const W = ctx.canvas.width; const H = ctx.canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, W, H);
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); }
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, look.opacity ?? 1));
  applyCssTransform(ctx, look.cssTransform, W, H);
  const inset = parseInset(look.clipPath);
  if (inset) { ctx.beginPath(); ctx.rect(inset.l * W, inset.t * H, Math.max(0, W * (1 - inset.l - inset.r)), Math.max(0, H * (1 - inset.t - inset.b))); ctx.clip(); }
  if (look.zoom && look.zoom.magnification !== 1) {
    const ox = look.zoom.focalX * W; const oy = look.zoom.focalY * H;
    ctx.translate(ox, oy); ctx.scale(look.zoom.magnification, look.zoom.magnification); ctx.translate(-ox, -oy);
  }
  if (look.flip?.h || look.flip?.v) { ctx.translate(W / 2, H / 2); ctx.scale(look.flip.h ? -1 : 1, look.flip.v ? -1 : 1); ctx.translate(-W / 2, -H / 2); }
  ctx.drawImage(picture, 0, 0, W, H);
  ctx.restore();
}
