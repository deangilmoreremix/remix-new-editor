/**
 * Batch-local helpers for the batch 3g designs (React Video Editor
 * transitions and overlay effects from `remotion-templates`).
 *
 * Every transition in this batch is played as an INTRO REVEAL over the
 * customer's video: the "before" side is a brand-coloured card that shows the
 * business name (with the headline as a sub-line and the logo when there is
 * one), and the "after" side is left transparent so the transition uncovers
 * the video rendered underneath the design layer. The card is drawn here once
 * and handed to each upstream copy through its render slot.
 *
 * This module is a helper module, NOT a design: it exports no template.
 */

import React from 'react'
import { Img } from 'remotion'
import type {
  RemotionDesignColorBinding,
  RemotionDesignComponentProps,
  RemotionDesignMediaBinding,
  RemotionDesignTemplate,
  RemotionDesignTextSlot,
} from '../../types'
import type { PreviewAspectRatio } from '../../../preview/types'
import { darkenColor, pickColor, slotText, slotValue, truncateText } from '../shared'
import { RVE_ATTRIBUTION, lightenColor, rveFontSizePx, rveMaxChars } from '../rveSharedDesign'

/* -------------------------------------------------------------------------- */
/* Source                                                                      */
/* -------------------------------------------------------------------------- */

export const RVE_3G_REPOSITORY = 'remotion-templates'
export const RVE_3G_REPOSITORY_URL = 'https://github.com/deangilmoreremix/remotion-templates'

/** The `source` block of a batch 3g design. */
export function rve3gSource(slug: string): RemotionDesignTemplate['source'] {
  return {
    repository: RVE_3G_REPOSITORY,
    repositoryUrl: RVE_3G_REPOSITORY_URL,
    sourcePath: `templates/${slug}.tsx`,
    license: 'MIT',
    attribution: RVE_ATTRIBUTION,
  }
}

/** Every format the batch supports: all layouts are canvas-relative. */
export const RVE_3G_ASPECT_RATIOS: PreviewAspectRatio[] = ['16:9', '9:16', '1:1', '4:5']

/** Text slots of a transition's brand card. */
export const TRANSITION_TEXT_SLOTS: RemotionDesignTextSlot[] = [
  { key: 'businessName', field: 'businessName', label: 'Business name', primary: true, maxLength: 40 },
  { key: 'headline', field: 'headline', label: 'Sub-line', maxLength: 64 },
]

/** Colour bindings of a transition's brand card. */
export const TRANSITION_COLORS: RemotionDesignColorBinding[] = [
  { role: 'primary', label: 'Card colour' },
  { role: 'accent', label: 'Accent' },
  { role: 'text', label: 'Text colour' },
]

/** The optional logo shown on a transition's brand card. */
export const TRANSITION_MEDIA: RemotionDesignMediaBinding[] = [
  { role: 'logo', label: 'Logo (optional)', required: false },
]

/* -------------------------------------------------------------------------- */
/* Brand values                                                                */
/* -------------------------------------------------------------------------- */

export interface BrandPalette {
  primary: string
  accent: string
  text: string
  /** The card fill: a deep diagonal gradient of the brand primary. */
  cardBackground: string
  /** A near-black shade of the primary (bars, masks, vignettes). */
  deep: string
}

export function brandPalette(props: RemotionDesignComponentProps): BrandPalette {
  const primary = pickColor([props.colors?.primary], '#29d3f2')
  const accent = pickColor([props.colors?.accent], '#28c98b')
  const text = pickColor([props.color, props.colors?.text], '#ffffff')
  return {
    primary,
    accent,
    text,
    cardBackground: `linear-gradient(135deg, ${darkenColor(primary, 0.55)}, ${darkenColor(primary, 0.2)})`,
    deep: darkenColor(primary, 0.12),
  }
}

/** "r, g, b" channels of a hex colour (for upstream `rgba(${x}, a)` props). */
export function rgbTriplet(value: string, fallback: string): string {
  const hex = (value || '').trim().replace(/^#/, '')
  let r: number
  let g: number
  let b: number
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    r = parseInt(hex[0] + hex[0], 16)
    g = parseInt(hex[1] + hex[1], 16)
    b = parseInt(hex[2] + hex[2], 16)
  } else if (/^[0-9a-f]{6}$/i.test(hex)) {
    r = parseInt(hex.slice(0, 2), 16)
    g = parseInt(hex.slice(2, 4), 16)
    b = parseInt(hex.slice(4, 6), 16)
  } else {
    return fallback
  }
  return `${r}, ${g}, ${b}`
}

