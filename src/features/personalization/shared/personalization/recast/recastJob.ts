/**
 * Full Body Recast (Advanced Editing → "Full Body Recast" tab).
 *
 * Follows open-genjutsu: a 4–30 s source performance clip plus one character
 * photo go to MuAPI `seedance-2.5-motion-control` as a single request. The
 * model keeps the clip's movement, camera and location and swaps in the
 * person. The request id is stored as soon as it is known, so a recast keeps
 * going when the user changes tab or closes the modal, and resumes after a
 * page reload.
 */

export const RECAST_MODEL = 'seedance-2.5-motion-control'
export const RECAST_MIN_SECONDS = 4
export const RECAST_MAX_SECONDS = 30
export const RECAST_MAX_VIDEO_BYTES = 50 * 1024 * 1024
/** A stored running job older than this is reported as timed out. */
export const RECAST_MAX_RUN_MS = 60 * 60 * 1000
const RECAST_VIDEO_TYPES = ['video/mp4', 'video/quicktime']
const STORAGE_PREFIX = 'pz_recast_job:'
const VIDEOS_PREFIX = 'pz_recast_videos:'

export type RecastStatus = 'running' | 'done' | 'error' | 'cancelled'

export interface RecastJob {
  id: string
  sourceId: string
  /** Who started it (see recastOwnerKey); a job is only restored for its owner. */
  ownerKey: string
  status: RecastStatus
  requestId: string
  sourceUrl: string
  sourceLabel: string
  identityId: string
  identityName: string
  identityUrl: string
  duration: number
  prompt: string
  startedAt: number
  finishedAt: number
  resultUrl: string
  error: string
  /** True once the result was applied as the video and saved to the client. */
  applied: boolean
}

export interface StartRecastInput {
  sourceId: string
  ownerKey: string
  sourceUrl: string
  sourceLabel: string
  identityId: string
  identityName: string
  identityUrl: string
  duration: number
  prompt?: string
}

export function clampRecastDuration(seconds: number): number {
  const value = Math.round(Number(seconds) || 0)
  return Math.max(RECAST_MIN_SECONDS, Math.min(RECAST_MAX_SECONDS, value || RECAST_MIN_SECONDS))
}

/** Type and size checks; duration is checked once the browser read the clip. */
export function validateRecastClipFile(file: { type?: string; size?: number; name?: string } | null): string {
  if (!file) return 'Choose a performance clip.'
  const type = String(file.type || '').toLowerCase()
  const typeOk = RECAST_VIDEO_TYPES.includes(type) || (!type && /\.(mp4|mov)$/i.test(file.name || ''))
  if (!typeOk) return 'Use an MP4 or MOV clip.'
  if (!file.size) return 'The selected clip is empty.'
  if (file.size > RECAST_MAX_VIDEO_BYTES) return 'The clip is over the 50 MB limit.'
  return ''
}

export function validateRecastDuration(seconds: number): string {
  const value = Number(seconds)
  if (!Number.isFinite(value) || value <= 0) return 'Could not read the clip length.'
  if (value < RECAST_MIN_SECONDS) return `The clip must be at least ${RECAST_MIN_SECONDS} seconds.`
  if (value > RECAST_MAX_SECONDS + 0.5) return `The clip must be ${RECAST_MAX_SECONDS} seconds or shorter.`
  return ''
}

/** Reads a video's length in seconds from its metadata. */
export function readVideoDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.onloadedmetadata = () => {
      const { duration } = video
      video.removeAttribute('src')
      video.load()
      resolve(duration)
    }
    video.onerror = () => reject(new Error('This clip could not be read. Try an MP4 (H.264) file.'))
    video.src = url
  })
}

/** Parameters for `processMotionControl` (packages/studio/src/muapi.js). */
export function buildRecastParams(job: Pick<RecastJob, 'sourceUrl' | 'identityUrl' | 'duration' | 'prompt'>) {
  return {
    model: RECAST_MODEL,
    video_url: job.sourceUrl,
    images_list: [job.identityUrl],
    aspect_ratio: 'adaptive',
    duration: clampRecastDuration(job.duration),
    generate_audio: false,
    prompt: job.prompt?.trim() || undefined,
  }
}

