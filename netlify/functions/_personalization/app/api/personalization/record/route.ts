import { NextRequest, NextResponse } from '../../../../shims/next-server'
import { auth } from '../../../../shims/clerk-server'
import { createServerClient } from '../../../../src/lib/supabase'
import { logPersonalization, createCorrelationId, sanitizeForLog } from '../../../../src/server/personalizationLog'
import { requirePersonalizationEnv } from '../../../../src/server/envValidation'

export const dynamic = "force-dynamic";

export const runtime = 'nodejs'

const MAX_PAYLOAD_SIZE = 1_000_000
const MAX_STRING_LENGTH = 100_000
const MAX_ARRAY_LENGTH = 100

function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/sk-[a-zA-Z0-9]{20,}/g, '[REDACTED]')
    .replace(/AIza[a-zA-Z0-9_-]{35}/g, '[REDACTED]')
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/g, 'Bearer [REDACTED]')
}

function sanitizeValue(value: unknown, maxLength = MAX_STRING_LENGTH): unknown {
  if (typeof value === 'string') {
    return value.length > maxLength ? value.slice(0, maxLength) + '...' : value
  }
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_LENGTH).map((item) => sanitizeValue(item, maxLength))
  }
  if (value && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      sanitized[key] = sanitizeValue(val, maxLength)
    }
    return sanitized
  }
  return value
}

