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
 *
 * Video Outreach studio: a screenshot of a prospect's website, shown behind the presenter's camera
 * bubble on that contact's page. One light capture of the site's home page (no extra routes, no
 * crops: the Motion Studio capture's browser and SSRF guard, src/server/browserDiscovery.ts),
 * stored once per user and site in the capture bucket, so a campaign with many contacts on the same
 * site captures it once. The site's logo found by the same capture (a transparent PNG) is stored next
 * to it for the email thumbnails' logo overlay; logoUrl is null when the site shows none.
 */

/** The site's home page (scheme + host), which is what a background shows. Null when not a web address. */
export function normalizeSite(raw: string): string | null {
  const value = String(raw || '').trim()
  if (!value || value.length > 2048) return null
  try {
    const u = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    if (!u.hostname.includes('.')) return null
    return `${u.protocol}//${u.hostname.toLowerCase()}${u.port ? `:${u.port}` : ''}/`
  } catch {
    return null
  }
}

/** Where a user's screenshot of a site is stored: the same site always lands on the same path. */
export function shotPath(userId: string, site: string): string {
  const owner = String(userId).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 128)
  return `${owner}/outreach-site/${createHash('sha256').update(site).digest('hex').slice(0, 32)}.jpg`
}

// Light capture: the home page only, a short budget (it runs inside one web request).
export const SITE_SHOT_OPTIONS = { maxRoutes: 0, maxCrops: 0, deep: false, firstShotMs: 15_000, budgetMs: 20_000, hardMs: 24_000 } as const

export interface SiteShotDeps {
  capture: (url: string, options: typeof SITE_SHOT_OPTIONS) => Promise<{ page: Buffer | null; logo?: Buffer | null }>
  storage: CaptureStorage
}

export type SiteShotResult =
  | { ok: true; url: string; imageUrl: string; logoUrl: string | null; cached: boolean }
  | { ok: false; status: number; code: string; error: string }

export async function siteShot(userId: string, rawUrl: string, refresh: boolean, deps: SiteShotDeps): Promise<SiteShotResult> {
  const site = normalizeSite(rawUrl)
  if (!site) return { ok: false, status: 400, code: 'BAD_REQUEST', error: 'A website address is required' }
  const path = shotPath(userId, site)
  const publicUrl = () => deps.storage.getPublicUrl(path).data?.publicUrl || null

  let capture: { page: Buffer | null; logo?: Buffer | null }
  try {
    capture = await deps.capture(site, SITE_SHOT_OPTIONS)
  } catch (err) {
    if (err instanceof BrowserSsrfError) return { ok: false, status: 400, code: 'URL_REJECTED', error: 'That address cannot be captured. Use a public website.' }
    return { ok: false, status: 502, code: 'CAPTURE_FAILED', error: 'The website could not be captured' }
  }
  if (!capture?.page) return { ok: false, status: 502, code: 'CAPTURE_FAILED', error: 'The website could not be captured' }

  const { error } = await deps.storage.upload(path, capture.page, { contentType: 'image/jpeg', upsert: refresh })
  // Already stored by an earlier capture of the same site: keep that one.
  if (error && !/exist|duplicate/i.test(error.message)) return { ok: false, status: 502, code: 'STORAGE_FAILED', error: 'The screenshot could not be saved' }
  const imageUrl = publicUrl()
  if (!imageUrl) return { ok: false, status: 502, code: 'STORAGE_FAILED', error: 'The screenshot could not be saved' }
  // The logo is a bonus: a failure to store it never fails the screenshot.
  let logoUrl: string | null = null
  if (capture.logo?.length) {
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
  const res = await fetchImpl(url, { headers: { 'User-Agent': 'SmartVideo-Outreach/1.0 (personalized video backgrounds)', Accept: 'application/json' } })
  if (!res.ok) return null
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
