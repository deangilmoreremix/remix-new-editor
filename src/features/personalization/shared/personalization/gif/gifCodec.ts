/**
 * GIF89a encoder and decoder (Stage 7). Replaces src/lib/gifEncoder.js, which drew each frame before its image had loaded,
 * indexed every frame against the FIRST frame's palette (so colours were wrong from frame 2 on), sent any 257th colour to
 * index 0, used string dictionary keys and spread huge arrays into `push` (stack overflow on real sizes).
 *
 *   encodeGif    median-cut palette from ALL frames, optional Floyd–Steinberg dithering, integer-keyed LZW, frames reduced to the
 *                rectangle that changed (identical frames are merged into one longer delay)
 *   decodeGif    an independent reader used by tests and by the export check to prove what the encoder wrote
 *
 * Pure: Uint8Array in, Uint8Array out; no DOM, no canvas.
 */

export interface GifFrameInput { rgba: ArrayLike<number>; delayMs?: number }
export interface GifEncodeOptions {
  width: number
  height: number
  frames: GifFrameInput[]
  /** Default delay per frame. GIF stores centiseconds; browsers treat < 20 ms as 100 ms, so keep it >= 40 ms. */
  delayMs?: number
  /** 0 = loop forever (default), n = n extra plays, -1 = play once. */
  loop?: number
  maxColors?: number
  dither?: boolean
}

export const MAX_GIF_DIMENSION = 4096
export const MAX_GIF_FRAMES = 300

class ByteSink {
  private buf = new Uint8Array(1 << 16)
  length = 0
  private ensure(n: number) { if (this.length + n > this.buf.length) { const b = new Uint8Array(Math.max(this.buf.length * 2, this.length + n)); b.set(this.buf.subarray(0, this.length)); this.buf = b } }
  byte(v: number) { this.ensure(1); this.buf[this.length++] = v & 0xff }
  short(v: number) { this.byte(v); this.byte(v >> 8) }
  bytes(a: ArrayLike<number>) { this.ensure(a.length); for (let i = 0; i < a.length; i += 1) this.buf[this.length++] = a[i] & 0xff }
  ascii(s: string) { for (let i = 0; i < s.length; i += 1) this.byte(s.charCodeAt(i)) }
  result() { return this.buf.slice(0, this.length) }
}

// ── palette: median cut on a 5-bit-per-channel histogram of every frame ────────────────────────────────────────────

interface Box { keys: number[]; count: number }
const key5 = (r: number, g: number, b: number) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
const unkey = (k: number): [number, number, number] => [((k >> 10) & 31) << 3 | 4, ((k >> 5) & 31) << 3 | 4, (k & 31) << 3 | 4]

/** Every distinct colour, when there are no more than `max` of them (flat graphics, UI, text): the GIF then reproduces them EXACTLY. */
export function exactPalette(frames: GifFrameInput[], pixelCount: number, max: number): { palette: Array<[number, number, number]>; index: Map<number, number> } | null {
  const index = new Map<number, number>(); const palette: Array<[number, number, number]> = []
  for (const f of frames) for (let p = 0; p < pixelCount; p += 1) {
    const i = p * 4; const k = (f.rgba[i] << 16) | (f.rgba[i + 1] << 8) | f.rgba[i + 2]
    if (!index.has(k)) { if (palette.length >= max) return null; index.set(k, palette.length); palette.push([f.rgba[i], f.rgba[i + 1], f.rgba[i + 2]]) }
  }
  return { palette, index }
}

