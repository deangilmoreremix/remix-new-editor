/**
 * Presenter background removal: what the customer chose. This is only SETTINGS (small, safe to save with the
 * project). The per-frame masks are measured from the footage in the browser and are never saved
 * (see maskStore.ts), so a reopened project simply measures again.
 */
export type CutoutBackground =
  | { kind: 'none' }
  | { kind: 'color'; color: string }
  | { kind: 'image'; url: string }
  | { kind: 'video'; url: string }
  /** The original footage, blurred, behind the presenter. */
  | { kind: 'blur'; amount: number }

export interface CutoutPresenter {
  /** Center of the presenter as a fraction of the frame (0.5 = middle). */
  x: number
  y: number
  /** 1 = the footage at its normal size. */
  scale: number
  /** Degrees. */
  rotation: number
}

export interface CutoutEdge {
  /** 0 (crisp) .. 1 (soft). */
  feather: number
  /** -1 (grow the presenter) .. 1 (shrink it). Trims halos or recovers hair. */
  shift: number
}

export interface CutoutSettings {
  enabled: boolean
  background: CutoutBackground
  presenter: CutoutPresenter
  edge: CutoutEdge
}

export const CUTOUT_SCALE_MIN = 0.2
export const CUTOUT_SCALE_MAX = 2.5

export const DEFAULT_CUTOUT: CutoutSettings = {
  enabled: false,
  background: { kind: 'color', color: '#101827' },
  presenter: { x: 0.5, y: 0.5, scale: 1, rotation: 0 },
  edge: { feather: 0.3, shift: 0 },
}

export interface PresenterPreset {
  id: string
  label: string
  presenter: CutoutPresenter
}

/** Where the presenter sits in common layouts. */
export const PRESENTER_PRESETS: PresenterPreset[] = [
  { id: 'full', label: 'Full screen', presenter: { x: 0.5, y: 0.5, scale: 1, rotation: 0 } },
  { id: 'left', label: 'Left', presenter: { x: 0.28, y: 0.55, scale: 0.85, rotation: 0 } },
  { id: 'right', label: 'Right', presenter: { x: 0.72, y: 0.55, scale: 0.85, rotation: 0 } },
  { id: 'corner', label: 'Picture-in-picture', presenter: { x: 0.8, y: 0.7, scale: 0.42, rotation: 0 } },
]

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown, fallback: number, min: number, max: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

function normalizeBackground(raw: unknown): CutoutBackground {
  if (!isRecord(raw)) return { ...DEFAULT_CUTOUT.background }
  switch (raw.kind) {
    case 'none':
      return { kind: 'none' }
    case 'color':
      return { kind: 'color', color: str(raw.color) ?? '#101827' }
    case 'image': {
      const url = str(raw.url)
      return url ? { kind: 'image', url } : { ...DEFAULT_CUTOUT.background }
    }
    case 'video': {
      const url = str(raw.url)
      return url ? { kind: 'video', url } : { ...DEFAULT_CUTOUT.background }
    }
    case 'blur':
      return { kind: 'blur', amount: num(raw.amount, 24, 4, 60) }
    default:
      return { ...DEFAULT_CUTOUT.background }
  }
}

/** Reads saved settings defensively: anything missing or invalid falls back to a safe value. Returns undefined when absent. */
export function normalizeCutout(raw: unknown): CutoutSettings | undefined {
  if (!isRecord(raw)) return undefined
  const presenter = isRecord(raw.presenter) ? raw.presenter : {}
  const edge = isRecord(raw.edge) ? raw.edge : {}
  return {
    enabled: raw.enabled === true,
    background: normalizeBackground(raw.background),
    presenter: {
      x: num(presenter.x, 0.5, -0.5, 1.5),
      y: num(presenter.y, 0.5, -0.5, 1.5),
      scale: num(presenter.scale, 1, CUTOUT_SCALE_MIN, CUTOUT_SCALE_MAX),
      rotation: num(presenter.rotation, 0, -180, 180),
    },
    edge: {
      feather: num(edge.feather, DEFAULT_CUTOUT.edge.feather, 0, 1),
      shift: num(edge.shift, 0, -1, 1),
    },
  }
}

/**
 * Backgrounds that only exist in this browser session (blob:/data: URLs) cannot be restored after a reload.
 * Saving swaps them for a plain color so a reopened project is never left pointing at a dead URL.
 */
export function cutoutForSave(cutout: CutoutSettings | undefined): CutoutSettings | undefined {
  if (!cutout) return cutout
  const bg = cutout.background
  if ((bg.kind === 'image' || bg.kind === 'video') && /^(blob:|data:)/i.test(bg.url)) {
    return { ...cutout, background: { kind: 'color', color: DEFAULT_CUTOUT.background.kind === 'color' ? DEFAULT_CUTOUT.background.color : '#101827' } }
  }
  return cutout
}
