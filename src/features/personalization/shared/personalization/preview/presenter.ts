/**
 * Presenter effects (Stage 3): the person in the source video can be shown full-frame, in a camera bubble or a
 * picture-in-picture box, with their background kept, blurred, replaced by a colour/image, or removed so the
 * layers behind (e.g. the Stage 2 website) show through.
 *
 * Everything in here is PURE (no React, no Remotion, no clock): the live preview, the editor stage and the
 * exported video all derive their layers from the same functions, which is what keeps them identical.
 *
 * The person matte is NOT computed while rendering. It is baked once, in the browser, into a transparent WebM
 * ("processed footage", see guided/presenterBake.ts) and cached, so a render never depends on a model download
 * or on a GPU being present. If a background mode needs processed footage that is missing or belongs to another
 * video, `presenterRenderPlan` says so and falls back to the untouched video: it never pretends to have removed
 * a background it has not removed.
 */

export type PresenterLayout = 'full' | 'bubble' | 'pip'
export type PresenterShape = 'circle' | 'rounded' | 'rect'
export type PresenterBackgroundMode = 'keep' | 'blur' | 'color' | 'image' | 'remove'
export type PresenterEngine = 'mediapipe' | 'modnet'

export interface PresenterMatte {
  /** Content key of the processed footage (see matteKey). Stable across reloads; resolves to a playable URL. */
  key: string
  engine: PresenterEngine
  /** The video this was made from. A matte for a different video is ignored. */
  sourceUrl: string
  /** Optional durable (http/https) copy of the processed footage. Never a blob: URL. */
  url?: string
  createdAt: string
  /** Where the person is, as 0..1 fractions of the video frame (median over the clip), plus the frame's width/height. */
  bounds?: PersonBounds
  videoAspect?: number
}

export interface PersonBounds { x0: number; y0: number; x1: number; y1: number }

export interface PresenterSettings {
  enabled: boolean
  layout: PresenterLayout
  shape: PresenterShape
  /** Centre of the box as fractions of the frame, and its width as a fraction of the frame width. */
  box: { x: number; y: number; size: number }
  /** Width / height of the box (the circle is always 1). */
  aspect: number
  /** Corner radius for `rounded`, as a fraction of the shorter side (0..0.5). */
  radius: number
  /** Where the video is framed inside the box: focal point (0..1) and zoom (>= 1). */
  focus: { x: number; y: number; zoom: number }
  mirror: boolean
  /** Width / height of the source video, when known (probed in the editor or measured when the footage is processed). */
  videoAspect?: number
  /** Border width as a fraction of the box width (0 = none). */
  borderWidth: number
  borderColor: string
  shadow: boolean
  background: {
    mode: PresenterBackgroundMode
    /** Blur strength per 1000 px of frame width, so it looks the same at any export size. */
    blur: number
    color: string
    imageUrl: string
  }
  matte?: PresenterMatte
}

export const MIN_BOX_SIZE = 0.1
export const MAX_BOX_SIZE = 1
export const MIN_ASPECT = 0.5
export const MAX_ASPECT = 2.5
export const MAX_BLUR = 40
export const MAX_PRESENTER_ZOOM = 4

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const hex = (v: unknown, fallback: string) => (typeof v === 'string' && HEX.test(v.trim()) ? v.trim() : fallback)

const LAYOUTS: readonly PresenterLayout[] = ['full', 'bubble', 'pip']
const SHAPES: readonly PresenterShape[] = ['circle', 'rounded', 'rect']
const MODES: readonly PresenterBackgroundMode[] = ['keep', 'blur', 'color', 'image', 'remove']
const ENGINES: readonly PresenterEngine[] = ['mediapipe', 'modnet']

