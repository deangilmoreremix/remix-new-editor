/**
 * Stage 2 — website background: the pure motion model (scroll, zoom, cursor, clicks, transitions), validation of stored
 * data, reusable motion, building a first animation from a capture, and persistence through the settings normalizer.
 */
import { describe, expect, it } from 'vitest'
import {
  CLICK_EFFECT_FRAMES,
  MAX_CLICKS,
  MAX_CURSOR_POINTS,
  MAX_SECTIONS,
  applyWebsiteMotion,
  cursorAt,
  defaultWebsiteBackground,
  displayedPageHeight,
  easeValue,
  extractWebsiteMotion,
  isDurableHttpUrl,
  maxScrollPx,
  normalizeWebsiteBackground,
  normalizeWebsiteMotion,
  scrollFractionForSection,
  websiteFrameState,
  windowProgress,
  type WebsiteBackground,
} from '../websiteBackground'
import { createDefaultPreviewSettings, normalizePreviewSettings } from '../presets'

const W = 1920
const H = 1080
const PAGE = { url: 'https://cdn.example.com/page.jpg', width: 3840, height: 3492 } // a real capture is 1920 css px at 2x

function make(over: Record<string, unknown> = {}): WebsiteBackground {
  return normalizeWebsiteBackground({
    enabled: true,
    source: { url: 'https://acme.example/', title: 'Acme', capturedAt: '2026-11-13T00:00:00Z' },
    page: PAGE,
    sections: [{ label: 'Hero', y: 0, height: 1200 }, { label: 'Pricing', y: 2400, height: 800 }],
    startFrame: 0, endFrame: 100, transition: 'fade', transitionFrames: 10,
    scroll: { from: 0, to: 1 }, ease: 'linear', zoom: { from: 1, to: 2 }, focus: { x: 0.25, y: 0.5 },
    cursor: { enabled: true, style: 'arrow', path: [{ t: 0, x: 0.1, y: 0.1 }, { t: 1, x: 0.9, y: 0.9 }], clicks: [0.5], clickEffect: 'ripple' },
    ...over,
  }) as WebsiteBackground
}

describe('validation of stored data', () => {
  it('accepts only durable http(s) URLs', () => {
    expect(isDurableHttpUrl('https://x.com/a.jpg')).toBe(true)
    expect(isDurableHttpUrl('http://x.com/a.jpg')).toBe(true)
    for (const bad of ['blob:https://x/1', 'data:image/png;base64,AA', 'javascript:alert(1)', '/relative.jpg', 'ftp://x/a', '', 5, null, 'https://' + 'a'.repeat(2100)]) {
      expect(isDurableHttpUrl(bad as never), String(bad).slice(0, 30)).toBe(false)
    }
  })
  it('rejects a background without a usable picture', () => {
    expect(normalizeWebsiteBackground(null)).toBeUndefined()
    expect(normalizeWebsiteBackground([])).toBeUndefined()
    expect(normalizeWebsiteBackground({ page: { url: 'blob:x', width: 100, height: 100 } })).toBeUndefined()
    expect(normalizeWebsiteBackground({ page: { url: 'https://x/a.jpg', width: 0, height: 100 } })).toBeUndefined()
    expect(normalizeWebsiteBackground({ page: { url: 'https://x/a.jpg', width: 100, height: 1e9 } })).toBeUndefined()
    expect(normalizeWebsiteBackground({ page: { url: 'https://x/a.jpg', width: NaN, height: 100 } })).toBeUndefined()
  })
  it('clamps every number and repairs ordering', () => {
    const bg = normalizeWebsiteBackground({
      page: PAGE, startFrame: -5, endFrame: -10, transition: 'spin', transitionFrames: 9999, scroll: { from: -1, to: 7 }, zoom: { from: 0, to: 99 },
      focus: { x: 5, y: -5 }, ease: 'bounce', source: { url: 'javascript:1', title: 'x'.repeat(500) },
    }) as WebsiteBackground
    expect(bg.startFrame).toBe(0)
    expect(bg.endFrame).toBe(1) // never an empty window
    expect(bg.transition).toBe('fade')
    expect(bg.transitionFrames).toBe(120)
    expect(bg.scroll).toEqual({ from: 0, to: 1 })
    expect(bg.zoom).toEqual({ from: 1, to: 3 })
    expect(bg.focus).toEqual({ x: 1, y: 0 })
    expect(bg.ease).toBe('ease-in-out')
    expect(bg.source.url).toBe('')
    expect(bg.source.title).toHaveLength(200)
  })
  it('caps and sorts sections, cursor points and clicks, and drops junk', () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ t: (79 - i) / 79, x: 0.5, y: 0.5 }))
    const bg = normalizeWebsiteBackground({
      page: PAGE,
      sections: [...Array.from({ length: 90 }, (_, i) => ({ label: `s${i}`, y: i * 10, height: 20 })), { y: 'x', height: 1 }, { y: 5, height: -1 }],
      cursor: { enabled: true, path: [...many, { t: 'x', x: 1, y: 1 }], clicks: [...Array.from({ length: 50 }, (_, i) => (50 - i) / 50), 'x'] },
    }) as WebsiteBackground
    expect(bg.sections).toHaveLength(MAX_SECTIONS)
    expect(bg.cursor.path).toHaveLength(MAX_CURSOR_POINTS)
    expect(bg.cursor.path.every((p, i, a) => i === 0 || a[i - 1].t <= p.t)).toBe(true)
    expect(bg.cursor.clicks).toHaveLength(MAX_CLICKS)
    expect(bg.cursor.clicks.every((c, i, a) => i === 0 || a[i - 1] <= c)).toBe(true)
  })
  it('a cursor without a path is switched off', () => {
    expect(make({ cursor: { enabled: true, path: [] } }).cursor.enabled).toBe(false)
  })
})

