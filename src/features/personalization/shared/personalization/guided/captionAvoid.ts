import { clearStudioPosition, coveredStudio, type Rect, type StudioClearance } from '../captions/studioClearance'
import { layerBlockers } from '../captions/captionBlockers'
import type { StudioCaptions } from '../captions/studioCaptions'
import type { PersonalizationPreviewSettings, PreviewInputProps } from '../preview/types'

/** What the Studio captions would cover on this frame: the captions and the layers that are on screen while a caption is. */
export interface CaptionAvoid { studio: StudioCaptions; width: number; height: number; blockers: Rect[] }

/** Null unless the video has enabled captions made in the Caption Studio (the only captions there are). */
export function captionAvoid(
  settings: Pick<PersonalizationPreviewSettings, 'layers' | 'width' | 'height' | 'fps' | 'captions'>,
  brand: PreviewInputProps['brand'] | undefined,
): CaptionAvoid | null {
  const c = settings.captions
  const studio = c?.studio
  if (!c || !c.enabled || !studio || studio.pages.length === 0) return null
  const width = settings.width || 1920, height = settings.height || 1080, fps = settings.fps > 0 ? settings.fps : 30
  const windows = studio.pages.map((p) => ({ startFrame: Math.floor((p.startMs / 1000) * fps), endFrame: Math.ceil(((p.startMs + p.durationMs) / 1000) * fps) }))
  const blockers = brand && settings.layers ? layerBlockers(settings.layers, brand, width, height, windows) : []
  return { studio, width, height, blockers }
}

/** The captions' height moved clear of the layers, or as it is when it already is clear (or cannot be). */
export const clearOf = (a: CaptionAvoid): StudioClearance => clearStudioPosition(a.studio, a.blockers, a.width, a.height)
export const coveredNow = (a: CaptionAvoid): number => coveredStudio(a.studio, a.blockers, a.width, a.height).length
