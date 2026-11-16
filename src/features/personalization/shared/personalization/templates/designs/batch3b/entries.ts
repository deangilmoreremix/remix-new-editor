/**
 * Phase 4 porting batch 3b: catalog entries for upstream Remotion templates.
 * Exports ready-to-register entries; `../../catalog.ts` registers them.
 *
 * All thirteen come from repo 1 (`free-remotion-templates`, MIT, © 2026
 * Trimora Inc. / RenderComp). The six pixel-art templates share the upstream
 * `pixel-kit` helper, copied verbatim to `../../_upstream/pixel-kit/`.
 *
 * Classification:
 *  - pixel scenes that paint their own background → `full-scene` /
 *    `data-visualization` intro cards with an `endFrame`;
 *  - transitions → intro reveals: a brand card on the "before" side, the
 *    customer's video on the "after" side where the upstream allows it (see
 *    each entry's notes for the ones that cannot be made transparent).
 */
import type { RemotionDesignTemplate } from '../../types'
import { CameraShakeDesign, CAMERA_SHAKE_END_FRAME } from './CameraShakeDesign'
import { CardFlipTransitionDesign, CARD_FLIP_END_FRAME } from './CardFlipTransitionDesign'
import { FlipPageTransitionDesign, FLIP_PAGE_END_FRAME } from './FlipPageTransitionDesign'
import { FourToneMonoTitlerDesign } from './FourToneMonoTitlerDesign'
import { InkSpreadTransitionDesign, INK_END_FRAME } from './InkSpreadTransitionDesign'
import { PixelCandlestickOhlcDesign } from './PixelCandlestickOhlcDesign'
import { PixelMosaicTransitionDesign, MOSAIC_END_FRAME } from './PixelMosaicTransitionDesign'
import { PixelTypewriterQuoteDesign } from './PixelTypewriterQuoteDesign'
import { PixelWaterfallCycleDesign } from './PixelWaterfallCycleDesign'
import { PouroverDripFillGaugeDesign } from './PouroverDripFillGaugeDesign'
import { SlideWipeDesign, SLIDE_WIPE_END_FRAME } from './SlideWipeDesign'
import { CIRCLE_WIPE_END_FRAME, TransitionCircleWipeDesign } from './TransitionCircleWipeDesign'
import { WHIP_PAN_DURATION, WhipPanDesign } from './WhipPanDesign'
import { repo1Source } from './shared'

const ALL_RATIOS: RemotionDesignTemplate['aspectRatios'] = ['16:9', '9:16', '1:1', '4:5']

const PIXEL_NOTE =
  'Pixel art is drawn at a low internal resolution and upscaled with image-rendering: pixelated; ' +
  'the CRT skin uses mix-blend-mode and an feTurbulence noise filter, which should be checked in an exported frame.'

export const fourToneMonoTitlerTemplate: RemotionDesignTemplate = {
  id: 'four-tone-mono-titler',
  name: 'Retro Handheld Title',
  description: 'A four-tone retro game title card that wipes in with your headline.',
  category: 'full-scene',
  source: repo1Source('src/components/four-tone-mono-titler/FourToneMonoTitler.tsx'),
  component: FourToneMonoTitlerDesign,
  textSlots: [
    { key: 'headline', field: 'headline', label: 'Title', primary: true, maxLength: 17 },
    { key: 'businessName', field: 'businessName', label: 'Subtitle', maxLength: 34 },
  ],
  colors: [
    { role: 'primary', label: 'Screen tones' },
    { role: 'accent', label: 'Title tones' },
  ],
  media: [],
  animation: { durationInFrames: 120, delayInFrames: 0, easing: 'easeInOutCubic hard-edged wipe + shimmer' },
  placement: { x: 0.5, y: 0.5, scale: 1, opacity: 1, animation: 'none', endFrame: 120 },
  aspectRatios: ['16:9', '1:1'],
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: inline SVG rects only, no media, no filters. The upstream paints ' +
      'its darkest tone over the whole canvas, so it plays as a full-screen intro card (120 frames). The 5x7 ' +
      'bitmap font never wraps: the title is cut to 17 characters and the subtitle to 34; unsupported ' +
      'characters become spaces. The 480x270 scene is letterboxed on square canvases.',
  },
  previewCompatible: true,
}

