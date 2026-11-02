import { NextRequest, NextResponse } from '../../../../shims/next-server'
import { auth } from '../../../../shims/clerk-server'
import { createServerClient } from '../../../../src/lib/supabase'
import { logPersonalization, createCorrelationId } from '../../../../src/server/personalizationLog'
import { requirePersonalizationEnv } from '../../../../src/server/envValidation'

export const runtime = 'nodejs'

const MAX_PAYLOAD_SIZE = 5_000_000
const MAX_STRING_LENGTH = 500_000

/**
 * How the list branch narrowed its rows.
 *
 * - `not-requested` — no `sourceId` was supplied; the caller's full list is returned.
 * - `applied`      — the rows carried a source identifier and the matching one was kept.
 * - `unavailable`  — NO row carried a source identifier, so the filter could not be
 *                    applied and the unfiltered list is returned (degraded mode).
 */
type SourceFilterState = 'not-requested' | 'applied' | 'unavailable'

/**
 * Read the source demo id out of a saved-project row.
 *
 * EVIDENCE (do not "fix" this by guessing a column name):
 *   `personalization_saved_projects_list` is declared as
 *     `returns setof public.personalization_saved_projects`
 *   in `supabase/migrations/20261013000000_personalization_saved_projects.sql:109-127`
 *   and the table's columns (same file, lines 45-61) are:
 *     id, clerk_user_id, source, client, assets, prompt, generation,
 *     output_type, mode, status, error_message, created_at, updated_at
 *   There is NO `sourceDemoId` and NO `source_demo_id` column. The source demo id
 *   lives INSIDE the `source` jsonb payload, as `source->>'id'` (the jsonb is the
 *   `PersonalizationSource` object, whose `id` field is the demo id — see
 *   `src/shared/personalization/types.ts:18-36`).
 *
 * A filter that assumed a top-level `sourceDemoId` column therefore dropped EVERY
 * row and made the restore silently answer "no saved project" — the same
 * user-visible symptom as the `400 MISSING_PROJECT_ID`, only quieter. The lookup
 * below therefore probes every location the id can legitimately live in, and the
 * caller degrades to the unfiltered list when none of them is present.
 */
/**
 * True when Supabase reports that an RPC does not exist — PostgREST answers
 * `PGRST202` for an unknown function, Postgres `42883` for an undefined one.
 * Used to fall back to the plain list while a migration is not yet applied.
 */
function isMissingFunctionError(error: { code?: string | null; message?: string | null }): boolean {
  if (error.code === 'PGRST202' || error.code === '42883') return true
  return /could not find the function|function .* does not exist/i.test(error.message ?? '')
}

function readSourceDemoId(row: unknown): string | null {
  if (!row || typeof row !== 'object') return null
  const record = row as Record<string, unknown>

  // Top-level columns (today: none exist, but a future migration may add one).
  for (const key of ['sourceDemoId', 'source_demo_id']) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }

  // The real location: the `source` jsonb column.
  const source = record.source
  if (source && typeof source === 'object') {
    const sourceRecord = source as Record<string, unknown>
    for (const key of ['id', 'demoId', 'demo_id', 'sourceDemoId', 'source_demo_id']) {
      const value = sourceRecord[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
  }

  return null
}

function sanitizeValue(value: unknown, maxLength = MAX_STRING_LENGTH): unknown {
  if (typeof value === 'string') {
    return value.length > maxLength ? value.slice(0, maxLength) + '...' : value
  }
  if (Array.isArray(value)) {
    return value.slice(0, 1_000).map((item) => sanitizeValue(item, maxLength))
  }
  if (value && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      sanitized[key] = sanitizeValue(val, maxLength)
    }
    return sanitized
  }
  return value
}

