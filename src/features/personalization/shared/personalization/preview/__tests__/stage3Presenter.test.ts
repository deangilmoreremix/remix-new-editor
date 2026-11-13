/**
 * Stage 3 — presenter model: normalization, geometry, render plan (incl. honest fallbacks), framing maths, mask maths,
 * cache keys, the processed-footage store and the bake pipeline (with the heavy engines replaced by fakes).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_BAKE, PRESENTER_PRESETS, boxCentreFor, defaultPresenter, hardenMask, maskBounds, maskCoverage, matteKey, matteQuality,
  medianBounds, normalizePresenter, presenterBlurPx, presenterMediaRect, presenterRect, presenterRenderPlan, resolveBlurPx,
  smoothMask, suggestFraming, type PresenterSettings,
} from '../presenter'
import { clearMatteRegistry, registerMatteUrl, resolveMatteUrl, unregisterMatteUrl } from '../presenterMatteRegistry'
import { createDefaultPreviewSettings, normalizePreviewSettings } from '../presets'
import {
  MAX_CACHE_BYTES, createMemoryBlobStore, ensureMatteUrl, evictionPlan, saveMatte,
} from '../../guided/presenterMatteStore'
import { BakeError, bakePresenterMatte, findExistingMatte, type BakeDeps, type SegmentEngine } from '../../guided/presenterBake'
import { applyAutoFraming, applyPresenterPreset, patchPresenter, removePresenter, setMatte } from '../../guided/presenterEdit'

const SRC = 'https://cdn.example.com/talk.mp4'
const MATTE = { key: 'pm_mediapipe_abcdef12', engine: 'mediapipe' as const, sourceUrl: SRC, createdAt: '2026-11-13T00:00:00Z' }
const withMode = (mode: PresenterSettings['background']['mode'], extra: Partial<PresenterSettings> = {}): PresenterSettings => ({
  ...defaultPresenter('full'), background: { ...defaultPresenter('full').background, mode, imageUrl: 'https://cdn.example.com/bg.jpg' }, ...extra,
})

afterEach(() => { clearMatteRegistry(); vi.restoreAllMocks() })

describe('normalizePresenter', () => {
  it('rejects non-objects', () => {
    for (const bad of [null, undefined, 5, 'x', [], true]) expect(normalizePresenter(bad)).toBeUndefined()
  })
  it('fills defaults and clamps everything', () => {
    const p = normalizePresenter({ layout: 'bubble', box: { x: -4, y: 9, size: 5 }, aspect: 99, radius: 3, focus: { x: 2, y: -1, zoom: 99 }, borderWidth: 5, background: { blur: 999, mode: 'blur' } })!
    expect(p.box).toEqual({ x: 0, y: 1, size: 1 })
    expect(p.aspect).toBe(1) // circle by default => always 1
    expect(p.radius).toBe(0.5)
    expect(p.focus).toEqual({ x: 1, y: 0, zoom: 4 })
    expect(p.borderWidth).toBe(0.06)
    expect(p.background.blur).toBe(40)
  })
  it('refuses unknown enums and bad colours', () => {
    const p = normalizePresenter({ layout: 'wild', shape: 'star', borderColor: 'red; x', background: { mode: 'sepia', color: 'javascript:1' } })!
    expect(p.layout).toBe('bubble'); expect(p.shape).toBe('circle'); expect(p.borderColor).toBe('#ffffff'); expect(p.background.mode).toBe('keep')
    expect(p.background.color).toBe('#0f172a')
  })
  it('only keeps http(s) background pictures; an unusable picture mode falls back to keep', () => {
    for (const u of ['javascript:alert(1)', 'data:image/png;base64,AAAA', 'blob:http://x/1', '/relative.png', 'ftp://x/y']) {
      expect(normalizePresenter({ background: { mode: 'image', imageUrl: u } })!.background).toMatchObject({ mode: 'keep', imageUrl: '' })
    }
    expect(normalizePresenter({ background: { mode: 'image', imageUrl: 'https://a.example/b.jpg' } })!.background.mode).toBe('image')
  })
  it('validates the matte record and drops blob: urls', () => {
    const ok = normalizePresenter({ matte: { ...MATTE, url: 'blob:http://x/1' } })!.matte!
    expect(ok.key).toBe(MATTE.key); expect(ok.url).toBeUndefined()
    expect(normalizePresenter({ matte: { ...MATTE, url: 'https://cdn.example.com/m.webm' } })!.matte!.url).toBe('https://cdn.example.com/m.webm')
    for (const bad of [{ ...MATTE, key: '../x' }, { ...MATTE, key: 'a b c d e f g h' }, { ...MATTE, engine: 'gpt' }, { ...MATTE, sourceUrl: '' }, 'x', null]) {
      expect(normalizePresenter({ matte: bad })!.matte).toBeUndefined()
    }
  })
  it('is idempotent and survives JSON', () => {
    const once = normalizePresenter({ ...defaultPresenter('pip'), matte: { ...MATTE, bounds: { x0: .2, y0: .1, x1: .8, y1: .95 }, videoAspect: 0.5625 } })!
    expect(normalizePresenter(JSON.parse(JSON.stringify(once)))).toEqual(once)
  })
  it('is wired into normalizePreviewSettings and dropped when absent', () => {
    const s = createDefaultPreviewSettings()
    expect(normalizePreviewSettings({ ...s, presenter: defaultPresenter('bubble') } as any).presenter?.layout).toBe('bubble')
    expect(normalizePreviewSettings(s as any).presenter).toBeUndefined()
    expect(normalizePreviewSettings({ ...s, presenter: 'junk' } as any).presenter).toBeUndefined()
  })
})

describe('geometry', () => {
  it('full layout is the whole frame', () => {
    expect(presenterRect(defaultPresenter('full'), 1920, 1080)).toEqual({ left: 0, top: 0, width: 1920, height: 1080, radiusPx: 0 })
  })
  it('circle is square with radius half its side', () => {
    const r = presenterRect({ ...defaultPresenter('bubble'), box: { x: 0.5, y: 0.5, size: 0.25 } }, 1920, 1080)
    expect(r.width).toBe(480); expect(r.height).toBe(480); expect(r.radiusPx).toBe(240)
  })
  it('keeps the box inside the frame whatever the stored centre', () => {
    for (const c of [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0.99, y: 0.01 }, { x: -3, y: 4 }]) {
      const p = normalizePresenter({ ...defaultPresenter('bubble'), box: { ...c, size: 0.4 } })!
      const r = presenterRect(p, 1280, 720)
      expect(r.left).toBeGreaterThanOrEqual(0); expect(r.top).toBeGreaterThanOrEqual(0)
      expect(r.left + r.width).toBeLessThanOrEqual(1280 + 1e-9); expect(r.top + r.height).toBeLessThanOrEqual(720 + 1e-9)
    }
  })
  it('a box taller than the frame is shrunk, not overflowed', () => {
    const p = normalizePresenter({ ...defaultPresenter('pip'), shape: 'rect', aspect: 0.5, box: { x: 0.5, y: 0.5, size: 1 } })!
    const r = presenterRect(p, 1000, 500)
    expect(r.height).toBeLessThanOrEqual(500); expect(r.width / r.height).toBeCloseTo(0.5)
  })
  it('scales with the frame: same fractions at 640 and 1920 wide', () => {
    const p = defaultPresenter('bubble')
    const a = presenterRect(p, 640, 360), b = presenterRect(p, 1920, 1080)
    expect(b.left / a.left).toBeCloseTo(3, 5); expect(b.width / a.width).toBeCloseTo(3, 5)
  })
  it('boxCentreFor inverts presenterRect and clamps a drag outside the frame', () => {
    const p = defaultPresenter('pip')
    const r = presenterRect(p, 1280, 720)
    expect(boxCentreFor(p, 1280, 720, r.left, r.top).x).toBeCloseTo(p.box.x, 3)
    const out = boxCentreFor(p, 1280, 720, 99999, -99999)
    const moved = presenterRect({ ...p, box: { ...p.box, ...out } }, 1280, 720)
    expect(moved.left + moved.width).toBeCloseTo(1280); expect(moved.top).toBeCloseTo(0)
  })
  it('media rect: plain cover at zoom 1, centred', () => {
    const p = { ...defaultPresenter('full'), focus: { x: 0.5, y: 0.5, zoom: 1 } }
    expect(presenterMediaRect(p, 200, 200, 9 / 16)).toEqual({ left: 0, top: -(200 / (9 / 16) - 200) / 2, width: 200, height: 200 / (9 / 16) })
    expect(presenterMediaRect(p, 320, 180, 16 / 9)).toEqual({ left: 0, top: 0, width: 320, height: 180 })
    expect(presenterMediaRect(p, 320, 180, undefined)).toEqual({ left: 0, top: 0, width: 320, height: 180 }) // unknown aspect = box aspect
  })
  it('media rect: the video always covers the box, whatever the focus and zoom (property)', () => {
    for (const va of [9 / 16, 1, 16 / 9]) for (const z of [1, 1.5, 4]) for (const fx of [0, 0.3, 1]) for (const fy of [0, 0.5, 1]) {
      const r = presenterMediaRect({ ...defaultPresenter('pip'), focus: { x: fx, y: fy, zoom: z } }, 300, 200, va)
      expect(r.left, `${va}/${z}/${fx}/${fy}`).toBeLessThanOrEqual(1e-9); expect(r.top).toBeLessThanOrEqual(1e-9)
      expect(r.left + r.width).toBeGreaterThanOrEqual(300 - 1e-9); expect(r.top + r.height).toBeGreaterThanOrEqual(200 - 1e-9)
      expect(r.width / r.height).toBeCloseTo(va, 5)
    }
  })
  it('media rect: the focus point is centred when there is room to pan', () => {
    const r = presenterMediaRect({ ...defaultPresenter('pip'), focus: { x: 0.5, y: 0.4, zoom: 2 } }, 300, 300, 1)
    expect(r.top + 0.4 * r.height).toBeCloseTo(150, 5) // video y=0.4 is at the box centre
  })
  it('blur is resolution independent', () => {
    const p = { ...defaultPresenter('full'), background: { ...defaultPresenter('full').background, blur: 10 } }
    expect(presenterBlurPx(p, 1000)).toBe(10); expect(presenterBlurPx(p, 1920)).toBeCloseTo(19.2, 5)
  })
})

describe('render plan: what is drawn, and honesty when processed footage is missing', () => {
  const has = { url: 'blob:x', sourceUrl: SRC }
  it('absent or disabled → inactive (existing full-frame behaviour)', () => {
    expect(presenterRenderPlan(undefined, has).active).toBe(false)
    expect(presenterRenderPlan({ ...defaultPresenter('bubble'), enabled: false }, has).active).toBe(false)
  })
  it('keep → original with audio, no matte', () => {
    const plan = presenterRenderPlan(withMode('keep'), { url: null, sourceUrl: SRC })
    expect(plan).toMatchObject({ active: true, effective: 'keep', degradedReason: null, original: { muted: false }, matte: null })
  })
  it('remove → only the matte, and it carries the audio', () => {
    const plan = presenterRenderPlan(withMode('remove', { matte: MATTE }), has)
    expect(plan.original).toBeNull(); expect(plan.matte).toEqual({ muted: false }); expect(plan.effective).toBe('remove')
  })
  it('blur → original (muted? no: original carries audio) under a MUTED matte', () => {
    const plan = presenterRenderPlan(withMode('blur', { matte: MATTE }), has)
    expect(plan.original?.muted).toBe(false); expect(plan.matte?.muted).toBe(true)
    expect(resolveBlurPx(plan, withMode('blur', { matte: MATTE }), 1000)).toBe(presenterBlurPx(withMode('blur'), 1000))
  })
  it('exactly one audible layer in every mode', () => {
    for (const mode of ['keep', 'blur', 'color', 'image', 'remove'] as const) {
      const plan = presenterRenderPlan(withMode(mode, { matte: MATTE }), has)
      const audible = [plan.original && !plan.original.muted, plan.matte && !plan.matte.muted].filter(Boolean).length
      expect(audible, mode).toBe(1)
    }
  })
  it('colour / picture fill sit behind the matte', () => {
    expect(presenterRenderPlan(withMode('color', { matte: MATTE }), has).fill).toBe('#0f172a')
    expect(presenterRenderPlan(withMode('image', { matte: MATTE }), has).fillImage).toBe('https://cdn.example.com/bg.jpg')
  })
  it('a background mode with NO processed footage falls back to the untouched video and says why', () => {
    for (const mode of ['blur', 'color', 'image', 'remove'] as const) {
      const plan = presenterRenderPlan(withMode(mode), { url: null, sourceUrl: SRC })
      expect(plan).toMatchObject({ requested: mode, effective: 'keep', degradedReason: 'no-matte', matte: null })
      expect(plan.original?.blurPx).toBe(0)
    }
  })
  it('a matte whose file is gone is reported as unavailable, not as missing', () => {
    expect(presenterRenderPlan(withMode('remove', { matte: MATTE }), { url: null, sourceUrl: SRC }).degradedReason).toBe('matte-unavailable')
  })
  it('a matte made from a DIFFERENT video is never used', () => {
    const plan = presenterRenderPlan(withMode('remove', { matte: MATTE }), { url: 'blob:x', sourceUrl: 'https://cdn.example.com/other.mp4' })
    expect(plan).toMatchObject({ effective: 'keep', degradedReason: 'stale-matte', matte: null })
  })
  it('every preset builds valid settings that survive normalization unchanged', () => {
    for (const preset of PRESENTER_PRESETS) {
      const built = preset.build()
      expect(normalizePresenter(built), preset.id).toEqual(built)
      if (preset.needsMatte) expect(built.background.mode, preset.id).not.toBe('keep')
    }
    expect(new Set(PRESENTER_PRESETS.map((p) => p.id)).size).toBe(PRESENTER_PRESETS.length)
  })
})

describe('mask maths', () => {
  const mask = (...v: number[]) => Uint8Array.from(v)
  it('smoothMask: identity when off / first frame / size change, blend otherwise', () => {
    const cur = mask(0, 255, 100)
    expect(smoothMask(null, cur, 0.5)).toBe(cur)
    expect(smoothMask(mask(0, 0, 0), cur, 0)).toBe(cur)
    expect(smoothMask(mask(0, 0), cur, 0.5)).toBe(cur)
    expect(Array.from(smoothMask(mask(255, 255, 0), cur, 0.5))).toEqual([128, 255, 50])
  })
  it('smoothMask never exceeds the 0..255 range and a steady mask stays steady', () => {
    const m = mask(0, 128, 255)
    expect(Array.from(smoothMask(m, m, 0.9))).toEqual([0, 128, 255])
  })
  it('hardenMask: no-op at 0, ramps between thresholds, keeps the ends', () => {
    const m = mask(0, 20, 128, 235, 255)
    expect(hardenMask(m, 0)).toBe(m)
    const h = hardenMask(m, 1)
    expect(h[0]).toBe(0); expect(h[4]).toBe(255); expect(h[1]).toBe(0); expect(h[3]).toBe(255)
    expect(h[2]).toBeGreaterThan(100); expect(h[2]).toBeLessThan(160)
  })
  it('coverage and quality gates', () => {
    expect(maskCoverage(mask(0, 0, 255, 255))).toBe(0.5)
    expect(maskCoverage(new Uint8Array(0))).toBe(0)
    expect(matteQuality([]).ok).toBe(false)
    expect(matteQuality([0, 0.001, 0]).reason).toMatch(/No person/)
    expect(matteQuality([1, 1, 1]).reason).toMatch(/whole frame/)
    expect(matteQuality([0.2, 0.25, 0.3]).ok).toBe(true)
  })
  it('maskBounds finds the person and returns null for an empty mask', () => {
    const w = 10, h = 8, m = new Uint8Array(w * h)
    for (let y = 2; y < 6; y += 1) for (let x = 3; x < 7; x += 1) m[y * w + x] = 255
    expect(maskBounds(m, w, h)).toEqual({ x0: 0.3, y0: 0.25, x1: 0.7, y1: 0.75 })
    expect(maskBounds(new Uint8Array(w * h), w, h)).toBeNull()
  })
  it('medianBounds ignores an outlier frame', () => {
    const b = (x0: number) => ({ x0, y0: 0.1, x1: x0 + 0.4, y1: 0.9 })
    expect(medianBounds([b(0.3), b(0.31), b(0.3), b(0.8), b(0.29)])!.x0).toBeCloseTo(0.3, 1)
    expect(medianBounds([])).toBeNull()
  })
})

describe('auto-framing', () => {
  const standing = { x0: 0.3, y0: 0.07, x1: 0.78, y1: 0.93 } // full-body person in a portrait video
  const frame = (va: number, ba: number, hf: number) => {
    const f = suggestFraming(standing, va, ba, { headFraction: hf })
    const boxW = 300, boxH = boxW / ba
    const m = presenterMediaRect({ ...defaultPresenter('pip'), focus: f }, boxW, boxH, va)
    const at = (vx: number, vy: number) => ({ x: (m.left + vx * m.width) / boxW, y: (m.top + vy * m.height) / boxH })
    return { f, at }
  }
  const inBox = (p: { x: number; y: number }) => p.x >= -1e-6 && p.x <= 1 + 1e-6 && p.y >= -1e-6 && p.y <= 1 + 1e-6
  it('puts the head and shoulders inside a square bubble for a full-body portrait clip (the case plain cover crops away)', () => {
    const { f, at } = frame(9 / 16, 1, 0.38)
    expect(f.zoom).toBeGreaterThan(1.5)
    const head = (standing.y1 - standing.y0) * 0.38
    for (const c of [at(standing.x0, standing.y0), at(standing.x1, standing.y0), at(standing.x0, standing.y0 + head), at(standing.x1, standing.y0 + head)]) expect(inBox(c)).toBe(true)
  })
  it('the head region lands inside the box for many video / box shapes (property)', () => {
    for (const va of [9 / 16, 1, 16 / 9, 4 / 3]) for (const ba of [1, 16 / 9, 0.75]) for (const hf of [0.3, 0.38, 0.5]) {
      const { f, at } = frame(va, ba, hf)
      if (f.zoom >= 4) continue // capped: the person is tiny in the video, so no zoom can fill the box
      const head = (standing.y1 - standing.y0) * hf
      const visX = ba >= va ? 1 : ba / va, visY = ba >= va ? va / ba : 1
      const fits = f.zoom > 1.0001 || ((standing.x1 - standing.x0) <= visX && head <= visY)
      const target = [at(standing.x0, standing.y0), at(standing.x1, standing.y0), at(standing.x0, standing.y0 + head), at(standing.x1, standing.y0 + head)]
      // When the box is too short to show the whole head region even unzoomed, the best framing centres it.
      for (const c of fits ? target : [at((standing.x0 + standing.x1) / 2, standing.y0 + head / 2)]) {
        expect(inBox(c), `${va}/${ba}/${hf} ${JSON.stringify(c)}`).toBe(true)
      }
    }
  })
  it('a person who already fills the box gets no zoom', () => {
    expect(suggestFraming({ x0: 0, y0: 0, x1: 1, y1: 1 }, 1, 1).zoom).toBe(1)
  })
  it('zoom is capped and the focus stays in the video', () => {
    const f = suggestFraming({ x0: 0.45, y0: 0.45, x1: 0.5, y1: 0.5 }, 16 / 9, 1)
    expect(f.zoom).toBeLessThanOrEqual(4); expect(f.x).toBeGreaterThanOrEqual(0); expect(f.x).toBeLessThanOrEqual(1)
  })
})

describe('keys, registry, store', () => {
  it('matteKey is stable and changes with every input that changes the result', () => {
    const base = matteKey(SRC, undefined, DEFAULT_BAKE)
    expect(matteKey(SRC, undefined, DEFAULT_BAKE)).toBe(base)
    expect(base).toMatch(/^pm_mediapipe_[a-z0-9]+$/)
    expect(matteKey('https://cdn.example.com/other.mp4', undefined, DEFAULT_BAKE)).not.toBe(base)
    expect(matteKey(SRC, undefined, { ...DEFAULT_BAKE, engine: 'modnet' })).not.toBe(base)
    expect(matteKey(SRC, undefined, { ...DEFAULT_BAKE, edge: 0.5 })).not.toBe(base)
    expect(matteKey(SRC, undefined, { ...DEFAULT_BAKE, smooth: 0.1 })).not.toBe(base)
    expect(matteKey(SRC, undefined, { ...DEFAULT_BAKE, maxSize: 640 })).not.toBe(base)
    expect(normalizePresenter({ matte: { ...MATTE, key: base } })!.matte!.key).toBe(base)
  })
  it('registry resolves registered urls first, falls back to a durable url, and revokes blob urls it replaces', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    expect(resolveMatteUrl(undefined)).toBeNull()
    expect(resolveMatteUrl({ key: 'k1', url: 'https://x.example/m.webm' })).toBe('https://x.example/m.webm')
    registerMatteUrl('k1', 'blob:one'); expect(resolveMatteUrl({ key: 'k1', url: 'https://x.example/m.webm' })).toBe('blob:one')
    registerMatteUrl('k1', 'blob:two'); expect(revoke).toHaveBeenCalledWith('blob:one')
    unregisterMatteUrl('k1'); expect(resolveMatteUrl({ key: 'k1' })).toBeNull()
  })
  it('evictionPlan drops the least recently used first and never the protected key', () => {
    const e = [{ key: 'a', bytes: 100, usedAt: 1 }, { key: 'b', bytes: 100, usedAt: 2 }, { key: 'c', bytes: 100, usedAt: 3 }]
    expect(evictionPlan(e, 1000)).toEqual([])
    expect(evictionPlan(e, 200)).toEqual(['a'])
    expect(evictionPlan(e, 100)).toEqual(['a', 'b'])
    expect(evictionPlan(e, 100, ['a'])).toEqual(['b', 'c'])
    expect(MAX_CACHE_BYTES).toBeGreaterThan(0)
  })
  it('saveMatte stores, evicts old entries, and registers a playable url; ensureMatteUrl restores after a reload', async () => {
    let n = 0
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:test-${++n}`)
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const store = createMemoryBlobStore()
    const blob = (size: number) => new Blob([new Uint8Array(size)])
    const url1 = await saveMatte('pm_a_0000001', { blob: blob(60), sourceUrl: SRC, engine: 'mediapipe', createdAt: 'x' }, store, 100)
    expect(url1).toBe('blob:test-1')
    await saveMatte('pm_b_0000002', { blob: blob(60), sourceUrl: SRC, engine: 'mediapipe', createdAt: 'x' }, store, 100)
    expect(await store.keys()).toEqual(['pm_b_0000002']) // a was evicted to fit the budget
    clearMatteRegistry() // a page reload forgets every blob: url
    expect(resolveMatteUrl({ key: 'pm_b_0000002' })).toBeNull()
    expect(await ensureMatteUrl({ key: 'pm_b_0000002' }, store)).toMatch(/^blob:test-/)
    expect(await ensureMatteUrl({ key: 'pm_missing_00000' }, store)).toBeNull()
    expect(await ensureMatteUrl(undefined, store)).toBeNull()
  })
})

describe('bake pipeline (fake engine, fake encoder)', () => {
  const W = 8, H = 6
  const frame = () => ({ width: W, height: H, data: new Uint8ClampedArray(W * H * 4) })
  const personMask = (cover: number) => { const m = new Uint8Array(W * H); m.fill(255, 0, Math.round(W * H * cover)); return m }
  function deps(opts: { frames?: number; cover?: number; failEngine?: boolean; failEncode?: boolean } = {}) {
    const closed = { engine: 0 }
    const calls = { matteVideo: 0, segment: 0 }
    const d: BakeDeps = {
      createEngine: async () => {
        if (opts.failEngine) throw new Error('wasm blocked')
        const e: SegmentEngine = { segment: () => { calls.segment += 1; return personMask(opts.cover ?? 0.3) }, close: () => { closed.engine += 1 } }
        return e
      },
      matteVideo: async (_src, o) => {
        calls.matteVideo += 1
        if (opts.failEncode) throw new Error('This browser cannot encode VP9 video')
        for (let i = 0; i < (opts.frames ?? 5); i += 1) {
          if (o.signal?.aborted) throw Object.assign(new Error('x'), { name: 'AbortError' })
          await o.matteFor(frame(), i, i / 30)
        }
        return new Blob([new Uint8Array(1000)], { type: 'video/webm' })
      },
      now: () => '2026-11-13T00:00:00.000Z',
    }
    return { d, closed, calls }
  }
  const mocks = () => { let n = 0; vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:b-${++n}`); vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {}) }

  it('bakes, stores, registers a url, records bounds and closes the engine', async () => {
    mocks()
    const store = createMemoryBlobStore(); const { d, closed, calls } = deps()
    const r = await bakePresenterMatte(SRC, {}, {}, store, d)
    expect(r.reused).toBe(false); expect(r.frames).toBe(5); expect(r.meanCoverage).toBeCloseTo(0.3, 1)
    expect(r.matte.key).toBe(matteKey(SRC, undefined, DEFAULT_BAKE)); expect(r.matte.bounds).toBeDefined(); expect(r.matte.videoAspect).toBeCloseTo(8 / 6)
    expect(await store.keys()).toEqual([r.matte.key]); expect(resolveMatteUrl(r.matte)).toBe(r.url)
    expect(closed.engine).toBe(1); expect(calls.segment).toBe(5)
  })
  it('REUSES processed footage: the second bake does not run the engine or the encoder', async () => {
    mocks()
    const store = createMemoryBlobStore(); const a = deps(); const b = deps()
    const first = await bakePresenterMatte(SRC, {}, {}, store, a.d)
    clearMatteRegistry()
    const second = await bakePresenterMatte(SRC, {}, {}, store, b.d)
    expect(second.reused).toBe(true); expect(second.matte.key).toBe(first.matte.key); expect(second.matte.bounds).toEqual(first.matte.bounds)
    expect(b.calls).toEqual({ matteVideo: 0, segment: 0 })
    expect((await findExistingMatte(SRC, {}, store))?.key).toBe(first.matte.key)
    expect(await findExistingMatte('https://cdn.example.com/other.mp4', {}, store)).toBeNull()
  })
  it('force re-runs; a different engine or video makes a different entry', async () => {
    mocks()
    const store = createMemoryBlobStore(); const { d, calls } = deps()
    await bakePresenterMatte(SRC, {}, {}, store, d)
    await bakePresenterMatte(SRC, {}, { force: true }, store, d)
    expect(calls.matteVideo).toBe(2)
    await bakePresenterMatte(SRC, { engine: 'modnet' }, {}, store, d)
    await bakePresenterMatte('https://cdn.example.com/other.mp4', {}, {}, store, d)
    expect((await store.keys()).length).toBe(3)
  })
  it('refuses an empty matte and an everything-is-person matte, and stores nothing', async () => {
    mocks()
    const store = createMemoryBlobStore()
    await expect(bakePresenterMatte(SRC, {}, {}, store, deps({ cover: 0 }).d)).rejects.toMatchObject({ code: 'NO_PERSON' })
    await expect(bakePresenterMatte(SRC, {}, {}, store, deps({ cover: 1 }).d)).rejects.toMatchObject({ code: 'ALL_PERSON' })
    await expect(bakePresenterMatte(SRC, {}, {}, store, deps({ frames: 0 }).d)).rejects.toMatchObject({ code: 'EMPTY' })
    expect(await store.keys()).toEqual([])
  })
  it('reports engine start-up failure and encoder failure, and still closes the engine', async () => {
    mocks()
    const store = createMemoryBlobStore()
    await expect(bakePresenterMatte(SRC, {}, {}, store, deps({ failEngine: true }).d)).rejects.toMatchObject({ code: 'ENGINE', message: expect.stringContaining('wasm blocked') })
    const enc = deps({ failEncode: true })
    await expect(bakePresenterMatte(SRC, {}, {}, store, enc.d)).rejects.toThrow(/cannot encode/)
    expect(enc.closed.engine).toBe(1); expect(await store.keys()).toEqual([])
  })
  it('cancel before and during a bake', async () => {
    mocks()
    const store = createMemoryBlobStore()
    const pre = new AbortController(); pre.abort()
    await expect(bakePresenterMatte(SRC, {}, { signal: pre.signal }, store, deps().d)).rejects.toBeInstanceOf(BakeError)
    const ac = new AbortController(); const { d, closed } = deps({ frames: 50 })
    const orig = d.createEngine
    d.createEngine = async (...a) => { const e = await orig(...a); const seg = e.segment; let n = 0; e.segment = (f) => { if (++n === 3) ac.abort(); return seg(f) }; return e }
    await expect(bakePresenterMatte(SRC, {}, { signal: ac.signal }, store, d)).rejects.toMatchObject({ code: 'ABORTED' })
    expect(closed.engine).toBe(1); expect(await store.keys()).toEqual([])
  })
  it('smoothing steadies a flickering mask', async () => {
    mocks()
    let i = 0; const seen: number[] = []
    const d = deps().d
    d.createEngine = async () => ({ segment: () => { i += 1; return personMask(i % 2 ? 0.2 : 0.4) }, close: () => {} })
    const mv = d.matteVideo
    d.matteVideo = (s, o) => mv(s, { ...o, matteFor: async (img: any, n: number, t: number) => { const r = await o.matteFor(img, n, t); seen.push(maskCoverage(r)); return r } })
    await bakePresenterMatte(SRC, { smooth: 0.8, edge: 0 }, {}, createMemoryBlobStore(), d)
    const spread = Math.max(...seen) - Math.min(...seen)
    const rawSpread = 0.2
    expect(spread).toBeLessThan(rawSpread)
  })
})

describe('panel edits (pure)', () => {
  const base = createDefaultPreviewSettings()
  it('patchPresenter creates a presenter on first edit and merges nested fields', () => {
    const a = patchPresenter(base, { box: { size: 0.3 } })
    expect(a.presenter?.box.size).toBe(0.3); expect(a.presenter?.box.x).toBe(defaultPresenter('bubble').box.x)
    const b = patchPresenter(a, { background: { mode: 'blur' } })
    expect(b.presenter?.background.mode).toBe('blur'); expect(b.presenter?.box.size).toBe(0.3)
    expect(base.presenter).toBeUndefined() // inputs are never mutated
  })
  it('patchPresenter validates: absurd values are clamped, never stored', () => {
    const a = patchPresenter(base, { box: { size: 99 }, focus: { zoom: -3 }, background: { blur: 1e9 } })
    expect(a.presenter?.box.size).toBe(1); expect(a.presenter?.focus.zoom).toBe(1); expect(a.presenter?.background.blur).toBe(40)
  })
  it('presets keep the processed footage; reset removes the presenter entirely', () => {
    const withMatte = setMatte(patchPresenter(base, {}), MATTE)
    const next = applyPresenterPreset(withMatte, 'full-blur')
    expect(next.presenter?.matte).toEqual(withMatte.presenter?.matte); expect(next.presenter?.background.mode).toBe('blur')
    expect(applyPresenterPreset(withMatte, 'nope')).toBe(withMatte)
    expect('presenter' in removePresenter(next)).toBe(false); expect(removePresenter(base)).toBe(base)
  })
  it('auto-framing needs measured bounds, then changes the focus/zoom', () => {
    const noBounds = patchPresenter(base, {})
    expect(applyAutoFraming(noBounds)).toBe(noBounds)
    const framed = applyAutoFraming(setMatte(patchPresenter(base, { shape: 'circle' }), { ...MATTE, bounds: { x0: .3, y0: .07, x1: .78, y1: .93 }, videoAspect: 9 / 16 }))
    expect(framed.presenter!.focus.zoom).toBeGreaterThan(1.3)
  })
})

describe('geometry: focus is clamped, never leaves an empty edge', () => {
  it('a focus near the top with zoom pins the video to the box top instead of showing a gap', () => {
    const r = presenterMediaRect({ ...defaultPresenter('pip'), focus: { x: 0.5, y: 0.2, zoom: 2 } }, 300, 300, 1)
    expect(r.top).toBe(0)
  })
})