/** Same rule as the rest of the feature: only durable http(s) URLs survive storage. blob:/data:/javascript: do not. */
export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false
  try {
    const u = new URL(value)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

export function defaultPresenter(layout: PresenterLayout = 'bubble'): PresenterSettings {
  const base: PresenterSettings = {
    enabled: true,
    layout,
    shape: 'circle',
    box: { x: 0.14, y: 0.8, size: 0.22 },
    aspect: 1,
    radius: 0.18,
    focus: { x: 0.5, y: 0.35, zoom: 1.3 },
    mirror: false,
    borderWidth: 0.012,
    borderColor: '#ffffff',
    shadow: true,
    background: { mode: 'keep', blur: 10, color: '#0f172a', imageUrl: '' },
  }
  if (layout === 'full') {
    return { ...base, shape: 'rect', box: { x: 0.5, y: 0.5, size: 1 }, aspect: 1.7778, focus: { x: 0.5, y: 0.5, zoom: 1 }, borderWidth: 0, shadow: false }
  }
  if (layout === 'pip') {
    return { ...base, shape: 'rounded', box: { x: 0.8, y: 0.8, size: 0.3 }, aspect: 1.7778, focus: { x: 0.5, y: 0.4, zoom: 1.1 } }
  }
  return base
}

/** Clamps stored settings. Returns undefined when there is nothing usable, so callers can drop the key. */
export function normalizePresenter(raw: unknown): PresenterSettings | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const r = raw as Record<string, any>
  const layout: PresenterLayout = LAYOUTS.includes(r.layout) ? r.layout : 'bubble'
  const d = defaultPresenter(layout)
  const shape: PresenterShape = SHAPES.includes(r.shape) ? r.shape : d.shape
  const size = clamp(finite(r.box?.size) ? r.box.size : d.box.size, MIN_BOX_SIZE, MAX_BOX_SIZE)
  const aspect = shape === 'circle' ? 1 : clamp(finite(r.aspect) ? r.aspect : d.aspect, MIN_ASPECT, MAX_ASPECT)
  const mode: PresenterBackgroundMode = MODES.includes(r.background?.mode) ? r.background.mode : 'keep'
  const imageUrl = isHttpUrl(r.background?.imageUrl) ? r.background.imageUrl : ''
  const out: PresenterSettings = {
    enabled: r.enabled !== false,
    layout,
    shape,
    box: {
      x: round(clamp(finite(r.box?.x) ? r.box.x : d.box.x, 0, 1)),
      y: round(clamp(finite(r.box?.y) ? r.box.y : d.box.y, 0, 1)),
      size: round(size),
    },
    aspect: round(aspect),
    radius: round(clamp(finite(r.radius) ? r.radius : d.radius, 0, 0.5)),
    focus: {
      x: round(clamp(finite(r.focus?.x) ? r.focus.x : d.focus.x, 0, 1)),
      y: round(clamp(finite(r.focus?.y) ? r.focus.y : d.focus.y, 0, 1)),
      zoom: round(clamp(finite(r.focus?.zoom) ? r.focus.zoom : d.focus.zoom, 1, MAX_PRESENTER_ZOOM), 2),
    },
    mirror: r.mirror === true,
    borderWidth: round(clamp(finite(r.borderWidth) ? r.borderWidth : d.borderWidth, 0, 0.06)),
    borderColor: hex(r.borderColor, d.borderColor),
    shadow: r.shadow === undefined ? d.shadow : r.shadow === true,
    background: {
      mode: mode === 'image' && !imageUrl ? 'keep' : mode,
      blur: round(clamp(finite(r.background?.blur) ? r.background.blur : d.background.blur, 0, MAX_BLUR), 1),
      color: hex(r.background?.color, d.background.color),
      imageUrl,
    },
  }
  if (finite(r.videoAspect) && r.videoAspect > 0.1 && r.videoAspect < 10) out.videoAspect = round(r.videoAspect)
  const m = r.matte
  if (m && typeof m === 'object' && typeof m.key === 'string' && /^[a-z0-9_-]{8,128}$/i.test(m.key)
    && ENGINES.includes(m.engine) && typeof m.sourceUrl === 'string' && m.sourceUrl.length > 0 && m.sourceUrl.length <= 2048) {
    out.matte = {
      key: m.key,
      engine: m.engine,
      sourceUrl: m.sourceUrl,
      createdAt: typeof m.createdAt === 'string' ? m.createdAt.slice(0, 40) : '',
      ...(isHttpUrl(m.url) ? { url: m.url } : {}),
      ...(normalizeBounds(m.bounds) ? { bounds: normalizeBounds(m.bounds) } : {}),
      ...(finite(m.videoAspect) && m.videoAspect > 0.1 && m.videoAspect < 10 ? { videoAspect: round(m.videoAspect) } : {}),
    }
  }
  return out
}

