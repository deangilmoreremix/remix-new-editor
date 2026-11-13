/**
 * Batch 3a helpers shared by the adapters in this folder.
 *
 * The batch-3a upstreams (repo 1, `free-remotion-templates`) are frozen
 * verbatim copies. Several of them size their text against the composition
 * height (or a fixed pixel value) with no font-size prop, so on a 9:16 canvas
 * a brand headline would run off the frame. Following the adapter contract
 * ("work around by composition, never edit the upstream"), these helpers let
 * an adapter:
 *
 *  - estimate a font size that keeps a string inside a box (`fitFontSize`);
 *  - inject a stylesheet SCOPED to one design instance (`ScopedUpstream`), so
 *    a frozen upstream's inline font size / canvas fill can be overridden
 *    from the outside without touching the upstream file;
 *  - normalise brand colours to `#rrggbb`, because several upstreams append
 *    a two-digit alpha suffix to the colour they are given
 *    (`${accentColor}26`), which only works on a six-digit hex.
 *
 * Everything is deterministic and DOM-only (no network, no randomness).
 */

import React from 'react'
import { AbsoluteFill } from 'remotion'
import type { RemotionDesignComponentProps, RemotionDesignSource } from '../../types'
import { slotText, slotValue, truncateText } from '../shared'

/* -------------------------------------------------------------------------- */
/* Attribution (repo 1)                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The repo-1 attribution line. Spelled out here (identical to
 * `REMOTION_DESIGN_ATTRIBUTION` in `../../catalog.ts`) because `catalog.ts`
 * imports this batch, and importing it back would be circular.
 */
export const BATCH_3A_ATTRIBUTION =
  '© 2026 Trimora Inc. — Remotion templates by RenderComp (free-remotion-templates), MIT License. https://github.com/RenderComp/free-remotion-templates'

/** Builds the `source` block for a repo-1 template. */
export function batch3aSource(sourcePath: string): RemotionDesignSource {
  return {
    repository: 'free-remotion-templates',
    repositoryUrl: 'https://github.com/deangilmoreremix/free-remotion-templates',
    sourcePath,
    license: 'MIT',
    attribution: BATCH_3A_ATTRIBUTION,
  }
}

/* -------------------------------------------------------------------------- */
/* Colours                                                                     */
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

function pair(channel: number): string {
  return Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0')
}

/**
 * The first candidate that parses as a hex colour, as `#rrggbb`; otherwise
 * `fallback` (which must itself be a `#rrggbb`).
 */
export function hex6(candidates: Array<string | null | undefined>, fallback: string): string {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const parsed = parseHex(candidate)
    if (parsed) return `#${pair(parsed.r)}${pair(parsed.g)}${pair(parsed.b)}`
  }
  return fallback
}

/** Mixes a `#rrggbb` colour towards `target` by `amount` (0..1). */
export function mixHex(color: string, target: string, amount: number): string {
  const a = parseHex(color)
  const b = parseHex(target)
  if (!a || !b) return color
  const k = Math.max(0, Math.min(1, amount))
  return `#${pair(a.r + (b.r - a.r) * k)}${pair(a.g + (b.g - a.g) * k)}${pair(a.b + (b.b - a.b) * k)}`
}

/** A deep shade of `color` for designed backgrounds (towards near-black). */
export function deepShade(color: string, amount = 0.78): string {
  return mixHex(color, '#05060a', amount)
}

/** A pale tint of `color` for light, paper-like backgrounds. */
export function paleTint(color: string, amount = 0.88): string {
  return mixHex(color, '#ffffff', amount)
}

/** The brand palette every batch-3a adapter starts from, normalised. */
export function brandPalette(props: RemotionDesignComponentProps): {
  primary: string
  accent: string
  text: string
} {
  const primary = hex6([props.colors?.primary], '#29d3f2')
  return {
    primary,
    accent: hex6([props.colors?.accent, props.colors?.primary], '#28c98b'),
    text: hex6([props.color, props.colors?.text], '#ffffff'),
  }
}

/* -------------------------------------------------------------------------- */
/* Text fitting                                                                */
/* -------------------------------------------------------------------------- */

export interface FitOptions {
  /** Width the text has to fit into, px. */
  maxWidth: number
  /** Height the (possibly wrapped) block has to fit into, px. */
  maxHeight?: number
  /** The upstream's own size — the result never exceeds it. */
  maxSize: number
  /** The result never goes below this. */
  minSize?: number
  /** Average glyph advance in em (including letter spacing). */
  advance?: number
  /** Line height in em, for the height check. */
  lineHeight?: number
  /** `false` when the upstream renders the string on one line (`nowrap`). */
  wrap?: boolean
}

/** Greedy word-wrap estimate: the number of lines `text` needs. */
function estimateLines(words: string[], charsPerLine: number): number {
  let lines = 1
  let current = 0
  for (const word of words) {
    const len = word.length
    if (current === 0) {
      current = len
    } else if (current + 1 + len <= charsPerLine) {
      current += 1 + len
    } else {
      lines += 1
      current = len
    }
  }
  return lines
}

