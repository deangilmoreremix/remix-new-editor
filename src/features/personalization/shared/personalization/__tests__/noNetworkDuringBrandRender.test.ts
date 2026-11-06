// @vitest-environment jsdom
/**
 * Certification: the branded render must make NO network calls.
 *
 * The overlay-only final video is produced entirely in-browser by
 * `@remotion/web-renderer` (mocked here via the shared harness). The
 * `createFinalVideo` branded-render branch must therefore never touch `fetch`,
 * `XMLHttpRequest` or `WebSocket`, and must never import the server-side
 * generation path. These tests spy on every network entry point at runtime while
 * a full branded render runs and assert zero calls, then back that up with a
 * source-level scan of `webExport.ts`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  cancelActiveExport,
  configureCapableBrowser,
  getCtx,
  openSource,
  renderMediaOnWeb,
  renderProvider,
  resetRendererMocks,
  type HarnessRef,
} from './_createFinalVideoHarness'
import {
  WEB_RENDER_MIME_TYPE,
  PERSONALIZATION_COMPOSITION_ID,
} from '../finalOutput'
import { DESIGN_FONT_FACE_CSS } from '../templates/typography'

function makeBlob() {
  return new Blob(['fake-branded-video-bytes'], { type: 'video/mp4' })
}

const OriginalFetch = globalThis.fetch
const OriginalXHR = globalThis.XMLHttpRequest
const OriginalWebSocket = globalThis.WebSocket

beforeEach(() => {
  localStorage.clear()
  URL.createObjectURL = vi.fn(() => 'blob:http://localhost/final') as any
  URL.revokeObjectURL = vi.fn() as any
  resetRendererMocks()
  configureCapableBrowser()
})

afterEach(() => {
  cancelActiveExport()
  vi.restoreAllMocks()
  globalThis.fetch = OriginalFetch
  globalThis.XMLHttpRequest = OriginalXHR
  globalThis.WebSocket = OriginalWebSocket
  document.body.innerHTML = ''
})

describe('no network during branded render', () => {
  it('makes zero fetch / XHR / WebSocket calls while createFinalVideo runs', async () => {
    const fetchSpy = vi.fn()
    const xhrSpy = vi.fn()
    const wsSpy = vi.fn()
    ;(globalThis as any).fetch = fetchSpy
    ;(globalThis as any).XMLHttpRequest = xhrSpy
    ;(globalThis as any).WebSocket = wsSpy

    const ref: HarnessRef = { current: null }
    await renderProvider(ref)
    await openSource(ref)

    await act(async () => {
      getCtx(ref).approvePersonalization()
    })
    await act(async () => {})

    // Let any deferred setup work settle so we only observe the render itself.
    await new Promise((r) => setTimeout(r, 0))
    fetchSpy.mockClear()
    xhrSpy.mockClear()
    wsSpy.mockClear()

    renderMediaOnWeb.mockImplementation(async () => ({
      getBlob: async () => makeBlob(),
    }))

    await act(async () => {
      await getCtx(ref).createFinalVideo()
    })

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrSpy).not.toHaveBeenCalled()
    expect(wsSpy).not.toHaveBeenCalled()

    // The finished video is handed off as a blob URL, not uploaded anywhere.
    expect(getCtx(ref).result.type).toBe('video')
    expect(getCtx(ref).result.url).toMatch(/^blob:/)
    expect(getCtx(ref).result.metadata.source).toBe('branded-render')
  })

  it('webExport.ts never references a network entry point in executable code', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/personalization/shared/personalization/webExport.ts'),
      'utf-8',
    )
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

    expect(code).not.toMatch(/\bfetch\s*\(/)
    expect(code).not.toMatch(/XMLHttpRequest/)
    expect(code).not.toMatch(/\bWebSocket\b/)
    expect(code).not.toMatch(/muapi/i)
    expect(code).not.toMatch(/openai/i)
    expect(code).not.toMatch(/['"`]\/api\//)
    // The renderer is the only external dependency and it is loaded dynamically.
    expect(code).toContain("import('@remotion/web-renderer')")
  })

  it('brands the render with the approved composition id and mp4 contract', async () => {
    const ref: HarnessRef = { current: null }
    await renderProvider(ref)
    await openSource(ref)

    await act(async () => {
      getCtx(ref).approvePersonalization()
    })
    await act(async () => {})

    renderMediaOnWeb.mockImplementation(async (opts: any) => {
      expect(opts.composition.id).toBe(PERSONALIZATION_COMPOSITION_ID)
      return { getBlob: async () => makeBlob() }
    })

    await act(async () => {
      await getCtx(ref).createFinalVideo()
    })

    expect(getCtx(ref).generation.status).toBe('complete')
    expect(getCtx(ref).result.metadata.container).toBe(WEB_RENDER_MIME_TYPE.mp4)
    expect(getCtx(ref).result.metadata.extension).toBe('mp4')
  })
})

/**
 * Phase 3 decision D1 — the FontFace.load() spy.
 *
 * The first test spies on fetch/XHR/WebSocket, which the browser-internal
 * font loader does NOT go through: a font loaded through `new FontFace(url)`
 * or a `url()` reference would break the zero-network property while the
 * test stayed green (A6's memo). This test stubs `globalThis.FontFace` with
 * a recording class, runs the SAME branded render, and asserts that the
 * loader never reached any URL.
 *
 * The stub is scoped to this test only (installed and restored inside it) so
 * the harness for the three existing tests keeps using the real environment.
 */
