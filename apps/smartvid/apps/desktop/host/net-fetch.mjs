// `net.fetch` for the Electron shim (not upstream). Upstream's agent-artifact protocol handler answers every request with
// `net.fetch(file://…, { headers })`, relying on Electron to serve the file with range support. Plain Node has no such call,
// and the shim's placeholder returned nothing, so artifact images and videos came back as a 500.
import { createReadStream, statSync } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'

const TYPES = {
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.flac': 'audio/flac',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.txt': 'text/plain', '.vtt': 'text/vtt', '.srt': 'text/plain'
}

/**
 * @param {string | URL | { url: string }} input
 * @param {{ headers?: HeadersInit }} [init]
 * @param {typeof fetch} [passthrough] used for anything that is not a file: URL
 * @returns {Promise<Response>}
 */
export const netFetch = async (input, init = {}, passthrough = globalThis.fetch) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
  if (url.protocol !== 'file:') return passthrough(input, init)
  const file = fileURLToPath(url)
  const stat = statSync(file) // throws for a missing file; the caller turns that into a 404
  if (!stat.isFile()) throw new Error('Not a file')
  const size = stat.size
  const headers = { 'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream', 'accept-ranges': 'bytes' }
  const range = /^bytes=(\d*)-(\d*)$/.exec(new Headers(init.headers ?? {}).get('range') ?? '')
  let start = 0
  let end = size - 1
  let status = 200
  if (range && (range[1] || range[2]) && size > 0) {
    if (range[1] === '') start = Math.max(0, size - Number(range[2]))
    else {
      start = Number(range[1])
      if (range[2]) end = Math.min(end, Number(range[2]))
    }
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } })
    status = 206
    headers['content-range'] = `bytes ${start}-${end}/${size}`
  }
  headers['content-length'] = String(size === 0 ? 0 : end - start + 1)
  const body = size === 0 ? null : Readable.toWeb(createReadStream(file, { start, end }))
  return new Response(body, { status, headers })
}
