/**
 * Phase 4 porting batch 3d: catalog entries for upstream Remotion templates.
 * Exports ready-to-register entries; `../../catalog.ts` registers them.
 *
 * The batch holds:
 *
 *  - all seven templates of REPO 3, `remotion-video-templates`
 *    (https://github.com/deangilmoreremix/remotion-video-templates @
 *    90149464d51a43fcb90e15491bf0d681c1b0fa49 — MIT, Copyright (c) 2026
 *    Alejandro Brito). Ids `brito-*`. The copies in `../../_upstream/brito-*`
 *    (and their helpers in `../../_upstream/brito-lib`) are verbatim apart
 *    from recorded deviations; each carries the repo-3 credit
 *    (`BRITO_ATTRIBUTION`) and draws the repo-3 credit block, including the
 *    verbatim MIT licence with its copyright line (`BRITO_LICENSE_NOTICE`);
 *  - five logo reveals of REPO 2, `remotion-templates` (React Video Editor,
 *    MIT, no named copyright holder). Ids `rve-logo-*`. The copies in
 *    `../../_upstream/rve-logo-*` are C8 edited copies; they carry the repo-2
 *    credit (`RVE_ATTRIBUTION`) and use the repo-2 stage.
 *
 * Nothing here registers itself: importing this module has no side effect.
 */
import type { RemotionDesignTemplate } from '../../types'
import { RVE_ATTRIBUTION } from '../rveSharedDesign'
import { RVE_LICENSE, RVE_REPOSITORY, RVE_REPOSITORY_URL } from '../rveCatalogEntries'
import {
  BRITO_ATTRIBUTION,
  BRITO_LICENSE_NOTICE,
  BRITO_REPOSITORY,
  BRITO_REPOSITORY_URL,
  britoSource,
} from './britoShared'
import { BRITO_LOGO_INTRO_ID, BritoLogoIntroDesign } from './LogoIntroDesign'
import {
  BRITO_LOWER_THIRDS_FRAMES,
  BRITO_LOWER_THIRDS_ID,
  BritoLowerThirdsDesign,
} from './LowerThirdsDesign'
import {
  BRITO_KINETIC_MAX_FRAMES,
  BRITO_KINETIC_TEXT_ID,
  BritoKineticTextDesign,
} from './KineticTextDesign'
import {
  BRITO_BAR_CHART_RACE_FRAMES,
  BRITO_BAR_CHART_RACE_ID,
  BRITO_CHART_PLACEHOLDER,
  BritoBarChartRaceDesign,
} from './BarChartRaceDesign'
import {
  BRITO_LINE_CHART_FRAMES,
  BRITO_LINE_CHART_ID,
  BRITO_LINE_CHART_PLACEHOLDER,
  BritoLineChartDesign,
} from './LineChartDesign'
import {
  BRITO_CAPTIONED_SHORT_FRAMES,
  BRITO_CAPTIONED_SHORT_ID,
  BritoCaptionedShortDesign,
} from './CaptionedShortDesign'
import { BRITO_PROMO_FRAMES, BRITO_PROMO_ID, BritoPromoDesign } from './PromoDesign'
import { RVE_LOGO_FADE_REVEAL_ID, RveLogoFadeRevealDesign } from './RveLogoFadeRevealDesign'
import { RVE_LOGO_GLITCH_REVEAL_ID, RveLogoGlitchRevealDesign } from './RveLogoGlitchRevealDesign'
import { RVE_LOGO_SCALE_ROTATE_ID, RveLogoScaleRotateDesign } from './RveLogoScaleRotateDesign'
import { RVE_LOGO_SPIN_REVEAL_ID, RveLogoSpinRevealDesign } from './RveLogoSpinRevealDesign'
import { RVE_LOGO_TYPEWRITER_ID, RveLogoTypewriterDesign } from './RveLogoTypewriterDesign'

export {
  BRITO_ATTRIBUTION,
  BRITO_LICENSE_NOTICE,
  BRITO_REPOSITORY,
  BRITO_REPOSITORY_URL,
}

const ALL_RATIOS: RemotionDesignTemplate['aspectRatios'] = ['16:9', '9:16', '1:1', '4:5']

