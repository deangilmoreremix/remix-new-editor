/**
 * Shared plumbing for the Phase 4 "repo 3" designs (batch 3d).
 *
 * The seven `brito-*` designs come from `remotion-video-templates`
 * (https://github.com/deangilmoreremix/remotion-video-templates — Alejandro
 * Brito's Remotion template pack, MIT). Two things make them different from
 * the repo-1 and repo-2 designs:
 *
 *  1. **The credit is different.** The repo-1 stage (`../shared.tsx`) draws
 *     the RenderComp line and the repo-2 stage (`../rveSharedDesign.tsx`) the
 *     React Video Editor line; either would be a false attribution for these
 *     designs. This module therefore draws its own credit — the attribution
 *     line that travels in `source.attribution`, the bundled-typeface (OFL)
 *     attribution, and the verbatim MIT licence WITH its copyright line
 *     (`BRITO_LICENSE_NOTICE`, reproduced from the upstream's `LICENSE`).
 *  2. **The upstream files are verbatim copies** (apart from a handful of
 *     recorded deviations, see each copy's header), and they were authored
 *     against fixed 1920x1080 / 1080x1920 canvases with hard-coded px sizes
 *     and a few hard-coded canvas fills. Where a fill cannot be switched
 *     through a prop, the adapter overrides it with a scoped stylesheet rule
 *     (`britoRootBackgroundCss`) instead of editing the upstream — the same
 *     technique the typography layer uses for the upstreams' font families.
 *
 * This module is a helper module, NOT a design: it exports no
 * `RemotionDesignTemplate`. The designs live in `./*Design.tsx` and their
 * registry entries in `./entries.ts`.
 */

import React from 'react'
import { AbsoluteFill } from 'remotion'
import type { RemotionDesignComponentProps, RemotionDesignTemplate } from '../../types'
import { DESIGN_FONT_STACK, useDesignFonts } from '../fonts'
import { mix, withAlpha } from '../../_upstream/brito-lib/colors'

/* -------------------------------------------------------------------------- */
/* Attribution                                                                 */
/* -------------------------------------------------------------------------- */

/** The upstream repository the seven templates were copied from. */
export const BRITO_REPOSITORY = 'remotion-video-templates'

/** The upstream repository's URL. */
export const BRITO_REPOSITORY_URL =
  'https://github.com/deangilmoreremix/remotion-video-templates'

/** The commit the copies were taken from. */
export const BRITO_UPSTREAM_COMMIT = '90149464d51a43fcb90e15491bf0d681c1b0fa49'

/** The upstream's licence (its root `LICENSE` file is the MIT licence). */
export const BRITO_LICENSE = 'MIT'

/**
 * The credit line every repo-3 design carries in `source.attribution`.
 *
 * A project that uses designs from several upstream repositories has to show
 * every distinct credit; `getRemotionDesignAttributionLine()` in the catalog
 * aggregates them.
 */
export const BRITO_ATTRIBUTION =
  '© 2026 Alejandro Brito — Remotion templates, MIT License. https://github.com/deangilmoreremix/remotion-video-templates'

/**
 * The upstream's `LICENSE` file, reproduced verbatim (including its
 * copyright line). MIT requires the copyright notice and the permission
 * notice to travel with every copy or substantial portion of the software.
 */
export const BRITO_LICENSE_NOTICE = `MIT License

Copyright (c) 2026 Alejandro Brito

Permission is hereby granted, free of charge, to any person obtaining a copy
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

/** The paths of the templates inside the upstream repository. */
export type BritoSourcePath =
  | 'src/templates/LogoIntro/LogoIntro.tsx'
  | 'src/templates/LowerThirds/LowerThirds.tsx'
  | 'src/templates/KineticText/KineticText.tsx'
  | 'src/templates/ChartVideo/BarChartRace.tsx'
  | 'src/templates/ChartVideo/LineChart.tsx'
  | 'src/templates/CaptionedShort/CaptionedShort.tsx'
  | 'src/templates/PromoTemplate/PromoTemplate.tsx'

/** Builds the `source` block every repo-3 design carries. */
export function britoSource(sourcePath: BritoSourcePath): RemotionDesignTemplate['source'] {
  return {
    repository: BRITO_REPOSITORY,
    repositoryUrl: BRITO_REPOSITORY_URL,
    sourcePath,
    license: BRITO_LICENSE,
    attribution: BRITO_ATTRIBUTION,
  }
}

/* -------------------------------------------------------------------------- */
/* Text helpers                                                                */
/* -------------------------------------------------------------------------- */

/**
 * How many characters of one line of text fit across `availablePx`.
 *
 * The upstreams size their type in fixed px against a 1920- or 1080-wide
 * canvas and mostly let long copy wrap or overflow. The design canvas is
 * always the composition (1920 wide in 16:9, 1080 wide otherwise), so the
 * number of characters that fit only depends on the composition width.
 */
export function britoFitChars(
  availablePx: number,
  fontSizePx: number,
  max: number,
  perCharEm = 0.6,
): number {
  const perChar = Math.max(1, fontSizePx * perCharEm)
  return Math.max(4, Math.min(max, Math.floor(availablePx / perChar)))
}

/** Up to two initials of a business name, upper-cased ("Acme Roofing" → "AR"). */
export function britoMonogram(name: string): string {
  const words = (name || '').trim().split(/\s+/).filter(Boolean)
  return words
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? '')
    .join('')
    .toUpperCase()
}

/* -------------------------------------------------------------------------- */
/* Placeholders (no <img>, no network)                                         */
/* -------------------------------------------------------------------------- */

/**
 * A branded stand-in for the customer's logo.
 *
 * Rendered as plain DOM (not an image) so it never shows a broken `<img>`
 * and its monogram is set in the bundled typeface.
 */
export function BritoLogoPlaceholder({
  size,
  primary,
  accent,
  name,
}: {
  size: number
  primary: string
  accent: string
  name: string
}): React.ReactElement {
  const initials = britoMonogram(name)
  return (
    <div
      data-brito-placeholder="logo"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.22),
        background: `linear-gradient(135deg, ${primary} 0%, ${accent} 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        fontFamily: DESIGN_FONT_STACK,
        fontWeight: 800,
        fontSize: Math.round(size * (initials.length > 1 ? 0.36 : 0.46)),
        letterSpacing: 2,
        boxShadow: `inset 0 0 0 ${Math.round(size * 0.03)}px ${withAlpha('#ffffff', 0.25)}`,
      }}
    >
      {initials}
    </div>
  )
}

