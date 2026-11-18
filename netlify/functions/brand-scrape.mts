/**
 * Brand Studio site scraper: POST /api/scrape  { url }  ->  { ok, data } | { ok: false, error }
 *
 * Port of open-pomelli's `scrapeSite` (headless Chromium), run behind the same
 * SSRF guard as asset discovery and Motion Studio capture. Called by
 * src/lib/brandAnalyzer.js `scrapeSite`; `data.screenshot` is a base64 PNG.
 */
import './_personalization/shims/env'
import { BrowserSsrfError, scrapeBrandSite } from './_personalization/src/server/browserDiscovery'

type Config = {
  path: string | string[]
  rateLimit?: { windowLimit: number; windowSize: number; aggregateBy: Array<'ip' | 'domain'>; action?: 'rate_limit' | 'block' }
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })

// Second line of defence behind config.rateLimit: per warm instance only, so best effort.
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 6
const hits = new Map<string, number[]>()

export function rateLimited(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent)
    return true
  }
  recent.push(now)
  hits.set(key, recent)
  if (hits.size > 500) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k)
  return false
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' })

  let url = ''
  try {
    const body = await req.json()
    url = typeof body?.url === 'string' ? body.url.trim() : ''
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON body' })
  }
  if (!url) return json(400, { ok: false, error: 'A url is required' })

  const client = (req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim()
  if (rateLimited(client)) return json(429, { ok: false, error: 'Too many scrapes, try again in a minute' })

  try {
    return json(200, { ok: true, data: await scrapeBrandSite(url) })
  } catch (error) {
    if (error instanceof BrowserSsrfError) return json(400, { ok: false, error: error.message })
    console.warn('[brand-scrape] failed:', error instanceof Error ? error.message.split('\n')[0] : String(error))
    return json(502, { ok: false, error: 'Could not scrape that site' })
  }
}

// Every call can launch a headless browser, so the platform limits it per client IP before the function runs.
// (The in-function limiter above is per instance only, and Netlify runs many instances.)
export const config: Config = {
  path: '/api/scrape',
  rateLimit: { windowLimit: 8, windowSize: 60, aggregateBy: ['ip', 'domain'] },
}
