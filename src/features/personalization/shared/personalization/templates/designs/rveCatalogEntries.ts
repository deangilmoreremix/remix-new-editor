/**
 * The Phase 2 "batch 2" catalog entries — the React Video Editor designs.
 *
 * These four designs come from `remotion-templates`
 * (https://github.com/deangilmoreremix/remotion-templates), the template
 * library of https://www.reactvideoeditor.com. They are the second upstream
 * repository the design layer draws from, after the Phase 1 RenderComp
 * templates.
 *
 * WHY A SEPARATE FILE
 * -------------------
 * `../catalog.ts` owns the registry lane, so this file only *exports* ready-
 * to-register entries. The orchestrator's catalog lane imports them with one
 * import and adds them to `REMOTION_DESIGN_TEMPLATES`:
 *
 *     import {
 *       RVE_CATALOG_ENTRIES,
 *     } from './designs/rveCatalogEntries'
 *
 *     export const REMOTION_DESIGN_TEMPLATES: RemotionDesignTemplate[] = [
 *       ...phase1Templates,
 *       ...RVE_CATALOG_ENTRIES,
 *     ]
 *
 * Nothing here registers itself: importing this module has no side effect.
 *
 * LICENCE POSITION (repo 2 is the unusual one)
 * --------------------------------------------
 * `remotion-templates` ships NO `LICENSE` file and names NO copyright holder.
 * Its README states: "All templates in this repository are available under
 * the MIT License. You can use them in personal and commercial projects, but
 * attribution is appreciated where applicable." Every template file carries
 * the in-file header "Credit appreciated but not required. Created by the team
 * at https://www.reactvideoeditor.com".
 *
 * → `source.license` is `MIT`, and `source.attribution` carries the repo-2
 *   credit line (contract addition C10). It is deliberately NOT the Phase 1
 *   line, which names RenderComp. A project that uses designs from both
 *   repositories has to show both credits.
 *
 * The upstream files in `../_upstream/rve-<id>/` are EDITED copies: contract
 * addition C8 permits a scoped deviation from the "the upstream components
 * are frozen" rule for repo 2, because 78 of its 81 files hardcode every
 * string, colour and dimension in JSX. Each copy carries its own deviation
 * record in its header; every hard-coded literal became a prop whose default
 * reproduces the upstream value exactly.
 */

import type { RemotionDesignTemplate } from '../types'
import { RveAnimatedTextDesign } from './rveAnimatedTextDesign'
import { RveCircularProgressDesign } from './rveCircularProgressDesign'
import { RvePoppingTextDesign } from './rvePoppingTextDesign'
import { RveSlideTextDesign } from './rveSlideTextDesign'
import {
  RVE_ATTRIBUTION,
  RVE_LICENSE_NOTICE,
  RVE_UPSTREAM_CREDIT,
} from './rveSharedDesign'

export { RVE_ATTRIBUTION, RVE_LICENSE_NOTICE, RVE_UPSTREAM_CREDIT }

/* -------------------------------------------------------------------------- */
/* Attribution                                                                 */
/* -------------------------------------------------------------------------- */

/** The upstream repository the four templates were copied from. */
export const RVE_REPOSITORY = 'remotion-templates'

/** The upstream repository's URL. */
export const RVE_REPOSITORY_URL =
  'https://github.com/deangilmoreremix/remotion-templates'

/**
 * The upstream's licence.
 *
 * The repository ships no `LICENSE` file; the README states that every
 * template is available under the MIT License and that attribution is
 * appreciated where applicable. No copyright holder is named, so the MIT
 * permission notice is reproduced WITHOUT a copyright line.
 */
export const RVE_LICENSE = 'MIT'

/** The path of a template inside the upstream repository. */
export type RveSourcePath =
  | 'templates/circular-progress.tsx'
  | 'templates/animated-text.tsx'
  | 'templates/popping-text.tsx'
  | 'templates/slide-text.tsx'

/** Builds the `source` block every repo-2 design carries. */
function rveSource(sourcePath: RveSourcePath): RemotionDesignTemplate['source'] {
  return {
    repository: RVE_REPOSITORY,
    repositoryUrl: RVE_REPOSITORY_URL,
    sourcePath,
    license: RVE_LICENSE,
    attribution: RVE_ATTRIBUTION,
  }
}

/* -------------------------------------------------------------------------- */
/* Templates                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The branded loading ring.
 *
 * The upstream's percentage is a time-driven loop, not data, so this design
 * has no editable text: the only brandable values are the ring's colours and
 * the label's size.
 */
