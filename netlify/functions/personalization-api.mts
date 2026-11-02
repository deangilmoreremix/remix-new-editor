/**
 * Personalization + Lead Finder API (ported from OpenHiggsBolt).
 *
 * One Netlify Function (v2, web Request/Response) serves every route the
 * ported modal calls. The OpenHiggsBolt Next.js route handlers live
 * unchanged under ./_personalization/app/api/**; this file only dispatches
 * to them and supplies the request scope their `auth()` / `after()` shims
 * read (./_personalization/shims).
 *
 *   POST          /api/personalization/find-businesses
 *   GET|POST      /api/personalization/leads
 *   PATCH|DELETE  /api/personalization/leads/:id
 *   POST          /api/personalization/research-business
 *   GET|POST      /api/personalization/discover-assets
 *   GET           /api/personalization/discover-assets/status
 *   POST          /api/personalization/image-analyze | image-edit | image-smart-edit | download-image
 *   GET|POST|DELETE /api/personalization/project
 *   POST          /api/personalization/record
 *   POST          /api/personalization/persist-edited-asset
 *   POST          /api/demo/discover           (anonymous "Find My Brand")
 *   POST          /api/proxy/openai-enhance    (prompt personalizer / enhance text)
 *   GET|POST      /api/api/v1/*                (OpenHiggsBolt MuAPI proxy: generation submit + poll)
 *   GET|POST      /api/v1/upload_file          (OpenHiggsBolt MuAPI upload + durable originals)
 *   GET           /api/media/shotcraft/:key    (motion-template preview clips)
 *   POST          /api/video/record            (accepted, not stored)
 */
import './_personalization/shims/env'
import { requestContext } from './_personalization/shims/requestContext'
import { NextRequest, NextResponse } from './_personalization/shims/next-server'

// Netlify Functions v2 types, inlined to avoid a dependency for two shapes.
type Context = { waitUntil?: (promise: Promise<unknown>) => void }
type Config = { path: string | string[] }

import * as findBusinesses from './_personalization/app/api/personalization/find-businesses/route'
import * as leads from './_personalization/app/api/personalization/leads/route'
import * as leadById from './_personalization/app/api/personalization/leads/[id]/route'
import * as researchBusiness from './_personalization/app/api/personalization/research-business/route'
import * as discoverAssets from './_personalization/app/api/personalization/discover-assets/route'
import * as discoverAssetsStatus from './_personalization/app/api/personalization/discover-assets/status/route'
import * as imageAnalyze from './_personalization/app/api/personalization/image-analyze/route'
import * as imageEdit from './_personalization/app/api/personalization/image-edit/route'
import * as imageSmartEdit from './_personalization/app/api/personalization/image-smart-edit/route'
import * as downloadImage from './_personalization/app/api/personalization/download-image/route'
import * as project from './_personalization/app/api/personalization/project/route'
import * as record from './_personalization/app/api/personalization/record/route'
import * as demoDiscover from './_personalization/app/api/demo/discover/route'
import * as persistEditedAsset from './_personalization/extra/persistEditedAsset'
import * as openaiEnhance from './_personalization/extra/openaiEnhance'
import * as muapiProxy from './_personalization/app/api/api/v1/[[...path]]/route.js'
import * as muapiUploadFile from './_personalization/app/api/v1/upload_file/route'
import * as shotcraftMedia from './_personalization/app/api/media/shotcraft/[styleKey]/route'

type RouteParams = Record<string, string | string[]>
type Handler = (req: NextRequest, ctx?: { params: Promise<RouteParams> }) => Promise<Response> | Response
type RouteModule = Partial<Record<'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', Handler>>

