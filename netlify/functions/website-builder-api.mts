/**
 * Smart Website Builder server endpoints on Netlify.
 *
 * The builder (apps/openthorn) ships its server code as Vercel-style handlers,
 * `handler(req, res)`, in apps/openthorn/api. This function serves them at
 * /openthorn/api/<name> by translating the web Request into the small req/res
 * surface they use (method, headers, body, url; status/json/text/setHeader/end).
 *
 *   /openthorn/api/deploy | provider-keys | admin | migrate | supabase-oauth | cloudflare
 */
import type { Config } from '@netlify/functions'
import deploy from '../../apps/openthorn/api/deploy'
import providerKeys from '../../apps/openthorn/api/provider-keys'
import admin from '../../apps/openthorn/api/admin'
import migrate from '../../apps/openthorn/api/migrate'
import supabaseOauth from '../../apps/openthorn/api/supabase-oauth'
import cloudflare from '../../apps/openthorn/api/cloudflare'

const BASE_PATH = '/openthorn'

interface BuilderReq {
  method: string
  headers: Record<string, string>
  body: unknown
  url: string
  query: Record<string, string>
}
interface BuilderRes {
  status: (code: number) => BuilderRes
  json: (body: unknown) => void
  text: (body: string) => void
  setHeader: (name: string, value: string) => void
  end: (body?: string) => void
}
type Handler = (req: BuilderReq, res: BuilderRes) => unknown

export const ROUTES: Record<string, Handler> = {
  deploy: deploy as Handler,
  'provider-keys': providerKeys as Handler,
  admin: admin as Handler,
  migrate: migrate as Handler,
  'supabase-oauth': supabaseOauth as Handler,
  cloudflare: cloudflare as Handler,
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

export default async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const name = url.pathname.replace(/^\/openthorn\/api\//, '').replace(/^\/api\//, '').replace(/\/+$/, '')
  const handler = Object.prototype.hasOwnProperty.call(ROUTES, name) ? ROUTES[name] : undefined
  if (!handler) return json(404, { error: 'Not found' })

  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => { headers[key.toLowerCase()] = value })
  headers['x-app-base-path'] = BASE_PATH
  headers.host = url.host
  headers['x-forwarded-proto'] = 'https'

  let body: unknown
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const raw = await request.text()
    try { body = raw ? JSON.parse(raw) : undefined } catch { body = raw }
  }

  const req: BuilderReq = {
    method: request.method,
    headers,
    body,
    url: `${url.pathname}${url.search}`,
    query: Object.fromEntries(url.searchParams),
  }

  let statusCode = 200
  const outHeaders = new Headers({ 'Cache-Control': 'no-store' })
  let done!: (r: Response) => void
  const finished = new Promise<Response>((resolve) => { done = resolve })
  let sent = false
  const send = (payload: string | null, contentType?: string) => {
    if (sent) return
    sent = true
    if (contentType) outHeaders.set('Content-Type', contentType)
    done(new Response(payload, { status: statusCode, headers: outHeaders }))
  }
  const res: BuilderRes = {
    status(code) { statusCode = code; return res },
    json(b) { send(JSON.stringify(b), 'application/json') },
    text(b) { send(b, 'text/plain; charset=utf-8') },
    setHeader(n, v) { outHeaders.set(n, v) },
    end(b) { send(b ?? null) },
  }

  try {
    await handler(req, res)
  } catch (err) {
    console.error('[website-builder-api]', name, err instanceof Error ? err.message : err)
    if (!sent) {
      statusCode = 500
      res.json({ error: 'Server error' })
    }
  }
  // A handler that returned without answering must not hang the request.
  if (!sent) { statusCode = 500; res.json({ error: 'No response' }) }
  return finished
}

export const config: Config = {
  path: '/openthorn/api/*',
}
