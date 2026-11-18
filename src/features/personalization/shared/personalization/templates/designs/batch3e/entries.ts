/**
 * Phase 4 porting batch 3e: catalog entries for upstream Remotion templates.
 * Exports ready-to-register entries; `../../catalog.ts` registers them.
 *
 * Batch 3e = fifteen text / title templates from repo 2, `remotion-templates`
 * (React Video Editor, https://www.reactvideoeditor.com). They follow the
 * repo-2 convention set by `../rveCatalogEntries.ts`:
 *
 *  - the upstream copies in `../../_upstream/rve-<slug>/` are EDITED copies
 *    (contract addition C8) — every hard-coded string, colour and dimension
 *    is an optional prop whose default reproduces the upstream literal, with
 *    a deviation record in each header;
 *  - every design renders through `RveDesignStage`, which draws the repo-2
 *    credit (RVE_ATTRIBUTION + the upstream's own credit + the MIT notice
 *    without a copyright line);
 *  - `source.attribution` is `RVE_ATTRIBUTION`.
 *
 * Classification:
 *  - Overlays (transparent canvas, no `endFrame`): bounce-text,
 *    bubble-pop-text, floating-bubble-text, pulsing-text, title-split,
 *    typewriter-subtitle, text-highlight (animated headlines);
 *    notification-pop, subscribe-reminder, animated-list (promo CTAs);
 *    lower-third (lower third).
 *  - Full-scene intro cards (designed brand background, `endFrame` set):
 *    cinematic-title-intro, quote-card, credits-roll, countdown-intro.
 *
 * None of these templates draws an image and none hardcodes an SVG `id`
 * (the countdown ring's SVG has none), so `media` is empty and
 * `BATCH_3E_FIXED_SVG_IDS` is empty.
 *
 * Nothing here registers itself: importing this module has no side effect.
 */
import type { PreviewAspectRatio } from '../../../preview/types'
import type { RemotionDesignTemplate } from '../../types'
import { RVE_ATTRIBUTION } from '../rveSharedDesign'
import { RveAnimatedListDesign } from './RveAnimatedListDesign'
import { RveBounceTextDesign } from './RveBounceTextDesign'
import { RveBubblePopTextDesign } from './RveBubblePopTextDesign'
import { RveCinematicTitleIntroDesign } from './RveCinematicTitleIntroDesign'
import { RveCountdownIntroDesign, COUNTDOWN_INTRO_FRAMES } from './RveCountdownIntroDesign'
import { RveCreditsRollDesign, CREDITS_ROLL_FRAMES } from './RveCreditsRollDesign'
import { RveFloatingBubbleTextDesign } from './RveFloatingBubbleTextDesign'
import { RveLowerThirdDesign } from './RveLowerThirdDesign'
import { RveNotificationPopDesign } from './RveNotificationPopDesign'
import { RvePulsingTextDesign } from './RvePulsingTextDesign'
import { RveQuoteCardDesign } from './RveQuoteCardDesign'
import { RveSubscribeReminderDesign } from './RveSubscribeReminderDesign'
import { RveTextHighlightDesign } from './RveTextHighlightDesign'
import { RveTitleSplitDesign } from './RveTitleSplitDesign'
import { RveTypewriterSubtitleDesign } from './RveTypewriterSubtitleDesign'

/** Every supported format: all sizing is derived from the composition. */
const ALL_RATIOS: PreviewAspectRatio[] = ['16:9', '9:16', '1:1', '4:5']

/** The `source` block every batch-3e design carries. */
function rveSource(slug: string): RemotionDesignTemplate['source'] {
  return {
    repository: 'remotion-templates',
    repositoryUrl: 'https://github.com/deangilmoreremix/remotion-templates',
    sourcePath: `templates/${slug}.tsx`,
    license: 'MIT',
    attribution: RVE_ATTRIBUTION,
  }
}

/** Shared capability note for the repo-2 copies. */
const RVE_NOTE =
  'Repo-2 edited copy (C8): every upstream literal is a prop and the demo copy is never reachable. ' +
  'Sizes are canvas-relative (the upstream rem/px values are scaled from the composition short edge). '

/** Placement of a full-canvas overlay anchored by the upstream itself (corner / edge). */
const FULL_CANVAS_OVERLAY: RemotionDesignTemplate['placement'] = {
  x: 0.5,
  y: 0.5,
  scale: 1,
  opacity: 1,
  animation: 'none',
}

