import { captionRect, clearCaptionOffset, coveredBy, type CaptionBand, type Clearance, type Rect } from '../captions/captionClearance'
import { layerBlockers } from '../captions/captionBlockers'
import { captionLayout } from '../captions/captionStyle'
import { displayScale } from '../captions/scripts'
import type { PersonalizationPreviewSettings, PreviewInputProps } from '../preview/types'

/** What the captions would cover on this frame: the caption band and the layers that are on screen while a caption is. Null without captions. */
export interface CaptionAvoid { band: CaptionBand; blockers: Rect[] }

export function captionAvoid(
  settings: Pick<PersonalizationPreviewSettings, 'layers' | 'width' | 'height' | 'fps' | 'captions'>,
  brand: PreviewInputProps['brand'] | undefined,
): CaptionAvoid | null {
  const c = settings.captions
  // Captions designed in the Caption Studio carry their own style and height: nothing here to estimate or move.
  if (!c || !c.enabled || c.cues.length === 0 || c.studio) return null
  const w = settings.width || 1920, h = settings.height || 1080, fps = settings.fps > 0 ? settings.fps : 30
  const longest = c.cues.reduce((a, x) => (x.text.length > a.text.length ? x : a), c.cues[0])
  const layout = captionLayout(c.style, c.position, w, h)
  const band: CaptionBand = {
    position: c.position,
    offsetY: c.custom?.offsetY,
    size: (layout.fontSizePx / h) * displayScale(c.language, longest.text),
    edge: layout.marginPx / h,
    aspect: w / h,
    chars: longest.text.length,
    box: c.style === 'bar' || !!c.custom?.backgroundColor,
  }
  const windows = c.cues.map((x) => ({ startFrame: Math.floor((x.startMs / 1000) * fps), endFrame: Math.ceil((x.endMs / 1000) * fps) }))
  const blockers = brand && settings.layers ? layerBlockers(settings.layers, brand, w, h, windows) : []
  return { band, blockers }
}

/** The captions' offset moved clear of the layers, or as it is when it already is clear (or cannot be). */
export const clearOf = (a: CaptionAvoid): Clearance => clearCaptionOffset(a.band, a.blockers)
export const coveredNow = (a: CaptionAvoid): number => coveredBy(a.band, a.blockers).length
export { captionRect }
