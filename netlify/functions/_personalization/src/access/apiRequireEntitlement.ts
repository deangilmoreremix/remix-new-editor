/**
 * remix version of OpenHiggsBolt's `@/access/apiRequireEntitlement`.
 *
 * OpenHiggsBolt grants SMARTVIDEO_GO to every signed-in Clerk user
 * (src/access/entitlements.ts hasSmartVideoGo), so for the routes ported here
 * the effective rule is "a verified Clerk session is required". remix has no
 * SmartVideo entitlement tables, so that rule is applied directly. Any other
 * entitlement key is refused, as an unknown entitlement was in OpenHiggsBolt.
 */
import { NextResponse } from '../../shims/next-server'
import { auth } from '../../shims/clerk-server'

export const ENTITLEMENTS = {
  SMARTVIDEO_GO: 'smartvideo_go',
  SMARTVIDEO_AI: 'smartvideo_ai',
  SMARTVIDEO_VIRAL: 'smartvideo_viral',
  FOUNDERS: 'founders',
} as const

export type EntitlementCheckResult =
  | { allowed: true }
  | { allowed: false; status: 401 }
  | { allowed: false; status: 403; entitlement: string }

export async function requireApiEntitlement(entitlementKey: string): Promise<EntitlementCheckResult> {
  const { userId } = await auth()
  if (!userId) return { allowed: false, status: 401 }
  if (entitlementKey !== ENTITLEMENTS.SMARTVIDEO_GO) {
    return { allowed: false, status: 403, entitlement: entitlementKey }
  }
  return { allowed: true }
}

export function entitlementForbiddenResponse(entitlement: string) {
  return NextResponse.json(
    { error: 'PAYMENT_REQUIRED', entitlement, upgradeRequired: true },
    { status: 403 },
  )
}
