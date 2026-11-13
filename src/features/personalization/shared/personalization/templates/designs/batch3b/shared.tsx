/**
 * Batch 3b — shared plumbing for the adapters in this folder.
 *
 * Every batch-3b upstream comes from repo 1 (`free-remotion-templates`, MIT,
 * © 2026 Trimora Inc. / RenderComp). The provenance strings are repeated here
 * rather than imported from `../../catalog`: the catalog imports this batch's
 * `entries.ts`, so importing the catalog back would be a circular import whose
 * constants are still in their temporal dead zone when the entries evaluate.
 * `catalogBatch3b.test.tsx` asserts the strings stay identical to the
 * catalog's own constants.
 */

import React from 'react'
import { Sequence, interpolate, useCurrentFrame } from 'remotion'
import type { RemotionDesignTemplate } from '../../types'
import { hasGlyph } from '../../_upstream/pixel-kit'

/* -------------------------------------------------------------------------- */
/* Provenance                                                                  */
/* -------------------------------------------------------------------------- */

export const REPO1_NAME = 'free-remotion-templates'
export const REPO1_URL = 'https://github.com/deangilmoreremix/free-remotion-templates'
/** Identical to `REMOTION_DESIGN_ATTRIBUTION` in `../../catalog.ts`. */
export const REPO1_ATTRIBUTION =
  '© 2026 Trimora Inc. — Remotion templates by RenderComp (free-remotion-templates), MIT License. https://github.com/RenderComp/free-remotion-templates'

/** The `source` block of a repo-1 design. */
export function repo1Source(sourcePath: string): RemotionDesignTemplate['source'] {
  return {
    repository: REPO1_NAME,
    repositoryUrl: REPO1_URL,
    sourcePath,
    license: 'MIT',
    attribution: REPO1_ATTRIBUTION,
  }
}

/* -------------------------------------------------------------------------- */
/* Colour helpers                                                              */
/* -------------------------------------------------------------------------- */

type Rgb = [number, number, number]

/** Parses `#rgb`, `#rrggbb` or `rgb()/rgba()` into channels; `null` otherwise. */
function parseColor(value: string | null | undefined): Rgb | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  const hex = v.replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return [0, 1, 2].map((i) => parseInt(hex[i] + hex[i], 16)) as Rgb
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb
  }
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(v)
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])].map((n) => Math.max(0, Math.min(255, n))) as Rgb
  return null
}

function toHex(c: Rgb): string {
  return `#${c.map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('')}`
}

/**
 * Normalises any brand colour to `#rrggbb`.
 *
 * Several pixel-art upstreams parse colours with a 6-digit-only `hexToRgb`,
 * so a `#abc`, `rgb()` or named colour would turn into `NaN` channels there.
 */
export function hex6(value: string | null | undefined, fallback: string): string {
  const parsed = parseColor(value) ?? parseColor(fallback) ?? [255, 255, 255]
  return toHex(parsed)
}

/** Mixes `a` towards `b` (`t = 0` → a, `t = 1` → b); always returns `#rrggbb`. */
export function mix(a: string, b: string, t: number): string {
  const ca = parseColor(a) ?? [0, 0, 0]
  const cb = parseColor(b) ?? [0, 0, 0]
  const k = Math.max(0, Math.min(1, t))
  return toHex([0, 1, 2].map((i) => ca[i] + (cb[i] - ca[i]) * k) as Rgb)
}

