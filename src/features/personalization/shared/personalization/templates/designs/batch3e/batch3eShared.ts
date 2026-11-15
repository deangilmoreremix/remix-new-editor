/**
 * Batch-local helpers for the batch 3e adapters (React Video Editor text /
 * title templates from `remotion-templates`).
 *
 * The repo-2 templates size everything in `rem` and fixed `px` that were
 * authored against a ~16 px document root, which (a) is not canvas-relative
 * (contract addition C9) and (b) reads tiny on a 1080p frame. Every adapter
 * in this folder therefore converts the upstream's own numbers through ONE
 * unit: "px per upstream rem" derived from the composition, times a per-design
 * zoom. A value the upstream wrote as `N px` is passed as `N * unit / 16`, so
 * every proportion of the upstream layout is kept, only the overall size
 * changes with the composition.
 *
 * This module is a helper module, NOT a design: it exports no
 * `RemotionDesignTemplate`.
 */

import type { RemotionDesignComponentProps } from '../../types'
import { darkenColor, pickColor, slotText, slotValue, truncateText } from '../shared'
import { lightenColor, withAlpha } from '../rveSharedDesign'

export { darkenColor, lightenColor, withAlpha, pickColor, slotText, slotValue, truncateText }

/** The short edge every supported format shares (16:9, 9:16, 1:1, 4:5). */
const REFERENCE_EDGE = 1080

/** The document root size the upstream `rem` values were authored against. */
const UPSTREAM_REM_PX = 16

/**
 * Px per upstream `rem`, from the composition's short edge.
 *
 * `zoom` 1 reproduces the upstream size on a 1080 px short edge.
 */
export function remUnit(props: RemotionDesignComponentProps, zoom: number): number {
  const edge = Math.max(1, Math.min(props.width, props.height))
  return (edge / REFERENCE_EDGE) * UPSTREAM_REM_PX * zoom
}

/**
 * Px per upstream `rem` for templates centred with `left: 50%` + a
 * `translate(-50%)`.
 *
 * Such an element's shrink-to-fit width is capped at HALF the canvas width,
 * so a narrow canvas (9:16, 1:1) needs smaller type than the short edge
 * alone would give. The unit is the short-edge unit, capped by a fraction of
 * the composition width.
 */
export function remUnitForCentred(props: RemotionDesignComponentProps, zoom: number): number {
  const edge = Math.max(1, Math.min(props.width, props.height, props.width * 0.62))
  return (edge / REFERENCE_EDGE) * UPSTREAM_REM_PX * zoom
}

/** Formats a px number for a CSS string prop. */
export function px(value: number): string {
  return `${Math.round(value * 100) / 100}px`
}

/** Average advance of a glyph in the bundled sans face, as a fraction of the font size. */
export const GLYPH_WIDTH_RATIO = 0.6

/**
 * How many characters of `fontPx` type fit into `availablePx`, over `lines`
 * lines, clamped to `[min, cap]`.
 */
export function fitChars(
  availablePx: number,
  fontPx: number,
  lines: number,
  cap: number,
  min = 4,
): number {
  const perLine = Math.floor(Math.max(0, availablePx) / Math.max(1, fontPx * GLYPH_WIDTH_RATIO))
  // Word wrapping wastes part of every line but the last, so a multi-line
  // budget is shaved by 15 %.
  const total = lines > 1 ? Math.floor(perLine * lines * 0.85) : perLine
  return Math.max(min, Math.min(cap, total))
}

/**
 * The largest font size (≤ `basePx`, ≥ `basePx * minRatio`) at which `chars`
 * characters fit on one line of `availablePx`.
 */
export function fitFontPx(
  availablePx: number,
  chars: number,
  basePx: number,
  glyphRatio = GLYPH_WIDTH_RATIO,
  minRatio = 0.4,
): number {
  const needed = Math.max(1, chars) * glyphRatio
  const fit = availablePx / needed
  return Math.max(basePx * minRatio, Math.min(basePx, fit))
}

/** The brand text colour: the layer override, then the brand text colour. */
export function brandText(props: RemotionDesignComponentProps): string {
  return pickColor([props.color, props.colors?.text], '#ffffff')
}

/** The brand primary colour. */
export function brandPrimary(props: RemotionDesignComponentProps): string {
  return pickColor([props.colors?.primary], '#3b82f6')
}

/** The brand accent colour. */
export function brandAccent(props: RemotionDesignComponentProps): string {
  return pickColor([props.colors?.accent, props.colors?.primary], '#7209b7')
}

/**
 * The deep brand backdrop a full-scene card paints instead of the upstream's
 * `#111827`: the brand primary darkened to ~12 % so white type stays legible
 * whatever the primary is.
 */
export function brandSceneColor(props: RemotionDesignComponentProps): string {
  return darkenColor(brandPrimary(props), 0.12)
}

/** A two-stop deep brand gradient for a full-scene card. */
export function brandSceneGradient(props: RemotionDesignComponentProps): string {
  return `linear-gradient(135deg, ${darkenColor(brandPrimary(props), 0.16)} 0%, ${darkenColor(
    brandAccent(props),
    0.08,
  )} 100%)`
}

/** A soft drop shadow that keeps light type legible over any video. */
export const READABLE_TEXT_SHADOW = '0 2px 10px rgba(0, 0, 0, 0.55)'

/** `r, g, b` of a hex colour (for upstream `rgba(${rgb}, a)` templates). */
export function rgbTriplet(value: string, fallback = '59, 130, 246'): string {
  const hex = value.trim().replace(/^#/, '')
  const full =
    hex.length === 3 && /^[0-9a-f]{3}$/i.test(hex)
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex
  if (!/^[0-9a-f]{6}$/i.test(full)) return fallback
  return `${parseInt(full.slice(0, 2), 16)}, ${parseInt(full.slice(2, 4), 16)}, ${parseInt(
    full.slice(4, 6),
    16,
  )}`
}

/** The first non-empty slot of `keys` (no fallback to the primary text). */
export function firstSlot(props: RemotionDesignComponentProps, keys: string[]): string {
  for (const key of keys) {
    const value = slotValue(props, key)
    if (value) return value
  }
  return ''
}
