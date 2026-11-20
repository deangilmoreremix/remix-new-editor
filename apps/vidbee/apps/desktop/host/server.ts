// Host server (not upstream): runs upstream VidBee's *desktop main-process code* in Node and exposes its IPC over HTTP.
//   POST /ipc/invoke   { channel, args }     → ipcRenderer.invoke(channel, ...args)
//   POST /ipc/send     { channel, args }     → ipcRenderer.send(channel, ...args)
//   GET  /ipc/events                         → server-sent events: every main→renderer `webContents.send`
// The main process itself is upstream's apps/desktop/src/main/index.ts, imported unchanged and run under host/electron-stub.mjs.
import crypto from 'node:crypto'
import http from 'node:http'
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { __invoke, __protocolHandlers, exportsDir, hub, ipcMain } from 'electron'
import log from 'electron-log/main'
import { realpathSync } from 'node:fs'
import { settingsManager } from '../src/main/settings'
import { createTokenCheck } from './access-token.mjs'
import { resolveExportFile } from './export-path.mjs'
import { reviveBinary } from './ipc-binary.mjs'
import { isAllowedMedia, mediaRoots } from './media-access.mjs'
// Upstream's real main process: registers every IPC service, wires download/kernel/transcript events, boots the task queue.
import '../src/main/index'

const port = Number(process.env.VIDBEE_PORT || 3300)
const host = process.env.VIDBEE_HOST || '127.0.0.1'
const basePath = (process.env.VIDBEE_BASE_PATH ?? '').trim().replace(/\/+$/, '')
// Standalone access control. Upstream VidBee has no login, so listening beyond loopback requires VIDBEE_ACCESS_TOKEN (or an explicit
// VIDBEE_ALLOW_OPEN=1 when something else, e.g. a reverse proxy or the host app's gate, already authenticates every request).
const accessToken = (process.env.VIDBEE_ACCESS_TOKEN ?? '').trim()
const isLoopback = ['127.0.0.1', '::1', 'localhost'].includes(process.env.VIDBEE_HOST || '127.0.0.1')
if (!isLoopback && !accessToken && process.env.VIDBEE_ALLOW_OPEN !== '1') {
  console.error('Refusing to listen on a non-loopback address without VIDBEE_ACCESS_TOKEN (set it, or set VIDBEE_ALLOW_OPEN=1 behind your own auth).')
  process.exit(1)
}
const checkToken = createTokenCheck(accessToken)
const tokenOk = (req: http.IncomingMessage): boolean => checkToken(req.headers)
const imgExtra = (process.env.VIDBEE_CSP_IMG_SRC ?? '').trim()
const staticDir = process.env.VIDBEE_STATIC_DIR ? path.resolve(process.env.VIDBEE_STATIC_DIR) : ''
const sender = { id: 1, send: (channel: string, ...args: unknown[]) => hub.emit(channel, args), isDestroyed: () => false }

const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.wasm': 'application/wasm', '.map': 'application/json', '.webp': 'image/webp' }

const readJson = async (req: http.IncomingMessage): Promise<{ channel?: string; args?: unknown[] }> => {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}', reviveBinary) } catch { return {} }
}

const clientIdOf = (req: http.IncomingMessage): string | undefined => {
  const raw = req.headers['x-vidbee-client']
  const value = Array.isArray(raw) ? raw[0] : raw
  return value && /^[\w-]{8,64}$/.test(value) ? value : undefined
}

const sse = (req: http.IncomingMessage, res: http.ServerResponse, clientId?: string) => {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no' })
  res.write(': connected\n\n')
  const listener = Object.assign((channel: string, args: unknown[]) => res.write(`data: ${JSON.stringify({ channel, args })}\n\n`), { clientId })
  hub.listeners.add(listener)
  const ping = setInterval(() => res.write(': ping\n\n'), 20_000)
  req.on('close', () => { clearInterval(ping); hub.listeners.delete(listener) })
}

/** Stream one file with HTTP Range support. */
const serveFile = (req: http.IncomingMessage, res: http.ServerResponse, real: string, disposition?: string): void => {
  const size = statSync(real).size
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ''))
  let start = 0, end = size - 1, status = 200
  const headers: Record<string, string | number> = { 'content-type': MEDIA_TYPES[path.extname(real).toLowerCase()] ?? 'application/octet-stream', 'accept-ranges': 'bytes', 'cache-control': 'private, max-age=3600' }
  if (range && (range[1] || range[2])) {
    if (range[1] === '') start = Math.max(0, size - Number(range[2]))
    else { start = Number(range[1]); if (range[2]) end = Math.min(end, Number(range[2])) }
    if (start > end || start >= size) { res.writeHead(416, { 'content-range': `bytes */${size}` }); return void res.end() }
    status = 206; headers['content-range'] = `bytes ${start}-${end}/${size}`
  }
  if (disposition) headers['content-disposition'] = disposition
  headers['content-length'] = end - start + 1
  res.writeHead(status, headers)
  createReadStream(real, { start, end }).pipe(res)
}


