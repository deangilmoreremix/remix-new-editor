export const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'msclkid',
  '_ga',
  '_gl',
])

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    let normalized = `${parsed.protocol}//${parsed.hostname}`
    if (parsed.port && !['80', '443'].includes(parsed.port)) {
      normalized += `:${parsed.port}`
    }
    normalized += parsed.pathname
    const remaining = new URLSearchParams(parsed.search)
    TRACKING_PARAMS.forEach((param) => remaining.delete(param))
    const queryString = remaining.toString()
    if (queryString) {
      normalized += '?' + queryString
    }
    return normalized.toLowerCase()
  } catch {
    return url.toLowerCase().replace(/\/+$/, '')
  }
}
