/**
 * Per-platform publish payloads for MuAPI's social publishing API.
 *
 * Source of truth: https://muapi.ai/docs/social-publishing (YouTube, Instagram,
 * TikTok — full field lists) and the per-platform pages at
 * https://muapi.ai/playground/<platform>-publish (Facebook, LinkedIn,
 * Pinterest, Threads, X — field labels and, where given, parameter names).
 *
 * `confidence: 'documented'`: full field list with limits in the docs page.
 * `confidence: 'basic'`: the platform's playground page names only a few fields
 * (parameter names confirmed from its implementation guide: Facebook account_id,
 * media_url, caption, placement; LinkedIn account_id, media_url, caption;
 * Pinterest account_id, board_id, media_url, title, caption, link; Threads
 * account_id, media_url, caption, placement; X account_id, media_url, caption,
 * reply_settings) and does not say which are required, so exactly those are sent
 * and the UI tells the user. Nothing undocumented (schedule, location, alt text …)
 * is ever sent. Unresolved: Threads' accepted placement strings (page says both
 * 'timeline' and 'feed'), so only 'reels' is ever sent explicitly.
 *
 * Pure functions: no network, no React. Unit-tested.
 */

export type PlatformId = 'youtube' | 'instagram' | 'tiktok' | 'facebook' | 'linkedin' | 'pinterest' | 'threads' | 'x'
export type MediaKind = 'video' | 'image'

export interface PlatformSpec {
  id: PlatformId
  label: string
  media: MediaKind[]
  confidence: 'documented' | 'basic'
  /** Approximate MuAPI price per publish in USD (see MuAPI pricing). */
  costUsd: number
  titleMax?: number
  captionMax?: number
  /** Publish endpoint under /api/v1 */
  endpoint: string
}

export const PLATFORM_SPECS: Record<PlatformId, PlatformSpec> = {
  youtube: { id: 'youtube', label: 'YouTube', media: ['video'], confidence: 'documented', costUsd: 0.01, titleMax: 100, endpoint: 'youtube-publish' },
  instagram: { id: 'instagram', label: 'Instagram', media: ['video', 'image'], confidence: 'documented', costUsd: 0.02, endpoint: 'instagram-publish' },
  tiktok: { id: 'tiktok', label: 'TikTok', media: ['video'], confidence: 'documented', costUsd: 0.02, titleMax: 150, endpoint: 'tiktok-publish' },
  facebook: { id: 'facebook', label: 'Facebook', media: ['video', 'image'], confidence: 'basic', costUsd: 0.02, endpoint: 'facebook-publish' },
  linkedin: { id: 'linkedin', label: 'LinkedIn', media: ['video', 'image'], confidence: 'basic', costUsd: 0.02, endpoint: 'linkedin-publish' },
  pinterest: { id: 'pinterest', label: 'Pinterest', media: ['video', 'image'], confidence: 'basic', costUsd: 0.02, endpoint: 'pinterest-publish' },
  threads: { id: 'threads', label: 'Threads', media: ['video', 'image'], confidence: 'basic', costUsd: 0.02, endpoint: 'threads-publish' },
  x: { id: 'x', label: 'X', media: ['video', 'image'], confidence: 'basic', costUsd: 0.02, captionMax: 280, endpoint: 'x-publish' },
}

export const PLATFORM_ORDER: PlatformId[] = ['youtube', 'instagram', 'tiktok', 'facebook', 'linkedin', 'pinterest', 'threads', 'x']

export const YOUTUBE_PRIVACY = ['public', 'private', 'unlisted'] as const
export const TIKTOK_PRIVACY = ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'] as const
export const PLACEMENTS = ['reels', 'stories', 'timeline'] as const
export const X_REPLY_SETTINGS = ['everyone', 'accounts_you_follow', 'followers_only'] as const

/** What the modal knows about the post (Write step output). */
export interface PostCopy {
  master?: string
  title?: string
  description?: string
  tags?: string
  caption?: string
  tiktokTitle?: string
  platforms?: Record<string, { caption?: string; title?: string; description?: string } | undefined>
}

export interface PayloadInput {
  platform: PlatformId
  accountId: string | number
  mediaUrl: string
  mediaType: MediaKind
  copy: PostCopy
  settings?: Record<string, any>
  /** Public URL of a generated thumbnail/cover image, if any. */
  thumbnailUrl?: string
}

const first = (...vals: Array<string | undefined | null>): string => {
  for (const v of vals) if (typeof v === 'string' && v.trim()) return v.trim()
  return ''
}
const oneOf = <T extends readonly string[]>(v: unknown, list: T, fallback: T[number]): T[number] =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T[number]) : fallback

