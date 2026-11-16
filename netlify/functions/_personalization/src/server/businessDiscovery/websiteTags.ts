/**
 * Website + social-profile extraction from OSM tags, shared by the Overpass
 * and Nominatim-search normalizers.
 *
 * The OSM `website` / `url` tags often hold a Facebook or Instagram page (or a
 * Yelp / Linktree listing) instead of the business's own site. Only an OWNED
 * website is reported as `website`; social URLs found there are moved into the
 * matching social field, and directory listings are dropped (they stay in
 * `rawSource`).
 */

import {
  normalizeSocialValue,
  splitWebsiteCandidates,
  type SocialPlatform,
} from '../../shared/personalization/websiteClassification'

export const WEBSITE_TAGS = ['website', 'contact:website', 'url', 'contact:url']

/** OSM tag → social platform for the dedicated social tags. */
const SOCIAL_TAGS: Array<[string, SocialPlatform]> = [
  ['facebook', 'facebook'],
  ['contact:facebook', 'facebook'],
  ['instagram', 'instagram'],
  ['contact:instagram', 'instagram'],
  ['tiktok', 'tiktok'],
  ['contact:tiktok', 'tiktok'],
  ['youtube', 'youtube'],
  ['contact:youtube', 'youtube'],
  ['linkedin', 'linkedin'],
  ['contact:linkedin', 'linkedin'],
  ['whatsapp', 'whatsapp'],
  ['contact:whatsapp', 'whatsapp'],
]

export interface WebsiteAndSocial {
  website?: string
  websiteStatus: 'confirmed' | 'unknown'
  facebook?: string
  instagram?: string
  tiktok?: string
  youtube?: string
  linkedin?: string
  whatsapp?: string
}

export function extractWebsiteAndSocial(tags: Record<string, string | undefined> | undefined): WebsiteAndSocial {
  const safeTags = tags || {}
  const candidates = splitWebsiteCandidates(WEBSITE_TAGS.map((key) => safeTags[key]))

  const social: Partial<Record<SocialPlatform, string>> = {}
  for (const [key, platform] of SOCIAL_TAGS) {
    if (social[platform]) continue
    const value = safeTags[key]
    if (typeof value !== 'string' || !value.trim()) continue
    const url = normalizeSocialValue(platform, value)
    if (url) social[platform] = url
  }
  // Social URLs misfiled under website/url fill the gaps, never override.
  for (const [platform, url] of Object.entries(candidates.social) as Array<[SocialPlatform, string]>) {
    if (!social[platform]) social[platform] = url
  }

  return {
    website: candidates.website,
    websiteStatus: candidates.website ? 'confirmed' : 'unknown',
    facebook: social.facebook,
    instagram: social.instagram,
    tiktok: social.tiktok,
    youtube: social.youtube,
    linkedin: social.linkedin,
    whatsapp: social.whatsapp,
  }
}