/* ── browser ↔ server helpers for what Electron did natively ─────────────────────────────────────────── */
const dataRoot = path.resolve(process.env.VIDBEE_DATA_DIR || path.join(process.env.HOME ?? '.', '.vidbee-web'))
const uploadsDir = path.join(dataRoot, 'uploads')
const maxUploadBytes = Number(process.env.VIDBEE_MAX_UPLOAD_MB || 4096) * 1024 * 1024
const safeName = (name: string): string => path.basename(name).replace(/[^\p{L}\p{N}_.\- ()\[\]]+/gu, '_').slice(0, 180) || 'file'

/** POST /upload?name=… (raw body) → saves under <data>/uploads/<id>/ and returns the server path (used for dropped / picked files). */
const handleUpload = (req: http.IncomingMessage, res: http.ServerResponse, name: string): void => {
  const id = crypto.randomUUID()
  const dir = path.join(uploadsDir, id)
  mkdirSync(dir, { recursive: true })
  const target = path.join(dir, safeName(name))
  let size = 0
  const out = createWriteStream(target)
  req.on('data', (chunk: Buffer) => {
    size += chunk.length
    if (size > maxUploadBytes) { req.destroy(); out.destroy(); res.writeHead(413); res.end('Too large') }
  })
  req.pipe(out)
  out.on('finish', () => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ path: target })) })
  out.on('error', () => { if (!res.headersSent) res.writeHead(500); res.end('Upload failed') })
}

/** GET /host/list?path=… → sub-directories, for the browser's server-folder picker. */
const handleList = (res: http.ServerResponse, rawPath: string): void => {
  const dir = path.resolve(rawPath || (settingsManager.get('downloadPath') as string) || '/')
  try {
    const entries = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name).sort((a, b) => a.localeCompare(b))
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ path: dir, parent: path.dirname(dir) === dir ? null : path.dirname(dir), directories: entries }))
  } catch {
    res.writeHead(404, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'Cannot read directory' }))
  }
}

/** GET /exports/<id>/<name> → a file the main process "saved"; delivered to the browser as a download. */
const handleExport = (req: http.IncomingMessage, res: http.ServerResponse, id: string, name: string): void => {
  const file = resolveExportFile(exportsDir, id, name)
  if (!file) { res.writeHead(404); return void res.end('Not found') }
  serveFile(req, res, file, `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(file))}`)
}

/** Stream a file from the configured download folders — replaces the file:// URLs the desktop renderer used. */
const serveMedia = (req: http.IncomingMessage, res: http.ServerResponse, rawPath: string): void => {
  const roots = mediaRoots({ downloadPath: settingsManager.get('downloadPath') as string, downloadDir: process.env.VIDBEE_DOWNLOAD_DIR, dataRoot, tmpDir: os.tmpdir() })
  let real = ''
  try { real = realpathSync(path.resolve(rawPath)) } catch { res.writeHead(404); return void res.end('Not found') }
  const allowed = isAllowedMedia(real, roots)
  if (!allowed || !statSync(real).isFile()) { res.writeHead(403); return void res.end('Forbidden') }
  serveFile(req, res, real)
}

/** Serve upstream's custom-protocol URLs (vidbee://…, agent-artifact://…) by calling the handlers upstream registered. */
const serveProtocol = async (req: http.IncomingMessage, res: http.ServerResponse, scheme: string, rest: string, search: string): Promise<void> => {
  const entry = __protocolHandlers.get(scheme)
  if (!entry) { res.writeHead(404); return void res.end('Unknown protocol') }
  const target = `${scheme}://${rest}${search}`
  try {
    if (entry.kind === 'file') {
      const result = await new Promise<unknown>((resolve) => entry.fn({ url: target, method: 'GET', headers: {} }, resolve))
      const filePath = typeof result === 'string' ? result : (result as { path?: string } | null)?.path
      if (!filePath || !existsSync(filePath)) { res.writeHead(404); return void res.end('Not found') }
      return serveFile(req, res, realpathSync(filePath))
    }
    // Forward Range so seeking in a video reads only the bytes asked for, and stream the body instead of buffering it.
    const range = typeof req.headers.range === 'string' ? req.headers.range : undefined
    const response = (await entry.fn(new Request(target, { method: 'GET', headers: range ? { range } : {} }))) as Response
    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => { headers[key] = value })
    res.writeHead(response.status, headers)
    if (!response.body || req.method === 'HEAD') return void res.end()
    Readable.fromWeb(response.body as never).on('error', () => res.destroy()).pipe(res)
  } catch (error) {
    log.error('protocol request failed', target, error)
    res.writeHead(500); res.end('Protocol error')
  }
}
const MEDIA_TYPES: Record<string, string> = { '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mkv': 'video/x-matroska', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.opus': 'audio/ogg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.flac': 'audio/flac', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.vtt': 'text/vtt', '.srt': 'text/plain' }

