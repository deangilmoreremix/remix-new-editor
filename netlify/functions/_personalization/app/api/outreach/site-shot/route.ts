import { NextRequest, NextResponse } from '../../../../shims/next-server'
import { createHash } from 'node:crypto'
import { BrowserSsrfError, capturePageScreenshots, createSsrfGuard } from '../../../../src/server/browserDiscovery'
import { CAPTURE_BUCKET, type CaptureStorage } from '../../../../src/server/motionCapture'
import { rateLimit, rateLimit429 } from '../../../../lib/rateLimit'
import { requireMotionStudioUser } from '../../motion-studio/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/outreach/site-shot  { url, refresh? }  →  { url, imageUrl, logoUrl, cached }
 *   url: a website (its home page is captured) or a social profile link (YouTube, TikTok, Facebook,
 *   Instagram, X: that profile page). A login wall or block → 422 CONTENT_RESTRICTED. LinkedIn → 400.
 *
 * Video Outreach studio: a screenshot of a prospect's website, shown behind the presenter's camera
 * bubble on that contact's page. One light capture of the site's home page (no extra routes, no
 * crops: the Motion Studio capture's browser and SSRF guard, src/server/browserDiscovery.ts),
 * stored once per user and site in the capture bucket, so a campaign with many contacts on the same
 * site captures it once. The site's logo found by the same capture (a transparent PNG) is stored next
 * to it for the email thumbnails' logo overlay; logoUrl is null when the site shows none.
 */

// Social pages a background can show (their public profile page). Keep in step with siteKey in src/lib/outreach/draft.js.
const SOCIAL_HOSTS: Record<string, string> = {
  'youtube.com': 'www.youtube.com', 'm.youtube.com': 'www.youtube.com',
  'tiktok.com': 'www.tiktok.com', 'm.tiktok.com': 'www.tiktok.com',
  'facebook.com': 'www.facebook.com', 'm.facebook.com': 'www.facebook.com', 'fb.com': 'www.facebook.com',
  'instagram.com': 'www.instagram.com',
  'x.com': 'x.com', 'twitter.com': 'x.com', 'mobile.twitter.com': 'x.com',
}
const bareHost = (h: string) => h.toLowerCase().replace(/\.$/, '').replace(/^www\./, '')
export const isLinkedIn = (raw: string) => /(^|\/\/|\.)linkedin\.com(\/|$|:)/i.test(String(raw || '').trim()) || /^linkedin\.com/i.test(String(raw || '').trim())

/** A social profile's own page: https://<host>/<profile path>, or '' when the link has no profile in it. */
function socialProfile(host: string, u: URL): string {
  const parts = u.pathname.split('/').filter(Boolean).map((p) => p.replace(/[^A-Za-z0-9@._%-]/g, '')).filter(Boolean)
  if (!parts.length) return ''
  let keep: string[]
  if (host === 'www.youtube.com') keep = ['channel', 'c', 'user'].includes(parts[0]) ? parts.slice(0, 2) : parts[0].startsWith('@') ? parts.slice(0, 1) : []
  else if (host === 'www.tiktok.com') keep = parts[0].startsWith('@') ? parts.slice(0, 1) : []
  else if (host === 'www.facebook.com') {
    if (parts[0] === 'profile.php') { const id = (u.searchParams.get('id') || '').replace(/\D/g, ''); return id ? `https://${host}/profile.php?id=${id}` : '' }
    keep = parts[0] === 'people' ? parts.slice(0, 3) : parts.slice(0, parts[0] === 'p' ? 2 : 1)
  } else keep = parts.slice(0, 1)
  return keep.length && keep.length >= (['channel', 'c', 'user', 'p'].includes(keep[0]) ? 2 : 1) ? `https://${host}/${keep.join('/')}` : ''
}

/**
 * What a background shows: a website's home page (scheme + host), or a social profile's own page
 * (YouTube, TikTok, Facebook, Instagram, X). Null when not a usable web address. LinkedIn is not captured.
 */
export function normalizeSite(raw: string): string | null {
  const value = String(raw || '').trim()
  if (!value || value.length > 2048) return null
  try {
    const u = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    if (!u.hostname.includes('.')) return null
    const social = SOCIAL_HOSTS[bareHost(u.hostname)] || SOCIAL_HOSTS[u.hostname.toLowerCase()]
    if (social) return socialProfile(social, u) || null
    if (bareHost(u.hostname) === 'linkedin.com') return null
    return `${u.protocol}//${u.hostname.toLowerCase()}${u.port ? `:${u.port}` : ''}/`
  } catch {
    return null
  }
}

/** A capture that landed on a login page or was blocked (most social networks, for logged-out visitors). */
export function isRestricted(capture: { url?: string; status?: number }): boolean {
  if ([401, 403, 429].includes(Number(capture.status))) return true
  try {
    const path = new URL(String(capture.url || '')).pathname.toLowerCase()
    return /^\/(login|accounts\/login|signin|sign_in|checkpoint|i\/flow\/login|login\.php)(\/|$|\.)/.test(path)
  } catch {
    return false
  }
}
export const isSocialPage = (site: string) => { try { return Object.values(SOCIAL_HOSTS).includes(new URL(site).hostname) } catch { return false } }
export const RESTRICTED_ERROR = 'Page is content restricted. Please try a different page.'

/** Where a user's screenshot of a site is stored: the same site always lands on the same path. */
export function shotPath(userId: string, site: string): string {
  const owner = String(userId).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 128)
  return `${owner}/outreach-site/${createHash('sha256').update(site).digest('hex').slice(0, 32)}.jpg`
}

