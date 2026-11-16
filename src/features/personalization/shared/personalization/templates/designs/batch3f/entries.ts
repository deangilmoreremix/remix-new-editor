/**
 * Phase 4 porting batch 3f: catalog entries for upstream Remotion templates.
 * Exports ready-to-register entries; `../../catalog.ts` registers them.
 *
 * Batch 3f = fourteen data and background templates from the SECOND upstream
 * repository, `remotion-templates` (the React Video Editor template library,
 * https://github.com/deangilmoreremix/remotion-templates). They follow the
 * repo-2 convention set by batch 2 (`../rveCatalogEntries.ts`):
 *
 *  - the upstream copies in `../../_upstream/rve-<slug>/` are EDITED copies
 *    (contract addition C8) — every hard-coded data value, string, colour and
 *    dimension became an optional prop whose default reproduces the upstream
 *    literal, with a deviation record in each header;
 *  - every design renders inside `RveDesignStage`, which draws the repo-2
 *    credit (`RVE_ATTRIBUTION`, the upstream's in-file credit and the MIT
 *    permission notice without a copyright line);
 *  - `source.attribution` is `RVE_ATTRIBUTION`.
 *
 * Three kinds of design live here, classified by how they sit on the video:
 *
 *  - `data-visualization` — the seven charts and the step timeline. They keep
 *    a designed backdrop (a deep shade of the brand primary), cover the frame
 *    (`scale: 1`) and stop at `placement.endFrame`, so they play as an intro
 *    card and then reveal the customer's video.
 *  - `full-scene` — geometric patterns: the backdrop IS the design (the
 *    outlines are invisible over footage), so it is an intro card too.
 *  - overlays (`visual-effect`, `promo-cta`, `other`) — sound wave, grid
 *    pulse, gradient wash, countdown, stat counter. Their canvas is forced
 *    transparent (or, for the gradient wash, translucent) so the video shows
 *    through for the whole clip; no `endFrame`.
 *
 * Nothing here registers itself: importing this module has no side effect.
 */
import type { RemotionDesignTemplate } from '../../types'
import { RVE_ATTRIBUTION } from '../rveSharedDesign'
import { RveAreaChartDesign } from './RveAreaChartDesign'
import { RveChartAnimationDesign } from './RveChartAnimationDesign'
import { RveComparisonChartDesign } from './RveComparisonChartDesign'
import { RveCountdownTimerDesign } from './RveCountdownTimerDesign'
import { RveDonutChartDesign } from './RveDonutChartDesign'
import { RveGeometricPatternsDesign } from './RveGeometricPatternsDesign'
import { RveGradientShiftDesign } from './RveGradientShiftDesign'
import { RveGridPulseDesign } from './RveGridPulseDesign'
import { RveLineChartDesign } from './RveLineChartDesign'
import { RvePieChartDesign } from './RvePieChartDesign'
import { RveProgressBarsDesign } from './RveProgressBarsDesign'
import { RveProgressStepsDesign } from './RveProgressStepsDesign'
import { RveSoundWaveDesign } from './RveSoundWaveDesign'
import { RveStatCounterDesign } from './RveStatCounterDesign'

/* -------------------------------------------------------------------------- */
/* Shared                                                                      */
/* -------------------------------------------------------------------------- */

const RVE_REPOSITORY_URL = 'https://github.com/deangilmoreremix/remotion-templates'

/** Builds the `source` block every repo-2 design carries. */
function rveSource(slug: string): RemotionDesignTemplate['source'] {
  return {
    repository: 'remotion-templates',
    repositoryUrl: RVE_REPOSITORY_URL,
    sourcePath: `templates/${slug}.tsx`,
    license: 'MIT',
    attribution: RVE_ATTRIBUTION,
  }
}

const ALL_RATIOS: RemotionDesignTemplate['aspectRatios'] = ['16:9', '9:16', '1:1', '4:5']

/** Intro-card placement: full frame, no layer entrance, ends at `endFrame`. */
function introCard(endFrame: number): RemotionDesignTemplate['placement'] {
  return { x: 0.5, y: 0.5, scale: 1, opacity: 1, animation: 'none', endFrame }
}

const CHART_TITLE_SLOT = {
  key: 'headline',
  field: 'headline' as const,
  label: 'Chart title',
  primary: true,
  maxLength: 44,
}

const INTRO_NOTE =
  'Data-visualization intro card: the designed backdrop (a deep shade of the brand primary) covers the frame, ' +
  'then the layer ends at placement.endFrame and the video is revealed. '

