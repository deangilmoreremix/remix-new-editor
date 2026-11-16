/**
 * Adapter for the upstream `rve-geometric-patterns` template.
 *
 * Upstream: `templates/geometric-patterns.tsx` (remotion-templates, MIT —
 * React Video Editor, no named copyright holder). Twenty nested outlines —
 * from a square to a circle — spin and grow into place, one after another.
 *
 * FULL-SCENE INTRO CARD, not an overlay: the outlines are 2 px lines at 10 %
 * white, which only read against the upstream's dark backdrop; over a busy
 * video they vanish. So the backdrop is kept (a deep primary -> accent
 * diagonal instead of the upstream slate), the outlines are brightened to a
 * light brand tint, and the layer plays as an intro card that then reveals
 * the video (`placement.endFrame` in the catalog).
 *
 * The upstream has no text. An intro card with no words is not useful to a
 * business, so the adapter adds ONE line on top of the (unmodified) pattern:
 * the business name (the PRIMARY slot), fading up once the outlines have
 * started to settle. It is truncated to one line and sized from the
 * composition, so it never leaves the canvas.
 */

import React from 'react'
import { interpolate, useCurrentFrame } from 'remotion'
import { GeometricPatterns } from '../../_upstream/rve-geometric-patterns/GeometricPatterns'
import { darkenColor, slotText, truncateText, type DesignAdapterProps } from '../shared'
import { lightenColor, RveDesignStage } from '../rveSharedDesign'
import { DESIGN_DISPLAY_FONT_STACK } from '../fonts'
import { brandAccent, brandPrimary, readableOnDark, rgba } from './shared3f'

/** Longest title, in characters. */
const MAX_TITLE_CHARS = 32
/** Title size cap as a fraction of the short edge. */
const TITLE_RATIO = 0.1

export const RveGeometricPatternsDesign: React.FC<DesignAdapterProps> = (props) => {
  const frame = useCurrentFrame()
  const primary = brandPrimary(props)
  const accent = brandAccent(props)
  const short = Math.min(props.width, props.height)

  const title = truncateText(slotText(props, 'businessName', ['headline']), MAX_TITLE_CHARS)
  const titlePx = Math.round(
    Math.min(short * TITLE_RATIO, (props.width * 0.84) / Math.max(1, title.length * 0.6)),
  )
  const titleOpacity = interpolate(frame, [24, 48], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const titleRise = interpolate(frame, [24, 48], [short * 0.03, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <RveDesignStage designId="rve-geometric-patterns" props={props}>
      <GeometricPatterns
        background={`linear-gradient(45deg, ${darkenColor(primary, 0.12)}, ${darkenColor(accent, 0.28)})`}
        strokeColor={rgba(lightenColor(primary, 0.5), 0.28)}
        strokeWidth={`${Math.max(2, Math.round(short / 360))}px`}
      />
      {title ? (
        <div
          data-rve-geometric-title
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              maxWidth: '88%',
              fontFamily: DESIGN_DISPLAY_FONT_STACK,
              fontSize: `${titlePx}px`,
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textAlign: 'center',
              color: readableOnDark(props),
              textShadow: '0 4px 18px rgba(0, 0, 0, 0.45)',
              opacity: titleOpacity,
              transform: `translateY(${titleRise}px)`,
            }}
          >
            {title}
          </div>
        </div>
      ) : null}
    </RveDesignStage>
  )
}

export default RveGeometricPatternsDesign
