/**
 * Saved text styles: the look of a text layer (or of the captions) kept under a name, so it can be applied again.
 * A text style never carries the words, the position, the timing, the lock or keyframes — only how the text looks.
 * Colors that equal a brand color are stored as a brand reference (`@primary`, `@accent`, `@text`), so applying a style
 * in another project uses THAT project's brand colors.
 */
import { normalizeLayerEffects, type LayerEffects } from './effects';
import type { CaptionPosition, CaptionStyleId, PreviewAnimationId, PreviewBrandColors, PreviewLayer } from './types';

export const MAX_TEXT_STYLES = 30;
export const MAX_STYLE_NAME = 40;
export const BROWSER_STYLES_KEY = 'personalization:text-styles';

export type BrandRef = '@primary' | '@accent' | '@text'
type Brand = Pick<PreviewBrandColors, 'primary' | 'accent' | 'text'>

export interface TextLook {
  /** Hex, or a brand reference. */
  color?: string
  fontFamily?: string
  scale: number
  opacity: number
  animation: PreviewAnimationId
  animationDelay?: number
  rotation?: number
  effects?: LayerEffects
}
/** A caption look in remix: which of the built-in or Capite looks, and where the lines sit. Colours come with the look itself. */
export interface CaptionLook { style: CaptionStyleId; position: CaptionPosition }

export type SavedTextStyle =
  | { id: string; name: string; kind: 'text'; style: TextLook }
  | { id: string; name: string; kind: 'captions'; style: CaptionLook }

const ANIMATIONS: PreviewAnimationId[] = ['none', 'fade', 'slide-up', 'slide-down', 'slide-left', 'pop', 'logo-reveal', 'lower-third', 'cta-pulse'];
const REFS: BrandRef[] = ['@primary', '@accent', '@text'];
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const isHex = (v: unknown): v is string => typeof v === 'string' && HEX.test(v.trim());
const isRef = (v: unknown): v is BrandRef => typeof v === 'string' && (REFS as string[]).includes(v);

const norm = (hex: string) => {
  const h = hex.trim().toLowerCase();
  return h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h;
};
export function toBrandRef(color: string | undefined, brand: Brand): string | undefined {
  if (!color || !isHex(color)) return color;
  const c = norm(color);
  for (const key of ['primary', 'accent', 'text'] as const) if (norm(brand[key]) === c) return `@${key}`;
  return color;
}
export function resolveBrandRef(color: string | undefined, brand: Brand): string | undefined {
  if (!color) return color;
  if (isRef(color)) return brand[color.slice(1) as keyof Brand];
  return color;
}

// ── capture / apply ──────────────────────────────────────────────────────────────────────────────────────────────
export function captureTextStyle(layer: PreviewLayer, brand: Brand): TextLook {
  const look: TextLook = { scale: layer.scale, opacity: layer.opacity, animation: layer.animation };
  const color = toBrandRef(layer.color, brand);
  if (color) look.color = color;
  if (layer.fontFamily) look.fontFamily = layer.fontFamily;
  if (layer.animationDelay) look.animationDelay = layer.animationDelay;
  if (layer.rotation) look.rotation = layer.rotation;
  if (layer.effects) look.effects = layer.effects;
  return look;
}

/** The patch that gives `layer` the look. Position, timing, text, lock and keyframes are never in it. */
export function applyTextStyle(style: TextLook, brand: Brand): Partial<PreviewLayer> {
  return {
    color: resolveBrandRef(style.color, brand),
    fontFamily: style.fontFamily,
    scale: style.scale,
    opacity: style.opacity,
    animation: style.animation,
    animationDelay: style.animationDelay ?? 0,
    rotation: style.rotation,
    effects: style.effects,
  };
}

export function captureCaptionStyle(captions: { style: CaptionStyleId; position: CaptionPosition }): CaptionLook {
  return { style: captions.style, position: captions.position };
}
/** The patch for the captions (style and position only; the words and timing are never touched). */
export function applyCaptionStyle(look: CaptionLook): { style: CaptionStyleId; position: CaptionPosition } {
  return { style: look.style, position: look.position };
}

// ── normalizing saved data ───────────────────────────────────────────────────────────────────────────────────────
const colorOrRef = (v: unknown): string | undefined => (isRef(v) ? v : isHex(v) ? v.trim() : undefined);

