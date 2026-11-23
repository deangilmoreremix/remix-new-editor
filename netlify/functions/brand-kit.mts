/**
 * Brand Kit deep scan: POST /api/brand-kit  { url }  ->  { ok, profile } | { ok: false, error }
 *
 * Reads the business's home page plus a few of its own pages (About, Products/Services, Reviews, Team) with
 * plain, SSRF-validated HTTP fetches (no browser, no paid crawler, no AI) and returns fonts, an inferred tone of
 * voice, offerings, testimonials and more images. See _personalization/src/server/brandKitCrawl.ts.
 */
import './_personalization/shims/env'
import { crawlBrandSite } from './_personalization/src/server/brandKitCrawl'
import { assertSafeUrlString } from './_personalization/src/lib/networkSafety'

type Config = {
  path: string | string[]
  rateLimit?: { windowLimit: number; windowSize: number; aggregateBy: Array<'ip' | 'domain'>; action?: 'rate_limit' | 'block' }
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })

const BUDGET_MS = 24_000
const MAX_URL_LENGTH = 2048

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' })

  let url = ''
  try {
    const body = await req.json()
    url = typeof body?.url === 'string' ? body.url.trim() : ''
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON body' })
  }
  if (!url || url.length > MAX_URL_LENGTH) return json(400, { ok: false, error: 'A website url is required' })
  try {
    url = assertSafeUrlString(url).toString()
  } catch {
    return json(400, { ok: false, error: 'This website URL is not allowed' })
  }

  try {
    const profile = await crawlBrandSite(url, Date.now() + BUDGET_MS)
    if (!profile) return json(502, { ok: false, error: 'Could not read that website' })
    return json(200, { ok: true, profile })
  } catch (error) {
    console.warn('[brand-kit] failed:', error instanceof Error ? error.message.split('\n')[0] : String(error))
    return json(502, { ok: false, error: 'Could not read that website' })
  }
}

// Each call fetches up to five pages, so the platform limits it per client IP before the function runs.
export const config: Config = {
  path: '/api/brand-kit',
  rateLimit: { windowLimit: 8, windowSize: 60, aggregateBy: ['ip', 'domain'] },
}