const PLACEHOLDER_NOTE =
  'The customer cannot enter chart data, so the values are a PINNED, generically labelled placeholder ' +
  'dataset (the upstream demo dataset is never used and no numbers are derived from brand text). '

const EXPORT_NOTE =
  'Renders in the browser export path: inline SVG / CSS only, no external assets, no network fetches. '

/* -------------------------------------------------------------------------- */
/* Data visualization                                                          */
/* -------------------------------------------------------------------------- */

export const rveAreaChartTemplate: RemotionDesignTemplate = {
  id: 'rve-area-chart',
  name: 'Area Chart',
  description: 'A rising area chart in your brand colors, titled with your headline.',
  category: 'data-visualization',
  source: rveSource('area-chart'),
  component: RveAreaChartDesign,
  textSlots: [CHART_TITLE_SLOT],
  colors: [
    { role: 'primary', label: 'Chart colour and backdrop' },
    { role: 'text', label: 'Title colour' },
  ],
  media: [],
  animation: { durationInFrames: 65, delayInFrames: 0, easing: 'linear clip reveal (60 frames) + staggered points' },
  placement: introCard(120),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      INTRO_NOTE +
      PLACEHOLDER_NOTE +
      'Placeholder: a ten-week upward trend labelled "Wk 1".."Wk 10". ' +
      EXPORT_NOTE +
      'The upstream uses the fixed SVG ids "areaGradient" and "revealClip", so only ONE instance may be mounted ' +
      'per composition.',
  },
  previewCompatible: true,
}

export const rveChartAnimationTemplate: RemotionDesignTemplate = {
  id: 'rve-chart-animation',
  name: 'Growing Bar Chart',
  description: 'Bars grow one by one under your headline and offer.',
  category: 'data-visualization',
  source: rveSource('chart-animation'),
  component: RveChartAnimationDesign,
  textSlots: [
    CHART_TITLE_SLOT,
    { key: 'offer', field: 'offer', label: 'Chart subtitle', maxLength: 70 },
  ],
  colors: [
    { role: 'primary', label: 'Bar colour and backdrop' },
    { role: 'accent', label: 'Alternate bar colour' },
    { role: 'text', label: 'Title colour' },
  ],
  media: [],
  animation: { durationInFrames: 45, delayInFrames: 0, easing: 'linear grow, bars staggered 3 frames' },
  placement: introCard(120),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      INTRO_NOTE +
      PLACEHOLDER_NOTE +
      'Placeholder: an eight-month upward trend ("Jan".."Aug"); bars alternate brand primary / accent. ' +
      EXPORT_NOTE +
      'The upstream uses the fixed SVG id "shadow" (an feDropShadow filter), so only ONE instance may be ' +
      'mounted per composition; if the export rasteriser drops the SVG filter the bars simply lose their soft shadow.',
  },
  previewCompatible: true,
}

export const rveComparisonChartTemplate: RemotionDesignTemplate = {
  id: 'rve-comparison-chart',
  name: 'Before & After Chart',
  description: 'Two bars count up to show the before-and-after difference.',
  category: 'data-visualization',
  source: rveSource('comparison-chart'),
  component: RveComparisonChartDesign,
  textSlots: [{ ...CHART_TITLE_SLOT, maxLength: 38 }],
  colors: [
    { role: 'primary', label: '"Before" colour and backdrop' },
    { role: 'accent', label: '"After" colour' },
    { role: 'text', label: 'Title colour' },
  ],
  media: [],
  animation: { durationInFrames: 50, delayInFrames: 0, easing: 'linear count-up (before 10-40, after 20-50)' },
  placement: introCard(120),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      INTRO_NOTE +
      PLACEHOLDER_NOTE +
      'Placeholder: "Before" 35 % and "After" 90 %. ' +
      EXPORT_NOTE +
      'No SVG ids.',
  },
  previewCompatible: true,
}

export const rveDonutChartTemplate: RemotionDesignTemplate = {
  id: 'rve-donut-chart',
  name: 'Donut Chart',
  description: 'A donut ring sweeps in around your business name.',
  category: 'data-visualization',
  source: rveSource('donut-chart'),
  component: RveDonutChartDesign,
  textSlots: [
    { ...CHART_TITLE_SLOT, maxLength: 34 },
    { key: 'businessName', field: 'businessName', label: 'Centre caption', maxLength: 22 },
  ],
  colors: [
    { role: 'primary', label: 'Ring colours and backdrop' },
    { role: 'accent', label: 'Alternate ring colour' },
    { role: 'text', label: 'Title colour' },
  ],
  media: [],
  animation: { durationInFrames: 60, delayInFrames: 0, easing: 'linear segment sweep, staggered 12 frames' },
  placement: introCard(120),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      INTRO_NOTE +
      PLACEHOLDER_NOTE +
      'Placeholder: four segments "Segment A".."Segment D" (35/30/20/15). The centre figure counts to 100 % ' +
      '(the full ring) captioned with the business name, so it reads as a brand badge, not a claimed statistic. ' +
      EXPORT_NOTE +
      'No SVG ids.',
  },
  previewCompatible: true,
}

