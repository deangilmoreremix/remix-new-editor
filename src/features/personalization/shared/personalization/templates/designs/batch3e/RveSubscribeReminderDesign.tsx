/**
 * Adapter for the upstream `rve-subscribe-reminder` template.
 *
 * Upstream: `templates/subscribe-reminder.tsx` (remotion-templates, MIT —
 * React Video Editor, no named copyright holder).
 *
 * A dark pill with a pulsing bell slides up into the bottom-right corner.
 * The upstream frames it on a full-canvas `#111827` with a grey "Your Video
 * Content" placeholder in the middle — a stand-in for the video the pill is
 * meant to sit on. As an overlay the adapter drops both, so the pill sits on
 * the customer's real video.
 *
 * Brand mapping: call to action → the pill's main line (the upstream's
 * "Subscribe"), website (then business name) → the small handle line (the
 * upstream's "@CreativeStudio"), the brand primary → the bell disc, the
 * layer colour → the main line. The upstream bell is an emoji, which renders
 * with whatever emoji font the exporting machine has (or none); the adapter
 * draws it as a small inline SVG instead (no `id`s), so preview and export
 * match. Sizes scale with the composition (the upstream's 0.85rem label is
 * far too small on a 1080p frame).
 */

import React from 'react'
import { SubscribeReminder } from '../../_upstream/rve-subscribe-reminder/SubscribeReminder'
import { DESIGN_FONT_STACK } from '../fonts'
import { TRANSPARENT, type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import {
  brandPrimary,
  brandText,
  firstSlot,
  fitChars,
  px,
  remUnit,
  slotText,
  truncateText,
} from './batch3eShared'

export const RVE_SUBSCRIBE_REMINDER_ID = 'rve-subscribe-reminder'

const ZOOM = 2.4

/** A minimal bell glyph, drawn in `currentColor`. */
function BellIcon({ size }: { size: number }): React.ReactElement {
  return (
    <svg
      data-rve-bell
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{ display: 'block' }}
      aria-hidden="true"
    >
      <path d="M12 2.5c-3.3 0-6 2.7-6 6v3.6l-1.6 3.1c-.3.6.1 1.3.8 1.3h13.6c.7 0 1.1-.7.8-1.3L18 12.1V8.5c0-3.3-2.7-6-6-6z" />
      <path d="M9.5 18.5a2.5 2.5 0 0 0 5 0z" />
    </svg>
  )
}

export const RveSubscribeReminderDesign: React.FC<DesignAdapterProps> = (props) => {
  const rem = remUnit(props, ZOOM)
  const unit = rem / 16
  const titlePx = 0.85 * rem
  const handlePx = 0.65 * rem
  // The pill may take up to ~70 % of the canvas width.
  const textWidth = props.width * 0.7 - (28 * unit + 0.75 * rem + 2.4 * rem)

  const title = truncateText(
    slotText(props, 'cta', ['offer', 'businessName']),
    fitChars(textWidth, titlePx, 1, 28),
  )
  const handle = truncateText(
    firstSlot(props, ['website', 'businessName']),
    fitChars(textWidth, handlePx, 1, 40),
  )
  const iconSize = 28 * unit

  return (
    <RveDesignStage designId={RVE_SUBSCRIBE_REMINDER_ID} props={props}>
      <SubscribeReminder
        title={title}
        handle={handle}
        icon={<BellIcon size={Math.round(iconSize * 0.58)} />}
        placeholderText=""
        backgroundColor={TRANSPARENT}
        offset={px(24 * unit)}
        gap={px(0.75 * rem)}
        pillPadding={`${px(0.6 * rem)} ${px(1.2 * rem)}`}
        pillBorder={`${px(Math.max(1, unit))} solid rgba(255, 255, 255, 0.1)`}
        iconSize={px(iconSize)}
        iconBackground={brandPrimary(props)}
        iconColor="#ffffff"
        iconFontSize={px(0.8 * rem)}
        titleColor={brandText(props)}
        titleFontSize={px(titlePx)}
        handleFontSize={px(handlePx)}
        slideDistance={100 * unit + 24 * unit}
        fontFamily={DESIGN_FONT_STACK}
      />
    </RveDesignStage>
  )
}

export default RveSubscribeReminderDesign
