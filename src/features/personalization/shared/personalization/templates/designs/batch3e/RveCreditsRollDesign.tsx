/**
 * Adapter for the upstream `rve-credits-roll` template.
 *
 * Upstream: `templates/credits-roll.tsx` (remotion-templates, MIT — React
 * Video Editor, no named copyright holder).
 *
 * FULL-SCENE design. Role / name pairs scroll up a solid card between two
 * soft edge fades — the classic film-credits look, where the card IS the
 * design. The adapter keeps the card (a deep shade of the brand primary
 * instead of `#111827`; the fades follow it) and the catalog gives the layer
 * an `endFrame`, so the roll plays as an intro and then reveals the video.
 *
 * Brand mapping — the credits are built from the brand fields, skipping any
 * that are empty:
 *
 *   PRESENTED BY   → business name
 *   FEATURING      → headline
 *   SPECIAL OFFER  → offer
 *   CALL           → phone
 *   VISIT          → website
 *   GET STARTED    → call to action
 *
 * The upstream scrolls at a fixed 1.5 px per frame, which would take ~20 s
 * to clear a 1080 px frame. The adapter derives the speed from the content
 * height instead, so the whole roll enters from the bottom and leaves the
 * top in exactly `CREDITS_ROLL_FRAMES` frames (the catalog's `endFrame`).
 * The brand primary → the role labels, the layer colour → the names.
 */

import React from 'react'
import { CreditsRoll, type CreditsRollEntry } from '../../_upstream/rve-credits-roll/CreditsRoll'
import { DESIGN_FONT_STACK } from '../fonts'
import { type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import {
  brandPrimary,
  brandSceneColor,
  brandText,
  fitChars,
  lightenColor,
  px,
  remUnit,
  slotValue,
  truncateText,
} from './batch3eShared'

export const RVE_CREDITS_ROLL_ID = 'rve-credits-roll'

/** Frames the whole roll takes to cross the canvas (the catalog `endFrame`). */
export const CREDITS_ROLL_FRAMES = 150

const ZOOM = 1.8

/** Brand field → the role label shown above it. */
const CREDIT_ROLES: Array<[key: string, role: string]> = [
  ['businessName', 'Presented by'],
  ['headline', 'Featuring'],
  ['offer', 'Special offer'],
  ['phone', 'Call'],
  ['website', 'Visit'],
  ['cta', 'Get started'],
]

/** Builds the credits from the brand fields (empty fields are skipped). */
export function creditsFromBrand(
  props: DesignAdapterProps,
  maxNameChars: number,
): CreditsRollEntry[] {
  const credits: CreditsRollEntry[] = []
  for (const [key, role] of CREDIT_ROLES) {
    // The primary slot (business name) prefers the customer's own text.
    const value =
      key === 'businessName'
        ? slotValue(props, key) || (typeof props.text === 'string' ? props.text.trim() : '')
        : slotValue(props, key)
    if (!value) continue
    credits.push({ role, name: truncateText(value, maxNameChars) })
  }
  return credits
}

/** Line height the browser gives `line-height: normal` for the bundled face. */
const LINE_HEIGHT = 1.21

export const RveCreditsRollDesign: React.FC<DesignAdapterProps> = (props) => {
  const rem = remUnit(props, ZOOM)
  const unit = rem / 16
  const rolePx = 0.9 * rem
  const namePx = 1.5 * rem

  const credits = creditsFromBrand(props, fitChars(props.width * 0.88, namePx, 1, 40))

  // Height of the scrolling column, so the speed clears it in the budget.
  const itemHeight = rolePx * LINE_HEIGHT + 0.4 * rem + namePx * LINE_HEIGHT
  const contentHeight =
    2 * rem + credits.length * itemHeight + Math.max(0, credits.length - 1) * 2.5 * rem
  const scrollSpeed = (props.height + contentHeight) / CREDITS_ROLL_FRAMES

  return (
    <RveDesignStage designId={RVE_CREDITS_ROLL_ID} props={props}>
      <CreditsRoll
        credits={credits}
        scrollSpeed={scrollSpeed}
        backgroundColor={brandSceneColor(props)}
        roleColor={lightenColor(brandPrimary(props), 0.15)}
        nameColor={brandText(props)}
        roleFontSize={px(rolePx)}
        nameFontSize={px(namePx)}
        roleGap={px(0.4 * rem)}
        gap={px(2.5 * rem)}
        paddingTop={px(2 * rem)}
        fadeHeight={px(80 * unit)}
        fontFamily={DESIGN_FONT_STACK}
      />
    </RveDesignStage>
  )
}

export default RveCreditsRollDesign
