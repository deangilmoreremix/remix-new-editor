/** Pure edits to `settings.thumbnail` and `settings.gif` (Stage 7); results are normalised. */
import type { PersonalizationPreviewSettings } from '../preview/types'
import { DEFAULT_GIF, DEFAULT_THUMBNAIL, normalizeGif, normalizeThumbnail, type GifSettings, type ThumbnailSettings } from '../preview/stills'

export function patchThumbnail(prev: PersonalizationPreviewSettings, patch: Partial<ThumbnailSettings>): PersonalizationPreviewSettings {
  const n = normalizeThumbnail({ ...DEFAULT_THUMBNAIL, ...(prev.thumbnail ?? {}), ...patch })
  return n ? { ...prev, thumbnail: n } : prev
}
export function patchGif(prev: PersonalizationPreviewSettings, patch: Partial<GifSettings>): PersonalizationPreviewSettings {
  const n = normalizeGif({ ...DEFAULT_GIF, ...(prev.gif ?? {}), ...patch })
  return n ? { ...prev, gif: n } : prev
}
