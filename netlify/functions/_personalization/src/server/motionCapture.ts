/**
 * Motion Studio page capture: what is stored, what is returned, and the job record a background capture
 * writes. Shared by the API route (inline capture) and the Netlify background function, so it takes the
 * storage client as an argument and imports nothing through path aliases.
 */
import { randomUUID } from 'node:crypto'
import { captureHasWords, CAPTURE_DEVICE_SCALE, CAPTURE_VIEWPORT, type PageCapture } from './browserDiscovery'

/** Public bucket for captured pages and job records; created by supabase/migrations/20261028000000_motion_capture_storage_bucket.sql. */
export const CAPTURE_BUCKET = 'motion-capture'

export const sanitizeName = (value: string) => value.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 96) || 'x'

export type StoredImage = { name: string; body: Buffer; contentType: string }

/** The slice of Supabase Storage (`client.storage.from(bucket)`) used here. */
export interface CaptureStorage {
  upload(path: string, body: Buffer | string, options: { contentType: string; upsert: boolean }): Promise<{ error: { message: string } | null }>
  getPublicUrl(path: string): { data: { publicUrl?: string } | null }
  download(path: string): Promise<{ data: { text(): Promise<string> } | null; error: { message: string } | null }>
}

/** Every image of a capture, by name: pages, card crops, the site's own images, cutouts, the empty plate and the logo. */
export function captureImages(capture: PageCapture): StoredImage[] {
  const jpeg = 'image/jpeg'
  const png = 'image/png'
  return [
    ...(capture.page ? [{ name: 'page.jpg', body: capture.page, contentType: jpeg }] : []),
    ...(capture.routes ?? []).map((r) => ({ name: `page-${sanitizeName(r.name)}.jpg`, body: r.page, contentType: jpeg })),
    ...capture.crops.map((body, i) => ({ name: `crop-${i + 1}.jpg`, body, contentType: jpeg })),
    ...(capture.images ?? []).map((body, i) => ({ name: `image-${i + 1}.jpg`, body, contentType: jpeg })),
    ...(capture.cutouts?.nav ? [{ name: 'nav.jpg', body: capture.cutouts.nav, contentType: jpeg }] : []),
    ...(capture.cutouts?.search ? [{ name: 'float-search.png', body: capture.cutouts.search, contentType: png }] : []),
    ...(capture.cutouts?.button ? [{ name: 'float-button.png', body: capture.cutouts.button, contentType: png }] : []),
    ...(capture.emptyPlate ? [{ name: 'page-empty.jpg', body: capture.emptyPlate, contentType: jpeg }] : []),
    ...(capture.logo ? [{ name: 'logo.png', body: capture.logo, contentType: png }] : []),
  ]
}

/** Uploads every image at once under the caller's prefix; returns its public URL by name. */
export async function storeCaptureImages(storage: CaptureStorage, userId: string, images: StoredImage[]): Promise<Map<string, string>> {
  const folder = `${sanitizeName(userId)}/motion-capture/${randomUUID()}`
  // Many pictures: upload eight at a time rather than all at once.
  const stored: Array<readonly [string, string]> = []
  let next = 0
  const lanes = Array.from({ length: Math.min(12, images.length) }, async () => {
    while (next < images.length) {
      const image = images[next++]
      const path = `${folder}/${image.name}`
      const { error } = await storage.upload(path, image.body, { contentType: image.contentType, upsert: false })
      if (error) throw new Error(`storage upload failed: ${error.message}`)
      const { data } = storage.getPublicUrl(path)
      if (!data?.publicUrl) throw new Error('storage returned no public URL')
      stored.push([image.name, data.publicUrl] as const)
    }
  })
  await Promise.all(lanes)
  return new Map(stored)
}

/** Neither a picture nor any words: nothing to build a film from. */
export const captureIsEmpty = (capture: PageCapture): boolean => !capture.page && !captureHasWords(capture)

/** The JSON the client receives, from a capture and the URLs its images were stored at. */
/** A picture the asset finder found on the site, stored under `name`. */
export interface StoredAssetInfo {
  name: string
  category: string
  alt: string
}

/** Stored file names of the asset finder's pictures: asset-1.jpg … */
export const assetFileName = (index: number, contentType: string) => `asset-${index + 1}.${contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : contentType === 'image/gif' ? 'gif' : 'jpg'}`

