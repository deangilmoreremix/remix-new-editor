/**
 * Website background (Stage 2): a captured website shown behind the personalized video, scrolling, zooming,
 * with an animated cursor and click effects, then handing over to the presenter/source video.
 *
 * Everything here is a PURE function of the frame number and the stored settings (no React, no Remotion, no
 * clock, no randomness), so the live preview, the editor stage and the exported video draw identical frames.
 *
 * Geometry. The captured page is an image `page.width x page.height` (2x CSS px, from the existing capture).
 * It is fitted to the composition WIDTH (scale s0 = compW / page.width), so the page height shown is
 * page.height * s0 and the scrollable distance is max(0, that - compH). Scrolling translates the page up by
 * scroll * maxScroll; zoom scales the whole framed window about a focus point. Cursor positions are fractions
 * of the FRAME (not of the page), so they stay put while the page scrolls under them.
 */

export type WebsiteEase = 'linear' | 'ease-in-out'
export type WebsiteTransition = 'cut' | 'fade' | 'slide'
export type CursorStyle = 'arrow' | 'hand'
export type ClickEffect = 'ripple' | 'pulse'

export interface WebsiteSection {
  label: string
  /** Position of the section on the screenshot, in screenshot pixels. */
  y: number
  height: number
}

export interface CursorPoint {
  /** Fraction (0..1) of the website window at which the cursor is here. */
  t: number
  /** Cursor position as fractions of the frame. */
  x: number
  y: number
}

export interface WebsiteBackground {
  enabled: boolean
  /** Where the picture came from: shown to the customer and kept with the project (source attribution). */
  source: { url: string; title: string; capturedAt: string }
  /** The full-page screenshot (durable http(s) URL) and its size in screenshot pixels. */
  page: { url: string; width: number; height: number }
  sections: WebsiteSection[]
  /** The website is on screen from `startFrame` until `endFrame`; then the source/presenter video shows. */
  startFrame: number
  endFrame: number
  transition: WebsiteTransition
  transitionFrames: number
  /** Scroll position at the start and end of the window, 0 (top) .. 1 (bottom of the scrollable range). */
  scroll: { from: number; to: number }
  ease: WebsiteEase
  zoom: { from: number; to: number }
  /** The point of the frame (0..1) the zoom is centred on. */
  focus: { x: number; y: number }
  cursor: {
    enabled: boolean
    style: CursorStyle
    path: CursorPoint[]
    /** Click moments, as fractions (0..1) of the window. The click lands where the cursor is at that moment. */
    clicks: number[]
    clickEffect: ClickEffect
  }
}

export const MAX_SECTIONS = 40
export const MAX_CURSOR_POINTS = 40
export const MAX_CLICKS = 20
export const MIN_WEBSITE_ZOOM = 1
export const MAX_WEBSITE_ZOOM = 3
/** A click effect lasts this many frames. */
export const CLICK_EFFECT_FRAMES = 14
const MAX_DIMENSION = 100_000

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const clamp01 = (n: number) => clamp(n, 0, 1)
const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d