describe('motion maths', () => {
  it('eases', () => {
    expect(easeValue(0.5, 'linear')).toBe(0.5)
    expect(easeValue(0, 'ease-in-out')).toBe(0)
    expect(easeValue(1, 'ease-in-out')).toBe(1)
    expect(easeValue(0.25, 'ease-in-out')).toBeLessThan(0.25) // slow start
    expect(easeValue(-3, 'linear')).toBe(0)
    expect(easeValue(3, 'linear')).toBe(1)
  })
  it('measures the scrollable distance from a real-sized page', () => {
    const bg = make()
    expect(displayedPageHeight(bg, W)).toBe(1746) // 3492 * (1920 / 3840)
    expect(maxScrollPx(bg, W, H)).toBe(666)
    expect(maxScrollPx(make({ page: { url: PAGE.url, width: 3840, height: 1000 } }), W, H)).toBe(0) // a short page cannot scroll
  })
  it('finds the scroll that brings a section to the top', () => {
    const bg = make()
    expect(scrollFractionForSection({ label: '', y: 0, height: 10 }, bg, W, H)).toBe(0)
    expect(scrollFractionForSection({ label: '', y: 600, height: 10 }, bg, W, H)).toBeCloseTo(300 / 666, 6)
    expect(scrollFractionForSection({ label: '', y: 3000, height: 10 }, bg, W, H)).toBe(1) // clamped
  })
  it('window progress', () => {
    const bg = make({ startFrame: 20, endFrame: 120 })
    expect(windowProgress(0, bg)).toBe(0)
    expect(windowProgress(70, bg)).toBe(0.5)
    expect(windowProgress(500, bg)).toBe(1)
  })
  it('moves the cursor along its path', () => {
    const path = [{ t: 0.2, x: 0, y: 0 }, { t: 0.6, x: 1, y: 0.5 }, { t: 0.8, x: 1, y: 1 }]
    expect(cursorAt([], 0.5)).toEqual({ visible: false, x: 0, y: 0 })
    expect(cursorAt([{ t: 0.5, x: 0.3, y: 0.4 }], 0.9)).toEqual({ visible: true, x: 0.3, y: 0.4 })
    expect(cursorAt(path, 0)).toEqual({ visible: true, x: 0, y: 0 }) // held before the first point
    expect(cursorAt(path, 1)).toEqual({ visible: true, x: 1, y: 1 }) // held after the last
    const mid = cursorAt(path, 0.4)
    expect(mid.x).toBeCloseTo(0.5, 6)
    expect(mid.y).toBeCloseTo(0.25, 6)
  })
})

