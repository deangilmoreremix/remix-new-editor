/**
 * Phase 4 porting batch 3g: catalog entries for upstream Remotion templates.
 * Exports ready-to-register entries; `../../catalog.ts` registers them.
 *
 * Batch 3g = fifteen transition / effect templates from `remotion-templates`
 * (React Video Editor, MIT, no named copyright holder). The upstream copies
 * live in `../../_upstream/rve-<slug>/` as C8 edited copies.
 *
 * - Twelve are TRANSITIONS played as an intro reveal: a brand card (business
 *   name, headline sub-line, logo or monogram tile) is the "before" side and
 *   the "after" side is transparent, so the transition uncovers the
 *   customer's video. They are full-frame (scale 1) and end at
 *   `placement.endFrame`, the frame the transition completes on at 30 fps.
 * - Three are OVERLAY effects (noise grain, vignette pulse, spotlight
 *   reveal) with a transparent canvas. The spotlight is entrance-only, so it
 *   carries an `endFrame`; grain and vignette stay for the whole clip.
 *
 * Importing this module registers nothing.
 */
import type { RemotionDesignComponent, RemotionDesignTemplate } from '../../types'
import {
  RVE_3G_ASPECT_RATIOS,
  TRANSITION_COLORS,
  TRANSITION_MEDIA,
  TRANSITION_TEXT_SLOTS,
  rve3gSource,
} from './batch3gShared'
import { RveBlindsTransitionDesign } from './RveBlindsTransitionDesign'
import { RveCardFlipDesign } from './RveCardFlipDesign'
import { RveClockWipeDesign } from './RveClockWipeDesign'
import { RveCrossDissolveDesign } from './RveCrossDissolveDesign'
import { RveFadeThroughBlackDesign } from './RveFadeThroughBlackDesign'
import { RveFilmBurnDesign } from './RveFilmBurnDesign'
import { RveIrisTransitionDesign } from './RveIrisTransitionDesign'
import { RveLetterboxRevealDesign } from './RveLetterboxRevealDesign'
import { RveMorphTransitionDesign } from './RveMorphTransitionDesign'
import { RveNoiseGrainDesign } from './RveNoiseGrainDesign'
import { RvePixelTransitionDesign } from './RvePixelTransitionDesign'
import { RvePushTransitionDesign } from './RvePushTransitionDesign'
import { RveSpotlightRevealDesign } from './RveSpotlightRevealDesign'
import { RveVignettePulseDesign } from './RveVignettePulseDesign'
import { RveZoomThroughDesign } from './RveZoomThroughDesign'

/** Shared capability note for the intro-reveal transitions. */
const TRANSITION_NOTE =
  'Intro reveal: plays over the start of your video and ends on the frame the transition completes. ' +
  'The "after" side is transparent, so the transition uncovers your video. Timings are the upstream ' +
  'fps-relative ones; the end frame assumes the default 30 fps. The logo is optional — without one a ' +
  'brand-gradient monogram tile is shown. No filters, blend modes, external assets or SVG ids.'

function transition(options: {
  slug: string
  name: string
  description: string
  component: RemotionDesignComponent
  endFrame: number
  easing: string
  notes: string
}): RemotionDesignTemplate {
  return {
    id: `rve-${options.slug}`,
    name: options.name,
    description: options.description,
    category: 'transition',
    source: rve3gSource(options.slug),
    component: options.component,
    textSlots: TRANSITION_TEXT_SLOTS,
    colors: TRANSITION_COLORS,
    media: TRANSITION_MEDIA,
    animation: { durationInFrames: options.endFrame, delayInFrames: 0, easing: options.easing },
    placement: {
      x: 0.5,
      y: 0.5,
      scale: 1,
      opacity: 1,
      animation: 'none',
      endFrame: options.endFrame,
    },
    aspectRatios: RVE_3G_ASPECT_RATIOS,
    requiredMedia: [],
    capabilities: {
      preview: true,
      browserExport: true,
      notes: `${TRANSITION_NOTE} ${options.notes}`,
    },
    previewCompatible: true,
  }
}

export const rveBlindsTransitionTemplate = transition({
  slug: 'blinds-transition',
  name: 'Blinds Reveal',
  description: 'Your brand card flips open like window blinds to reveal your video.',
  component: RveBlindsTransitionDesign,
  endFrame: 70,
  easing: 'interpolate rotateX 0 -> 90 per blind, staggered 3 frames (fps * 0.5 -> fps * 1.5)',
  notes:
    'Uses CSS 3D transforms (perspective + rotateX + backface-visibility) on eight slices of the card.',
})

