import type React from 'react'
import { fontStackById } from './presets'
import { rotateCss } from './rotation'
import type { PreviewLayer } from './types'

/**
 * One source of truth for how overlay text LOOKS, used by the Remotion
 * composition (what the customer sees and exports) and by the editor stage
 * (what they drag around), so the two can never drift apart.
 *
 * Geometry (box position and size) stays in `toBox`; this file is styling only.
 */

export type TextStyleKind = Extract<PreviewLayer['kind'], 'businessName' | 'headline' | 'tagline' | 'offer' | 'cta'>

/**
 * Soft two-layer shadow: a wide glow for separation from busy footage and a
 * tight edge so letters stay crisp. Kept as plain CSS `text-shadow` (the
 * subset the browser-based web renderer supports); remove it here and both
 * the preview and the export lose it together.
 */
export const TEXT_SHADOW = '0 2px 14px rgba(0,0,0,.55), 0 1px 2px rgba(0,0,0,.6)'
export const PILL_SHADOW = '0 6px 18px rgba(0,0,0,.35)'

interface RoleStyle {
  fontWeight: number
  lineHeight: number
  letterSpacing: string
}

const ROLE_STYLE: Record<TextStyleKind, RoleStyle> = {
  headline: { fontWeight: 800, lineHeight: 1.08, letterSpacing: '-0.02em' },
  businessName: { fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.01em' },
  offer: { fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.01em' },
  tagline: { fontWeight: 500, lineHeight: 1.25, letterSpacing: '0.03em' },
  cta: { fontWeight: 800, lineHeight: 1.15, letterSpacing: '0.01em' },
}

export function isTextStyleKind(kind: PreviewLayer['kind']): kind is TextStyleKind {
  return kind in ROLE_STYLE
}

export type TextAlign = 'left' | 'center'

/** Anchors at or left of this are an intentional left-margin column, not a centered column. */
export const LEFT_COLUMN_MAX_X = 0.15

/**
 * Text is centered in its box, but a box the safe-area clamp pushed against the
 * left margin (a left-column layout, anchor x <= LEFT_COLUMN_MAX_X) would then leave
 * every line starting at a different x. Such text is left-aligned so the column shares
 * one edge. A centered column (e.g. anchored at x = .3) stays centered even when its
 * wide box is nudged by the margin, so its lines stay centered on one another.
 */
export function textAlignFor(
  layer: { x: number },
  box: { leftPx: number; widthPx: number },
  compW: number,
): TextAlign {
  if (layer.x > LEFT_COLUMN_MAX_X) return 'center'
  const unclampedLeft = Math.round(layer.x * compW - box.widthPx / 2)
  return box.leftPx > unclampedLeft ? 'left' : 'center'
}

/**
 * `toBox` sizes a text box from a per-character estimate (0.55 em) capped at 90% of the frame.
 * When the box is NOT capped, the text was expected to fit on one line, and real text can be a
 * few percent wider than the estimate (capital-heavy strings measure ~0.56 em/char), which
 * would wrap the last word. Such text is kept on one line instead.
 */
export function isSingleLineBox(widthPx: number, compW: number): boolean {
  return widthPx < compW * 0.9 - 1
}

/** Style for a plain text layer (headline, tagline, business name, offer). */
export function layerTextStyle(
  kind: TextStyleKind,
  opts: { fontSizePx: number; color: string; fontFamily?: string; align?: TextAlign; singleLine?: boolean; rotation?: number },
): React.CSSProperties {
  const role = ROLE_STYLE[kind]
  const align = opts.align ?? 'center'
  // Single-line text takes its real width and stays centered on the box center (or pinned left),
  // so an estimate that is a few px short can never wrap it or push it off-center.
  const single: React.CSSProperties = opts.singleLine
    ? {
        whiteSpace: 'nowrap',
        width: 'max-content',
        ...(align === 'center' ? { position: 'relative', left: '50%' } : {}),
      }
    : { width: '100%' }
  // One transform: centering first (single-line, centered text), then the layer's rotation about the text's own center.
  const transform = [opts.singleLine && align === 'center' ? 'translateX(-50%)' : '', rotateCss(opts.rotation)].filter(Boolean).join(' ')
  return {
    fontFamily: fontStackById(opts.fontFamily),
    color: opts.color,
    fontSize: opts.fontSizePx,
    fontWeight: role.fontWeight,
    lineHeight: role.lineHeight,
    letterSpacing: role.letterSpacing,
    textAlign: align,
    ...single,
    // Only break a word that cannot fit on a line by itself.
    overflowWrap: 'break-word',
    // Even line lengths for wrapped headlines. Ignored where unsupported.
    textWrap: 'balance',
    textShadow: TEXT_SHADOW,
    ...(transform ? { transform, transformOrigin: 'center center' } : {}),
  }
}

/** Pixel box of a text layer in the space the caller draws in. */
export interface RuleBox {
  leftPx: number
  topPx: number
  widthPx: number
  heightPx: number
}

/**
 * Decorative accent under (or beside) a headline. Purely visual: it is not
 * part of any layer's geometry, so placement and collision checks are
 * unaffected. Centered layouts get a short rule underneath; the `lower-third`
 * animation gets a vertical bar on the left edge of the text.
 * Returns null for every other kind.
 */
export function accentRuleStyle(
  kind: PreviewLayer['kind'],
  animation: PreviewLayer['animation'],
  box: RuleBox,
  compW: number,
  compH: number,
  color: string,
  align: TextAlign = 'center',
  rotation?: number,
): React.CSSProperties | null {
  if (kind !== 'headline' || box.widthPx <= 0 || box.heightPx <= 0) return null
  const thickness = Math.max(3, Math.round(compH * 0.006))
  const base: React.CSSProperties = {
    position: 'absolute',
    background: color,
    borderRadius: thickness / 2,
    boxShadow: '0 1px 6px rgba(0,0,0,.35)',
    pointerEvents: 'none',
  }
  let placed: React.CSSProperties
  if (animation === 'lower-third') {
    const gap = Math.round(compH * 0.015)
    placed = { ...base, left: Math.max(0, box.leftPx - gap - thickness), top: box.topPx, width: thickness, height: box.heightPx }
  } else {
    const width = Math.round(Math.min(box.widthPx * 0.35, compW * 0.12))
    placed = {
      ...base,
      left: align === 'left' ? Math.round(box.leftPx) : Math.round(box.leftPx + box.widthPx / 2 - width / 2),
      top: Math.round(box.topPx + box.heightPx + compH * 0.012),
      width,
      height: thickness,
    }
  }
  // A rotated headline carries its rule with it: rotate the rule about the TEXT's center, not its own.
  const turn = rotateCss(rotation)
  if (!turn) return placed
  const originX = box.leftPx + box.widthPx / 2 - (placed.left as number)
  const originY = box.topPx + box.heightPx / 2 - (placed.top as number)
  return { ...placed, transform: turn, transformOrigin: `${originX}px ${originY}px` }
}

/** Mixes a hex color toward black by `amount` (0..1). Null for non-hex input. */
export function darkenHex(color: string, amount: number): string | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec((color ?? '').trim())
  if (!m) return null
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]
  const t = Math.min(1, Math.max(0, amount))
  const out = [0, 2, 4].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) * (1 - t)).toString(16).padStart(2, '0'))
  return `#${out.join('')}`
}

