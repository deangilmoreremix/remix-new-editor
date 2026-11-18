/**
 * Phase 4 porting batch 3c: catalog entries for upstream Remotion templates.
 * Exports ready-to-register entries; `../../catalog.ts` registers them.
 *
 * All ten come from repo 1 (`free-remotion-templates`, MIT, © 2026 Trimora
 * Inc. / RenderComp). The upstream copies in `../../_upstream/<id>/` are
 * verbatim apart from their provenance header; the adapters in this folder map
 * the customer's brand data onto the upstream props.
 *
 * Classification:
 *  - `data-visualization` (line-chart-anim, kpi-counter, racing-chart) and
 *    `full-scene` (character-jumping, thinking-bubble, wave-hello,
 *    parallax-pan) keep a designed, brand-driven background, sit full-frame
 *    and play as an intro card (`placement.endFrame`) before the video shows.
 *  - `visual-effect` overlays (fireworks-burst, loop-grid-wave,
 *    particle-snow) force the canvas fill to `transparent` and stay for the
 *    whole clip.
 *
 * Full-frame placements use `animation: 'none'` and `opacity: 1` (the catalog
 * rule for any design at scale 1).
 */
import type { RemotionDesignTemplate } from '../../types'
import { CharacterJumpingDesign } from './CharacterJumpingDesign'
import { FireworksBurstDesign } from './FireworksBurstDesign'
import { KpiCounterDesign, KPI_PLACEHOLDER_METRICS } from './KpiCounterDesign'
import { LineChartAnimDesign, LINE_CHART_PLACEHOLDER_POINTS } from './LineChartAnimDesign'
import { LoopGridWaveDesign } from './LoopGridWaveDesign'
import { ParallaxPanDesign } from './ParallaxPanDesign'
import { ParticleSnowDesign } from './ParticleSnowDesign'
import { RacingChartDesign } from './RacingChartDesign'
import { ThinkingBubbleDesign } from './ThinkingBubbleDesign'
import { WaveHelloDesign } from './WaveHelloDesign'
import { repo1Source } from './batch3cShared'

const ALL_RATIOS: RemotionDesignTemplate['aspectRatios'] = ['16:9', '9:16', '1:1', '4:5']

/** Placement of an intro card that covers the frame and then reveals the video. */
function introCard(endFrame: number): RemotionDesignTemplate['placement'] {
  return { x: 0.5, y: 0.5, scale: 1, opacity: 1, animation: 'none', endFrame }
}

/** Placement of a full-frame overlay that stays for the whole clip. */
const FULL_FRAME_OVERLAY: RemotionDesignTemplate['placement'] = {
  x: 0.5,
  y: 0.5,
  scale: 1,
  opacity: 1,
  animation: 'none',
}

export const lineChartAnimTemplate: RemotionDesignTemplate = {
  id: 'line-chart-anim',
  name: 'Animated Line Chart',
  description: 'A trend line draws itself across a branded chart card.',
  category: 'data-visualization',
  source: repo1Source('src/components/line-chart-anim/LineChartAnim.tsx'),
  component: LineChartAnimDesign,
  defaultProps: {
    // PINNED ILLUSTRATIVE DATA: the customer cannot enter chart data.
    points: LINE_CHART_PLACEHOLDER_POINTS,
  },
  textSlots: [
    { key: 'title', field: 'headline', label: 'Chart title', primary: true, maxLength: 48 },
    { key: 'subtitle', field: 'offer', label: 'Chart subtitle', maxLength: 64 },
  ],
  colors: [
    { role: 'primary', label: 'Card background' },
    { role: 'accent', label: 'Line colour' },
    { role: 'text', label: 'Title colour' },
  ],
  media: [],
  animation: { durationInFrames: 150, delayInFrames: 0, easing: 'Easing.inOut(Easing.cubic) line draw' },
  placement: introCard(150),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: inline SVG stroke-dashoffset and interpolate only. Plays as ' +
      'a 150-frame intro card on a deep shade of the brand primary (the upstream paints its axis labels ' +
      'white, so it needs a dark panel), then reveals the video. Mapping: headline = chart title, offer = ' +
      'subtitle, accent = line. The six points are a pinned illustrative upward trend labelled "Wk 1".."Wk 6" ' +
      '(the chart shows no y values); the upstream demo data is never used.',
  },
  previewCompatible: true,
}

