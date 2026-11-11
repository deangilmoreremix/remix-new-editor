/**
 * remix-new-editor shim for OpenHiggsBolt's entitlement constants. remix does
 * not gate personalization behind a SmartVideo plan, so these are only kept
 * for the ported code's call sites.
 */
export const ENTITLEMENTS = {
  SMARTVIDEO_GO: 'smartvideo_go',
  SMARTVIDEO_AI: 'smartvideo_ai',
  SMARTVIDEO_VIRAL: 'smartvideo_viral',
  FOUNDERS: 'founders',
} as const

export type EntitlementKey = typeof ENTITLEMENTS[keyof typeof ENTITLEMENTS]
