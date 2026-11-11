/**
 * Shared plumbing for the Phase 2 "repo 2" designs.
 *
 * The four batch-2 designs come from `remotion-templates`
 * (https://github.com/deangilmoreremix/remotion-templates — the React Video
 * Editor template library). Two things make them different from the Phase 1
 * designs in `./shared.tsx`:
 *
 *  1. **The upstream files are EDITED.** Contract addition C8 of
 *     `docs/phase2/handoffs/A6.md` allows a scoped deviation from the
 *     "the upstream components are frozen" rule for the repo-2 copies: every
 *     hard-coded string, colour and dimension became a prop whose default
 *     reproduces the upstream literal exactly. Each copy carries its own
 *     deviation record in its header.
 *  2. **The licence position is different.** `remotion-templates` ships NO
 *     `LICENSE` file and names NO copyright holder; its README states that
 *     every template is available under the MIT License and that "attribution
 *     is appreciated where applicable", and each file carries the in-file
 *     credit "Credit appreciated but not required. Created by the team at
 *     https://www.reactvideoeditor.com".
 *
 *     → The Phase 1 credit line in `./shared.tsx` names RenderComp, which is
 *       the wrong upstream for these designs, so the repo-2 designs draw
 *       their OWN credit. It carries BOTH halves of the credit (contract
 *       addition C10): the attribution line that travels in
 *       `source.attribution`, and the verbatim MIT permission notice WITHOUT
 *       a copyright line (there is no holder to name).
 *
 * This module is a helper module, NOT a design: it exports no
 * `RemotionDesignTemplate`. The designs themselves live in
 * `./rve*Design.tsx` and their registry entries in `./rveCatalogEntries.ts`.
 */

import React from 'react'
import { AbsoluteFill } from 'remotion'
import type { RemotionDesignComponentProps } from '../types'
import { DESIGN_CREDIT_FONT_STACK, DESIGN_FONT_STACK, useDesignFonts } from './fonts'
// Phase 3 decision D2: the OFL typeface attribution joins the rendered
// credit line, so every repo-2 design carries it the same way the repo-1
// designs do. `designs/fonts.ts` does not re-export it (it is not a font
// *stack*), so the constant is imported from the typography module directly
// — the same module the repo-1 credit reaches it through.
import { DESIGN_FONT_ATTRIBUTION } from '../typography'

/* -------------------------------------------------------------------------- */
/* Attribution                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The credit line the catalog carries in `source.attribution`.
 *
 * Exact string required by A6 (contract addition C10). It is deliberately
 * different from the Phase 1 line in `../catalog.ts`: that one names
 * RenderComp / free-remotion-templates, this one names React Video Editor /
 * remotion-templates. A project that uses designs from both repositories has
 * to show BOTH.
 */
export const RVE_ATTRIBUTION =
  'Remotion templates by React Video Editor (reactvideoeditor.com) — MIT License.'

/**
 * The upstream's own in-file credit, reproduced verbatim.
 *
 * Every file in `remotion-templates` opens with this header. The wording is
 * part of the upstream's licence position ("attribution is appreciated where
 * applicable") and must travel with the copy.
 */
export const RVE_UPSTREAM_CREDIT =
  'Free Remotion Template Component — This template is free to use in your projects! Credit appreciated but not required. Created by the team at https://www.reactvideoeditor.com'

/**
 * The verbatim MIT permission notice — WITHOUT a copyright line.
 *
 * The upstream repository names no copyright holder, so there is no
 * "Copyright (c) …" line to reproduce (contract addition C10). The notice
 * body itself is reproduced verbatim because the copied file is a
 * "substantial portion of the Software".
 */
export const RVE_LICENSE_NOTICE = `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`

/* -------------------------------------------------------------------------- */
/* Colour helpers                                                              */
/* -------------------------------------------------------------------------- */

