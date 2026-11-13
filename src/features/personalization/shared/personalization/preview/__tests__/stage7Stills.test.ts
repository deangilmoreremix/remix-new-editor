/**
 * Stage 7 — thumbnail/GIF settings and decisions: validation, candidate frames, frame scoring (black / washed-out / flat / sharp),
 * best-frame choice, play-button geometry, the GIF frame plan and email-size advice; then makeThumbnail / makeGif with a fake
 * renderer: automatic and manual frames, progress, every failure, cancel, and the GIF that comes out is decoded and checked.
 */
import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_GIF, DEFAULT_THUMBNAIL, GIF_MAX_FRAMES_PLANNED, candidateFrames, fitWidth, gifPlan, gifSizeAdvice, normalizeGif, normalizeThumbnail, pickBestFrame, playButtonGeometry, scoreFrame,
} from '../stills'
import { createDefaultPreviewSettings, normalizePreviewSettings } from '../presets'
import { decodeGif } from '../../gif/gifCodec'
import { StillError, makeGif, makeThumbnail, type FrameRenderer, type RawFrame, type StillDeps } from '../../guided/renderStills'
import { patchGif, patchThumbnail } from '../../guided/stillsEdit'

const img = (w: number, h: number, fn: (x: number, y: number) => [number, number, number]): RawFrame => { const a = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, g, b] = fn(x, y); const i = (y * w + x) * 4; a[i] = r; a[i + 1] = g; a[i + 2] = b; a[i + 3] = 255 } return { data: a, width: w, height: h } }
const blobBytes = (b: Blob) => new Promise<Uint8Array>((res, rej) => { const r = new FileReader(); r.onload = () => res(new Uint8Array(r.result as ArrayBuffer)); r.onerror = () => rej(r.error); r.readAsArrayBuffer(b) })
const sc = (f: RawFrame) => scoreFrame(f.data, f.width, f.height)

describe('settings validation', () => {
  it('thumbnail: clamps, defaults, null frame = automatic', () => {
    expect(normalizeThumbnail(null)).toBeUndefined(); expect(normalizeThumbnail([])).toBeUndefined()
    expect(normalizeThumbnail({})).toEqual(DEFAULT_THUMBNAIL); expect(normalizeThumbnail({ frame: -4, width: 99999, playButton: false })).toEqual({ frame: null, width: 1920, playButton: false }); expect(normalizeThumbnail({ frame: 42.6, width: 10 })).toMatchObject({ frame: 43, width: 160 })
  })
  it('gif: clamps every field', () => {
    expect(normalizeGif({})).toEqual(DEFAULT_GIF)
    expect(normalizeGif({ startSec: -5, durationSec: 999, fps: 99, width: 5, dither: 'yes', loop: false })).toEqual({ startSec: 0, durationSec: 10, fps: 15, width: 120, dither: false, loop: false })
    expect(normalizeGif({ durationSec: 0, fps: 0, width: 99999 })).toMatchObject({ durationSec: 0.5, fps: 2, width: 720 })
  })
  it('wired into normalizePreviewSettings; survives JSON; edits validate', () => {
    const s = createDefaultPreviewSettings(); const n = normalizePreviewSettings({ ...s, thumbnail: { frame: 30, playButton: false }, gif: { fps: 10 } } as never)
    expect(n.thumbnail).toMatchObject({ frame: 30, playButton: false }); expect(n.gif?.fps).toBe(10); expect(normalizePreviewSettings(s as never).gif).toBeUndefined(); expect(normalizePreviewSettings(JSON.parse(JSON.stringify(n)) as never).gif).toEqual(n.gif)
    expect(patchGif(s, { fps: 500 }).gif?.fps).toBe(15); expect(patchThumbnail(s, { width: 3 }).thumbnail?.width).toBe(160); expect(s.gif).toBeUndefined()
  })
  it('fitWidth keeps the aspect ratio', () => { expect(fitWidth(1920, 1080, 480)).toEqual({ w: 480, h: 270 }); expect(fitWidth(1080, 1920, 270)).toEqual({ w: 270, h: 480 }); expect(fitWidth(0, 0, 100).w).toBe(100) })
})