/** Builds the `source` block of a repo-2 logo reveal. */
function rveSource(sourcePath: string): RemotionDesignTemplate['source'] {
  return {
    repository: RVE_REPOSITORY,
    repositoryUrl: RVE_REPOSITORY_URL,
    sourcePath,
    license: RVE_LICENSE,
    attribution: RVE_ATTRIBUTION,
  }
}

/* -------------------------------------------------------------------------- */
/* Repo 3 — remotion-video-templates (Alejandro Brito)                         */
/* -------------------------------------------------------------------------- */

export const britoLogoIntroTemplate: RemotionDesignTemplate = {
  id: BRITO_LOGO_INTRO_ID,
  name: 'Particle Logo Pop',
  description: 'Your logo pops in with a burst of brand-coloured particles.',
  category: 'logo-reveal',
  source: britoSource('src/templates/LogoIntro/LogoIntro.tsx'),
  component: BritoLogoIntroDesign,
  defaultProps: { backgroundColor: 'transparent' },
  textSlots: [
    {
      key: 'businessName',
      field: 'businessName',
      label: 'Business name (initials shown when there is no logo)',
      primary: true,
    },
  ],
  colors: [
    { role: 'primary', label: 'Particles and glow' },
    { role: 'accent', label: 'Particles and glow (second tint)' },
  ],
  media: [{ role: 'logo', label: 'Logo' }],
  animation: {
    durationInFrames: 90,
    delayInFrames: 0,
    easing: 'spring BOUNCE (mass 0.8, stiffness 140, damping 9) pop + spring SNAPPY wipe, 16-frame particle burst',
  },
  placement: { x: 0.5, y: 0.5, scale: 0.75, opacity: 1, animation: 'none' },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: springs, clip-path, a radial gradient and a CSS drop-shadow filter ' +
      '(the drop-shadow should be checked in an exported frame). The logo comes from brand media (media.logo) — the ' +
      'upstream read logo.svg from public/ via staticFile(), which is not used. Without a logo, a branded monogram ' +
      'badge (business initials on a primary-to-accent gradient, plain DOM) takes its place. The canvas is ' +
      'transparent; the logo fades out over the last 12 frames of the clip.',
  },
  previewCompatible: true,
}

export const britoLowerThirdsTemplate: RemotionDesignTemplate = {
  id: BRITO_LOWER_THIRDS_ID,
  name: 'Name Tag Trio',
  description: 'Your name and offer appear in three clean lower-third styles.',
  category: 'lower-third',
  source: britoSource('src/templates/LowerThirds/LowerThirds.tsx'),
  component: BritoLowerThirdsDesign,
  textSlots: [
    { key: 'name', field: 'businessName', label: 'Name', primary: true },
    { key: 'role', field: 'offer', label: 'Second line' },
    { key: 'website', field: 'website', label: 'Website (second line fallback)' },
    { key: 'phone', field: 'phone', label: 'Phone (second line fallback)' },
  ],
  colors: [{ role: 'primary', label: 'Accent bar' }],
  media: [],
  animation: {
    durationInFrames: BRITO_LOWER_THIRDS_FRAMES,
    delayInFrames: 0,
    easing: 'spring SNAPPY (mass 0.6, stiffness 180, damping 20) enter, 70-frame hold, linear 14-frame exit — x3 styles',
  },
  placement: { x: 0.45, y: 0.55, scale: 0.9, opacity: 1, animation: 'none' },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: springs and plain CSS (the boxed style uses a 2px backdrop-filter blur, ' +
      'which degrades gracefully). Plays the upstream\'s three styles back to back (slide-in bar, boxed fade, minimal ' +
      'line; 98 frames each). The upstream\'s cosmetic stage background is not drawn, so the video shows through. ' +
      'The text is the upstream\'s dark ink: the first style sits on a white card, the other two are designed for ' +
      'lighter footage. Name and second line are truncated to the composition width.',
  },
  previewCompatible: true,
}