export const rveClockWipeTemplate = transition({
  slug: 'clock-wipe',
  name: 'Clock Wipe',
  description: 'A clock-hand sweep wipes your brand card away to reveal your video.',
  component: RveClockWipeDesign,
  endFrame: 75,
  easing: 'linear angle 0 -> 360 over fps * 2.5',
  notes: 'The sweep is a CSS clip-path polygon.',
})

export const rveCrossDissolveTemplate = transition({
  slug: 'cross-dissolve',
  name: 'Cross Dissolve',
  description: 'Your brand card softly dissolves into your video.',
  component: RveCrossDissolveDesign,
  endFrame: 75,
  easing: 'linear opacity over fps * 2.5',
  notes: 'Opacity only.',
})

export const rveFadeThroughBlackTemplate = transition({
  slug: 'fade-through-black',
  name: 'Fade Through Black',
  description: 'Your brand card fades to dark, then your video fades up.',
  component: RveFadeThroughBlackDesign,
  endFrame: 90,
  easing: 'interpolate opacity, dark overlay peaking at the midpoint of fps * 3',
  notes: 'The "black" is a near-black shade of your brand colour.',
})

export const rveFilmBurnTemplate = transition({
  slug: 'film-burn',
  name: 'Film Burn',
  description: 'A warm light-leak flash burns away your brand card to reveal your video.',
  component: RveFilmBurnDesign,
  endFrame: 90,
  easing: 'interpolate intensity 0 -> 0.85 -> 0 over fps * 3, sine/cosine drift',
  notes:
    'The light leaks are layered radial gradients tinted with your brand colours; the card is cut behind ' +
    'the flash peak.',
})

export const rveIrisTransitionTemplate = transition({
  slug: 'iris-transition',
  name: 'Iris Reveal',
  description: 'A classic iris closes on your brand card and opens on your video.',
  component: RveIrisTransitionDesign,
  endFrame: 75,
  easing: 'interpolate radius 75% -> 0% -> 75% over fps * 2.5',
  notes: 'CSS clip-path circle plus a radial-gradient mask outside the iris.',
})

export const rveLetterboxRevealTemplate = transition({
  slug: 'letterbox-reveal',
  name: 'Letterbox Reveal',
  description: 'Cinematic bars part to reveal your video and your business name.',
  component: RveLetterboxRevealDesign,
  endFrame: 75,
  easing: 'interpolate bar height 50% -> 0% over fps * 2, title fade fps * 0.5 -> fps * 1.5',
  notes:
    'The upstream stops the bars at a 12% letterbox; here they open fully so the layer can end without a ' +
    'hard cut. The name is shown without the logo, in wide cinematic tracking.',
})

export const rveMorphTransitionTemplate = transition({
  slug: 'morph-transition',
  name: 'Morph Out',
  description: 'Your brand card shrinks and melts away into your video.',
  component: RveMorphTransitionDesign,
  endFrame: 48,
  easing: 'interpolate scale 1 -> 0.5, opacity gone at 60% of fps * 2.5',
  notes: 'Scale and opacity only.',
})

export const rvePixelTransitionTemplate = transition({
  slug: 'pixel-transition',
  name: 'Pixel Dissolve',
  description: 'Your brand card breaks into pixels that vanish to reveal your video.',
  component: RvePixelTransitionDesign,
  endFrame: 46,
  easing: 'seeded per-tile delay (remotion random), 45-frame spread',
  notes:
    'Tiles are plain divs sized to the composition (about 1,300 at 1080p), seeded with remotion random() so ' +
    'every render is identical.',
})

export const rvePushTransitionTemplate = transition({
  slug: 'push-transition',
  name: 'Push Reveal',
  description: 'Your brand card is pushed off screen as your video slides in.',
  component: RvePushTransitionDesign,
  endFrame: 52,
  easing: 'spring(damping: 15, stiffness: 80, mass: 0.8) from fps * 0.8',
  notes: 'translateX only.',
})

export const rveZoomThroughTemplate = transition({
  slug: 'zoom-through',
  name: 'Zoom Through',
  description: 'Zoom straight through your brand card into your video.',
  component: RveZoomThroughDesign,
  endFrame: 40,
  easing: 'interpolate scale 1 -> 3 and fade over fps * 1.25',
  notes: 'Scale and opacity only.',
})

export const rveCardFlipTemplate = transition({
  slug: 'card-flip',
  name: 'Card Flip',
  description: 'Your brand card flips over in 3D to reveal your video.',
  component: RveCardFlipDesign,
  endFrame: 50,
  easing: 'spring(damping: 15, mass: 0.5) 0 -> 180 deg after a 24-frame hold',
  notes:
    'Uses CSS 3D transforms (perspective + rotateY + backface-visibility). The upstream spins a small card a ' +
    'full turn; here the card fills the frame and turns half-way so its transparent back faces the viewer.',
})