export function createRecastJob(input: StartRecastInput): RecastJob {
  return {
    id: `recast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sourceId: input.sourceId,
    ownerKey: input.ownerKey,
    status: 'running',
    requestId: '',
    sourceUrl: input.sourceUrl,
    sourceLabel: input.sourceLabel,
    identityId: input.identityId,
    identityName: input.identityName,
    identityUrl: input.identityUrl,
    duration: clampRecastDuration(input.duration),
    prompt: input.prompt?.trim() || '',
    startedAt: Date.now(),
    finishedAt: 0,
    resultUrl: '',
    error: '',
    applied: false,
  }
}

/**
 * A short, non-reversible key for the signed-in user (the scope can be an API
 * key, which must not appear in storage key names). Jobs and saved recast
 * videos are stored per owner, so another account in the same browser never
 * picks them up.
 */
export function recastOwnerKey(scope: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < scope.length; i += 1) {
    hash ^= scope.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(36)
}

function storageKey(ownerKey: string, sourceId: string): string {
  return `${STORAGE_PREFIX}${ownerKey}:${sourceId}`
}

export function loadRecastJob(sourceId: string, ownerKey: string): RecastJob | null {
  if (!sourceId || !ownerKey || typeof window === 'undefined') return null
  try {
    // Jobs stored before they had an owner can't be attributed: drop them.
    localStorage.removeItem(`${STORAGE_PREFIX}${sourceId}`)
    const parsed = JSON.parse(localStorage.getItem(storageKey(ownerKey, sourceId)) || 'null')
    if (!parsed || typeof parsed !== 'object' || typeof parsed.id !== 'string') return null
    return parsed.ownerKey === ownerKey ? (parsed as RecastJob) : null
  } catch {
    return null
  }
}

export function saveRecastJob(job: RecastJob): void {
  if (typeof window === 'undefined' || !job.ownerKey) return
  try {
    localStorage.setItem(storageKey(job.ownerKey, job.sourceId), JSON.stringify(job))
  } catch {
    // The job keeps running in memory; it just won't survive a reload.
  }
}

export function clearRecastJob(sourceId: string, ownerKey: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(storageKey(ownerKey, sourceId))
  } catch {
    // Nothing stored.
  }
}

/** A finished recast kept for reuse (Saved recast videos), per owner and demo. */
export interface SavedRecastVideo {
  id: string
  url: string
  name: string
  /** The performance clip it was made from, so its sound can be kept. */
  sourceUrl?: string
}

export function loadRecastVideos(sourceId: string, ownerKey: string): SavedRecastVideo[] {
  if (!sourceId || !ownerKey || typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(localStorage.getItem(`${VIDEOS_PREFIX}${ownerKey}:${sourceId}`) || '[]')
    return Array.isArray(parsed)
      ? parsed
          .filter((v): v is SavedRecastVideo => v && typeof v.id === 'string' && typeof v.url === 'string' && /^https?:\/\//.test(v.url))
          // Only a stored (http) clip can be played again after a reload.
          .map((v) => (typeof v.sourceUrl === 'string' && /^https?:\/\//.test(v.sourceUrl) ? v : { id: v.id, url: v.url, name: v.name }))
      : []
  } catch {
    return []
  }
}

export function saveRecastVideos(sourceId: string, ownerKey: string, videos: SavedRecastVideo[]): void {
  if (!sourceId || !ownerKey || typeof window === 'undefined') return
  try {
    localStorage.setItem(`${VIDEOS_PREFIX}${ownerKey}:${sourceId}`, JSON.stringify(videos.slice(-20)))
  } catch {
    // Kept in memory only.
  }
}

/** What to do with a job found in storage when the modal (re)opens. */
export function restoredRecastJob(job: RecastJob, now = Date.now()): { job: RecastJob; resume: boolean } {
  if (job.status !== 'running') return { job, resume: false }
  if (!job.requestId) {
    return {
      job: { ...job, status: 'error', error: 'The page closed before the recast started. Try again.', finishedAt: now },
      resume: false,
    }
  }
  if (now - job.startedAt > RECAST_MAX_RUN_MS) {
    return { job: { ...job, status: 'error', error: 'Timed out waiting for the recast.', finishedAt: now }, resume: false }
  }
  return { job, resume: true }
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