/** A URL MuAPI can fetch: public https (no blob:, data:, localhost or private hosts). */
export function isPublicMediaUrl(url: string | undefined | null): boolean {
  if (!url) return false
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return false
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
  const h = u.hostname.toLowerCase()
  if (h === 'localhost' || h.endsWith('.local') || h === '0.0.0.0' || h === '::1' || h === '[::1]') return false
  if (/^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return false
  return u.protocol === 'https:'
}

export interface BuildResult {
  payload: Record<string, any> | null
  errors: string[]
  /** Fields the platform needs that the user should fill in (for UI hints). */
  warnings: string[]
}

export function buildPublishPayload(input: PayloadInput): BuildResult {
  const { platform, accountId, mediaUrl, mediaType, copy, settings = {}, thumbnailUrl } = input
  const spec = PLATFORM_SPECS[platform]
  const errors: string[] = []
  const warnings: string[] = []
  if (!spec) return { payload: null, errors: [`Unsupported platform: ${platform}`], warnings }

  const pc = copy.platforms?.[platform] || {}
  const idNum = Number(accountId)
  if (accountId === undefined || accountId === null || accountId === '' || Number.isNaN(idNum)) errors.push(`Choose a connected ${spec.label} account.`)
  if (!isPublicMediaUrl(mediaUrl)) errors.push('The media must be a public https link. Local or temporary files need to be uploaded first.')
  if (!spec.media.includes(mediaType)) errors.push(`${spec.label} does not accept ${mediaType}s here.`)

  const base = { account_id: idNum, media_url: mediaUrl }
  const text = first(pc.caption, copy.caption, copy.master)
  let payload: Record<string, any> = {}

  switch (platform) {
    case 'youtube': {
      const title = first(pc.title, copy.title)
      if (!title) errors.push('YouTube needs a title (up to 100 characters).')
      if (title.length > 100) errors.push(`The YouTube title is ${title.length} characters; the limit is 100.`)
      const tags = first(settings.tags, copy.tags)
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean)
      payload = {
        ...base,
        title,
        description: first(pc.description, pc.caption, copy.description, copy.master),
        ...(tags.length ? { tags } : {}),
        privacy: oneOf(settings.privacy, YOUTUBE_PRIVACY, 'public'),
        category_id: first(settings.category_id) || '22',
        made_for_kids: settings.made_for_kids === true,
      }
      break
    }
    case 'instagram': {
      payload = {
        ...base,
        caption: text,
        media_type: mediaType === 'image' ? 'IMAGE' : 'VIDEO',
      }
      if (mediaType === 'video') {
        payload.placement = oneOf(settings.placement, PLACEMENTS, 'reels')
        payload.share_to_feed = settings.share_to_feed !== false
        if (thumbnailUrl && isPublicMediaUrl(thumbnailUrl)) payload.cover_url = thumbnailUrl
      }
      break
    }
    case 'tiktok': {
      const title = first(pc.title, pc.caption, copy.tiktokTitle, copy.title, copy.master)
      if (!title) warnings.push('Add a TikTok title (up to 150 characters).')
      if (title.length > 150) errors.push(`The TikTok title is ${title.length} characters; the limit is 150.`)
      payload = {
        ...base,
        title,
        privacy_level: oneOf(settings.privacy_level, TIKTOK_PRIVACY, 'PUBLIC_TO_EVERYONE'),
        disable_comment: settings.disable_comment === true,
        disable_duet: settings.disable_duet === true,
        disable_stitch: settings.disable_stitch === true,
      }
      break
    }
    case 'facebook': {
      payload = { ...base, caption: text, placement: oneOf(settings.placement, PLACEMENTS, 'timeline') }
      break
    }
    case 'linkedin': {
      payload = { ...base, caption: text }
      break
    }
    case 'pinterest': {
      const title = first(pc.title, copy.title)
      payload = {
        ...base,
        ...(title ? { title } : {}),
        caption: first(pc.description, text),
        ...(first(settings.link) ? { link: first(settings.link) } : {}),
        ...(first(settings.board_id) ? { board_id: first(settings.board_id) } : {}),
      }
      break
    }
    case 'threads': {
      payload = { ...base, caption: text }
      if (settings.placement === 'reels') payload.placement = 'reels'
      break
    }
    case 'x': {
      if (text.length > 280) errors.push(`The X post is ${text.length} characters; the limit is 280.`)
      payload = { ...base, caption: text }
      const reply = oneOf(settings.reply_settings, X_REPLY_SETTINGS, 'everyone')
      if (reply !== 'everyone') payload.reply_settings = reply
      break
    }
  }

  if (!text && platform !== 'youtube' && platform !== 'tiktok' && platform !== 'pinterest') warnings.push(`Add some text for ${spec.label}.`)
  return { payload: errors.length ? null : payload, errors, warnings }
}

/** Estimated MuAPI cost for the selected destinations, in USD. */
export function estimateCostUsd(platforms: PlatformId[]): number {
  return Math.round(platforms.reduce((sum, p) => sum + (PLATFORM_SPECS[p]?.costUsd ?? 0), 0) * 100) / 100
}

/** Plain-language message for a failed MuAPI call (never includes keys). */
export function describePublishError(err: any, platformLabel = 'this platform'): string {
  const status = err?.response?.status ?? err?.status
  const data = err?.response?.data
  let detail = data?.detail || data?.error || data?.message
  if (detail && typeof detail === 'object') detail = JSON.stringify(detail)
  if (status === 401) return 'MuAPI rejected your API key. Check it in the API keys settings.'
  if (status === 403) return 'Your account is not allowed to publish. Check your SmartVideo GO access and MuAPI balance.'
  if (status === 404) return `This ${platformLabel} account was not found for your key. Reconnect it and try again.`
  if (status === 409) return `This ${platformLabel} account is disconnected. Reconnect it, then publish again.`
  if (status === 402) return 'Your MuAPI balance is too low to publish. Add credit and try again.'
  if (status === 429) return 'MuAPI is rate limiting requests. Wait a moment and try again.'
  if (status) return `${platformLabel} publish failed (${status})${detail ? `: ${detail}` : '.'}`
  return err?.message || 'Publishing failed.'
}