export const kpiCounterTemplate: RemotionDesignTemplate = {
  id: 'kpi-counter',
  name: 'KPI Counter Cards',
  description: 'Metric cards slide in and count up on rolling digits.',
  category: 'data-visualization',
  source: repo1Source('src/components/kpi-counter/KpiCounter.tsx'),
  component: KpiCounterDesign,
  defaultProps: {
    // PINNED PLACEHOLDER METRICS (C13): labelled "Placeholder 1".."4".
    metrics: KPI_PLACEHOLDER_METRICS,
  },
  textSlots: [
    { key: 'title', field: 'headline', label: 'Title', primary: true, maxLength: 40 },
    { key: 'subtitle', field: 'offer', label: 'Subtitle', maxLength: 64 },
  ],
  colors: [
    { role: 'primary', label: 'Card background' },
    { role: 'accent', label: 'Highlight colour' },
    { role: 'text', label: 'Number colour' },
  ],
  media: [],
  animation: { durationInFrames: 120, delayInFrames: 0, easing: 'spring card slide + Easing.out(Easing.cubic) odometer' },
  placement: introCard(120),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path (spring, flex/grid, overflow-hidden digit drums). CONDITIONAL ' +
      'details: the drums fade at their edges with mask-image and the header glow is a radial-gradient; ' +
      'if the web renderer skips either, the digits and cards still render. Plays as a 120-frame intro ' +
      'card on deep shades of the brand primary. Mapping: headline = title, offer = subtitle, card ' +
      'accents cycle accent/primary tints. The four figures are PINNED PLACEHOLDERS labelled ' +
      '"Placeholder 1".."4" because the customer cannot enter metrics; the upstream demo figures are never used.',
  },
  previewCompatible: true,
}

export const racingChartTemplate: RemotionDesignTemplate = {
  id: 'racing-chart',
  name: 'Racing Bar Chart',
  description: 'Bars race and swap places on a branded chart card.',
  category: 'data-visualization',
  source: repo1Source('src/components/racing-chart/RacingChart.tsx'),
  component: RacingChartDesign,
  textSlots: [{ key: 'title', field: 'headline', label: 'Chart title', primary: true, maxLength: 48 }],
  colors: [
    { role: 'primary', label: 'Card background' },
    { role: 'accent', label: 'Bar colours' },
    { role: 'text', label: 'Title colour' },
  ],
  media: [],
  animation: { durationInFrames: 150, delayInFrames: 0, easing: 'linear step interpolation, rank reorder' },
  placement: introCard(150),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: absolutely positioned divs and interpolate only. Plays as a ' +
      '150-frame intro card on a deep shade of the brand primary (the upstream paints bar labels white). ' +
      'Mapping: headline = chart title; bars use accent/primary and their tints. The five series are ' +
      'PINNED PLACEHOLDERS labelled "Placeholder A".."E"; the upstream demo series are never used.',
  },
  previewCompatible: true,
}

export const characterJumpingTemplate: RemotionDesignTemplate = {
  id: 'character-jumping',
  name: 'Jumping Character',
  description: 'A cheerful character bounces in your brand colours above your headline.',
  category: 'full-scene',
  source: repo1Source('src/components/character-jumping/CharacterJumping.tsx'),
  component: CharacterJumpingDesign,
  textSlots: [{ key: 'label', field: 'headline', label: 'Label', primary: true, maxLength: 32 }],
  colors: [
    { role: 'primary', label: 'Character and backdrop' },
    { role: 'accent', label: 'Sparkles' },
  ],
  media: [],
  animation: { durationInFrames: 120, delayInFrames: 0, easing: 'parabolic jumps with squash-and-stretch' },
  placement: introCard(120),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: inline SVG shapes and transforms only. A full scene: plays as a ' +
      '120-frame intro card on a pale tint of the brand primary, then reveals the video. Mapping: headline = ' +
      'label (truncated to fit the width), primary = character/backdrop, accent = sparkles.',
  },
  previewCompatible: true,
}

