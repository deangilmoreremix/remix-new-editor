/**
 * Adapter for the upstream `PromoTemplate` template (repo 3).
 *
 * Upstream: `src/templates/PromoTemplate/PromoTemplate.tsx`
 * (remotion-video-templates, MIT — © 2026 Alejandro Brito).
 *
 * The upstream is a complete product promo: an "Introducing" hook card with
 * the product name and tagline, feature scenes (a numbered callout beside a
 * Ken-Burns-panned screenshot) that slide in from the right, and a dark CTA
 * card that fades in. Scene changes use the upstream's own
 * `@remotion/transitions` (slide and fade).
 *
 * Brand mapping:
 *  - product name ← business name; tagline ← headline;
 *  - ONE feature scene: title ← offer (falling back to the headline),
 *    description ← website and phone number;
 *  - CTA pill ← call to action; `accentColor` ← brand primary;
 *  - the screenshot ← the customer's product image (`media.product`), then
 *    their service image (`media.service`). The upstream read demo SVGs from
 *    `public/` through `staticFile()` (deviation D4); without brand media the
 *    copy's new `screenshotPlaceholder` slot gets a brand-coloured app-window
 *    mock-up drawn in plain DOM, so there is never a broken `<img>`.
 *
 * The scene backgrounds are the upstream's light editorial palette (white /
 * zinc-50 / ink) — hard-coded upstream; the brand colour drives the eyebrow,
 * the rule, the feature badge and the CTA pill.
 *
 * FIXED DURATION: HOOK + n x FEATURE + CTA − (n + 1) x TRANSITION with one
 * feature is 70 + 90 + 80 − 40 = `BRITO_PROMO_FRAMES` (200 frames). It is a
 * `full-scene` intro: the layer ends there and reveals the customer's video.
 *
 * FORMAT: 16:9 only. The upstream's type is fixed px (170 px product name,
 * a 42 % callout column with 90 px padding) laid out for 1920x1080; on a
 * 1080-wide canvas the callout column is too narrow for its copy.
 */

import React from 'react'
import { PromoTemplate } from '../../_upstream/brito-promo/PromoTemplate'
import {
  pickColor,
  slotText,
  slotValue,
  truncateText,
  type DesignAdapterProps,
} from '../shared'
import { BritoDesignStage, BritoScreenshotPlaceholder, britoFitChars } from './britoShared'

export const BRITO_PROMO_ID = 'brito-promo'

/** 70 (hook) + 90 (one feature) + 80 (CTA) − 2 x 20 (transitions). */
export const BRITO_PROMO_FRAMES = 70 + 90 + 80 - 2 * 20

function mediaUrl(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

export const BritoPromoDesign: React.FC<DesignAdapterProps> = (props) => {
  const w = props.width * 0.9
  // The name is shown at 170 px (hook) and 120 px (CTA); the hook is the tighter fit.
  const productName = truncateText(slotValue(props, 'productName'), britoFitChars(w, 170, 24, 0.62))
  const tagline = truncateText(slotText(props, 'tagline'), britoFitChars(w, 52, 60, 0.55))
  const featureTitle = truncateText(
    slotValue(props, 'featureTitle') || slotText(props, 'tagline'),
    40,
  )
  const featureDescription = truncateText(
    [slotValue(props, 'website'), slotValue(props, 'phone')].filter(Boolean).join(' · '),
    90,
  )
  const cta = truncateText(slotValue(props, 'cta'), britoFitChars(w - 120, 46, 36, 0.6))

  const primary = pickColor([props.colors?.primary, props.colors?.accent], '#2563EB')
  const accent = pickColor([props.colors?.accent, props.colors?.primary], '#0EA5E9')
  const screenshot = mediaUrl(props.media?.product) || mediaUrl(props.media?.service)

  return (
    <BritoDesignStage designId={BRITO_PROMO_ID} props={props} overlay={false}>
      <PromoTemplate
        productName={productName}
        tagline={tagline}
        features={[{ title: featureTitle, description: featureDescription }]}
        screenshots={[screenshot]}
        cta={cta}
        accentColor={primary}
        screenshotPlaceholder={<BritoScreenshotPlaceholder primary={primary} accent={accent} />}
      />
    </BritoDesignStage>
  )
}

export default BritoPromoDesign