/** Relative luminance (0..1) of a colour. */
export function luminance(value: string): number {
  const c = parseColor(value) ?? [0, 0, 0]
  const lin = c.map((n) => {
    const s = n / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

/** Lifts a colour towards white until it reaches `minLuminance`. */
export function ensureLight(value: string, minLuminance = 0.35): string {
  let out = hex6(value, '#ffffff')
  for (let i = 0; i < 10 && luminance(out) < minLuminance; i++) out = mix(out, '#ffffff', 0.2)
  return out
}

/** Pushes a colour towards black until it is at most `maxLuminance`. */
export function ensureDark(value: string, maxLuminance = 0.08): string {
  let out = hex6(value, '#000000')
  for (let i = 0; i < 12 && luminance(out) > maxLuminance; i++) out = mix(out, '#000000', 0.2)
  return out
}

/* -------------------------------------------------------------------------- */
/* Text helpers                                                                */
/* -------------------------------------------------------------------------- */

/** Cuts one word to `max` characters (with an ellipsis when cut). */
function cutWord(word: string, max: number): string {
  if (word.length <= max) return word
  return `${word.slice(0, Math.max(1, max - 1))}…`
}

/**
 * Fits free text into a wrapping label of `perLine` characters per line and at
 * most `maxLines` lines. Words longer than a line are cut, the overflow is
 * dropped with an ellipsis. Used for the upstream labels that wrap on word
 * boundaries but have a fixed font size.
 */
export function fitWords(value: string | null | undefined, perLine: number, maxLines: number): string {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  if (!text) return ''
  const per = Math.max(3, Math.floor(perLine))
  const lines: string[] = []
  let current = ''
  let truncated = false
  for (const raw of text.split(' ')) {
    const word = cutWord(raw, per)
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length > per && current) {
      lines.push(current)
      current = word
      if (lines.length >= maxLines) {
        truncated = true
        current = ''
        break
      }
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  let out = lines.slice(0, maxLines)
  if (truncated && out.length > 0) {
    const last = out[out.length - 1]
    out = [...out.slice(0, -1), last.length >= per ? `${last.slice(0, per - 1)}…` : `${last}…`]
  }
  return out.join(' ')
}

/**
 * Characters per line of a fixed-size display label on a canvas `width` px
 * wide, using an average advance of `advanceEm` and the label's own letter
 * spacing.
 */
export function charsPerLine(
  width: number,
  fontSize: number,
  options: { safe?: number; advanceEm?: number; letterSpacing?: number } = {},
): number {
  const safe = options.safe ?? 0.88
  const advance = fontSize * (options.advanceEm ?? 0.62) + (options.letterSpacing ?? 0)
  return Math.max(3, Math.floor((width * safe) / Math.max(1, advance)))
}

/* -------------------------------------------------------------------------- */
/* Timing helpers                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Pins the upstream's `useVideoConfig().durationInFrames` to the design's
 * natural length.
 *
 * Some upstreams time their phases as fractions of the composition duration.
 * Inside the personalization composition that would be the customer's whole
 * video (or the layer length), so the wipe would crawl. A `<Sequence>` scopes
 * `durationInFrames` for everything inside it (Remotion takes the minimum of
 * this value and the parent layer's own duration).
 */
export function Timebox({
  durationInFrames,
  children,
}: {
  durationInFrames: number
  children: React.ReactNode
}): React.ReactElement {
  return (
    <Sequence from={0} durationInFrames={durationInFrames} layout="none" name="design-timebox">
      {children}
    </Sequence>
  )
}

/**
 * Fades its children out between `from` and `to` (layer-local frames).
 *
 * Used where the upstream's final state is an opaque scene: the design ends
 * by dissolving into the customer's video instead of hard-cutting at its
 * `endFrame`.
 */
export function FadeOut({
  from,
  to,
  children,
}: {
  from: number
  to: number
  children: React.ReactNode
}): React.ReactElement {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [from, to], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  return (
    <div
      data-batch3b-fade
      style={{ position: 'absolute', inset: 0, opacity }}
    >
      {children}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Pixel-art helpers                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Prepares text for the pixel-kit 5x7 bitmap font.
 *
 * The font draws a dash for any character it has no glyph for, so those
 * characters become spaces; runs of spaces collapse; the result is cut to
 * `maxChars` (the bitmap text never wraps, so overflow would leave the
 * internal canvas). The font has no ellipsis glyph, so a cut ends in "..".
 */
export function bitmapSafe(value: string | null | undefined, maxChars: number): string {
  const raw = typeof value === 'string' ? value : ''
  const mapped = Array.from(raw)
    .map((ch) => (hasGlyph(ch) ? ch : ' '))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
  if (mapped.length <= maxChars) return mapped
  return `${mapped.slice(0, Math.max(1, maxChars - 2)).trimEnd()}..`
}
