/**
 * Per-request context for the ported OpenHiggsBolt route handlers.
 *
 * Next.js gives route code ambient access to the request (Clerk `auth()`,
 * `after()`). The Netlify function stores the request and the platform
 * context here so the shims can provide the same ambient access.
 */
import { AsyncLocalStorage } from 'node:async_hooks'

export interface RouteRequestContext {
  request: Request
  waitUntil?: (promise: Promise<unknown>) => void
  authPromise?: Promise<{ userId: string | null; sessionId: string | null }>
}

export const requestContext = new AsyncLocalStorage<RouteRequestContext>()

export function currentRequestContext(): RouteRequestContext | undefined {
  return requestContext.getStore()
}
