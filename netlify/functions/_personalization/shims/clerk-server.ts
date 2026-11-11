/**
 * `@clerk/nextjs/server` replacement for the ported OpenHiggsBolt routes.
 *
 * `auth()` verifies the Clerk session token of the current request with
 * remix's shared verifier (`netlify/functions/_shared/clerkAuth.js`, JWKS via
 * `jose`). The browser sends it as `Authorization: Bearer <token>` (see
 * `src/features/personalization/lib/apiAuth.ts`); the `__session` cookie is
 * accepted too. No token or an invalid token means a signed-out caller,
 * exactly as Clerk's `auth()` reports it.
 */
import { verifyClerkToken } from '../../_shared/clerkAuth.js'
import { currentRequestContext } from './requestContext'

function extractToken(request: Request): string | null {
  const authorization = request.headers.get('authorization')
  if (authorization) {
    const match = /^Bearer\s+(.+)$/i.exec(authorization.trim())
    if (match) return match[1].trim()
  }
  const cookie = request.headers.get('cookie') || ''
  for (const part of cookie.split(';')) {
    const [rawName, ...rest] = part.trim().split('=')
    if (rawName === '__session' || rawName?.startsWith('__session_')) {
      const value = rest.join('=')
      if (value) return value
    }
  }
  return null
}

export async function auth(): Promise<{ userId: string | null; sessionId: string | null }> {
  const ctx = currentRequestContext()
  if (!ctx) return { userId: null, sessionId: null }
  if (!ctx.authPromise) {
    ctx.authPromise = (async () => {
      const token = extractToken(ctx.request)
      if (!token) return { userId: null, sessionId: null }
      const verified = await verifyClerkToken(token)
      if (!verified?.userId) return { userId: null, sessionId: null }
      return { userId: verified.userId, sessionId: (verified.claims?.sid as string) || null }
    })()
  }
  return ctx.authPromise
}

export async function currentUser(): Promise<null> {
  return null
}
