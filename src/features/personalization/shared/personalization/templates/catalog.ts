/**
 * The concrete catalog of the Remotion designs.
 *
 * Phase 1 shipped five upstream templates (MIT, © 2026 Trimora Inc. /
 * RenderComp) as customer-facing "designs". Phase 2 (batch 1) adds ten more
 * from the same upstream repository, and Phase 2 (batch 2) adds four more from
 * a SECOND upstream repository (MIT, React Video Editor / remotion-templates).
 * Every entry pairs an upstream template with an adapter component that maps
 * the customer's brand data onto the upstream's props — the repo-1 upstream
 * files in `./_upstream` are frozen and are never edited (the repo-2 copies
 * are edited under contract addition C8, and every edit is recorded in the
 * copy's own header).
 *
 * The contract the adapters implement is documented in
 * `./_upstream/ADAPTER-SPEC.md`; the short version is:
 *
 *  - the upstream lays itself out against the COMPOSITION, so every adapter
 *    renders it inside a composition-sized canvas that is scaled into the
 *    design box (see `./designs/shared.tsx`);
 *  - the customer's video stays visible: every canvas fill is forced to
 *    `transparent`, except the end card, which is deliberately rendered as a
 *    bounded, solid CTA card;
 *  - the MIT attribution travels with every design (`source.attribution`),
 *    is available to the product UI through
 *    `getRemotionDesignAttributionLine()` / `REMOTION_DESIGN_LICENSE_NOTICE`,
 *    and is drawn as a small credit line inside the design itself.
 *
 * Upstream provenance (see `./_upstream/README.md`):
 *  - upstream repository: https://github.com/deangilmoreremix/free-remotion-templates
 *  - canonical repository (the repo's own `package.json → repository`):
 *    https://github.com/RenderComp/free-remotion-templates
 *  - the two URLs differ: the first is the clone the templates were copied
 *    from, the second is the canonical project the attribution points at.
 */

import { registerRemotionDesignTemplates } from './registry'
import type { RemotionDesignTemplate } from './types'
import {
  AnimatedHeadlineDesign,
  LogoRevealDesign,
  LowerThirdDesign,
  PromoCtaDesign,
  VisualEffectDesign,
} from './designs'
// The Phase 2 batch-1 adapters are imported from their own modules rather
// than from the `./designs` barrel: the barrel is a shared file, and this
// lane must not write to a file another lane may be editing at the same time.
// A11 may add the barrel re-exports once every lane has landed.
import { BarChartAnimDesign, BAR_CHART_PLACEHOLDER_BARS } from './designs/BarChartAnimDesign'
import { BrushStrokeRevealDesign } from './designs/BrushStrokeRevealDesign'
import { ChapterTitleDesign } from './designs/ChapterTitleDesign'
import { GlitchTextDesign } from './designs/GlitchTextDesign'
import { LogoBlurRevealDesign } from './designs/LogoBlurRevealDesign'
import { LogoBounceDropDesign } from './designs/LogoBounceDropDesign'
import { LogoMaskWipeDesign } from './designs/LogoMaskWipeDesign'
import { LogoSplitRevealDesign } from './designs/LogoSplitRevealDesign'
import { StarfieldWarpDesign } from './designs/StarfieldWarpDesign'
import { TextMaskRevealDesign } from './designs/TextMaskRevealDesign'
// The Phase 2 batch-2 entries (the React Video Editor templates) come from
// their own module, which exports ready-to-register entries and registers
// nothing by itself.
import {
  RVE_ATTRIBUTION,
  RVE_CATALOG_ENTRIES,
  RVE_LICENSE_NOTICE,
} from './designs/rveCatalogEntries'
import { DESIGN_FONT_ALIAS_NOTE, DESIGN_FONT_ATTRIBUTION, DESIGN_FONT_LICENSE_FILE } from './typography'

// The typeface constants are re-exported from the catalog lane (like the
// repo-2 notices above), so the product's credits surface can reach every
// upstream AND typeface notice from ONE module (Phase 3 decision D2).
export { DESIGN_FONT_ATTRIBUTION, DESIGN_FONT_LICENSE_FILE }

// The repo-2 credit constants are re-exported from the catalog lane, so the
// product's credits surface can reach every upstream's notice from ONE
// module.
export { RVE_ATTRIBUTION, RVE_LICENSE_NOTICE }

/* -------------------------------------------------------------------------- */
/* Attribution                                                                 */
/* -------------------------------------------------------------------------- */

/** The upstream repository the templates were copied from. */
export const REMOTION_DESIGN_REPOSITORY = 'free-remotion-templates'

/** The clone the templates were copied from (the upstream's own git remote). */
export const REMOTION_DESIGN_REPOSITORY_URL =
  'https://github.com/deangilmoreremix/free-remotion-templates'

/** The canonical upstream project (the repo's own `package.json → repository`). */
export const REMOTION_DESIGN_CANONICAL_REPOSITORY_URL =
  'https://github.com/RenderComp/free-remotion-templates'

