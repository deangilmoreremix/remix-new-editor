/**
 * Adapter for the upstream `rve-stat-counter` template.
 *
 * Upstream: `templates/stat-counter.tsx` (remotion-templates, MIT — React
 * Video Editor, no named copyright holder). A card springs in, a big number
 * counts up, a label sits underneath and two small sub-stats fade in.
 *
 * OVERLAY: the card reads well on its own, so the upstream's full-canvas
 * slate backdrop is forced `transparent` and the card floats over the
 * customer's video. The card's own 20 %-black wash is deepened to 55 % so the
 * white figure stays legible over a bright video.
 *
 * Brand mapping:
 *  - the big number counts to a pinned placeholder "1,000+" (the customer
 *    cannot enter a figure; it is a generic milestone, not the upstream's
 *    "1,247" demo value) — grouped with a pinned `en-US` locale so the export
 *    does not depend on the machine's locale;
 *  - the label under it is the PRIMARY slot (the offer by default — the
 *    customer can retype it, e.g. "happy customers");
 *  - the highlighted sub-stat (upstream green "↑ 12.5%") is the CTA in the
 *    brand accent;
 *  - the muted sub-stat (upstream "This Month") is the business name.
 */

import React from 'react'
import { StatCounter } from '../../_upstream/rve-stat-counter/StatCounter'
import { TRANSPARENT, slotText, slotValue, truncateText, type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import { FitCanvas, brandAccent, brandText, fitScale, rgba } from './shared3f'

/** The pinned placeholder figure. */
export const STAT_COUNTER_PLACEHOLDER = { countTo: 1000, suffix: '+' } as const

/** The upstream card: 80 px side / 60 px top padding around a 96 px figure. */
const CARD_W = 560
const CARD_H = 340
const PREFERRED_SCALE = 1.5

export const RveStatCounterDesign: React.FC<DesignAdapterProps> = (props) => {
  const k = fitScale(props, CARD_W, CARD_H, PREFERRED_SCALE)
  const text = brandText(props)
  const label = truncateText(slotText(props, 'offer', ['headline', 'businessName']), 30)
  const highlight = truncateText(slotValue(props, 'cta'), 18)
  const caption = truncateText(slotValue(props, 'businessName'), 22)

  return (
    <RveDesignStage designId="rve-stat-counter" props={props}>
      <FitCanvas props={props} scale={k}>
        <StatCounter
          countTo={STAT_COUNTER_PLACEHOLDER.countTo}
          countSuffix={STAT_COUNTER_PLACEHOLDER.suffix}
          locale="en-US"
          label={label}
          labelWhiteSpace="nowrap"
          highlight={highlight}
          caption={caption}
          background={TRANSPARENT}
          panelColor="rgba(0, 0, 0, 0.55)"
          numberColor={text}
          labelColor={rgba(text, 0.85)}
          highlightColor={brandAccent(props)}
          captionColor={rgba(text, 0.65)}
        />
      </FitCanvas>
    </RveDesignStage>
  )
}

export default RveStatCounterDesign
