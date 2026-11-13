/**
 * Phase 4 porting batch 3h: catalog entries for upstream Remotion templates.
 * Exports ready-to-register entries; `../../catalog.ts` registers them.
 *
 * Batch 3h = fourteen media / particle templates from repo 2,
 * `remotion-templates` (React Video Editor, https://www.reactvideoeditor.com).
 * The upstream copies in `../../_upstream/rve-<slug>/` are EDITED copies under
 * the repo-2 C8 convention (every literal became a prop whose default
 * reproduces the upstream); each carries its own deviation record.
 *
 * Classification:
 *  - full-scene (images fill the frame; a brand-tinted background; plays as an
 *    intro card via `placement.endFrame`, then reveals the customer's video):
 *    gallery grid, image carousel, image comparison slider, image zoom reveal,
 *    Ken Burns, masonry gallery, photo stack, rotating carousel, zoom pulse.
 *  - overlays (transparent canvas, no `endFrame`): picture-in-picture,
 *    polaroid frame, liquid wave, matrix rain, particle explosion.
 *
 * Media: every image slot is fed by the customer's brand media (product →
 * service → logo, cycled); with no brand media the slot renders a brand
 * gradient placeholder with the business name. No adapter ever renders a
 * remote/upstream URL — the upstream unsplash/pexels defaults survive only as
 * documented defaults of the edited copies.
 */
import type { RemotionDesignMediaBinding, RemotionDesignTemplate } from '../../types'
import { RVE_ATTRIBUTION } from '../rveSharedDesign'
import { RveGalleryGridDesign } from './GalleryGridDesign'
import { RveImageCarouselDesign } from './ImageCarouselDesign'
import { RveImageComparisonSliderDesign } from './ImageComparisonSliderDesign'
import { RveImageZoomRevealDesign } from './ImageZoomRevealDesign'
import { RveKenBurnsDesign } from './KenBurnsDesign'
import { RveMasonryGalleryDesign } from './MasonryGalleryDesign'
import { RvePhotoStackDesign } from './PhotoStackDesign'
import { RvePictureInPictureDesign } from './PictureInPictureDesign'
import { RvePolaroidFrameDesign } from './PolaroidFrameDesign'
import { RveRotatingCarouselDesign } from './RotatingCarouselDesign'
import { RveZoomPulseDesign } from './ZoomPulseDesign'
import { RveLiquidWaveDesign } from './LiquidWaveDesign'
import { RveMatrixRainDesign } from './MatrixRainDesign'
import { RveParticleExplosionDesign } from './ParticleExplosionDesign'

const ALL_RATIOS: RemotionDesignTemplate['aspectRatios'] = ['16:9', '9:16', '1:1', '4:5']

function rveSource(slug: string): RemotionDesignTemplate['source'] {
  return {
    repository: 'remotion-templates',
    repositoryUrl: 'https://github.com/deangilmoreremix/remotion-templates',
    sourcePath: `templates/${slug}.tsx`,
    license: 'MIT',
    attribution: RVE_ATTRIBUTION,
  }
}

/** Every image design accepts all three brand media roles, none required. */
const BRAND_MEDIA: RemotionDesignMediaBinding[] = [
  { role: 'product', label: 'Product photo', required: false },
  { role: 'service', label: 'Service photo', required: false },
  { role: 'logo', label: 'Logo', required: false },
]

const FULL_SCENE_NOTE =
  'Full-scene intro card: it paints a brand-tinted background over the whole frame and ends at ' +
  'placement.endFrame, then the customer video shows. '
const MEDIA_NOTE =
  'Image slots use the brand product, service and logo images (cycled); with no brand media they ' +
  'render brand-gradient placeholder tiles with the business name — never a remote URL. Brand images ' +
  'render through Remotion <Img>, which holds the frame until the image has loaded. '
const C8_NOTE =
  'The upstream copy is an edited C8 copy (every literal is now a prop); fixed px/rem sizes are ' +
  'rescaled from the composition short edge so 9:16, 1:1 and 4:5 match 16:9.'

const BUSINESS_NAME_SLOT = {
  key: 'businessName',
  field: 'businessName' as const,
  label: 'Business name',
  primary: true,
}

function fullScenePlacement(endFrame: number): RemotionDesignTemplate['placement'] {
  return { x: 0.5, y: 0.5, scale: 1, opacity: 1, animation: 'none', endFrame }
}

const OVERLAY_PLACEMENT: RemotionDesignTemplate['placement'] = {
  x: 0.5,
  y: 0.5,
  scale: 1,
  opacity: 1,
  animation: 'none',
}

