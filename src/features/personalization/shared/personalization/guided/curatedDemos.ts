/**
 * Curated HiggsBolt demo videos offered in Simple Mode step 2.
 *
 * The list used to be built from a hardcoded 12-slug allowlist
 * (`CURATED_SLUGS`), which is why the grid only ever showed 12 demos even
 * though 123 playable demo videos ship in `public/media/**`.
 *
 * It is now derived from the full demo library registry
 * (`src/data/demoLibraryRegistry.ts`), which indexes every locally-hosted
 * demo video that passed the on-disk verification (file exists, non-empty,
 * real WebM/MP4 magic number) and is described by a source catalog.
 *
 * Registry entries only ever point at files under `public/media/**`:
 *   public/media/minimax-h3/videos/<slug>.webm  + previews/<slug>.svg
 *   public/media/promptfeed/videos/<file>.mp4    + previews/<file>.jpg
 *   public/media/seedance-1/videos/<slug>.mp4    + previews/<slug>.svg
 *   public/media/seedance-25/videos/<file>.webm  + previews/<slug>.jpg
 *
 * The registry keeps `sourceRepo` + `slug` from the original catalogs, so
 * `getCreateUrl()` still produces the same working template ids.
 */

import type { VideoDemo } from '@ohb/data/types'
import { DEMO_LIBRARY_REGISTRY, toVideoDemo } from '@ohb/data/demoLibraryRegistry'

/**
 * Curated demo grid entries, in library order.
 *
 * This is the whole verified library — there is no slug allowlist any more.
 * The `VideoDemo` shape is preserved for every existing importer.
 */
export const GUIDED_DEMO_VIDEOS: VideoDemo[] = DEMO_LIBRARY_REGISTRY.map(toVideoDemo)

/** Frames a demo should occupy in the preview composition. */
export function demoDurationInFrames(demo: VideoDemo, fps: number): number {
  const safeFps = typeof fps === 'number' && Number.isFinite(fps) && fps > 0 ? fps : 30
  const seconds = typeof demo.duration === 'number' && demo.duration > 0 ? demo.duration : 5
  return Math.max(1, Math.round(safeFps * seconds))
}
