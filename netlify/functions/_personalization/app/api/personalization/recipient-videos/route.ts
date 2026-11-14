import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from '../../../../shims/next-server'
import { auth } from '../../../../shims/clerk-server'
import { createServerClient } from '../../../../src/lib/supabase'
import { logPersonalization, createCorrelationId } from '../../../../src/server/personalizationLog'
import { requirePersonalizationEnv } from '../../../../src/server/envValidation'
import { rateLimit, rateLimit429, resolveRateLimitKey } from '../../../../lib/rateLimit'
// @ts-expect-error — plain ES module shared with the public recipient-video function (dependency-free)
import { isObjectPath, objectSize, removeObject, signUpload } from '../../../../../_storage/signedUrls.js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Per-recipient videos in the PRIVATE `recipient-videos` bucket (owner side).
 *
 *   POST { action: 'upload-url', videoId, linkId, contentType, bytes }  -> { ok, uploadUrl, path }   a signed URL to PUT ONE file to
 *   POST { action: 'register', videoId, linkId, path }                  -> { ok, bytes }             record it (size read from Storage)
 *   GET  ?videoId=<id>                                                  -> { ok, videos: [{ linkId, bytes, contentType, createdAt }] }
 *   DELETE ?linkId=<uuid>                                               -> { ok, removed }
 *
 * Ownership comes from the verified Clerk session; the database checks that the link is the caller's, for that video, and live (a link
 * that is not yours reads as "not found"). The object path is made HERE (<video>/<link>/<random>.<ext>): nothing trusts a client path.
 * The service key stays on the server; the browser only receives a signed URL. Migration: 20261118000000_recipient_videos.sql
 * (NOT applied to production by this change).
 */
const ROUTE = '/api/personalization/recipient-videos'
const VIDEO_ID = /^[A-Za-z0-9_-]{8,32}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_BYTES = 209_715_200
const EXT: Record<string, string> = { 'video/mp4': 'mp4', 'video/webm': 'webm' }
const env = () => process.env as Record<string, string | undefined>
const storageCfg = () => { const e = env(); const url = String(e.SUPABASE_URL || e.VITE_SUPABASE_URL || '').replace(/\/$/, ''); const key = e.SUPABASE_SERVICE_ROLE_KEY || ''; return url && key ? { url, key } : null }

async function guard(req: NextRequest): Promise<{ userId: string; correlationId: string } | Response> {
  const correlationId = createCorrelationId(req)
  if (!requirePersonalizationEnv().valid) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  return { userId, correlationId }
}
const dbFail = (stage: string, message: unknown, correlationId: string) => {
  logPersonalization({ route: ROUTE, stage, provider: 'supabase', httpStatus: 502, safeErrorCode: 'DB_RECIPIENT_VIDEO_FAILED', safeMessage: String(message ?? '').slice(0, 200), correlationId })
  return NextResponse.json({ error: 'Something went wrong. Nothing was changed.', correlationId }, { status: 502 })
}

export async function POST(req: NextRequest) {
  const g = await guard(req); if (g instanceof Response) return g
  const cfg = storageCfg()
  if (!cfg) return NextResponse.json({ error: 'NOT_CONFIGURED', message: 'Video storage is not set up on this server.' }, { status: 503 })
  const limit = rateLimit(resolveRateLimitKey(g.userId, null), { windowMs: 3_600_000, max: 600 })
  if (!limit.allowed) return rateLimit429(limit.retryAfterMs)
  let body: Record<string, any>
  try { const text = await req.text(); if (text.length > 4096) return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 }); body = JSON.parse(text) } catch { return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 }) }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  const { videoId, linkId } = body
  if (typeof videoId !== 'string' || !VIDEO_ID.test(videoId) || typeof linkId !== 'string' || !UUID.test(linkId)) return NextResponse.json({ error: 'INVALID_IDS' }, { status: 400 })
  const db = createServerClient()

  if (body.action === 'upload-url') {
    const ext = typeof body.contentType === 'string' ? EXT[body.contentType] : undefined
    if (!ext) return NextResponse.json({ error: 'INVALID_TYPE', message: 'Only MP4 or WebM videos can be uploaded.' }, { status: 400 })
    if (!Number.isInteger(body.bytes) || body.bytes < 1 || body.bytes > MAX_BYTES) return NextResponse.json({ error: 'INVALID_SIZE', message: 'A video must be between 1 byte and 200 MB.' }, { status: 400 })
    const ok = await db.rpc('recipient_video_prepare', { p_owner: g.userId, p_video_id: videoId, p_link_id: linkId })
    if (ok.error) return dbFail('prepare', ok.error.message, g.correlationId)
    if (ok.data !== true) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
    const path = `${videoId}/${linkId}/${randomBytes(16).toString('hex')}.${ext}`
    try { const uploadUrl = await signUpload(cfg, path); return NextResponse.json({ ok: true, uploadUrl, path, contentType: body.contentType }, { headers: { 'Cache-Control': 'no-store' } }) }
    catch (e) { return dbFail('sign-upload', (e as Error).message, g.correlationId) }
  }

  if (body.action === 'register') {
    const path = body.path
    if (!isObjectPath(path) || path.split('/')[0] !== videoId || path.split('/')[1] !== linkId) return NextResponse.json({ error: 'INVALID_PATH' }, { status: 400 })
    const size = await objectSize(cfg, path).catch(() => null)
    if (!size || size > MAX_BYTES) return NextResponse.json({ error: 'NOT_UPLOADED', message: 'The video was not found in storage. Upload it again.' }, { status: 409 })
    const type = path.endsWith('.webm') ? 'video/webm' : 'video/mp4'
    const r = await db.rpc('recipient_video_register', { p_owner: g.userId, p_video_id: videoId, p_link_id: linkId, p_path: path, p_type: type, p_bytes: size })
    if (r.error) { if ((r.error as { code?: string }).code === 'P0002') return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 }); return dbFail('register', r.error.message, g.correlationId) }
    if (typeof r.data === 'string' && r.data) await removeObject(cfg, r.data).catch(() => false) // the replaced file is deleted, not left behind
    return NextResponse.json({ ok: true, bytes: size })
  }
  return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400 })
}

export async function GET(req: NextRequest) {
  const g = await guard(req); if (g instanceof Response) return g
  const videoId = new URL(req.url).searchParams.get('videoId') ?? ''
  if (!VIDEO_ID.test(videoId)) return NextResponse.json({ error: 'INVALID_VIDEO_ID' }, { status: 400 })
  const { data, error } = await createServerClient().rpc('recipient_videos_list', { p_owner: g.userId, p_video_id: videoId })
  if (error) return dbFail('list', error.message, g.correlationId)
  const videos = (Array.isArray(data) ? data : []).map((v: any) => ({ linkId: v.recipient_link_id, bytes: Number(v.bytes) || 0, contentType: v.content_type, createdAt: v.created_at }))
  return NextResponse.json({ ok: true, videos }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(req: NextRequest) {
  const g = await guard(req); if (g instanceof Response) return g
  const linkId = new URL(req.url).searchParams.get('linkId') ?? ''
  if (!UUID.test(linkId)) return NextResponse.json({ error: 'INVALID_ID' }, { status: 400 })
  const { data, error } = await createServerClient().rpc('recipient_video_remove', { p_owner: g.userId, p_link_id: linkId })
  if (error) return dbFail('remove', error.message, g.correlationId)
  const cfg = storageCfg(); if (typeof data === 'string' && data && cfg) await removeObject(cfg, data).catch(() => false)
  return NextResponse.json({ ok: true, removed: typeof data === 'string' && Boolean(data) })
}