export const britoKineticTextTemplate: RemotionDesignTemplate = {
  id: BRITO_KINETIC_TEXT_ID,
  name: 'Kinetic Words',
  description: 'Your headline, offer and call to action punch in word by word.',
  category: 'animated-headline',
  source: britoSource('src/templates/KineticText/KineticText.tsx'),
  component: BritoKineticTextDesign,
  defaultProps: { backgroundColor: 'transparent' },
  textSlots: [
    { key: 'headline', field: 'headline', label: 'First line', primary: true },
    { key: 'offer', field: 'offer', label: 'Second line' },
    { key: 'cta', field: 'cta', label: 'Punch line (emphasised)' },
    { key: 'businessName', field: 'businessName', label: 'Fallback line' },
  ],
  colors: [
    { role: 'text', label: 'Text colour' },
    { role: 'accent', label: 'Punch line colour' },
  ],
  media: [],
  animation: {
    durationInFrames: BRITO_KINETIC_MAX_FRAMES,
    delayInFrames: 0,
    easing: 'per-word spring SNAPPY staggered 4 frames, 42-frame hold, 14-frame fade per line',
  },
  placement: { x: 0.5, y: 0.5, scale: 0.85, opacity: 1, animation: 'none' },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: springs and transforms only. Lines play one after another (headline, ' +
      'offer, then the call to action as the larger accent-coloured punch line); at most three lines of five words, ' +
      `so the sequence lasts at most ${BRITO_KINETIC_MAX_FRAMES} frames. Words are truncated to the composition width. ` +
      'The canvas is transparent.',
  },
  previewCompatible: true,
}

export const britoBarChartRaceTemplate: RemotionDesignTemplate = {
  id: BRITO_BAR_CHART_RACE_ID,
  name: 'Bar Chart Race',
  description: 'An animated bar race card in your brand colours that opens your video.',
  category: 'data-visualization',
  source: britoSource('src/templates/ChartVideo/BarChartRace.tsx'),
  component: BritoBarChartRaceDesign,
  defaultProps: {
    // PINNED PLACEHOLDER DATA: the customer cannot supply chart data, so the
    // series are an explicitly labelled stand-in ("Sample A".."Sample D").
    // The upstream demo dataset is never used.
    chartData: BRITO_CHART_PLACEHOLDER,
  },
  textSlots: [{ key: 'title', field: 'headline', label: 'Chart title', primary: true }],
  colors: [
    { role: 'primary', label: 'First bar and background tint' },
    { role: 'accent', label: 'Second bar and background tint' },
  ],
  media: [],
  animation: {
    durationInFrames: BRITO_BAR_CHART_RACE_FRAMES,
    delayInFrames: 0,
    easing: 'spring(damping: 200) 18-frame grow, Easing.inOut(ease) 45 frames per step, 45-frame hold',
  },
  placement: {
    x: 0.5,
    y: 0.5,
    scale: 1,
    opacity: 1,
    animation: 'none',
    endFrame: BRITO_BAR_CHART_RACE_FRAMES,
  },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: springs, interpolation and flex only. A full-frame intro card ' +
      `(${BRITO_BAR_CHART_RACE_FRAMES} frames) that then reveals the video. The data is a PINNED PLACEHOLDER dataset ` +
      '("Sample A" to "Sample D", "Step 1" to "Step 4") because the customer cannot supply chart data. The upstream\'s ' +
      'white canvas is tinted with the brand colours; bars use brand primary, brand accent, then violet and amber.',
  },
  previewCompatible: true,
}

export const britoLineChartTemplate: RemotionDesignTemplate = {
  id: BRITO_LINE_CHART_ID,
  name: 'Line Chart Draw',
  description: 'Lines draw themselves across a brand-coloured chart card.',
  category: 'data-visualization',
  source: britoSource('src/templates/ChartVideo/LineChart.tsx'),
  component: BritoLineChartDesign,
  defaultProps: {
    // PINNED PLACEHOLDER DATA — see the bar chart race.
    chartData: BRITO_LINE_CHART_PLACEHOLDER,
  },
  textSlots: [{ key: 'title', field: 'headline', label: 'Chart title', primary: true }],
  colors: [
    { role: 'primary', label: 'First line and background tint' },
    { role: 'accent', label: 'Second line and background tint' },
  ],
  media: [],
  animation: {
    durationInFrames: BRITO_LINE_CHART_FRAMES,
    delayInFrames: 0,
    easing: 'linear pathLength draw (92 frames) staggered 12 frames per line, 45-frame hold',
  },
  placement: {
    x: 0.5,
    y: 0.5,
    scale: 1,
    opacity: 1,
    animation: 'none',
    endFrame: BRITO_LINE_CHART_FRAMES,
  },
  aspectRatios: ['16:9'],
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: inline SVG paths (pathLength dash reveal), no filters, no fixed SVG ids. ' +
      `A full-frame intro card (${BRITO_LINE_CHART_FRAMES} frames) that then reveals the video. 16:9 only: the ` +
      'upstream puts the title and the legend on one row, which collide on a 1080-wide canvas. The data is a PINNED ' +
      'PLACEHOLDER dataset ("Sample A" to "Sample C"). The white canvas is tinted with the brand colours.',
  },
  previewCompatible: true,
}

