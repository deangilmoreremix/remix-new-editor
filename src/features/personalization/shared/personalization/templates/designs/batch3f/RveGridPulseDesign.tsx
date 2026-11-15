/**
 * Adapter for the upstream `rve-grid-pulse` template.
 *
 * Upstream: `templates/grid-pulse.tsx` (remotion-templates, MIT — React Video
 * Editor, no named copyright holder). A grid of dots pulses in a wave that
 * ripples outward from the centre.
 *
 * OVERLAY: the upstream's solid `#111827` canvas is forced `transparent`, so
 * the dots ripple over the customer's video (each dot already fades between
 * 15 % and 100 % opacity, so the footage stays visible between pulses).
 *
 * Brand mapping: dots in the brand primary. The upstream lays out a fixed
 * 12 x 8 grid, which is right for 16:9 but stretches into tall gaps on 9:16;
 * the adapter picks a column / row count that keeps the cells roughly square
 * on every format, and sizes the dots from the short edge.
 */

import React from 'react'
import { GridPulse } from '../../_upstream/rve-grid-pulse/GridPulse'
import { TRANSPARENT, type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import { brandPrimary } from './shared3f'

/** Columns x rows for the composition's aspect ratio. */
export function gridPulseLayout(width: number, height: number): { cols: number; rows: number } {
  const ratio = Math.max(1, width) / Math.max(1, height)
  if (ratio >= 1.3) return { cols: 12, rows: 8 } // 16:9 — the upstream grid
  if (ratio >= 0.9) return { cols: 10, rows: 10 } // 1:1
  if (ratio >= 0.7) return { cols: 9, rows: 11 } // 4:5
  return { cols: 8, rows: 12 } // 9:16
}

/** Dot size as a fraction of the short edge (upstream: 10 px on 1080). */
const DOT_RATIO = 0.014

export const RveGridPulseDesign: React.FC<DesignAdapterProps> = (props) => {
  const { cols, rows } = gridPulseLayout(props.width, props.height)
  const dotSize = Math.max(4, Math.round(Math.min(props.width, props.height) * DOT_RATIO))

  return (
    <RveDesignStage designId="rve-grid-pulse" props={props}>
      <GridPulse
        cols={cols}
        rows={rows}
        dotSize={dotSize}
        background={TRANSPARENT}
        dotColor={brandPrimary(props)}
      />
    </RveDesignStage>
  )
}

export default RveGridPulseDesign
