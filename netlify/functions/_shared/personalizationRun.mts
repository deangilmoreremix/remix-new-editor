/**
 * Runs a small allow-list of the ported personalization / Lead Finder route handlers as a known user.
 *
 * Used by the MCP gateway (mcp-gateway.js, studio route "personalization"). The handlers read the signed-in user from
 * the `auth()` shim, which honours a pre-set `authPromise` on the request context: this module sets it to the MCP key's
 * owner, so the handlers run exactly the code the app runs. The user id comes only from the caller of this function
 * (the gateway, after it verified the MCP key); nothing in the request can change it.
 */
import '../_personalization/shims/env'
import { requestContext } from '../_personalization/shims/requestContext'
import { NextRequest, NextResponse } from '../_personalization/shims/next-server'

import * as findBusinesses from '../_personalization/app/api/personalization/find-businesses/route'
import * as leads from '../_personalization/app/api/personalization/leads/route'
import * as leadById from '../_personalization/app/api/personalization/leads/[id]/route'
import * as researchBusiness from '../_personalization/app/api/personalization/research-business/route'
import * as discoverAssets from '../_personalization/app/api/personalization/discover-assets/route'
import * as discoverAssetsStatus from '../_personalization/app/api/personalization/discover-assets/status/route'
import * as enrichBusiness from '../_personalization/app/api/personalization/enrich-business/route'
import * as resolveWebsite from '../_personalization/app/api/personalization/resolve-website/route'
import * as demoDiscover from '../_personalization/app/api/demo/discover/route'

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'
type Handler = (req: NextRequest, ctx?: { params: Promise<Record<string, string>> }) => Promise<Response> | Response
type RouteModule = Partial<Record<Method, Handler>>

// The only routes the MCP can reach. Everything else (project, image edit, record, media proxies...) stays app-only.
const STATIC: Record<string, RouteModule> = {
  '/find-businesses': findBusinesses as RouteModule,
  '/leads': leads as RouteModule,
  '/research-business': researchBusiness as RouteModule,
  '/discover-assets': discoverAssets as RouteModule,
  '/discover-assets/status': discoverAssetsStatus as RouteModule,
  '/enrich-business': enrichBusiness as RouteModule,
  '/resolve-website': resolveWebsite as RouteModule,
  '/demo/discover': demoDiscover as RouteModule,
}

export const ALLOWED_ROUTES = [...Object.keys(STATIC), '/leads/:id']

const LEAD_ID = /^[A-Za-z0-9_-]{1,80}$/

export function resolveRoute(path: string): { mod: RouteModule; params: Record<string, string> } | null {
  const clean = String(path || '').replace(/\/+$/, '') || '/'
  if (Object.prototype.hasOwnProperty.call(STATIC, clean)) return { mod: STATIC[clean], params: {} }
  const lead = /^\/leads\/([^/]+)$/.exec(clean)
  if (lead && LEAD_ID.test(lead[1])) return { mod: leadById as RouteModule, params: { id: lead[1] } }
  return null
}

export interface RunInput { method: string; path: string; query?: Record<string, string>; body?: unknown }
export interface Principal { userId: string }

/** Returns { statusCode, body } like the Netlify v1 handlers the gateway already dispatches to. */
export async function runPersonalizationRoute(input: RunInput, principal: Principal): Promise<{ statusCode: number; body: string }> {
  const json = (statusCode: number, body: unknown) => ({ statusCode, body: JSON.stringify(body) })
  if (!principal?.userId) return json(401, { error: 'UNAUTHENTICATED' })
  const method = String(input.method || 'GET').toUpperCase() as Method
  const route = resolveRoute(input.path)
  if (!route) return json(404, { error: 'Not found' })
  const handler = route.mod[method]
  if (!handler) return json(405, { error: 'Method not allowed' })

  const url = new URL(`https://mcp.invalid/api/personalization${input.path}`)
  for (const [k, v] of Object.entries(input.query || {})) url.searchParams.set(k, String(v))
  const hasBody = method !== 'GET' && input.body !== undefined
  const req = new NextRequest(new Request(url, {
    method,
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `mcp:${principal.userId}` },
    body: hasBody ? JSON.stringify(input.body) : undefined,
  }))

  return requestContext.run(
    { request: req, authPromise: Promise.resolve({ userId: principal.userId, sessionId: null }) },
    async () => {
      try {
        const res = await handler(req, { params: Promise.resolve(route.params) })
        return { statusCode: res.status, body: await res.text() }
      } catch (err) {
        console.error('[personalization-run] unhandled error:', (err as Error)?.message || 'error')
        return json(500, { error: 'Internal server error' })
      }
    },
  )
}

export { NextResponse }