export const britoCaptionedShortTemplate: RemotionDesignTemplate = {
  id: BRITO_CAPTIONED_SHORT_ID,
  name: 'Karaoke Captions',
  description: 'Social-style captions that highlight your message word by word.',
  category: 'animated-headline',
  source: britoSource('src/templates/CaptionedShort/CaptionedShort.tsx'),
  component: BritoCaptionedShortDesign,
  textSlots: [
    { key: 'headline', field: 'headline', label: 'Captions — first sentence', primary: true },
    { key: 'offer', field: 'offer', label: 'Captions — second sentence' },
    { key: 'cta', field: 'cta', label: 'Captions — last sentence' },
    { key: 'title', field: 'businessName', label: 'Title chip' },
  ],
  colors: [{ role: 'accent', label: 'Highlighted word and progress bar' }],
  media: [],
  animation: {
    durationInFrames: BRITO_CAPTIONED_SHORT_FRAMES,
    delayInFrames: 0,
    easing: 'spring SNAPPY pop per word (0.7 → 1), groups of 3 words, linear progress bar',
  },
  placement: { x: 0.5, y: 0.5, scale: 0.95, opacity: 1, animation: 'none' },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: springs, text-shadow and plain CSS. There is no transcript, so the ' +
      'caption words are built from the brand copy (headline, offer, call to action), timed like speech (300-700 ms ' +
      'per word); the upstream sample transcript (captions.sample.json) is not shipped. Natively 9:16, laid out in ' +
      'fractions of the canvas, so it also works in 16:9, 1:1 and 4:5. The upstream\'s gradient fill is overridden ' +
      'with a scoped stylesheet rule so the video shows through.',
  },
  previewCompatible: true,
}

export const britoPromoTemplate: RemotionDesignTemplate = {
  id: BRITO_PROMO_ID,
  name: 'Product Promo',
  description: 'A three-scene promo: introduce your business, show your product, then your call to action.',
  category: 'full-scene',
  source: britoSource('src/templates/PromoTemplate/PromoTemplate.tsx'),
  component: BritoPromoDesign,
  textSlots: [
    { key: 'tagline', field: 'headline', label: 'Tagline', primary: true },
    { key: 'productName', field: 'businessName', label: 'Product / business name' },
    { key: 'featureTitle', field: 'offer', label: 'Feature title' },
    { key: 'website', field: 'website', label: 'Feature detail (website)' },
    { key: 'phone', field: 'phone', label: 'Feature detail (phone)' },
    { key: 'cta', field: 'cta', label: 'Call-to-action button' },
  ],
  colors: [
    { role: 'primary', label: 'Accent (eyebrow, badge, button)' },
    { role: 'accent', label: 'Placeholder screenshot tint' },
  ],
  media: [
    { role: 'product', label: 'Product screenshot' },
    { role: 'service', label: 'Service image (used when there is no product image)' },
  ],
  animation: {
    durationInFrames: BRITO_PROMO_FRAMES,
    delayInFrames: 0,
    easing: 'spring SNAPPY scene entrances, spring GENTLE Ken Burns pan, 20-frame linear slide / fade transitions',
  },
  placement: {
    x: 0.5,
    y: 0.5,
    scale: 1,
    opacity: 1,
    animation: 'none',
    endFrame: BRITO_PROMO_FRAMES,
  },
  aspectRatios: ['16:9'],
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      `Renders in the browser export path: springs, transforms and opacity only. A full-frame intro (${BRITO_PROMO_FRAMES} ` +
      'frames: hook, one feature scene, CTA) that then reveals the video. The screenshot comes from brand media ' +
      '(product, then service image); without one, a brand-coloured app-window mock-up (plain DOM) is shown. The ' +
      'scene changes use the upstream\'s own @remotion/transitions slide and fade. 16:9 only: the ' +
      'upstream\'s fixed-px callout column is too narrow on a 1080-wide canvas.',
  },
  previewCompatible: true,
}