export async function GET(req: NextRequest) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30_000)
  const correlationId = createCorrelationId(req)
  const startTime = Date.now()

  try {
    const envCheck = requirePersonalizationEnv()
    if (!envCheck.valid) {
      clearTimeout(timeoutId)
      logPersonalization({
        route: '/api/personalization/project',
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
        route: '/api/personalization/project',
        stage: 'auth',
        httpStatus: 401,
        safeErrorCode: 'UNAUTHENTICATED',
        safeMessage: 'No authenticated user',
        correlationId,
      })
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
    }

    const projectId = req.nextUrl.searchParams.get('id')
    const list = req.nextUrl.searchParams.get('list')
    const sourceId = req.nextUrl.searchParams.get('sourceId')

    const supabase = createServerClient()

    if (list === 'true') {
      // The identity is passed as an RPC argument and set as the GUC inside
      // the same transaction, so the RLS predicate and the where-clause agree.
      //
      // A source-scoped request uses the source-scoped RPC, which filters on
      // `source->>'id'` BEFORE its row limit — the plain list returns only the
      // caller's 50 newest rows, so filtering it afterwards loses any source
      // whose latest row is older than that. If the function is not deployed
      // yet (migration 20261024000000 not applied), fall back to the plain
      // list; the route filter below still narrows it.
      const wantedSource = sourceId?.trim() || ''
      let { data, error } = wantedSource
        ? await supabase.rpc('personalization_saved_projects_list_by_source', {
            p_clerk_user_id: userId,
            p_source_id: wantedSource,
          })
        : await supabase.rpc('personalization_saved_projects_list', { p_clerk_user_id: userId })
      if (wantedSource && error && isMissingFunctionError(error)) {
        ;({ data, error } = await supabase
          .rpc('personalization_saved_projects_list', { p_clerk_user_id: userId }))
      }

      clearTimeout(timeoutId)

      if (error) {
        logPersonalization({
          route: '/api/personalization/project',
          stage: 'db-list',
          provider: 'supabase',
          httpStatus: 500,
          safeErrorCode: 'DB_LIST_FAILED',
          safeMessage: error.message,
          correlationId,
          durationMs: Date.now() - startTime,
        })
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      // Source filter — a second, defensive pass. The source-scoped RPC has
      // already filtered in SQL; on the plain-list fallback this is the only
      // filter. The DB still
      // returns only the caller's rows; this just narrows to the requested
      // demo and still surfaces the empty-array 200 shape so the restore path
      // can take its normal "no durable row" branch instead of 400-ing.
      //
      // The filter is TOLERANT on purpose: if no returned row carries a source
      // identifier (i.e. the column we look for is not what the RPC returns),
      // the unfiltered list is returned and the response says so via
      // `sourceFilter: 'unavailable'`. Returning an empty list because a column
      // name was wrong is indistinguishable from "the user never saved this
      // project" and silently breaks the restore.
      const rows = Array.isArray(data) ? data : data ? [data] : []
      let filtered = rows
      let sourceFilter: SourceFilterState = 'not-requested'

      if (sourceId && sourceId.trim()) {
        const wanted = sourceId.trim()
        const rowsWithSource = rows.map((row) => ({ row, source: readSourceDemoId(row) }))
        const anyRowCarriesSource = rowsWithSource.some((entry) => entry.source !== null)

        if (!anyRowCarriesSource) {
          // Degraded mode — the rows carry no source identifier at all, so the
          // requested demo cannot be matched. Return the caller's own rows
          // unchanged rather than an empty list that would look like a lost
          // project.
          sourceFilter = 'unavailable'
          filtered = rows
        } else {
          sourceFilter = 'applied'
          filtered = rowsWithSource
            .filter((entry) => entry.source === wanted)
            .map((entry) => entry.row)
        }
      }

      logPersonalization({
        route: '/api/personalization/project',
        stage: 'db-list',
        provider: 'supabase',
        httpStatus: 200,
        ...(sourceFilter === 'unavailable'
          ? {
              safeErrorCode: 'SOURCE_FILTER_UNAVAILABLE',
              safeMessage:
                'Saved-project rows carry no source identifier; the unfiltered list was returned',
            }
          : {}),
        correlationId,
        durationMs: Date.now() - startTime,
      })

      return NextResponse.json({ projects: filtered, sourceFilter })
    }

    if (!projectId) {
      clearTimeout(timeoutId)
      logPersonalization({
        route: '/api/personalization/project',
        stage: 'validation',
        httpStatus: 400,
        safeErrorCode: 'MISSING_PROJECT_ID',
        safeMessage: 'Missing project id parameter',
        correlationId,
      })
      return NextResponse.json({ error: 'Missing project id parameter' }, { status: 400 })
    }

    const { data, error } = await supabase
      .rpc('personalization_saved_projects_get', {
        p_id: projectId,
        p_clerk_user_id: userId,
      })

    clearTimeout(timeoutId)

    if (error) {
      logPersonalization({
        route: '/api/personalization/project',
        stage: 'db-fetch',
        provider: 'supabase',
        httpStatus: error.code === 'PGRST116' ? 404 : 500,
        safeErrorCode: error.code === 'PGRST116' ? 'PROJECT_NOT_FOUND' : 'DB_FETCH_FAILED',
        safeMessage: error.message,
        correlationId,
        durationMs: Date.now() - startTime,
      })
      return NextResponse.json(
        { error: error.code === 'PGRST116' ? 'Project not found' : error.message },
        { status: error.code === 'PGRST116' ? 404 : 500 }
      )
    }

    // `returns setof` yields an array; a caller probing someone else's id gets
    // an empty set, which is reported as 404 rather than as a 403 that would
    // confirm the row exists.
    const project = Array.isArray(data) ? data[0] : data
    if (!project) {
      logPersonalization({
        route: '/api/personalization/project',
        stage: 'db-fetch',
        provider: 'supabase',
        httpStatus: 404,
        safeErrorCode: 'PROJECT_NOT_FOUND',
        safeMessage: 'No project for this owner',
        correlationId,
        durationMs: Date.now() - startTime,
      })
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    logPersonalization({
      route: '/api/personalization/project',
      stage: 'db-fetch',
      provider: 'supabase',
      httpStatus: 200,
      correlationId,
      durationMs: Date.now() - startTime,
    })

    return NextResponse.json({ project })
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      logPersonalization({
        route: '/api/personalization/project',
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
      route: '/api/personalization/project',
      stage: 'unhandled',
      httpStatus: 500,
      safeErrorCode: 'UNEXPECTED_ERROR',
      safeMessage: message,
      correlationId,
      durationMs: Date.now() - startTime,
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
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
        route: '/api/personalization/project',
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
        route: '/api/personalization/project',
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
        route: '/api/personalization/project',
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
        route: '/api/personalization/project',
        stage: 'parse-body',
        httpStatus: 400,
        safeErrorCode: 'INVALID_JSON',
        safeMessage: 'Invalid JSON body',
        correlationId,
      })
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const rawProject = typeof (body as { project?: unknown } | null | undefined)?.project === 'object'
      ? ((body as { project: unknown }).project)
      : body

    if (!rawProject || typeof rawProject !== 'object') {
      clearTimeout(timeoutId)
      logPersonalization({
        route: '/api/personalization/project',
        stage: 'validation',
        httpStatus: 400,
        safeErrorCode: 'INVALID_PAYLOAD',
        safeMessage: 'Missing project object',
        correlationId,
      })
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const project = sanitizeValue(rawProject) as Record<string, unknown>
    const projectId = typeof project.id === 'string' ? project.id : undefined

    const source = sanitizeValue(project.source || {}) as Record<string, unknown>
    const client = sanitizeValue(project.client || {}) as Record<string, unknown>
    const assets = sanitizeValue(project.assets || {}) as Record<string, unknown>
    const prompt = sanitizeValue(project.prompt || {}) as Record<string, unknown>
    const generation = sanitizeValue(project.generation || {}) as Record<string, unknown>

    const supabase = createServerClient()

    // Upsert through the SECURITY DEFINER RPC: the identity and the write share
    // one transaction, and ownership of an existing row is re-asserted inside
    // the database rather than trusted from the caller.
    const { data: upserted, error } = await supabase
      .rpc('personalization_saved_projects_upsert', {
        p_id: projectId ?? null,
        p_clerk_user_id: userId,
        p_source: source as never,
        p_client: client as never,
        p_assets: assets as never,
        p_prompt: prompt as never,
        p_generation: generation as never,
        p_output_type: typeof project.outputType === 'string' ? project.outputType : 'prompt',
        p_mode: typeof project.mode === 'string' ? project.mode : null,
        p_status: typeof project.status === 'string' ? project.status : 'idle',
        p_error_message: typeof project.errorMessage === 'string' ? project.errorMessage : null,
      })

    clearTimeout(timeoutId)

    if (error) {
      // 42501 is the function's "not owned by caller" error: report 404 so a
      // caller probing another user's id cannot distinguish it from absent.
      const notOwned = error.code === '42501'
      logPersonalization({
        route: '/api/personalization/project',
        stage: 'db-update',
        provider: 'supabase',
        httpStatus: notOwned ? 404 : 500,
        safeErrorCode: notOwned ? 'PROJECT_NOT_FOUND' : 'DB_UPDATE_FAILED',
        safeMessage: error.message,
        correlationId,
        durationMs: Date.now() - startTime,
      })
      return NextResponse.json(
        { error: notOwned ? 'Project not found' : error.message },
        { status: notOwned ? 404 : 500 }
      )
    }

    logPersonalization({
      route: '/api/personalization/project',
      stage: projectId ? 'db-update' : 'db-insert',
      provider: 'supabase',
      httpStatus: 200,
      correlationId,
      durationMs: Date.now() - startTime,
    })

    return NextResponse.json({ ok: true, project: upserted })
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      logPersonalization({
        route: '/api/personalization/project',
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
      route: '/api/personalization/project',
      stage: 'unhandled',
      httpStatus: 500,
      safeErrorCode: 'UNEXPECTED_ERROR',
      safeMessage: message,
      correlationId,
      durationMs: Date.now() - startTime,
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30_000)
  const correlationId = createCorrelationId(req)
  const startTime = Date.now()

  try {
    const envCheck = requirePersonalizationEnv()
    if (!envCheck.valid) {
      clearTimeout(timeoutId)
      logPersonalization({
        route: '/api/personalization/project',
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
        route: '/api/personalization/project',
        stage: 'auth',
        httpStatus: 401,
        safeErrorCode: 'UNAUTHENTICATED',
        safeMessage: 'No authenticated user',
        correlationId,
      })
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
    }

    const projectId = req.nextUrl.searchParams.get('id')
    if (!projectId) {
      clearTimeout(timeoutId)
      logPersonalization({
        route: '/api/personalization/project',
        stage: 'validation',
        httpStatus: 400,
        safeErrorCode: 'MISSING_PROJECT_ID',
        safeMessage: 'Missing project id parameter',
        correlationId,
      })
      return NextResponse.json({ error: 'Missing project id parameter' }, { status: 400 })
    }

    const supabase = createServerClient()

    // Ownership is asserted inside the function; a row owned by another user
    // deletes zero rows and reports false, which the route treats as 404.
    const { data: deleted, error } = await supabase
      .rpc('personalization_saved_projects_delete', {
        p_id: projectId,
        p_clerk_user_id: userId,
      })

    clearTimeout(timeoutId)

    if (error) {
      logPersonalization({
        route: '/api/personalization/project',
        stage: 'db-delete',
        provider: 'supabase',
        httpStatus: 500,
        safeErrorCode: 'DB_DELETE_FAILED',
        safeMessage: error.message,
        correlationId,
        durationMs: Date.now() - startTime,
      })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!deleted) {
      logPersonalization({
        route: '/api/personalization/project',
        stage: 'db-delete',
        provider: 'supabase',
        httpStatus: 404,
        safeErrorCode: 'PROJECT_NOT_FOUND',
        safeMessage: 'No project deleted for this owner',
        correlationId,
        durationMs: Date.now() - startTime,
      })
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    logPersonalization({
      route: '/api/personalization/project',
      stage: 'db-delete',
      provider: 'supabase',
      httpStatus: 200,
      correlationId,
      durationMs: Date.now() - startTime,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      logPersonalization({
        route: '/api/personalization/project',
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
      route: '/api/personalization/project',
      stage: 'unhandled',
      httpStatus: 500,
      safeErrorCode: 'UNEXPECTED_ERROR',
      safeMessage: message,
      correlationId,
      durationMs: Date.now() - startTime,
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