/** The SPDX identifier of the upstream licence. */
export const REMOTION_DESIGN_LICENSE = 'MIT'

/**
 * The credit line the product must display.
 *
 * Exact string required by the upstream README; every design carries it in
 * its `source.attribution`.
 */
export const REMOTION_DESIGN_ATTRIBUTION =
  '© 2026 Trimora Inc. — Remotion templates by RenderComp (free-remotion-templates), MIT License. https://github.com/RenderComp/free-remotion-templates'

/**
 * The verbatim MIT permission notice.
 *
 * The MIT licence requires the copyright notice AND the permission notice to
 * be retained in all copies or substantial portions of the software, so the
 * product's credits surface has to show both.
 */
export const REMOTION_DESIGN_LICENSE_NOTICE = `Copyright (c) 2026 Trimora Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`

/**
 * The credit line shown in the product UI.
 *
 * The Step 4 "Designs" chip row (`guided/StepPreviewApprove.tsx`) is owned by
 * another module and could not be edited here, so the UI has to render this
 * line itself (e.g. under the chip row, or in the product's credits surface).
 *
 * Phase 2 draws from TWO upstream repositories, so this aggregates every
 * DISTINCT `source.attribution` value the catalog actually uses (contract
 * addition C10): the RenderComp line and the React Video Editor line. A
 * project that uses designs from both repositories has to show both credits.
 */
export function getRemotionDesignAttributionLine(): string {
  const lines: string[] = []
  for (const template of REMOTION_DESIGN_TEMPLATES) {
    const attribution = template?.source?.attribution?.trim()
    if (!attribution) continue
    if (!lines.includes(attribution)) lines.push(attribution)
  }
  // The typeface attribution (Phase 3 decision D2): every design is set in
  // the bundled Inter subset, so the OFL notice joins the upstream credits.
  // Appended last, after the repository lines.
  lines.push(DESIGN_FONT_ATTRIBUTION)
  return lines.join('\n')
}

/**
 * The verbatim MIT permission notices, for the product's credits surface.
 *
 * One notice per upstream repository: the repo-1 notice names its copyright
 * holder, the repo-2 notice does not (that repository names no holder), so
 * they are kept apart and both are shown.
 */
export function getRemotionDesignLicenseNotice(): string {
  // The typeface notice (Phase 3 decision D2): OFL 1.1 clause 2 requires the
  // licence to accompany every copy of the font, so the credits surface
  // points at the shipped licence file.
  return `${REMOTION_DESIGN_LICENSE_NOTICE}\n\n${RVE_LICENSE_NOTICE}\n\nTypeface licence: the bundled Inter subset is distributed under the SIL Open Font License 1.1 (Copyright 2016 The Inter Project Authors). The full licence text ships at ${DESIGN_FONT_LICENSE_FILE}. ${DESIGN_FONT_ALIAS_NOTE}`
}

/* -------------------------------------------------------------------------- */
/* Fixed SVG ids (Phase 3 item 13)                                            */
/* -------------------------------------------------------------------------- */

/**
 * Designs that hardcode SVG `id` attributes, keyed by template id.
 *
 * WHY THE CONSTRAINT EXISTS: SVG `id`s are document-global. A design such as
 * `logo-mask-wipe` draws a `<clipPath id="lmw-wipe">` (and `logo-reveal`
 * draws `<clipPath id="lsd-shine-clip">`, `rve-circular-progress` a
 * `<linearGradient id="progressGradient">`). If TWO instances of the same
 * design are mounted in one composition, both instances reference the id and
 * the browser/rendeder resolves the reference to the FIRST one in the
 * document — so the second instance is CLIPPED (or gradient-filled) against
 * the first one's geometry. This is a frozen-upstream trait (contract
 * addition C7) and cannot be fixed inside the upstream files, so it is
 * declared here and surfaced as a warning in the Step 4 UI.
 *
 * The marker lives in THIS standalone map rather than on the template
 * objects, because the batch-2 (RVE) template objects are built in
 * `designs/rveCatalogEntries.ts`, which is owned by another lane.
 */
export const REMOTION_DESIGN_FIXED_SVG_IDS: Record<string, string[]> = {
  'logo-mask-wipe': ['lmw-wipe'],
  'logo-reveal': ['lsd-shine-clip'],
  'rve-circular-progress': ['progressGradient'],
}

/**
 * The human-readable warning for a design that uses fixed SVG ids.
 *
 * Returns `null` for unconstrained designs, unknown ids and `undefined`/
 * `null` (no design selected), so the Step 4 UI can render the warning only
 * when it applies.
 */
export function getRemotionDesignFixedSvgIdWarning(
  templateId: string | null | undefined,
): string | null {
  if (!templateId) return null
  const fixedIds = REMOTION_DESIGN_FIXED_SVG_IDS[templateId]
  if (!fixedIds || fixedIds.length === 0) return null
  const idList = fixedIds.map((id) => `"${id}"`).join(', ')
  return (
    `This design uses fixed SVG ids (${idList}), so only ONE instance of it can appear per composition — ` +
    'a second instance is clipped by the first because the SVG ids collide.'
  )
}

