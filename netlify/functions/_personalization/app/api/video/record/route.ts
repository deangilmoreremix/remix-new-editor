import { NextRequest, NextResponse } from '../../../../shims/next-server'
import { auth } from '../../../../shims/clerk-server'
import { createServerClient } from '../../../../src/lib/supabase'
import { logPersonalization, createCorrelationId } from '../../../../src/server/personalizationLog'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Records a generated video (e.g. a Full Body Recast) so the user's history
 * survives browser clears (see src/shared/personalization/supabaseGeneratedVideos.ts).
 * Writes one row to `generated_videos` (migration 20261031000000) owned by
 * the session's Clerk user. Body: `{ entry: GeneratedVideoEntry }`.
 */

const MAX_TEXT = 10_000

function text(value: unknown, max = MAX_TEXT): string | null {
  return typeof value === 'string' && value ? value.slice(0, max) : null
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const MAX_METADATA_BYTES = 20_000

/** Metadata as an object, dropped when it is too big to store. */
function boundedMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length <= MAX_METADATA_BYTES ? (value as Record<string, unknown>) : { truncated: true }
  } catch {
    return {}
  }
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const correlationId = createCorrelationId(req)
  const route = '/api/video/record'

  const { userId } = await auth()
  if (!userId) {
    logPersonalization({ route, stage: 'auth', httpStatus: 401, safeErrorCode: 'UNAUTHENTICATED', safeMessage: 'No authenticated user', correlationId })
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  }

  let entry: Record<string, unknown>
  try {
    const body = await req.json()
    entry = body && typeof body.entry === 'object' && body.entry ? body.entry : null
    if (!entry) throw new Error('missing entry')
  } catch {
    return NextResponse.json({ error: 'Expected { entry }.' }, { status: 400 })
  }

  if (!isHttpUrl(entry.video_url)) {
    return NextResponse.json({ error: 'entry.video_url must be an http(s) URL.' }, { status: 400 })
  }
  if (!text(entry.model) || typeof entry.prompt !== 'string') {
    return NextResponse.json({ error: 'entry.model and entry.prompt are required.' }, { status: 400 })
  }

  const row = {
    clerk_user_id: userId,
    project_id: text(entry.project_id, 200),
    client_id: text(entry.client_id, 200),
    source_type: text(entry.source_type, 100),
    source_media: text(entry.source_media, 2000),
    source_url: text(entry.source_url, 2000),
    personalization_mode: text(entry.personalization_mode, 100),
    model: text(entry.model, 200),
    prompt: String(entry.prompt).slice(0, MAX_TEXT),
    selected_asset_ids: Array.isArray(entry.selected_asset_ids) ? entry.selected_asset_ids.filter((id) => typeof id === 'string').slice(0, 100) : [],
    provider_job_id: text(entry.provider_job_id, 200),
    video_url: entry.video_url,
    storage_path: text(entry.storage_path, 2000),
    status: text(entry.status, 50) || 'completed',
    duration_seconds: num(entry.duration_seconds),
    aspect_ratio: text(entry.aspect_ratio, 20),
    resolution: text(entry.resolution, 20),
    quality: text(entry.quality, 50),
    effect: text(entry.effect, 100),
    metadata: boundedMetadata(entry.metadata),
  }

  try {
    const { data, error } = await createServerClient().from('generated_videos').insert(row).select('id').single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, id: (data as { id?: string } | null)?.id ?? null })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    logPersonalization({ route, stage: 'db-insert', httpStatus: 500, safeErrorCode: 'DB_INSERT_FAILED', safeMessage: message, correlationId })
    return NextResponse.json({ error: "Couldn't record the video." }, { status: 500 })
  }
}