export const thinkingBubbleTemplate: RemotionDesignTemplate = {
  id: 'thinking-bubble',
  name: 'Thinking Character',
  description: 'A character ponders while your headline appears in a thought bubble.',
  category: 'full-scene',
  source: repo1Source('src/components/thinking-bubble/ThinkingBubble.tsx'),
  component: ThinkingBubbleDesign,
  textSlots: [{ key: 'thought', field: 'headline', label: 'Thought', primary: true, maxLength: 48 }],
  colors: [
    { role: 'primary', label: 'Character colour' },
    { role: 'accent', label: 'Thinking dots' },
  ],
  media: [],
  animation: { durationInFrames: 120, delayInFrames: 0, easing: 'spring bubble pop + looping dot blink' },
  placement: introCard(120),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: inline SVG and spring only. A full scene: plays as a 120-frame ' +
      'intro card, then reveals the video. The backdrop is pinned to the upstream off-white #fafaf9 because ' +
      'the upstream only draws dark pupils on that exact colour; the brand drives the character (primary), ' +
      'ground tint, bubble outline and dots (accent). Mapping: headline = thought line.',
  },
  previewCompatible: true,
}

export const waveHelloTemplate: RemotionDesignTemplate = {
  id: 'wave-hello',
  name: 'Waving Welcome',
  description: 'A friendly character waves hello next to your business name.',
  category: 'full-scene',
  source: repo1Source('src/components/wave-hello/WaveHello.tsx'),
  component: WaveHelloDesign,
  textSlots: [
    { key: 'title', field: 'businessName', label: 'Greeting', primary: true, maxLength: 22 },
    { key: 'subtitle', field: 'headline', label: 'Subline', maxLength: 48 },
  ],
  colors: [{ role: 'primary', label: 'Shirt and backdrop' }],
  media: [],
  animation: { durationInFrames: 90, delayInFrames: 0, easing: 'spring entrance + sine wave arm' },
  placement: introCard(90),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: inline SVG and spring only. A full scene: plays as a 90-frame ' +
      'intro card on a pale tint of the brand primary, then reveals the video. Mapping: business name = ' +
      'greeting, headline = subline; greeting and legs use a deep shade of the primary. The skin keeps ' +
      "the upstream's cartoon yellow. In portrait/square the text column is narrow, so the greeting wraps.",
  },
  previewCompatible: true,
}

export const parallaxPanTemplate: RemotionDesignTemplate = {
  id: 'parallax-pan',
  name: 'Parallax Landscape',
  description: 'A layered mountain landscape pans behind your headline.',
  category: 'full-scene',
  source: repo1Source('src/components/parallax-pan/ParallaxPan.tsx'),
  component: ParallaxPanDesign,
  textSlots: [
    { key: 'title', field: 'headline', label: 'Headline', primary: true, maxLength: 40 },
    { key: 'subtitle', field: 'businessName', label: 'Subline', maxLength: 56 },
  ],
  colors: [
    { role: 'primary', label: 'Sky and hills' },
    { role: 'accent', label: 'Horizon glow' },
    { role: 'text', label: 'Headline colour' },
  ],
  media: [],
  animation: { durationInFrames: 120, delayInFrames: 0, easing: 'linear multi-layer pan, Easing.out(Easing.cubic) text' },
  placement: introCard(120),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: inline SVG polygons, linear-gradient sky and translateX layers. ' +
      'CONDITIONAL detail: the sun is a radial-gradient, which the web renderer may skip (the landscape ' +
      'still renders). A full scene: plays as a 120-frame intro card, then reveals the video. Mapping: ' +
      'headline = title, business name = subline, sky = primary shade to accent, ridges = primary shades.',
  },
  previewCompatible: true,
}

