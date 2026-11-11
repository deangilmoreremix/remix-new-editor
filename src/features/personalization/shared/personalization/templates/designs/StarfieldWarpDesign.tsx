/**
 * Adapter for the upstream `starfield` template.
 *
 * Upstream: `src/components/starfield/Starfield.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp), frozen verbatim at
 * `../_upstream/starfield-warp/Starfield.tsx`.
 *
 * The upstream is a full-frame particle field: stars stream radially outward
 * from the centre of the composition. Its `baseColor` prop is the canvas fill
 * and is forced to `transparent` (it is consumed as a plain `backgroundColor`,
 * so `"transparent"` is safe — see A6's contract addition C4).
 *
 * Two upstream values must never be reachable:
 *  - `baseColor` defaults to the opaque `#02030a` canvas;
 *  - `label` defaults to the demo string `"BACKGROUND"`; the local renderer
 *    below draws no label at all.
 *
 * The design is placed full-frame (`scale = 1`, `animation: 'none'`,
 * `opacity: 1`) because it is a whole-canvas effect. It uses no
 * `mix-blend-mode` and no `filter`, so it does not suffer the stacking-context
 * trap that `bokeh-circles` has.
 *
 * LOCAL ADAPTER CUSTOMIZATION — thicker star cores (Phase 3, finding F2)
 * ---------------------------------------------------------------------
 * The upstream sizes each star core at `1 + random * 2.5` px. After H.264
 * quantisation in the browser export those 1–3.5 px streaks lose their brand
 * colour (12 brand-primary pixels in the export matrix, threshold 200). The
 * star size is computed inside the upstream component and is not a prop, and
 * the upstream file is frozen, so the correction cannot be passed in.
 *
 * `ThickCoreStarfield` is therefore a LOCAL derivative of the upstream render
 * function (the same pattern `VisualEffectDesign` uses for finding F1). It
 * keeps the upstream's seeded layout, radial motion, size scaling, trail
 * length, gradient and glow formulas unchanged and parameterises exactly one
 * thing — the core size range — which the adapter sets to `3 + random * 4`
 * (3–7 px). `starfieldUpstreamIntegrity.test.tsx` proves both halves: with
 * the upstream's own range the derivative renders byte-identical markup to
 * the frozen upstream, and the frozen upstream file still matches its pinned
 * upstream revision.
 */

import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'
import { useDesignFonts } from './fonts'
import {
  DesignStage,
  TRANSPARENT,
  pickColor,
  type DesignAdapterProps,
} from './shared'

/**
 * The upstream's own motion constants.
 *
 * `STAR_COUNT` is one third of the upstream's 180: every star is an
 * absolutely positioned div with a gradient and a glow, and the effect runs
 * for 150 frames, so 180 shadowed elements per frame is a heavy full-frame
 * effect over a customer's video (the same call the bokeh adapter made with
 * its disc count). 60 streaks still read as a full warp field.
 */
const STAR_COUNT = 60
const WARP_SPEED = 4

/** A star core size range: `min + random * range` px. */
export type StarCoreSize = { min: number; range: number }

/** The frozen upstream's range (`sizeBase: 1 + random * 2.5`). */
export const UPSTREAM_STAR_CORE_SIZE: StarCoreSize = { min: 1, range: 2.5 }

/**
 * The adapter's range (F2): 3–7 px cores keep their brand colour through
 * H.264 quantisation in the exported MP4.
 */
export const EXPORT_STAR_CORE_SIZE: StarCoreSize = { min: 3, range: 4 }

// The upstream's deterministic pseudo-random generator, unchanged, so the
// star layout matches the upstream's star for star.
const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 9301 + 49297) * 49297
  return x - Math.floor(x)
}

export type ThickCoreStarfieldProps = {
  count: number
  starColor: string
  baseColor: string
  warpSpeed: number
  coreSize: StarCoreSize
}

/**
 * The upstream `Starfield` render function with the core size range as a
 * parameter and no label. Every other expression mirrors the upstream.
 */
export const ThickCoreStarfield: React.FC<ThickCoreStarfieldProps> = ({
  count,
  starColor,
  baseColor,
  warpSpeed,
  coreSize,
}) => {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const cx = width / 2
  const cy = height / 2
  const maxR = Math.sqrt(cx * cx + cy * cy)

  const stars = React.useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      angle: seededRandom(i * 3 + 1) * Math.PI * 2,
      startOffset: seededRandom(i * 5 + 2) * maxR,
      sizeBase: coreSize.min + seededRandom(i * 7 + 3) * coreSize.range,
      speedJitter: 0.7 + seededRandom(i * 11 + 4) * 0.6,
    }))
  }, [count, maxR, coreSize.min, coreSize.range])

  return (
    <AbsoluteFill style={{ backgroundColor: baseColor, overflow: 'hidden' }}>
      {stars.map((s, i) => {
        const dist = (s.startOffset + frame * warpSpeed * s.speedJitter) % maxR
        const x = cx + Math.cos(s.angle) * dist
        const y = cy + Math.sin(s.angle) * dist
        const sizeScale = dist / maxR
        const size = s.sizeBase * (0.5 + sizeScale * 1.5)
        const alpha = Math.min(1, sizeScale * 1.5)
        const trailLen = sizeScale * 18 * warpSpeed * 0.5
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: size + trailLen,
              height: size,
              marginLeft: -(size + trailLen) / 2,
              marginTop: -size / 2,
              background: `linear-gradient(90deg, transparent, ${starColor})`,
              borderRadius: size / 2,
              opacity: alpha,
              transform: `rotate(${s.angle}rad)`,
              transformOrigin: 'center',
              boxShadow: `0 0 ${size * 2}px ${starColor}`,
            }}
          />
        )
      })}
    </AbsoluteFill>
  )
}

export const StarfieldWarpDesign: React.FC<DesignAdapterProps> = (props) => {
  useDesignFonts()

  return (
    <DesignStage designId="starfield-warp" props={props}>
      <ThickCoreStarfield
        count={STAR_COUNT}
        starColor={pickColor(
          [props.colors?.text, props.colors?.accent, props.colors?.primary],
          '#ffffff',
        )}
        baseColor={TRANSPARENT}
        warpSpeed={WARP_SPEED}
        coreSize={EXPORT_STAR_CORE_SIZE}
      />
    </DesignStage>
  )
}

export default StarfieldWarpDesign