/* -------------------------------------------------------------------------- */
/* Full-scene                                                                  */
/* -------------------------------------------------------------------------- */

export const rveGalleryGridTemplate: RemotionDesignTemplate = {
  id: 'rve-gallery-grid',
  name: 'Gallery Grid',
  description: 'Six of your photos spring into a clean grid to open your video.',
  category: 'full-scene',
  source: rveSource('gallery-grid'),
  component: RveGalleryGridDesign,
  textSlots: [BUSINESS_NAME_SLOT],
  colors: [
    { role: 'primary', label: 'Tiles and background' },
    { role: 'accent', label: 'Tile accents' },
    { role: 'text', label: 'Placeholder name' },
  ],
  media: BRAND_MEDIA,
  animation: {
    durationInFrames: 60,
    delayInFrames: 0,
    easing: 'per-tile spring(damping: 12, stiffness: 100) staggered 4 frames',
  },
  placement: fullScenePlacement(120),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      FULL_SCENE_NOTE +
      MEDIA_NOTE +
      'The 3x2 grid flips to 2x3 in portrait formats. ' +
      C8_NOTE,
  },
  previewCompatible: true,
}

export const rveImageCarouselTemplate: RemotionDesignTemplate = {
  id: 'rve-image-carousel',
  name: 'Image Carousel',
  description: 'Three photo cards glide past with your name, headline and offer.',
  category: 'full-scene',
  source: rveSource('image-carousel'),
  component: RveImageCarouselDesign,
  textSlots: [
    BUSINESS_NAME_SLOT,
    { key: 'headline', field: 'headline', label: 'Second card' },
    { key: 'offer', field: 'offer', label: 'Third card' },
  ],
  colors: [
    { role: 'primary', label: 'Cards and background' },
    { role: 'accent', label: 'Card accents' },
    { role: 'text', label: 'Card labels' },
  ],
  media: BRAND_MEDIA,
  animation: {
    durationInFrames: 150,
    delayInFrames: 0,
    easing: 'linear carousel, 2 s per card, depth interpolate [1, 0.75, 0.55]',
  },
  placement: fullScenePlacement(150),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      FULL_SCENE_NOTE +
      MEDIA_NOTE +
      'Card labels are kept on one line and truncated to the card width; the active card is centred ' +
      '(the upstream left-edge offset is corrected by an opt-in prop). ' +
      C8_NOTE,
  },
  previewCompatible: true,
}

export const rveImageComparisonSliderTemplate: RemotionDesignTemplate = {
  id: 'rve-image-comparison-slider',
  name: 'Before & After',
  description: 'A slider sweeps across your photo, wiping grey to full colour.',
  category: 'full-scene',
  source: rveSource('image-comparison-slider'),
  component: RveImageComparisonSliderDesign,
  textSlots: [{ ...BUSINESS_NAME_SLOT, label: '"After" label' }],
  colors: [
    { role: 'primary', label: '"After" panel and background' },
    { role: 'accent', label: 'Slider handle' },
    { role: 'text', label: '"After" label' },
  ],
  media: BRAND_MEDIA,
  animation: {
    durationInFrames: 90,
    delayInFrames: 10,
    easing: 'linear divider sweep 5 % → 95 % (frames 10 → 90)',
  },
  placement: fullScenePlacement(120),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      FULL_SCENE_NOTE +
      MEDIA_NOTE +
      'With a brand image both halves show it: the "before" half through a CSS grayscale filter, the ' +
      '"after" half in colour (the web renderer supports CSS filters and clip-path inset). ' +
      C8_NOTE,
  },
  previewCompatible: true,
}

export const rveImageZoomRevealTemplate: RemotionDesignTemplate = {
  id: 'rve-image-zoom-reveal',
  name: 'Zoom Reveal',
  description: 'Your photo pulls back into focus, then your headline fades in.',
  category: 'full-scene',
  source: rveSource('image-zoom-reveal'),
  component: RveImageZoomRevealDesign,
  textSlots: [{ key: 'headline', field: 'headline', label: 'Caption', primary: true }],
  colors: [
    { role: 'primary', label: 'Image placeholder and background' },
    { role: 'accent', label: 'Background accent' },
    { role: 'text', label: 'Caption colour' },
  ],
  media: BRAND_MEDIA,
  animation: {
    durationInFrames: 60,
    delayInFrames: 0,
    easing: 'interpolate scale 2 → 1 and blur 10 → 0 px over 2 s; caption fades in over the last 40 %',
  },
  placement: fullScenePlacement(120),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      FULL_SCENE_NOTE +
      MEDIA_NOTE +
      'The zoom uses a CSS blur filter (supported by the web renderer; verify in an exported frame). ' +
      'The caption is one line, truncated to the frame width. ' +
      C8_NOTE,
  },
  previewCompatible: true,
}

