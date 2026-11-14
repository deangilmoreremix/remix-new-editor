/**
 * Uploads each recipient's rendered video to the PRIVATE bucket (follow-up to Stage 10). The browser never holds a storage key: the
 * server checks that the link is yours, makes the object path and returns a signed URL for that one path; the browser PUTs the file
 * there, then asks the server to record it (the server reads the size from storage). Never throws: every outcome is typed.
 */
export const RECIPIENT_VIDEOS_API = '/api/personalization/recipient-videos'
export type UploadFailure = 'unauthenticated' | 'not-found' | 'not-configured' | 'invalid' | 'rate-limited' | 'upload-failed' | 'not-recorded' | 'unavailable'
export type UploadResult = { ok: true; bytes: number } | { ok: false; reason: UploadFailure; message: string }
export const MAX_VIDEO_BYTES = 209_715_200

const MESSAGES: Record<UploadFailure, string> = {
  unauthenticated: 'Sign in to upload videos.',
  'not-found': 'That personal link was not found (it may be revoked). Make a new link first.',
  'not-configured': 'Private video storage is not set up on this server yet.',
  invalid: 'That video cannot be uploaded (MP4 or WebM, up to 200 MB).',
  'rate-limited': 'Too many uploads. Wait a minute and try again.',
  'upload-failed': 'The upload did not complete. Nothing was recorded.',
  'not-recorded': 'The video was uploaded but could not be recorded. Try again.',
  unavailable: 'Video storage is not available right now.',
}
const fail = (reason: UploadFailure): UploadResult => ({ ok: false, reason, message: MESSAGES[reason] })
const reasonFor = (status: number): UploadFailure => (status === 401 || status === 403 ? 'unauthenticated' : status === 404 ? 'not-found' : status === 503 ? 'not-configured' : status === 429 ? 'rate-limited' : status === 400 || status === 413 ? 'invalid' : 'unavailable')

async function post(fetchFn: typeof fetch, body: unknown): Promise<{ status: number; json: Record<string, any> | null } | null> {
  try { const r = await fetchFn(RECIPIENT_VIDEOS_API, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); let json: Record<string, any> | null = null; try { json = await r.json() } catch { json = null } return { status: r.status, json } } catch { return null }
}

export async function uploadRecipientVideo(videoId: string, linkId: string, file: Blob, fetchFn: typeof fetch = fetch): Promise<UploadResult> {
  const type = file.type === 'video/webm' ? 'video/webm' : file.type === 'video/mp4' ? 'video/mp4' : ''
  if (!type || file.size < 1 || file.size > MAX_VIDEO_BYTES) return fail('invalid')
  const a = await post(fetchFn, { action: 'upload-url', videoId, linkId, contentType: type, bytes: file.size })
  if (!a) return fail('unavailable'); if (a.status !== 200 || !a.json?.ok || typeof a.json.uploadUrl !== 'string' || typeof a.json.path !== 'string') return fail(reasonFor(a.status))
  if (!/^https:\/\//.test(a.json.uploadUrl)) return fail('unavailable')
  try {
    // The same form Supabase's own client uses for a signed upload.
    const form = new FormData(); form.append('cacheControl', '3600'); form.append('', file)
    const put = await fetchFn(a.json.uploadUrl, { method: 'PUT', body: form, headers: { 'x-upsert': 'false' } })
    if (!put.ok) return fail('upload-failed')
  } catch { return fail('upload-failed') }
  const r = await post(fetchFn, { action: 'register', videoId, linkId, path: a.json.path })
  if (!r) return fail('not-recorded'); if (r.status !== 200 || !r.json?.ok) return fail(r.status === 404 ? 'not-found' : 'not-recorded')
  return { ok: true, bytes: Number(r.json.bytes) || file.size }
}

export async function removeRecipientVideo(linkId: string, fetchFn: typeof fetch = fetch): Promise<boolean> {
  try { const r = await fetchFn(`${RECIPIENT_VIDEOS_API}?linkId=${encodeURIComponent(linkId)}`, { method: 'DELETE', credentials: 'same-origin' }); return r.status === 200 } catch { return false }
}