export const pixelTypewriterQuoteTemplate: RemotionDesignTemplate = {
  id: 'pixel-typewriter-quote',
  name: 'Pixel Typewriter Quote',
  description: 'Your message types out letter by letter in retro pixel type.',
  category: 'full-scene',
  source: repo1Source('src/components/pixel-typewriter-quote/PixelTypewriterQuote.tsx'),
  component: PixelTypewriterQuoteDesign,
  textSlots: [
    { key: 'headline', field: 'headline', label: 'Quote', primary: true, maxLength: 84 },
    { key: 'businessName', field: 'businessName', label: 'Attribution', maxLength: 28 },
  ],
  colors: [
    { role: 'primary', label: 'Background' },
    { role: 'accent', label: 'Cursor and quote marks' },
    { role: 'text', label: 'Ink' },
  ],
  media: [],
  animation: { durationInFrames: 150, delayInFrames: 0, easing: 'linear character reveal (cps)' },
  placement: { x: 0.5, y: 0.5, scale: 1, opacity: 1, animation: 'none', endFrame: 150 },
  aspectRatios: ['16:9', '1:1'],
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path as a full-screen intro card (150 frames). ' + PIXEL_NOTE +
      ' The quote is wrapped at 21 characters and kept to four lines; the typing speed rises for long text so it ' +
      'finishes by frame ~120. The pixel-kit dither pattern uses the fixed SVG id "bayer4" and the noise filter "px-noise".',
  },
  previewCompatible: true,
}

export const pixelMosaicTransitionTemplate: RemotionDesignTemplate = {
  id: 'pixel-mosaic-transition',
  name: 'Pixel Mosaic Reveal',
  description: 'A brand-coloured pixel scene breaks into chunky blocks and dissolves into your video.',
  category: 'transition',
  source: repo1Source('src/components/pixel-mosaic-transition/PixelMosaicTransition.tsx'),
  component: PixelMosaicTransitionDesign,
  textSlots: [],
  colors: [
    { role: 'primary', label: 'Sky' },
    { role: 'accent', label: 'Sun' },
  ],
  media: [],
  animation: { durationInFrames: MOSAIC_END_FRAME, delayInFrames: 0, easing: 'eased cell-size sweep, then fade' },
  placement: { x: 0.5, y: 0.5, scale: 1, opacity: 1, animation: 'none', endFrame: MOSAIC_END_FRAME },
  aspectRatios: ['16:9', '1:1'],
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path. ' + PIXEL_NOTE + ' The upstream swaps between two opaque procedural ' +
      'screens; the adapter plays brand screen A until the swap, freezes it at peak coarseness and fades the ' +
      'mosaic out over 12 frames to reveal the video, so screen B is never shown. The upstream\'s first 8 frames ' +
      '(1-3 px blocks, up to ~130k SVG rects per frame) are skipped so the preview stays responsive; the first ' +
      'frames still draw ~8k rects. Fixed SVG ids "bayer4" and "px-noise".',
  },
  previewCompatible: true,
}

export const pouroverDripFillGaugeTemplate: RemotionDesignTemplate = {
  id: 'pourover-drip-fill-gauge',
  name: 'Pour-Over Fill Gauge',
  description: 'A retro pixel pour-over fills up to 100% in your brand colours.',
  category: 'data-visualization',
  source: repo1Source('src/components/pourover-drip-fill-gauge/PouroverDripFillGauge.tsx'),
  component: PouroverDripFillGaugeDesign,
  textSlots: [],
  colors: [
    { role: 'primary', label: 'Background and liquid' },
    { role: 'accent', label: 'Highlights and readout' },
  ],
  media: [],
  animation: { durationInFrames: 150, delayInFrames: 0, easing: 'smoothstep fill (fillSpeed 0.6)' },
  placement: { x: 0.5, y: 0.5, scale: 1, opacity: 1, animation: 'none', endFrame: 150 },
  aspectRatios: ['16:9', '1:1'],
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path as a full-screen intro card (150 frames). ' + PIXEL_NOTE +
      ' The 0-100% readout is a self-running animation, not customer data; the "VOLUME" and "FULL" labels are ' +
      'upstream text. Fixed SVG ids "bayer4" and "px-noise".',
  },
  previewCompatible: true,
}