export const rveKenBurnsTemplate: RemotionDesignTemplate = {
  id: 'rve-ken-burns',
  name: 'Ken Burns',
  description: 'A slow cinematic push-in across your product photo.',
  category: 'full-scene',
  source: rveSource('ken-burns'),
  component: RveKenBurnsDesign,
  textSlots: [{ ...BUSINESS_NAME_SLOT, label: 'Name (shown without a photo)' }],
  colors: [
    { role: 'primary', label: 'Placeholder background' },
    { role: 'accent', label: 'Placeholder accent' },
    { role: 'text', label: 'Placeholder name' },
  ],
  media: BRAND_MEDIA,
  animation: {
    durationInFrames: 150,
    delayInFrames: 0,
    easing: 'ease-out (cubic-bezier 0, 0, 0.58, 1) scale 1 → 1.25 with drift, frame-driven',
  },
  placement: fullScenePlacement(150),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      FULL_SCENE_NOTE +
      MEDIA_NOTE +
      'The upstream CSS @keyframes / styled-jsx animation and <img> were replaced by the same keyframes ' +
      'evaluated per frame and Remotion <Img>, so seeking and export are frame-accurate. The upstream ' +
      'remote unsplash default is never used. ' +
      C8_NOTE,
  },
  previewCompatible: true,
}

export const rveMasonryGalleryTemplate: RemotionDesignTemplate = {
  id: 'rve-masonry-gallery',
  name: 'Masonry Gallery',
  description: 'Your photos stack into a staggered, magazine-style wall.',
  category: 'full-scene',
  source: rveSource('masonry-gallery'),
  component: RveMasonryGalleryDesign,
  textSlots: [BUSINESS_NAME_SLOT],
  colors: [
    { role: 'primary', label: 'Blocks and background' },
    { role: 'accent', label: 'Block accents' },
    { role: 'text', label: 'Placeholder name' },
  ],
  media: BRAND_MEDIA,
  animation: {
    durationInFrames: 60,
    delayInFrames: 0,
    easing: 'per-block spring(damping: 12, stiffness: 100), staggered 0–12 frames',
  },
  placement: fullScenePlacement(120),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      FULL_SCENE_NOTE +
      MEDIA_NOTE +
      'Three columns in landscape and square, two in portrait formats. ' +
      C8_NOTE,
  },
  previewCompatible: true,
}

export const rvePhotoStackTemplate: RemotionDesignTemplate = {
  id: 'rve-photo-stack',
  name: 'Photo Stack',
  description: 'Three framed prints drop onto a pile to open your video.',
  category: 'full-scene',
  source: rveSource('photo-stack'),
  component: RvePhotoStackDesign,
  textSlots: [
    { ...BUSINESS_NAME_SLOT, label: 'Top print caption' },
    { key: 'headline', field: 'headline', label: 'Middle print caption' },
    { key: 'offer', field: 'offer', label: 'Bottom print caption' },
  ],
  colors: [
    { role: 'primary', label: 'Prints and background' },
    { role: 'accent', label: 'Print accents' },
    { role: 'text', label: 'Captions' },
  ],
  media: BRAND_MEDIA,
  animation: {
    durationInFrames: 60,
    delayInFrames: 0,
    easing: 'per-print spring(damping: 12, stiffness: 100) staggered 8 frames',
  },
  placement: fullScenePlacement(120),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      FULL_SCENE_NOTE +
      MEDIA_NOTE +
      'Captions appear on the placeholder prints only (photo prints show the photo edge to edge). ' +
      C8_NOTE,
  },
  previewCompatible: true,
}