// Light capture: the home page only, a short budget (it runs inside one web request).
export const SITE_SHOT_OPTIONS = { maxRoutes: 0, maxCrops: 0, deep: false, firstShotMs: 15_000, budgetMs: 20_000, hardMs: 24_000 } as const

export interface SiteShotDeps {
  capture: (url: string, options: typeof SITE_SHOT_OPTIONS) => Promise<{ page: Buffer | null; logo?: Buffer | null; url?: string; status?: number }>
  storage: CaptureStorage
}

export type SiteShotResult =
  | { ok: true; url: string; imageUrl: string; logoUrl: string | null; cached: boolean }
  | { ok: false; status: number; code: string; error: string }

export async function siteShot(userId: string, rawUrl: string, refresh: boolean, deps: SiteShotDeps): Promise<SiteShotResult> {
  if (isLinkedIn(rawUrl)) return { ok: false, status: 400, code: 'LINKEDIN_NOT_SUPPORTED', error: 'LinkedIn pages can\u2019t be captured. Use the Profile card background instead.' }
  const site = normalizeSite(rawUrl)
  if (!site) return { ok: false, status: 400, code: 'BAD_REQUEST', error: 'A website address is required' }
  const path = shotPath(userId, site)
  const publicUrl = () => deps.storage.getPublicUrl(path).data?.publicUrl || null

  let capture: { page: Buffer | null; logo?: Buffer | null; url?: string; status?: number }
  try {
    capture = await deps.capture(site, SITE_SHOT_OPTIONS)
  } catch (err) {
    if (err instanceof BrowserSsrfError) return { ok: false, status: 400, code: 'URL_REJECTED', error: 'That address cannot be captured. Use a public website.' }
    return { ok: false, status: 502, code: 'CAPTURE_FAILED', error: 'The website could not be captured' }
  }
  // A login page or a block is not their page: no screenshot of a login form.
  if (capture && isRestricted(capture)) return { ok: false, status: 422, code: 'CONTENT_RESTRICTED', error: RESTRICTED_ERROR }
  if (!capture?.page) return { ok: false, status: 502, code: 'CAPTURE_FAILED', error: 'The website could not be captured' }

  const { error } = await deps.storage.upload(path, capture.page, { contentType: 'image/jpeg', upsert: refresh })
  // Already stored by an earlier capture of the same site: keep that one.
  if (error && !/exist|duplicate/i.test(error.message)) return { ok: false, status: 502, code: 'STORAGE_FAILED', error: 'The screenshot could not be saved' }
  const imageUrl = publicUrl()
  if (!imageUrl) return { ok: false, status: 502, code: 'STORAGE_FAILED', error: 'The screenshot could not be saved' }
  // The logo is a bonus: a failure to store it never fails the screenshot.
  let logoUrl: string | null = null
  // A social page's logo is the network's (YouTube, TikTok…), not the prospect's: none is kept.
  if (capture.logo?.length && !isSocialPage(site)) {
    const logoPath = path.replace(/\.jpg$/, '-logo.png')
    const saved = await deps.storage.upload(logoPath, capture.logo, { contentType: 'image/png', upsert: refresh }).catch(() => ({ error: new Error('upload failed') }))
    if (!saved.error || /exist|duplicate/i.test(saved.error.message)) logoUrl = deps.storage.getPublicUrl(logoPath).data?.publicUrl || null
  }
  return { ok: true, url: site, imageUrl, logoUrl, cached: !!error }
}

// ---- Map backgrounds: { map: "<address>" } → a picture of the address on OpenStreetMap ----------

/** An address as a cache key; null when it isn't a usable address. */
export function normalizeAddress(raw: string): string | null {
  const v = String(raw || '').replace(/\s+/g, ' ').trim()
  if (v.length < 4 || v.length > 200 || !/[A-Za-z]/.test(v)) return null
  return v.toLowerCase()
}

