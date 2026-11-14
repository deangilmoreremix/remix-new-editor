/**
 * A minimal ZIP writer (Stage 10): "stored" entries only (the files here are JPEG, GIF and MP4, which are already compressed), UTF-8 names,
 * CRC-32. Blobs are referenced, not copied, so a package of many videos is not duplicated in memory. No ZIP64: it refuses what it cannot
 * write correctly rather than producing a corrupt file.
 */
export class ZipError extends Error { constructor(message: string) { super(message); this.name = 'ZipError' } }
export interface ZipEntry { name: string; data: Blob | Uint8Array; modified?: Date }

const TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return t })()
export function crc32(bytes: Uint8Array, seed = 0): number {
  let c = ~seed >>> 0
  for (let i = 0; i < bytes.length; i += 1) c = TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return ~c >>> 0
}

/** A name that cannot escape the folder it is extracted into: no drive letters, no "..", no leading slash, no backslashes or control characters. */
export function safeZipName(name: string): string {
  const parts = String(name ?? '').replace(/\\/g, '/').split('/')
    // eslint-disable-next-line no-control-regex
    .map((p) => p.replace(/[\u0000-\u001F\u007F<>:"|?*]/g, '').replace(/^\.+$/, '').trim())
    .filter((p) => p && p !== '.' && p !== '..')
  return parts.join('/').slice(0, 200) || 'file'
}
export function uniqueZipNames(names: string[]): string[] {
  const used = new Set<string>()
  return names.map((n) => {
    const base = safeZipName(n); let out = base; let i = 2
    const dot = base.lastIndexOf('.'); const stem = dot > base.lastIndexOf('/') && dot > 0 ? base.slice(0, dot) : base; const ext = stem === base ? '' : base.slice(stem.length)
    while (used.has(out.toLowerCase())) { out = `${stem}-${i}${ext}`; i += 1 }
    used.add(out.toLowerCase()); return out
  })
}

const dos = (d: Date) => {
  const y = Math.max(1980, d.getFullYear())
  return { time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: ((y - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() }
}
const u16 = (v: number) => new Uint8Array([v & 255, (v >>> 8) & 255])
const u32 = (v: number) => new Uint8Array([v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255])
const cat = (...p: Uint8Array[]) => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let at = 0; for (const x of p) { o.set(x, at); at += x.length } return o }

export async function buildZip(entries: ZipEntry[]): Promise<Blob> {
  if (entries.length > 65535) throw new ZipError('Too many files for one ZIP (limit 65,535).')
  const names = uniqueZipNames(entries.map((e) => e.name)); const enc = new TextEncoder()
  const parts: BlobPart[] = []; const central: Uint8Array[] = []; let offset = 0
  for (let i = 0; i < entries.length; i += 1) {
    const e = entries[i]; const name = enc.encode(names[i])
    const bytes = e.data instanceof Uint8Array ? e.data : new Uint8Array(await e.data.arrayBuffer())
    if (bytes.length > 0xffffffff - 1024 || offset > 0xffffffff - 1024) throw new ZipError('The package is larger than a ZIP file can hold (4 GB). Make fewer videos per package.')
    const { time, date } = dos(e.modified ?? new Date()); const crc = crc32(bytes)
    const local = cat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(time), u16(date), u32(crc), u32(bytes.length), u32(bytes.length), u16(name.length), u16(0), name)
    parts.push(local as BlobPart, e.data as BlobPart)
    central.push(cat(u32(0x02014b50), u16(0x031e), u16(20), u16(0x0800), u16(0), u16(time), u16(date), u32(crc), u32(bytes.length), u32(bytes.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name))
    offset += local.length + bytes.length
  }
  const dir = cat(...central)
  const end = cat(u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(dir.length), u32(offset), u16(0))
  return new Blob([...parts, dir as BlobPart, end as BlobPart], { type: 'application/zip' })
}

// ---------------------------------------------------------------- reading (only archives this app writes)
export interface ReadZipLimits { maxEntries: number; maxEntryBytes: number; maxTotalBytes: number }
export const DEFAULT_READ_LIMITS: ReadZipLimits = { maxEntries: 50, maxEntryBytes: 20_000_000, maxTotalBytes: 40_000_000 }
/**
 * Reads a ZIP of "stored" entries (what buildZip writes). Anything else is refused with a reason, not guessed at: compressed entries,
 * ZIP64, encrypted entries, names that would escape a folder, wrong CRCs, and size claims over the limits (so a hostile file cannot
 * make the app allocate gigabytes).
 */
export async function readZip(blob: Blob, limits: ReadZipLimits = DEFAULT_READ_LIMITS): Promise<Record<string, Uint8Array>> {
  if (blob.size < 22 || blob.size > limits.maxTotalBytes + 1_000_000) throw new ZipError('That file is not a backup this app can read (wrong size).')
  const b = new Uint8Array(await blob.arrayBuffer()); const dv = new DataView(b.buffer)
  let e = b.length - 22; const stop = Math.max(0, b.length - 22 - 65535)
  while (e >= stop && dv.getUint32(e, true) !== 0x06054b50) e -= 1
  if (e < stop) throw new ZipError('That file is not a ZIP archive.')
  const count = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const dirSize = dv.getUint32(e + 12, true)
  if (count > limits.maxEntries) throw new ZipError(`The archive has too many files (limit ${limits.maxEntries}).`)
  if (p + dirSize > e || p === 0xffffffff) throw new ZipError('The archive is damaged or uses a format this app does not read.')
  const out: Record<string, Uint8Array> = {}; let total = 0; const dec = new TextDecoder('utf-8', { fatal: true })
  for (let i = 0; i < count; i += 1) {
    if (p + 46 > e || dv.getUint32(p, true) !== 0x02014b50) throw new ZipError('The archive is damaged.')
    const flags = dv.getUint16(p + 8, true); const method = dv.getUint16(p + 10, true); const crc = dv.getUint32(p + 16, true); const csize = dv.getUint32(p + 20, true); const size = dv.getUint32(p + 24, true)
    const nlen = dv.getUint16(p + 28, true); const xlen = dv.getUint16(p + 30, true); const clen = dv.getUint16(p + 32, true); const off = dv.getUint32(p + 42, true)
    let name: string; try { name = dec.decode(b.subarray(p + 46, p + 46 + nlen)) } catch { throw new ZipError('The archive has an unreadable file name.') }
    if ((flags & 1) !== 0) throw new ZipError('The archive is encrypted.')
    if (method !== 0) throw new ZipError('The archive is compressed; only backups made by this app can be restored.')
    if (csize !== size || size > limits.maxEntryBytes) throw new ZipError('A file in the archive is too large.')
    total += size; if (total > limits.maxTotalBytes) throw new ZipError('The archive is too large.')
    if (name !== safeZipName(name) || name.endsWith('/')) throw new ZipError(`The archive has an unsafe file name ("${name.slice(0, 40)}").`)
    if (off + 30 > e || dv.getUint32(off, true) !== 0x04034b50) throw new ZipError('The archive is damaged.')
    const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true)
    if (start + size > e) throw new ZipError('The archive is damaged.')
    const data = b.slice(start, start + size); if (crc32(data) !== crc) throw new ZipError(`The file "${name}" in the archive is damaged (checksum).`)
    if (name in out) throw new ZipError('The archive lists the same file twice.')
    out[name] = data; p += 46 + nlen + xlen + clen
  }
  return out
}