/** Placement of a full-scene intro card. */
function introPlacement(endFrame: number): RemotionDesignTemplate['placement'] {
  return { x: 0.5, y: 0.5, scale: 1, opacity: 1, animation: 'none', endFrame }
}

/* -------------------------------------------------------------------------- */
/* Overlays — animated headlines                                               */
/* -------------------------------------------------------------------------- */

export const rveBounceTextTemplate: RemotionDesignTemplate = {
  id: 'rve-bounce-text',
  name: 'Bounce Card',
  description: 'Your headline slides across a bold brand-colour card that pops into view.',
  category: 'animated-headline',
  source: rveSource('bounce-text'),
  component: RveBounceTextDesign,
  textSlots: [
    { key: 'headline', field: 'headline', label: 'Headline', primary: true },
    { key: 'offer', field: 'offer', label: 'Subtitle' },
  ],
  colors: [
    { role: 'primary', label: 'Card colour' },
    { role: 'text', label: 'Text colour' },
  ],
  media: [],
  animation: {
    durationInFrames: 45,
    delayInFrames: 0,
    easing: 'spring(damping: 100, stiffness: 200) slide + scale; subtitle fades in 15 frames later',
  },
  placement: { x: 0.5, y: 0.5, scale: 0.9, opacity: 1, animation: 'none' },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      RVE_NOTE +
      'Springs, a linear-gradient card and text shadows only — all drawn by the browser export rasteriser. ' +
      'The card is 80 % of the canvas wide, so the canvas stays transparent around it. Headline (2 lines) and ' +
      'subtitle (offer, then business name) are truncated to fit the card.',
  },
  previewCompatible: true,
}

export const rveBubblePopTextTemplate: RemotionDesignTemplate = {
  id: 'rve-bubble-pop-text',
  name: 'Bubble Letters',
  description: 'Your business name pops in letter by letter, each in its own brand bubble.',
  category: 'animated-headline',
  source: rveSource('bubble-pop-text'),
  component: RveBubblePopTextDesign,
  textSlots: [
    { key: 'businessName', field: 'businessName', label: 'Bubble text', primary: true, maxLength: 10 },
  ],
  colors: [
    { role: 'primary', label: 'Bubble colour' },
    { role: 'text', label: 'Letter colour' },
  ],
  media: [],
  animation: {
    durationInFrames: 60,
    delayInFrames: 0,
    easing: 'per-letter spring(damping: 8, mass: 0.3, stiffness: 100) staggered 5 frames',
  },
  placement: { x: 0.5, y: 0.5, scale: 0.9, opacity: 1, animation: 'none' },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      RVE_NOTE +
      'Upper-cases the copy like the upstream "HELLO" and holds at most 10 letters: a longer name falls back to ' +
      'its first word, then a hard cut. Bubbles are sized from the letter count so the row fits half the canvas ' +
      '(the row is centred with left: 50%). The upstream backdrop-filter blur is not drawn by the export ' +
      'rasteriser; the bubbles are opaque gradients, so nothing visible changes.',
  },
  previewCompatible: true,
}

export const rveFloatingBubbleTextTemplate: RemotionDesignTemplate = {
  id: 'rve-floating-bubble-text',
  name: 'Floating Pill',
  description: 'Your headline in a glowing brand pill that gently floats over your video.',
  category: 'animated-headline',
  source: rveSource('floating-bubble-text'),
  component: RveFloatingBubbleTextDesign,
  textSlots: [{ key: 'headline', field: 'headline', label: 'Headline', primary: true }],
  colors: [
    { role: 'primary', label: 'Pill colour' },
    { role: 'accent', label: 'Rim colour' },
    { role: 'text', label: 'Text colour' },
  ],
  media: [],
  animation: {
    durationInFrames: 30,
    delayInFrames: 0,
    easing: 'spring(damping: 12, mass: 0.5) scale-in, then sin(frame / 30) float',
  },
  placement: { x: 0.5, y: 0.5, scale: 0.9, opacity: 1, animation: 'none' },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      RVE_NOTE +
      'The upstream\'s no-op `animation: rotate 3s` declaration (no keyframes exist) was removed for ' +
      'determinism (C12). The two-colour rim relies on background-clip: padding-box, which the export ' +
      'rasteriser does not implement — in an export the rim blends into the pill. Copy wraps to at most two ' +
      'lines inside the pill.',
  },
  previewCompatible: true,
}