const serveStatic = (req: http.IncomingMessage, res: http.ServerResponse, pathname: string): boolean => {
  if (!staticDir) return false
  let file = path.join(staticDir, pathname === '/' ? 'index.html' : pathname)
  if (!file.startsWith(staticDir)) return false
  if (!existsSync(file) || !statSync(file).isFile()) file = path.join(staticDir, 'index.html') // SPA fallback
  const type = MIME[path.extname(file)] ?? 'application/octet-stream'
  if ((basePath || imgExtra) && path.basename(file) === 'index.html') {
    // Relative asset URLs (base './') must resolve against the sub-path even when the page URL has no trailing slash.
    // Upstream's CSP (Electron) allows images from a few https hosts only; VIDBEE_CSP_IMG_SRC adds more (e.g. a demo image host).
    let html = readFileSync(file, 'utf8')
    if (basePath) html = html.replace('<head>', `<head><base href="${basePath}/">`)
    if (imgExtra) html = html.replace("img-src 'self'", `img-src 'self' ${imgExtra}`)
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' })
    res.end(html)
    return true
  }
  res.writeHead(200, { 'content-type': type, 'cache-control': file.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' })
  createReadStream(file).pipe(res)
  return true
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x')
  // Mounted behind a host app under a sub-path (e.g. /vidbee): serve it as if it were the root.
  if (basePath && (url.pathname === basePath || url.pathname.startsWith(`${basePath}/`))) url.pathname = url.pathname.slice(basePath.length) || '/'
  if (accessToken && url.pathname !== '/health' && !tokenOk(req)) {
    if (url.searchParams.get('token') === accessToken) {
      // First visit with ?token=…: remember it in a cookie and drop it from the URL.
      url.searchParams.delete('token')
      res.writeHead(302, { 'set-cookie': `vidbee_token=${encodeURIComponent(accessToken)}; Path=/; HttpOnly; SameSite=Lax`, location: `${basePath}${url.pathname}${url.search}` || '/' })
      return void res.end()
    }
    res.writeHead(401, { 'content-type': 'text/plain' })
    return void res.end('Unauthorized. Open the app with ?token=<VIDBEE_ACCESS_TOKEN> once.')
  }
  try {
    if (req.method === 'POST' && url.pathname === '/ipc/invoke') {
      const { channel, args = [] } = await readJson(req)
      if (!channel) { res.writeHead(400); return res.end('channel required') }
      try {
        const result = await __invoke(channel, args, sender, clientIdOf(req))
        res.writeHead(200, { 'content-type': 'application/json' })
        return res.end(JSON.stringify({ ok: true, result: result === undefined ? null : result }))
      } catch (error) {
        res.writeHead(200, { 'content-type': 'application/json' })
        return res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
      }
    }
    if (req.method === 'POST' && url.pathname === '/ipc/send') {
      const { channel, args = [] } = await readJson(req)
      if (channel) ipcMain.emit(channel, { sender, reply: sender.send }, ...args)
      res.writeHead(204); return res.end()
    }
    if (req.method === 'POST' && url.pathname === '/ipc/response') {
      const { id, result } = (await readJson(req)) as { id?: string; result?: unknown }
      if (id) hub.respond(id, result, clientIdOf(req))
      res.writeHead(204); return res.end()
    }
    if (req.method === 'POST' && url.pathname === '/upload') return handleUpload(req, res, url.searchParams.get('name') ?? 'file')
    if (req.method === 'GET' && url.pathname === '/host/list') return handleList(res, url.searchParams.get('path') ?? '')
    const exp = /^\/exports\/([^/]+)\/(.+)$/.exec(url.pathname)
    if (req.method === 'GET' && exp) return handleExport(req, res, exp[1], exp[2])
    if (req.method === 'GET' && url.pathname === '/ipc/events') return sse(req, res, /^[\w-]{8,64}$/.test(url.searchParams.get('client') ?? '') ? (url.searchParams.get('client') as string) : undefined)
    const proto = /^\/protocol\/([a-z-]+)\/(.*)$/.exec(url.pathname)
    if ((req.method === 'GET' || req.method === 'HEAD') && proto) return void (await serveProtocol(req, res, proto[1], decodeURIComponent(proto[2]), url.search))
    if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/media') return serveMedia(req, res, url.searchParams.get('path') ?? '')
    if (req.method === 'GET' && url.pathname === '/health') { res.writeHead(200); return res.end('{"ok":true}') }
    if (serveStatic(req, res, url.pathname)) return
    res.writeHead(404); res.end('Not found')
  } catch (error) {
    log.error('request failed', error)
    if (!res.headersSent) res.writeHead(500)
    res.end('Internal error')
  }
})

server.listen(port, host, () => log.info(`VidBee web host listening on http://${host}:${port}`))