/* -------------------------------------------------------------------------- */
/* Repo 2 — remotion-templates (React Video Editor) logo reveals               */
/* -------------------------------------------------------------------------- */

const rveLogoColors: RemotionDesignTemplate['colors'] = [
  { role: 'primary', label: 'Badge gradient start and glow' },
  { role: 'accent', label: 'Badge gradient end' },
  { role: 'text', label: 'Company name' },
]

const rveLogoMedia: RemotionDesignTemplate['media'] = [{ role: 'logo', label: 'Logo' }]

function rveLogoNotes(effects: string): string {
  return (
    `Renders in the browser export path: ${effects}. Shows the customer's logo in the badge when there is one, ` +
    'otherwise their initials on a brand gradient (never the upstream "LOGO" / "Company Name" demo copy). The ' +
    'upstream badge and rem type are rescaled to the composition\'s short edge; the canvas is transparent.'
  )
}

export const rveLogoFadeRevealTemplate: RemotionDesignTemplate = {
  id: RVE_LOGO_FADE_REVEAL_ID,
  name: 'Logo Fade Reveal',
  description: 'Your logo fades up, then your name and tagline rise in.',
  category: 'logo-reveal',
  source: rveSource('templates/logo-fade-reveal.tsx'),
  component: RveLogoFadeRevealDesign,
  textSlots: [
    { key: 'companyName', field: 'businessName', label: 'Company name', primary: true },
    { key: 'tagline', field: 'headline', label: 'Tagline' },
  ],
  colors: rveLogoColors,
  media: rveLogoMedia,
  animation: {
    durationInFrames: 60,
    delayInFrames: 0,
    easing: 'spring(damping 12, stiffness 80, mass 0.8) badge + spring(damping 14, stiffness 60) text after 15 frames',
  },
  placement: { x: 0.5, y: 0.5, scale: 0.7, opacity: 1, animation: 'none' },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: { preview: true, browserExport: true, notes: rveLogoNotes('springs and plain CSS only') },
  previewCompatible: true,
}

export const rveLogoGlitchRevealTemplate: RemotionDesignTemplate = {
  id: RVE_LOGO_GLITCH_REVEAL_ID,
  name: 'Logo Glitch Reveal',
  description: 'An RGB glitch snaps together into your logo and name.',
  category: 'logo-reveal',
  source: rveSource('templates/logo-glitch-reveal.tsx'),
  component: RveLogoGlitchRevealDesign,
  textSlots: [
    { key: 'companyName', field: 'businessName', label: 'Company name', primary: true },
    { key: 'tagline', field: 'headline', label: 'Tagline' },
  ],
  colors: rveLogoColors,
  media: rveLogoMedia,
  animation: {
    durationInFrames: 60,
    delayInFrames: 0,
    easing: 'sin-jitter RGB split decaying over 30 frames, clean badge spring after 25 frames',
  },
  placement: { x: 0.5, y: 0.5, scale: 0.7, opacity: 1, animation: 'none' },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes: rveLogoNotes(
      'springs, transforms and mix-blend-mode: screen on the three RGB channel copies (the blend should be ' +
        'checked in an exported frame)',
    ),
  },
  previewCompatible: true,
}