/* -------------------------------------------------------------------------- */
/* Templates                                                                   */
/* -------------------------------------------------------------------------- */

/** Builds the `source` block every design carries. */
function upstreamSource(sourcePath: string): RemotionDesignTemplate['source'] {
  return {
    repository: REMOTION_DESIGN_REPOSITORY,
    repositoryUrl: REMOTION_DESIGN_REPOSITORY_URL,
    sourcePath,
    license: REMOTION_DESIGN_LICENSE,
    attribution: REMOTION_DESIGN_ATTRIBUTION,
  }
}

/**
 * The animated headline.
 *
 * The upstream bounces the whole headline in (a damped `abs(sin)`), centred in
 * the composition. The design box is smaller than the composition, so the
 * headline lands in the middle of the box.
 */
export const animatedHeadlineTemplate: RemotionDesignTemplate = {
  id: 'animated-headline',
  name: 'Animated Headline',
  description: 'A headline that bounces into place over your video.',
  category: 'animated-headline',
  source: upstreamSource('src/components/bounce-in-headline/BounceInHeadline.tsx'),
  component: AnimatedHeadlineDesign,
  defaultProps: {
    // The upstream default is an opaque `#111827` canvas; an overlay must
    // never paint over the customer's video.
    background: 'transparent',
  },
  textSlots: [{ key: 'headline', field: 'headline', label: 'Headline', primary: true }],
  colors: [{ role: 'text', label: 'Headline colour' }],
  media: [],
  animation: {
    durationInFrames: 36,
    delayInFrames: 0,
    easing: 'damped abs(sin) bounce',
  },
  placement: { x: 0.5, y: 0.42, scale: 0.55, opacity: 1, animation: 'pop' },
  aspectRatios: ['16:9', '9:16', '1:1', '4:5'],
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: no staticFile, no media components, no filters. ' +
      'The upstream hardcodes fontSize 130, which the scale-wrapper keeps proportional to the composition.',
  },
  previewCompatible: true,
}

/**
 * The logo reveal.
 *
 * The upstream draws a monogram badge and a wordmark; it has no image prop,
 * so the adapter draws the customer's logo over the badge when one is set
 * (and blanks the monogram so the two do not overlap).
 */
export const logoRevealTemplate: RemotionDesignTemplate = {
  id: 'logo-reveal',
  name: 'Logo Reveal',
  description: 'Your logo draws itself into a branded badge.',
  category: 'logo-reveal',
  source: upstreamSource('src/components/logo-stroke-draw/LogoStrokeDraw.tsx'),
  component: LogoRevealDesign,
  defaultProps: {
    // The upstream default is an opaque `#0a0800` canvas.
    backgroundColor: 'transparent',
  },
  textSlots: [
    { key: 'businessName', field: 'businessName', label: 'Business name', primary: true },
  ],
  colors: [
    { role: 'accent', label: 'Badge accent' },
    { role: 'text', label: 'Wordmark colour' },
  ],
  media: [{ role: 'logo', label: 'Logo', required: false }],
  animation: {
    durationInFrames: 110,
    delayInFrames: 0,
    easing: 'interpolate + spring(damping: 14, stiffness: 90)',
  },
  placement: { x: 0.5, y: 0.45, scale: 0.4, opacity: 1, animation: 'logo-reveal' },
  aspectRatios: ['16:9', '9:16', '1:1', '4:5'],
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: the badge is inline SVG, the logo is a regular <Img>. ' +
      'The logo is optional — without one the monogram lockup is used instead. ' +
      'The upstream uses the fixed SVG clipPath id "lsd-shine-clip", so at most ONE instance of this ' +
      'design may be mounted per composition (contract addition C7).',
  },
  previewCompatible: true,
}

/**
 * The lower third.
 *
 * The upstream anchors a glass card to the bottom-left of the composition.
 * Both text lines use `whiteSpace: "nowrap"`, so the adapter truncates them.
 */