export function buildPalette(frames: GifFrameInput[], pixelCount: number, maxColors = 256): Array<[number, number, number]> {
  const hist = new Uint32Array(32768)
  const stride = Math.max(1, Math.floor((pixelCount * frames.length) / 600_000))
  for (const f of frames) for (let p = 0; p < pixelCount; p += stride) { const i = p * 4; hist[key5(f.rgba[i], f.rgba[i + 1], f.rgba[i + 2])] += 1 }
  const keys: number[] = []; for (let k = 0; k < 32768; k += 1) if (hist[k]) keys.push(k)
  if (keys.length === 0) return [[0, 0, 0]]
  if (keys.length <= maxColors) return keys.map((k) => unkey(k))
  const total = keys.reduce((n, k) => n + hist[k], 0)
  let boxes: Box[] = [{ keys, count: total }]
  const channel = (k: number, c: 0 | 1 | 2) => (c === 0 ? (k >> 10) & 31 : c === 1 ? (k >> 5) & 31 : k & 31)
  while (boxes.length < maxColors) {
    // split the box with the largest population × range
    let bi = -1, bestScore = -1, bestC: 0 | 1 | 2 = 0
    boxes.forEach((b, i) => {
      if (b.keys.length < 2) return
      for (const c of [0, 1, 2] as const) { let lo = 31, hi = 0; for (const k of b.keys) { const v = channel(k, c); if (v < lo) lo = v; if (v > hi) hi = v } const score = (hi - lo + 1) * Math.sqrt(b.count); if (score > bestScore) { bestScore = score; bi = i; bestC = c } }
    })
    if (bi < 0) break
    const b = boxes[bi]; const sorted = [...b.keys].sort((x, y) => channel(x, bestC) - channel(y, bestC))
    let acc = 0, cut = 1; for (let i = 0; i < sorted.length - 1; i += 1) { acc += hist[sorted[i]]; cut = i + 1; if (acc * 2 >= b.count) break }
    const left = sorted.slice(0, cut), right = sorted.slice(cut)
    const cnt = (ks: number[]) => ks.reduce((n, k) => n + hist[k], 0)
    boxes.splice(bi, 1, { keys: left, count: cnt(left) }, { keys: right, count: cnt(right) })
  }
  boxes = boxes.filter((b) => b.keys.length)
  return boxes.map((b) => { let r = 0, g = 0, bl = 0, n = 0; for (const k of b.keys) { const [kr, kg, kb] = unkey(k); const w = hist[k]; r += kr * w; g += kg * w; bl += kb * w; n += w } return [Math.round(r / n), Math.round(g / n), Math.round(bl / n)] as [number, number, number] })
}

function nearestIndex(palette: Array<[number, number, number]>, r: number, g: number, b: number): number {
  let best = 0, bd = Infinity
  for (let i = 0; i < palette.length; i += 1) { const p = palette[i]; const dr = r - p[0], dg = g - p[1], db = b - p[2]; const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db; if (d < bd) { bd = d; best = i; if (d === 0) break } }
  return best
}

/** Maps RGBA pixels to palette indexes (alpha is ignored: frames are composited opaque). `cache` has 6 bits per channel. */
export function indexFrame(rgba: ArrayLike<number>, width: number, height: number, palette: Array<[number, number, number]>, dither: boolean, cache: Int16Array, exact?: Map<number, number> | null): Uint8Array {
  const out = new Uint8Array(width * height)
  if (exact && !dither) {
    for (let p = 0; p < out.length; p += 1) out[p] = exact.get((rgba[p * 4] << 16) | (rgba[p * 4 + 1] << 8) | rgba[p * 4 + 2]) ?? 0
    return out
  }
  const lookup = (r: number, g: number, b: number) => { const k = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2); let v = cache[k]; if (v < 0) { v = nearestIndex(palette, (r & 0xfc) | 2, (g & 0xfc) | 2, (b & 0xfc) | 2); cache[k] = v } return v }
  if (!dither) {
    for (let p = 0; p < out.length; p += 1) out[p] = lookup(rgba[p * 4], rgba[p * 4 + 1], rgba[p * 4 + 2])
    return out
  }
  // Floyd–Steinberg with a two-row error buffer
  let cur = new Float32Array((width + 2) * 3), nxt = new Float32Array((width + 2) * 3)
  for (let y = 0; y < height; y += 1) {
    nxt.fill(0)
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x
      const r = Math.max(0, Math.min(255, rgba[p * 4] + cur[(x + 1) * 3])), g = Math.max(0, Math.min(255, rgba[p * 4 + 1] + cur[(x + 1) * 3 + 1])), b = Math.max(0, Math.min(255, rgba[p * 4 + 2] + cur[(x + 1) * 3 + 2]))
      const idx = nearestIndex(palette, r, g, b); out[p] = idx
      const pr = palette[idx]; const er = r - pr[0], eg = g - pr[1], eb = b - pr[2]
      const add = (dx: number, row: Float32Array, w: number) => { const o = (x + 1 + dx) * 3; row[o] += er * w; row[o + 1] += eg * w; row[o + 2] += eb * w }
      add(1, cur, 7 / 16); add(-1, nxt, 3 / 16); add(0, nxt, 5 / 16); add(1, nxt, 1 / 16)
    }
    const t = cur; cur = nxt; nxt = t
  }
  return out
}