export const rveCircularProgressTemplate: RemotionDesignTemplate = {
  id: 'rve-circular-progress',
  name: 'Progress Ring',
  description: 'A branded ring that pulses and fills over your video.',
  category: 'other',
  source: rveSource('templates/circular-progress.tsx'),
  component: RveCircularProgressDesign,
  textSlots: [],
  colors: [
    { role: 'accent', label: 'Ring accent' },
    { role: 'primary', label: 'Ring track' },
    { role: 'text', label: 'Percentage colour' },
  ],
  media: [],
  animation: {
    durationInFrames: 90,
    delayInFrames: 0,
    easing: 'interpolate loop (90 frames) + sine pulse',
  },
  placement: { x: 0.5, y: 0.5, scale: 0.7, opacity: 1, animation: 'none' },
  aspectRatios: ['16:9', '9:16', '1:1', '4:5'],
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: inline SVG only — no filters, no blend modes, no external assets. ' +
      'The upstream uses the fixed SVG id "progressGradient", so at most ONE instance of this design may be ' +
      'mounted per composition (contract addition C7). The ring is a fixed 300 px box in the upstream (not ' +
      'canvas-relative) and the percentage is a time-driven loop, not data, so this design has no editable text.',
  },
  previewCompatible: true,
}

/**
 * The headline that springs in one character at a time.
 */
export const rveAnimatedTextTemplate: RemotionDesignTemplate = {
  id: 'rve-animated-text',
  name: 'Animated Text',
  description: 'Your headline springs in, one character at a time.',
  category: 'animated-headline',
  source: rveSource('templates/animated-text.tsx'),
  component: RveAnimatedTextDesign,
  textSlots: [{ key: 'headline', field: 'headline', label: 'Headline', primary: true }],
  colors: [{ role: 'text', label: 'Headline colour' }],
  media: [],
  animation: {
    durationInFrames: 150,
    delayInFrames: 0,
    easing: 'per-character spring(mass: 0.5, damping: 10) staggered 5 frames',
  },
  placement: { x: 0.5, y: 0.5, scale: 0.8, opacity: 1, animation: 'none' },
  aspectRatios: ['16:9', '9:16', '1:1', '4:5'],
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: springs and inline styles only, no filters and no external assets. ' +
      'The upstream copies "Hello Remotion" in JSX; the copy is now a prop and the upstream demo string is ' +
      'never reachable. The characters are staggered five frames apart, so the headline is truncated to what ' +
      'fits on one line, and the type size is canvas-relative (the upstream "rem" value is not).',
  },
  previewCompatible: true,
}

/**
 * The big block letters that pop in one by one.
 */
export const rvePoppingTextTemplate: RemotionDesignTemplate = {
  id: 'rve-popping-text',
  name: 'Popping Text',
  description: 'Big block letters that pop in, one by one.',
  category: 'animated-headline',
  source: rveSource('templates/popping-text.tsx'),
  component: RvePoppingTextDesign,
  textSlots: [{ key: 'headline', field: 'headline', label: 'Headline', primary: true }],
  colors: [
    { role: 'primary', label: 'Letter colours' },
    { role: 'text', label: 'Letter outline' },
  ],
  media: [],
  animation: {
    durationInFrames: 120,
    delayInFrames: 0,
    easing: 'per-character spring(mass: 0.4, damping: 8, stiffness: 100) staggered 7 frames',
  },
  placement: { x: 0.5, y: 0.5, scale: 0.65, opacity: 1, animation: 'none' },
  aspectRatios: ['16:9', '9:16', '1:1', '4:5'],
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: springs, inline styles and a text-shadow outline only. The upstream ' +
      'rotates a THREE-entry palette per character, so the palette keeps three entries (a dark, a mid and a ' +
      'light shade of the brand primary) and the rotation reads the same. The upstream "Impact" family is ' +
      'replaced by the bundled deterministic typeface and the headline is truncated to what fits on one line.',
  },
  previewCompatible: true,
}

/**
 * The heading that slides in from the right.
 */
export const rveSlideTextTemplate: RemotionDesignTemplate = {
  id: 'rve-slide-text',
  name: 'Sliding Text',
  description: 'A heading that slides in from the right.',
  category: 'animated-headline',
  source: rveSource('templates/slide-text.tsx'),
  component: RveSlideTextDesign,
  textSlots: [{ key: 'headline', field: 'headline', label: 'Headline', primary: true }],
  colors: [{ role: 'text', label: 'Headline colour' }],
  media: [],
  animation: {
    durationInFrames: 30,
    delayInFrames: 0,
    easing: 'spring(durationInFrames: 30) + spring(damping: 12, mass: 0.5)',
  },
  placement: { x: 0.5, y: 0.5, scale: 0.85, opacity: 1, animation: 'none' },
  aspectRatios: ['16:9', '9:16', '1:1', '4:5'],
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: two springs and inline styles only. The upstream copies "Sliding ' +
      'Text!" in JSX; the copy is now a prop and the upstream demo string is never reachable. The heading is ' +
      'truncated to what fits on one line and the type size is canvas-relative (the upstream "rem" value is not).',
  },
  previewCompatible: true,
}

/**
 * Every batch-2 design, in registration order.
 *
 * The catalog lane adds this array to the registry with one import; nothing
 * in this module registers anything by itself.
 */
export const RVE_CATALOG_ENTRIES: RemotionDesignTemplate[] = [
  rveCircularProgressTemplate,
  rveAnimatedTextTemplate,
  rvePoppingTextTemplate,
  rveSlideTextTemplate,
]