export const pixelCandlestickOhlcTemplate: RemotionDesignTemplate = {
  id: 'pixel-candlestick-ohlc',
  name: 'Pixel Candlestick Chart',
  description: 'An 8-bit market chart builds candle by candle under your name.',
  category: 'data-visualization',
  source: repo1Source('src/components/pixel-candlestick-ohlc/PixelCandlestickOhlc.tsx'),
  component: PixelCandlestickOhlcDesign,
  textSlots: [{ key: 'businessName', field: 'businessName', label: 'Chart label', primary: true, maxLength: 16 }],
  colors: [
    { role: 'primary', label: 'Panel and grid' },
    { role: 'accent', label: 'Header' },
  ],
  media: [],
  animation: { durationInFrames: 150, delayInFrames: 0, easing: 'column-by-column pop (ease-out quad)' },
  placement: { x: 0.5, y: 0.5, scale: 1, opacity: 1, animation: 'none', endFrame: 150 },
  aspectRatios: ['16:9', '1:1'],
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path as a full-screen intro card (150 frames). ' + PIXEL_NOTE +
      ' The candles, the dollar price and the UP/DOWN percentage come from the upstream\'s seeded sample series — ' +
      'they are ILLUSTRATIVE, not real market data, and cannot be changed. Fixed SVG ids "bayer4" and "px-noise".',
  },
  previewCompatible: true,
}

export const pixelWaterfallCycleTemplate: RemotionDesignTemplate = {
  id: 'pixel-waterfall-cycle',
  name: 'Pixel Waterfall',
  description: 'A shimmering retro pixel waterfall opens your video.',
  category: 'full-scene',
  source: repo1Source('src/components/pixel-waterfall-cycle/PixelWaterfallCycle.tsx'),
  component: PixelWaterfallCycleDesign,
  textSlots: [],
  colors: [
    { role: 'primary', label: 'Sky and cliffs' },
    { role: 'accent', label: 'Foam' },
  ],
  media: [],
  animation: { durationInFrames: 120, delayInFrames: 0, easing: 'colour-cycled water (seamless loop)' },
  placement: { x: 0.5, y: 0.5, scale: 1, opacity: 1, animation: 'none', endFrame: 120 },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path as a full-screen intro card (120 frames). ' + PIXEL_NOTE +
      ' The scene is portrait (360x640): it fills 9:16; on 16:9, 1:1 and 4:5 it is a centred portrait panel on ' +
      'the sky colour. The water colours are the upstream\'s fixed blue ramp. Fixed SVG ids "bayer4" and "px-noise".',
  },
  previewCompatible: true,
}

export const cardFlipTransitionTemplate: RemotionDesignTemplate = {
  id: 'card-flip-transition',
  name: 'Card Flip Reveal',
  description: 'A branded card with your name flips over to reveal your video.',
  category: 'transition',
  source: repo1Source('src/components/card-flip-transition/CardFlipTransition.tsx'),
  component: CardFlipTransitionDesign,
  textSlots: [{ key: 'businessName', field: 'businessName', label: 'Card label', primary: true }],
  colors: [
    { role: 'primary', label: 'Card colour' },
    { role: 'text', label: 'Label colour' },
  ],
  media: [],
  animation: { durationInFrames: CARD_FLIP_END_FRAME, delayInFrames: 30, easing: 'Easing.inOut(Easing.ease) rotateY 0→180°' },
  placement: { x: 0.5, y: 0.5, scale: 1, opacity: 1, animation: 'none', endFrame: CARD_FLIP_END_FRAME },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path if the renderer supports CSS 3D transforms (perspective, ' +
      'preserve-3d, backface-visibility) and a blur filter on the contact shadow — verify in an exported frame. ' +
      'The back face and backdrop are transparent, so the card flips onto the video; the layer ends at frame 75.',
  },
  previewCompatible: true,
}

export const transitionCircleWipeTemplate: RemotionDesignTemplate = {
  id: 'transition-circle-wipe',
  name: 'Circle Wipe Reveal',
  description: 'An accent-ringed circle opens from the centre of your brand card to reveal your video.',
  category: 'transition',
  source: repo1Source('src/components/transition-circle-wipe/TransitionCircleWipe.tsx'),
  component: TransitionCircleWipeDesign,
  textSlots: [{ key: 'businessName', field: 'businessName', label: 'Card label', primary: true }],
  colors: [
    { role: 'primary', label: 'Card colour' },
    { role: 'accent', label: 'Ring colour' },
    { role: 'text', label: 'Label colour' },
  ],
  media: [],
  animation: { durationInFrames: CIRCLE_WIPE_END_FRAME, delayInFrames: 9, easing: 'Easing.inOut(Easing.cubic) iris' },
  placement: { x: 0.5, y: 0.5, scale: 1, opacity: 1, animation: 'none', endFrame: CIRCLE_WIPE_END_FRAME },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path if the renderer supports CSS clip-path circle() and mask-image ' +
      'radial-gradient — verify in an exported frame. The upstream reveals an opaque second scene; the adapter ' +
      'masks the inside of the iris (from the upstream\'s own iris maths) so the circle opens onto the video, with ' +
      'the accent ring riding its edge. Timing is pinned to 60 frames.',
  },
  previewCompatible: true,
}