describe('no font network requests during branded render (D1)', () => {
  it('never calls FontFace.load() with a URL during a branded render', async () => {
    const globalScope = globalThis as unknown as Record<string, unknown>
    const OriginalFontFace = globalScope.FontFace
    const recordedSources: unknown[] = []

    class RecordingFontFace {
      family: string
      status: string
      private readonly source: unknown

      constructor(family: string, source: unknown) {
        this.family = family
        this.source = source
        this.status = 'unloaded'
      }

      load(): Promise<{ family: string; status: string }> {
        recordedSources.push(this.source)
        this.status = 'loaded'
        return Promise.resolve({ family: this.family, status: this.status })
      }
    }
    globalScope.FontFace = RecordingFontFace

    try {
      const fetchSpy = vi.fn()
      globalScope.fetch = fetchSpy

      const ref: HarnessRef = { current: null }
      await renderProvider(ref)
      await openSource(ref)

      await act(async () => {
        getCtx(ref).approvePersonalization()
      })
      await act(async () => {})
      await new Promise((r) => setTimeout(r, 0))
      fetchSpy.mockClear()

      renderMediaOnWeb.mockImplementation(async () => ({
        getBlob: async () => makeBlob(),
      }))

      await act(async () => {
        await getCtx(ref).createFinalVideo()
      })

      // The strongest form: load() is never called AT ALL — the @font-face
      // rule carries the whole font as a base64 data URI, so there is no
      // source for the font loader to fetch (not even a same-origin one).
      expect(recordedSources).toEqual([])
      // Defence in depth: should a future source ever be recorded, it must
      // still not be remote.
      const remoteSources = recordedSources.filter((source) =>
        /https?:\/\//i.test(String(source)),
      )
      expect(remoteSources).toEqual([])

      // The injected @font-face CSS itself carries no URL to fetch: no
      // remote URL and no public/-path reference — only the data URI.
      expect(DESIGN_FONT_FACE_CSS).toMatch(/data:font\/woff2;base64,/)
      expect(DESIGN_FONT_FACE_CSS).not.toMatch(/https?:\/\//i)
      expect(DESIGN_FONT_FACE_CSS).not.toContain('url("/fonts/')
      expect(DESIGN_FONT_FACE_CSS).not.toMatch(/url\(['"]?\//)
    } finally {
      globalScope.FontFace = OriginalFontFace
    }
  })
})