// ── geometry ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface PresenterRect {
  left: number
  top: number
  width: number
  height: number
  /** Corner radius in px (999-ish for a circle is expressed as half the shorter side). */
  radiusPx: number
}

/**
 * Where the presenter box is, in composition pixels. The box is always kept fully inside the frame: a stored
 * centre near an edge is pulled in rather than letting half the presenter fall off screen.
 */
export function presenterRect(p: PresenterSettings, compW: number, compH: number): PresenterRect {
  if (p.layout === 'full') return { left: 0, top: 0, width: compW, height: compH, radiusPx: 0 }
  const aspect = p.shape === 'circle' ? 1 : p.aspect
  let width = Math.min(compW, Math.max(1, p.box.size * compW))
  let height = width / aspect
  if (height > compH) {
    height = compH
    width = height * aspect
  }
  const left = clamp(p.box.x * compW - width / 2, 0, compW - width)
  const top = clamp(p.box.y * compH - height / 2, 0, compH - height)
  const short = Math.min(width, height)
  const radiusPx = p.shape === 'circle' ? short / 2 : p.shape === 'rounded' ? short * p.radius : 0
  return { left, top, width, height, radiusPx }
}

/** Inverse of the clamp above: the stored centre for a dragged box position (top-left), so a drag never leaves the frame. */
export function boxCentreFor(p: PresenterSettings, compW: number, compH: number, left: number, top: number): { x: number; y: number } {
  const r = presenterRect(p, compW, compH)
  const l = clamp(left, 0, compW - r.width)
  const t = clamp(top, 0, compH - r.height)
  return { x: round((l + r.width / 2) / compW), y: round((t + r.height / 2) / compH) }
}

export interface MediaRect { left: number; top: number; width: number; height: number }

/**
 * Where the video is drawn inside the presenter box, in box pixels.
 *
 * The video is first cover-fitted to the box (using its real aspect when known), then scaled by `focus.zoom`, then
 * positioned so the video point `(focus.x, focus.y)` (0..1 of the VIDEO) sits at the centre of the box, as far as the
 * video still covers the whole box (it is never panned so far that an empty edge shows). At zoom 1 and a centred
 * focus this is plain cover-fit. One function for the preview, the stage and the export.
 */
export function presenterMediaRect(p: PresenterSettings, boxW: number, boxH: number, videoAspect?: number): MediaRect {
  const va = videoAspect && videoAspect > 0 ? videoAspect : boxW / Math.max(1, boxH)
  const baseW = Math.max(boxW, boxH * va)
  const baseH = baseW / va
  const z = Math.max(1, p.focus.zoom)
  const width = baseW * z
  const height = baseH * z
  const left = clamp(boxW / 2 - p.focus.x * width, boxW - width, 0)
  const top = clamp(boxH / 2 - p.focus.y * height, boxH - height, 0)
  return { left, top, width, height }
}

/** The aspect to frame with: the setting, else the processed footage's measured one. */
export const presenterVideoAspect = (p: PresenterSettings): number | undefined => p.videoAspect ?? p.matte?.videoAspect

export function presenterBlurPx(p: PresenterSettings, compW: number): number {
  return round((p.background.blur * compW) / 1000, 2)
}

// ── what to draw ─────────────────────────────────────────────────────────────────────────────────────────────