export const lowerThirdTemplate: RemotionDesignTemplate = {
  id: 'lower-third',
  name: 'Lower Third',
  description: 'A glass name card for your presenter or offer.',
  category: 'lower-third',
  source: upstreamSource('src/components/lower-third-glass-card/LowerThirdGlassCard.tsx'),
  component: LowerThirdDesign,
  defaultProps: {
    // The upstream default is an opaque `#0c1a2e` canvas.
    backgroundColor: 'transparent',
  },
  textSlots: [
    { key: 'businessName', field: 'businessName', label: 'Name', primary: true },
    { key: 'offer', field: 'offer', label: 'Title' },
  ],
  colors: [
    { role: 'accent', label: 'Card accent' },
    { role: 'text', label: 'Text colour' },
  ],
  media: [],
  animation: {
    durationInFrames: 120,
    delayInFrames: 0,
    easing: 'spring(damping: 18, stiffness: 90)',
  },
  // The upstream card sits at 74 % of the composition height; the placement
  // below keeps the whole card inside the frame (the card would otherwise be
  // clipped by the bottom edge).
  placement: { x: 0.3, y: 0.6, scale: 0.62, opacity: 1, animation: 'slide-up' },
  aspectRatios: ['16:9', '9:16', '1:1', '4:5'],
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path. The frosted look uses backdrop-filter: blur(14px) — ' +
      'if the rasteriser drops the blur the card degrades to a translucent white gradient and stays legible. ' +
      'Verify in an exported frame.',
  },
  previewCompatible: true,
}

/**
 * The promotional end card.
 *
 * The upstream is not transparent by design: its `background` prop is both the
 * card fill and the CTA label colour. The adapter renders it as a bounded,
 * solid CTA card (the box is smaller than the composition), so the video stays
 * visible around it.
 */
export const promoCtaTemplate: RemotionDesignTemplate = {
  id: 'promo-cta',
  name: 'Promo CTA',
  description: 'A branded end card with a call to action.',
  category: 'promo-cta',
  source: upstreamSource('src/components/end-card/EndCard.tsx'),
  component: PromoCtaDesign,
  defaultProps: {
    // A sentinel, not a colour: the upstream uses `background` as BOTH the
    // card fill and the CTA label colour, so the adapter derives it from the
    // brand primary and darkens it for contrast.
    background: 'brand-primary',
  },
  textSlots: [
    { key: 'headline', field: 'headline', label: 'Headline', primary: true },
    { key: 'offer', field: 'offer', label: 'Subtitle' },
    { key: 'cta', field: 'cta', label: 'Call to action' },
  ],
  colors: [
    { role: 'primary', label: 'Card colour' },
    { role: 'accent', label: 'CTA colour' },
    { role: 'text', label: 'Title colour' },
  ],
  media: [],
  animation: {
    durationInFrames: 150,
    delayInFrames: 0,
    easing: 'spring(damping: 12, stiffness: 80) + cubic ease-out',
  },
  placement: { x: 0.5, y: 0.72, scale: 0.55, opacity: 1, animation: 'slide-up' },
  aspectRatios: ['16:9', '9:16', '1:1', '4:5'],
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path. The upstream paints an opaque canvas by design: the design box ' +
      '(scale 0.55) bounds it into a CTA card, so the video stays visible around it. The CTA pill uses the ' +
      'brand accent and its label uses the card colour — pick an accent that contrasts with the primary.',
  },
  previewCompatible: true,
}

/**
 * The bokeh particle effect.
 *
 * A full-frame, seamless particle loop. It is placed at `scale = 1` with
 * `animation: 'none'` and `opacity: 1` so that neither the composition nor
 * the scale-wrapper creates a stacking context — otherwise the upstream's
 * `mix-blend-mode: screen` would be confined and the discs would lose their
 * light-leak blend (they still render, just unblended).
 */
export const visualEffectTemplate: RemotionDesignTemplate = {
  id: 'visual-effect',
  name: 'Bokeh Particles',
  description: 'Soft bokeh particles drifting over your video.',
  category: 'visual-effect',
  source: upstreamSource('src/components/bokeh-circles/BokehCircles.tsx'),
  component: VisualEffectDesign,
  defaultProps: {
    // The upstream default is an opaque `#1a0f1f` canvas.
    baseColor: 'transparent',
  },
  textSlots: [],
  colors: [
    { role: 'accent', label: 'Particle accent' },
    { role: 'primary', label: 'Particle colour' },
    { role: 'text', label: 'Particle highlight' },
  ],
  media: [],
  animation: {
    durationInFrames: 150,
    delayInFrames: 0,
    easing: 'seamless sin/cos drift loop',
  },
  placement: { x: 0.5, y: 0.5, scale: 1, opacity: 1, animation: 'none' },
  aspectRatios: ['16:9', '9:16', '1:1', '4:5'],
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path. The discs are drawn with rasteriser-safe primitives — ' +
      'a solid fill plus a boxShadow glow (the @remotion/web-renderer implements no radial-gradient, ' +
      'no filter and no blend modes, so the upstream gradient+blur+screen trio rasterised to ' +
      'nothing). Same seeded motion and palette as the upstream; proven in the encoded export ' +
      'matrix (error: null).',
  },
  previewCompatible: true,
}

/* -------------------------------------------------------------------------- */
/* Phase 2 — batch 1 designs (upstream repo 1)                                */
/* -------------------------------------------------------------------------- */