// ── LZW (integer-keyed dictionary) ───────────────────────────────────────────────────────────────────────────────────

export function lzwEncode(indices: Uint8Array, minCodeSize: number): Uint8Array {
  const clear = 1 << minCodeSize, eoi = clear + 1
  const sink = new ByteSink(); sink.byte(minCodeSize)
  let block: number[] = []; let acc = 0, nbits = 0
  const flushBlock = () => { if (block.length) { sink.byte(block.length); sink.bytes(block); block = [] } }
  const put = (code: number, size: number) => { acc |= code << nbits; nbits += size; while (nbits >= 8) { block.push(acc & 0xff); acc >>>= 8; nbits -= 8; if (block.length === 255) flushBlock() } }
  const table = new Int32Array(4096 * 256); const stamp = new Int32Array(4096 * 256); let gen = 1
  let codeSize = minCodeSize + 1, next = eoi + 1
  put(clear, codeSize)
  if (indices.length === 0) { put(eoi, codeSize); if (nbits > 0) block.push(acc & 0xff); flushBlock(); sink.byte(0); return sink.result() }
  let prefix = indices[0]
  for (let i = 1; i < indices.length; i += 1) {
    const k = indices[i]; const key = prefix * 256 + k
    if (stamp[key] === gen) { prefix = table[key]; continue }
    put(prefix, codeSize)
    if (next < 4096) { table[key] = next; stamp[key] = gen; if (next === (1 << codeSize)) codeSize += 1; next += 1 }
    else { put(clear, codeSize); gen += 1; codeSize = minCodeSize + 1; next = eoi + 1 }
    prefix = k
  }
  put(prefix, codeSize); put(eoi, codeSize)
  if (nbits > 0) block.push(acc & 0xff)
  flushBlock(); sink.byte(0)
  return sink.result()
}

// ── encoder ────────────────────────────────────────────────────────────────────────────────────────────────────────────

export class GifError extends Error { constructor(message: string) { super(message); this.name = 'GifError' } }

export interface GifStats { frames: number; mergedFrames: number; colors: number; bytes: number; exactColors: boolean }

