/**
 * Centralized platform presets for previews, validation and media prep.
 * Publishing limits that MuAPI documents (title/caption max, accepted media)
 * stay in `../api/socialPayloads` (PLATFORM_SPECS) and are re-used here, never
 * copied. Everything below is display / pre-flight guidance only: it never
 * changes what is sent to MuAPI.
 */
import { PLATFORM_SPECS, PLATFORM_ORDER, type PlatformId, type MediaKind } from '../api/socialPayloads'

export type AspectKey = '16:9' | '1:1' | '4:5' | '9:16'

export const ASPECTS: Record<AspectKey, { w: number; h: number; label: string; size: { w: number; h: number } }> = {
  '9:16': { w: 9, h: 16, label: 'Vertical 9:16', size: { w: 1080, h: 1920 } },
  '1:1': { w: 1, h: 1, label: 'Square 1:1', size: { w: 1080, h: 1080 } },
  '16:9': { w: 16, h: 9, label: 'Landscape 16:9', size: { w: 1920, h: 1080 } },
  '4:5': { w: 4, h: 5, label: 'Portrait 4:5', size: { w: 1080, h: 1350 } },
}

export interface PlatformPreset {
  id: PlatformId
  label: string
  /** Aspect ratios the platform shows well (first = recommended). */
  aspects: AspectKey[]
  /** Soft limit used for counters/warnings (not a MuAPI contract unless `hardCaptionMax` is set). */
  captionSoftMax: number
  /** A limit MuAPI/the platform documents; exceeding it blocks that destination. */
  hardCaptionMax?: number
  hardTitleMax?: number
  hashtagSoftMax: number
  /** Fractions of the frame covered by platform UI (top, right, bottom, left) for safe-area guides. */
  safeArea: { top: number; right: number; bottom: number; left: number }
  /** Max video length in seconds for the common short-form placement (guidance only). */
  maxVideoSeconds?: number
}

const RAW: Record<PlatformId, Omit<PlatformPreset, 'id' | 'label' | 'hardCaptionMax' | 'hardTitleMax'>> = {
  youtube: { aspects: ['16:9', '9:16'], captionSoftMax: 5000, hashtagSoftMax: 15, safeArea: { top: 0.05, right: 0.05, bottom: 0.1, left: 0.05 } },
  instagram: { aspects: ['9:16', '4:5', '1:1'], captionSoftMax: 2200, hashtagSoftMax: 30, safeArea: { top: 0.14, right: 0.06, bottom: 0.2, left: 0.06 }, maxVideoSeconds: 900 },
  tiktok: { aspects: ['9:16'], captionSoftMax: 2200, hashtagSoftMax: 10, safeArea: { top: 0.1, right: 0.14, bottom: 0.22, left: 0.05 }, maxVideoSeconds: 600 },
  facebook: { aspects: ['4:5', '1:1', '16:9', '9:16'], captionSoftMax: 63206, hashtagSoftMax: 10, safeArea: { top: 0.05, right: 0.05, bottom: 0.1, left: 0.05 } },
  linkedin: { aspects: ['1:1', '16:9', '4:5'], captionSoftMax: 3000, hashtagSoftMax: 5, safeArea: { top: 0.05, right: 0.05, bottom: 0.05, left: 0.05 } },
  pinterest: { aspects: ['4:5', '9:16'], captionSoftMax: 500, hashtagSoftMax: 20, safeArea: { top: 0.05, right: 0.05, bottom: 0.12, left: 0.05 } },
  threads: { aspects: ['4:5', '9:16', '1:1'], captionSoftMax: 500, hashtagSoftMax: 1, safeArea: { top: 0.05, right: 0.05, bottom: 0.08, left: 0.05 } },
  x: { aspects: ['16:9', '1:1'], captionSoftMax: 280, hashtagSoftMax: 3, safeArea: { top: 0.04, right: 0.04, bottom: 0.04, left: 0.04 }, maxVideoSeconds: 140 },
}

export const PLATFORM_PRESETS: Record<PlatformId, PlatformPreset> = Object.fromEntries(
  PLATFORM_ORDER.map((id) => {
    const spec = PLATFORM_SPECS[id]
    return [id, { id, label: spec.label, ...RAW[id], hardCaptionMax: spec.captionMax, hardTitleMax: spec.titleMax }]
  }),
) as Record<PlatformId, PlatformPreset>

export function acceptsMedia(platform: PlatformId, kind: MediaKind): boolean {
  return PLATFORM_SPECS[platform]?.media.includes(kind) ?? false
}

/** Parse "1920x1080" or a ratio like 1.777 into the closest named aspect, or null. */
export function closestAspect(width: number, height: number, tolerance = 0.03): AspectKey | null {
  if (!width || !height) return null
  const r = width / height
  let best: AspectKey | null = null
  let bestDiff = Infinity
  for (const [k, a] of Object.entries(ASPECTS) as [AspectKey, (typeof ASPECTS)[AspectKey]][]) {
    const diff = Math.abs(r - a.w / a.h) / (a.w / a.h)
    if (diff < bestDiff) { bestDiff = diff; best = k }
  }
  return bestDiff <= tolerance ? best : null
}

export function aspectWarning(platform: PlatformId, width?: number, height?: number): string | null {
  if (!width || !height) return null
  const preset = PLATFORM_PRESETS[platform]
  if (!preset) return null
  const key = closestAspect(width, height)
  if (key && preset.aspects.includes(key)) return null
  const want = preset.aspects.join(', ')
  return `${preset.label} shows ${want} best; this media is ${key ?? `${width}×${height}`}. Reframe it in Media tools or expect cropping/letterboxing.`
}

export { PLATFORM_ORDER }
export type { PlatformId, MediaKind }