export interface PresenterRenderPlan {
  /** Draw the presenter at all (a disabled or absent presenter leaves the existing full-frame behaviour). */
  active: boolean
  /** Fill drawn inside the box, behind the person ('' = none). */
  fill: string
  fillImage: string
  /** The untouched video, optionally blurred. null = not drawn. */
  original: null | { blurPx: number; muted: boolean }
  /** The processed (transparent) video. null = not drawn. */
  matte: null | { muted: boolean }
  /** The mode the user asked for and the one actually drawn. They differ only when processed footage is missing. */
  requested: PresenterBackgroundMode
  effective: PresenterBackgroundMode
  /** Set when `requested` could not be honoured; shown to the customer, never silent. */
  degradedReason: null | 'no-matte' | 'stale-matte' | 'matte-unavailable'
}

export interface MatteStatus {
  /** A playable URL for the processed footage, when one can be resolved right now. */
  url: string | null
  /** The video the presenter is playing. */
  sourceUrl: string | null
}

/**
 * The layers for one presenter configuration. Exactly one layer carries the audio, so the soundtrack is never
 * doubled or dropped:
 *   - original drawn      → the original carries the audio (it is the source of truth for timing)
 *   - only matte drawn    → the matte carries the audio (the bake keeps the audio track)
 */
export function presenterRenderPlan(p: PresenterSettings | undefined, matte: MatteStatus): PresenterRenderPlan {
  const inactive: PresenterRenderPlan = {
    active: false, fill: '', fillImage: '', original: null, matte: null,
    requested: 'keep', effective: 'keep', degradedReason: null,
  }
  if (!p || !p.enabled) return inactive
  const requested = p.background.mode
  const plan: PresenterRenderPlan = { ...inactive, active: true, requested, effective: requested }
  if (requested === 'keep') return { ...plan, original: { blurPx: 0, muted: false } }

  const has = p.matte && matte.url
  const stale = Boolean(p.matte) && matte.sourceUrl != null && p.matte!.sourceUrl !== matte.sourceUrl
  if (!has || stale) {
    return {
      ...plan,
      effective: 'keep',
      original: { blurPx: 0, muted: false },
      degradedReason: stale ? 'stale-matte' : p.matte ? 'matte-unavailable' : 'no-matte',
    }
  }
  if (requested === 'blur') return { ...plan, original: { blurPx: -1, muted: false }, matte: { muted: true } }
  if (requested === 'color') return { ...plan, fill: p.background.color, matte: { muted: false } }
  if (requested === 'image') return { ...plan, fillImage: p.background.imageUrl, matte: { muted: false } }
  return { ...plan, matte: { muted: false } } // remove
}

/** `blurPx: -1` in a plan means "use the configured strength"; this resolves it for a composition width. */
export function resolveBlurPx(plan: PresenterRenderPlan, p: PresenterSettings, compW: number): number {
  if (!plan.original) return 0
  return plan.original.blurPx < 0 ? presenterBlurPx(p, compW) : plan.original.blurPx
}

// ── presets ──────────────────────────────────────────────────────────────────────────────────────────────────

export interface PresenterPreset {
  id: string
  label: string
  description: string
  /** Whether it needs processed footage (background removal) to look as described. */
  needsMatte: boolean
  build: () => PresenterSettings
}

const withBackground = (p: PresenterSettings, background: Partial<PresenterSettings['background']>): PresenterSettings => ({
  ...p, background: { ...p.background, ...background },
})

export const PRESENTER_PRESETS: readonly PresenterPreset[] = [
  {
    id: 'bubble-bottom-left',
    label: 'Camera bubble',
    description: 'A round camera in the bottom-left corner, over whatever is behind it.',
    needsMatte: false,
    build: () => defaultPresenter('bubble'),
  },
  {
    id: 'bubble-cutout',
    label: 'Cut-out presenter',
    description: 'Just the person, no room behind them, standing over the website or background.',
    needsMatte: true,
    build: () => withBackground({ ...defaultPresenter('bubble'), shape: 'rect', aspect: 0.75, box: { x: 0.82, y: 0.62, size: 0.34 }, focus: { x: 0.5, y: 0.5, zoom: 1 }, borderWidth: 0, shadow: false }, { mode: 'remove' }),
  },
  {
    id: 'pip-corner',
    label: 'Picture-in-picture',
    description: 'A rounded rectangle in the bottom-right corner.',
    needsMatte: false,
    build: () => defaultPresenter('pip'),
  },
  {
    id: 'full-blur',
    label: 'Full frame, blurred room',
    description: 'The person fills the frame and the room behind them is softened.',
    needsMatte: true,
    build: () => withBackground(defaultPresenter('full'), { mode: 'blur', blur: 14 }),
  },
  {
    id: 'full-brand-colour',
    label: 'Full frame, brand colour',
    description: 'The person fills the frame over a solid colour.',
    needsMatte: true,
    build: () => withBackground(defaultPresenter('full'), { mode: 'color' }),
  },
]