describe('frame choice', () => {
  it('candidates are spread out and skip the ends and fades', () => {
    const c = candidateFrames({ total: 300, fps: 30 }, 12); expect(c.length).toBe(12); expect(c[0]).toBeGreaterThanOrEqual(12); expect(c[c.length - 1]).toBeLessThanOrEqual(287); expect([...c].sort((a, b) => a - b)).toEqual(c)
    const f = candidateFrames({ total: 300, fps: 30, fadeInFrames: 60, fadeOutFrames: 60 }, 6); expect(f[0]).toBeGreaterThanOrEqual(60); expect(f[f.length - 1]).toBeLessThanOrEqual(239)
    expect(candidateFrames({ total: 3, fps: 30 }, 12).length).toBeGreaterThanOrEqual(1); expect(candidateFrames({ total: 1, fps: 30 }, 12)).toHaveLength(1)
  })
  it('scoring: black, washed-out and flat frames lose to a detailed, well-exposed one; reasons are given', () => {
    const detailed = img(64, 48, (x, y) => { const v = ((x >> 2) + (y >> 2)) % 2 ? 200 : 60; return [v, v, v] })
    const black = img(64, 48, () => [3, 3, 3]), white = img(64, 48, () => [250, 250, 250]), flat = img(64, 48, () => [120, 120, 120]), dimDetailed = img(64, 48, (x, y) => { const v = ((x >> 2) + (y >> 2)) % 2 ? 22 : 4; return [v, v, v] })
    const d = sc(detailed); expect(d.score).toBeGreaterThan(0.6); for (const bad of [black, white, flat]) expect(sc(bad).score, JSON.stringify(sc(bad))).toBeLessThan(d.score / 2)
    expect(sc(black).reasons).toContain('too dark'); expect(sc(white).reasons).toContain('washed out'); expect(sc(flat).reasons).toContain('flat'); expect(sc(dimDetailed).score).toBeLessThan(d.score)
    expect(sc(img(1, 1, () => [0, 0, 0])).score).toBe(0)
  })
  it('exposure matters on its own: a dark frame with the SAME pattern scores lower than a well-exposed one, and so does a blown-out one', () => {
    const pattern = (lo: number, hi: number) => img(64, 48, (x, y) => { const v = ((x >> 3) + (y >> 3)) % 2 ? hi : lo; return [v, v, v] })
    // the three have the SAME contrast and edges (58 levels apart); only the exposure differs
    const mid = sc(pattern(100, 158)), dark = sc(pattern(0, 58)), bright = sc(pattern(197, 255))
    expect(dark.sharpness).toBeCloseTo(mid.sharpness, 3); expect(bright.contrast).toBeCloseTo(mid.contrast, 3)
    expect(dark.meanLuma).toBeLessThan(35); expect(dark.reasons).toContain('too dark'); expect(bright.reasons).toContain('washed out')
    expect(dark.score).toBeLessThan(mid.score * 0.95); expect(bright.score).toBeLessThan(mid.score * 0.99)
  })
  it('a sharper frame beats a blurred copy of the same scene', () => {
    const sharp = img(64, 48, (x, y) => ((x >> 3) + (y >> 3)) % 2 ? [220, 220, 220] : [40, 40, 40]); const soft = img(64, 48, (x, y) => { const v = 130 + 70 * Math.sin(x / 9) * Math.sin(y / 9); return [v, v, v] })
    expect(sc(sharp).sharpness).toBeGreaterThan(sc(soft).sharpness); expect(sc(sharp).score).toBeGreaterThan(sc(soft).score)
  })
  it('pickBestFrame picks the highest score, the earlier frame on a tie, null for nothing', () => {
    const s = (score: number) => ({ score, sharpness: 0, meanLuma: 0, contrast: 0, reasons: [] })
    expect(pickBestFrame([{ frame: 10, score: s(0.2) }, { frame: 20, score: s(0.9) }, { frame: 30, score: s(0.9) }])!.frame).toBe(20); expect(pickBestFrame([])).toBeNull()
  })
  it('play button sits in the middle and scales with the picture', () => {
    const a = playButtonGeometry(1280, 720), b = playButtonGeometry(640, 360); expect([a.cx, a.cy]).toEqual([640, 360]); expect(a.r / b.r).toBeCloseTo(2, 0)
    for (const [x, y] of a.triangle) { expect(Math.hypot(x - a.cx, y - a.cy)).toBeLessThan(a.r) }
  })
})

