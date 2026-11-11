/**
 * Shared plumbing for the Phase 1 Remotion design adapters.
 *
 * Every upstream template in `../_upstream` was authored as a *standalone
 * composition*: it lays itself out against the full composition
 * (`useVideoConfig().width/height`), not against the box the design layer
 * occupies. The customer's design box is a scaled copy of the composition
 * (`toBox()` in `preview/presets.ts`), so an adapter has to
 *
 *  1. render the upstream at COMPOSITION size, and
 *  2. scale that composition-sized child into the box.
 *
 * Doing it this way keeps the upstream's own layout semantics intact (its
 * hardcoded pixel values stay proportional to the composition) and lets the
 * customer drag/resize the design as one box.
 *
 * The composition already positions the design layer at the box
 * (`PersonalizationComposition.tsx` → `<AbsoluteFill style={{left, top, width,
 * height}}>`) and wraps it in a `<Sequence from={layer.startFrame}>` so the
 * upstream's `useCurrentFrame()` is layer-local. The adapter therefore only
 * has to clip and scale — it must NOT re-apply the box offset.
 */

import React from 'react'
import { AbsoluteFill } from 'remotion'
import { DESIGN_CREDIT_FONT_STACK, useDesignFonts } from './fonts'
// `DESIGN_FONT_ATTRIBUTION` is NOT re-exported by `./fonts`, and that module is
// not this lane's file — so the OFL notice is imported straight from the source.
import { DESIGN_FONT_ATTRIBUTION } from '../typography'
import type { RemotionDesignComponentProps } from '../types'

/**
 * The only canvas fill an overlay may use.
 *
 * The customer's video is rendered underneath the design layer; an opaque
 * fill would hide it. The one exception is the end card, whose `background`
 * prop doubles as the CTA label colour (see `PromoCtaDesign.tsx`).
 */
export const TRANSPARENT = 'transparent'

/**
 * Short credit line rendered inside every design.
 *
 * The upstream templates are MIT licensed and the licence requires the
 * copyright notice to travel with every copy. The designs are also set in
 * the bundled Inter Latin subset (SIL OFL 1.1, Phase 3 decision D2), so the
 * typeface's own attribution travels with the rendered artefact too —
 * appended after the MIT upstream credit in the same line.
 *
 * `catalog.ts` exposes the full attribution and the verbatim permission
 * notice for the product's credits surface; this short line is what actually
 * ends up in the preview and in the exported video. It is deliberately kept
 * on ONE unobtrusive 10px line (`white-space: nowrap`), which is why both
 * notices are joined with the same `·` separator instead of a second row.
 */
export const DESIGN_VIDEO_CREDIT = `© 2026 Trimora Inc. (RenderComp) · MIT · ${DESIGN_FONT_ATTRIBUTION}`

/**
 * The props every adapter receives.
 *
 * `background` (and friends) are the upstream's own canvas props. They are
 * NOT brand inputs: the catalog pins them in `defaultProps` so the upstream
 * demo colours can never be reached, and the adapters force transparency.
 */
export type DesignAdapterProps = RemotionDesignComponentProps & {
  /** The upstream canvas fill. Pinned to `transparent` by the catalog. */
  background?: string
  /** The upstream canvas fill (logo reveal / lower third spelling). */
  backgroundColor?: string
  /** The upstream canvas fill (visual effect spelling). */
  baseColor?: string
}

/** Truncates `value` to `max` characters, adding an ellipsis when cut. */
export function truncateText(value: string | null | undefined, max: number): string {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) return ''
  if (trimmed.length <= max) return trimmed
  const cut = trimmed.slice(0, Math.max(1, max - 1)).trimEnd()
  return `${cut}…`
}

/**
 * Reads one text slot, without any fallback.
 *
 * The composition fills `textSlots` with the resolved brand values and
 * `text` with the value of the primary slot (the customer's own text wins
 * there).
 */