export function mapPath(userId: string, address: string): string {
  const owner = String(userId).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 128)
  return `${owner}/outreach-map/${createHash('sha256').update(address).digest('hex').slice(0, 32)}.jpg`
}

/** The OpenStreetMap page showing a point, zoomed to street level, with a marker. */
export function osmEmbedUrl(lat: number, lon: number): string {
  const d = 0.006
  const bbox = [lon - d * 1.8, lat - d, lon + d * 1.8, lat + d].map((n) => n.toFixed(6)).join(',')
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(6)},${lon.toFixed(6)}`
}

/** Address → coordinates with OpenStreetMap Nominatim (its usage policy: an app User-Agent, ≤1 request/s). */
export async function geocodeAddress(address: string, fetchImpl: typeof fetch = fetch): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`
  // A slow lookup must not hold the function open: give up after 10 seconds and use no map.
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'SmartVideo-Outreach/1.0 (personalized video backgrounds)', Accept: 'application/json' } }).catch(() => null)
  if (!res?.ok) return null
  const rows = (await res.json().catch(() => [])) as Array<{ lat?: string; lon?: string }>
  const lat = Number(rows?.[0]?.lat); const lon = Number(rows?.[0]?.lon)
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null
}

export interface MapShotDeps extends SiteShotDeps {
  geocode: (address: string) => Promise<{ lat: number; lon: number } | null>
}

export async function mapShot(userId: string, rawAddress: string, refresh: boolean, deps: MapShotDeps): Promise<SiteShotResult> {
  const address = normalizeAddress(rawAddress)
  if (!address) return { ok: false, status: 400, code: 'BAD_REQUEST', error: 'An address is required' }
  const path = mapPath(userId, address)
  const point = await deps.geocode(address).catch(() => null)
  if (!point) return { ok: false, status: 404, code: 'NOT_FOUND', error: 'That address could not be found on the map' }
  let capture: { page: Buffer | null }
  try {
    capture = await deps.capture(osmEmbedUrl(point.lat, point.lon), SITE_SHOT_OPTIONS)
  } catch {
    return { ok: false, status: 502, code: 'CAPTURE_FAILED', error: 'The map could not be captured' }
  }
  if (!capture?.page) return { ok: false, status: 502, code: 'CAPTURE_FAILED', error: 'The map could not be captured' }
  const { error } = await deps.storage.upload(path, capture.page, { contentType: 'image/jpeg', upsert: refresh })
  if (error && !/exist|duplicate/i.test(error.message)) return { ok: false, status: 502, code: 'STORAGE_FAILED', error: 'The map could not be saved' }
  const imageUrl = deps.storage.getPublicUrl(path).data?.publicUrl || null
  if (!imageUrl) return { ok: false, status: 502, code: 'STORAGE_FAILED', error: 'The map could not be saved' }
  return { ok: true, url: address, imageUrl, logoUrl: null, cached: !!error }
}

// Nominatim allows one request per second: geocodes from this instance are spaced out.
let lastGeocode = 0
async function politeGeocode(address: string) {
  const wait = lastGeocode + 1100 - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastGeocode = Date.now()
  return geocodeAddress(address)
}

async function captureStorage(): Promise<CaptureStorage> {
  const { createServerClient } = await import('../../../../src/lib/supabase')
  return createServerClient().storage.from(CAPTURE_BUCKET) as unknown as CaptureStorage
}

export async function POST(req: NextRequest) {
  const user = await requireMotionStudioUser(req)
  if (!user.ok) return user.response

  let url = ''
  let map = ''
  let refresh = false
  try {
    const body = await req.json()
    url = typeof body?.url === 'string' ? body.url : ''
    map = typeof body?.map === 'string' ? body.map : ''
    refresh = body?.refresh === true
  } catch {
    // validated below
  }
  // A campaign may have many sites; captures are heavy, so this is per user and capped.
  const limit = rateLimit(`outreach-site-shot:${user.userId}`, { windowMs: 10 * 60_000, max: 60 })
  if (!limit.allowed) return rateLimit429(limit.retryAfterMs)

  const deps = {
    capture: (target: string, options: typeof SITE_SHOT_OPTIONS) => capturePageScreenshots(target, { guard: createSsrfGuard(), ...options }),
    storage: await captureStorage(),
  }
  const result = map
    ? await mapShot(user.userId, map, refresh, { ...deps, geocode: politeGeocode })
    : await siteShot(user.userId, url, refresh, deps)
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status })
  return NextResponse.json({ url: result.url, imageUrl: result.imageUrl, logoUrl: result.logoUrl, cached: result.cached })
}
