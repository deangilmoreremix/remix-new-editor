/**
 * The background capture the `motion-studio-capture-background` Netlify function runs (compiled to
 * `netlify/lib/motion-capture.cjs` by `scripts/build-motion-capture.mjs`). A web request can only take
 * ~30 s on the host, too little to start a browser and photograph a heavy page; the background function
 * has minutes. The result is a job record the client polls (`/api/motion-studio/capture/status`).
 */
import { BrowserSsrfError, capturePageScreenshots, type PageCapture } from './browserDiscovery'
import { findMotionAssets } from './motionAssets'
import {
  CAPTURE_JOB_ID,
  assetFileName,
  buildCaptureResponse,
  captureImages,
  captureIsEmpty,
  storeCaptureImages,
  WORKER_WATCHDOG_MS,
  readCaptureJob,
  writeCaptureJob,
  type CaptureJob,
  type CaptureStorage,
} from './motionCapture'

/** Image types the motion-capture bucket accepts (supabase migration 20261102000000). */
export const CAPTURE_UPLOAD_TYPES: ReadonlySet<string> = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])

/**
 * The quick capture before the storyboard (pipeline stage 0, the product check): the home page at 2x with
 * its cards, bands, words, colours and logo, a few more routes, and the list of the site's pages. The pages
 * the storyboard needs are captured after it is approved (stage 4, targeted jobs). A run of the deep
 * whole-site capture on production went past the host's 15-minute limit and was retried by it.
 */
export const WORKER_CAPTURE_OPTIONS = { hardMs: 100_000, budgetMs: 75_000, firstShotMs: 25_000, navigationMs: 30_000, deep: true, maxRoutes: 6 } as const
/** The asset finder (people, products, logo found across the site) gets this long next to the quick capture. */
export const QUICK_ASSETS_MS = 60_000

export interface MotionCaptureJobRequest {
  jobId: string
  userId: string
  url: string
  /** Pipeline stage 4, after the storyboard: just this page (no crawl of more routes, no asset finder). */
  targeted?: boolean
}

/** A targeted capture: one page, its 2x screenshot, layout and card crops, in a couple of minutes. */
export const TARGETED_CAPTURE_OPTIONS = { hardMs: 180_000, budgetMs: 140_000, firstShotMs: 25_000, navigationMs: 30_000, deep: true, maxRoutes: 0 } as const

/** A capture that fails this fast (browser start, first navigation) is tried once more within the same budget. */
const RETRY_WITHIN_MS = 15_000
/** How long a new record waits for one that is still being saved. */
const WRITE_WAIT_MS = 10_000

/** Why a capture failed, safe to show: the first line of the error, no addresses, short. */
const reasonOf = (err: unknown): string =>
  (err instanceof Error ? err.message : String(err)).split('\n')[0].replace(/https?:\/\/\S+/gi, 'the address').slice(0, 160)