function parseHex(value: string): { r: number; g: number; b: number } | null {
  const hex = value.trim().replace(/^#/, '')
  if (hex.length === 3 && /^[0-9a-f]{3}$/i.test(hex)) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
    }
  }
  if (hex.length === 6 && /^[0-9a-f]{6}$/i.test(hex)) {
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
 * Adds an alpha channel to a hex colour.
 *
 * The circular-progress template's ring has a track that the upstream paints
 * as `rgba(255, 255, 255, 0.1)` — a faint wash, not a solid colour. A brand
 * track has to stay faint too, so the adapter derives it from the brand
 * primary at 12 % alpha instead of pasting an opaque colour over the video.
 *
 * Colours that are not hex are returned unchanged.
 */
export function withAlpha(value: string, alpha: number): string {
  const parsed = parseHex(value)
  if (!parsed) return value
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
  return `#${toHexPair(parsed.r)}${toHexPair(parsed.g)}${toHexPair(parsed.b)}${toHexPair(a)}`
}

/**
 * Lightens a hex colour towards white.
 *
 * The popping-text template's palette is a monochrome ramp (a dark blue, a
 * mid blue and a light blue) and it rotates through it per character. The
 * adapter rebuilds the same ramp from the brand: a darkened primary, the
 * primary itself and a lightened primary — three entries, so the upstream's
 * `i % colors.length` rotation looks exactly the same.
 *
 * Colours that are not hex are returned unchanged.
 */
export function lightenColor(value: string, factor: number): string {
  const parsed = parseHex(value)
  if (!parsed) return value
  const k = Math.max(0, Math.min(1, factor))
  return `#${toHexPair(parsed.r + (255 - parsed.r) * k)}${toHexPair(
    parsed.g + (255 - parsed.g) * k,
  )}${toHexPair(parsed.b + (255 - parsed.b) * k)}`
}

/* -------------------------------------------------------------------------- */
/* Type helpers                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The canvas-relative font size, in px, a repo-2 design should use.
 *
 * The repo-2 templates size their type in `rem`, which resolves against the
 * DOCUMENT root font size and not against the composition — so the same
 * template is the same number of pixels tall in a 1920x1080 and in a
 * 1080x1920 composition (contract addition C9).
 *
 * The adapter therefore never passes the upstream's `rem` value; it passes a
 * px value derived from the composition's SHORT edge. The short edge is
 * 1080 px in all four supported formats (16:9, 9:16, 1:1 and 4:5), so one
 * ratio reads the same in every format.
 */
export function rveFontSizePx(
  props: RemotionDesignComponentProps,
  ratio: number,
): number {
  return Math.round(Math.min(props.width, props.height) * ratio)
}

/**
 * How many characters of a centred headline fit on one line.
 *
 * The repo-2 templates centre their copy in a 100 %-wide container and do
 * NOT set `whiteSpace: "nowrap"`, so a long string wraps and then overflows
 * the canvas vertically. The adapter truncates instead.
 *
 * The limit is derived from the composition width and the font size, because
 * the design box is a scaled copy of the composition: the scale cancels out
 * (the box is `width * scale` wide and the glyphs are `fontSize * scale`
 * wide), so the number of characters that fit is the same at every scale.
 */
export function rveMaxChars(
  props: RemotionDesignComponentProps,
  fontSizePx: number,
  maxChars: number,
): number {
  const perChar = Math.max(1, fontSizePx * 0.62)
  const fit = Math.floor((props.width * 0.88) / perChar)
  return Math.max(4, Math.min(maxChars, fit))
}

/* -------------------------------------------------------------------------- */
/* Stage + credit                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The credit drawn inside every repo-2 design.
 *
 * It carries the two halves of the repo-2 credit (contract addition C10):
 *
 *  1. `RVE_ATTRIBUTION` — the same line the catalog carries in
 *     `source.attribution`;
 *  2. `RVE_UPSTREAM_CREDIT` — the upstream's own "Credit appreciated but not
 *     required" header, reproduced verbatim;
 *
 * and, under them, the verbatim MIT permission notice WITHOUT a copyright
 * line, because the upstream names no copyright holder.
 *
 * The notice is deliberately set as small print: the product's credits
 * surface is where a full-size rendering of it belongs (A6 C10 asks A11 to
 * aggregate the distinct `source.attribution` values in use). What matters
 * here is that the notice travels with the design.
 */
export function RveCreditBlock(): React.ReactElement {
  return (
    <div
      data-remotion-design-credit="rve"
      style={{
        position: 'absolute',
        right: 8,
        bottom: 6,
        maxWidth: '72%',
        textAlign: 'right',
        fontFamily: DESIGN_CREDIT_FONT_STACK,
        fontSize: 9,
        lineHeight: 1.25,
        fontWeight: 500,
        letterSpacing: 0.2,
        color: 'rgba(255,255,255,0.55)',
        textShadow: '0 1px 3px rgba(0,0,0,0.65)',
        pointerEvents: 'none',
      }}
    >
      <div style={{ whiteSpace: 'nowrap' }}>{RVE_ATTRIBUTION}</div>
      <div>{RVE_UPSTREAM_CREDIT}</div>
      {/* Phase 3 decision D2: the bundled typeface is rendered by this design
          too, so its OFL attribution travels with the credit line exactly as
          it does in the repo-1 credit (`DesignCreditLine`). */}
      <div style={{ whiteSpace: 'nowrap' }}>{DESIGN_FONT_ATTRIBUTION}</div>
      <div
        style={{
          marginTop: 2,
          fontSize: 6,
          lineHeight: 1.2,
          whiteSpace: 'pre-line',
          opacity: 0.85,
        }}
      >
        {RVE_LICENSE_NOTICE}
      </div>
    </div>
  )
}

/**
 * The stage every repo-2 design renders into.
 *
 * Mirrors `DesignStage` in `./shared.tsx` exactly — the same DOM structure,
 * the same `data-remotion-design` / `data-remotion-design-canvas` hooks (so
 * the injected typography stylesheet and any other consumer keep working),
 * the same composition-sized canvas scaled into the design box, and the same
 * "omit the transform when the box already is the composition" rule.
 *
 * The one difference is the credit: the shared stage draws the Phase 1
 * RenderComp line, which would be a false attribution for a React Video
 * Editor template, so this stage draws the repo-2 credit instead.
 */
export function RveDesignStage({
  designId,
  props,
  children,
}: {
  designId: string
  props: RemotionDesignComponentProps
  children: React.ReactNode
}): React.ReactElement {
  // Gates the render on the bundled typeface (A10). A design that does not
  // use the shared stage has to call this itself.
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
        // The customer's video shows through: the canvas is never painted.
        backgroundColor: 'transparent',
        // The deterministic typeface (A10). The injected stylesheet overrides
        // the upstreams' inline font families with `!important`; declaring it
        // here as well makes the stack explicit in the DOM.
        fontFamily: DESIGN_FONT_STACK,
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
      <RveCreditBlock />
    </AbsoluteFill>
  )
}