/**
 * The starfield warp.
 *
 * A full-frame particle field: stars stream radially outward from the centre
 * of the composition. The upstream's `baseColor` is a plain canvas fill, so
 * it is forced to `transparent`, and its optional `label` MUST stay
 * `undefined` — the upstream default is the demo string `"BACKGROUND"`.
 *
 * It is placed full-frame (`scale = 1`, `animation: 'none'`, `opacity: 1`).
 * Unlike `bokeh-circles` the upstream uses no `mix-blend-mode` and no
 * `filter`, so the stacking context a scale-wrapper would create could not
 * confine anything.
 *
 * Local adapter customization (Phase 3, finding F2): the adapter renders a
 * local derivative of the upstream with 3–7 px star cores instead of the
 * upstream's 1–3.5 px, so the stars keep their colour through H.264 export.
 * The frozen upstream file is unmodified; see `designs/StarfieldWarpDesign.tsx`.
 */
export const starfieldWarpTemplate: RemotionDesignTemplate = {
  id: 'starfield-warp',
  name: 'Starfield Warp',
  description: 'Stars streaming outward from the centre of your video.',
  category: 'visual-effect',
  source: upstreamSource('src/components/starfield/Starfield.tsx'),
  component: StarfieldWarpDesign,
  defaultProps: {
    // The upstream default is an opaque `#02030a` canvas.
    baseColor: 'transparent',
  },
  textSlots: [],
  colors: [
    { role: 'text', label: 'Star colour' },
    { role: 'accent', label: 'Star accent' },
  ],
  media: [],
  animation: {
    durationInFrames: 150,
    delayInFrames: 0,
    easing: 'frame-driven radial warp loop',
  },
  placement: { x: 0.5, y: 0.5, scale: 1, opacity: 1, animation: 'none' },
  aspectRatios: ['16:9', '9:16', '1:1', '4:5'],
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: plain CSS gradients and box-shadows only — no filter, ' +
      'no blend mode, no staticFile, no media components. The effect is full-frame (scale 1, ' +
      'animation none) and no label is drawn, so no demo text can appear. Local adapter ' +
      'customization: star cores are 3–7 px (upstream 1–3.5 px) so they survive H.264 ' +
      'quantisation in the exported MP4; the frozen upstream file is unmodified.',
  },
  previewCompatible: true,
}

/**
 * The bouncing logo drop.
 *
 * The upstream drops a wordmark in from above and lets it bounce. It is
 * pinned to text mode (`svgPath` is empty — the adapter has no SVG path data
 * for the customer's brand) and the display size is computed from the
 * composition width so the wordmark cannot run off a portrait canvas.
 */
export const logoBounceDropTemplate: RemotionDesignTemplate = {
  id: 'logo-bounce-drop',
  name: 'Logo Bounce Drop',
  description: 'Your name drops in and bounces on landing.',
  category: 'logo-reveal',
  source: upstreamSource('src/components/logo-bounce-drop/LogoBounceDrop.tsx'),
  component: LogoBounceDropDesign,
  defaultProps: {
    // The upstream default is an opaque `#F8FAFC` canvas.
    backgroundColor: 'transparent',
    // Text mode: the adapter has no SVG path data for the customer's brand.
    svgPath: '',
  },
  textSlots: [
    { key: 'businessName', field: 'businessName', label: 'Business name', primary: true },
  ],
  colors: [{ role: 'text', label: 'Wordmark colour' }],
  media: [],
  animation: {
    durationInFrames: 90,
    delayInFrames: 0,
    easing: 'spring(damping: 10, stiffness: 80)',
  },
  placement: { x: 0.5, y: 0.5, scale: 0.7, opacity: 1, animation: 'logo-reveal' },
  aspectRatios: ['16:9', '9:16', '1:1', '4:5'],
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: spring() and transform only. The upstream is pinned to ' +
      'text mode (svgPath is empty) and the canvas is forced transparent. The display size is ' +
      'computed from the composition width — the upstream default of 240px assumes a 1920px canvas.',
  },
  previewCompatible: true,
}

/**
 * The diagonal mask wipe.
 *
 * The upstream reveals a monogram badge and a wordmark through a diagonal
 * mask. Two upstream traits are not switchable and are declared here: the
 * 13 %-alpha accent glow that washes the canvas, and the fixed SVG clipPath
 * id `lmw-wipe` (one instance per composition).
 */
export const logoMaskWipeTemplate: RemotionDesignTemplate = {
  id: 'logo-mask-wipe',
  name: 'Logo Mask Wipe',
  description: 'A diagonal wipe reveals your name in a badge.',
  category: 'logo-reveal',
  source: upstreamSource('src/components/logo-mask-wipe/LogoMaskWipe.tsx'),
  component: LogoMaskWipeDesign,
  defaultProps: {
    // The upstream default is an opaque `#0a0800` canvas.
    backgroundColor: 'transparent',
  },
  textSlots: [
    { key: 'businessName', field: 'businessName', label: 'Business name', primary: true },
  ],
  colors: [
    { role: 'accent', label: 'Badge accent' },
    { role: 'text', label: 'Wordmark colour' },
  ],
  media: [],
  animation: {
    durationInFrames: 100,
    delayInFrames: 0,
    easing: 'interpolate diagonal wipe + spring(damping: 16, stiffness: 95)',
  },
  placement: { x: 0.5, y: 0.45, scale: 0.6, opacity: 1, animation: 'logo-reveal' },
  aspectRatios: ['16:9', '9:16', '1:1', '4:5'],
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: inline SVG clipPath only, no filter. Two upstream traits ' +
      'are not switchable — a 13%-alpha accent glow washes the whole canvas (the design is placed ' +
      'at scale 0.6 so it stays inside the box) and the clipPath uses the fixed DOM id "lmw-wipe", ' +
      'so use at most one instance of this design per composition.',
  },
  previewCompatible: true,
}

