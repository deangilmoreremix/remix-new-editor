/**
 * Stage 7 — the GIF codec: an independent decoder reads an ffmpeg-written GIF correctly, then the encoder is checked through the
 * decoder: exact colours for flat graphics, bounded error for photographic gradients, per-frame palette correctness (the old
 * encoder's bug), frame merging / change rectangles, LZW table resets on big noisy frames, loops, delays and hostile input.
 */
import { describe, expect, it } from 'vitest'
import { FFMPEG_REF_GIF } from './ffmpegRefGif'
import { GifError, MAX_GIF_FRAMES, buildPalette, decodeGif, encodeGif, exactPalette, lzwEncode } from '../gifCodec'

const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const frame = (w: number, h: number, fn: (x: number, y: number) => [number, number, number]) => { const a = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, g, b] = fn(x, y); const i = (y * w + x) * 4; a[i] = r; a[i + 1] = g; a[i + 2] = b; a[i + 3] = 255 } return a }
const px = (g: { width: number; frames: Array<{ rgba: Uint8ClampedArray }> }, f: number, x: number, y: number) => Array.from(g.frames[f].rgba.slice((y * g.width + x) * 4, (y * g.width + x) * 4 + 3))
const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 }

describe('decoder (checked against a GIF that ffmpeg wrote)', () => {
  const g = decodeGif(fromB64(FFMPEG_REF_GIF))
  it('reads size, frame count, delay, loop and the pixels ffmpeg decodes', () => {
    expect([g.width, g.height]).toEqual([16, 12]); expect(g.frames.length).toBe(2); expect(g.frames[0].delayMs).toBe(500); expect(g.loopCount).toBe(0)
    expect(px(g, 0, 0, 0)).toEqual([252, 0, 0]); expect(px(g, 0, 6, 5)).toEqual([0, 0, 255]) // values ffmpeg itself decodes for this file
  })
  it('corrupt or truncated data ends in an error, never a hang (every cut point of a real GIF)', () => {
    const full = fromB64(FFMPEG_REF_GIF); for (let n = 6; n < full.length; n += 7) { let threw = false; try { decodeGif(full.subarray(0, n)) } catch { threw = true } expect(threw, `cut at ${n}`).toBe(true) }
    const bad = full.slice(); bad.fill(0xff, 800, 820); expect(() => decodeGif(bad)).toThrow()
  })
  it('refuses a non-GIF and truncated data', () => {
    expect(() => decodeGif(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow(GifError)
    expect(() => decodeGif(fromB64(FFMPEG_REF_GIF).subarray(0, 400))).toThrow()
  })
})

describe('encoder → decoder', () => {
  it('flat graphics (≤ 256 colours) come back EXACTLY', () => {
    const w = 40, h = 30
    const f = frame(w, h, (x, y) => (x < 10 ? [200, 50, 50] : y < 15 ? [10, 120, 200] : [255, 255, 255]))
    const { bytes, stats } = encodeGif({ width: w, height: h, frames: [{ rgba: f }] }); expect(stats.exactColors).toBe(true)
    const d = decodeGif(bytes); expect(d.frames.length).toBe(1)
    for (let i = 0; i < w * h * 3; i += 3) { const o = (i / 3) * 4; expect([d.frames[0].rgba[o], d.frames[0].rgba[o + 1], d.frames[0].rgba[o + 2]]).toEqual([f[o], f[o + 1], f[o + 2]]) }
  })
  it('EVERY frame is correct, not just the first (the old encoder indexed all frames against frame 1\'s palette)', () => {
    const w = 32, h = 24; const cols: Array<[number, number, number]> = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [250, 200, 10]]
    const frames = cols.map((c, i) => ({ rgba: frame(w, h, (x) => (x < 16 ? c : cols[(i + 1) % 4])) }))
    const d = decodeGif(encodeGif({ width: w, height: h, frames }).bytes); expect(d.frames.length).toBe(4)
    cols.forEach((c, i) => { expect(px(d, i, 2, 2)).toEqual(c); expect(px(d, i, 30, 2)).toEqual(cols[(i + 1) % 4]) })
  })
  it('more than 256 colours: a smooth gradient stays close (mean error small, never mapped to index 0)', () => {
    const w = 96, h = 64; const f = frame(w, h, (x, y) => [Math.round((x / (w - 1)) * 255), Math.round((y / (h - 1)) * 255), 128])
    const { bytes, stats } = encodeGif({ width: w, height: h, frames: [{ rgba: f }] }); expect(stats.exactColors).toBe(false); expect(stats.colors).toBeLessThanOrEqual(256)
    const d = decodeGif(bytes); let err = 0, worst = 0; for (let i = 0; i < w * h; i++) for (let c = 0; c < 3; c++) { const e = Math.abs(d.frames[0].rgba[i * 4 + c] - f[i * 4 + c]); err += e; worst = Math.max(worst, e) }
    expect(err / (w * h * 3)).toBeLessThan(6); expect(worst).toBeLessThan(40)
  })
  it('dithering reduces banding error on a gradient and still decodes', () => {
    const w = 128, h = 48; const f = frame(w, h, (x) => { const v = Math.round((x / (w - 1)) * 255); return [v, v, v] })
    const meanErr = (dither: boolean) => { const d = decodeGif(encodeGif({ width: w, height: h, frames: [{ rgba: f }], dither, maxColors: 8 }).bytes); let a = 0; for (let x = 0; x < w; x++) { let col = 0; for (let y = 0; y < h; y++) col += d.frames[0].rgba[(y * w + x) * 4]; a += Math.abs(col / h - f[x * 4]) } return a / w }
    expect(meanErr(true)).toBeLessThan(meanErr(false)) // averaged over a column, dithering tracks the true value better
  })
  it('identical frames are merged into one longer delay; changed frames only carry the changed rectangle', () => {
    const w = 60, h = 40; const a = frame(w, h, () => [10, 10, 10]); const b = frame(w, h, (x, y) => (x >= 20 && x < 30 && y >= 5 && y < 15 ? [250, 250, 250] : [10, 10, 10]))
    const { bytes, stats } = encodeGif({ width: w, height: h, frames: [{ rgba: a, delayMs: 100 }, { rgba: a, delayMs: 100 }, { rgba: b, delayMs: 100 }] })
    expect(stats.frames).toBe(2); expect(stats.mergedFrames).toBe(1)
    const d = decodeGif(bytes); expect(d.frames.length).toBe(2); expect(d.frames[0].delayMs).toBe(200); expect(d.frames[1].delayMs).toBe(100)
    expect(px(d, 1, 25, 10)).toEqual([250, 250, 250]); expect(px(d, 1, 0, 0)).toEqual([10, 10, 10]); expect(px(d, 1, 40, 30)).toEqual([10, 10, 10]) // composited onto the previous frame
    const full = encodeGif({ width: w, height: h, frames: [{ rgba: a }, { rgba: b }], maxColors: 256 }).bytes.length; expect(full).toBeLessThan(w * h) // the second frame is tiny
  })
  it('a big noisy frame forces LZW table resets and still round-trips exactly (≤256 colours)', () => {
    const w = 320, h = 240, r = seeded(7); const pal = Array.from({ length: 200 }, () => [Math.floor(r() * 256), Math.floor(r() * 256), Math.floor(r() * 256)] as [number, number, number])
    const f = frame(w, h, () => pal[Math.floor(r() * pal.length)]); const d = decodeGif(encodeGif({ width: w, height: h, frames: [{ rgba: f }] }).bytes)
    for (let i = 0; i < w * h * 4; i++) if (i % 4 !== 3) expect(d.frames[0].rgba[i]).toBe(f[i])
  })
  it('delays, loop count and sizes are written as given; browsers clamp tiny delays so the encoder floors at 20 ms', () => {
    const f = frame(8, 8, (x) => [x * 30, 0, 0]); const d = decodeGif(encodeGif({ width: 8, height: 8, frames: [{ rgba: f, delayMs: 250 }, { rgba: frame(8, 8, (x) => [0, x * 30, 0]), delayMs: 5 }], loop: 3 }).bytes)
    expect(d.frames.map((x) => x.delayMs)).toEqual([250, 20]); expect(d.loopCount).toBe(3); expect([d.width, d.height]).toEqual([8, 8])
    expect(decodeGif(encodeGif({ width: 8, height: 8, frames: [{ rgba: f }], loop: -1 }).bytes).loopCount).toBeNull()
  })
  it('odd sizes (1×1, 1×N, prime sizes) and two-colour images work', () => {
    for (const [w, h] of [[1, 1], [1, 9], [13, 1], [17, 19]]) { const f = frame(w, h, (x, y) => ((x + y) % 2 ? [255, 255, 255] : [0, 0, 0])); const d = decodeGif(encodeGif({ width: w, height: h, frames: [{ rgba: f }] }).bytes); for (let i = 0; i < w * h * 4; i++) if (i % 4 !== 3) expect(d.frames[0].rgba[i]).toBe(f[i]) }
  })
  it('refuses invalid input with a plain message', () => {
    const f = frame(4, 4, () => [1, 2, 3])
    for (const bad of [{ width: 0, height: 4 }, { width: 4.5, height: 4 }, { width: 5000, height: 4 }]) expect(() => encodeGif({ ...bad, frames: [{ rgba: f }] })).toThrow(/not valid/)
    expect(() => encodeGif({ width: 4, height: 4, frames: [] })).toThrow(/at least one frame/); expect(() => encodeGif({ width: 4, height: 4, frames: [{ rgba: new Uint8ClampedArray(10) }] })).toThrow(/Frame 1 has 10 values/)
    expect(() => encodeGif({ width: 1, height: 1, frames: Array.from({ length: MAX_GIF_FRAMES + 1 }, () => ({ rgba: new Uint8ClampedArray(4) })) })).toThrow(/Too many frames/)
  })
  it('palette helpers: exact palette is null above the limit; median cut returns at most maxColors', () => {
    const f = frame(64, 64, (x, y) => [x * 4, y * 4, 0]); expect(exactPalette([{ rgba: f }], 64 * 64, 256)).toBeNull(); expect(buildPalette([{ rgba: f }], 64 * 64, 64).length).toBeLessThanOrEqual(64); expect(buildPalette([{ rgba: f }], 64 * 64, 16).length).toBeLessThanOrEqual(16)
    expect(exactPalette([{ rgba: frame(4, 4, () => [9, 9, 9]) }], 16, 256)!.palette).toEqual([[9, 9, 9]])
  })
  it('lzwEncode writes valid sub-blocks (no block longer than 255) for a long run', () => {
    const out = lzwEncode(new Uint8Array(200000).fill(3), 2); let p = 1; let blocks = 0; while (out[p] !== 0) { expect(out[p]).toBeLessThanOrEqual(255); p += out[p] + 1; blocks++ } expect(p).toBe(out.length - 1); expect(blocks).toBeGreaterThan(0)
  })
  it('output starts with the GIF89a signature, ends with the trailer, and is deterministic', () => {
    const f = frame(10, 10, (x, y) => [x * 20, y * 20, 7]); const a = encodeGif({ width: 10, height: 10, frames: [{ rgba: f }] }).bytes, b = encodeGif({ width: 10, height: 10, frames: [{ rgba: f }] }).bytes
    expect(String.fromCharCode(...a.subarray(0, 6))).toBe('GIF89a'); expect(a[a.length - 1]).toBe(0x3b); expect(Array.from(a)).toEqual(Array.from(b))
  })
})
