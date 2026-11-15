/**
 * Adapter for the upstream `rve-animated-list` template.
 *
 * Upstream: `templates/animated-list.tsx` (remotion-templates, MIT — React
 * Video Editor, no named copyright holder).
 *
 * Bullet rows (a coloured disc and a label) spring in from the left, five
 * frames apart. The upstream has no background of its own, so it is an
 * overlay as-is; the adapter only adds a soft text shadow so the labels read
 * on bright footage.
 *
 * Brand mapping — the rows are the customer's key selling points, built from
 * the brand fields and skipping empty ones:
 *
 *   row 1: offer      (primary slot)
 *   row 2: phone
 *   row 3: website
 *
 * When fewer than three of those exist the list falls back to the call to
 * action, the headline and the business name (in that order) so it is never
 * empty. The discs keep the upstream's three-step ramp (deep → mid → light)
 * rebuilt from the brand primary; the layer colour → the labels. The type is
 * fitted so the longest label stays on one line (down to half the upstream
 * size × zoom) and is truncated past that.
 */

import React from 'react'
import { AnimatedList, type AnimatedListItem } from '../../_upstream/rve-animated-list/AnimatedList'
import { type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import {
  READABLE_TEXT_SHADOW,
  brandPrimary,
  brandText,
  fitFontPx,
  lightenColor,
  px,
  remUnit,
  slotText,
  slotValue,
  truncateText,
} from './batch3eShared'

export const RVE_ANIMATED_LIST_ID = 'rve-animated-list'

const ZOOM = 1.4

/** The most rows (the upstream shows three). */
export const ANIMATED_LIST_MAX_ROWS = 3

/** The longest label. */
const MAX_LABEL_LENGTH = 32

/** Picks the list rows from the brand fields. */
export function animatedListLabels(props: DesignAdapterProps): string[] {
  const rows: string[] = []
  const push = (value: string) => {
    const trimmed = value.trim()
    if (trimmed && !rows.includes(trimmed) && rows.length < ANIMATED_LIST_MAX_ROWS) {
      rows.push(trimmed)
    }
  }
  push(slotText(props, 'offer', []))
  push(slotValue(props, 'phone'))
  push(slotValue(props, 'website'))
  push(slotValue(props, 'cta'))
  push(slotValue(props, 'headline'))
  push(slotValue(props, 'businessName'))
  return rows.map((row) => truncateText(row, MAX_LABEL_LENGTH))
}

export const RveAnimatedListDesign: React.FC<DesignAdapterProps> = (props) => {
  const labels = animatedListLabels(props)

  const rem = remUnit(props, ZOOM)
  const column = props.width * 0.86
  const longest = Math.max(1, ...labels.map((label) => label.length))
  // Row = 2rem padding ×2 + disc (80/56 of the type) + 1rem gap + label.
  const baseFont = 3.5 * rem
  const dotRatio = 80 / 56
  const labelSpace = (font: number) => column - 4 * rem - font * dotRatio - rem
  let fontPx = fitFontPx(labelSpace(baseFont), longest, baseFont, 0.58, 0.5)
  fontPx = fitFontPx(labelSpace(fontPx), longest, fontPx, 0.58, 0.85)

  const primary = brandPrimary(props)
  const ramp = [primary, lightenColor(primary, 0.3), lightenColor(primary, 0.55)]
  const items: AnimatedListItem[] = labels.map((name, i) => ({
    name,
    color: ramp[i % ramp.length],
  }))

  return (
    <RveDesignStage designId={RVE_ANIMATED_LIST_ID} props={props}>
      <AnimatedList
        items={items}
        color={brandText(props)}
        fontSize={px(fontPx)}
        dotSize={px(fontPx * dotRatio)}
        gap={px(rem)}
        rowGap={px(rem)}
        maxWidth={px(column)}
        padding={px(2 * rem)}
        textShadow={READABLE_TEXT_SHADOW}
      />
    </RveDesignStage>
  )
}

export default RveAnimatedListDesign
