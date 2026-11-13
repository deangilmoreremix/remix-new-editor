/**
 * Adapter for the upstream `split-screen` template.
 *
 * Upstream: `src/components/split-screen/SplitScreen.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * The frame splits into two contrasting panels that wipe in one after the
 * other, a divider snaps in at the midpoint and each panel's heading and sub
 * line rise into place. Both panels are opaque and stay side by side, so this
 * is a designed card, registered as a `full-scene` intro (not a transition —
 * nothing is revealed behind it).
 *
 * Panel A (deep brand primary): business name + headline.
 * Panel B (brand accent): offer + call to action.
 *
 * The panels split side by side on landscape canvases and stack top/bottom on
 * 1:1, 4:5 and 9:16, so a heading always has a full-width panel there. The
 * panel heading is a fixed 96 px; a stylesheet scoped to this instance
 * shrinks it when it would not fit its panel.
 */

import React from 'react'
import { SplitScreen } from '../../_upstream/split-screen/SplitScreen'
import { useDesignFonts } from '../fonts'
import { DesignStage, slotText, slotValue, truncateText, type DesignAdapterProps } from '../shared'
import {
  ScopedUpstream,
  brandPalette,
  deepShade,
  fitFontSize,
  readableOn,
  scopeSelector,
  useScopeId,
} from './batch3aShared'

const MAX_HEADING_LENGTH = 22
const MAX_SUB_LENGTH = 40
const UPSTREAM_HEADING_SIZE = 96

export const SplitScreenDesign: React.FC<DesignAdapterProps> = (props) => {
  useDesignFonts()
  const scopeId = useScopeId('split-screen')
  const palette = brandPalette(props)

  const headingA = truncateText(slotText(props, 'headingA', ['headline']), MAX_HEADING_LENGTH)
  const subA = truncateText(slotValue(props, 'subA'), MAX_SUB_LENGTH)
  const headingB = truncateText(slotValue(props, 'headingB'), MAX_HEADING_LENGTH)
  const subB = truncateText(slotValue(props, 'subB'), MAX_SUB_LENGTH)

  const horizontal = props.width / Math.max(1, props.height) >= 1.2
  const panelW = horizontal ? props.width / 2 : props.width
  const panelH = horizontal ? props.height : props.height / 2

  const fit = (heading: string) =>
    fitFontSize(heading, {
      maxWidth: panelW * 0.84,
      maxHeight: panelH * 0.5,
      maxSize: UPSTREAM_HEADING_SIZE,
      advance: 0.66,
      lineHeight: 1.2,
    })
  const sel = scopeSelector(scopeId)
  // root > [wash, reveal > [panelA wrap > Panel > heading, divider, panelB wrap > Panel > heading]]
  const panel = (n: number) => `${sel} > div:first-child > div:nth-child(2) > div:nth-child(${n}) > div`
  const rules = [`${panel(1)} > div, ${panel(3)} > div { text-align: center; padding: 0 4%; }`]
  const sizeA = fit(headingA)
  const sizeB = fit(headingB)
  if (sizeA < UPSTREAM_HEADING_SIZE) rules.push(`${panel(1)} > div:first-child { font-size: ${sizeA}px !important; }`)
  if (sizeB < UPSTREAM_HEADING_SIZE) rules.push(`${panel(3)} > div:first-child { font-size: ${sizeB}px !important; }`)

  const bgA = deepShade(palette.primary, 0.55)
  const bgB = palette.accent

  return (
    <DesignStage designId="split-screen" props={props}>
      <ScopedUpstream scopeId={scopeId} css={rules.join('\n')}>
        <SplitScreen
          direction={horizontal ? 'horizontal' : 'vertical'}
          panelA={{ heading: headingA, sub: subA || undefined, bg: bgA, textColor: readableOn(bgA, palette.text) }}
          panelB={{ heading: headingB, sub: subB || undefined, bg: bgB, textColor: readableOn(bgB, palette.text) }}
          dividerColor={readableOn(bgA, palette.text)}
          dividerWidth={Math.max(3, Math.round((6 * props.width) / 1920))}
          backdropColor={deepShade(palette.primary, 0.86)}
        />
      </ScopedUpstream>
    </DesignStage>
  )
}

export default SplitScreenDesign