export const rvePulsingTextTemplate: RemotionDesignTemplate = {
  id: 'rve-pulsing-text',
  name: 'Pulsing Letters',
  description: 'Your headline breathes in a rolling pulse, letter by letter, with a soft brand glow.',
  category: 'animated-headline',
  source: rveSource('pulsing-text'),
  component: RvePulsingTextDesign,
  textSlots: [
    { key: 'headline', field: 'headline', label: 'Headline', primary: true, maxLength: 14 },
  ],
  colors: [
    { role: 'primary', label: 'Glow colour' },
    { role: 'text', label: 'Letter colour' },
  ],
  media: [],
  animation: {
    durationInFrames: 30,
    delayInFrames: 0,
    easing: 'looping interpolate 1 → 1.2 → 1 every 30 frames, staggered 6 frames per letter',
  },
  placement: { x: 0.5, y: 0.5, scale: 0.9, opacity: 1, animation: 'none' },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      RVE_NOTE +
      'The upstream halo is a filter: blur(20px) disc, which the export rasteriser cannot draw; the adapter ' +
      'passes glowFilter "none" plus a box-shadow glow so preview and export match. At most 14 letters; the ' +
      'type size is fitted to the letter count so the row fits half the canvas.',
  },
  previewCompatible: true,
}

export const rveTitleSplitTemplate: RemotionDesignTemplate = {
  id: 'rve-title-split',
  name: 'Split Title',
  description: 'Two bold lines meet in the middle — your headline in outline, your name in solid.',
  category: 'animated-headline',
  source: rveSource('title-split'),
  component: RveTitleSplitDesign,
  textSlots: [
    { key: 'headline', field: 'headline', label: 'Outlined line', primary: true, maxLength: 22 },
    { key: 'businessName', field: 'businessName', label: 'Solid line', maxLength: 22 },
  ],
  colors: [
    { role: 'text', label: 'Text colour' },
    { role: 'primary', label: 'Glow colour' },
  ],
  media: [],
  animation: {
    durationInFrames: 30,
    delayInFrames: 0,
    easing: 'spring(damping: 14, stiffness: 80) from ±120 px, then a sine glow',
  },
  placement: { x: 0.5, y: 0.5, scale: 0.9, opacity: 1, animation: 'none' },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      RVE_NOTE +
      'The upstream #111827 full-canvas fill is forced transparent. Both lines are upper-cased like the ' +
      'upstream and the type is fitted to the longer line so neither wraps. The outline uses ' +
      '-webkit-text-stroke, which the export rasteriser supports.',
  },
  previewCompatible: true,
}

export const rveTypewriterSubtitleTemplate: RemotionDesignTemplate = {
  id: 'rve-typewriter-subtitle',
  name: 'Typewriter Line',
  description: 'Your headline types itself out behind a blinking brand-colour cursor.',
  category: 'animated-headline',
  source: rveSource('typewriter-subtitle'),
  component: RveTypewriterSubtitleDesign,
  textSlots: [
    { key: 'headline', field: 'headline', label: 'Typed line', primary: true, maxLength: 48 },
  ],
  colors: [
    { role: 'text', label: 'Text colour' },
    { role: 'accent', label: 'Cursor colour' },
  ],
  media: [],
  animation: {
    durationInFrames: 45,
    delayInFrames: 0,
    easing: 'linear reveal (~2.8 frames per character, 30–90 frames), cursor blinks every 15 frames',
  },
  placement: { x: 0.5, y: 0.5, scale: 0.9, opacity: 1, animation: 'none' },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      RVE_NOTE +
      'The upstream\'s unused Math.random() "glitch" flag and its CSS transition were removed (C12: a ' +
      'frame must be a pure function of time). The line is kept on one line: the type shrinks first, then ' +
      'the copy is truncated. The upstream monospace face is replaced by the bundled deterministic typeface.',
  },
  previewCompatible: true,
}

export const rveTextHighlightTemplate: RemotionDesignTemplate = {
  id: 'rve-text-highlight',
  name: 'Marker Highlight',
  description: 'A brand-colour marker sweeps behind each word of your headline in turn.',
  category: 'animated-headline',
  source: rveSource('text-highlight'),
  component: RveTextHighlightDesign,
  textSlots: [{ key: 'headline', field: 'headline', label: 'Headline', primary: true }],
  colors: [
    { role: 'primary', label: 'Marker start' },
    { role: 'accent', label: 'Marker end' },
    { role: 'text', label: 'Text colour' },
  ],
  media: [],
  animation: {
    durationInFrames: 144,
    delayInFrames: 0,
    easing: 'linear highlight sweep, 0.6 s per word (up to 8 words)',
  },
  placement: { x: 0.5, y: 0.5, scale: 0.9, opacity: 1, animation: 'none' },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      RVE_NOTE +
      'The upstream dark full-canvas gradient is forced transparent and a soft text shadow keeps the words ' +
      'legible before their highlight lands. At most 8 words (each ≤ 14 characters); the type shrinks so ' +
      'the longest word fits the column.',
  },
  previewCompatible: true,
}