export function encodeGif(opts: GifEncodeOptions): { bytes: Uint8Array; stats: GifStats } {
  const { width, height } = opts
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > MAX_GIF_DIMENSION || height > MAX_GIF_DIMENSION) throw new GifError(`The GIF size ${width}×${height} is not valid (1–${MAX_GIF_DIMENSION} px).`)
  if (!opts.frames.length) throw new GifError('A GIF needs at least one frame.')
  if (opts.frames.length > MAX_GIF_FRAMES) throw new GifError(`Too many frames (${opts.frames.length}; the limit is ${MAX_GIF_FRAMES}).`)
  const px = width * height
  for (const [i, f] of opts.frames.entries()) if (f.rgba.length < px * 4) throw new GifError(`Frame ${i + 1} has ${f.rgba.length} values; ${px * 4} are needed for ${width}×${height}.`)
  const maxColors = Math.min(256, Math.max(2, opts.maxColors ?? 256))
  const exact = exactPalette(opts.frames, px, maxColors)
  const palette = exact ? exact.palette : buildPalette(opts.frames, px, maxColors)
  const bits = Math.max(1, Math.ceil(Math.log2(Math.max(2, palette.length))))
  const tableSize = 1 << bits
  const cache = new Int16Array(262144).fill(-1)
  const defaultDelay = opts.delayMs ?? 100

  const out = new ByteSink()
  out.ascii('GIF89a'); out.short(width); out.short(height); out.byte(0x80 | 0x70 | (bits - 1)); out.byte(0); out.byte(0)
  for (let i = 0; i < tableSize; i += 1) { const c = palette[i] ?? [0, 0, 0]; out.byte(c[0]); out.byte(c[1]); out.byte(c[2]) }
  const loop = opts.loop ?? 0
  if (loop >= 0) { out.byte(0x21); out.byte(0xff); out.byte(11); out.ascii('NETSCAPE2.0'); out.byte(3); out.byte(1); out.short(loop); out.byte(0) }

  let prev: Uint8Array | null = null
  type Pending = { indices: Uint8Array; delay: number; box: { x: number; y: number; w: number; h: number } }
  const pending: Pending[] = []
  let merged = 0
  for (const f of opts.frames) {
    const idx = indexFrame(f.rgba, width, height, palette, opts.dither === true, cache, exact?.index)
    const delay = Math.max(20, f.delayMs ?? defaultDelay)
    if (prev) {
      let x0 = width, y0 = height, x1 = -1, y1 = -1
      for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) if (idx[y * width + x] !== prev[y * width + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
      if (x1 < 0) { pending[pending.length - 1].delay += delay; merged += 1; prev = idx; continue }
      pending.push({ indices: idx, delay, box: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } })
    } else pending.push({ indices: idx, delay, box: { x: 0, y: 0, w: width, h: height } })
    prev = idx
  }
  const minCode = Math.max(2, bits)
  for (const p of pending) {
    out.byte(0x21); out.byte(0xf9); out.byte(4); out.byte(0x04 /* disposal 1: leave in place */); out.short(Math.min(65535, Math.max(2, Math.round(p.delay / 10)))); out.byte(0); out.byte(0)
    out.byte(0x2c); out.short(p.box.x); out.short(p.box.y); out.short(p.box.w); out.short(p.box.h); out.byte(0)
    let region = p.indices
    if (p.box.w !== width || p.box.h !== height) { region = new Uint8Array(p.box.w * p.box.h); for (let y = 0; y < p.box.h; y += 1) region.set(p.indices.subarray((p.box.y + y) * width + p.box.x, (p.box.y + y) * width + p.box.x + p.box.w), y * p.box.w) }
    out.bytes(lzwEncode(region, minCode))
  }
  out.byte(0x3b)
  const bytes = out.result()
  return { bytes, stats: { frames: pending.length, mergedFrames: merged, colors: palette.length, bytes: bytes.length, exactColors: Boolean(exact) } }
}

// ── decoder (independent of the encoder) ───────────────────────────────────────────────────────────────────────────────

export interface DecodedGif { width: number; height: number; loopCount: number | null; frames: Array<{ rgba: Uint8ClampedArray; delayMs: number }> }