/**
 * Mixes a hex color toward white by `amount` (0..1). Returns null for anything
 * that is not a plain hex color, so callers can fall back to the solid color.
 */
export function lightenHex(color: string, amount: number): string | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec((color ?? '').trim())
  if (!m) return null
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]
  const t = Math.min(1, Math.max(0, amount))
  const out = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16)
    return Math.round(v + (255 - v) * t).toString(16).padStart(2, '0')
  })
  return `#${out.join('')}`
}

/** Style for the call-to-action pill. `background` is the layer color; the label color is chosen by the caller. */
export function ctaPillStyle(opts: {
  fontSizePx: number
  background: string
  color: string
  fontFamily?: string
  rotation?: number
}): React.CSSProperties {
  const role = ROLE_STYLE.cta
  // A top-lit gradient from a lighter shade to the exact layer color. It is opaque on
  // purpose: the browser exporter draws a gradient INSTEAD of the background color, so a
  // translucent highlight over a solid color would lose the color in exported videos.
  const lit = lightenHex(opts.background, 0.22)
  return {
    background: lit ? `linear-gradient(to bottom, ${lit}, ${opts.background})` : opts.background,
    color: opts.color,
    padding: '0.4em 1.1em',
    // Exactly half the pill's height (line-height 1.15em + 2 x 0.4em padding = 1.95em). A huge
    // radius like 999px is clamped by browsers but NOT by the browser exporter, which draws an ellipse.
    borderRadius: '0.975em',
    display: 'inline-block',
    // The box width is an estimate; never let the label wrap inside the pill.
    whiteSpace: 'nowrap',
    fontFamily: fontStackById(opts.fontFamily),
    fontSize: opts.fontSizePx,
    fontWeight: role.fontWeight,
    lineHeight: role.lineHeight,
    letterSpacing: role.letterSpacing,
    boxShadow: PILL_SHADOW,
    ...(rotateCss(opts.rotation) ? { transform: rotateCss(opts.rotation), transformOrigin: 'center center' } : {}),
  }
}

/**
 * Background of the branded end card: the brand color with a gentle diagonal
 * lift (darker corner to lighter corner). Opaque linear-gradient only, so the
 * browser exporter draws it. Non-hex colors fall back to the plain color.
 */
export function endCardBackground(primary: string): string {
  const dark = darkenHex(primary, 0.28)
  const light = lightenHex(primary, 0.12)
  return dark && light ? `linear-gradient(155deg, ${dark} 0%, ${primary} 55%, ${light} 100%)` : primary
}