/* -------------------------------------------------------------------------- */
/* Overlays — lower third / promo                                              */
/* -------------------------------------------------------------------------- */

export const rveLowerThirdTemplate: RemotionDesignTemplate = {
  id: 'rve-lower-third',
  name: 'Broadcast Lower Third',
  description: 'A sleek news-style name bar with your business name and offer.',
  category: 'lower-third',
  source: rveSource('lower-third'),
  component: RveLowerThirdDesign,
  textSlots: [
    { key: 'businessName', field: 'businessName', label: 'Name', primary: true },
    { key: 'offer', field: 'offer', label: 'Title line' },
  ],
  colors: [
    { role: 'primary', label: 'Accent line & bar' },
    { role: 'accent', label: 'Accent line end' },
    { role: 'text', label: 'Name colour' },
  ],
  media: [],
  animation: {
    durationInFrames: 35,
    delayInFrames: 0,
    easing: 'spring(damping: 15, mass: 0.6) accent, spring(damping: 14, mass: 0.7) panel +5 f, text fade +15 f',
  },
  placement: FULL_CANVAS_OVERLAY,
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      RVE_NOTE +
      'The upstream positions the bar itself (20 % from the bottom, left-aligned), so the layer spans the ' +
      'whole canvas with the full-canvas dark gradient forced transparent; only the translucent name panel ' +
      'paints. Both lines are truncated to 70 % of the canvas width.',
  },
  previewCompatible: true,
}

export const rveNotificationPopTemplate: RemotionDesignTemplate = {
  id: 'rve-notification-pop',
  name: 'Notification Pop',
  description: 'Phone-style notifications slide in with your offer, call to action and contact details.',
  category: 'promo-cta',
  source: rveSource('notification-pop'),
  component: RveNotificationPopDesign,
  textSlots: [
    { key: 'offer', field: 'offer', label: 'First notification', primary: true },
    { key: 'businessName', field: 'businessName', label: 'First notification title' },
    { key: 'cta', field: 'cta', label: 'Second notification title' },
    { key: 'phone', field: 'phone', label: 'Second notification' },
    { key: 'website', field: 'website', label: 'Third notification title' },
    { key: 'headline', field: 'headline', label: 'Third notification' },
  ],
  colors: [
    { role: 'primary', label: 'Notification dots' },
    { role: 'accent', label: 'Second dot' },
    { role: 'text', label: 'Title colour' },
  ],
  media: [],
  animation: {
    durationInFrames: 60,
    delayInFrames: 0,
    easing: 'per-card spring(damping: 14, stiffness: 180, mass: 0.6) staggered 20 frames',
  },
  placement: FULL_CANVAS_OVERLAY,
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      RVE_NOTE +
      'Up to three cards built from brand fields: business name / offer, call to action / phone, website / ' +
      'headline (a card with no data is skipped; the badge counts the cards). The upstream dark full-canvas ' +
      'gradient and its "Notifications" header are dropped; the cards keep their translucent dark fill and ' +
      'stack on the right edge, which the upstream positions itself — hence a full-canvas layer.',
  },
  previewCompatible: true,
}

export const rveSubscribeReminderTemplate: RemotionDesignTemplate = {
  id: 'rve-subscribe-reminder',
  name: 'Corner Reminder',
  description: 'A pill with a ringing bell slides into the corner with your call to action.',
  category: 'promo-cta',
  source: rveSource('subscribe-reminder'),
  component: RveSubscribeReminderDesign,
  textSlots: [
    { key: 'cta', field: 'cta', label: 'Call to action', primary: true, maxLength: 28 },
    { key: 'website', field: 'website', label: 'Handle / website' },
  ],
  colors: [
    { role: 'primary', label: 'Bell colour' },
    { role: 'text', label: 'Text colour' },
  ],
  media: [],
  animation: {
    durationInFrames: 40,
    delayInFrames: 10,
    easing: 'spring(damping: 14, stiffness: 100) slide-up after 10 frames, sine bell pulse',
  },
  placement: FULL_CANVAS_OVERLAY,
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      RVE_NOTE +
      'The upstream #111827 backdrop and its "Your Video Content" placeholder are dropped so the pill sits ' +
      'on the real video (bottom-right, as upstream — hence a full-canvas layer). The bell emoji is replaced ' +
      'by an inline SVG (no ids) so it does not depend on an emoji font. The pill\'s backdrop-filter blur is ' +
      'not drawn by the export rasteriser; its 75 % black fill keeps it legible.',
  },
  previewCompatible: true,
}

