import type { NextRequest } from '../../../../shims/next-server'
import { NextResponse } from '../../../../shims/next-server'
import { auth } from '../../../../shims/clerk-server'
import { requireApiEntitlement, entitlementForbiddenResponse } from '../../../../src/access/apiRequireEntitlement'
import { ENTITLEMENTS } from '../../../../src/access/entitlements'

/** Workspace id used for the dev-only e2e bypass (never in production). */
export const E2E_LOCAL_USER = 'e2e-local'

/**
 * remix-new-editor: honoured only in explicit local development. Upstream
 * checked `NODE_ENV !== 'production'`, but Netlify does not guarantee
 * NODE_ENV=production in deployed functions, so that check could let anyone
 * with the cookie skip sign-in on a live site.
 */
const isLocalDevelopment = () =>
  process.env.NETLIFY_DEV === 'true' || process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
const isDevBypass = (req: NextRequest) =>
  isLocalDevelopment() && req.cookies.get('__e2e_auth_bypass')?.value === '1'

/**
 * Motion Studio's paid server features (page capture, AI director) require a
 * signed-in user with the SmartVideo GO entitlement. The dev-only e2e bypass
 * mirrors `middleware.js`: it is honoured only outside production.
 */
export type MotionStudioUser =
  | { ok: true; userId: string; bypass: boolean }
  | { ok: false; response: Response }

export async function requireMotionStudioUser(req: NextRequest): Promise<MotionStudioUser> {
  if (isDevBypass(req)) return { ok: true, userId: E2E_LOCAL_USER, bypass: true }
  const { userId } = await auth()
  if (!userId) return { ok: false, response: NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 }) }
  const entitlement = await requireApiEntitlement(ENTITLEMENTS.SMARTVIDEO_GO)
  if (!entitlement.allowed) {
    if (entitlement.status === 401) return { ok: false, response: NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 }) }
    return { ok: false, response: entitlementForbiddenResponse(ENTITLEMENTS.SMARTVIDEO_GO) }
  }
  return { ok: true, userId, bypass: false }
}
