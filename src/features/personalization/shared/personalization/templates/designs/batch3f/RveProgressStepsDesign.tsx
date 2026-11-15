/**
 * Adapter for the upstream `rve-progress-steps` template.
 *
 * Upstream: `templates/progress-steps.tsx` (remotion-templates, MIT — React
 * Video Editor, no named copyright holder). A four-step timeline: each
 * numbered circle fills and pulses in turn while the connector to the next
 * step draws across.
 *
 * DATA-VISUALIZATION INTRO CARD: the designed backdrop is kept (a deep shade
 * of the brand primary, top to bottom as upstream), the layer plays as an
 * intro card and the catalog's `placement.endFrame` then reveals the video.
 *
 * The step labels are a pinned, generic customer journey ("Discover", "Plan",
 * "Deliver", "Celebrate") that fits any business — the upstream's project
 * phases are not reused. The headline is the title.
 *
 * The upstream sizes its type in `rem`, which is not canvas-relative; the
 * adapter passes the px equivalents (16 px root) and lets `FitCanvas` scale
 * the whole timeline with the composition.
 */

import React from 'react'
import { ProgressSteps } from '../../_upstream/rve-progress-steps/ProgressSteps'
import { slotText, truncateText, type DesignAdapterProps } from '../shared'
import { lightenColor, RveDesignStage } from '../rveSharedDesign'
import {
  FitCanvas,
  brandBackdrop,
  brandPalette,
  fitChars,
  fitScale,
  readableOnDark,
} from './shared3f'

/** The pinned step labels (short enough for the upstream's 80 px columns). */
export const PROGRESS_STEPS_LABELS = ['Discover', 'Plan', 'Deliver', 'Celebrate']

/** The upstream timeline: 4 x 80 px columns + 3 x 80 px connectors, ~200 px tall. */
const CONTENT_W = 600
const CONTENT_H = 240
const PREFERRED_SCALE = 1.7

/** The upstream `rem` sizes at a 16 px root. */
const TITLE_PX = 32
const NUMBER_PX = 16
const LABEL_PX = 12.8

export const RveProgressStepsDesign: React.FC<DesignAdapterProps> = (props) => {
  const k = fitScale(props, CONTENT_W, CONTENT_H, PREFERRED_SCALE)
  const [primary, accent] = brandPalette(props, 2)
  const text = readableOnDark(props)
  // The title shares the virtual canvas (width / k) with nothing else.
  const title = truncateText(
    slotText(props, 'headline', ['businessName']),
    fitChars((props.width / k) * 0.88, TITLE_PX, 48),
  )

  return (
    <RveDesignStage designId="rve-progress-steps" props={props}>
      <FitCanvas props={props} scale={k}>
        <ProgressSteps
          steps={PROGRESS_STEPS_LABELS}
          title={title}
          titleWhiteSpace="nowrap"
          background={brandBackdrop(props, '180deg')}
          titleColor={text}
          titleFontSize={`${TITLE_PX}px`}
          activeBorderColor={primary}
          activeFill={`linear-gradient(135deg, ${primary}, ${accent})`}
          activeNumberColor="#ffffff"
          numberFontSize={`${NUMBER_PX}px`}
          activeLabelColor={lightenColor(primary, 0.45)}
          labelFontSize={`${LABEL_PX}px`}
          connectorFill={`linear-gradient(90deg, ${primary}, ${accent})`}
        />
      </FitCanvas>
    </RveDesignStage>
  )
}

export default RveProgressStepsDesign