/**
 * The split logo reveal.
 *
 * The upstream draws the wordmark twice, each half clipped to one side, and
 * the halves converge. `splitOffset` is computed from the composition width
 * because the upstream default (960 px) assumes a 1920 px canvas.
 */
export const logoSplitRevealTemplate: RemotionDesignTemplate = {
  id: 'logo-split-reveal',
  name: 'Logo Split Reveal',
  description: 'Your name splits in half and slides together.',
  category: 'logo-reveal',
  source: upstreamSource('src/components/logo-split-reveal/LogoSplitReveal.tsx'),
  component: LogoSplitRevealDesign,
  defaultProps: {
    // The upstream default is an opaque `#F8FAFC` canvas.
    backgroundColor: 'transparent',
  },
  textSlots: [
    { key: 'businessName', field: 'businessName', label: 'Business name', primary: true },
  ],
  colors: [{ role: 'text', label: 'Wordmark colour' }],
  media: [],
  animation: {
    durationInFrames: 120,
    delayInFrames: 0,
    easing: 'Easing.out(Easing.cubic) split convergence',
  },
  placement: { x: 0.5, y: 0.5, scale: 0.7, opacity: 1, animation: 'logo-reveal' },
  aspectRatios: ['16:9', '9:16', '1:1', '4:5'],
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: clip-path and transform only. The split offset is ' +
      'computed from the composition width (the upstream default of 960px assumes a 1920px canvas) ' +
      'and the upstream clamps the wordmark to the title-safe area itself.',
  },
  previewCompatible: true,
}

/**
 * The brush-stroke headline.
 *
 * The upstream paints the headline in horizontal brush bands. Its `background`
 * prop defaults to the OPAQUE cream `#fffdf6` in both the default-props object
 * and the destructuring default, so the adapter always passes `"transparent"`.
 */
export const brushStrokeRevealTemplate: RemotionDesignTemplate = {
  id: 'brush-stroke-reveal',
  name: 'Brush Stroke Headline',
  description: 'Your headline painted on stroke by stroke.',
  category: 'animated-headline',
  source: upstreamSource('src/components/brush-stroke-reveal/BrushStrokeReveal.tsx'),
  component: BrushStrokeRevealDesign,
  defaultProps: {
    // The upstream default is the OPAQUE cream `#fffdf6` — a footgun.
    background: 'transparent',
  },
  textSlots: [
    { key: 'headline', field: 'headline', label: 'Headline', primary: true },
    { key: 'offer', field: 'offer', label: 'Subline' },
  ],
  colors: [
    { role: 'text', label: 'Headline colour' },
    { role: 'accent', label: 'Accent dot' },
  ],
  media: [],
  animation: {
    durationInFrames: 120,
    delayInFrames: 0,
    easing: 'Easing.out(Easing.ease) brush bands',
  },
  placement: { x: 0.5, y: 0.5, scale: 0.65, opacity: 1, animation: 'pop' },
  aspectRatios: ['16:9', '9:16', '1:1', '4:5'],
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: clip-path and scaleX only. The upstream background ' +
      'default is the OPAQUE cream #fffdf6, so the adapter always passes "transparent" explicitly ' +
      'and the canvas fill is never left at the upstream default.',
  },
  previewCompatible: true,
}

/**
 * The masked text reveal.
 *
 * The upstream sweeps an accent block across a stack of lines. The `lines`
 * array is derived from the headline (the upstream's own `["REVEAL"]` fallback
 * is never reachable) and the upstream upper-cases every line. The 13 %-alpha
 * corner glow is not switchable, so the design is placed at `scale < 1`.
 */