/** Only durable http(s) URLs survive a reload; blob:/data:/javascript: and relative URLs are refused. */
export function isDurableHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false
  try {
    const u = new URL(value)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

const hostOf = (url: string) => {
  try { return new URL(url).host } catch { return '' }
}
export { hostOf as websiteHost }

// ── normalization (settings come back from storage / the network: never trust them) ─────────────────────────────

export function normalizeWebsiteBackground(raw: unknown): WebsiteBackground | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const r = raw as Record<string, any>
  const page = r.page
  if (!page || !isDurableHttpUrl(page.url)) return undefined
  const width = finite(page.width) ? page.width : 0
  const height = finite(page.height) ? page.height : 0
  if (width < 16 || height < 16 || width > MAX_DIMENSION || height > MAX_DIMENSION) return undefined
  const srcUrl = isDurableHttpUrl(r.source?.url) ? r.source.url : ''
  const startFrame = Math.max(0, Math.round(finite(r.startFrame) ? r.startFrame : 0))
  const endFrame = Math.max(startFrame + 1, Math.round(finite(r.endFrame) ? r.endFrame : startFrame + 90))

  const sections: WebsiteSection[] = []
  if (Array.isArray(r.sections)) {
    for (const s of r.sections) {
      if (sections.length >= MAX_SECTIONS) break
      if (!s || typeof s !== 'object' || !finite(s.y) || !finite(s.height) || s.height <= 0) continue
      const y = clamp(s.y, 0, height)
      sections.push({ label: typeof s.label === 'string' ? s.label.slice(0, 80) : '', y: round(y, 1), height: round(Math.min(s.height, height - y), 1) })
    }
  }

  const path: CursorPoint[] = []
  if (Array.isArray(r.cursor?.path)) {
    for (const p of r.cursor.path) {
      if (path.length >= MAX_CURSOR_POINTS) break
      if (!p || !finite(p.t) || !finite(p.x) || !finite(p.y)) continue
      path.push({ t: round(clamp01(p.t)), x: round(clamp01(p.x)), y: round(clamp01(p.y)) })
    }
    path.sort((a, b) => a.t - b.t)
  }
  const clicks: number[] = []
  if (Array.isArray(r.cursor?.clicks)) {
    for (const c of r.cursor.clicks) {
      if (clicks.length >= MAX_CLICKS) break
      if (finite(c)) clicks.push(round(clamp01(c)))
    }
    clicks.sort((a, b) => a - b)
  }

  const scrollFrom = clamp01(finite(r.scroll?.from) ? r.scroll.from : 0)
  const scrollTo = clamp01(finite(r.scroll?.to) ? r.scroll.to : 1)
  return {
    enabled: r.enabled !== false,
    source: { url: srcUrl, title: typeof r.source?.title === 'string' ? r.source.title.slice(0, 200) : '', capturedAt: typeof r.source?.capturedAt === 'string' ? r.source.capturedAt.slice(0, 40) : '' },
    page: { url: page.url, width: Math.round(width), height: Math.round(height) },
    sections,
    startFrame,
    endFrame,
    transition: r.transition === 'cut' || r.transition === 'slide' ? r.transition : 'fade',
    transitionFrames: Math.round(clamp(finite(r.transitionFrames) ? r.transitionFrames : 12, 0, 120)),
    scroll: { from: round(scrollFrom), to: round(scrollTo) },
    ease: r.ease === 'linear' ? 'linear' : 'ease-in-out',
    zoom: {
      from: round(clamp(finite(r.zoom?.from) ? r.zoom.from : 1, MIN_WEBSITE_ZOOM, MAX_WEBSITE_ZOOM), 3),
      to: round(clamp(finite(r.zoom?.to) ? r.zoom.to : 1, MIN_WEBSITE_ZOOM, MAX_WEBSITE_ZOOM), 3),
    },
    focus: { x: round(clamp01(finite(r.focus?.x) ? r.focus.x : 0.5)), y: round(clamp01(finite(r.focus?.y) ? r.focus.y : 0.5)) },
    cursor: {
      enabled: r.cursor?.enabled === true && path.length > 0,
      style: r.cursor?.style === 'hand' ? 'hand' : 'arrow',
      path,
      clicks,
      clickEffect: r.cursor?.clickEffect === 'pulse' ? 'pulse' : 'ripple',
    },
  }
}

/** The part of a website background that is pure motion (no URL, title, picture or section names): safe to reuse in a layout. */
export type WebsiteMotion = Pick<WebsiteBackground, 'startFrame' | 'endFrame' | 'transition' | 'transitionFrames' | 'scroll' | 'ease' | 'zoom' | 'focus'> & {
  cursor: Pick<WebsiteBackground['cursor'], 'enabled' | 'style' | 'path' | 'clicks' | 'clickEffect'>
}

export function extractWebsiteMotion(bg: WebsiteBackground): WebsiteMotion {
  return {
    startFrame: bg.startFrame, endFrame: bg.endFrame, transition: bg.transition, transitionFrames: bg.transitionFrames,
    scroll: { ...bg.scroll }, ease: bg.ease, zoom: { ...bg.zoom }, focus: { ...bg.focus },
    cursor: { enabled: bg.cursor.enabled, style: bg.cursor.style, path: bg.cursor.path.map((p) => ({ ...p })), clicks: [...bg.cursor.clicks], clickEffect: bg.cursor.clickEffect },
  }
}

