/**
 * Remote preview media → same-origin proxy URL.
 *
 * `@remotion/media`'s <Video> reads the source with `fetch()` + `Range`
 * requests (mediabunny), so a cross-origin source only plays when its host
 * sends `Access-Control-Allow-Origin` AND is listed in the CSP `connect-src`.
 * The AI-viral demo library (cdn.seedance2prompt.com) does neither, so those
 * videos failed with "This video could not be played in your browser".
 *
 * Sources on an allow-listed host are rewritten to `/api/media/remote?url=…`,
 * which streams the original bytes from our own origin. Anything else
 * (same-origin paths, blob:/data: URLs, unknown hosts) is returned unchanged.
 */

export const REMOTE_MEDIA_PROXY_PATH = '/api/media/remote'

/** Hosts the proxy is allowed to fetch from. Exact hostnames only. */
export const REMOTE_MEDIA_ALLOWED_HOSTS: readonly string[] = [
  'cdn.seedance2prompt.com',
  // MuAPI's output hosts. The Zack D final cut renders generated clips/narration/music in the browser, and the
  // renderer reads them with fetch(): the CSP `connect-src` does not allow the CloudFront host (and neither host
  // sends CORS headers we can rely on), so they must come through the same-origin proxy.
  'cdn.muapi.ai',
  'd3adwkbyhxyrtq.cloudfront.net',
]

export function isProxiableRemoteMediaHost(hostname: string): boolean {
  return REMOTE_MEDIA_ALLOWED_HOSTS.includes(hostname.toLowerCase())
}

/** Parse an absolute https URL on an allow-listed host, or return null. */
export function parseProxiableRemoteMediaUrl(raw: string | null | undefined): URL | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  // HTTPS only: the proxy never fetches plaintext media.
  if (url.protocol !== 'https:') return null
  if (url.username || url.password) return null
  if (!isProxiableRemoteMediaHost(url.hostname)) return null
  return url
}

/**
 * Return the URL the browser should load for a preview media source: a
 * same-origin proxy URL for allow-listed remote hosts, otherwise the input.
 */
export function toPlayablePreviewMediaUrl(src: string): string
export function toPlayablePreviewMediaUrl(src: string | null | undefined): string | null
export function toPlayablePreviewMediaUrl(src: string | null | undefined): string | null {
  if (!src) return src ?? null
  const url = parseProxiableRemoteMediaUrl(src)
  if (!url) return src
  return `${REMOTE_MEDIA_PROXY_PATH}?url=${encodeURIComponent(url.toString())}`
}
