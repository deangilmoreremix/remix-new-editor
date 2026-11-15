/**
 * Batch 3f helpers — shared by the batch-3f adapters only.
 *
 * Batch 3f ports fourteen React Video Editor (`remotion-templates`) data and
 * background templates. Most of them draw a fixed-pixel card (a 900 x 500
 * chart, a 600 x 520 donut) in the middle of a composition-sized root. Two
 * things have to be solved for every one of them:
 *
 *  1. **Size.** The card is authored in px for a 1920 x 1080 gallery frame,
 *     so it is too small on a 16:9 export and too tight on 9:16. `FitCanvas`
 *     renders the upstream on a *virtual* canvas of `width / k` x
 *     `height / k` scaled by `k`, so the upstream's own root (which fills
 *     100 % of its parent) still covers the whole composition, while the card
 *     and its type grow or shrink by `k`. `fitScale()` picks `k` from the
 *     composition: a preferred size on the short edge, capped so the card
 *     always fits inside the canvas.
 *  2. **Brand colour.** The repo-2 data templates share one look (a dark
 *     slate gradient, a 20 %-black panel, white type, a Tailwind palette).
 *     The helpers below rebuild that look from the brand: a deep shade of the
 *     brand primary for the backdrop, a palette ramp of primary + accent for
 *     the series, and a text colour that is guaranteed to read on the dark
 *     backdrop.
 *
 * This module is a helper module, NOT a design: it exports no
 * `RemotionDesignTemplate`.
 */

import React from 'react'
import type { RemotionDesignComponentProps } from '../../types'
import { darkenColor, pickColor } from '../shared'
import { lightenColor } from '../rveSharedDesign'

/* -------------------------------------------------------------------------- */
/* Colour                                                                      */
/* -------------------------------------------------------------------------- */

function parseHex(value: string): { r: number; g: number; b: number } | null {
  const hex = value.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
    }
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    }
  }
  return null
}