/* -------------------------------------------------------------------------- */
/* Overlays                                                                    */
/* -------------------------------------------------------------------------- */

export const rveNoiseGrainTemplate: RemotionDesignTemplate = {
  id: 'rve-noise-grain',
  name: 'Film Grain',
  description: 'A subtle, flickering film-grain texture over your whole video.',
  category: 'visual-effect',
  source: rve3gSource('noise-grain'),
  component: RveNoiseGrainDesign,
  textSlots: [],
  colors: [{ role: 'text', label: 'Grain tint' }],
  media: [],
  animation: { durationInFrames: 30, delayInFrames: 0, easing: 'deterministic per-frame noise, re-seeded every frame' },
  placement: { x: 0.5, y: 0.5, scale: 1, opacity: 1, animation: 'none' },
  aspectRatios: RVE_3G_ASPECT_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Overlay for the whole clip with a transparent canvas: one inline SVG of low-opacity cells recomputed ' +
      'every frame from a deterministic hash (no Math.random). Cells are 12 px at 1080p (upstream 8 px) to ' +
      'keep the SVG at about 14,000 rects per frame. No filters, blend modes, external assets or SVG ids.',
  },
  previewCompatible: true,
}

export const rveVignettePulseTemplate: RemotionDesignTemplate = {
  id: 'rve-vignette-pulse',
  name: 'Vignette Pulse',
  description: 'A softly breathing dark vignette that frames your video.',
  category: 'visual-effect',
  source: rve3gSource('vignette-pulse'),
  component: RveVignettePulseDesign,
  textSlots: [],
  colors: [{ role: 'primary', label: 'Vignette tint' }],
  media: [],
  animation: { durationInFrames: 30, delayInFrames: 0, easing: 'sine pulse, one cycle per second' },
  placement: { x: 0.5, y: 0.5, scale: 1, opacity: 1, animation: 'none' },
  aspectRatios: RVE_3G_ASPECT_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Overlay for the whole clip with a transparent canvas: a single radial-gradient whose edge strength ' +
      'pulses between 0.3 and 0.8. No filters, blend modes, external assets or SVG ids.',
  },
  previewCompatible: true,
}

export const rveSpotlightRevealTemplate: RemotionDesignTemplate = {
  id: 'rve-spotlight-reveal',
  name: 'Spotlight Reveal',
  description: 'A glowing spotlight opens from the centre to reveal your video.',
  category: 'visual-effect',
  source: rve3gSource('spotlight-reveal'),
  component: RveSpotlightRevealDesign,
  textSlots: [
    { key: 'businessName', field: 'businessName', label: 'Business name', primary: true, maxLength: 40 },
    { key: 'headline', field: 'headline', label: 'Sub-line', maxLength: 64 },
  ],
  colors: [
    { role: 'primary', label: 'Frame colour' },
    { role: 'accent', label: 'Glow colour' },
    { role: 'text', label: 'Text colour' },
  ],
  media: [],
  animation: {
    durationInFrames: 75,
    delayInFrames: 0,
    easing: 'interpolate radius 0% -> 75% over 72 frames, glow 0 -> 0.6 -> 0',
  },
  placement: { x: 0.5, y: 0.5, scale: 1, opacity: 1, animation: 'none', endFrame: 75 },
  aspectRatios: RVE_3G_ASPECT_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Entrance-only overlay with a transparent canvas: a CSS clip-path circle plus a radial-gradient mask ' +
      'outside it, ending once the spotlight has fully opened. The reveal length is pinned to 90 frames ' +
      '(upstream: the host composition duration); the end frame assumes 30 fps. No filters, blend modes, ' +
      'external assets or SVG ids.',
  },
  previewCompatible: true,
}

/** Batch 3g designs, in registration order. */
export const BATCH_3G_TEMPLATES: RemotionDesignTemplate[] = [
  rveBlindsTransitionTemplate,
  rveClockWipeTemplate,
  rveCrossDissolveTemplate,
  rveFadeThroughBlackTemplate,
  rveFilmBurnTemplate,
  rveIrisTransitionTemplate,
  rveLetterboxRevealTemplate,
  rveMorphTransitionTemplate,
  rvePixelTransitionTemplate,
  rvePushTransitionTemplate,
  rveZoomThroughTemplate,
  rveCardFlipTemplate,
  rveNoiseGrainTemplate,
  rveVignettePulseTemplate,
  rveSpotlightRevealTemplate,
]

/**
 * Batch 3g designs that hardcode SVG ids (one instance per composition).
 *
 * None: the only SVG in the batch (the noise grain) declares no id, and the
 * masks and wipes are CSS clip-paths / gradients, not SVG <mask>/<clipPath>.
 */
export const BATCH_3G_FIXED_SVG_IDS: Record<string, string[]> = {}
