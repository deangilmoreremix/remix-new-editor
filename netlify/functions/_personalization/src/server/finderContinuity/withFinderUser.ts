/**
 * Shared wrapper for the finder-continuity routes: env check, Clerk auth, per-user rate limit, structured logging
 * and a safe catch-all, so each route only contains its own logic. Same behaviour as the leads route.
 */
import { NextRequest, NextResponse } from '../../../shims/next-server'
import { auth } from '../../../shims/clerk-server'
import { createServerClient } from '../../lib/supabase'
import { logPersonalization, createCorrelationId } from '../personalizationLog'
import { requirePersonalizationEnv } from '../envValidation'
import { rateLimit, rateLimit429, resolveRateLimitKey } from '../../../lib/rateLimit'

export interface FinderCtx {
  userId: string
  correlationId: string
  supabase: ReturnType<typeof createServerClient>
  log: (stage: string, httpStatus: number, safeErrorCode?: string, safeMessage?: string) => void
}

export async function withFinderUser(
  req: NextRequest,
  route: string,
  opts: { writes: boolean },
  fn: (ctx: FinderCtx) => Promise<NextResponse>,
): Promise<NextResponse> {
  const correlationId = createCorrelationId(req)
  const startTime = Date.now()
  const log: FinderCtx['log'] = (stage, httpStatus, safeErrorCode, safeMessage) =>
    logPersonalization({ route, stage, provider: 'supabase', httpStatus, safeErrorCode, safeMessage, correlationId, durationMs: Date.now() - startTime })
  try {
    const envCheck = requirePersonalizationEnv()
    if (!envCheck.valid) {
      log('env-validation', 500, 'ENV_MISSING', `Missing required env vars: ${envCheck.missingRequired.join(', ')}`)
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }
    const { userId } = await auth()
    if (!userId) {
      log('auth', 401, 'UNAUTHENTICATED', 'No authenticated user')
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
    }
    const limit = rateLimit(resolveRateLimitKey(userId, null), { windowMs: 60_000, max: opts.writes ? 30 : 120 })
    if (!limit.allowed) return rateLimit429(limit.retryAfterMs)
    return await fn({ userId, correlationId, supabase: createServerClient(), log })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    log('unhandled', 500, 'UNEXPECTED_ERROR', message)
    return NextResponse.json({ error: 'Unexpected error', correlationId }, { status: 500 })
  }
}

export async function readJson(req: NextRequest): Promise<{ ok: true; body: unknown } | { ok: false }> {
  try { return { ok: true, body: await req.json() } } catch { return { ok: false } }
}