export const rveRotatingCarouselTemplate: RemotionDesignTemplate = {
  id: 'rve-rotating-carousel',
  name: 'Feature Carousel',
  description: 'Four feature cards orbit under your business name.',
  category: 'full-scene',
  source: rveSource('rotating-carousel'),
  component: RveRotatingCarouselDesign,
  textSlots: [
    { ...BUSINESS_NAME_SLOT, label: 'Title' },
    { key: 'headline', field: 'headline', label: 'Card 1' },
    { key: 'offer', field: 'offer', label: 'Card 2' },
    { key: 'cta', field: 'cta', label: 'Card 3' },
    { key: 'website', field: 'website', label: 'Card 4' },
  ],
  colors: [
    { role: 'primary', label: 'Cards and background' },
    { role: 'accent', label: 'Card icons and borders' },
    { role: 'text', label: 'Title and labels' },
  ],
  media: BRAND_MEDIA,
  animation: {
    durationInFrames: 150,
    delayInFrames: 0,
    easing: 'constant orbit (0.015 rad/frame), depth interpolate scale [0.6, 1] / opacity [0.3, 1]',
  },
  placement: fullScenePlacement(150),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      FULL_SCENE_NOTE +
      MEDIA_NOTE +
      'Empty card fields fall back to the filled ones (or the business name); every label is one line, ' +
      'truncated to the card width. ' +
      C8_NOTE,
  },
  previewCompatible: true,
}

export const rveZoomPulseTemplate: RemotionDesignTemplate = {
  id: 'rve-zoom-pulse',
  name: 'Zoom Pulse',
  description: 'Your product photo gently breathes in and out, full screen.',
  category: 'full-scene',
  source: rveSource('zoom-pulse'),
  component: RveZoomPulseDesign,
  textSlots: [{ ...BUSINESS_NAME_SLOT, label: 'Name (shown without a photo)' }],
  colors: [
    { role: 'primary', label: 'Placeholder background' },
    { role: 'accent', label: 'Placeholder accent' },
    { role: 'text', label: 'Placeholder name' },
  ],
  media: BRAND_MEDIA,
  animation: {
    durationInFrames: 120,
    delayInFrames: 0,
    easing: 'ease-in-out pulse 1 → 1.1 → 1 over 4 s, frame-driven',
  },
  placement: fullScenePlacement(120),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      FULL_SCENE_NOTE +
      MEDIA_NOTE +
      'The upstream next/image, CSS @keyframes and styled-jsx were replaced by Remotion <Img> and the ' +
      'same keyframes evaluated per frame. The upstream remote pexels default is never used. ' +
      C8_NOTE,
  },
  previewCompatible: true,
}

/* -------------------------------------------------------------------------- */
/* Overlays                                                                    */
/* -------------------------------------------------------------------------- */

export const rvePictureInPictureTemplate: RemotionDesignTemplate = {
  id: 'rve-picture-in-picture',
  name: 'Picture in Picture',
  description: 'A branded photo inset pops into the corner of your video.',
  category: 'other',
  source: rveSource('picture-in-picture'),
  component: RvePictureInPictureDesign,
  textSlots: [{ ...BUSINESS_NAME_SLOT, label: 'Inset caption' }],
  colors: [
    { role: 'primary', label: 'Inset placeholder' },
    { role: 'accent', label: 'Inset accent' },
    { role: 'text', label: 'Caption and border' },
  ],
  media: BRAND_MEDIA,
  animation: {
    durationInFrames: 45,
    delayInFrames: 15,
    easing: 'spring(damping: 12, stiffness: 100) after 15 frames',
  },
  placement: OVERLAY_PLACEMENT,
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Overlay: the canvas and the upstream "main content" panel are transparent, so the customer video ' +
      'is the main picture and only the bottom-right inset is drawn. ' +
      MEDIA_NOTE +
      C8_NOTE,
  },
  previewCompatible: true,
}

export const rvePolaroidFrameTemplate: RemotionDesignTemplate = {
  id: 'rve-polaroid-frame',
  name: 'Polaroid Drop',
  description: 'An instant photo of your product drops onto your video.',
  category: 'other',
  source: rveSource('polaroid-frame'),
  component: RvePolaroidFrameDesign,
  textSlots: [{ ...BUSINESS_NAME_SLOT, label: 'Caption' }],
  colors: [
    { role: 'primary', label: 'Photo placeholder' },
    { role: 'accent', label: 'Placeholder accent' },
    { role: 'text', label: 'Placeholder name' },
  ],
  media: BRAND_MEDIA,
  animation: {
    durationInFrames: 60,
    delayInFrames: 0,
    easing: 'spring(damping: 10, stiffness: 80) drop with 8° → -3° tilt',
  },
  placement: OVERLAY_PLACEMENT,
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Overlay: the upstream slate canvas is transparent, so the print lands on the customer video. ' +
      'The caption is one line, truncated to the photo width. ' +
      MEDIA_NOTE +
      C8_NOTE,
  },
  previewCompatible: true,
}

