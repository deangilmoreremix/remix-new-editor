// @vitest-environment jsdom
/**
 * Download mechanism certification for the browser export engine.
 *
 * `downloadWebExportBlob` turns the finished in-browser render into a direct
 * user download: it creates an object URL, wires an anchor, clicks it, then
 * revokes the URL. These tests pin the exact side-effect contract so a
 * refactor cannot silently break the download (missing click, wrong filename,
 * leaked URL, etc.).
 *
 * `downloadWebExportBlob` touches no Remotion API, so this file does not mock
 * `@remotion/web-renderer`; it imports the engine straight from `../webExport`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { downloadWebExportBlob } from '../webExport'

function makeBlob(): Blob {
  return new Blob(['fake-branded-video-bytes'], { type: 'video/mp4' })
}

const OriginalFetch = globalThis.fetch
const OriginalXHR = globalThis.XMLHttpRequest
const OriginalWebSocket = globalThis.WebSocket
const OriginalCreateObjectURL = URL.createObjectURL
const OriginalRevokeObjectURL = URL.revokeObjectURL

let createObjectURLSpy: ReturnType<typeof vi.fn>
let revokeSpy: ReturnType<typeof vi.fn>
let createElementSpy: ReturnType<typeof vi.spyOn>
let appendChildSpy: ReturnType<typeof vi.spyOn>
let clickSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.useFakeTimers()
  createObjectURLSpy = vi.fn(() => 'blob:http://localhost/final-video')
  revokeSpy = vi.fn()
  URL.createObjectURL = createObjectURLSpy as any
  URL.revokeObjectURL = revokeSpy as any

  createElementSpy = vi.spyOn(document, 'createElement')
  appendChildSpy = vi.spyOn(document.body, 'appendChild')
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click')
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  URL.createObjectURL = OriginalCreateObjectURL
  URL.revokeObjectURL = OriginalRevokeObjectURL
  globalThis.fetch = OriginalFetch
  globalThis.XMLHttpRequest = OriginalXHR
  globalThis.WebSocket = OriginalWebSocket
  document.body.innerHTML = ''
})

describe('downloadWebExportBlob mechanism', () => {
  it('creates an object URL from the rendered blob', () => {
    const blob = makeBlob()
    downloadWebExportBlob(blob, 'personalized-abc.mp4')

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
    expect(createObjectURLSpy).toHaveBeenCalledWith(blob)
  })

  it('wires an anchor with the blob URL, filename and download rel', () => {
    downloadWebExportBlob(makeBlob(), 'branded-final.mp4')

    const anchor = createElementSpy.mock.results[0].value as HTMLAnchorElement
    expect(anchor.tagName.toLowerCase()).toBe('a')
    expect(anchor.href).toBe('blob:http://localhost/final-video')
    expect(anchor.download).toBe('branded-final.mp4')
    expect(anchor.rel).toBe('noopener')
  })

  it('appends the anchor, clicks it, then removes it from the DOM', () => {
    downloadWebExportBlob(makeBlob(), 'out.mp4')

    const anchor = createElementSpy.mock.results[0].value as HTMLAnchorElement
    expect(appendChildSpy).toHaveBeenCalledWith(anchor)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(document.body.contains(anchor)).toBe(false)
  })

  it('never performs a network fetch to deliver the file', () => {
    const fetchSpy = vi.fn()
    const xhrSpy = vi.fn()
    const wsSpy = vi.fn()
    ;(globalThis as any).fetch = fetchSpy
    ;(globalThis as any).XMLHttpRequest = xhrSpy
    ;(globalThis as any).WebSocket = wsSpy

    downloadWebExportBlob(makeBlob(), 'out.mp4')

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrSpy).not.toHaveBeenCalled()
    expect(wsSpy).not.toHaveBeenCalled()

    globalThis.fetch = OriginalFetch
    globalThis.XMLHttpRequest = OriginalXHR
    globalThis.WebSocket = OriginalWebSocket
  })

  it('schedules a single URL revocation 60s out and does not revoke early', () => {
    downloadWebExportBlob(makeBlob(), 'out.mp4')

    // The URL is only kept around long enough for slow browsers to pick it up.
    expect(revokeSpy).not.toHaveBeenCalled()
    expect(() => vi.advanceTimersByTime(60_000)).not.toThrow()
    expect(revokeSpy).toHaveBeenCalledTimes(1)
    expect(revokeSpy).toHaveBeenCalledWith('blob:http://localhost/final-video')
  })

  it('is a no-op outside the browser (no document)', () => {
    const originalDocument = globalThis.document
    // @ts-expect-error simulate a non-browser (server) environment
    globalThis.document = undefined
    try {
      expect(() => downloadWebExportBlob(makeBlob(), 'out.mp4')).not.toThrow()
      expect(createElementSpy).not.toHaveBeenCalled()
      expect(createObjectURLSpy).not.toHaveBeenCalled()
    } finally {
      globalThis.document = originalDocument
    }
  })
})
