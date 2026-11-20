/**
 * Color and effects, as plain data plus pure functions that turn it into CSS the in-browser exporter can draw.
 *
 * Verified in the real exporter (still frames compared with the browser's own rendering, on an image, a canvas,
 * text, a video and a wrapper element): brightness, contrast, saturate, grayscale, sepia, hue-rotate, blur and
 * drop-shadow all export. Things that do NOT export (blend modes, backdrop filters, radial CSS gradients) are not
 * used: temperature and tint are flat low-opacity color overlays, and the vignette is drawn on a canvas.
 *
 * Nothing here changes a file: effects are settings applied when drawing, and Reset removes them.
 */

export interface LookOverlay {
  color: string
  /** 0 (invisible) .. 0.8 */
  opacity: number
}

/** A look for the whole video footage (not the brand overlays on top of it). 1 = unchanged for multipliers. */
export interface LookSettings {
  /** Which preset filled the sliders, for display only. */
  preset?: string
  /** Exposure in stops (-2 darker .. 2 brighter). */
  exposure: number
  contrast: number
  saturation: number
  /** -1 cool .. 1 warm. */
  temperature: number
  /** -1 green .. 1 magenta. */
  tint: number
  /** Blur in pixels of the 1080p-style frame. */
  blur: number
  /** 0 none .. 1 strong dark edges. */
  vignette: number
  overlay?: LookOverlay
}

export const NEUTRAL_LOOK: LookSettings = { exposure: 0, contrast: 1, saturation: 1, temperature: 0, tint: 0, blur: 0, vignette: 0 };

/** Effects for one overlay layer (picture, text or button). */
export interface LayerEffects {
  brightness: number
  contrast: number
  saturation: number
  blur: number
  /** A soft colored glow around the layer. */
  glow?: { color: string; amount: number }
  /** A soft dark drop shadow, 0..1. */
  shadow?: number
}