/** Runs one capture job and always leaves a `done` or `error` record behind. */
export async function runMotionCapture(job: MotionCaptureJobRequest, storage: CaptureStorage, opts: { watchdogMs?: number } = {}): Promise<void> {
  const { jobId, userId, url } = job
  const captureOptions = job.targeted ? TARGETED_CAPTURE_OPTIONS : WORKER_CAPTURE_OPTIONS
  const started = Date.now()
  let saved = false
  let saving: Promise<void> | null = null
  // One record wins: once a record is saved, a later one is dropped. A record still being saved is waited for
  // (up to WRITE_WAIT_MS), so the watchdog never returns while the only final record is stuck or about to fail.
  const write = async (record: CaptureJob) => {
    const pending = saving
    if (pending) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, WRITE_WAIT_MS)
        pending.catch(() => undefined).then(() => {
          clearTimeout(timer)
          resolve()
        })
      })
    }
    if (saved) return
    const attempt = writeCaptureJob(storage, userId, jobId, record).then(() => {
      saved = true
    })
    saving = attempt
    try {
      await attempt
    } finally {
      if (saving === attempt) saving = null
    }
  }
  const fail = (code: string, message: string, timing?: unknown) =>
    write({ state: 'error', finishedAt: new Date().toISOString(), code, error: message, ...(timing && typeof timing === 'object' ? { timing: timing as Record<string, number> } : {}) })

  const run = async () => {
    // The host retries a background function that died: a job that is no longer running (finished, failed,
    // given up on, or stale) is never captured a second time.
    const current = await readCaptureJob(storage, userId, jobId).catch(() => null)
    if (current && current.state !== 'running') {
      saved = true
      return
    }
    // The asset finder crawls the site's pages for its own pictures while the browser photographs it.
    const none = { assets: [], logo: null }
    // Whatever the finder has not found in its time is left out (a late answer never holds up the capture).
    const assetsRun = job.targeted
      ? Promise.resolve(none)
      : Promise.race([
          findMotionAssets(url, { budgetMs: QUICK_ASSETS_MS }).catch(() => none),
          new Promise<typeof none>((resolve) => setTimeout(() => resolve(none), QUICK_ASSETS_MS + 15_000)),
        ])
    let capture: PageCapture
    try {
      capture = await capturePageScreenshots(url, { ...captureOptions })
    } catch (err) {
      if (err instanceof BrowserSsrfError || Date.now() - started > RETRY_WITHIN_MS) throw err
      console.warn('[motion-studio/capture-worker] retrying after', reasonOf(err))
      const hardMs = captureOptions.hardMs - (Date.now() - started)
      capture = await capturePageScreenshots(url, { ...captureOptions, hardMs, budgetMs: Math.min(captureOptions.budgetMs, hardMs - 20_000) })
    }
    if (captureIsEmpty(capture)) return fail('CAPTURE_FAILED', 'The page could not be captured: it showed no picture and no text')
    const { assets: allFound, logo: anyLogo } = await assetsRun
    // remix-new-editor: only types the motion-capture bucket accepts. One
    // rejected upload would fail the whole capture, so other types (SVG, …)
    // are skipped rather than uploaded.
    const found = allFound.filter((a) => CAPTURE_UPLOAD_TYPES.has(a.contentType))
    const crawledLogo = anyLogo && CAPTURE_UPLOAD_TYPES.has(anyLogo.contentType) ? anyLogo : null
    // The browser could not cut the logo out of the page: use the one the crawl found.
    const extraImages = !capture.logo && crawledLogo ? [{ name: 'logo.png', body: crawledLogo.body, contentType: crawledLogo.contentType }] : []
    const assetImages = found.map((a, i) => ({ name: assetFileName(i, a.contentType), body: a.body, contentType: a.contentType }))
    const urls = await storeCaptureImages(storage, userId, [...captureImages(capture), ...extraImages, ...assetImages])
    const info = found.map((a, i) => ({ name: assetFileName(i, a.contentType), category: a.category, alt: a.alt }))
    await write({ state: 'done', finishedAt: new Date().toISOString(), capture: buildCaptureResponse(capture, urls, false, info) })
  }

  let watchdog: ReturnType<typeof setTimeout> | undefined
  const running = run()
  // After the watchdog has answered, a late failure has nothing left to report.
  running.catch(() => undefined)
  try {
    await Promise.race([
      running,
      new Promise<void>((resolve) => {
        watchdog = setTimeout(() => {
          resolve(fail('TIMEOUT', `The capture took longer than ${Math.round((opts.watchdogMs ?? WORKER_WATCHDOG_MS) / 60_000)} minutes`))
        }, opts.watchdogMs ?? WORKER_WATCHDOG_MS)
      }),
    ])
  } catch (err) {
    console.warn('[motion-studio/capture-worker] failed', reasonOf(err))
    await (err instanceof BrowserSsrfError
      ? fail('URL_REJECTED', 'That address cannot be captured. Use a public http(s) page.')
      : fail('CAPTURE_FAILED', `The page could not be captured: ${reasonOf(err)}`, (err as { timing?: unknown })?.timing)
    ).catch(() => undefined)
  } finally {
    clearTimeout(watchdog)
  }
}

/** Parses a dispatch body; null when it is not a well-formed job. */
export function parseJobRequest(body: unknown): MotionCaptureJobRequest | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  if (typeof b.jobId !== 'string' || !CAPTURE_JOB_ID.test(b.jobId)) return null
  if (typeof b.userId !== 'string' || !b.userId || b.userId.length > 128) return null
  if (typeof b.url !== 'string' || !/^https?:\/\//i.test(b.url) || b.url.length > 2048) return null
  return { jobId: b.jobId, userId: b.userId, url: b.url, ...(b.targeted === true ? { targeted: true } : {}) }
}