/** Re-validates a stored motion by running it through the full normalizer on a throwaway background. */
export function normalizeWebsiteMotion(raw: unknown): WebsiteMotion | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const probe = normalizeWebsiteBackground({ ...(raw as object), page: { url: 'https://placeholder.invalid/p.jpg', width: 1000, height: 1000 } })
  return probe ? extractWebsiteMotion(probe) : undefined
}

/** Applies a reusable motion to a background, keeping the background's own picture, URL and sections. */
export function applyWebsiteMotion(bg: WebsiteBackground, motion: WebsiteMotion): WebsiteBackground {
  const merged = normalizeWebsiteBackground({ ...bg, ...motion, cursor: { ...bg.cursor, ...motion.cursor }, source: bg.source, page: bg.page, sections: bg.sections, enabled: bg.enabled })
  return merged ?? bg
}

// ── motion (pure functions of the frame) ────────────────────────────────────────────────────────────────────────

export function easeValue(p: number, ease: WebsiteEase): number {
  const x = clamp01(p)
  return ease === 'linear' ? x : x * x * (3 - 2 * x)
}

/** 0 before the window, 1 after it. */
export function windowProgress(frame: number, bg: Pick<WebsiteBackground, 'startFrame' | 'endFrame'>): number {
  const span = Math.max(1, bg.endFrame - bg.startFrame)
  return clamp01((frame - bg.startFrame) / span)
}

/** Page height as drawn when the page is fitted to the frame width. */
export function displayedPageHeight(bg: Pick<WebsiteBackground, 'page'>, compW: number): number {
  return bg.page.height * (compW / bg.page.width)
}

/** How far the page can scroll, in composition pixels. */
export function maxScrollPx(bg: Pick<WebsiteBackground, 'page'>, compW: number, compH: number): number {
  return Math.max(0, displayedPageHeight(bg, compW) - compH)
}

/** The scroll fraction (0..1) that brings a section's top to the top of the frame. */
export function scrollFractionForSection(section: WebsiteSection, bg: Pick<WebsiteBackground, 'page'>, compW: number, compH: number): number {
  const max = maxScrollPx(bg, compW, compH)
  if (max <= 0) return 0
  return clamp01((section.y * (compW / bg.page.width)) / max)
}

export interface CursorState {
  visible: boolean
  x: number
  y: number
}

/** Cursor position at window progress `p` (0..1): linear between path points, eased per segment; held before/after the path. */
export function cursorAt(path: CursorPoint[], p: number): CursorState {
  if (path.length === 0) return { visible: false, x: 0, y: 0 }
  if (path.length === 1 || p <= path[0].t) return { visible: true, x: path[0].x, y: path[0].y }
  const last = path[path.length - 1]
  if (p >= last.t) return { visible: true, x: last.x, y: last.y }
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    if (p >= a.t && p <= b.t) {
      const span = b.t - a.t
      const k = span <= 0 ? 1 : easeValue((p - a.t) / span, 'ease-in-out')
      return { visible: true, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }
    }
  }
  return { visible: true, x: last.x, y: last.y }
}

export interface ClickState {
  /** 0 at the moment of the click .. 1 when the effect has finished. */
  age: number
  x: number
  y: number
}

export interface WebsiteFrameState {
  /** False when the website is off screen at this frame (before/after its window, or disabled). */
  visible: boolean
  opacity: number
  /** Slide transition: vertical offset as a fraction of the frame height (0 = in place, 1 = fully below). */
  slideY: number
  scrollPx: number
  zoom: number
  originX: number
  originY: number
  cursor: CursorState
  clicks: ClickState[]
}

const HIDDEN: WebsiteFrameState = { visible: false, opacity: 0, slideY: 0, scrollPx: 0, zoom: 1, originX: 0, originY: 0, cursor: { visible: false, x: 0, y: 0 }, clicks: [] }

