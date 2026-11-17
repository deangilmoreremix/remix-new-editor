// Host server (not upstream): runs upstream VidBee's *desktop main-process code* in Node and exposes its IPC over HTTP.
//   POST /ipc/invoke   { channel, args }     → ipcRenderer.invoke(channel, ...args)
//   POST /ipc/send     { channel, args }     → ipcRenderer.send(channel, ...args)
//   GET  /ipc/events                         → server-sent events: every main→renderer `webContents.send`
// The main process itself is upstream's apps/desktop/src/main/index.ts, imported unchanged and run under host/electron-stub.mjs.
import http from 'node:http'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { __invoke, hub, ipcMain } from 'electron'
import log from 'electron-log/main'
import { realpathSync } from 'node:fs'
import { settingsManager } from '../src/main/settings'
// Upstream's real main process: registers every IPC service, wires download/kernel/transcript events, boots the task queue.
import '../src/main/index'

const port = Number(process.env.VIDBEE_PORT || 3300)
const host = process.env.VIDBEE_HOST || '127.0.0.1'
const basePath = (process.env.VIDBEE_BASE_PATH ?? '').trim().replace(/\/+$/, '')
const staticDir = process.env.VIDBEE_STATIC_DIR ? path.resolve(process.env.VIDBEE_STATIC_DIR) : ''
const sender = { id: 1, send: (channel: string, ...args: unknown[]) => hub.emit(channel, args), isDestroyed: () => false }

const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.wasm': 'application/wasm', '.map': 'application/json', '.webp': 'image/webp' }

const readJson = async (req: http.IncomingMessage): Promise<{ channel?: string; args?: unknown[] }> => {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') } catch { return {} }
}

const sse = (req: http.IncomingMessage, res: http.ServerResponse) => {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no' })
  res.write(': connected\n\n')
  const listener = (channel: string, args: unknown[]) => res.write(`data: ${JSON.stringify({ channel, args })}\n\n`)
  hub.listeners.add(listener)
  const ping = setInterval(() => res.write(': ping\n\n'), 20_000)
  req.on('close', () => { clearInterval(ping); hub.listeners.delete(listener) })
}

/** Stream a file from the configured download folders (Range supported) — replaces file:// URLs the desktop renderer used. */
const serveMedia = (req: http.IncomingMessage, res: http.ServerResponse, rawPath: string): void => {
  const roots = [settingsManager.get('downloadPath') as string, process.env.VIDBEE_DOWNLOAD_DIR].filter((r): r is string => Boolean(r))
  let real = ''
  try { real = realpathSync(path.resolve(rawPath)) } catch { res.writeHead(404); return void res.end('Not found') }
  const allowed = roots.some((root) => { try { const r = realpathSync(root); return real === r || real.startsWith(r + path.sep) } catch { return false } })
  if (!allowed || !statSync(real).isFile()) { res.writeHead(403); return void res.end('Forbidden') }
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
  headers['content-length'] = end - start + 1
  res.writeHead(status, headers)
  createReadStream(real, { start, end }).pipe(res)
}
const MEDIA_TYPES: Record<string, string> = { '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mkv': 'video/x-matroska', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.opus': 'audio/ogg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.flac': 'audio/flac', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.vtt': 'text/vtt', '.srt': 'text/plain' }

const serveStatic = (req: http.IncomingMessage, res: http.ServerResponse, pathname: string): boolean => {
  if (!staticDir) return false
  let file = path.join(staticDir, pathname === '/' ? 'index.html' : pathname)
  if (!file.startsWith(staticDir)) return false
  if (!existsSync(file) || !statSync(file).isFile()) file = path.join(staticDir, 'index.html') // SPA fallback
  const type = MIME[path.extname(file)] ?? 'application/octet-stream'
  if (basePath && path.basename(file) === 'index.html') {
    // Relative asset URLs (base './') must resolve against the sub-path even when the page URL has no trailing slash.
    const html = readFileSync(file, 'utf8').replace('<head>', `<head><base href="${basePath}/">`)
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
  try {
    if (req.method === 'POST' && url.pathname === '/ipc/invoke') {
      const { channel, args = [] } = await readJson(req)
      if (!channel) { res.writeHead(400); return res.end('channel required') }
      try {
        const result = await __invoke(channel, args, sender)
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
    if (req.method === 'GET' && url.pathname === '/ipc/events') return sse(req, res)
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