export const textMaskRevealTemplate: RemotionDesignTemplate = {
  id: 'text-mask-reveal',
  name: 'Text Mask Reveal',
  description: 'Your headline uncovered line by line.',
  category: 'animated-headline',
  source: upstreamSource('src/components/text-mask-reveal/TextMaskReveal.tsx'),
  component: TextMaskRevealDesign,
  defaultProps: {
    // The upstream default is an opaque `#050818` canvas.
    backgroundColor: 'transparent',
  },
  textSlots: [
    { key: 'headline', field: 'headline', label: 'Headline', primary: true },
  ],
  colors: [
    { role: 'accent', label: 'Sweep block' },
    { role: 'text', label: 'Text colour' },
  ],
  media: [],
  animation: {
    durationInFrames: 110,
    delayInFrames: 0,
    easing: 'ease-in-out block sweep',
  },
  placement: { x: 0.5, y: 0.5, scale: 0.7, opacity: 1, animation: 'fade' },
  aspectRatios: ['16:9', '9:16', '1:1', '4:5'],
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: clip-path only. The lines array is derived from the ' +
      'headline and the upstream fallback ["REVEAL"] is never reachable; the upstream upper-cases ' +
      'every line. A 13%-alpha accent glow in the corner is not switchable, so the design is ' +
      'placed at scale 0.7 and the glow stays inside the box.',
  },
  previewCompatible: true,
}

/**
 * The glitch headline.
 *
 * The upstream stacks three copies of the text and offsets the coloured ones
 * with Remotion's seeded `random()`. The red and cyan layers use
 * `mix-blend-mode: screen`, but the blend happens INSIDE the text stack (the
 * parent div carries a `transform`), so it does not need the video behind it —
 * this is not the `bokeh-circles` failure mode and must not be "fixed".
 */
export const glitchTextTemplate: RemotionDesignTemplate = {
  id: 'glitch-text',
  name: 'Glitch Headline',
  description: 'Your headline tears apart in RGB glitch.',
  category: 'animated-headline',
  source: upstreamSource('src/components/glitch-text/GlitchText.tsx'),
  component: GlitchTextDesign,
  defaultProps: {
    // The upstream default is an opaque `#0A0A0F` canvas.
    backgroundColor: 'transparent',
  },
  textSlots: [
    { key: 'headline', field: 'headline', label: 'Headline', primary: true },
  ],
  colors: [{ role: 'text', label: 'Text colour' }],
  media: [],
  animation: {
    durationInFrames: 120,
    delayInFrames: 0,
    easing: 'seeded random tear offsets',
  },
  placement: { x: 0.5, y: 0.5, scale: 0.7, opacity: 1, animation: 'pop' },
  aspectRatios: ['16:9', '9:16', '1:1', '4:5'],
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path. The red/cyan layers use mix-blend-mode: screen, but the ' +
      'blend happens inside the text stack (the parent div carries a transform), so it does NOT ' +
      'need the video behind it — do not remove the scale-wrapper to "fix" it. The tear bands ' +
      'repaint the background colour, which is transparent, so they read as transparent tear bands.',
  },
  previewCompatible: true,
}

/**
 * The defocusing logo reveal.
 *
 * The upstream resolves a wordmark out of a heavy blur. The blur is the single
 * rasteriser-dependent feature and has to be verified in an exported frame.
 */
export const logoBlurRevealTemplate: RemotionDesignTemplate = {
  id: 'logo-blur-reveal',
  name: 'Logo Focus Reveal',
  description: 'Your name focuses out of a blur.',
  category: 'logo-reveal',
  source: upstreamSource('src/components/logo-blur-reveal/LogoBlurReveal.tsx'),
  component: LogoBlurRevealDesign,
  defaultProps: {
    // The upstream default is an opaque `#F8FAFC` canvas.
    backgroundColor: 'transparent',
  },
  textSlots: [
    { key: 'businessName', field: 'businessName', label: 'Business name', primary: true },
  ],
  colors: [{ role: 'text', label: 'Wordmark colour' }],
  media: [],
  animation: {
    durationInFrames: 120,
    delayInFrames: 0,
    easing: 'Easing.out(Easing.cubic) blur resolve',
  },
  placement: { x: 0.5, y: 0.5, scale: 0.65, opacity: 1, animation: 'fade' },
  aspectRatios: ['16:9', '9:16', '1:1', '4:5'],
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'CONDITIONAL browser export: the wordmark resolves through filter: blur(40px). Chromium ' +
      'supports it, but the blur must be verified in an exported frame. The upstream fades the ' +
      'whole layer out over the last 0.4s of its duration, so the design must not be the last ' +
      'thing on screen. The display size is computed from the composition width.',
  },
  previewCompatible: true,
}

/**
 * The chapter title.
 *
 * The upstream zooms a chapter label in, draws a divider and floats the title
 * and subtitle up. Two upstream traits are not switchable: the 3 %-white
 * full-canvas grid and the hard-coded `rgba(255,255,255,0.6)` subtitle.
 */