describe('GIF plan and size advice', () => {
  it('frames are evenly spaced inside the chosen window; delay matches the rate; clipped to the video', () => {
    const p = gifPlan({ ...DEFAULT_GIF, startSec: 1, durationSec: 2, fps: 10 }, 30, 300); expect(p.frames.length).toBe(20); expect(p.frames[0]).toBe(30); expect(p.frames[19]).toBeLessThan(90); expect(p.delayMs).toBe(100); expect(p.actualFps).toBe(10); expect(p.truncated).toBe(false)
    for (let i = 1; i < p.frames.length; i++) expect(p.frames[i]).toBeGreaterThan(p.frames[i - 1])
    const clipped = gifPlan({ ...DEFAULT_GIF, startSec: 9, durationSec: 5, fps: 10 }, 30, 300); expect(clipped.frames[clipped.frames.length - 1]).toBeLessThanOrEqual(299); expect(clipped.frames.length).toBe(10); expect(clipped.truncated).toBe(true)
    expect(gifPlan({ ...DEFAULT_GIF, startSec: 99, durationSec: 5 }, 30, 300).frames.length).toBe(1)
  })
  it('never plans more than the cap; never a delay under 40 ms; single-frame videos work', () => {
    expect(gifPlan({ ...DEFAULT_GIF, durationSec: 10, fps: 15 }, 60, 6000).frames.length).toBeLessThanOrEqual(GIF_MAX_FRAMES_PLANNED); expect(gifPlan({ ...DEFAULT_GIF, fps: 15 }, 120, 600).delayMs).toBeGreaterThanOrEqual(40); expect(gifPlan(DEFAULT_GIF, 30, 1).frames).toEqual([0])
  })
  it('size advice: ok under 1 MB, warn to 3 MB, bad beyond', () => { expect(gifSizeAdvice(500_000).level).toBe('ok'); expect(gifSizeAdvice(2_000_000).level).toBe('warn'); expect(gifSizeAdvice(9_000_000).level).toBe('bad'); expect(gifSizeAdvice(2_000_000).message).toMatch(/smaller width/) })
})

// A renderer that draws a recognisable picture per frame: colour = f(frame), plus a detailed pattern on "good" frames.
const mkRenderer = (spec: (frame: number) => (x: number, y: number) => [number, number, number], size = { w: 1280, h: 720 }): FrameRenderer & { calls: Array<[number, number]> } => {
  const calls: Array<[number, number]> = []
  const fn = (async (frame: number, width: number) => { calls.push([frame, width]); const h = Math.round((width * size.h) / size.w); return img(width, h, spec(frame)) }) as FrameRenderer & { calls: Array<[number, number]> }
  fn.calls = calls; return fn
}
const deps = (renderFrame: FrameRenderer): StillDeps & { encoded: Array<{ playButton: boolean; format: string; w: number }> } => {
  const encoded: Array<{ playButton: boolean; format: string; w: number }> = []
  return { renderFrame, encodeImage: async (f, o) => { encoded.push({ playButton: o.playButton, format: o.format, w: f.width }); return new Blob([new Uint8Array(1234)], { type: `image/${o.format}` }) }, encoded }
}
const props = (patch: Record<string, unknown> = {}) => ({ settings: { ...createDefaultPreviewSettings(), fps: 30, durationInFrames: 300, width: 1280, height: 720, ...patch } as never })

