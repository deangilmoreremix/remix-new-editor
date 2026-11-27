import { describe, it, expect, vi } from 'vitest'
import { cuesToCaptions, captionsToCues } from '../captionBridge'
import { coverRect, compositeOnBackground, hasBackgroundModelConsent, rememberBackgroundModelConsent, type CompositeDeps } from '../backgroundTools'

describe('caption format bridge', () => {
  it('converts seconds cues to Remotion-style ms captions, dropping empty or inverted ones', () => {
    const caps = cuesToCaptions([{ start: 2, end: 3.5, text: 'World' }, { start: 0, end: 1.25, text: 'Hello' }, { start: 4, end: 4, text: 'zero length' }, { start: 5, end: 6, text: '   ' }])
    expect(caps).toEqual([
      { text: 'Hello', startMs: 0, endMs: 1250, timestampMs: 625, confidence: null },
      { text: 'World', startMs: 2000, endMs: 3500, timestampMs: 2750, confidence: null },
    ])
  })
  it('converts captions back to sorted cues and ignores malformed entries', () => {
    const cues = captionsToCues([{ text: ' B ', startMs: 2000, endMs: 3000 }, { text: 'A', startMs: 0, endMs: 900 }, { text: 'bad', startMs: NaN, endMs: 10 }, { text: '', startMs: 0, endMs: 5 }, { startMs: 10, endMs: 20 }])
    expect(cues).toEqual([{ start: 0, end: 0.9, text: 'A' }, { start: 2, end: 3, text: 'B' }])
  })
  it('round-trips', () => {
    const cues = [{ start: 0.5, end: 1.5, text: 'one' }, { start: 2, end: 3, text: 'two' }]
    expect(captionsToCues(cuesToCaptions(cues))).toEqual(cues)
  })
})

describe('background tools', () => {
  it('computes a cover crop that fills without stretching', () => {
    const r = coverRect(2000, 1000, 500, 500)
    expect(r.sw / r.sh).toBeCloseTo(1)
    expect(r.sx).toBe(500)
    expect(r.sy).toBe(0)
    expect(() => coverRect(0, 1, 1, 1)).toThrow()
  })
  const fakeDeps = (log: any[]): CompositeDeps => ({
    bitmap: async (b) => ({ width: b.size === 7 ? 400 : 800, height: b.size === 7 ? 200 : 600, close: () => log.push(['close', b.size]) }),
    canvas: (w, h) => ({
      getContext: () => ({ drawImage: (...a: any[]) => log.push(['draw', a.length]), fillRect: (...a: any[]) => log.push(['fill', ...a]), set fillStyle(v: string) { log.push(['style', v]) } }),
      toBlob: (cb, type) => { log.push(['encode', w, h, type]); cb(new Blob(['x'], { type })) },
    }),
  })
  it('puts the cut-out on a colour, at the cut-out size, and releases the bitmaps', async () => {
    const log: any[] = []
    const out = await compositeOnBackground(new Blob(['1234567']), { color: '#ff0000' }, { deps: fakeDeps(log) })
    expect(out.type).toBe('image/jpeg')
    expect(log).toContainEqual(['style', '#ff0000'])
    expect(log).toContainEqual(['fill', 0, 0, 400, 200])
    expect(log).toContainEqual(['encode', 400, 200, 'image/jpeg'])
    expect(log.filter((l) => l[0] === 'close')).toHaveLength(1)
  })
  it('crops a background picture to fill and closes both bitmaps; PNG keeps transparency-safe output', async () => {
    const log: any[] = []
    const out = await compositeOnBackground(new Blob(['1234567']), { image: new Blob(['bgbgbgbg']) }, { mime: 'image/png', deps: fakeDeps(log) })
    expect(out.type).toBe('image/png')
    expect(log.some((l) => l[0] === 'draw' && l[1] === 9)).toBe(true) // 9-arg drawImage = cropped background
    expect(log.filter((l) => l[0] === 'close')).toHaveLength(2)
  })
  it('needs a background and releases resources even when encoding fails', async () => {
    await expect(compositeOnBackground(new Blob(['x']), {}, { deps: fakeDeps([]) })).rejects.toThrow(/colour or picture/)
    const log: any[] = []
    const deps = fakeDeps(log)
    deps.canvas = () => ({ getContext: () => ({ drawImage() {}, fillRect() {}, set fillStyle(_v: string) {} }), toBlob: (cb) => cb(null) })
    await expect(compositeOnBackground(new Blob(['1234567']), { color: '#000' }, { deps })).rejects.toThrow(/encode/)
    expect(log.filter((l) => l[0] === 'close')).toHaveLength(1)
  })
  it('remembers model-download consent and survives blocked storage', () => {
    const mem = new Map<string, string>()
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
    expect(hasBackgroundModelConsent(storage)).toBe(false)
    rememberBackgroundModelConsent(storage)
    expect(hasBackgroundModelConsent(storage)).toBe(true)
    const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    expect(hasBackgroundModelConsent(broken)).toBe(false)
    expect(() => rememberBackgroundModelConsent(broken)).not.toThrow()
    vi.restoreAllMocks()
  })
})