/**
 * A branded stand-in for a product screenshot: an app-window mock-up drawn in
 * the brand colours (the upstream's own demo screenshots are not shipped).
 */
export function BritoScreenshotPlaceholder({
  primary,
  accent,
}: {
  primary: string
  accent: string
}): React.ReactElement {
  const bar = (width: string, color: string, height = 18): React.ReactElement => (
    <div style={{ width, height, borderRadius: height / 2, backgroundColor: color }} />
  )
  return (
    <div
      data-brito-placeholder="screenshot"
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          height: 56,
          backgroundColor: '#F4F4F5',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 24px',
          flexShrink: 0,
        }}
      >
        {['#E4E4E7', '#E4E4E7', '#E4E4E7'].map((color, i) => (
          <div key={i} style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: color }} />
        ))}
      </div>
      <div style={{ flex: 1, display: 'flex' }}>
        <div
          style={{
            width: '24%',
            backgroundColor: '#FAFAFA',
            padding: 28,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {bar('80%', primary)}
          {bar('60%', '#E4E4E7')}
          {bar('70%', '#E4E4E7')}
          {bar('50%', '#E4E4E7')}
        </div>
        <div style={{ flex: 1, padding: 36, display: 'flex', flexDirection: 'column', gap: 28 }}>
          {bar('46%', '#27272A', 28)}
          <div style={{ display: 'flex', gap: 24 }}>
            {[primary, accent, mix(primary, accent, 0.5)].map((color, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 150,
                  borderRadius: 18,
                  backgroundColor: withAlpha(color, 0.14),
                  border: `2px solid ${withAlpha(color, 0.4)}`,
                }}
              />
            ))}
          </div>
          <div
            style={{
              flex: 1,
              borderRadius: 18,
              background: `linear-gradient(135deg, ${withAlpha(primary, 0.18)} 0%, ${withAlpha(
                accent,
                0.18,
              )} 100%)`,
            }}
          />
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Canvas-fill overrides                                                       */
/* -------------------------------------------------------------------------- */

/** The selector of the upstream's root element inside a brito design stage. */
export function britoRootSelector(designId: string): string {
  return `[data-remotion-design="${designId}"] > [data-remotion-design-canvas] > div:first-child`
}

/**
 * A scoped stylesheet rule that replaces the upstream root's canvas fill.
 *
 * Used where the upstream hard-codes its fill and offers no prop for it (the
 * captioned short's gradient, the charts' white canvas). The rule is
 * `!important`, so it wins over the upstream's inline style, and it only
 * matches the root of this one design.
 */
export function britoRootBackgroundCss(designId: string, background: string): string {
  return `${britoRootSelector(designId)} { background: ${background} !important; }`
}

/** The brand-tinted light canvas the data-visualisation designs sit on. */
export function britoChartBackground(primary: string, accent: string): string {
  return `linear-gradient(160deg, ${mix(primary, '#ffffff', 0.9)} 0%, ${mix(
    accent,
    '#ffffff',
    0.86,
  )} 100%)`
}

/* -------------------------------------------------------------------------- */
/* Stage                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The stage every repo-3 design renders into.
 *
 * Mirrors `DesignStage` (`../shared.tsx`) and `RveDesignStage`
 * (`../rveSharedDesign.tsx`): the same DOM hooks (`data-remotion-design`,
 * `data-remotion-design-canvas`), the same composition-sized canvas scaled
 * into the design box, the same "omit the transform when the box already is
 * the composition" rule and the same `useDesignFonts()` render gate. No
 * copyright or licence credit is drawn inside the design. One difference:
 *
 *  - `overlay` makes the stage explicitly transparent (overlays), and `css`
 *    injects a scoped stylesheet (canvas-fill overrides, see
 *    `britoRootBackgroundCss`).
 */
export function BritoDesignStage({
  designId,
  props,
  children,
  overlay,
  css,
}: {
  designId: string
  props: RemotionDesignComponentProps
  children: React.ReactNode
  overlay: boolean
  css?: string
}): React.ReactElement {
  useDesignFonts()

  const scaleX = props.box.widthPx / Math.max(1, props.width)
  const scaleY = props.box.heightPx / Math.max(1, props.height)
  const isIdentity = Math.abs(scaleX - 1) < 0.0001 && Math.abs(scaleY - 1) < 0.0001

  return (
    <AbsoluteFill
      data-remotion-design={designId}
      data-brito-overlay={overlay ? 'true' : 'false'}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        pointerEvents: 'none',
        ...(overlay ? { backgroundColor: 'transparent' } : null),
        fontFamily: DESIGN_FONT_STACK,
      }}
    >
      {css ? <style data-brito-design-style={designId}>{css}</style> : null}
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
    </AbsoluteFill>
  )
}