export const rveAnimatedListTemplate: RemotionDesignTemplate = {
  id: 'rve-animated-list',
  name: 'Animated Bullets',
  description: 'Your offer, phone and website spring in as a clean bullet list.',
  category: 'promo-cta',
  source: rveSource('animated-list'),
  component: RveAnimatedListDesign,
  textSlots: [
    { key: 'offer', field: 'offer', label: 'First bullet', primary: true },
    { key: 'phone', field: 'phone', label: 'Second bullet' },
    { key: 'website', field: 'website', label: 'Third bullet' },
  ],
  colors: [
    { role: 'primary', label: 'Bullet colours' },
    { role: 'text', label: 'Text colour' },
  ],
  media: [],
  animation: {
    durationInFrames: 40,
    delayInFrames: 0,
    easing: 'per-row spring(damping: 12, mass: 0.5) slide + fade + scale, staggered 5 frames',
  },
  placement: { x: 0.5, y: 0.5, scale: 0.9, opacity: 1, animation: 'none' },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      RVE_NOTE +
      'Bullets = offer, phone, website (empty ones skipped; topped up from call to action, headline and ' +
      'business name so the list is never empty; max 3 rows of ≤ 32 characters). The discs keep the ' +
      'upstream deep → mid → light ramp, rebuilt from the brand primary. A soft text shadow is added for ' +
      'legibility; the upstream has no background, so nothing else paints.',
  },
  previewCompatible: true,
}

/* -------------------------------------------------------------------------- */
/* Full-scene intro cards                                                      */
/* -------------------------------------------------------------------------- */

/** Natural length of the cinematic title card (subtitle in by frame 60). */
const CINEMATIC_TITLE_FRAMES = 120

/** Natural length of the quote card (attribution in by frame 45). */
const QUOTE_CARD_FRAMES = 120

export const rveCinematicTitleIntroTemplate: RemotionDesignTemplate = {
  id: 'rve-cinematic-title-intro',
  name: 'Cinematic Title Card',
  description: 'A moody title card with your headline, a brand underline and your business name.',
  category: 'full-scene',
  source: rveSource('cinematic-title-intro'),
  component: RveCinematicTitleIntroDesign,
  textSlots: [
    { key: 'headline', field: 'headline', label: 'Title', primary: true },
    { key: 'businessName', field: 'businessName', label: 'Subtitle' },
  ],
  colors: [
    { role: 'primary', label: 'Background & underline' },
    { role: 'accent', label: 'Background & underline end' },
    { role: 'text', label: 'Title colour' },
  ],
  media: [],
  animation: {
    durationInFrames: 60,
    delayInFrames: 0,
    easing: 'spring(damping: 14, mass: 0.8) title rise, underline 20–50 f, subtitle fade 40–60 f',
  },
  placement: introPlacement(CINEMATIC_TITLE_FRAMES),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      RVE_NOTE +
      `Full-scene intro card: the upstream dark gradient is the design, rebuilt from deep shades of the ` +
      `brand primary and accent; the layer ends at frame ${CINEMATIC_TITLE_FRAMES} to reveal the video. ` +
      'Title wraps to at most two lines.',
  },
  previewCompatible: true,
}

export const rveQuoteCardTemplate: RemotionDesignTemplate = {
  id: 'rve-quote-card',
  name: 'Quote Card',
  description: 'Your headline as an elegant quote, signed with your business name.',
  category: 'full-scene',
  source: rveSource('quote-card'),
  component: RveQuoteCardDesign,
  textSlots: [
    { key: 'headline', field: 'headline', label: 'Quote', primary: true },
    { key: 'businessName', field: 'businessName', label: 'Attribution' },
  ],
  colors: [
    { role: 'primary', label: 'Card & quote mark' },
    { role: 'text', label: 'Quote colour' },
  ],
  media: [],
  animation: {
    durationInFrames: 45,
    delayInFrames: 0,
    easing: 'linear fades: quote mark 0–15 f, quote 10–30 f, attribution slide 30–45 f',
  },
  placement: introPlacement(QUOTE_CARD_FRAMES),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      RVE_NOTE +
      `Full-scene intro card on a deep brand-primary background; the layer ends at frame ${QUOTE_CARD_FRAMES}. ` +
      'The quote is the headline (then offer), truncated at about four lines; the attribution is ' +
      '"— business name". The upstream Georgia serif is replaced by the bundled deterministic typeface.',
  },
  previewCompatible: true,
}