export function presetById(id: string): PresenterPreset | undefined {
  return PRESENTER_PRESETS.find((p) => p.id === id)
}

// ── processed-footage cache keys ─────────────────────────────────────────────────────────────────────────────

/** FNV-1a 53-bit-ish hash → base36. Not cryptographic: it only names a cache entry. */
function hashString(s: string): string {
  let h1 = 0xdeadbeef ^ s.length
  let h2 = 0x41c6ce57 ^ s.length
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

export interface BakeOptions {
  engine: PresenterEngine
  maxSize: number
  /** Edge hardening 0..1 (applied when baking). */
  edge: number
  /** Temporal smoothing 0..1 (higher = steadier edges, more lag). */
  smooth: number
}

export const DEFAULT_BAKE: BakeOptions = { engine: 'mediapipe', maxSize: 1280, edge: 0.25, smooth: 0.5 }

/** Same video + same settings → same key, so processed footage is reused instead of recomputed. */
export function matteKey(sourceUrl: string, size: { bytes?: number; durationSec?: number } | undefined, opts: BakeOptions): string {
  const basis = [
    sourceUrl, size?.bytes ?? '', size?.durationSec != null ? round(size.durationSec, 2) : '',
    opts.engine, opts.maxSize, round(opts.edge, 2), round(opts.smooth, 2), 'v1',
  ].join('|')
  return `pm_${opts.engine}_${hashString(basis)}`
}

// ── mask maths (pure, applied per frame when baking) ─────────────────────────────────────────────────────────

/**
 * Steadies a matte over time: blend the new mask with the previous one. `smooth` 0 = no smoothing. Without
 * this, per-frame segmentation shimmers along the person's outline.
 */
export function smoothMask(prev: Uint8Array | null, cur: Uint8Array, smooth: number): Uint8Array {
  if (!prev || prev.length !== cur.length || smooth <= 0) return cur
  const k = clamp(smooth, 0, 0.95)
  const out = new Uint8Array(cur.length)
  for (let i = 0; i < cur.length; i += 1) out[i] = Math.round(prev[i] * k + cur[i] * (1 - k))
  return out
}

/** Soft-threshold: confidence below `lo` is background, above `hi` is the person, a ramp in between. */
export function hardenMask(mask: Uint8Array, edge: number): Uint8Array {
  const e = clamp(edge, 0, 1)
  if (e === 0) return mask
  const lo = Math.round(e * 110)
  const hi = 255 - lo
  const out = new Uint8Array(mask.length)
  for (let i = 0; i < mask.length; i += 1) {
    const a = mask[i]
    out[i] = a <= lo ? 0 : a >= hi ? 255 : Math.round(((a - lo) / (hi - lo)) * 255)
  }
  return out
}

/** Fraction of pixels that are mostly the person. Used to refuse a matte that is empty or covers everything. */
export function maskCoverage(mask: Uint8Array): number {
  if (mask.length === 0) return 0
  let on = 0
  for (let i = 0; i < mask.length; i += 1) if (mask[i] >= 128) on += 1
  return on / mask.length
}

/**
 * Whether a baked matte is plausible: some frames must show a person (not all-background, not all-person).
 * `coverages` is the per-frame coverage sampled while baking.
 */
export function matteQuality(coverages: number[]): { ok: boolean; reason: string | null; meanCoverage: number } {
  if (coverages.length === 0) return { ok: false, reason: 'No frames were processed.', meanCoverage: 0 }
  const mean = coverages.reduce((a, b) => a + b, 0) / coverages.length
  if (mean < 0.01) return { ok: false, reason: 'No person was found in the footage.', meanCoverage: mean }
  if (mean > 0.97) return { ok: false, reason: 'The whole frame was marked as the person, so nothing would be removed.', meanCoverage: mean }
  return { ok: true, reason: null, meanCoverage: mean }
}


// ── person bounds and auto-framing ───────────────────────────────────────────────────────────────────────────

export function normalizeBounds(raw: unknown): PersonBounds | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  if (![r.x0, r.y0, r.x1, r.y1].every(finite)) return undefined
  const b = { x0: clamp(r.x0 as number, 0, 1), y0: clamp(r.y0 as number, 0, 1), x1: clamp(r.x1 as number, 0, 1), y1: clamp(r.y1 as number, 0, 1) }
  return b.x1 - b.x0 >= 0.02 && b.y1 - b.y0 >= 0.02 ? { x0: round(b.x0), y0: round(b.y0), x1: round(b.x1), y1: round(b.y1) } : undefined
}