export const rveLogoScaleRotateTemplate: RemotionDesignTemplate = {
  id: RVE_LOGO_SCALE_ROTATE_ID,
  name: 'Logo Spin Zoom',
  description: 'Your logo zooms in with a full spin, then your name slides up.',
  category: 'logo-reveal',
  source: rveSource('templates/logo-scale-rotate.tsx'),
  component: RveLogoScaleRotateDesign,
  textSlots: [{ key: 'companyName', field: 'businessName', label: 'Company name', primary: true }],
  colors: rveLogoColors,
  media: rveLogoMedia,
  animation: {
    durationInFrames: 45,
    delayInFrames: 0,
    easing: 'spring(damping 10, stiffness 100, mass 0.8) scale + 360° spin, sine glow pulse',
  },
  placement: { x: 0.5, y: 0.5, scale: 0.7, opacity: 1, animation: 'none' },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: { preview: true, browserExport: true, notes: rveLogoNotes('springs, transforms and box-shadow only') },
  previewCompatible: true,
}

export const rveLogoSpinRevealTemplate: RemotionDesignTemplate = {
  id: RVE_LOGO_SPIN_REVEAL_ID,
  name: 'Logo 3D Flip',
  description: 'Your logo swings into view in 3D, followed by your name and tagline.',
  category: 'logo-reveal',
  source: rveSource('templates/logo-spin-reveal.tsx'),
  component: RveLogoSpinRevealDesign,
  textSlots: [
    { key: 'companyName', field: 'businessName', label: 'Company name', primary: true },
    { key: 'tagline', field: 'headline', label: 'Tagline' },
  ],
  colors: rveLogoColors,
  media: rveLogoMedia,
  animation: {
    durationInFrames: 60,
    delayInFrames: 0,
    easing: 'spring(damping 14, stiffness 60, mass 1) rotateY 90° → 0, text spring after 20 frames',
  },
  placement: { x: 0.5, y: 0.5, scale: 0.7, opacity: 1, animation: 'none' },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes: rveLogoNotes('springs and a CSS perspective/rotateY transform (check the 3D flip in an exported frame)'),
  },
  previewCompatible: true,
}

export const rveLogoTypewriterTemplate: RemotionDesignTemplate = {
  id: RVE_LOGO_TYPEWRITER_ID,
  name: 'Logo Typewriter',
  description: 'Your business name types itself out next to your logo.',
  category: 'logo-reveal',
  source: rveSource('templates/logo-typewriter.tsx'),
  component: RveLogoTypewriterDesign,
  textSlots: [{ key: 'wordmark', field: 'businessName', label: 'Wordmark', primary: true }],
  colors: [
    { role: 'primary', label: 'Icon gradient start and cursor' },
    { role: 'accent', label: 'Icon gradient end' },
    { role: 'text', label: 'Wordmark' },
  ],
  media: rveLogoMedia,
  animation: {
    durationInFrames: 175,
    delayInFrames: 0,
    easing: 'icon spring(damping 10, stiffness 150), typing 0.15 chars/frame from frame 15, 15-frame cursor blink',
  },
  placement: { x: 0.5, y: 0.5, scale: 0.7, opacity: 1, animation: 'none' },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: one spring and a frame-driven typewriter, no filters. The wordmark is the ' +
      'business name in capitals (never the upstream "ACME STUDIO"), truncated to fit one line beside the icon; the ' +
      'icon shows the customer\'s logo when there is one, otherwise a brand gradient disc. Sizes are rescaled to the ' +
      'composition\'s short edge; the canvas is transparent.',
  },
  previewCompatible: true,
}

/** Batch 3d designs, in registration order. */
export const BATCH_3D_TEMPLATES: RemotionDesignTemplate[] = [
  britoLogoIntroTemplate,
  britoLowerThirdsTemplate,
  britoKineticTextTemplate,
  britoBarChartRaceTemplate,
  britoLineChartTemplate,
  britoCaptionedShortTemplate,
  britoPromoTemplate,
  rveLogoFadeRevealTemplate,
  rveLogoGlitchRevealTemplate,
  rveLogoScaleRotateTemplate,
  rveLogoSpinRevealTemplate,
  rveLogoTypewriterTemplate,
]

/**
 * Batch 3d designs that hardcode SVG ids (one instance per composition).
 *
 * None: the only inline SVG in the batch (the line chart) uses no `id`
 * attributes, and the placeholders are plain DOM.
 */
export const BATCH_3D_FIXED_SVG_IDS: Record<string, string[]> = {}