export const inkSpreadTransitionTemplate: RemotionDesignTemplate = {
  id: 'ink-spread-transition',
  name: 'Ink Spread Intro',
  description: 'Ink bleeds across your brand card, your headline brushes in, then it melts into your video.',
  category: 'transition',
  source: repo1Source('src/components/ink-spread-transition/InkSpreadTransition.tsx'),
  component: InkSpreadTransitionDesign,
  textSlots: [
    { key: 'businessName', field: 'businessName', label: 'First card', primary: true },
    { key: 'headline', field: 'headline', label: 'Second card' },
  ],
  colors: [
    { role: 'primary', label: 'Card colour' },
    { role: 'accent', label: 'Ink colour (deep shade)' },
    { role: 'text', label: 'First label colour' },
  ],
  media: [],
  animation: { durationInFrames: INK_END_FRAME, delayInFrames: 14, easing: 'Easing.inOut(Easing.ease) ink spread' },
  placement: { x: 0.5, y: 0.5, scale: 1, opacity: 1, animation: 'none', endFrame: INK_END_FRAME },
  aspectRatios: ['16:9'],
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path only if the renderer supports SVG filters (feGaussianBlur, ' +
      'feTurbulence, feDisplacementMap) — verify in an exported frame. The ink is painted in the after colour and ' +
      'the after label in the before colour, so neither side can be transparent: it plays as a branded two-card ' +
      'intro that fades into the video (frames 70-84). Fixed SVG ids "ink-bleed" and "ink-core". 16:9 only: the ' +
      '220 px labels leave ~6 characters per line on narrower canvases.',
  },
  previewCompatible: true,
}

export const flipPageTransitionTemplate: RemotionDesignTemplate = {
  id: 'flip-page-transition',
  name: 'Page Turn Reveal',
  description: 'Your branded title page turns like a book page to reveal your video.',
  category: 'transition',
  source: repo1Source('src/components/flip-page-transition/FlipPageTransition.tsx'),
  component: FlipPageTransitionDesign,
  textSlots: [{ key: 'businessName', field: 'businessName', label: 'Page label', primary: true }],
  colors: [
    { role: 'primary', label: 'Page colour' },
    { role: 'text', label: 'Label colour' },
  ],
  media: [],
  animation: { durationInFrames: FLIP_PAGE_END_FRAME, delayInFrames: 14, easing: 'Easing.inOut(Easing.ease) rotateY 0→90°' },
  placement: { x: 0.5, y: 0.5, scale: 1, opacity: 1, animation: 'none', endFrame: FLIP_PAGE_END_FRAME },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path if the renderer supports CSS 3D transforms (perspective, rotateY, ' +
      'backface-visibility) — verify in an exported frame. The page underneath is transparent, so the page turns ' +
      'onto the video; the layer ends at frame 75.',
  },
  previewCompatible: true,
}

export const slideWipeTemplate: RemotionDesignTemplate = {
  id: 'slide-wipe',
  name: 'Slide Wipe Reveal',
  description: 'Your branded title card slides away to reveal your video.',
  category: 'transition',
  source: repo1Source('src/components/slide-wipe/SlideWipe.tsx'),
  component: SlideWipeDesign,
  textSlots: [{ key: 'businessName', field: 'businessName', label: 'Card label', primary: true }],
  colors: [
    { role: 'primary', label: 'Card colour' },
    { role: 'text', label: 'Label colour' },
  ],
  media: [],
  animation: { durationInFrames: SLIDE_WIPE_END_FRAME, delayInFrames: 30, easing: 'Easing.inOut(Easing.ease) translateX' },
  placement: { x: 0.5, y: 0.5, scale: 1, opacity: 1, animation: 'none', endFrame: SLIDE_WIPE_END_FRAME },
  aspectRatios: ['16:9', '1:1'],
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: translateX only, no filters or media. The incoming page and the ' +
      'backdrop are transparent, so the card slides off onto the video; the layer ends at frame 75. The label ' +
      'scales with the canvas height, so tall formats are not offered.',
  },
  previewCompatible: true,
}