function normalizeLook(raw: unknown): TextLook | undefined {
  if (!isRecord(raw) || !finite(raw.scale) || !finite(raw.opacity)) return undefined;
  if (typeof raw.animation !== 'string' || !ANIMATIONS.includes(raw.animation as PreviewAnimationId)) return undefined;
  const out: TextLook = { scale: clamp(raw.scale, 0.1, 6), opacity: clamp(raw.opacity, 0, 1), animation: raw.animation as PreviewAnimationId };
  const color = colorOrRef(raw.color);
  if (color) out.color = color;
  if (typeof raw.fontFamily === 'string' && raw.fontFamily && raw.fontFamily.length <= 200) out.fontFamily = raw.fontFamily;
  if (finite(raw.animationDelay) && raw.animationDelay > 0) out.animationDelay = Math.round(clamp(raw.animationDelay, 0, 600));
  if (finite(raw.rotation) && raw.rotation !== 0) out.rotation = clamp(raw.rotation, -180, 180);
  const effects = normalizeLayerEffects(raw.effects);
  if (effects) out.effects = effects;
  return out;
}

function normalizeCaptionLook(raw: unknown): CaptionLook | undefined {
  if (!isRecord(raw)) return undefined;
  const position = raw.position === 'top' || raw.position === 'middle' || raw.position === 'bottom' ? raw.position : undefined;
  const style = typeof raw.style === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(raw.style) ? raw.style : undefined;
  if (!position || !style) return undefined;
  return { style, position };
}

export function normalizeTextStyles(raw: unknown): SavedTextStyle[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: SavedTextStyle[] = [];
  const ids = new Set<string>();
  for (const item of raw) {
    if (out.length >= MAX_TEXT_STYLES) break;
    if (!isRecord(item) || typeof item.id !== 'string' || !item.id || ids.has(item.id)) continue;
    const name = typeof item.name === 'string' ? item.name.trim().slice(0, MAX_STYLE_NAME) : '';
    if (!name) continue;
    if (item.kind === 'text') {
      const style = normalizeLook(item.style);
      if (style) { ids.add(item.id); out.push({ id: item.id, name, kind: 'text', style }); }
    } else if (item.kind === 'captions') {
      const style = normalizeCaptionLook(item.style);
      if (style) { ids.add(item.id); out.push({ id: item.id, name, kind: 'captions', style }); }
    }
  }
  return out.length ? out : undefined;
}

// ── list operations (all pure) ───────────────────────────────────────────────────────────────────────────────────
export function uniqueName(name: string, list: SavedTextStyle[], kind: SavedTextStyle['kind'], ignoreId?: string): string {
  const base = (name.trim() || 'My style').slice(0, MAX_STYLE_NAME);
  const taken = new Set(list.filter((s) => s.kind === kind && s.id !== ignoreId).map((s) => s.name.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; n < 1000; n++) {
    const suffix = ` ${n}`;
    const candidate = base.slice(0, MAX_STYLE_NAME - suffix.length) + suffix;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return base;
}

let counter = 0;
export const newStyleId = () => `ts-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function addStyle(list: SavedTextStyle[], style: Omit<SavedTextStyle, 'id' | 'name'> & { name: string }, id = newStyleId()): { list: SavedTextStyle[]; added: SavedTextStyle | null } {
  if (list.length >= MAX_TEXT_STYLES) return { list, added: null };
  const added = { ...style, id, name: uniqueName(style.name, list, style.kind) } as SavedTextStyle;
  return { list: [...list, added], added };
}
export function renameStyle(list: SavedTextStyle[], id: string, name: string): SavedTextStyle[] {
  const target = list.find((s) => s.id === id);
  if (!target || !name.trim()) return list;
  const next = uniqueName(name, list, target.kind, id);
  return list.map((s) => (s.id === id ? { ...s, name: next } : s));
}
export const deleteStyle = (list: SavedTextStyle[], id: string): SavedTextStyle[] => list.filter((s) => s.id !== id);

// ── this browser's copy ──────────────────────────────────────────────────────────────────────────────────────────
export function readBrowserStyles(): SavedTextStyle[] {
  try {
    const raw = window.localStorage.getItem(BROWSER_STYLES_KEY);
    return normalizeTextStyles(raw ? JSON.parse(raw) : []) ?? [];
  } catch { return []; }
}
export function writeBrowserStyles(list: SavedTextStyle[]): void {
  try { window.localStorage.setItem(BROWSER_STYLES_KEY, JSON.stringify(list.slice(0, MAX_TEXT_STYLES))); } catch { /* storage unavailable: the project copy still works */ }
}
/** Add a style to this browser's library unless one with the same name and kind and look is already there. */
export function rememberInBrowser(style: SavedTextStyle): void {
  const list = readBrowserStyles();
  const same = list.find((s) => s.kind === style.kind && s.name.toLowerCase() === style.name.toLowerCase());
  const next = same ? list.map((s) => (s === same ? { ...style, id: s.id } : s)) : [...list, style];
  writeBrowserStyles(next.slice(-MAX_TEXT_STYLES));
}
