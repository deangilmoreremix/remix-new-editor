/**
 * Batch 3h shared helpers — brand media, brand placeholders and sizing.
 *
 * The fourteen batch-3h designs are the React Video Editor (repo 2) media and
 * particle templates. Twelve of the fourteen upstream files paint every
 * "photo" as a hard-coded CSS gradient (no image at all), and the other two
 * (`ken-burns`, `zoom-pulse`) default to a REMOTE unsplash/pexels photo. The
 * product rule is the same for all of them:
 *
 *  - an image slot shows the customer's OWN brand media (`media.product`,
 *    `media.service`, `media.logo`, in that order of preference), cycling
 *    through whichever images exist when a design has more slots than images;
 *  - when the customer has no brand media the slot shows a tasteful
 *    brand-colour gradient tile carrying the business name — NEVER a remote
 *    URL. The upstream remote defaults stay documented in the edited copies
 *    (so a no-props render reproduces the upstream) but no adapter ever lets
 *    them through.
 *
 * This module is a helper module, NOT a design: it exports no
 * `RemotionDesignTemplate`.
 */

import React from 'react'
import { Img } from 'remotion'
import type { RemotionDesignComponentProps, RemotionDesignMediaRole } from '../../types'
import { DESIGN_FONT_STACK } from '../fonts'
import { darkenColor, pickColor, truncateText } from '../shared'
import { lightenColor } from '../rveSharedDesign'

/* -------------------------------------------------------------------------- */
/* Brand media                                                                 */
/* -------------------------------------------------------------------------- */

/** One brand image the adapter can place in a slot. */
export interface BrandImage {
  url: string
  role: RemotionDesignMediaRole
}

/** The order the adapters prefer brand media in. */
const MEDIA_ORDER: RemotionDesignMediaRole[] = ['product', 'service', 'logo']

/**
 * The brand images a design can use, in preference order (product, service,
 * logo). Empty strings, `null` and non-strings are dropped.
 */
export function brandImages(props: Pick<RemotionDesignComponentProps, 'media'>): BrandImage[] {
  const media = props.media ?? {}
  const out: BrandImage[] = []
  for (const role of MEDIA_ORDER) {
    const value = media[role]
    if (typeof value === 'string' && value.trim()) out.push({ url: value.trim(), role })
  }
  return out
}

/**
 * Fills `count` slots by cycling through `images`. With no images every slot
 * is `null`, which the adapters render as a brand placeholder tile.
 */
export function cycleImages(images: BrandImage[], count: number): Array<BrandImage | null> {
  return Array.from({ length: Math.max(0, count) }, (_, i) =>
    images.length > 0 ? images[i % images.length] : null,
  )
}

/** A product/service photo fills a slot edge to edge; a logo is contained. */
export function isPhoto(image: BrandImage | null): image is BrandImage {
  return Boolean(image && image.role !== 'logo')
}

/* -------------------------------------------------------------------------- */
/* Sizing                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The canvas scale factor.
 *
 * The upstream templates size everything in fixed px (and `rem`) against a
 * 1920x1080 gallery card. The short edge is 1080 px in that card and in all
 * four supported formats, so `min(width, height) / 1080` is 1 for the
 * upstream card and keeps every format proportional.
 */
export function canvasScale(props: Pick<RemotionDesignComponentProps, 'width' | 'height'>): number {
  return Math.max(0.1, Math.min(props.width, props.height) / 1080)
}

/** Whether the composition is portrait (9:16, 4:5). */
export function isPortrait(props: Pick<RemotionDesignComponentProps, 'width' | 'height'>): boolean {
  return props.height > props.width
}

/**
 * How many characters of a single line fit in `widthPx` at `fontSizePx`.
 * The same 0.62 em average advance the repo-2 helpers use.
 */
export function charsThatFit(widthPx: number, fontSizePx: number, cap: number): number {
  const perChar = Math.max(1, fontSizePx * 0.62)
  return Math.max(4, Math.min(cap, Math.floor(widthPx / perChar)))
}

/** Truncates `text` to what fits on one line of `widthPx`. */
export function fitLine(text: string, widthPx: number, fontSizePx: number, cap = 60): string {
  return truncateText(text, charsThatFit(widthPx, fontSizePx, cap))
}

/* -------------------------------------------------------------------------- */
/* Brand colours                                                               */
/* -------------------------------------------------------------------------- */

/** The brand colours with defaults filled in. */
export function brandPalette(props: Pick<RemotionDesignComponentProps, 'colors' | 'color'>): {
  primary: string
  accent: string
  text: string
} {
  return {
    primary: pickColor([props.colors?.primary], '#29d3f2'),
    accent: pickColor([props.colors?.accent], '#28c98b'),
    text: pickColor([props.color, props.colors?.text], '#ffffff'),
  }
}