export function buildCaptureResponse(capture: PageCapture, urls: Map<string, string>, transient = false, assets: readonly StoredAssetInfo[] = []) {
  const at = (name: string) => urls.get(name) ?? null
  const width = CAPTURE_VIEWPORT.width * CAPTURE_DEVICE_SCALE
  let homePath = '/'
  try {
    homePath = new URL(capture.url).pathname || '/'
  } catch {
    // keep '/'
  }
  const routes = capture.routes ?? []
  const pages = [
    ...(capture.page ? [{ name: 'home', path: homePath, url: at('page.jpg')!, width, height: capture.pageHeight * CAPTURE_DEVICE_SCALE, layout: capture.layout ?? null }] : []),
    ...routes.map((r) => ({ name: r.name, path: r.path, url: at(`page-${sanitizeName(r.name)}.jpg`)!, width, height: r.pageHeight * CAPTURE_DEVICE_SCALE, layout: r.layout })),
  ]
  return {
    url: capture.url,
    title: capture.title,
    // No picture in time: the page is empty and `partial` says so (the words and colours are still here).
    page: pages[0] ? { url: pages[0].url, width, height: pages[0].height } : { url: '', width: 0, height: 0 },
    partial: !capture.page,
    pages,
    crops: capture.crops.map((_, i) => at(`crop-${i + 1}.jpg`)!),
    // What each crop shows (route, words, picture share, people, map), same order as `crops`.
    cropInfo: capture.cropInfo?.length === capture.crops.length ? capture.cropInfo : undefined,
    images: (capture.images ?? []).map((_, i) => at(`image-${i + 1}.jpg`)!),
    // The asset finder's pictures of the site (people, team, products…), with what each one shows.
    assets: assets.map((a) => ({ url: at(a.name), category: a.category, alt: a.alt })).filter((a): a is { url: string; category: string; alt: string } => Boolean(a.url)),
    logo: at('logo.png'),
    cutouts: { nav: at('nav.jpg'), search: at('float-search.png'), button: at('float-button.png') },
    emptyPlate: at('page-empty.jpg'),
    content: capture.content ?? null,
    brand: capture.brand,
    // The site's pages from its links (captured or not), for a targeted capture after the storyboard.
    links: (capture.links ?? []).slice(0, 80),
    transient,
  }
}

// ── Background capture jobs ────────────────────────────────────────────────

export type CaptureJob =
  | { state: 'running'; startedAt: string }
  | { state: 'done'; finishedAt: string; capture: ReturnType<typeof buildCaptureResponse> }
  | { state: 'error'; finishedAt: string; code: string; error: string; timing?: Record<string, number> }

/**
 * The whole background job (quick capture + upload) gets this long, then the worker writes a `timed out`
 * record — far inside the host's 15-minute limit for background functions (a run past it is killed and retried).
 */
export const WORKER_WATCHDOG_MS = 240_000
/** A record still `running` this long after it started belongs to a worker that died (memory, host limit). */
export const CAPTURE_JOB_STALE_MS = WORKER_WATCHDOG_MS + 15_000

export const CAPTURE_JOB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const jobPath = (userId: string, jobId: string) => `${sanitizeName(userId)}/motion-capture-jobs/${jobId}.json`

export async function writeCaptureJob(storage: CaptureStorage, userId: string, jobId: string, job: CaptureJob): Promise<void> {
  const { error } = await storage.upload(jobPath(userId, jobId), JSON.stringify(job), { contentType: 'application/json', upsert: true })
  if (error) throw new Error(`could not save the capture job: ${error.message}`)
}

/** The job's record, or null when this user has no such job. */
export async function readCaptureJob(storage: CaptureStorage, userId: string, jobId: string): Promise<CaptureJob | null> {
  if (!CAPTURE_JOB_ID.test(jobId)) return null
  const { data, error } = await storage.download(jobPath(userId, jobId))
  if (error || !data) return null
  try {
    const job = JSON.parse(await data.text()) as CaptureJob
    if (!job || typeof job !== 'object' || !('state' in job)) return null
    if (job.state === 'running' && Date.now() - Date.parse(job.startedAt) > CAPTURE_JOB_STALE_MS) {
      return { state: 'error', finishedAt: new Date().toISOString(), code: 'CAPTURE_STOPPED', error: 'The capture stopped before it finished (the server ran out of time or memory)' }
    }
    return job
  } catch {
    return null
  }
}
