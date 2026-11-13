/**
 * Business URL classification.
 *
 * OpenStreetMap's `website` / `url` tags frequently hold a Facebook or
 * Instagram page (or a Yelp / Linktree / DoorDash listing) instead of the
 * business's own site. Asset discovery against those pages finds nothing
 * usable, so the Lead Finder must tell an OWNED website apart from a social
 * profile or a third-party directory listing.
 *
 * Client-safe: no node dependencies, so the UI guards and the server
 * normalizers share exactly one implementation.
 */

export type SocialPlatform =
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'linkedin'
  | 'twitter'
  | 'threads'
  | 'pinterest'
  | 'snapchat'
  | 'whatsapp'

export type BusinessUrlClassification =
  | { kind: 'website' }
  | { kind: 'social'; platform: SocialPlatform }
  | { kind: 'directory'; host: string }
  | { kind: 'invalid' }

/** Registrable domain → social platform. Subdomains (m., www., business.) match too. */
const SOCIAL_DOMAINS: Record<string, SocialPlatform> = {
  'facebook.com': 'facebook',
  'fb.com': 'facebook',
  'fb.me': 'facebook',
  'fb.watch': 'facebook',
  'instagram.com': 'instagram',
  'instagr.am': 'instagram',
  'tiktok.com': 'tiktok',
  'youtube.com': 'youtube',
  'youtu.be': 'youtube',
  'linkedin.com': 'linkedin',
  'lnkd.in': 'linkedin',
  'twitter.com': 'twitter',
  'x.com': 'twitter',
  'threads.net': 'threads',
  'threads.com': 'threads',
  'pinterest.com': 'pinterest',
  'pin.it': 'pinterest',
  'snapchat.com': 'snapchat',
  'wa.me': 'whatsapp',
  'whatsapp.com': 'whatsapp',
}

/**
 * Link-in-bio pages, review sites, maps, booking and delivery marketplaces.
 * None of these are the business's own site, and none carry its brand assets.
 */
const DIRECTORY_DOMAINS = [
  'linktr.ee',
  'linktree.com',
  'beacons.ai',
  'lnk.bio',
  'taplink.cc',
  'bio.link',
  'carrd.co',
  'later.com',
  'yelp.com',
  'tripadvisor.com',
  'g.page',
  'maps.app.goo.gl',
  'yellowpages.com',
  'yp.com',
  'nextdoor.com',
  'foursquare.com',
  'doordash.com',
  'ubereats.com',
  'grubhub.com',
  'seamless.com',
  'postmates.com',
  'opentable.com',
  'resy.com',
  'toasttab.com',
  'booksy.com',
  'vagaro.com',
  'styleseat.com',
  'fresha.com',
  'mindbodyonline.com',
  'zomato.com',
  'groupon.com',
  'bbb.org',
  'manta.com',
  'mapquest.com',
  'zocdoc.com',
  'healthgrades.com',
  'houzz.com',
  'angi.com',
  'thumbtack.com',
  'zillow.com',
  'realtor.com',
]

/** Country variants of review sites (yelp.ca, tripadvisor.co.uk, …). */
const DIRECTORY_BRAND_LABELS = ['yelp', 'tripadvisor']

function hostOf(rawUrl: string): string | null {
  const trimmed = (rawUrl || '').trim()
  if (!trimmed) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    const host = url.hostname.toLowerCase().replace(/\.$/, '')
    // A hostname must contain a dot to be a public website.
    if (!host.includes('.')) return null
    return host
  } catch {
    return null
  }
}

function matchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`)
}

/** Classifies a URL as the business's own website, a social profile, or a directory listing. */
export function classifyBusinessUrl(rawUrl: string): BusinessUrlClassification {
  const host = hostOf(rawUrl)
  if (!host) return { kind: 'invalid' }

  for (const [domain, platform] of Object.entries(SOCIAL_DOMAINS)) {
    if (matchesDomain(host, domain)) return { kind: 'social', platform }
  }

  for (const domain of DIRECTORY_DOMAINS) {
    if (matchesDomain(host, domain)) return { kind: 'directory', host }
  }

  // Google Maps links (google.com/maps, maps.google.com, goo.gl/maps).
  const path = (() => {
    try {
      return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : `https://${rawUrl.trim()}`).pathname
    } catch {
      return ''
    }
  })()
  if (/(^|\.)google\.[a-z.]+$/.test(host) && (host.startsWith('maps.') || path.startsWith('/maps'))) {
    return { kind: 'directory', host }
  }
  if (host === 'goo.gl' && path.startsWith('/maps')) return { kind: 'directory', host }

  const labels = host.split('.')
  if (labels.some((label) => DIRECTORY_BRAND_LABELS.includes(label))) {
    return { kind: 'directory', host }
  }

  return { kind: 'website' }
}

