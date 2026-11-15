/**
 * Adapter for the upstream `rve-notification-pop` template.
 *
 * Upstream: `templates/notification-pop.tsx` (remotion-templates, MIT —
 * React Video Editor, no named copyright holder).
 *
 * Phone-style notification cards slide in from the right edge, one after
 * another (20 frames apart), with an unread-count badge on the first. The
 * upstream paints a full-canvas dark gradient and a "Notifications" header;
 * as an overlay the adapter makes the canvas transparent and drops the
 * header, so the stack of cards pops over the customer's video. The cards
 * keep their own translucent dark fill, so they read on any footage.
 *
 * Brand mapping — up to three cards, each skipped when both its fields are
 * empty (a card with only a body promotes it to the title):
 *
 *   card 1: business name / offer        (the offer is the primary slot)
 *   card 2: call to action / phone
 *   card 3: website / headline
 *
 * The dots take the brand primary, accent and a light primary; the badge
 * counts the cards; the layer colour → the card titles. Card width and type
 * scale with the composition (capped at 62 % of the canvas width).
 */

import React from 'react'
import {
  NotificationPop,
  type NotificationPopItem,
} from '../../_upstream/rve-notification-pop/NotificationPop'
import { DESIGN_FONT_STACK } from '../fonts'
import { TRANSPARENT, type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import {
  brandAccent,
  brandPrimary,
  brandText,
  fitChars,
  lightenColor,
  px,
  remUnit,
  slotText,
  slotValue,
  truncateText,
  withAlpha,
} from './batch3eShared'

export const RVE_NOTIFICATION_POP_ID = 'rve-notification-pop'

const ZOOM = 2

/** The upstream's per-card delay. */
const CARD_DELAY_FRAMES = 20

/** Builds the (up to three) cards from the brand fields. */
export function notificationCards(
  props: DesignAdapterProps,
  colors: [string, string, string],
  titleChars: number,
  bodyChars: number,
): NotificationPopItem[] {
  const pairs: Array<[string, string]> = [
    [slotValue(props, 'businessName'), slotText(props, 'offer', [])],
    [slotValue(props, 'cta'), slotValue(props, 'phone')],
    [slotValue(props, 'website'), slotValue(props, 'headline')],
  ]
  const cards: NotificationPopItem[] = []
  for (const [rawTitle, rawBody] of pairs) {
    let title = rawTitle
    let body = rawBody
    if (!title && !body) continue
    if (!title) {
      title = body
      body = ''
    }
    const index = cards.length
    cards.push({
      title: truncateText(title, titleChars),
      body: truncateText(body, bodyChars),
      color: colors[index % colors.length],
      delay: index * CARD_DELAY_FRAMES,
    })
  }
  return cards
}

export const RveNotificationPopDesign: React.FC<DesignAdapterProps> = (props) => {
  const rem = remUnit(props, ZOOM)
  const unit = rem / 16
  const cardWidth = Math.min(320 * unit, props.width * 0.62)
  const cardUnit = cardWidth / 320
  const titlePx = 0.95 * 16 * cardUnit
  const bodyPx = 0.8 * 16 * cardUnit
  // Card padding (16) ×2, the 40px dot and the 12px gap, in card units.
  const textWidth = cardWidth - (32 + 40 + 12) * cardUnit

  const primary = brandPrimary(props)
  const cards = notificationCards(
    props,
    [primary, brandAccent(props), lightenColor(primary, 0.4)],
    fitChars(textWidth, titlePx, 1, 32),
    fitChars(textWidth, bodyPx, 2, 64),
  )

  return (
    <RveDesignStage designId={RVE_NOTIFICATION_POP_ID} props={props}>
      <NotificationPop
        notifications={cards}
        background={TRANSPARENT}
        padding={px(40 * unit)}
        headerText=""
        gap={px(12 * cardUnit)}
        slideDistance={cardWidth + 40 * unit}
        cardWidth={px(cardWidth)}
        cardPadding={px(16 * cardUnit)}
        cardRadius={px(12 * cardUnit)}
        cardBorder={`${px(Math.max(1, cardUnit))} solid ${withAlpha('#ffffff', 0.12)}`}
        dotSize={px(40 * cardUnit)}
        titleColor={brandText(props)}
        titleFontSize={px(titlePx)}
        titleGap={px(4 * cardUnit)}
        bodyFontSize={px(bodyPx)}
        badgeText={String(cards.length)}
        badgeSize={px(22 * cardUnit)}
        badgeOffset={px(-6 * cardUnit)}
        badgeFontSize={px(0.7 * 16 * cardUnit)}
        fontFamily={DESIGN_FONT_STACK}
      />
    </RveDesignStage>
  )
}

export default RveNotificationPopDesign