export function slotValue(
  props: RemotionDesignComponentProps,
  key: string,
): string {
  const value = props.textSlots?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Reads a text slot, falling back to the other declared slots and then to
 * the primary text.
 *
 * The primary fallback is only appropriate for the *primary* slot: a
 * secondary slot (a CTA label, a subtitle) must never inherit the headline.
 */
export function slotText(
  props: RemotionDesignComponentProps,
  key: string,
  fallbacks: string[] = [],
): string {
  const direct = slotValue(props, key)
  if (direct) return direct
  for (const fallback of fallbacks) {
    const value = slotValue(props, fallback)
    if (value) return value
  }
  const primary = props.text
  return typeof primary === 'string' ? primary.trim() : ''
}

/** The first non-empty colour of `candidates`, or `fallback`. */
export function pickColor(
  candidates: Array<string | null | undefined>,
  fallback = '#ffffff',
): string {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  }
  return fallback
}

/** Parses `#rgb` / `#rrggbb` into its channels; `null` for anything else. */
function parseHexColor(value: string): { r: number; g: number; b: number } | null {
  const hex = value.trim().replace(/^#/, '')
  if (hex.length === 3) {
    if (!/^[0-9a-f]{3}$/i.test(hex)) return null
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
    }
  }
  if (hex.length === 6) {
    if (!/^[0-9a-f]{6}$/i.test(hex)) return null
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    }
  }
  return null
}

function toHexPair(channel: number): string {
  const clamped = Math.max(0, Math.min(255, Math.round(channel)))
  return clamped.toString(16).padStart(2, '0')
}

/**
 * Darkens a hex colour towards black.
 *
 * Used by the end card, whose `background` prop is both the card fill AND
 * the CTA label colour. The default brand primary (`#29d3f2`) is a light
 * cyan, so the card needs a deeper shade of the same hue for the white title
 * and the accent pill to stay legible.
 *
 * Colours that are not hex are returned unchanged.
 */
export function darkenColor(value: string, factor: number): string {
  const parsed = parseHexColor(value)
  if (!parsed) return value
  const k = Math.max(0, Math.min(1, factor))
  return `#${toHexPair(parsed.r * k)}${toHexPair(parsed.g * k)}${toHexPair(parsed.b * k)}`
}

/**
 * The small, low-opacity credit line drawn in the corner of the design.
 *
 * It is rendered in the *box* (not in the scaled composition) so its size
 * does not shrink with the design, and it is deliberately unobtrusive.
 */
export function DesignCreditLine(): React.ReactElement {
  return (
    <div
      data-remotion-design-credit
      style={{
        position: 'absolute',
        right: 8,
        bottom: 6,
        fontFamily: DESIGN_CREDIT_FONT_STACK,
        fontSize: 10,
        lineHeight: 1.2,
        fontWeight: 500,
        letterSpacing: 0.2,
        color: 'rgba(255,255,255,0.55)',
        textShadow: '0 1px 3px rgba(0,0,0,0.65)',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}
    >
      {DESIGN_VIDEO_CREDIT}
    </div>
  )
}

/**
 * The stage every design renders into.
 *
 * Outer: fills the layer box the composition already positioned, and clips
 * whatever the upstream paints. Inner: the composition-sized canvas the
 * upstream lays itself out against, scaled into the box.
 *
 * The transform is omitted when the box already is the composition: an
 * identity `transform` still creates a stacking context, which would
 * neutralise the `mix-blend-mode: screen` of the bokeh effect.
 */
export function DesignStage({
  designId,
  props,
  children,
  stageStyle,
}: {
  designId: string
  props: RemotionDesignComponentProps
  children: React.ReactNode
  stageStyle?: React.CSSProperties
}): React.ReactElement {
  // The frozen upstreams hardcode a system font stack, which makes the export
  // depend on the machine it runs on. `useDesignFonts()` declares the bundled
  // typeface, overrides the upstream's inline `font-family` inside the design
  // stage, and holds the render open until the face is loaded.
  useDesignFonts()

  const scaleX = props.box.widthPx / Math.max(1, props.width)
  const scaleY = props.box.heightPx / Math.max(1, props.height)
  const isIdentity = Math.abs(scaleX - 1) < 0.0001 && Math.abs(scaleY - 1) < 0.0001

  return (
    <AbsoluteFill
      data-remotion-design={designId}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        pointerEvents: 'none',
        ...stageStyle,
      }}
    >
      <AbsoluteFill
        data-remotion-design-canvas
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: props.width,
          height: props.height,
          transformOrigin: 'top left',
          transform: isIdentity ? undefined : `scale(${scaleX}, ${scaleY})`,
        }}
      >
        {children}
      </AbsoluteFill>
      <DesignCreditLine />
    </AbsoluteFill>
  )
}
