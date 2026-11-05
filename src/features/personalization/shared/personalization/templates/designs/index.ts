/**
 * The adapter components of the Phase 1 Remotion designs.
 *
 * Each adapter wraps one frozen upstream template
 * (`../_upstream/<id>/<Component>.tsx`) and maps the customer's brand data
 * onto its props. The upstream files are never edited — only their props are
 * supplied.
 */

export { AnimatedHeadlineDesign } from './AnimatedHeadlineDesign'
export { LogoRevealDesign } from './LogoRevealDesign'
export { LowerThirdDesign } from './LowerThirdDesign'
export { PromoCtaDesign } from './PromoCtaDesign'
export { VisualEffectDesign } from './VisualEffectDesign'

export {
  DESIGN_VIDEO_CREDIT,
  DesignCreditLine,
  DesignStage,
  TRANSPARENT,
  darkenColor,
  pickColor,
  slotText,
  slotValue,
  truncateText,
} from './shared'
export type { DesignAdapterProps } from './shared'