export const chapterTitleTemplate: RemotionDesignTemplate = {
  id: 'chapter-title',
  name: 'Chapter Title',
  description: 'A chapter card with a label, a title and a subtitle.',
  category: 'other',
  source: upstreamSource('src/components/chapter-title/ChapterTitle.tsx'),
  component: ChapterTitleDesign,
  defaultProps: {
    // The upstream default is an opaque `#0d1117` canvas.
    background: 'transparent',
  },
  textSlots: [
    { key: 'chapterLabel', field: 'offer', label: 'Chapter label' },
    { key: 'title', field: 'headline', label: 'Title', primary: true },
    { key: 'subtitle', field: 'businessName', label: 'Subtitle' },
  ],
  colors: [
    { role: 'accent', label: 'Chapter label' },
    { role: 'text', label: 'Title colour' },
  ],
  media: [],
  animation: {
    durationInFrames: 150,
    delayInFrames: 0,
    easing: 'Easing.out(Easing.cubic) zoom + float fade',
  },
  placement: { x: 0.5, y: 0.5, scale: 0.75, opacity: 1, animation: 'slide-up' },
  aspectRatios: ['16:9', '9:16', '1:1', '4:5'],
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: transform and linear-gradient only. Two upstream traits ' +
      'are not switchable — a 3%-white grid is painted over the whole canvas (the design is placed ' +
      'at scale 0.75 so the grid stays inside the box) and the subtitle colour is a hard-coded ' +
      'rgba(255,255,255,0.6), which is low contrast over a light video.',
  },
  previewCompatible: true,
}

/**
 * The animated bar chart.
 *
 * The upstream's `bars` array is data the customer cannot supply, so the
 * dataset is pinned as an explicitly labelled placeholder (A6's C13). The
 * bars carry no colour of their own, so the upstream paints them with the
 * brand accent.
 */
export const barChartAnimTemplate: RemotionDesignTemplate = {
  id: 'bar-chart-anim',
  name: 'Animated Bar Chart',
  description: 'A growing bar chart card over your video.',
  category: 'other',
  source: upstreamSource('src/components/bar-chart-anim/BarChartAnim.tsx'),
  component: BarChartAnimDesign,
  defaultProps: {
    // The upstream default is an opaque `#0f172a` canvas.
    background: 'transparent',
    // PINNED PLACEHOLDER DATA: the customer cannot supply chart data, so the
    // bars are an explicitly labelled stand-in. The upstream's own demo
    // dataset ("Quarterly Revenue" / "Q1"…) is never used.
    bars: BAR_CHART_PLACEHOLDER_BARS,
  },
  textSlots: [
    { key: 'title', field: 'headline', label: 'Chart title', primary: true },
    { key: 'subtitle', field: 'offer', label: 'Chart subtitle' },
  ],
  colors: [
    { role: 'accent', label: 'Bar colour' },
    { role: 'text', label: 'Title colour' },
  ],
  media: [],
  animation: {
    durationInFrames: 150,
    delayInFrames: 0,
    easing: 'spring(damping: 16, stiffness: 200) staggered bars',
  },
  placement: { x: 0.5, y: 0.5, scale: 0.7, opacity: 1, animation: 'slide-up' },
  aspectRatios: ['16:9', '9:16', '1:1', '4:5'],
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: spring() and flex only. The bar data is a PINNED ' +
      'PLACEHOLDER dataset (labels "Placeholder 1" to "Placeholder 4") because the customer ' +
      'cannot supply chart data; the upstream demo dataset is never used. The bars are painted ' +
      'with the brand accent.',
  },
  previewCompatible: true,
}

/** The five Phase 1 designs, in registration order. */
export const REMOTION_DESIGN_PHASE1_TEMPLATES: RemotionDesignTemplate[] = [
  animatedHeadlineTemplate,
  logoRevealTemplate,
  lowerThirdTemplate,
  promoCtaTemplate,
  visualEffectTemplate,
]

/** The ten Phase 2 batch-1 designs, in registration order. */
export const REMOTION_DESIGN_BATCH1_TEMPLATES: RemotionDesignTemplate[] = [
  starfieldWarpTemplate,
  logoBounceDropTemplate,
  logoMaskWipeTemplate,
  logoSplitRevealTemplate,
  brushStrokeRevealTemplate,
  textMaskRevealTemplate,
  glitchTextTemplate,
  logoBlurRevealTemplate,
  chapterTitleTemplate,
  barChartAnimTemplate,
]

/**
 * The four Phase 2 batch-2 designs, in registration order.
 *
 * They come from the SECOND upstream repository (the React Video Editor
 * template library), so they carry their own attribution and their own
 * permission notice — see `RVE_ATTRIBUTION` / `RVE_LICENSE_NOTICE`.
 */
export const REMOTION_DESIGN_BATCH2_TEMPLATES: RemotionDesignTemplate[] = [
  ...RVE_CATALOG_ENTRIES,
]

/** Every design, in registration order. */
export const REMOTION_DESIGN_TEMPLATES: RemotionDesignTemplate[] = [
  ...REMOTION_DESIGN_PHASE1_TEMPLATES,
  ...REMOTION_DESIGN_BATCH1_TEMPLATES,
  ...REMOTION_DESIGN_BATCH2_TEMPLATES,
]

// The catalog registers itself on import, so the designs exist before the
// first preview frame.
registerRemotionDesignTemplates(REMOTION_DESIGN_TEMPLATES)