export const rveLiquidWaveTemplate: RemotionDesignTemplate = {
  id: 'rve-liquid-wave',
  name: 'Liquid Wave',
  description: 'A soft wave in your brand colours rolls along the bottom of your video.',
  category: 'visual-effect',
  source: rveSource('liquid-wave'),
  component: RveLiquidWaveDesign,
  textSlots: [],
  colors: [
    { role: 'primary', label: 'Wave start' },
    { role: 'accent', label: 'Wave end' },
  ],
  media: [],
  animation: {
    durationInFrames: 126,
    delayInFrames: 0,
    easing: 'sine wave, period 2π × 20 frames (seamless loop)',
  },
  placement: OVERLAY_PLACEMENT,
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Overlay: transparent canvas; the wave baseline sits at 80 % of the height. Inline SVG path with a ' +
      'CSS blur filter (supported by the web renderer; verify in an exported frame). The upstream SVG ' +
      'gradient id "gradient" is replaced per instance (React useId), so there is no fixed-id ' +
      'one-instance constraint. ' +
      C8_NOTE,
  },
  previewCompatible: true,
}

export const rveMatrixRainTemplate: RemotionDesignTemplate = {
  id: 'rve-matrix-rain',
  name: 'Matrix Rain',
  description: 'Glowing code rains down over your video in your brand colours.',
  category: 'visual-effect',
  source: rveSource('matrix-rain'),
  component: RveMatrixRainDesign,
  textSlots: [],
  colors: [
    { role: 'text', label: 'Glyph colour' },
    { role: 'primary', label: 'Glyph glow' },
  ],
  media: [],
  animation: {
    durationInFrames: 150,
    delayInFrames: 0,
    easing: 'constant fall (seeded speed 5–10 px/frame), wraps continuously',
  },
  placement: OVERLAY_PLACEMENT,
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Overlay: the upstream navy gradient canvas is transparent. Inline text glyphs with a text-shadow ' +
      'glow only — no filters, no external assets. The glyph layout is seeded (Remotion random), so ' +
      'every render is identical. ' +
      C8_NOTE,
  },
  previewCompatible: true,
}

export const rveParticleExplosionTemplate: RemotionDesignTemplate = {
  id: 'rve-particle-explosion',
  name: 'Particle Burst',
  description: 'Your offer pops in as a ring of brand-colour particles bursts out.',
  category: 'visual-effect',
  source: rveSource('particle-explosion'),
  component: RveParticleExplosionDesign,
  textSlots: [{ key: 'offer', field: 'offer', label: 'Burst text', primary: true }],
  colors: [
    { role: 'primary', label: 'Particles and glow' },
    { role: 'accent', label: 'Particle accents' },
    { role: 'text', label: 'Burst text' },
  ],
  media: [],
  animation: {
    durationInFrames: 90,
    delayInFrames: 0,
    easing: 'spring(mass: 0.3/0.4, damping: 12/10) burst; particles fade over 90 frames',
  },
  placement: OVERLAY_PLACEMENT,
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Overlay: the upstream root is already transparent. 150 small divs with box-shadow only — no ' +
      'filters, no external assets. The text stays after the particles fade; it is one line, ' +
      'truncated to the canvas width. ' +
      C8_NOTE,
  },
  previewCompatible: true,
}

/** Batch 3h designs, in registration order. */
export const BATCH_3H_TEMPLATES: RemotionDesignTemplate[] = [
  rveGalleryGridTemplate,
  rveImageCarouselTemplate,
  rveImageComparisonSliderTemplate,
  rveImageZoomRevealTemplate,
  rveKenBurnsTemplate,
  rveMasonryGalleryTemplate,
  rvePhotoStackTemplate,
  rvePictureInPictureTemplate,
  rvePolaroidFrameTemplate,
  rveRotatingCarouselTemplate,
  rveZoomPulseTemplate,
  rveLiquidWaveTemplate,
  rveMatrixRainTemplate,
  rveParticleExplosionTemplate,
]

/**
 * Batch 3h designs that hardcode SVG ids (one instance per composition).
 *
 * Empty on purpose: the only batch-3h upstream with an SVG id is
 * `liquid-wave` (`<linearGradient id="gradient">`), and its edited copy takes
 * the id as a prop which the adapter fills with a per-instance `useId()`
 * value — so no batch-3h design renders a fixed id.
 */
export const BATCH_3H_FIXED_SVG_IDS: Record<string, string[]> = {}
