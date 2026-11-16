import { createReadStream } from 'node:fs'
import { log } from '@vidbee/logger/script'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

const DEFAULT_CLIENT_DIRECTORY = fileURLToPath(new URL('./dist/client/', import.meta.url))
const DEFAULT_SERVER_ENTRY_URL = new URL('./dist/server/server.js', import.meta.url)
const DEFAULT_API_URL = 'http://api:3100'
// [host patch] optional sub-path the app is mounted under (matches VIDBEE_BASE_PATH at build time).
const BASE_PATH = (process.env.VIDBEE_BASE_PATH ?? '').trim().replace(/\/+$/, '')
const stripBase = (pathname) =>
  BASE_PATH && (pathname === BASE_PATH || pathname.startsWith(`${BASE_PATH}/`))
    ? pathname.slice(BASE_PATH.length) || '/'
    : pathname
// [host patch] '/hub' = transcript + AI endpoints added by the host (apps/api/src/lib/hub-router.ts)
const PROXY_PATH_PREFIXES = ['/events', '/files', '/hub', '/images', '/rpc']
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
])
const CONTENT_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp']
])

let defaultServerEntryPromise

/** Load the built TanStack Start handler only when an SSR request needs it. */
const loadDefaultServerEntry = async () => {
  defaultServerEntryPromise ??= import(DEFAULT_SERVER_ENTRY_URL.href).then((module) => module.default)
  return defaultServerEntryPromise
}

/** Return whether a request path belongs to the internal API proxy. */
const isProxyPath = (pathname) =>
  PROXY_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))

/** Build fetch-compatible headers without forwarding connection-specific values. */
const buildForwardHeaders = (request) => {
  const headers = new Headers()
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined || HOP_BY_HOP_HEADERS.has(name.toLowerCase()) || name === 'host') {
      continue
    }
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item)
    } else {
      headers.set(name, value)
    }
  }
  if (request.headers.host) headers.set('x-forwarded-host', request.headers.host)
  headers.set('x-forwarded-proto', request.socket.encrypted ? 'https' : 'http')
  return headers
}

/** Convert an incoming Node request into a Fetch API Request. */
const toFetchRequest = (request, targetUrl) => {
  const init = {
    headers: buildForwardHeaders(request),
    method: request.method ?? 'GET'
  }
  if (init.method !== 'GET' && init.method !== 'HEAD') {
    init.body = request
    init.duplex = 'half'
  }
  return new Request(targetUrl, init)
}

/** Stream a Fetch API Response back through a Node server response. */
const writeFetchResponse = async (response, serverResponse, method) => {
  serverResponse.statusCode = response.status
  serverResponse.statusMessage = response.statusText
  for (const [name, value] of response.headers) {
    if (!HOP_BY_HOP_HEADERS.has(name.toLowerCase())) serverResponse.setHeader(name, value)
  }
  if (method === 'HEAD' || !response.body) {
    serverResponse.end()
    return
  }
  await pipeline(Readable.fromWeb(response.body), serverResponse)
}

/** Resolve a request path to a safe file underneath the built client directory. */
const resolveStaticFile = async (clientDirectory, pathname) => {
  let decodedPath
  try {
    decodedPath = decodeURIComponent(pathname)
  } catch {
    return null
  }
  const candidate = path.resolve(clientDirectory, `.${decodedPath}`)
  const relativePath = path.relative(clientDirectory, candidate)
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null
  }
  try {
    return (await stat(candidate)).isFile() ? candidate : null
  } catch {
    return null
  }
}

/** Serve a built client file and return whether the request was handled. */
const serveStaticFile = async (request, response, clientDirectory, pathname) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false
  const filePath = await resolveStaticFile(clientDirectory, pathname)
  if (!filePath) return false

  const extension = path.extname(filePath).toLowerCase()
  response.statusCode = 200
  response.setHeader('content-type', CONTENT_TYPES.get(extension) ?? 'application/octet-stream')
  response.setHeader(
    'cache-control',
    pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache'
  )
  if (request.method === 'HEAD') {
    response.end()
    return true
  }
  await pipeline(createReadStream(filePath), response)
  return true
}

/** Forward API and SSE traffic to the private Compose service. */
const proxyApiRequest = async (request, response, requestUrl, apiUrl) => {
  const targetUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, apiUrl)
  const upstreamResponse = await fetch(toFetchRequest(request, targetUrl))
  await writeFetchResponse(upstreamResponse, response, request.method)
}

/** Handle one web, static, or proxied API request. */
const handleRequest = async (request, response, options) => {
  const host = request.headers.host ?? 'localhost'
  const protocol = request.socket.encrypted ? 'https' : 'http'
  const requestUrl = new URL(request.url ?? '/', `${protocol}://${host}`)

  const innerPath = stripBase(requestUrl.pathname)
  try {
    if (isProxyPath(innerPath)) {
      await proxyApiRequest(request, response, new URL(`${innerPath}${requestUrl.search}`, requestUrl), options.apiUrl)
      return
    }
    if (await serveStaticFile(request, response, options.clientDirectory, innerPath)) {
      return
    }

    const serverEntry = options.serverEntry ?? (await loadDefaultServerEntry())
    const rendered = await serverEntry.fetch(toFetchRequest(request, requestUrl))
    await writeFetchResponse(rendered, response, request.method)
  } catch (error) {
    log.error({
      event: 'web_request_failed',
      error: error instanceof Error ? error.message : String(error)
    })
    if (!response.headersSent) {
      response.statusCode = isProxyPath(innerPath) ? 502 : 500
      response.setHeader('content-type', 'text/plain; charset=utf-8')
    }
    if (!response.writableEnded) response.end('Request failed.')
  }
}

/** Create the production web server with injectable paths. */
export const createWebServer = (options = {}) => {
  const resolvedOptions = {
    apiUrl: new URL(options.apiUrl ?? process.env.VIDBEE_API_URL_INTERNAL ?? DEFAULT_API_URL),
    clientDirectory: options.clientDirectory ?? DEFAULT_CLIENT_DIRECTORY,
    serverEntry: options.serverEntry
  }
  return createServer((request, response) => {
    void handleRequest(request, response, resolvedOptions)
  })
}

/** Return whether this module was launched directly by Node. */
const isMainModule = () =>
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (isMainModule()) {
  const host = process.env.VIDBEE_WEB_HOST?.trim() || '0.0.0.0'
  const parsedPort = Number.parseInt(process.env.VIDBEE_WEB_PORT ?? '3000', 10)
  if (!Number.isInteger(parsedPort) || parsedPort <= 0 || parsedPort > 65_535) {
    throw new Error('VIDBEE_WEB_PORT must be an integer between 1 and 65535.')
  }
  createWebServer().listen(parsedPort, host, () => {
    log.info({ event: 'web_listening', host, port: parsedPort })
  })
}
