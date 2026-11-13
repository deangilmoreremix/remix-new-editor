// @vitest-environment jsdom
/**
 * Background removal loads image bytes without `fetch()`-ing data: URLs
 * (OpenHiggsBolt's production CSP has no `data:` in connect-src).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { loadImageBlob, dataUrlToBlob } from '../backgroundRemoval/loadImageBlob'

const read = (blob: Blob): Promise<string> =>
  // A Response's blob is a Node Blob (has .text()); jsdom's own Blob needs a FileReader.
  typeof (blob as Blob & { text?: unknown }).text === 'function'
    ? blob.text()
    : new Promise<string>((resolve) => {
    const r = new FileReader() // jsdom's Blob has no .text()
    r.onload = () => resolve(String(r.result))
    r.readAsText(blob)
  })

afterEach(() => vi.unstubAllGlobals())

describe('loadImageBlob', () => {
  it('decodes a base64 data URL without calling fetch', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const blob = await loadImageBlob(`data:image/png;base64,${btoa('PNGDATA')}`)
    expect(blob.type).toBe('image/png')
    expect(await read(blob)).toBe('PNGDATA')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('decodes a non-base64 data URL', async () => {
    const blob = dataUrlToBlob('data:image/svg+xml,%3Csvg%2F%3E')
    expect(blob.type).toBe('image/svg+xml')
    expect(await read(blob)).toBe('<svg/>')
  })

  it('fetches a remote image directly when the page allows it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('IMG', { headers: { 'content-type': 'image/jpeg' } })))
    expect(await read(await loadImageBlob('https://shop.example/a.jpg'))).toBe('IMG')
  })

  it('falls back to the same-origin proxy when the direct fetch is blocked, decoding its data URL without fetch', async () => {
    const proxyBody = { ok: true, results: [{ url: 'https://shop.example/a.jpg', ok: true, dataUrl: `data:image/jpeg;base64,${btoa('VIAPROXY')}` }] }
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/api/personalization/download-image')) return new Response(JSON.stringify(proxyBody), { status: 200 })
      throw new TypeError('Refused to connect because it violates the document Content Security Policy')
    })
    vi.stubGlobal('fetch', fetchSpy)
    const blob = await loadImageBlob('https://shop.example/a.jpg')
    expect(await read(blob)).toBe('VIAPROXY')
    // direct attempt + proxy call; the proxy's data URL is never fetched
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('throws a clear error when neither route can load the image', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('blocked') }))
    await expect(loadImageBlob('https://shop.example/a.jpg')).rejects.toThrow('could not be loaded')
  })
})