export const rveLineChartTemplate: RemotionDesignTemplate = {
  id: 'rve-line-chart',
  name: 'Line Chart',
  description: 'A growth line draws itself across the screen under your headline.',
  category: 'data-visualization',
  source: rveSource('line-chart'),
  component: RveLineChartDesign,
  textSlots: [CHART_TITLE_SLOT],
  colors: [
    { role: 'primary', label: 'Line colour and backdrop' },
    { role: 'accent', label: 'Point colour' },
    { role: 'text', label: 'Title colour' },
  ],
  media: [],
  animation: { durationInFrames: 65, delayInFrames: 0, easing: 'linear line draw (60 frames) + staggered points' },
  placement: introCard(120),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      INTRO_NOTE +
      PLACEHOLDER_NOTE +
      'Placeholder: a ten-month upward trend ("Jan".."Oct"). ' +
      EXPORT_NOTE +
      'No SVG ids.',
  },
  previewCompatible: true,
}

export const rvePieChartTemplate: RemotionDesignTemplate = {
  id: 'rve-pie-chart',
  name: 'Pie Chart',
  description: 'A pie chart in your brand colors sweeps in slice by slice.',
  category: 'data-visualization',
  source: rveSource('pie-chart'),
  component: RvePieChartDesign,
  textSlots: [{ ...CHART_TITLE_SLOT, maxLength: 34 }],
  colors: [
    { role: 'primary', label: 'Slice colours and backdrop' },
    { role: 'accent', label: 'Alternate slice colour' },
    { role: 'text', label: 'Title colour' },
  ],
  media: [],
  animation: { durationInFrames: 55, delayInFrames: 0, easing: 'linear slice sweep, staggered 10 frames' },
  placement: introCard(120),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      INTRO_NOTE +
      PLACEHOLDER_NOTE +
      'Placeholder: five slices "Segment A".."Segment E" (30/25/20/15/10). ' +
      EXPORT_NOTE +
      'No SVG ids.',
  },
  previewCompatible: true,
}

export const rveProgressBarsTemplate: RemotionDesignTemplate = {
  id: 'rve-progress-bars',
  name: 'Progress Bars',
  description: 'Five bars fill up one after another with counting percentages.',
  category: 'data-visualization',
  source: rveSource('progress-bars'),
  component: RveProgressBarsDesign,
  textSlots: [{ ...CHART_TITLE_SLOT, maxLength: 38 }],
  colors: [
    { role: 'primary', label: 'Bar colours and backdrop' },
    { role: 'accent', label: 'Alternate bar colour' },
    { role: 'text', label: 'Label colour' },
  ],
  media: [],
  animation: { durationInFrames: 60, delayInFrames: 0, easing: 'linear fill, rows staggered 8 frames' },
  placement: introCard(120),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      INTRO_NOTE +
      PLACEHOLDER_NOTE +
      'Placeholder: five rows "Category A".."Category E" (92/81/72/64/53 %). ' +
      EXPORT_NOTE +
      'No SVG ids.',
  },
  previewCompatible: true,
}

export const rveProgressStepsTemplate: RemotionDesignTemplate = {
  id: 'rve-progress-steps',
  name: 'Step Timeline',
  description: 'A four-step journey lights up step by step under your headline.',
  category: 'data-visualization',
  source: rveSource('progress-steps'),
  component: RveProgressStepsDesign,
  textSlots: [{ key: 'headline', field: 'headline', label: 'Timeline title', primary: true, maxLength: 48 }],
  colors: [
    { role: 'primary', label: 'Step colour and backdrop' },
    { role: 'accent', label: 'Step gradient' },
    { role: 'text', label: 'Title colour' },
  ],
  media: [],
  animation: { durationInFrames: 96, delayInFrames: 0, easing: 'step every 24 frames + spring(damping: 8, stiffness: 150) pulse' },
  placement: introCard(135),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Intro card: the designed backdrop covers the frame, then the layer ends at placement.endFrame and the ' +
      'video is revealed. The step labels are a pinned, generic journey ("Discover", "Plan", "Deliver", ' +
      '"Celebrate"). The upstream CSS transition on the step circle was removed (non-deterministic in a frame ' +
      'render). ' +
      EXPORT_NOTE +
      'No SVG ids.',
  },
  previewCompatible: true,
}

