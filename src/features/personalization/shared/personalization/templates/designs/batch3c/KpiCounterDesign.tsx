/**
 * Adapter for the upstream `kpi-counter` template (batch 3c).
 *
 * Upstream: `src/components/kpi-counter/KpiCounter.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * The upstream slides in a row (16:9) or a 2x2 grid (portrait/square) of
 * metric cards under a title, and counts every figure up on odometer drums.
 *
 * CATEGORY `data-visualization`: the cards sit on a designed panel (deep
 * shades of the brand primary) and the design plays as an intro card
 * (`placement.endFrame`).
 *
 * DATA: the customer cannot enter metrics, so the four cards are a PINNED
 * PLACEHOLDER set labelled "Placeholder 1".."4" (the same convention as
 * `bar-chart-anim`, contract addition C13) — the design never presents
 * invented figures as the customer's own. The upstream demo figures
 * ("Q4 Results", "Revenue $2.8M"…) are never used. The title is the
 * customer's headline and the subtitle the offer.
 *
 * COLOUR NORMALISATION: the upstream builds `${accentColor}18`, so the accent
 * is normalised to `#rrggbb` first.
 */

import React from 'react'
import { KpiCounter, type KpiMetric } from '../../_upstream/kpi-counter/KpiCounter'
import { DesignStage, pickColor, slotText, slotValue, truncateText, type DesignAdapterProps } from '../shared'
import { fitChars, readableOnDark, shade, shortSide, tint, toHex6 } from './batch3cShared'

/** The placeholder figures; colours are filled from the brand at render time. */
export const KPI_PLACEHOLDER_METRICS: Array<Omit<KpiMetric, 'color'>> = [
  { label: 'Placeholder 1', value: 100, prefix: '', suffix: '%', decimals: 0, icon: '+' },
  { label: 'Placeholder 2', value: 250, prefix: '', suffix: '+', decimals: 0, icon: '^' },
  { label: 'Placeholder 3', value: 1200, prefix: '', suffix: '', decimals: 0, icon: '#' },
  { label: 'Placeholder 4', value: 48, prefix: '', suffix: '', decimals: 0, icon: '*' },
]

type Props = DesignAdapterProps & { metrics?: Array<Omit<KpiMetric, 'color'> & { color?: string }> }

export const KpiCounterDesign: React.FC<Props> = (props) => {
  const s = shortSide(props)
  const usable = props.width - s * 0.12
  const title = truncateText(slotText(props, 'title', ['businessName']), Math.min(40, fitChars(usable, s * 0.07, 0.6)))
  const subtitle = truncateText(slotValue(props, 'subtitle'), Math.min(64, fitChars(usable, s * 0.033, 0.52)))

  const primary = toHex6(props.colors?.primary, '#29d3f2')
  const accent = toHex6(props.colors?.accent, '#28c98b')
  const palette = [accent, primary, tint(accent, 0.35), tint(primary, 0.35)]
  const source = Array.isArray(props.metrics) && props.metrics.length > 0 ? props.metrics : KPI_PLACEHOLDER_METRICS
  const metrics: KpiMetric[] = source.slice(0, 4).map((metric, i) => ({
    ...metric,
    color: (metric as { color?: string }).color ?? palette[i % palette.length],
  }))

  return (
    <DesignStage designId="kpi-counter" props={props}>
      <KpiCounter
        backgroundColor={shade(primary, 0.14)}
        cardColor={shade(primary, 0.26)}
        textColor={readableOnDark(pickColor([props.color, props.colors?.text], '#f8fafc'))}
        subtextColor="rgba(255,255,255,0.68)"
        accentColor={accent}
        title={title}
        subtitle={subtitle}
        metrics={metrics}
      />
    </DesignStage>
  )
}

export default KpiCounterDesign
