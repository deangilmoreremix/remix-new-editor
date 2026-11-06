/**
 * Adapter for the upstream `bokeh-circles` template.
 *
 * Upstream: `src/components/bokeh-circles/BokehCircles.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * WHY THE UPSTREAM IS NOT DELEGATED TO ANY MORE (Phase 3, finding F1)
 * ------------------------------------------------------------------
 * The upstream paints each disc with `radial-gradient(circle, color 0%,
 * transparent 70%)`, `filter: blur(20px)` and `mix-blend-mode: screen`.
 * That is fine in the PREVIEW (a real browser DOM), but the branded export
 * rasterises the composition with `@remotion/web-renderer`, whose drawing
 * stage implements linear gradients (`parse-linear-gradient`) and box
 * shadows — and NO radial-gradient parser. Every disc therefore rasterised
 * to a fully transparent div, and the exported video contained NOTHING of
 * the design (P3-E's matrix measured changed-in-box == credit-only, i.e.
 * the design was invisible in every export; see
 * docs/phase3/EXPORT_MATRIX.md finding F1).
 *
 * The upstream file is frozen (reproduced verbatim from the MIT source), so
 * the fix lives HERE, in the adapter: the same seeded randomness, the same
 * drift/pulse motion and the same palette assignment, drawn with
 * rasteriser-supported primitives —
 *
 *   - a solid `backgroundColor` disc with `borderRadius: 50%` (supported),
 *   - its soft bokeh edge via `boxShadow` (`draw-box-shadow` is supported),
 *   - the disc's own `opacity` (supported),
 *   - and NO `radial-gradient`, NO `mix-blend-mode`, NO `filter`.
 *
 * Dropping `mix-blend-mode: screen` also retires the stacking-context
 * hazard the old doc comment tracked: with no blend mode there is nothing
 * for an ancestor transform or opacity to neutralise, so the discs can
 * never disappear the way they used to — in the preview or in the export.
 *
 * The trade is deliberate and recorded in `docs/phase3/DECISIONS.md`: the
 * discs read as soft glowing circles rather than gradient-falloff discs,
 * identically in preview and export (the two surfaces render the same
 * component, so they can never disagree).
 *
 * Its `baseColor` prop stays `transparent` and its optional `label` stays
 * `undefined` — the upstream default is the demo string
 * `"Background Demo"`.
 */

import React from 'react'
import { AbsoluteFill } from 'remotion'
import { DesignStage, pickColor, type DesignAdapterProps } from './shared'

/**
 * Number of discs.
 *
 * The upstream default is 24; over a customer's video that is a very heavy
 * full-frame effect, so the adapter starts lower.
 */
const CIRCLE_COUNT = 16

/** The upstream palette has four slots: accent, primary, accent, text. */
const PALETTE_SIZE = 4

/** The same pseudo-random the upstream uses, so the layout is identical. */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297
  return x - Math.floor(x)
}

export const VisualEffectDesign: React.FC<DesignAdapterProps> = (props) => {
  const accent = pickColor([props.colors?.accent], '#ffd1a4')
  const primary = pickColor([props.colors?.primary], '#ffe6c7')
  const text = pickColor([props.colors?.text], '#fff3d6')
  const frame = props.frame ?? 0

  // The upstream assigns a palette entry to each disc pseudo-randomly. Only
  // the seeded geometry and the palette SLOT are memoized: the colour itself
  // is resolved every render, so a brand-colour change repaints the discs in
  // the preview exactly as a freshly mounted export would draw them.
  const palette = [accent, primary, accent, text]

  // Identical disc generation to the upstream: same seed formulas, same
  // size/speed/phase/colour/opacity ranges.
  const circles = React.useMemo(() => {
    return Array.from({ length: CIRCLE_COUNT }, (_, i) => ({
      seedX: seededRandom(i * 3 + 1),
      seedY: seededRandom(i * 5 + 2),
      sizeBase: 80 + seededRandom(i * 7 + 3) * 240,
      speed: 0.4 + seededRandom(i * 11 + 4) * 0.8,
      phase: seededRandom(i * 13 + 5) * Math.PI * 2,
      paletteSlot: Math.floor(seededRandom(i * 17 + 6) * PALETTE_SIZE),
      opacity: 0.25 + seededRandom(i * 19 + 7) * 0.45,
    }))
  }, [])

  return (
    <DesignStage designId="visual-effect" props={props}>
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        {circles.map((c, i) => {
          // Same motion math as the upstream, frame for frame.
          const t = frame * 0.02 * c.speed + c.phase
          const x = c.seedX * 100 + Math.sin(t) * 8
          const y = c.seedY * 100 + Math.cos(t * 0.8) * 8
          const pulse = 1 + Math.sin(t * 1.2) * 0.15
          const size = c.sizeBase * pulse
          const color = palette[c.paletteSlot]
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${x}%`,
                top: `${y}%`,
                width: size,
                height: size,
                marginLeft: -size / 2,
                marginTop: -size / 2,
                borderRadius: '50%',
                // Solid disc + a wide, soft box-shadow glow: both primitives
                // are implemented by the export rasteriser, so the effect is
                // visible in the encoded output. This replaces the upstream's
                // radial-gradient + blur + screen-blend trio, none of which
                // the rasteriser draws (F1).
                backgroundColor: color,
                boxShadow: `0 0 ${size * 0.45}px ${size * 0.22}px ${color}`,
                opacity: c.opacity,
              }}
            />
          )
        })}
      </AbsoluteFill>
    </DesignStage>
  )
}

export default VisualEffectDesign