/* -------------------------------------------------------------------------- */
/* Full scene                                                                  */
/* -------------------------------------------------------------------------- */

export const rveGeometricPatternsTemplate: RemotionDesignTemplate = {
  id: 'rve-geometric-patterns',
  name: 'Geometric Intro',
  description: 'Spinning shapes settle around your business name as an opening card.',
  category: 'full-scene',
  source: rveSource('geometric-patterns'),
  component: RveGeometricPatternsDesign,
  textSlots: [
    { key: 'businessName', field: 'businessName', label: 'Business name', primary: true, maxLength: 32 },
  ],
  colors: [
    { role: 'primary', label: 'Backdrop and outlines' },
    { role: 'accent', label: 'Backdrop gradient' },
    { role: 'text', label: 'Name colour' },
  ],
  media: [],
  animation: { durationInFrames: 120, delayInFrames: 0, easing: 'spring(damping: 100) rotate + scale, staggered 3 frames' },
  placement: introCard(135),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Full-scene intro card rather than an overlay: the outlines are thin, faint lines that only read against ' +
      'the designed dark backdrop (over footage they vanish), so the backdrop is kept and the layer ends at ' +
      'placement.endFrame. The upstream has no text; the adapter adds the business name on top of the ' +
      'unmodified pattern, truncated to one line. Transforms and borders only — no SVG ids, no filters, no ' +
      'external assets.',
  },
  previewCompatible: true,
}

/* -------------------------------------------------------------------------- */
/* Overlays                                                                    */
/* -------------------------------------------------------------------------- */

export const rveSoundWaveTemplate: RemotionDesignTemplate = {
  id: 'rve-sound-wave',
  name: 'Sound Wave',
  description: 'A bouncing audio-style wave in your brand colors over your video.',
  category: 'visual-effect',
  source: rveSource('sound-wave'),
  component: RveSoundWaveDesign,
  textSlots: [],
  colors: [
    { role: 'primary', label: 'Bar colour' },
    { role: 'accent', label: 'Glow colour' },
  ],
  media: [],
  animation: { durationInFrames: 63, delayInFrames: 0, easing: 'continuous |sin| loop + seeded jitter' },
  placement: { x: 0.5, y: 0.7, scale: 0.6, opacity: 1, animation: 'fade' },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Overlay: no canvas fill. The upstream full-canvas backdrop-filter blur and blue inset glow are switched ' +
      'off so they do not blur or tint the video. The wave is decorative (a sine wave plus seeded, ' +
      'deterministic jitter) — it does not react to the soundtrack. The upstream CSS height transition was ' +
      'removed (non-deterministic in a frame render). Box-shadow glow only; no SVG ids, no external assets.',
  },
  previewCompatible: true,
}

export const rveGridPulseTemplate: RemotionDesignTemplate = {
  id: 'rve-grid-pulse',
  name: 'Pulsing Dot Grid',
  description: 'A grid of brand-colored dots ripples outward over your video.',
  category: 'visual-effect',
  source: rveSource('grid-pulse'),
  component: RveGridPulseDesign,
  textSlots: [],
  colors: [{ role: 'primary', label: 'Dot colour' }],
  media: [],
  animation: { durationInFrames: 63, delayInFrames: 0, easing: 'continuous outward sine wave (2.1 s period)' },
  placement: { x: 0.5, y: 0.5, scale: 1, opacity: 1, animation: 'none' },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Full-frame overlay: the upstream solid canvas is forced transparent, so only the dots (15-100 % opacity) ' +
      'sit over the video. The grid is 12 x 8 on 16:9 (the upstream layout) and re-flowed to keep square cells ' +
      'on 1:1, 4:5 and 9:16. Plain divs only; no SVG ids, no external assets.',
  },
  previewCompatible: true,
}

