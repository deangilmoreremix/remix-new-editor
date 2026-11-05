/**
 * Preview media assets for the 10 personalization layout templates.
 *
 * Each template has a placeholder MP4 preview + JPEG poster generated at
 * build/dev time and committed under public/media/personalization-templates/.
 * The MP4s are short (5s, 1280x720, h264) colour fields with the template
 * name and layout type burned in via libass subtitles; the JPEGs are the
 * middle frame of each clip used as the still poster.
 *
 * URLs are same-origin /public paths so `<video>`/`<img>` and Remotion's
 * media loader can fetch them without CORS or a remote proxy.
 */

import type { PreviewLayoutId } from './types'

const ASSET_DIR = '/media/personalization-templates'

const PREVIEW_MAP: Record<string, { video: string; poster: string }> = {
  'business-introduction': {
    video: `${ASSET_DIR}/business-introduction.mp4`,
    poster: `${ASSET_DIR}/business-introduction.jpg`,
  },
  'product-showcase': {
    video: `${ASSET_DIR}/product-showcase.mp4`,
    poster: `${ASSET_DIR}/product-showcase.jpg`,
  },
  'service-promotion': {
    video: `${ASSET_DIR}/service-promotion.mp4`,
    poster: `${ASSET_DIR}/service-promotion.jpg`,
  },
  'special-offer': {
    video: `${ASSET_DIR}/special-offer.mp4`,
    poster: `${ASSET_DIR}/special-offer.jpg`,
  },
  'branded-ending': {
    video: `${ASSET_DIR}/branded-ending.mp4`,
    poster: `${ASSET_DIR}/branded-ending.jpg`,
  },
  'customer-testimonial': {
    video: `${ASSET_DIR}/customer-testimonial.mp4`,
    poster: `${ASSET_DIR}/customer-testimonial.jpg`,
  },
  'before-after-transformation': {
    video: `${ASSET_DIR}/before-after-transformation.mp4`,
    poster: `${ASSET_DIR}/before-after-transformation.jpg`,
  },
  'team-member-intro': {
    video: `${ASSET_DIR}/team-member-intro.mp4`,
    poster: `${ASSET_DIR}/team-member-intro.jpg`,
  },
  'event-promotion': {
    video: `${ASSET_DIR}/event-promotion.mp4`,
    poster: `${ASSET_DIR}/event-promotion.jpg`,
  },
  'menu-item-highlight': {
    video: `${ASSET_DIR}/menu-item-highlight.mp4`,
    poster: `${ASSET_DIR}/menu-item-highlight.jpg`,
  },
}

/** The MP4 preview URL for a personalization layout id, or null if missing. */
export function previewVideoUrl(layoutId: PreviewLayoutId): string | null {
  return PREVIEW_MAP[layoutId]?.video ?? null
}

/** The still poster URL for a personalization layout id, or null if missing. */
export function posterUrl(layoutId: PreviewLayoutId): string | null {
  return PREVIEW_MAP[layoutId]?.poster ?? null
}

/** Read-only record of every template's preview + poster URL. */
export const PERSONALIZATION_PREVIEW_ASSETS: Readonly<
  Record<string, { video: string; poster: string }>
> = PREVIEW_MAP

export type PersonalizationPreviewAsset = {
  video: string
  poster: string
}
