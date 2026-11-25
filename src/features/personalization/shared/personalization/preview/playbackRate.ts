/**
 * Preview speed for the live player (the captions editor's 0.75x to 1.5x control). Speed affects the preview only, never the export.
 * No React, no repo imports; identical in remix-new-editor and OpenHiggsBolt.
 */
export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5] as const

/** A rate the player accepts: finite, positive, within 0.25x to 2x; anything else plays at normal speed. */
export function clampPlaybackRate(rate: unknown): number {
  const n = Number(rate)
  return Number.isFinite(n) && n > 0 ? Math.min(2, Math.max(0.25, n)) : 1
}