export const rveCreditsRollTemplate: RemotionDesignTemplate = {
  id: 'rve-credits-roll',
  name: 'Credits Roll',
  description: 'Film-style rolling credits featuring your business, offer and contact details.',
  category: 'full-scene',
  source: rveSource('credits-roll'),
  component: RveCreditsRollDesign,
  textSlots: [
    { key: 'businessName', field: 'businessName', label: 'Presented by', primary: true },
    { key: 'headline', field: 'headline', label: 'Featuring' },
    { key: 'offer', field: 'offer', label: 'Special offer' },
    { key: 'phone', field: 'phone', label: 'Call' },
    { key: 'website', field: 'website', label: 'Visit' },
    { key: 'cta', field: 'cta', label: 'Get started' },
  ],
  colors: [
    { role: 'primary', label: 'Background & role labels' },
    { role: 'text', label: 'Name colour' },
  ],
  media: [],
  animation: {
    durationInFrames: CREDITS_ROLL_FRAMES,
    delayInFrames: 0,
    easing: 'linear scroll, speed derived so the roll clears the canvas in 150 frames',
  },
  placement: introPlacement(CREDITS_ROLL_FRAMES),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      RVE_NOTE +
      'Credits are built from brand fields with fixed English role labels: Presented by (business name), ' +
      'Featuring (headline), Special offer, Call (phone), Visit (website), Get started (call to action); ' +
      'empty fields are skipped. The upstream fixed 1.5 px/frame scroll is replaced by a speed derived from ' +
      `the content height so the whole roll crosses the canvas in ${CREDITS_ROLL_FRAMES} frames — the layer's endFrame.`,
  },
  previewCompatible: true,
}

export const rveCountdownIntroTemplate: RemotionDesignTemplate = {
  id: 'rve-countdown-intro',
  name: 'Countdown Intro',
  description: 'A 3-2-1 countdown ring that lands on your call to action.',
  category: 'full-scene',
  source: rveSource('countdown-intro'),
  component: RveCountdownIntroDesign,
  textSlots: [
    { key: 'cta', field: 'cta', label: 'Closing word', primary: true, maxLength: 24 },
  ],
  colors: [
    { role: 'primary', label: 'Background, ring & closing word' },
    { role: 'text', label: 'Digit colour' },
  ],
  media: [],
  animation: {
    durationInFrames: 90,
    delayInFrames: 0,
    easing: '3 × 1 s ring drain (fps-based), then spring(damping: 8, stiffness: 100) closing word',
  },
  placement: introPlacement(COUNTDOWN_INTRO_FRAMES),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      RVE_NOTE +
      `Full-scene intro card on a deep brand-primary background; the layer ends at frame ${COUNTDOWN_INTRO_FRAMES} ` +
      '(3 s countdown + 1 s on the closing word at 30 fps — the countdown itself follows the composition fps). ' +
      'The closing word is the call to action, kept on one line. The ring SVG declares no ids.',
  },
  previewCompatible: true,
}

/** Batch 3e designs, in registration order. */
export const BATCH_3E_TEMPLATES: RemotionDesignTemplate[] = [
  rveBounceTextTemplate,
  rveBubblePopTextTemplate,
  rveCinematicTitleIntroTemplate,
  rveFloatingBubbleTextTemplate,
  rvePulsingTextTemplate,
  rveTitleSplitTemplate,
  rveTypewriterSubtitleTemplate,
  rveTextHighlightTemplate,
  rveQuoteCardTemplate,
  rveCreditsRollTemplate,
  rveNotificationPopTemplate,
  rveSubscribeReminderTemplate,
  rveLowerThirdTemplate,
  rveAnimatedListTemplate,
  rveCountdownIntroTemplate,
]

/** Batch 3e designs that hardcode SVG ids (one instance per composition). */
export const BATCH_3E_FIXED_SVG_IDS: Record<string, string[]> = {}
