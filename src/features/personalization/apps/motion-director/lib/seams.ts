/**
 * Connected seams (upstream shot-transitions card + the transition cards): a seam is not a panel over a
 * hard cut, it is built from the two real shots on either side. Over the seam both shots play — the
 * outgoing one runs on into its hold, the incoming one starts its entrance — and the style moves, masks
 * or blurs them. The seam's frames are carved from both neighbours (half from each), so the film keeps
 * its length. Pure functions of the seam's progress: the card draws what these return.
 */
import type { CSSProperties } from 'react';
import type { SceneTransition } from './directorPlan';

export type SeamKind = Exclude<SceneTransition, 'cut'>;

/** Frames each style takes (the cut sits in the middle). From the cards: whip ≥ 20 f hold + a long tail, window 40 f growth. */
export const SEAM_LENGTH: Record<SeamKind, number> = {
  flash: 14,
  whip: 36,
  window: 40,
  wipe: 18,
  barn: 18,
  push: 20,
  iris: 20,
  ink: 20,
  portal: 24,
  line: 18,
  dip: 16,
  leak: 24,
  glitch: 12,
};

/** The longest seam a pair of shots can give: at most a third of the shorter one, split over the cut. */
export function seamFrames(kind: SeamKind, outFrames: number, inFrames: number): number {
  const room = Math.floor(Math.min(outFrames, inFrames) * 0.66);
  const f = Math.min(SEAM_LENGTH[kind], room);
  return f - (f % 2);
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** cubic-bezier(x1,y1,x2,y2) at x (Newton on x, enough for easing curves). */
export function bezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  const at = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const dx = at(x1, x2, t) - x;
    const d = 3 * (1 - t) ** 2 * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t * t * (1 - x2);
    if (Math.abs(dx) < 1e-5 || d === 0) break;
    t = clamp01(t - dx / d);
  }
  return at(y1, y2, t);
}
const inOut = (t: number) => bezier(0.65, 0, 0.35, 1, clamp01(t));

/**
 * The whip's travel (style B, hard-brake version): one continuous speed curve — a 3-frame-like soft
 * start, then exponential decay — so 70 % of the distance is covered in about 30 % of the time and
 * the rest is a long tail into place. Never two separate ease-outs (speed would take off twice).
 */
export function whipTravel(t: number): number {
  const a = 4.6;
  const x = clamp01(t);
  const start = Math.min(1, x / 0.08);
  const s = (1 - Math.exp(-a * x)) / (1 - Math.exp(-a));
  return s * (start < 1 ? start * start * (3 - 2 * start) * 0.35 + 0.65 * start : 1);
}

/** Where the window opens (style C): a card-sized box near the middle of the outgoing frame, in %. */
export interface Rect { x: number; y: number; w: number; h: number }
export const WINDOW_FROM: Rect = { x: 38, y: 31, w: 24, h: 34 };
/**
 * Shots whose page card has a known place on their stage (in %): the window opens from that real card —
 * the site's page in the hub, the page under the URL scan (card C: "a real element on the page enlarges").
 */
export const WINDOW_SOURCES: Readonly<Record<string, Rect>> = {
  'brand-hub': { x: 35, y: 37.3, w: 30, h: 33.3 },
  'brand-url-scan': { x: 19, y: 27, w: 62, h: 62 },
};

export interface SeamLook {
  /** Style of the outgoing shot's layer; `display: none` once it is gone. */
  out: CSSProperties;
  /** Style of the incoming shot's layer (drawn above the outgoing one). */
  in: CSSProperties;
  /** A full-frame layer over both (white flash, the window's frame, a light leak, the line). */
  over?: CSSProperties;
}

const hidden: CSSProperties = { display: 'none' };
const shown: CSSProperties = {};

/**
 * The look of a seam at progress t (0 = first frame of the seam, 0.5 = the cut, 1 = last frame).
 * `dir` alternates the side of wipes and whips; `accent` and `page` are the film's colours.
 */
/** Where a 1920×1080 design stage sits in a frame of this size, in % (the shots are fitted, not stretched). */
export function stageRect(width: number, height: number): Rect {
  const s = Math.min(width / 1920, height / 1080);
  const w = ((1920 * s) / width) * 100;
  const h = ((1080 * s) / height) * 100;
  return { x: (100 - w) / 2, y: (100 - h) / 2, w, h };
}