const STATIC_ROUTES: Record<string, RouteModule> = {
  '/api/personalization/find-businesses': findBusinesses as RouteModule,
  '/api/personalization/leads': leads as RouteModule,
  '/api/personalization/research-business': researchBusiness as RouteModule,
  '/api/personalization/discover-assets': discoverAssets as RouteModule,
  '/api/personalization/discover-assets/status': discoverAssetsStatus as RouteModule,
  '/api/personalization/image-analyze': imageAnalyze as RouteModule,
  '/api/personalization/image-edit': imageEdit as RouteModule,
  '/api/personalization/image-smart-edit': imageSmartEdit as RouteModule,
  '/api/personalization/download-image': downloadImage as RouteModule,
  '/api/personalization/project': project as RouteModule,
  '/api/personalization/record': record as RouteModule,
  '/api/personalization/persist-edited-asset': persistEditedAsset as unknown as RouteModule,
  '/api/demo/discover': demoDiscover as RouteModule,
  '/api/proxy/openai-enhance': openaiEnhance as unknown as RouteModule,
  '/api/v1/upload_file': muapiUploadFile as unknown as RouteModule,
}

const videoRecord: RouteModule = {
  // OpenHiggsBolt's client registers finished videos here but the route was
  // never implemented there; remix acknowledges the call so the client's
  // best-effort bookkeeping stays quiet. Outputs are recorded through
  // /api/personalization/record.
  POST: async () => NextResponse.json({ ok: true, recorded: false }),
}

function resolve(pathname: string): { mod: RouteModule; params: RouteParams } | null {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (STATIC_ROUTES[path]) return { mod: STATIC_ROUTES[path], params: {} }
  if (path === '/api/video/record') return { mod: videoRecord, params: {} }
  // OpenHiggsBolt's MuAPI proxy: /api/api/v1/<path…> → api.muapi.ai/api/v1/<path…>
  const muapi = /^\/api\/api\/v1(?:\/(.*))?$/.exec(path)
  if (muapi) {
    const segments = (muapi[1] || '').split('/').filter(Boolean).map((s) => decodeURIComponent(s))
    return { mod: muapiProxy as unknown as RouteModule, params: { path: segments } }
  }
  const shotcraft = /^\/api\/media\/shotcraft\/([^/]+)$/.exec(path)
  if (shotcraft) return { mod: shotcraftMedia as unknown as RouteModule, params: { styleKey: decodeURIComponent(shotcraft[1]) } }
  const lead = /^\/api\/personalization\/leads\/([^/]+)$/.exec(path)
  if (lead) return { mod: leadById as RouteModule, params: { id: decodeURIComponent(lead[1]) } }
  return null
}

/**
 * The ported routes key anonymous rate limits and anonymous discovery-job
 * ownership on the client IP, read from `x-real-ip` / `x-forwarded-for`.
 * Those headers can be supplied by the caller, so when Netlify provides the
 * connection IP it sets itself (`x-nf-client-connection-ip`), it replaces
 * both before any route sees the request.
 */
export function withTrustedClientIp(request: Request): Request {
  const trusted = request.headers.get('x-nf-client-connection-ip')?.trim()
  if (!trusted) return request
  const headers = new Headers(request.headers)
  headers.set('x-forwarded-for', trusted)
  headers.set('x-real-ip', trusted)
  const method = request.method.toUpperCase()
  return new Request(request.url, {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : request.body,
    // Required by Node's fetch when streaming a request body through.
    duplex: 'half',
  } as RequestInit)
}

export default async (request: Request, context: Context): Promise<Response> => {
  const url = new URL(request.url)
  const match = resolve(url.pathname)
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const method = request.method.toUpperCase() as keyof RouteModule
  const handler = match.mod[method]
  if (!handler) {
    const allow = (['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] as const).filter((m) => match.mod[m]).join(', ')
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: allow } })
  }

  const req = new NextRequest(withTrustedClientIp(request))
  return requestContext.run(
    { request: req, waitUntil: (p) => context?.waitUntil?.(p) },
    async () => {
      try {
        return await handler(req, { params: Promise.resolve(match.params) })
      } catch (err) {
        console.error('[personalization-api] unhandled error:', (err as Error)?.message || err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
      }
    },
  )
}

export const config: Config = {
  path: [
    '/api/personalization/*',
    '/api/demo/discover',
    '/api/video/record',
    '/api/proxy/openai-enhance',
    '/api/api/v1/*',
    '/api/v1/upload_file',
    '/api/media/shotcraft/*',
  ],
}