/**
 * The designed full-scene background: a deep, brand-tinted gradient that
 * replaces the upstream's `#111827` slate.
 */
export function sceneBackground(props: Pick<RemotionDesignComponentProps, 'colors' | 'color'>): string {
  const { primary, accent } = brandPalette(props)
  return `linear-gradient(135deg, ${darkenColor(primary, 0.2)}, ${darkenColor(accent, 0.1)})`
}

/**
 * Six two-tone brand gradients, mirroring the upstream's six two-tone
 * blue/violet tile gradients (`#3b82f6 → #1d4ed8`, `#a855f7 → #7c3aed`, …).
 */
export function brandGradients(props: Pick<RemotionDesignComponentProps, 'colors' | 'color'>): string[] {
  const { primary, accent } = brandPalette(props)
  return [
    `linear-gradient(135deg, ${primary}, ${darkenColor(primary, 0.55)})`,
    `linear-gradient(135deg, ${accent}, ${darkenColor(accent, 0.55)})`,
    `linear-gradient(135deg, ${lightenColor(primary, 0.2)}, ${primary})`,
    `linear-gradient(135deg, ${darkenColor(accent, 0.7)}, ${accent})`,
    `linear-gradient(135deg, ${darkenColor(primary, 0.5)}, ${lightenColor(primary, 0.15)})`,
    `linear-gradient(135deg, ${accent}, ${darkenColor(primary, 0.6)})`,
  ]
}

/** `#rrggbb` → `"r, g, b"` (for the upstreams that template an `rgba()`). */
export function rgbTriple(value: string, fallback = '255, 255, 255'): string {
  const hex = (value || '').trim().replace(/^#/, '')
  let full = ''
  if (/^[0-9a-f]{3}$/i.test(hex)) full = hex.split('').map((c) => c + c).join('')
  else if (/^[0-9a-f]{6}$/i.test(hex)) full = hex
  if (!full) return fallback
  return `${parseInt(full.slice(0, 2), 16)}, ${parseInt(full.slice(2, 4), 16)}, ${parseInt(
    full.slice(4, 6),
    16,
  )}`
}

/* -------------------------------------------------------------------------- */
/* Slot fill                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Fills one image slot of an upstream template.
 *
 * - product / service photo → the photo, `object-fit: cover`;
 * - logo → the logo contained on the brand gradient, with breathing room;
 * - nothing → the brand placeholder: the gradient plus the business name.
 *
 * It always fills its (positioned) parent. It never renders a remote URL of
 * its own: the only `src` it can emit is the brand URL it was handed.
 */
export function BrandMediaFill({
  image,
  label,
  background,
  fontSizePx,
  textColor = '#ffffff',
  filter,
  showLabel = true,
}: {
  image: BrandImage | null
  label: string
  background: string
  fontSizePx: number
  textColor?: string
  /** Optional CSS filter for the image (e.g. a greyscale "before"). */
  filter?: string
  /** Whether the placeholder draws the business name. */
  showLabel?: boolean
}): React.ReactElement {
  const fill: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
  }
  if (image && image.role !== 'logo') {
    return (
      <Img
        src={image.url}
        data-batch3h-media={image.role}
        style={{ ...fill, objectFit: 'cover', display: 'block', filter }}
      />
    )
  }
  if (image) {
    return (
      <div style={{ ...fill, background }}>
        <Img
          src={image.url}
          data-batch3h-media="logo"
          style={{
            position: 'absolute',
            left: '14%',
            top: '14%',
            width: '72%',
            height: '72%',
            objectFit: 'contain',
            filter,
          }}
        />
      </div>
    )
  }
  return (
    <div
      data-batch3h-placeholder
      style={{
        ...fill,
        background,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        filter,
      }}
    >
      {showLabel && label ? (
        <>
          <span
            style={{
              color: textColor,
              fontFamily: DESIGN_FONT_STACK,
              fontSize: fontSizePx,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
              textShadow: '0 2px 10px rgba(0,0,0,0.35)',
              maxWidth: '90%',
              overflow: 'hidden',
            }}
          >
            {label}
          </span>
          <span
            style={{
              marginTop: Math.round(fontSizePx * 0.4),
              width: Math.round(fontSizePx * 1.6),
              height: Math.max(2, Math.round(fontSizePx * 0.12)),
              borderRadius: 999,
              background: textColor,
              opacity: 0.7,
            }}
          />
        </>
      ) : null}
    </div>
  )
}