export function seamLook(kind: SeamKind, t: number, opts: { dir?: 1 | -1; accent?: string; page?: string; stage?: Rect; from?: Rect } = {}): SeamLook {
  const dir = opts.dir ?? 1;
  const accent = opts.accent ?? '#ffffff';
  const page = opts.page ?? '#000000';
  const x = clamp01(t);
  switch (kind) {
    case 'flash': {
      // A: the outgoing camera pushes in, a white flash straddles the cut (5 f each side of 14) and covers the page change.
      const push = 1 + 0.07 * bezier(0.55, 0, 1, 0.45, clamp01(x / 0.5));
      const flash = clamp01(1 - Math.abs(x - 0.5) / 0.36);
      return {
        out: x < 0.5 ? { transform: `scale(${push})` } : hidden,
        in: x < 0.5 ? hidden : { transform: `scale(${1 + 0.03 * (1 - clamp01((x - 0.5) / 0.5))})` },
        over: { background: '#ffffff', opacity: flash ** 1.5 },
      };
    }
    case 'whip': {
      // B: both shots travel together on one speed curve; the fast middle is blurred past recognition.
      const s = whipTravel(x);
      const speed = (whipTravel(Math.min(1, x + 0.02)) - whipTravel(Math.max(0, x - 0.02))) / 0.04;
      const blur = Math.min(26, speed * 9);
      const filter = blur > 0.6 ? `blur(${blur.toFixed(1)}px)` : undefined;
      return {
        out: s >= 1 ? hidden : { transform: `translateX(${(-dir * s * 100).toFixed(2)}%)`, filter },
        in: { transform: `translateX(${(dir * (1 - s) * 100).toFixed(2)}%)`, filter },
      };
    }
    case 'window': {
      // C: a card of the outgoing frame floats up (−10 px, 1.03×, the rest dims), then becomes a window that
      // grows to the full frame with bezier(0.7,0,0.3,1); the new scene inside grows from 0.42× to 1 on the
      // same t, so it reads as the detail world behind that card.
      const lift = clamp01(x / 0.18);
      const g = bezier(0.7, 0, 0.3, 1, clamp01((x - 0.18) / 0.82));
      // The card the window opens from sits inside the shot's own stage (a 16:9 band in a vertical film).
      const st = opts.stage ?? { x: 0, y: 0, w: 100, h: 100 };
      const src = opts.from ?? WINDOW_FROM;
      const r = { x: st.x + (src.x / 100) * st.w, y: st.y + (src.y / 100) * st.h, w: (src.w / 100) * st.w, h: (src.h / 100) * st.h };
      // It grows to the shot's own stage (the whole frame in 16:9; the picture band in a vertical film).
      const box = { x: r.x + (st.x - r.x) * g, y: r.y + (st.y - r.y) * g, w: r.w + (st.w - r.w) * g, h: r.h + (st.h - r.h) * g };
      const lifted = 1 + 0.03 * lift * (1 - g);
      const inset = `inset(${box.y.toFixed(2)}% ${(100 - box.x - box.w).toFixed(2)}% ${(100 - box.y - box.h).toFixed(2)}% ${box.x.toFixed(2)}% round ${(18 * (1 - g)).toFixed(1)}px)`;
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      return {
        out: g >= 1 ? hidden : { filter: `brightness(${(1 - 0.35 * lift).toFixed(3)})` },
        in: {
          clipPath: inset,
          transform: `translateY(${(-10 * lift * (1 - g)).toFixed(2)}px) scale(${((0.42 + 0.58 * g) * lifted).toFixed(4)})`,
          transformOrigin: `${cx}% ${cy}%`,
        },
        over: g < 0.98 ? { left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%`, right: 'auto', bottom: 'auto', border: `3px solid ${accent}`, borderRadius: 18 * (1 - g), boxShadow: `0 ${Math.round(24 * lift)}px ${Math.round(60 * lift)}px rgba(0,0,0,${(0.35 * lift).toFixed(2)})`, opacity: 1 - g } : undefined,
      };
    }
    case 'wipe': {
      const p = inOut(x);
      const edge = dir > 0 ? `inset(0 0 0 ${((1 - p) * 100).toFixed(2)}%)` : `inset(0 ${((1 - p) * 100).toFixed(2)}% 0 0)`;
      return {
        out: p >= 1 ? hidden : shown,
        in: { clipPath: edge },
        over: p > 0 && p < 1 ? { left: dir > 0 ? `${(1 - p) * 100}%` : 'auto', right: dir > 0 ? 'auto' : `${(1 - p) * 100}%`, width: 6, marginLeft: -3, background: accent } : undefined,
      };
    }
    case 'barn': {
      const p = inOut(x);
      return { out: p >= 1 ? hidden : shown, in: { clipPath: `inset(0 ${((1 - p) * 50).toFixed(2)}% 0 ${((1 - p) * 50).toFixed(2)}%)` } };
    }
    case 'push': {
      // bottom-push: the new scene rises from below and pushes the old one up, which darkens as it leaves.
      const p = inOut(x);
      return {
        out: p >= 1 ? hidden : { transform: `translateY(${(-p * 100).toFixed(2)}%)`, filter: `brightness(${(1 - 0.4 * p).toFixed(3)})` },
        in: { transform: `translateY(${((1 - p) * 100).toFixed(2)}%)` },
      };
    }
    case 'iris':
    case 'portal': {
      const p = inOut(x);
      const r = p * 75;
      return {
        out: p >= 1 ? hidden : shown,
        in: { clipPath: `circle(${r.toFixed(2)}% at 50% 50%)` },
        // portal: the same opening, with the accent glowing on its rim.
        over: kind === 'portal' && p > 0 && p < 1 ? { background: `radial-gradient(circle at 50% 50%, transparent ${(r * 1.41 - 1.2).toFixed(2)}%, ${accent} ${(r * 1.41).toFixed(2)}%, transparent ${(r * 1.41 + 1.6).toFixed(2)}%)` } : undefined,
      };
    }
    case 'ink': {
      const p = bezier(0.55, 0, 0.25, 1, x);
      return { out: p >= 1 ? hidden : shown, in: { clipPath: `circle(${(p * 145).toFixed(2)}% at ${dir > 0 ? '0% 100%' : '100% 100%'})` } };
    }
    case 'line': {
      const p = inOut(x);
      return {
        out: p >= 1 ? hidden : shown,
        in: { clipPath: `inset(0 0 0 ${((1 - p) * 100).toFixed(2)}%)` },
        over: p > 0 && p < 1 ? { left: `${(1 - p) * 100}%`, width: 4, marginLeft: -2, background: accent } : undefined,
      };
    }
    case 'dip': {
      return {
        out: x < 0.5 ? { opacity: 1 - inOut(x / 0.5) } : hidden,
        in: x < 0.5 ? hidden : { opacity: inOut((x - 0.5) / 0.5) },
        over: undefined,
      };
    }
    case 'leak': {
      const p = inOut(x);
      const glow = clamp01(1 - Math.abs(x - 0.5) / 0.5);
      return {
        out: p >= 1 ? hidden : shown,
        in: { opacity: p },
        over: { background: 'radial-gradient(ellipse at 20% 30%, rgba(255,190,110,0.95), rgba(255,120,60,0.35) 45%, transparent 75%)', opacity: glow * 0.85, mixBlendMode: 'screen' },
      };
    }
    case 'glitch': {
      // Colour slices at the cut: the frame flips between the two shots in shifted horizontal bands.
      const frame = Math.round(x * 12);
      const onIn = x >= 0.5 ? frame % 3 !== 1 : frame % 3 === 2;
      const shift = (1 - Math.abs(x - 0.5) * 2) * 40 * (frame % 2 ? 1 : -1);
      return {
        out: onIn ? hidden : { transform: `translateX(${shift.toFixed(1)}px)`, filter: 'saturate(1.6)' },
        in: onIn ? { transform: `translateX(${(-shift).toFixed(1)}px)`, filter: 'saturate(1.6)' } : hidden,
      };
    }
  }
  void page;
  return { out: x < 0.5 ? shown : hidden, in: x < 0.5 ? hidden : shown };
}