/** Normalises a hex colour to `#rrggbb`; other colours are returned unchanged. */
export function toHex6(value: string): string {
  const parsed = parseHex(value)
  if (!parsed) return value
  const pair = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${pair(parsed.r)}${pair(parsed.g)}${pair(parsed.b)}`
}

/**
 * `rgba()` for a hex colour.
 *
 * Inline styles get an `rgba()` string rather than an 8-digit hex, because
 * not every CSS parser (jsdom's included) accepts `#rrggbbaa`.
 * A colour that is not hex is returned unchanged.
 */
export function rgba(value: string, alpha: number): string {
  const parsed = parseHex(value)
  if (!parsed) return value
  const a = Math.max(0, Math.min(1, alpha))
  return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${a})`
}

/** The `{ r, g, b }` channels of a hex colour (`fallback` for anything else). */
export function rgbOf(
  value: string,
  fallback: { r: number; g: number; b: number },
): { r: number; g: number; b: number } {
  return parseHex(value) ?? fallback
}

/** Relative luminance (0 = black, 1 = white); `null` for a non-hex colour. */
function luminance(value: string): number | null {
  const parsed = parseHex(value)
  if (!parsed) return null
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(parsed.r) + 0.7152 * lin(parsed.g) + 0.0722 * lin(parsed.b)
}

/** The brand primary, with the shared default. */
export function brandPrimary(props: RemotionDesignComponentProps): string {
  return toHex6(pickColor([props.colors?.primary], '#29d3f2'))
}

/** The brand accent (falls back to the primary). */
export function brandAccent(props: RemotionDesignComponentProps): string {
  return toHex6(pickColor([props.colors?.accent, props.colors?.primary], '#28c98b'))
}

/** The customer's text colour (layer override first, then the brand text). */
export function brandText(props: RemotionDesignComponentProps): string {
  return pickColor([props.color, props.colors?.text], '#ffffff')
}

/**
 * A text colour that reads on the designed DARK backdrop.
 *
 * The data cards keep their dark panel (it is the design), so a dark brand
 * text colour (say `#111111`) would vanish into it. In that case the type
 * falls back to white; a light or mid brand text colour is used as is.
 */
export function readableOnDark(props: RemotionDesignComponentProps): string {
  const text = brandText(props)
  const lum = luminance(text)
  if (lum !== null && lum < 0.35) return '#ffffff'
  return text
}

/**
 * A series colour that stays visible on the dark backdrop.
 *
 * The backdrop is a deep shade of the brand primary, so a brand colour that
 * is itself very dark (a navy, a near-black) would disappear into it; such a
 * colour is lifted towards white. Mid and light colours are kept as is.
 */
export function onDarkSeries(value: string): string {
  const lum = luminance(value)
  if (lum !== null && lum < 0.1) return toHex6(lightenColor(value, 0.45))
  return value
}

/**
 * The designed backdrop of a data card / full scene: a deep shade of the
 * brand primary, in the same two-stop diagonal as the upstream's slate
 * `linear-gradient(to bottom right, #111827, #1f2937)`.
 */
export function brandBackdrop(
  props: RemotionDesignComponentProps,
  direction = 'to bottom right',
): string {
  const primary = brandPrimary(props)
  return `linear-gradient(${direction}, ${darkenColor(primary, 0.12)}, ${darkenColor(primary, 0.26)})`
}

/** The solid colour the backdrop starts from (used where the upstream needs one). */
export function brandBackdropSolid(props: RemotionDesignComponentProps): string {
  return darkenColor(brandPrimary(props), 0.14)
}

/**
 * A ramp of `count` distinct brand colours for multi-series charts.
 *
 * Alternates primary and accent, then lighter and deeper shades of both, so
 * neighbouring slices / bars always contrast. Every entry is `#rrggbb` (the
 * progress-bars upstream appends a hex alpha to it).
 */
export function brandPalette(props: RemotionDesignComponentProps, count: number): string[] {
  const primary = onDarkSeries(brandPrimary(props))
  const accent = onDarkSeries(brandAccent(props))
  const ramp = [
    primary,
    accent,
    lightenColor(primary, 0.4),
    lightenColor(accent, 0.4),
    darkenColor(primary, 0.7),
    darkenColor(accent, 0.7),
    lightenColor(primary, 0.65),
    lightenColor(accent, 0.65),
  ].map(toHex6)
  return Array.from({ length: Math.max(0, count) }, (_, i) => ramp[i % ramp.length])
}

/* -------------------------------------------------------------------------- */
/* Size                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The scale `k` at which an upstream card of `contentW x contentH` px is
 * drawn on this composition.
 *
 * `preferred` is the size on a 1080-px short edge (all four supported formats
 * have a 1080-px short edge); the result is capped so the card keeps a margin
 * inside the canvas on narrow (9:16) and short formats.
 */
export function fitScale(
  props: RemotionDesignComponentProps,
  contentW: number,
  contentH: number,
  preferred: number,
  fill = 0.92,
): number {
  const width = Math.max(1, props.width)
  const height = Math.max(1, props.height)
  const base = Math.min(width, height) / 1080
  const k = Math.min(preferred * base, (width * fill) / contentW, (height * fill) / contentH)
  return Math.max(0.1, Math.round(k * 1000) / 1000)
}

/**
 * How many characters of a single-line label fit in `availablePx` at
 * `fontPx`, clamped to `[min, max]`. Bold type averages ~0.6 em per glyph.
 */
export function fitChars(availablePx: number, fontPx: number, max: number, min = 6): number {
  const perChar = Math.max(1, fontPx * 0.6)
  return Math.max(min, Math.min(max, Math.floor(availablePx / perChar)))
}

/**
 * Renders an upstream on a virtual canvas scaled by `k`.
 *
 * The virtual canvas is `width / k` x `height / k`, so after the scale it
 * covers exactly the composition-sized design canvas: the upstream's own
 * full-size root (and its backdrop) still fills the frame, while its fixed-px
 * card is drawn `k` times larger.
 */
export function FitCanvas({
  props,
  scale,
  children,
}: {
  props: RemotionDesignComponentProps
  scale: number
  children: React.ReactNode
}): React.ReactElement {
  const k = scale > 0 ? scale : 1
  const identity = Math.abs(k - 1) < 0.0001
  return (
    <div
      data-rve-fit-canvas
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: props.width / k,
        height: props.height / k,
        transformOrigin: 'top left',
        transform: identity ? undefined : `scale(${k})`,
      }}
    >
      {children}
    </div>
  )
}