export const rveGradientShiftTemplate: RemotionDesignTemplate = {
  id: 'rve-gradient-shift',
  name: 'Brand Color Wash',
  description: 'A slowly turning brand-color gradient tints your whole video.',
  category: 'visual-effect',
  source: rveSource('gradient-shift'),
  component: RveGradientShiftDesign,
  textSlots: [],
  colors: [
    { role: 'primary', label: 'Wash colour' },
    { role: 'accent', label: 'Second wash colour' },
  ],
  media: [],
  animation: { durationInFrames: 720, delayInFrames: 0, easing: 'continuous: angle +0.5°/frame, palette sin(t * 0.3)' },
  placement: { x: 0.5, y: 0.5, scale: 1, opacity: 1, animation: 'none' },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Translucent overlay rather than a full scene: the upstream is only a gradient (no text, no shapes), so as ' +
      'an opaque intro it would be seconds of empty colour. Instead its stops are drawn at 32 % opacity, ' +
      'grading the whole video with a slowly turning brand gradient while the footage stays visible. ' +
      'linear-gradient only; no SVG ids, no external assets.',
  },
  previewCompatible: true,
}

export const rveCountdownTimerTemplate: RemotionDesignTemplate = {
  id: 'rve-countdown-timer',
  name: 'Countdown to CTA',
  description: 'Counts down 5 to 1 over your video, then lands on your call to action.',
  category: 'promo-cta',
  source: rveSource('countdown-timer'),
  component: RveCountdownTimerDesign,
  textSlots: [{ key: 'cta', field: 'cta', label: 'Final word', primary: true, maxLength: 16 }],
  colors: [
    { role: 'primary', label: 'Final word gradient start' },
    { role: 'accent', label: 'Final word gradient end' },
    { role: 'text', label: 'Number colour' },
  ],
  media: [],
  animation: { durationInFrames: 144, delayInFrames: 0, easing: 'spring(damping: 12, stiffness: 200, mass: 0.5) per number, 24 frames each' },
  placement: { x: 0.5, y: 0.5, scale: 0.7, opacity: 1, animation: 'none' },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Overlay: the upstream solid canvas is forced transparent; the digits get a soft drop shadow for ' +
      'legibility over video. The final word (the CTA, "GO" when empty) stays on screen after the countdown ' +
      'and is filled with a brand gradient through background-clip: text — if a rasteriser drops the text ' +
      'clip, the gradient would show as a box, so verify it in the browser export. No SVG ids, no external assets.',
  },
  previewCompatible: true,
}

export const rveStatCounterTemplate: RemotionDesignTemplate = {
  id: 'rve-stat-counter',
  name: 'Stat Counter',
  description: 'A big number counts up on a card over your video, with your offer and CTA.',
  category: 'other',
  source: rveSource('stat-counter'),
  component: RveStatCounterDesign,
  textSlots: [
    { key: 'offer', field: 'offer', label: 'Stat label', primary: true, maxLength: 30 },
    { key: 'cta', field: 'cta', label: 'Highlight', maxLength: 18 },
    { key: 'businessName', field: 'businessName', label: 'Caption', maxLength: 22 },
  ],
  colors: [
    { role: 'accent', label: 'Highlight colour' },
    { role: 'text', label: 'Number colour' },
  ],
  media: [],
  animation: { durationInFrames: 60, delayInFrames: 0, easing: 'spring(damping: 12, stiffness: 100) + linear count-up (10-60)' },
  placement: { x: 0.5, y: 0.5, scale: 0.7, opacity: 1, animation: 'none' },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Overlay: the upstream full-canvas backdrop is forced transparent and the card floats over the video ' +
      '(its own wash deepened to 55 % black for legibility). The figure is a PINNED placeholder "1,000+" (the ' +
      'customer cannot enter a number; the upstream "1,247" demo value is never used), grouped with a pinned ' +
      'en-US locale so the export is machine-independent. No SVG ids, no external assets.',
  },
  previewCompatible: true,
}

/* -------------------------------------------------------------------------- */
/* Registration lists                                                          */
/* -------------------------------------------------------------------------- */

/** Batch 3f designs, in registration order. */
export const BATCH_3F_TEMPLATES: RemotionDesignTemplate[] = [
  rveAreaChartTemplate,
  rveChartAnimationTemplate,
  rveComparisonChartTemplate,
  rveDonutChartTemplate,
  rveLineChartTemplate,
  rvePieChartTemplate,
  rveProgressBarsTemplate,
  rveProgressStepsTemplate,
  rveStatCounterTemplate,
  rveCountdownTimerTemplate,
  rveSoundWaveTemplate,
  rveGridPulseTemplate,
  rveGradientShiftTemplate,
  rveGeometricPatternsTemplate,
]

/** Batch 3f designs that hardcode SVG ids (one instance per composition). */
export const BATCH_3F_FIXED_SVG_IDS: Record<string, string[]> = {
  'rve-area-chart': ['areaGradient', 'revealClip'],
  'rve-chart-animation': ['shadow'],
}