describe('makeThumbnail', () => {
  const good = (x: number, y: number): [number, number, number] => { const v = ((x >> 3) + (y >> 3)) % 2 ? 210 : 50; return [v, v, v] }
  it('automatic: scores the candidates at a small size, picks the good one, renders ONLY it at full width', async () => {
    const r = mkRenderer((f) => (f >= 150 && f < 170 ? good : () => [4, 4, 4])); const d = deps(r); const prog: number[] = []
    const out = await makeThumbnail(props(), d, { onProgress: (p) => prog.push(p) })
    expect(out.auto).toBe(true); expect(out.frame).toBeGreaterThanOrEqual(150); expect(out.frame).toBeLessThan(170); expect(out.scores.length).toBe(12)
    expect(r.calls.filter(([, w]) => w === 192).length).toBe(12); expect(r.calls.filter(([, w]) => w === 1280).length).toBe(1); expect(r.calls[r.calls.length - 1][0]).toBe(out.frame)
    expect(d.encoded).toEqual([{ playButton: true, format: 'jpeg', w: 1280 }]); expect(out.bytes).toBe(1234); expect([out.width, out.height]).toEqual([1280, 720]); expect(prog[prog.length - 1]).toBe(1); for (let i = 1; i < prog.length; i++) expect(prog[i]).toBeGreaterThanOrEqual(prog[i - 1])
  })
  it('manual frame: no scoring pass; clamped to the video; play button and format honoured', async () => {
    const r = mkRenderer(() => good); const d = deps(r)
    const out = await makeThumbnail(props({ thumbnail: { frame: 5000, playButton: false, width: 640 } }), d, { format: 'png' })
    expect(out.auto).toBe(false); expect(out.frame).toBe(299); expect(r.calls).toEqual([[299, 640]]); expect(d.encoded).toEqual([{ playButton: false, format: 'png', w: 640 }]); expect(out.scores).toEqual([])
  })
  it('a fade-in at the start is never chosen', async () => {
    const r = mkRenderer((f) => (f < 60 ? () => [2, 2, 2] : good)); const out = await makeThumbnail(props({ footageEffects: { fade: { inFrames: 60, outFrames: 0 } } }), deps(r)); expect(out.frame).toBeGreaterThanOrEqual(60)
  })
  it('failures: a frame that cannot be drawn, an encoder failure, cancel before and during', async () => {
    await expect(makeThumbnail(props(), deps(async () => { throw new Error('video failed to decode') }))).rejects.toMatchObject({ code: 'RENDER', message: expect.stringContaining('video failed to decode') })
    await expect(makeThumbnail(props({ thumbnail: { frame: 3 } }), { renderFrame: mkRenderer(() => good), encodeImage: async () => { throw new Error('no canvas') } })).rejects.toMatchObject({ code: 'ENCODE', message: expect.stringContaining('no canvas') })
    const pre = new AbortController(); pre.abort(); await expect(makeThumbnail(props(), deps(mkRenderer(() => good)), { signal: pre.signal })).rejects.toMatchObject({ code: 'ABORTED' })
    const mid = new AbortController(); let n = 0; const r = mkRenderer(() => good); const slow: FrameRenderer = async (f, w) => { if (++n === 4) mid.abort(); return r(f, w) }
    await expect(makeThumbnail(props(), deps(slow), { signal: mid.signal })).rejects.toBeInstanceOf(StillError)
  })
})

describe('makeGif', () => {
  const colourAt = (f: number): [number, number, number] => [(f * 7) % 256, 255 - ((f * 5) % 256), 90]
  it('renders the planned frames at the GIF width and produces a GIF whose frames are the rendered ones', async () => {
    const r = mkRenderer((f) => () => colourAt(f)); const prog: string[] = []
    const out = await makeGif(props({ gif: { startSec: 1, durationSec: 1, fps: 5, width: 240, dither: false, loop: true } }), { renderFrame: r }, { onProgress: (_p, l) => prog.push(l) })
    expect(r.calls.map(([f]) => f)).toEqual(out.plan.frames); expect(new Set(r.calls.map(([, w]) => w))).toEqual(new Set([240])); expect([out.width, out.height]).toEqual([240, 135]); expect(prog[0]).toMatch(/Drawing frame 1 of 5/)
    const g = decodeGif(await blobBytes(out.blob)); expect(out.blob.type).toBe('image/gif'); expect(g.frames.length).toBe(5); expect(g.loopCount).toBe(0); expect(g.frames[0].delayMs).toBe(200)
    out.plan.frames.forEach((f, i) => expect(Array.from(g.frames[i].rgba.slice(0, 3))).toEqual(colourAt(f))) // every frame decodes to what was rendered
    expect(out.bytes).toBe(out.blob.size)
  })
  it('loop off writes no loop extension; identical frames are merged and reported', async () => {
    const out = await makeGif(props({ gif: { startSec: 0, durationSec: 1, fps: 5, width: 160, dither: false, loop: false } }), { renderFrame: mkRenderer(() => () => [10, 20, 30]) })
    expect(decodeGif(await blobBytes(out.blob)).loopCount).toBeNull(); expect(out.stats.frames).toBe(1); expect(out.stats.mergedFrames).toBeGreaterThan(0)
  })
  it('failures: render error names the frame; cancel is ABORTED; an impossible size becomes a plain message', async () => {
    await expect(makeGif(props(), { renderFrame: async () => { throw new Error('boom') } })).rejects.toMatchObject({ code: 'RENDER', message: expect.stringMatching(/Frame \d+ could not be drawn: boom/) })
    const ac = new AbortController(); let n = 0; const r = mkRenderer(() => () => [1, 2, 3]); await expect(makeGif(props(), { renderFrame: async (f, w) => { if (++n === 3) ac.abort(); return r(f, w) } }, { signal: ac.signal })).rejects.toMatchObject({ code: 'ABORTED' })
    await expect(makeGif(props(), { renderFrame: async () => img(10, 10, () => [1, 1, 1]).data && ({ data: new Uint8ClampedArray(8), width: 10, height: 10 }) })).rejects.toMatchObject({ code: 'ENCODE', message: expect.stringContaining('values') })
  })
})
void vi
