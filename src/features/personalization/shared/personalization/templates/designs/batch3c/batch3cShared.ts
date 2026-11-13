/**
 * Batch 3c — local helpers shared by the batch-3c adapters.
 *
 * Several frozen upstreams build colours by STRING CONCATENATION, e.g.
 * `${accentColor}18` (kpi-counter), `${characterColor}28` (thinking-bubble) or
 * `${accentColor}88` (particle-snow). That only produces a valid colour when
 * the input is a 6-digit `#rrggbb` hex, so every brand colour handed to those
 * props goes through `toHex6()` first.
 *
 * `mixColor()` derives the tinted backgrounds of the full-scene / chart cards
 * from the brand primary (the shared module only offers `darkenColor()`).
 */

import type { RemotionDesignTemplate } from '../../types'

/** Parses `#rgb` / `#rrggbb` / `rgb(r, g, b)` into channels; `null` otherwise. */
function parseColor(value: string): { r: number; g: number; b: number } | null {
  const raw = value.trim()
  const hex = raw.replace(/^#/, '')
  if (raw.startsWith('#') && /^[0-9a-f]{3}$/i.test(hex)) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
    }
  }
  if (raw.startsWith('#') && /^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    }
  }
  const rgb = raw.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (rgb) return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) }
  return null
}

function pair(channel: number): string {
  return Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0')
}

/** Normalises a colour to `#rrggbb`; unparseable input yields `fallback`. */
export function toHex6(value: string | null | undefined, fallback: string): string {
  const parsed = typeof value === 'string' ? parseColor(value) : null
  if (!parsed) return fallback
  return `#${pair(parsed.r)}${pair(parsed.g)}${pair(parsed.b)}`
}

/** Mixes `a` towards `b` by `t` (0 = a, 1 = b), returning `#rrggbb`. */
export function mixColor(a: string, b: string, t: number): string {
  const ca = parseColor(a) ?? { r: 0, g: 0, b: 0 }
  const cb = parseColor(b) ?? { r: 0, g: 0, b: 0 }
  const k = Math.max(0, Math.min(1, t))
  return `#${pair(ca.r + (cb.r - ca.r) * k)}${pair(ca.g + (cb.g - ca.g) * k)}${pair(
    ca.b + (cb.b - ca.b) * k,
  )}`
}

/** Darkens towards black: `shade(c, 0.2)` keeps 20 % of each channel. */
export function shade(color: string, keep: number): string {
  return mixColor(color, '#000000', 1 - keep)
}

/** Lightens towards white by `t`. */
export function tint(color: string, t: number): string {
  return mixColor(color, '#ffffff', t)
}

/** Scales a size authored for a 1080 px short side to the composition. */
export function shortSide(props: { width: number; height: number }): number {
  return Math.max(1, Math.min(props.width, props.height))
}

/* -------------------------------------------------------------------------- */
/* Source attribution (repo 1)                                                 */
/* -------------------------------------------------------------------------- */

/*
 * These mirror the constants in `../../catalog.ts`. They are duplicated here
 * (not imported) because `catalog.ts` imports this batch's entries, and an
 * import back into the catalog would be circular. The batch-3c test asserts
 * they stay identical to the catalog's.
 */
export const REPO1_REPOSITORY = 'free-remotion-templates'
export const REPO1_REPOSITORY_URL = 'https://github.com/deangilmoreremix/free-remotion-templates'
export const REPO1_ATTRIBUTION =
  '© 2026 Trimora Inc. — Remotion templates by RenderComp (free-remotion-templates), MIT License. https://github.com/RenderComp/free-remotion-templates'

/** The `source` block of a repo-1 design. */
export function repo1Source(sourcePath: string): RemotionDesignTemplate['source'] {
  return {
    repository: REPO1_REPOSITORY,
    repositoryUrl: REPO1_REPOSITORY_URL,
    sourcePath,
    license: 'MIT',
    attribution: REPO1_ATTRIBUTION,
  }
}

/* -------------------------------------------------------------------------- */
/* Legibility                                                                  */
/* -------------------------------------------------------------------------- */

/** Relative luminance (0..1) of a colour; unparseable input counts as white. */
export function luminance(color: string): number {
  const parsed = parseColor(color)
  if (!parsed) return 1
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(parsed.r) + 0.7152 * lin(parsed.g) + 0.0722 * lin(parsed.b)
}

/**
 * The chart / scene cards paint a DARK brand-derived panel. A brand text
 * colour picked for legibility over the customer's video can be dark, so it
 * is swapped for white when it would vanish on the panel.
 */
export function readableOnDark(color: string, fallback = '#ffffff'): string {
  return luminance(color) >= 0.35 ? color : fallback
}

/**
 * Character budget for a single-line label of `fontSize` px that must fit in
 * `availablePx`, using an average glyph advance of `advanceEm`.
 */
export function fitChars(availablePx: number, fontSize: number, advanceEm = 0.6, min = 8): number {
  return Math.max(min, Math.floor(availablePx / Math.max(1, fontSize * advanceEm)))
}