export function decodeGif(data: Uint8Array): DecodedGif {
  let p = 0
  const sig = String.fromCharCode(...data.subarray(0, 6)); if (sig !== 'GIF89a' && sig !== 'GIF87a') throw new GifError('Not a GIF file.')
  p = 6
  const width = data[p] | (data[p + 1] << 8), height = data[p + 2] | (data[p + 3] << 8); const flags = data[p + 4]; p += 7
  let gct: number[] | null = null
  if (flags & 0x80) { const n = 1 << ((flags & 7) + 1); gct = Array.from(data.subarray(p, p + n * 3)); p += n * 3 }
  const canvas = new Uint8ClampedArray(width * height * 4); for (let i = 3; i < canvas.length; i += 4) canvas[i] = 255
  const frames: DecodedGif['frames'] = []; let loopCount: number | null = null; let delay = 100; let transparent = -1; let sawTrailer = false
  while (p < data.length) {
    const b = data[p++]
    if (b === 0x3b) { sawTrailer = true; break }
    if (b === 0x21) {
      const label = data[p++]
      if (label === 0xf9) { const flagsG = data[p + 1]; delay = (data[p + 2] | (data[p + 3] << 8)) * 10; transparent = flagsG & 1 ? data[p + 4] : -1 }
      else if (label === 0xff) { const id = String.fromCharCode(...data.subarray(p + 1, p + 12)); if (id === 'NETSCAPE2.0') loopCount = data[p + 14] | (data[p + 15] << 8) }
      while (p < data.length && data[p] !== 0) p += data[p] + 1; if (p >= data.length) throw new GifError('The GIF is truncated.'); p += 1
    } else if (b === 0x2c) {
      const x0 = data[p] | (data[p + 1] << 8), y0 = data[p + 2] | (data[p + 3] << 8), w = data[p + 4] | (data[p + 5] << 8), h = data[p + 6] | (data[p + 7] << 8); const lf = data[p + 8]; p += 9
      let table = gct; if (lf & 0x80) { const n = 1 << ((lf & 7) + 1); table = Array.from(data.subarray(p, p + n * 3)); p += n * 3 }
      if (!table) throw new GifError('No colour table.')
      const mcs = data[p++]; const bytes: number[] = []
      while (p < data.length && data[p] !== 0) { const n = data[p++]; for (let i = 0; i < n; i += 1) bytes.push(data[p + i]); p += n } if (p >= data.length) throw new GifError('The GIF is truncated.'); p += 1
      const clear = 1 << mcs, eoi = clear + 1
      const prefix = new Int32Array(4096), suffix = new Uint8Array(4096), stack = new Uint8Array(4097)
      let size = mcs + 1, next = eoi + 1, old = -1, first = 0, acc = 0, nb = 0, bi = 0, written = 0
      const total = w * h; const px = new Uint8Array(total)
      while (written < total) {
        while (nb < size && bi < bytes.length) { acc |= bytes[bi++] << nb; nb += 8 }
        if (nb < size) break
        const code = acc & ((1 << size) - 1); acc >>>= size; nb -= size
        if (code === clear) { size = mcs + 1; next = eoi + 1; old = -1; continue }
        if (code === eoi) break
        let sp = 0; let c = code
        if (old === -1) { px[written++] = code; old = code; first = code; continue }
        if (c >= next) { stack[sp++] = first; c = old }
        while (c >= clear) { if (sp >= 4096) throw new GifError('The GIF image data is corrupt.'); stack[sp++] = suffix[c]; c = prefix[c] }
        first = c; stack[sp++] = c
        if (next < 4096) { prefix[next] = old; suffix[next] = first; next += 1; if (next === (1 << size) && size < 12) size += 1 }
        old = code
        while (sp > 0 && written < total) px[written++] = stack[--sp]
      }
      if (written < total) throw new GifError('The image data ended early.')
      for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) { const v = px[y * w + x]; if (v === transparent) continue; const o = ((y0 + y) * width + x0 + x) * 4; canvas[o] = table[v * 3]; canvas[o + 1] = table[v * 3 + 1]; canvas[o + 2] = table[v * 3 + 2]; canvas[o + 3] = 255 }
      frames.push({ rgba: new Uint8ClampedArray(canvas), delayMs: delay })
    } else throw new GifError(`Unexpected block 0x${b.toString(16)} at byte ${p - 1}.`)
  }
  if (!sawTrailer || frames.length === 0) throw new GifError('The GIF is truncated or has no frames.')
  return { width, height, loopCount, frames }
}