export const fireworksBurstTemplate: RemotionDesignTemplate = {
  id: 'fireworks-burst',
  name: 'Fireworks Burst',
  description: 'Brand-coloured fireworks burst over your video, then your headline pops in.',
  category: 'visual-effect',
  source: repo1Source('src/components/fireworks-burst/FireworksBurst.tsx'),
  component: FireworksBurstDesign,
  defaultProps: {
    // The upstream default is an opaque `#0f172a` canvas.
    backgroundColor: 'transparent',
  },
  textSlots: [
    { key: 'message', field: 'headline', label: 'Message', primary: true, maxLength: 32 },
    { key: 'subtext', field: 'offer', label: 'Subline', maxLength: 56 },
  ],
  colors: [
    { role: 'primary', label: 'Burst colour' },
    { role: 'accent', label: 'Sparks and subline' },
    { role: 'text', label: 'Message colour' },
  ],
  media: [],
  animation: { durationInFrames: 110, delayInFrames: 0, easing: 'linear burst growth, spring message pop' },
  placement: FULL_FRAME_OVERLAY,
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: inline SVG lines/circles and spring only. Transparent overlay — ' +
      'the bursts finish by frame ~115 and the message stays on screen. Mapping: headline = message, offer = ' +
      'subline, petals cycle primary/accent/text-derived colours.',
  },
  previewCompatible: true,
}

export const loopGridWaveTemplate: RemotionDesignTemplate = {
  id: 'loop-grid-wave',
  name: 'Dot Grid Wave',
  description: 'A grid of dots ripples over your video in a seamless loop.',
  category: 'visual-effect',
  source: repo1Source('src/components/loop-grid-wave/LoopGridWave.tsx'),
  component: LoopGridWaveDesign,
  defaultProps: {
    // The upstream default is an opaque `#0a0f1e` canvas.
    backgroundColor: 'transparent',
  },
  textSlots: [],
  colors: [
    { role: 'primary', label: 'Dot colour' },
    { role: 'accent', label: 'Wave crest colour' },
  ],
  media: [],
  animation: { durationInFrames: 90, delayInFrames: 0, easing: 'seamless sine loop (90 frames)' },
  placement: FULL_FRAME_OVERLAY,
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: one inline SVG of circles, no filters or blend modes. ' +
      'Transparent, full-frame overlay that loops seamlessly every 90 frames. Textless.',
  },
  previewCompatible: true,
}

export const particleSnowTemplate: RemotionDesignTemplate = {
  id: 'particle-snow',
  name: 'Falling Snow',
  description: 'Gentle snow drifts over your video with your headline below.',
  category: 'visual-effect',
  source: repo1Source('src/components/particle-snow/ParticleSnow.tsx'),
  component: ParticleSnowDesign,
  defaultProps: {
    // The upstream default is an opaque `#0f172a` canvas.
    backgroundColor: 'transparent',
  },
  textSlots: [
    { key: 'title', field: 'headline', label: 'Title', primary: true, maxLength: 32 },
    { key: 'subtitle', field: 'offer', label: 'Subline', maxLength: 56 },
  ],
  colors: [
    { role: 'accent', label: 'Glow colour' },
    { role: 'text', label: 'Title colour' },
  ],
  media: [],
  animation: { durationInFrames: 150, delayInFrames: 0, easing: 'linear fall with sine sway' },
  placement: FULL_FRAME_OVERLAY,
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: inline SVG circles and an SVG linearGradient. Transparent ' +
      'overlay; the upstream adds a 12%-opacity accent glow at the top of the frame. Uses the fixed SVG id ' +
      '"snow-sky", so only one instance per composition. Mapping: headline = title, offer = subline.',
  },
  previewCompatible: true,
}

/** Batch 3c designs, in registration order. */
export const BATCH_3C_TEMPLATES: RemotionDesignTemplate[] = [
  lineChartAnimTemplate,
  kpiCounterTemplate,
  racingChartTemplate,
  characterJumpingTemplate,
  thinkingBubbleTemplate,
  waveHelloTemplate,
  fireworksBurstTemplate,
  loopGridWaveTemplate,
  parallaxPanTemplate,
  particleSnowTemplate,
]

/** Batch 3c designs that hardcode SVG ids (one instance per composition). */
export const BATCH_3C_FIXED_SVG_IDS: Record<string, string[]> = {
  'particle-snow': ['snow-sky'],
}