describe('websiteFrameState', () => {
  it('is hidden outside its window and when disabled', () => {
    const bg = make({ startFrame: 10, endFrame: 60 })
    expect(websiteFrameState(9, bg, W, H).visible).toBe(false)
    expect(websiteFrameState(10, bg, W, H).visible).toBe(true)
    expect(websiteFrameState(59, bg, W, H).visible).toBe(true)
    expect(websiteFrameState(60, bg, W, H).visible).toBe(false) // handed over to the presenter/source video
    expect(websiteFrameState(30, make({ enabled: false }), W, H).visible).toBe(false)
  })
  it('scrolls and zooms linearly from the start to the end of the window', () => {
    const bg = make()
    const a = websiteFrameState(0, bg, W, H)
    const m = websiteFrameState(50, bg, W, H)
    const z = websiteFrameState(99, bg, W, H)
    expect(a.scrollPx).toBe(0)
    expect(a.zoom).toBe(1)
    expect(m.scrollPx).toBeCloseTo(333, 6)
    expect(m.zoom).toBeCloseTo(1.5, 6)
    expect(z.scrollPx).toBeCloseTo(666 * 0.99, 6)
    expect(m.originX).toBe(0.25 * W)
    expect(m.originY).toBe(0.5 * H)
  })
  it('fades in and out, with a plain cut as an option', () => {
    const bg = make({ transition: 'fade', transitionFrames: 10 })
    expect(websiteFrameState(0, bg, W, H).opacity).toBe(0)
    expect(websiteFrameState(5, bg, W, H).opacity).toBeCloseTo(0.5, 6)
    expect(websiteFrameState(50, bg, W, H).opacity).toBe(1)
    expect(websiteFrameState(94, bg, W, H).opacity).toBeCloseTo(0.5, 6)
    expect(websiteFrameState(99, bg, W, H).opacity).toBe(0)
    const cut = make({ transition: 'cut' })
    expect(websiteFrameState(0, cut, W, H).opacity).toBe(1)
    expect(websiteFrameState(99, cut, W, H).opacity).toBe(1)
  })
  it('never lets a transition take more than half the window', () => {
    const bg = make({ endFrame: 10, transitionFrames: 100 })
    const mid = websiteFrameState(5, bg, W, H)
    expect(mid.opacity).toBeGreaterThan(0.5)
  })
  it('slides in from below and out upward', () => {
    const bg = make({ transition: 'slide', transitionFrames: 10 })
    expect(websiteFrameState(0, bg, W, H).slideY).toBe(1)
    expect(websiteFrameState(5, bg, W, H).slideY).toBeCloseTo(0.5, 6)
    expect(websiteFrameState(50, bg, W, H).slideY).toBe(0)
    expect(websiteFrameState(99, bg, W, H).slideY).toBeLessThan(0)
  })
  it('shows a click effect for CLICK_EFFECT_FRAMES after the click and not before or after', () => {
    const bg = make({ cursor: { enabled: true, path: [{ t: 0, x: 0.2, y: 0.2 }, { t: 1, x: 0.8, y: 0.8 }], clicks: [0.5] } })
    expect(websiteFrameState(49, bg, W, H).clicks).toHaveLength(0)
    const at = websiteFrameState(50, bg, W, H).clicks
    expect(at).toHaveLength(1)
    expect(at[0].age).toBe(0)
    expect(at[0].x).toBeCloseTo(0.5, 6) // lands where the cursor is at that moment
    expect(websiteFrameState(50 + CLICK_EFFECT_FRAMES, bg, W, H).clicks[0].age).toBe(1)
    expect(websiteFrameState(50 + CLICK_EFFECT_FRAMES + 1, bg, W, H).clicks).toHaveLength(0)
    expect(websiteFrameState(55, make({ cursor: { enabled: false, path: bg.cursor.path, clicks: [0.5] } }), W, H).clicks).toHaveLength(0)
  })
  it('is a pure function of the frame (deterministic)', () => {
    const bg = make()
    for (const f of [0, 1, 33, 50, 99]) expect(websiteFrameState(f, bg, W, H)).toEqual(websiteFrameState(f, JSON.parse(JSON.stringify(bg)), W, H))
  })
  it('works at other aspect ratios (9:16)', () => {
    const bg = make()
    const portrait = websiteFrameState(50, bg, 1080, 1920)
    expect(portrait.scrollPx).toBeGreaterThanOrEqual(0)
    expect(portrait.originX).toBe(0.25 * 1080)
  })
})