export const NEUTRAL_LAYER_EFFECTS: LayerEffects = { brightness: 1, contrast: 1, saturation: 1, blur: 0 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : fallback);
const color = (v: unknown, fallback: string) => (typeof v === 'string' && /^#?[0-9a-f]{3,8}$|^rgba?\(|^hsla?\(/i.test(v.trim()) ? v.trim() : fallback);

// ── presets ─────────────────────────────────────────────────────────────────────────────────────────────────
export interface LookPreset {
  id: string
  label: string
  look: Omit<LookSettings, 'preset'>
}

const base = (patch: Partial<LookSettings>): Omit<LookSettings, 'preset'> => ({ ...NEUTRAL_LOOK, ...patch });

/** Film-style looks. They only fill the sliders, which stay fully editable. */
export const LOOK_PRESETS: LookPreset[] = [
  { id: 'cinematic', label: 'Cinematic', look: base({ contrast: 1.12, saturation: 0.9, temperature: 0.15, vignette: 0.45, exposure: -0.1 }) },
  { id: 'vintage', label: 'Vintage', look: base({ contrast: 0.95, saturation: 0.75, temperature: 0.35, tint: 0.08, vignette: 0.4, overlay: { color: '#c9a063', opacity: 0.12 } }) },
  { id: 'bw', label: 'Black and white', look: base({ contrast: 1.12, saturation: 0, vignette: 0.25 }) },
  { id: 'vivid', label: 'Vivid', look: base({ contrast: 1.08, saturation: 1.4 }) },
  { id: 'cool', label: 'Cool', look: base({ temperature: -0.5, saturation: 1.05, contrast: 1.05 }) },
  { id: 'warm', label: 'Warm', look: base({ temperature: 0.5, saturation: 1.08 }) },
];

export function applyLookPreset(id: string): LookSettings | undefined {
  const p = LOOK_PRESETS.find((x) => x.id === id);
  return p ? { ...p.look, preset: p.id } : undefined;
}

// ── normalizing saved data ───────────────────────────────────────────────────────────────────────────────────
export function normalizeLook(raw: unknown): LookSettings | undefined {
  if (!isRecord(raw)) return undefined;
  const look: LookSettings = {
    exposure: num(raw.exposure, 0, -2, 2),
    contrast: num(raw.contrast, 1, 0.5, 1.8),
    saturation: num(raw.saturation, 1, 0, 2),
    temperature: num(raw.temperature, 0, -1, 1),
    tint: num(raw.tint, 0, -1, 1),
    blur: num(raw.blur, 0, 0, 20),
    vignette: num(raw.vignette, 0, 0, 1),
  };
  if (typeof raw.preset === 'string' && LOOK_PRESETS.some((p) => p.id === raw.preset)) look.preset = raw.preset;
  if (isRecord(raw.overlay)) {
    const opacity = num(raw.overlay.opacity, 0, 0, 0.8);
    if (opacity > 0) look.overlay = { color: color(raw.overlay.color, '#000000'), opacity };
  }
  return isNeutralLook(look) ? undefined : look;
}

export function normalizeLayerEffects(raw: unknown): LayerEffects | undefined {
  if (!isRecord(raw)) return undefined;
  const fx: LayerEffects = {
    brightness: num(raw.brightness, 1, 0.2, 2),
    contrast: num(raw.contrast, 1, 0.5, 2),
    saturation: num(raw.saturation, 1, 0, 2),
    blur: num(raw.blur, 0, 0, 20),
  };
  if (isRecord(raw.glow)) {
    const amount = num(raw.glow.amount, 0, 0, 1);
    if (amount > 0) fx.glow = { color: color(raw.glow.color, '#ffffff'), amount };
  }
  const shadow = num(raw.shadow, 0, 0, 1);
  if (shadow > 0) fx.shadow = shadow;
  return isNeutralLayerEffects(fx) ? undefined : fx;
}

// ── neutrality ───────────────────────────────────────────────────────────────────────────────────────────────
export function isNeutralLook(l: LookSettings | undefined): boolean {
  return !l || (l.exposure === 0 && l.contrast === 1 && l.saturation === 1 && l.temperature === 0 && l.tint === 0 && l.blur === 0 && l.vignette === 0 && !(l.overlay && l.overlay.opacity > 0));
}

export function isNeutralLayerEffects(e: LayerEffects | undefined): boolean {
  return !e || (e.brightness === 1 && e.contrast === 1 && e.saturation === 1 && e.blur === 0 && !e.glow && !e.shadow);
}

// ── CSS ──────────────────────────────────────────────────────────────────────────────────────────────────────
const r = (n: number) => Math.round(n * 1000) / 1000;

/** The CSS `filter` for the footage, or undefined when nothing needs filtering. Exposure is stops: brightness = 2^EV. */
export function lookFilter(look: LookSettings | undefined): string | undefined {
  if (!look) return undefined;
  const parts: string[] = [];
  if (look.exposure !== 0) parts.push(`brightness(${r(2 ** look.exposure)})`);
  if (look.contrast !== 1) parts.push(`contrast(${r(look.contrast)})`);
  if (look.saturation !== 1) parts.push(`saturate(${r(look.saturation)})`);
  if (look.blur > 0) parts.push(`blur(${r(look.blur)}px)`);
  return parts.length ? parts.join(' ') : undefined;
}

/** The CSS `filter` for one layer, or undefined. */
export function layerEffectsFilter(fx: LayerEffects | undefined): string | undefined {
  if (!fx || isNeutralLayerEffects(fx)) return undefined;
  const parts: string[] = [];
  if (fx.brightness !== 1) parts.push(`brightness(${r(fx.brightness)})`);
  if (fx.contrast !== 1) parts.push(`contrast(${r(fx.contrast)})`);
  if (fx.saturation !== 1) parts.push(`saturate(${r(fx.saturation)})`);
  if (fx.blur > 0) parts.push(`blur(${r(fx.blur)}px)`);
  if (fx.shadow) parts.push(`drop-shadow(0 ${r(fx.shadow * 8)}px ${r(fx.shadow * 18)}px rgba(0,0,0,0.6))`);
  if (fx.glow) parts.push(`drop-shadow(0 0 ${r(fx.glow.amount * 24)}px ${fx.glow.color})`);
  return parts.length ? parts.join(' ') : undefined;
}

export interface LookOverlayLayer {
  key: string
  color: string
}

const rgba = (rgb: [number, number, number], a: number) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${r(a)})`;

/**
 * Flat color layers drawn over the footage. Temperature and tint are approximated this way (an overlay of orange or
 * blue, magenta or green at low opacity) because the exporter has no blend modes. Order: temperature, tint, overlay.
 */
export function lookOverlays(look: LookSettings | undefined): LookOverlayLayer[] {
  if (!look) return [];
  const out: LookOverlayLayer[] = [];
  if (look.temperature !== 0) out.push({ key: 'temperature', color: look.temperature > 0 ? rgba([255, 150, 40], look.temperature * 0.22) : rgba([60, 140, 255], -look.temperature * 0.22) });
  if (look.tint !== 0) out.push({ key: 'tint', color: look.tint > 0 ? rgba([255, 60, 200], look.tint * 0.18) : rgba([60, 220, 110], -look.tint * 0.18) });
  if (look.overlay && look.overlay.opacity > 0) out.push({ key: 'overlay', color: hexWithAlpha(look.overlay.color, look.overlay.opacity) });
  return out;
}

/** `#rrggbb` (or `#rgb`) plus an alpha as an rgba() string; other color syntaxes are returned unchanged. */
export function hexWithAlpha(c: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(c.trim());
  if (!m) return c;
  const h = m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1];
  const n = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
  return rgba(n, clamp(alpha, 0, 1));
}

/** Stops of the vignette's radial gradient: clear in the middle, dark at the corners. Drawn on a canvas. */
export function vignetteStops(strength: number): { at: number; alpha: number }[] {
  const s = clamp(strength, 0, 1);
  return [
    { at: 0, alpha: 0 },
    { at: 0.55, alpha: 0 },
    { at: 1, alpha: r(0.75 * s) },
  ];
}