/** True when the URL is the business's own website (not social, not a directory). */
export function isOwnedWebsite(rawUrl: string | undefined | null): boolean {
  if (!rawUrl) return false
  return classifyBusinessUrl(rawUrl).kind === 'website'
}

/** Human label for a non-owned URL, used in UI hints ("That's a Facebook page"). */
export function describeNonOwnedUrl(rawUrl: string): string | null {
  const classification = classifyBusinessUrl(rawUrl)
  if (classification.kind === 'social') {
    const names: Record<SocialPlatform, string> = {
      facebook: 'Facebook',
      instagram: 'Instagram',
      tiktok: 'TikTok',
      youtube: 'YouTube',
      linkedin: 'LinkedIn',
      twitter: 'X / Twitter',
      threads: 'Threads',
      pinterest: 'Pinterest',
      snapchat: 'Snapchat',
      whatsapp: 'WhatsApp',
    }
    return `${names[classification.platform]} page`
  }
  if (classification.kind === 'directory') {
    return `${classification.host.replace(/^www\./, '')} listing`
  }
  return null
}

/**
 * Inline hint when a pasted URL is a social profile or directory listing
 * instead of the business's own website; `null` for anything else.
 */
export function nonOwnedWebsiteMessage(url: string): string | null {
  const label = describeNonOwnedUrl(url)
  if (!label) return null
  return `That's a ${label}, not the business's own website. Enter its website (for example joespizza.com) to find its brand assets.`
}

function withScheme(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

export interface WebsiteCandidates {
  /** First OWNED website, if any. */
  website?: string
  /** Social profile URLs found among the candidates, first per platform. */
  social: Partial<Record<SocialPlatform, string>>
  /** Directory / marketplace / link-in-bio URLs found among the candidates. */
  directories: string[]
}

/**
 * Splits raw OSM website-tag values (which may hold several `;`-separated
 * URLs) into the owned website, social profiles and directory listings.
 */
export function splitWebsiteCandidates(rawValues: Array<string | undefined | null>): WebsiteCandidates {
  const result: WebsiteCandidates = { social: {}, directories: [] }
  for (const raw of rawValues) {
    if (!raw || typeof raw !== 'string') continue
    for (const part of raw.split(';')) {
      const value = part.trim()
      if (!value) continue
      const url = withScheme(value)
      const classification = classifyBusinessUrl(url)
      if (classification.kind === 'website') {
        if (!result.website) result.website = url
      } else if (classification.kind === 'social') {
        if (!result.social[classification.platform]) result.social[classification.platform] = url
      } else if (classification.kind === 'directory') {
        result.directories.push(url)
      }
    }
  }
  return result
}

const SOCIAL_PROFILE_BASE: Partial<Record<SocialPlatform, string>> = {
  facebook: 'https://www.facebook.com/',
  instagram: 'https://www.instagram.com/',
  tiktok: 'https://www.tiktok.com/@',
  youtube: 'https://www.youtube.com/@',
  twitter: 'https://x.com/',
}

/**
 * Normalizes a dedicated OSM social tag value. OSM often stores a bare handle
 * (`joespizza` or `@joespizza`); prefixing `https://` blindly yields the
 * nonsense URL `https://joespizza`. Bare handles become the platform URL.
 */
export function normalizeSocialValue(platform: SocialPlatform, rawValue: string): string | undefined {
  const value = (rawValue || '').trim().split(';')[0]?.trim()
  if (!value) return undefined
  if (/^https?:\/\//i.test(value)) return value
  // Looks like a host/path (contains a dot before any slash) → just add a scheme.
  if (/^[^/\s]+\.[^/\s]+/.test(value) && !value.startsWith('@')) return `https://${value}`
  if (platform === 'whatsapp') {
    // OSM stores WhatsApp as a phone number ("+1 555 123 4567").
    const digits = value.replace(/\D/g, '')
    return digits.length >= 7 ? `https://wa.me/${digits}` : undefined
  }
  const handle = value.replace(/^@/, '')
  if (!/^[A-Za-z0-9._-]+$/.test(handle)) return undefined
  const base = SOCIAL_PROFILE_BASE[platform]
  return base ? `${base}${handle}` : undefined
}