/** Bounding box of the pixels that are mostly person; null when there are none. */
export function maskBounds(mask: Uint8Array, width: number, height: number, threshold = 128): PersonBounds | null {
  let x0 = width, y0 = height, x1 = -1, y1 = -1
  for (let y = 0; y < height; y += 1) {
    const row = y * width
    for (let x = 0; x < width; x += 1) {
      if (mask[row + x] >= threshold) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        y1 = y
      }
    }
  }
  if (x1 < 0) return null
  return { x0: x0 / width, y0: y0 / height, x1: (x1 + 1) / width, y1: (y1 + 1) / height }
}

/** Median of per-frame bounds, so one stray frame (hand raised, someone walking by) does not move the framing. */
export function medianBounds(list: PersonBounds[]): PersonBounds | null {
  if (list.length === 0) return null
  const med = (k: keyof PersonBounds) => {
    const v = list.map((b) => b[k]).sort((a, b) => a - b)
    return v[Math.floor(v.length / 2)]
  }
  return normalizeBounds({ x0: med('x0'), y0: med('y0'), x1: med('x1'), y1: med('y1') }) ?? null
}

/**
 * Focus + zoom that frames the person's head and shoulders in a box of the given aspect (see presenterMediaRect):
 * the target is the top `headFraction` of the person's height, centred horizontally on them; the zoom is the largest
 * that keeps the whole target inside the box (with `margin` to spare); the focus is the target's centre in the video.
 */
export function suggestFraming(
  bounds: PersonBounds,
  videoAspect: number,
  boxAspect: number,
  opts: { headFraction?: number; margin?: number } = {},
): { x: number; y: number; zoom: number } {
  const headFraction = opts.headFraction ?? 0.38
  const margin = opts.margin ?? 0.88
  const ba = boxAspect > 0 ? boxAspect : 1
  const va = videoAspect > 0 ? videoAspect : 16 / 9
  // Fraction of the video visible in the box at zoom 1 (cover): the narrower axis is fully visible.
  const visX = ba >= va ? 1 : ba / va
  const visY = ba >= va ? va / ba : 1
  const tw = Math.max(0.02, bounds.x1 - bounds.x0)
  const th = Math.max(0.02, (bounds.y1 - bounds.y0) * headFraction)
  const zoom = clamp(Math.min((margin * visX) / tw, (margin * visY) / th), 1, MAX_PRESENTER_ZOOM)
  // Even at zoom 1 the box can show only part of the video (cover), so the focus still moves to the target.
  if (zoom <= 1.0001 && visX >= 0.9999 && visY >= 0.9999) return { x: 0.5, y: 0.5, zoom: 1 }
  return { x: round(clamp((bounds.x0 + bounds.x1) / 2, 0, 1)), y: round(clamp(bounds.y0 + th / 2, 0, 1)), zoom: round(zoom, 2) }
}
