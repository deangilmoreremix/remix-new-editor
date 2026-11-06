import { NextRequest, NextResponse } from '../../../../shims/next-server'
import { randomUUID } from 'node:crypto'
import { BrowserSsrfError, capturePageScreenshots, createSsrfGuard } from '../../../../src/server/browserDiscovery'
import { CAPTURE_BUCKET, buildCaptureResponse, captureImages, captureIsEmpty, storeCaptureImages, writeCaptureJob, type CaptureStorage } from '../../../../src/server/motionCapture'
import { rateLimit, rateLimit429 } from '../../../../lib/rateLimit'
import { requireMotionStudioUser } from '../lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/motion-studio/capture  { url }
 *   → { url, title, page, pages, crops, images, logo, cutouts, emptyPlate, content, brand, transient }
 *
 * Each page's `layout` (section headings, cards) is in page CSS px, 1920 wide,
 * like upstream's layout.json.
 *
 * Captures a public site for Motion Studio the way upstream ShotCraft does
 * (see `capturePageScreenshots`): the page asked for and up to two more routes
 * of the same site, each a 1920-wide page at 2x with its card cutouts and
 * layout; the nav bar, search pill and button cutouts; an empty plate; the
 * site's logo, its own images, brand colours and what it says about itself.
 * All behind the discovery SSRF guard. The images are stored under the
 * caller's storage prefix and returned as URLs. Images are never inlined into
 * the project: the project is saved in localStorage, which multi-megabyte data
 * URLs would overflow.
 */
/** Supabase Storage for the capture bucket (loaded on first use: it needs the service credentials). */
async function captureStorage(): Promise<CaptureStorage> {
  const { createServerClient } = await import('../../../../src/lib/supabase')
  return createServerClient().storage.from(CAPTURE_BUCKET) as unknown as CaptureStorage
}

const INTERNAL_FUNCTION_SECRET = process.env.INTERNAL_FUNCTION_SECRET || ''

/**
 * On the host a web request lasts ~30 s, too little to start a browser and photograph a heavy page, so the
 * capture runs in a background function (minutes) and the client polls for it. Anywhere else (local
 * development, tests) the capture runs inside the request as it always has.
 */
/**
 * remix-new-editor: Netlify does not guarantee NODE_ENV=production inside
 * deployed functions, so "deployed" cannot be inferred from it. Local
 * development is the explicit exception instead (netlify dev / vite /
 * vitest), and everything else is treated as deployed.
 */
const isLocalDevelopment = () =>
  process.env.NETLIFY_DEV === 'true' || process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
const backgroundCaptureEnabled = () => !isLocalDevelopment() && Boolean(INTERNAL_FUNCTION_SECRET)

/** Starts the background capture; returns its job id, or null when it could not be started. */
async function startBackgroundCapture(req: NextRequest, userId: string, url: string, targeted = false): Promise<string | null> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '') || req.nextUrl?.origin || ''
  if (!base) return null
  const jobId = randomUUID()
  try {
    await writeCaptureJob(await captureStorage(), userId, jobId, { state: 'running', startedAt: new Date().toISOString() })
    const response = await fetch(`${base}/.netlify/functions/motion-studio-capture-background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-service-token': INTERNAL_FUNCTION_SECRET },
      body: JSON.stringify({ jobId, userId, url, ...(targeted ? { targeted: true } : {}) }),
      signal: AbortSignal.timeout(10_000),
    })
    return response.ok ? jobId : null
  } catch (err) {
    console.warn('[motion-studio/capture] background start failed', err instanceof Error ? err.message : String(err))
    return null
  }
}

export async function POST(req: NextRequest) {
  const user = await requireMotionStudioUser(req)
  if (!user.ok) return user.response

  let url = ''
  // Pipeline stage 4, after the storyboard: a page a storyboard row needs that the first capture lacks.
  let targeted = false
  try {
    const body = await req.json()
    url = typeof body?.url === 'string' ? body.url.trim() : ''
    targeted = body?.targeted === true
  } catch {
    // fall through to validation
  }
  if (!url) return NextResponse.json({ error: 'A page URL is required', code: 'BAD_REQUEST' }, { status: 400 })
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`

  const limit = rateLimit(`motion-studio-capture:${user.userId}`, { windowMs: 10 * 60_000, max: 10 })
  if (!limit.allowed) return rateLimit429(limit.retryAfterMs)

  if (backgroundCaptureEnabled()) {
    try {
      await createSsrfGuard().validateNavigationTarget(url)
    } catch (err) {
      if (err instanceof BrowserSsrfError) {
        return NextResponse.json({ error: 'That address cannot be captured. Use a public http(s) page.', code: 'URL_REJECTED' }, { status: 400 })
      }
      throw err
    }
    const jobId = await startBackgroundCapture(req, user.userId, url, targeted)
    if (jobId) return NextResponse.json({ jobId, state: 'running' }, { status: 202 })
    // The background function could not be started: capture inside this request instead (shorter, but something).
  }

  let capture
  try {
    capture = targeted ? await capturePageScreenshots(url, { maxRoutes: 0 }) : await capturePageScreenshots(url)
  } catch (err) {
    if (err instanceof BrowserSsrfError) {
      return NextResponse.json({ error: 'That address cannot be captured. Use a public http(s) page.', code: 'URL_REJECTED' }, { status: 400 })
    }
    console.warn('[motion-studio/capture] capture failed', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'The page could not be captured', code: 'CAPTURE_FAILED' }, { status: 502 })
  }

  if (captureIsEmpty(capture)) {
    return NextResponse.json({ error: 'The page could not be captured', code: 'CAPTURE_FAILED' }, { status: 502 })
  }
  const images = captureImages(capture)
  let urls: Map<string, string>
  let transient = false
  try {
    urls = await storeCaptureImages(await captureStorage(), user.userId, images)
  } catch (err) {
    // Local development without storage: hand the images back inline so the
    // flow can be exercised. Production never falls back to inline images.
    if (!isLocalDevelopment()) {
      console.warn('[motion-studio/capture] storage failed', err instanceof Error ? err.message : String(err))
      return NextResponse.json({ error: 'The capture could not be saved', code: 'STORAGE_FAILED' }, { status: 502 })
    }
    urls = new Map(images.map((image) => [image.name, `data:${image.contentType};base64,${image.body.toString('base64')}`]))
    transient = true
  }
  return NextResponse.json(buildCaptureResponse(capture, urls, transient))
}