describe('reusable motion', () => {
  it('contains no URL, title, picture or section name', () => {
    const motion = extractWebsiteMotion(make())
    const json = JSON.stringify(motion)
    for (const leaked of ['example.com', 'Acme', 'Pricing', 'page.jpg', 'http']) expect(json).not.toContain(leaked)
  })
  it('applies to another prospect\'s website without touching its picture or source', () => {
    const mine = make({ scroll: { from: 0.1, to: 0.9 }, zoom: { from: 1, to: 2.5 } })
    const theirs = make({ page: { url: 'https://cdn.example.com/other.jpg', width: 3840, height: 5000 }, source: { url: 'https://other.example/', title: 'Other', capturedAt: 'x' }, scroll: { from: 0, to: 0.2 }, zoom: { from: 1, to: 1 } })
    const out = applyWebsiteMotion(theirs, extractWebsiteMotion(mine))
    expect(out.scroll).toEqual({ from: 0.1, to: 0.9 })
    expect(out.zoom).toEqual({ from: 1, to: 2.5 })
    expect(out.page.url).toBe('https://cdn.example.com/other.jpg')
    expect(out.source.title).toBe('Other')
    expect(out.sections).toEqual(theirs.sections)
  })
  it('re-validates a stored motion', () => {
    expect(normalizeWebsiteMotion(null)).toBeUndefined()
    const m = normalizeWebsiteMotion({ startFrame: 5, endFrame: 3, zoom: { from: 9, to: 9 }, cursor: { enabled: true, path: [{ t: 2, x: 9, y: 9 }] } })
    expect(m?.zoom).toEqual({ from: 3, to: 3 })
    expect(m?.endFrame).toBeGreaterThan(m?.startFrame ?? 0)
    expect(m?.cursor.path[0]).toEqual({ t: 1, x: 1, y: 1 })
  })
})

describe('first animation from a capture', () => {
  const capturedPage = { name: 'home', path: '/', url: PAGE.url, width: 3840, height: 3492, layout: { pageH: 1746, sections: [{ x: 0, y: 0, width: 1920, height: 600 }, { x: 0, y: 600, width: 1920, height: 400 }] } }
  it('fits the opening seconds, scales layout sections to screenshot pixels and records the source', () => {
    const bg = defaultWebsiteBackground({ pageSource: capturedPage, site: { url: 'https://acme.example/', title: 'Acme' }, capturedAt: '2026-11-13T10:00:00Z', fps: 30, durationInFrames: 300 })!
    expect(bg.startFrame).toBe(0)
    expect(bg.endFrame).toBe(120) // 4 s
    expect(bg.sections[1]).toMatchObject({ y: 1200, height: 800 }) // css px x (3492 / 1746)
    expect(bg.source).toEqual({ url: 'https://acme.example/', title: 'Acme', capturedAt: '2026-11-13T10:00:00Z' })
    expect(bg.cursor.enabled).toBe(true)
    expect(bg.cursor.clicks).toHaveLength(1)
  })
  it('never outlasts a short video', () => {
    const bg = defaultWebsiteBackground({ pageSource: capturedPage, site: { url: 'https://a.example/', title: '' }, capturedAt: 'x', fps: 30, durationInFrames: 60 })!
    expect(bg.endFrame).toBeLessThanOrEqual(60)
    expect(bg.endFrame).toBeGreaterThan(bg.startFrame)
  })
  it('refuses a capture whose picture URL is not durable', () => {
    expect(defaultWebsiteBackground({ pageSource: { ...capturedPage, url: 'blob:x' }, site: { url: 'https://a.example/', title: '' }, capturedAt: 'x', fps: 30, durationInFrames: 150 })).toBeUndefined()
  })
})

describe('persistence through the project settings', () => {
  it('survives save -> JSON -> restore unchanged', () => {
    const settings = { ...createDefaultPreviewSettings(), websiteBackground: make() }
    const restored = normalizePreviewSettings(JSON.parse(JSON.stringify(settings)))
    expect(restored.websiteBackground).toEqual(settings.websiteBackground)
  })
  it('old projects load without one, and junk is dropped', () => {
    expect(normalizePreviewSettings(JSON.parse(JSON.stringify(createDefaultPreviewSettings()))).websiteBackground).toBeUndefined()
    expect(normalizePreviewSettings({ ...createDefaultPreviewSettings(), websiteBackground: { page: { url: 'blob:x', width: 10, height: 10 } } }).websiteBackground).toBeUndefined()
    expect(normalizePreviewSettings({ ...createDefaultPreviewSettings(), websiteBackground: 'nope' }).websiteBackground).toBeUndefined()
  })
})