/** The ratio of the title to the composition's short edge. */
const TITLE_RATIO = 0.075
/** The ratio of the sub-line to the composition's short edge. */
const SUBTITLE_RATIO = 0.03

export interface BrandCopy {
  title: string
  subtitle: string
}

/**
 * The card copy: the business name (falling back to the headline), and the
 * headline as a sub-line when it says something different. Both lines are
 * truncated to what fits on one line of the composition.
 */
export function brandCopy(props: RemotionDesignComponentProps, titleRatio = TITLE_RATIO): BrandCopy {
  const titleSize = rveFontSizePx(props, titleRatio)
  const subtitleSize = rveFontSizePx(props, SUBTITLE_RATIO)
  const rawTitle = slotText(props, 'businessName', ['headline'])
  const rawSubtitle = slotValue(props, 'headline')
  const title = truncateText(rawTitle, rveMaxChars(props, titleSize, 40))
  const subtitle =
    rawSubtitle && rawSubtitle !== rawTitle
      ? truncateText(rawSubtitle, rveMaxChars(props, subtitleSize, 64))
      : ''
  return { title, subtitle }
}

/** Linear 1 -> 0 between `start` and `end` (clamped). */
export function fadeOut(frame: number, start: number, end: number): number {
  if (frame <= start) return 1
  if (frame >= end) return 0
  return 1 - (frame - start) / Math.max(1, end - start)
}

/* -------------------------------------------------------------------------- */
/* The brand card                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The "before" side of every transition: the logo (or a brand-gradient
 * monogram tile when there is no logo), the business name and the sub-line.
 * All sizes derive from the composition's short edge, so 9:16 and 1:1 read
 * the same as 16:9; every line is single-line and truncated.
 */
export function BrandCardContent({
  props,
  copy,
  showEmblem = true,
  titleRatio = TITLE_RATIO,
  letterSpacing,
}: {
  props: RemotionDesignComponentProps
  copy?: BrandCopy
  showEmblem?: boolean
  titleRatio?: number
  letterSpacing?: string
}): React.ReactElement {
  const palette = brandPalette(props)
  const { title, subtitle } = copy ?? brandCopy(props, titleRatio)
  const shortEdge = Math.min(props.width, props.height)
  const titleSize = rveFontSizePx(props, titleRatio)
  const subtitleSize = rveFontSizePx(props, SUBTITLE_RATIO)
  const emblem = Math.round(shortEdge * 0.13)
  const logo = typeof props.media?.logo === 'string' && props.media.logo.trim() ? props.media.logo : null
  const monogram = title.trim().charAt(0).toUpperCase()

  return (
    <div
      data-rve-before
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        maxWidth: '88%',
        textAlign: 'center',
      }}
    >
      {showEmblem ? (
        logo ? (
          <Img
            src={logo}
            data-rve-logo
            style={{
              width: emblem,
              height: emblem,
              objectFit: 'contain',
              marginBottom: Math.round(shortEdge * 0.025),
            }}
          />
        ) : (
          <div
            data-rve-logo-placeholder
            style={{
              width: emblem,
              height: emblem,
              borderRadius: Math.round(emblem * 0.22),
              background: `linear-gradient(135deg, ${palette.primary}, ${palette.accent})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: palette.text,
              fontSize: Math.round(emblem * 0.5),
              fontWeight: 800,
              marginBottom: Math.round(shortEdge * 0.025),
              boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
            }}
          >
            {monogram}
          </div>
        )
      ) : null}
      {title ? (
        <h2
          style={{
            color: palette.text,
            fontSize: titleSize,
            fontWeight: 800,
            lineHeight: 1.1,
            margin: 0,
            whiteSpace: 'nowrap',
            letterSpacing,
            textShadow: '0 2px 12px rgba(0,0,0,0.45)',
          }}
        >
          {title}
        </h2>
      ) : null}
      {subtitle ? (
        <p
          style={{
            color: lightenColor(palette.accent, 0.35),
            fontSize: subtitleSize,
            fontWeight: 500,
            lineHeight: 1.2,
            margin: 0,
            marginTop: Math.round(shortEdge * 0.014),
            whiteSpace: 'nowrap',
            textShadow: '0 1px 8px rgba(0,0,0,0.45)',
          }}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  )
}

/** The "after" scene every transition hands its upstream: nothing at all. */
export const TRANSPARENT_SCENE = { background: 'transparent', content: null } as const
