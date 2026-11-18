import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FrameSource } from '../frameSource'
import type { Segmenter } from '../segmenter'
import { MAX_SEGMENT_SECONDS, SegmentationCancelled, segmentVideo } from '../segmentVideo'
import { cancelMasks, clearMasks, ensureMasks, getCutoutStatus, getMaskAt, hasMasks } from '../maskStore'

const fakeCanvas = () => ({ width: 0, height: 0, getContext: () => ({}) }) as unknown as HTMLCanvasElement

function source(duration: number, w = 640, h = 360): FrameSource & { drawn: number[] } {
  const drawn: number[] = []
  return { duration, width: w, height: h, drawn, draw: async (_c, t) => { drawn.push(t) }, dispose: () => undefined }
}
function segmenter(value = (i: number) => 255): Segmenter & { calls: number } {
  const s = { calls: 0, segment() { const i = s.calls++; return { w: 2, h: 2, data: Uint8ClampedArray.from([value(i), value(i), value(i), value(i)]) } }, close: vi.fn() }
  return s
}

describe('segmentVideo', () => {
  it('measures one mask per sampled frame, at a small size, and reports progress', async () => {
    const src = source(2)
    const seg = segmenter()
    const progress: number[] = []
    const out = await segmentVideo(src, seg, { maskFps: 5, createCanvas: fakeCanvas, onProgress: (p) => progress.push(p) })
    expect(out.masks).toHaveLength(10)
    expect(out.fps).toBe(5)
    expect(out.width).toBe(384)
    expect(out.height).toBe(216)
    expect(src.drawn[1]).toBeCloseTo(0.2, 5)
    expect(progress.at(-1)).toBe(1)
    expect(progress).toEqual([...progress].sort((a, b) => a - b))
  })

  it('smooths flicker between frames', async () => {
    const out = await segmentVideo(source(0.4), segmenter((i) => (i % 2 === 0 ? 255 : 0)), { maskFps: 5, createCanvas: fakeCanvas })
    // frame 1 is raw 0 but pulled up by the previous 255
    expect(out.masks[1].data[0]).toBeGreaterThan(0)
  })

  it('stops when cancelled', async () => {
    const controller = new AbortController()
    const seg = segmenter()
    const original = seg.segment.bind(seg)
    seg.segment = (c) => { if (seg.calls === 2) controller.abort(); return original(c) }
    await expect(segmentVideo(source(5), seg, { maskFps: 10, createCanvas: fakeCanvas, signal: controller.signal })).rejects.toBeInstanceOf(SegmentationCancelled)
    expect(seg.calls).toBeLessThan(10)
  })

  it('refuses clips that are too long with a clear message', async () => {
    await expect(segmentVideo(source(MAX_SEGMENT_SECONDS + 1), segmenter(), { createCanvas: fakeCanvas })).rejects.toThrow(/up to 60 seconds/)
  })

  it('refuses a video with no readable frames', async () => {
    await expect(segmentVideo(source(0), segmenter(), { createCanvas: fakeCanvas })).rejects.toThrow(/no readable frames/)
  })
})

describe('maskStore', () => {
  afterEach(() => clearMasks())

  const factories = (src = source(1), seg = segmenter()) => ({ segmenterFactory: async () => seg, frameSourceFactory: async () => src, createCanvas: fakeCanvas })

  it('starts idle, then measures once and caches', async () => {
    const url = 'blob:one'
    expect(getCutoutStatus(url).state).toBe('idle')
    const seg = segmenter()
    const first = ensureMasks(url, factories(source(1, 100, 50), seg))
    expect(getCutoutStatus(url).state).toBe('processing')
    await first
    expect(getCutoutStatus(url)).toMatchObject({ state: 'ready', progress: 1 })
    expect(hasMasks(url)).toBe(true)
    const calls = seg.calls
    await ensureMasks(url, factories(source(1), seg))
    expect(seg.calls).toBe(calls)
    expect(seg.close).toHaveBeenCalled()
  })

  it('shares one run between concurrent callers', async () => {
    const seg = segmenter()
    const a = ensureMasks('blob:two', factories(source(1), seg))
    const b = ensureMasks('blob:two', factories(source(1), seg))
    expect(a).toBe(b)
    await a
  })

  it('returns a blended mask for a time, and null when nothing is measured', async () => {
    expect(getMaskAt('blob:none', 0)).toBeNull()
    await ensureMasks('blob:three', factories(source(1), segmenter((i) => i * 50)))
    const found = getMaskAt('blob:three', 0.0333)
    expect(found).not.toBeNull()
    expect(found!.mask.data[0]).toBeGreaterThan(0)
  })

  it('records an error message and can retry', async () => {
    await expect(ensureMasks('blob:bad', { segmenterFactory: async () => { throw new Error('model missing') }, frameSourceFactory: async () => source(1), createCanvas: fakeCanvas })).rejects.toThrow('model missing')
    expect(getCutoutStatus('blob:bad')).toMatchObject({ state: 'error', error: 'model missing' })
    await ensureMasks('blob:bad', factories())
    expect(getCutoutStatus('blob:bad').state).toBe('ready')
  })

  it('cancel stops the run and forgets it', async () => {
    const seg = segmenter()
    const p = ensureMasks('blob:cancel', factories(source(30), seg))
    cancelMasks('blob:cancel')
    await expect(p).rejects.toBeInstanceOf(SegmentationCancelled)
    expect(getCutoutStatus('blob:cancel').state).toBe('idle')
    expect(hasMasks('blob:cancel')).toBe(false)
  })

  it('clearMasks releases memory', async () => {
    await ensureMasks('blob:clear', factories())
    clearMasks('blob:clear')
    expect(hasMasks('blob:clear')).toBe(false)
  })
})
