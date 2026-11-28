/** "Improve video": a gentle look derived from measured brightness. Reversible: it is only a Look setting. */
import { NEUTRAL_LOOK, isNeutralLook, type LookSettings } from '../preview/effects'

export function improveLook(meanBrightness: number): LookSettings {
  // Target a mid-tone average; at most +-0.5 stop so the result never looks processed.
  const wanted = Math.log2(125 / Math.max(20, Math.min(235, meanBrightness)))
  const exposure = Math.abs(wanted) < 0.12 ? 0 : Math.round(Math.max(-0.5, Math.min(0.5, wanted * 0.7)) * 100) / 100
  return { ...NEUTRAL_LOOK, preset: 'improve', exposure, contrast: 1.06, saturation: 1.08 }
}

/** Only applied over a neutral look, so a look the customer built is never replaced silently. */
export const canApplyImprove = (current: LookSettings | undefined): boolean => isNeutralLook(current)
