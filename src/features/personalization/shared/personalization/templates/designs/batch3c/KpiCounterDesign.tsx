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
 * DATA: the customer types up to four figures (label + number per card) in the
 * editor. A card with no usable number is not drawn, and with none typed only the
 * title and subtitle show — the design never prints stand-in text or invented
 * figures as the customer's own. The upstream demo figures ("Q4 Results",
 * "Revenue $2.8M"…) are never used. The title is the customer's headline and
 * the subtitle the offer.
 *
 * COLOUR NORMALISATION: the upstream builds `${accentColor}18`, so the accent
 * is normalised to `#rrggbb` first.
 */

import React from 'react'
import { KpiCounter, type KpiMetric } from '../../_upstream/kpi-counter/KpiCounter'
import { DesignStage, pickColor, slotText, slotValue, truncateText, type DesignAdapterProps } from '../shared'
import { fitChars, readableOnDark, shade, shortSide, tint, toHex6 } from './batch3cShared'

/** The four cards the customer can fill in (label + number each). */
export const KPI_CARD_COUNT = 4

/** Slot keys for card `n` (1-based). */
export const kpiSlotKeys = (n: number) => ({ label: `kpi${n}Label`, value: `kpi${n}Value` })

/**
 * Parses what the customer typed into a card's number slot: an optional prefix ("$"), a number with optional thousands
 * commas and decimals, and an optional suffix ("%", "+", " yrs"). Returns null when there is no number to count to.
 */
export function parseKpiValue(text: string): Pick<KpiMetric, 'value' | 'prefix' | 'suffix' | 'decimals'> | null {
  const m = /^(\D*?)(-?\d[\d,]*(?:\.\d+)?)(.*)$/.exec(text.trim())
  if (!m) return null
  const value = Number(m[2].replace(/,/g, ''))
  if (!Number.isFinite(value)) return null
  const decimals = m[2].includes('.') ? m[2].split('.')[1].length : 0
  return { value, prefix: m[1].trim().slice(0, 3), suffix: m[3].trimEnd().slice(0, 8), decimals: Math.min(decimals, 2) }
}

type Props = DesignAdapterProps

export const KpiCounterDesign: React.FC<Props> = (props) => {
  const s = shortSide(props)
  const usable = props.width - s * 0.12
  const title = truncateText(slotText(props, 'title', ['businessName']), Math.min(40, fitChars(usable, s * 0.07, 0.6)))
  const subtitle = truncateText(slotValue(props, 'subtitle'), Math.min(64, fitChars(usable, s * 0.033, 0.52)))

  const primary = toHex6(props.colors?.primary, '#29d3f2')
  const accent = toHex6(props.colors?.accent, '#28c98b')
  const palette = [accent, primary, tint(accent, 0.35), tint(primary, 0.35)]
  const metrics: KpiMetric[] = []
  for (let n = 1; n <= KPI_CARD_COUNT; n++) {
    const keys = kpiSlotKeys(n)
    const parsed = parseKpiValue(slotValue(props, keys.value))
    if (!parsed) continue
    metrics.push({
      ...parsed,
      label: truncateText(slotValue(props, keys.label), 24),
      icon: ['+', '^', '#', '*'][(n - 1) % 4],
      color: palette[(n - 1) % palette.length],
    })
  }

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