export async function POST(req: NextRequest) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30_000)
  const correlationId = createCorrelationId(req)
  const startTime = Date.now()

  try {
    const envCheck = requirePersonalizationEnv()
    if (!envCheck.valid) {
      clearTimeout(timeoutId)
      logPersonalization({
        route: '/api/personalization/record',
        stage: 'env-validation',
        httpStatus: 500,
        safeErrorCode: 'ENV_MISSING',
        safeMessage: `Missing required env vars: ${envCheck.missingRequired.join(', ')}`,
        correlationId,
      })
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { userId } = await auth()
    if (!userId) {
      clearTimeout(timeoutId)
      logPersonalization({
        route: '/api/personalization/record',
        stage: 'auth',
        httpStatus: 401,
        safeErrorCode: 'UNAUTHENTICATED',
        safeMessage: 'No authenticated user',
        correlationId,
      })
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
    }

    const contentLength = req.headers.get('content-length')
    if (contentLength && Number(contentLength) > MAX_PAYLOAD_SIZE) {
      clearTimeout(timeoutId)
      logPersonalization({
        route: '/api/personalization/record',
        stage: 'validation',
        httpStatus: 413,
        safeErrorCode: 'PAYLOAD_TOO_LARGE',
        safeMessage: 'Payload exceeds maximum size',
        correlationId,
      })
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      clearTimeout(timeoutId)
      logPersonalization({
        route: '/api/personalization/record',
        stage: 'parse-body',
        httpStatus: 400,
        safeErrorCode: 'INVALID_JSON',
        safeMessage: 'Invalid JSON body',
        correlationId,
      })
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const rawEntry =
      typeof (body as { entry?: unknown } | null | undefined)?.entry === 'object' &&
      (body as { entry?: unknown } | null | undefined)?.entry !== null
        ? ((body as { entry: unknown }).entry)
        : (body as unknown)
    if (!rawEntry || typeof rawEntry !== 'object') {
      clearTimeout(timeoutId)
      logPersonalization({
        route: '/api/personalization/record',
        stage: 'validation',
        httpStatus: 400,
        safeErrorCode: 'INVALID_PAYLOAD',
        safeMessage: 'Missing entry object',
        correlationId,
      })
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const entry = sanitizeValue(rawEntry) as Record<string, unknown>

    const allowedStringFields = [
      'originStudio', 'sourceType', 'sourceDemoId', 'sourceDemoSlug',
      'viralRecordId', 'sourceMedia', 'sourceUrl', 'personalizationMode',
      'model', 'originalPrompt', 'personalizedPrompt', 'outputType',
    ]

    const sanitizedEntry: Record<string, unknown> = {}
    for (const field of allowedStringFields) {
      if (field in entry) {
        const value = entry[field]
        sanitizedEntry[field] = typeof value === 'string' ? value.slice(0, MAX_STRING_LENGTH) : null
      }
    }

    const arrayFields = [
      'identityAssetIds', 'logoAssetIds', 'productAssetIds',
      'brandReferenceAssetIds', 'outputUrls',
    ]
    for (const field of arrayFields) {
      if (field in entry) {
        const value = entry[field]
        sanitizedEntry[field] = Array.isArray(value) ? value.slice(0, MAX_ARRAY_LENGTH) : []
      }
    }

    sanitizedEntry.first_frame_asset_id = typeof entry.firstFrameAssetId === 'string' ? entry.firstFrameAssetId.slice(0, 100) : null
    sanitizedEntry.last_frame_asset_id = typeof entry.lastFrameAssetId === 'string' ? entry.lastFrameAssetId.slice(0, 100) : null
    sanitizedEntry.client_id = typeof entry.clientId === 'string' ? entry.clientId.slice(0, 100) : null

    const supabase = createServerClient()

    await supabase.rpc('set_config', {
      setting: 'app.clerk_user_id',
      value: userId,
      is_local: true,
    })

    const { data, error } = await supabase
      .from('smartvideo_go_personalization_outputs')
      .insert({
        clerk_user_id: userId,
        origin_studio: sanitizedEntry.originStudio || 'demo-personalization',
        source_type: sanitizedEntry.sourceType || 'unknown',
        source_demo_id: sanitizedEntry.sourceDemoId || null,
        source_demo_slug: sanitizedEntry.sourceDemoSlug || null,
        viral_record_id: sanitizedEntry.viralRecordId || null,
        source_media: sanitizedEntry.sourceMedia || null,
        source_url: sanitizedEntry.sourceUrl || null,
        personalization_mode: sanitizedEntry.personalizationMode || null,
        model: sanitizedEntry.model || null,
        original_prompt: sanitizedEntry.originalPrompt || '',
        personalized_prompt: sanitizedEntry.personalizedPrompt || '',
        identity_asset_ids: sanitizedEntry.identityAssetIds || [],
        logo_asset_ids: sanitizedEntry.logoAssetIds || [],
        product_asset_ids: sanitizedEntry.productAssetIds || [],
        brand_reference_asset_ids: sanitizedEntry.brandReferenceAssetIds || [],
        first_frame_asset_id: sanitizedEntry.first_frame_asset_id,
        last_frame_asset_id: sanitizedEntry.last_frame_asset_id,
        output_urls: sanitizedEntry.outputUrls || [],
        output_type: sanitizedEntry.outputType || 'prompt',
        client_id: sanitizedEntry.client_id,
      })
      .select('id, created_at')
      .single()

    clearTimeout(timeoutId)

    if (error) {
      const safeMessage = sanitizeErrorMessage(error.message)
      logPersonalization({
        route: '/api/personalization/record',
        stage: 'db-insert',
        provider: 'supabase',
        httpStatus: 500,
        safeErrorCode: 'DB_INSERT_FAILED',
        safeMessage,
        correlationId,
        durationMs: Date.now() - startTime,
      })
      return NextResponse.json({ error: safeMessage }, { status: 500 })
    }

    logPersonalization({
      route: '/api/personalization/record',
      stage: 'db-insert',
      provider: 'supabase',
      httpStatus: 200,
      correlationId,
      durationMs: Date.now() - startTime,
    })

    return NextResponse.json({ ok: true, data })
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      logPersonalization({
        route: '/api/personalization/record',
        stage: 'request',
        httpStatus: 504,
        safeErrorCode: 'TIMEOUT',
        safeMessage: 'Request timed out',
        correlationId,
        durationMs: Date.now() - startTime,
      })
      return NextResponse.json({ error: 'Request timed out' }, { status: 504 })
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    logPersonalization({
      route: '/api/personalization/record',
      stage: 'unhandled',
      httpStatus: 500,
      safeErrorCode: 'UNEXPECTED_ERROR',
      safeMessage: sanitizeErrorMessage(message),
      correlationId,
      durationMs: Date.now() - startTime,
    })
    return NextResponse.json(
      { error: sanitizeErrorMessage(message) },
      { status: 500 }
    )
  }
}