/** Everything the renderer needs to draw the website at one frame. Deterministic. */
export function websiteFrameState(frame: number, bg: WebsiteBackground, compW: number, compH: number): WebsiteFrameState {
  if (!bg.enabled || frame < bg.startFrame || frame >= bg.endFrame) return HIDDEN
  const p = windowProgress(frame, bg)
  const e = easeValue(p, bg.ease)
  const scrollFraction = bg.scroll.from + (bg.scroll.to - bg.scroll.from) * e
  const zoom = bg.zoom.from + (bg.zoom.to - bg.zoom.from) * e

  // Transition in/out: fade or slide over `transitionFrames`, never longer than half the window.
  const tf = bg.transition === 'cut' ? 0 : Math.min(bg.transitionFrames, Math.floor((bg.endFrame - bg.startFrame) / 2))
  const intoWindow = frame - bg.startFrame
  const outOfWindow = bg.endFrame - 1 - frame
  const edge = tf > 0 ? Math.min(1, Math.min(intoWindow, outOfWindow) / tf) : 1
  const entering = tf > 0 && intoWindow < tf && intoWindow <= outOfWindow
  const opacity = bg.transition === 'fade' ? clamp01(edge) : 1
  const slideY = bg.transition === 'slide' && tf > 0 ? (entering ? 1 - clamp01(intoWindow / tf) : outOfWindow < tf ? -(1 - clamp01(outOfWindow / tf)) : 0) : 0

  const cursor = bg.cursor.enabled ? cursorAt(bg.cursor.path, p) : { visible: false, x: 0, y: 0 }
  const clicks: ClickState[] = []
  if (bg.cursor.enabled) {
    const span = Math.max(1, bg.endFrame - bg.startFrame)
    for (const c of bg.cursor.clicks) {
      const age = frame - (bg.startFrame + c * span)
      if (age >= 0 && age <= CLICK_EFFECT_FRAMES) {
        const at = cursorAt(bg.cursor.path, c)
        clicks.push({ age: age / CLICK_EFFECT_FRAMES, x: at.x, y: at.y })
      }
    }
  }
  return {
    visible: true,
    opacity,
    slideY,
    scrollPx: maxScrollPx(bg, compW, compH) * scrollFraction,
    zoom,
    originX: bg.focus.x * compW,
    originY: bg.focus.y * compH,
    cursor,
    clicks,
  }
}

// ── building a background from a capture ────────────────────────────────────────────────────────────────────────

export interface CapturedPage {
  name?: string
  path?: string
  url: string
  width: number
  height: number
  layout?: { pageH?: number; sections?: Array<{ x: number; y: number; width: number; height: number }> } | null
}

/**
 * A sensible first animation for a freshly captured page: the website fills the opening seconds, scrolling from the top
 * towards the middle of the page with a gentle zoom, an arrow gliding to the middle and one click, fading out into the video.
 * Sections come from the capture's layout (CSS px) scaled to screenshot px.
 */
export function defaultWebsiteBackground(input: {
  pageSource: CapturedPage
  site: { url: string; title: string }
  capturedAt: string
  fps: number
  durationInFrames: number
}): WebsiteBackground | undefined {
  const { pageSource: pg, fps, durationInFrames } = input
  const windowFrames = Math.max(30, Math.min(Math.round(fps * 4), Math.max(30, durationInFrames - Math.round(fps))))
  const cssToShot = pg.layout?.pageH && pg.layout.pageH > 0 ? pg.height / pg.layout.pageH : 1
  const sections = (pg.layout?.sections ?? []).slice(0, MAX_SECTIONS).map((s, i) => ({ label: `Section ${i + 1}`, y: s.y * cssToShot, height: s.height * cssToShot }))
  return normalizeWebsiteBackground({
    enabled: true,
    source: { url: input.site.url, title: input.site.title, capturedAt: input.capturedAt },
    page: { url: pg.url, width: pg.width, height: pg.height },
    sections,
    startFrame: 0,
    endFrame: Math.min(durationInFrames, windowFrames),
    transition: 'fade',
    transitionFrames: Math.round(fps * 0.5),
    scroll: { from: 0, to: 0.45 },
    ease: 'ease-in-out',
    zoom: { from: 1, to: 1.12 },
    focus: { x: 0.5, y: 0.35 },
    cursor: {
      enabled: true,
      style: 'arrow',
      path: [{ t: 0, x: 0.78, y: 0.82 }, { t: 0.55, x: 0.5, y: 0.5 }, { t: 1, x: 0.5, y: 0.5 }],
      clicks: [0.7],
      clickEffect: 'ripple',
    },
  })
}