/**
 * Estimates the largest font size (≤ `maxSize`) at which `text` stays inside
 * the box. A heuristic (no DOM measurement — renders must be deterministic),
 * deliberately on the conservative side.
 */
export function fitFontSize(text: string, options: FitOptions): number {
  const {
    maxWidth,
    maxHeight = Number.POSITIVE_INFINITY,
    maxSize,
    minSize = 12,
    advance = 0.62,
    lineHeight = 1.15,
    wrap = true,
  } = options
  const value = text.trim()
  if (!value) return Math.round(maxSize)
  const words = value.split(/\s+/)
  const longestWord = words.reduce((max, word) => Math.max(max, word.length), 0)

  let size = maxSize
  for (let guard = 0; guard < 80 && size > minSize; guard += 1) {
    const charsPerLine = Math.max(1, Math.floor(maxWidth / (size * advance)))
    const fitsWidth = wrap ? longestWord <= charsPerLine : value.length <= charsPerLine
    const lines = wrap ? estimateLines(words, charsPerLine) : 1
    const fitsHeight = lines * size * lineHeight <= maxHeight
    if (fitsWidth && fitsHeight) break
    size *= 0.94
  }
  return Math.max(minSize, Math.round(size))
}

/* -------------------------------------------------------------------------- */
/* Scoped stylesheet                                                           */
/* -------------------------------------------------------------------------- */

/** The data attribute the scoped wrapper carries. */
export const SCOPE_ATTRIBUTE = 'data-batch3a-scope'

/** A per-instance scope id that is safe inside a CSS attribute selector. */
export function useScopeId(prefix: string): string {
  const raw = React.useId()
  return `${prefix}-${raw.replace(/[^a-zA-Z0-9_-]/g, '')}`
}

/** `[data-batch3a-scope="<id>"]` — prefix every rule with it. */
export function scopeSelector(scopeId: string): string {
  return `[${SCOPE_ATTRIBUTE}="${scopeId}"]`
}

/**
 * Wraps a frozen upstream in a full-canvas element that carries a
 * per-instance scope attribute, followed by a `<style>` element whose rules
 * only match inside that scope.
 *
 * The upstream's root element stays the wrapper's FIRST child, so rules can
 * address it as `${scope} > div:first-child`.
 */
export function ScopedUpstream({
  scopeId,
  css,
  children,
}: {
  scopeId: string
  css: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <AbsoluteFill {...{ [SCOPE_ATTRIBUTE]: scopeId }} style={{ pointerEvents: 'none' }}>
      {children}
      {css ? <style data-batch3a-style>{css}</style> : null}
    </AbsoluteFill>
  )
}

/** The upper-cased, truncated value of a string — helper for label slots. */
export function upper(value: string): string {
  return value.toLocaleUpperCase()
}

/**
 * The "character scene" upstreams (typewriter, eye-reveal, pencil-draw) share
 * one layout: an `<svg>` illustration, then a bottom-anchored block whose
 * first `<div>` is the message at `0.09 × min(w, h)` (wrapping). This returns
 * the scoped rule that shrinks that message when it would crowd the
 * illustration, or `''` when the upstream size already fits.
 */
export function bottomMessageFitCss(
  scopeId: string,
  message: string,
  width: number,
  height: number,
): string {
  const upstreamSize = Math.min(width, height) * 0.09
  const fitted = fitFontSize(message, {
    maxWidth: width * 0.9,
    maxHeight: height * 0.2,
    maxSize: upstreamSize,
    advance: 0.64,
    lineHeight: 1.2,
  })
  if (fitted >= Math.round(upstreamSize)) return ''
  return `${scopeSelector(scopeId)} > div:first-child > div > div:first-child { font-size: ${fitted}px !important; text-align: center; }`
}

/** Relative luminance of a `#rrggbb` colour (0..1). */
export function luminance(color: string): number {
  const parsed = parseHex(color)
  if (!parsed) return 0
  const lin = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(parsed.r) + 0.7152 * lin(parsed.g) + 0.0722 * lin(parsed.b)
}

/** `preferred` if it reads on `background`, else a dark/white alternative. */
export function readableOn(background: string, preferred: string): string {
  const contrast = (a: string, b: string) => {
    const la = luminance(a)
    const lb = luminance(b)
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
  }
  if (contrast(background, preferred) >= 3) return preferred
  return luminance(background) > 0.4 ? deepShade(background, 0.85) : '#ffffff'
}

/** The message / sub-line pair of the "character scene" upstreams. */
export function messageAndSub(props: RemotionDesignComponentProps): { message: string; sub: string } {
  return {
    message: truncateText(slotText(props, 'message', ['headline', 'businessName']), 28),
    sub: truncateText(slotValue(props, 'sub'), 48),
  }
}