export const whipPanTemplate: RemotionDesignTemplate = {
  id: 'whip-pan',
  name: 'Whip Pan Intro',
  description: 'Two bold title cards whip past with motion blur before your video starts.',
  category: 'transition',
  source: repo1Source('src/components/whip-pan/WhipPan.tsx'),
  component: WhipPanDesign,
  textSlots: [
    { key: 'businessName', field: 'businessName', label: 'First title', primary: true },
    { key: 'headline', field: 'headline', label: 'First subtitle' },
    { key: 'offer', field: 'offer', label: 'Second title' },
    { key: 'cta', field: 'cta', label: 'Second subtitle' },
  ],
  colors: [
    { role: 'primary', label: 'First card' },
    { role: 'accent', label: 'Second card (deep shade)' },
    { role: 'text', label: 'Text colour' },
  ],
  media: [],
  animation: { durationInFrames: WHIP_PAN_DURATION, delayInFrames: 0, easing: 'Easing.inOut(Easing.cubic) pan + sin blur' },
  placement: { x: 0.5, y: 0.5, scale: 1, opacity: 1, animation: 'none', endFrame: WHIP_PAN_DURATION },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path if the renderer supports a CSS blur filter (the motion blur) — verify ' +
      'in an exported frame. Not a true two-clip transition: the upstream pans between its own scenes over a ' +
      'hard-coded black root, so it is adapted as a whipping two-card title intro that fades into the video ' +
      '(frames 76-90). Timing is pinned to 90 frames.',
  },
  previewCompatible: true,
}

export const cameraShakeTemplate: RemotionDesignTemplate = {
  id: 'camera-shake',
  name: 'Impact Shake Intro',
  description: 'Your headline lands with a punchy camera shake, then reveals your video.',
  category: 'transition',
  source: repo1Source('src/components/camera-shake/CameraShake.tsx'),
  component: CameraShakeDesign,
  textSlots: [
    { key: 'headline', field: 'headline', label: 'Title', primary: true },
    { key: 'businessName', field: 'businessName', label: 'Subtitle' },
  ],
  colors: [
    { role: 'primary', label: 'Card colour (deep shade)' },
    { role: 'accent', label: 'Frame and rays' },
    { role: 'text', label: 'Title colour' },
  ],
  media: [],
  animation: { durationInFrames: CAMERA_SHAKE_END_FRAME, delayInFrames: 27, easing: 'Easing.out(Easing.cubic) decaying shake' },
  placement: { x: 0.5, y: 0.5, scale: 1, opacity: 1, animation: 'none', endFrame: CAMERA_SHAKE_END_FRAME },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: transforms, opacity and inline SVG lines only. Not a true two-clip ' +
      'transition: the upstream shakes its own title card over a hard-coded black root, so it is adapted as an ' +
      'impact title intro that fades up from black, shakes on impact (0.9 s) and fades into the video (frames 78-90).',
  },
  previewCompatible: true,
}

/** Batch 3b designs, in registration order. */
export const BATCH_3B_TEMPLATES: RemotionDesignTemplate[] = [
  fourToneMonoTitlerTemplate,
  pixelTypewriterQuoteTemplate,
  pixelMosaicTransitionTemplate,
  pouroverDripFillGaugeTemplate,
  pixelCandlestickOhlcTemplate,
  pixelWaterfallCycleTemplate,
  cardFlipTransitionTemplate,
  transitionCircleWipeTemplate,
  inkSpreadTransitionTemplate,
  flipPageTransitionTemplate,
  slideWipeTemplate,
  whipPanTemplate,
  cameraShakeTemplate,
]

/** Batch 3b designs that hardcode SVG ids (one instance per composition). */
export const BATCH_3B_FIXED_SVG_IDS: Record<string, string[]> = {
  'pixel-typewriter-quote': ['bayer4', 'px-noise'],
  'pixel-mosaic-transition': ['bayer4', 'px-noise'],
  'pourover-drip-fill-gauge': ['bayer4', 'px-noise'],
  'pixel-candlestick-ohlc': ['bayer4', 'px-noise'],
  'pixel-waterfall-cycle': ['bayer4', 'px-noise'],
  'ink-spread-transition': ['ink-bleed', 'ink-core'],
}
