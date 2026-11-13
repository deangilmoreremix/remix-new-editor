/**
 * Generation reads its reference image as bytes. A website image linked by
 * its address is read through the same-origin download route when the site
 * refuses a direct fetch, and a failure is reported instead of being replaced
 * by a blank image.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { toImageBlob } from '../generationRouter'

afterEach(() => vi.unstubAllGlobals())

const PNG = 'data:image/png;base64,iVBORw0KGgo='

describe('toImageBlob', () => {
  it('uses a direct fetch when the site allows it', async () => {
    const fetchMock = vi.fn(async () => new Response(new Blob(['abc'], { type: 'image/jpeg' })))
    vi.stubGlobal('fetch', fetchMock)

    const blob = await toImageBlob('https://cdn.example/a.jpg')

    expect(blob.type).toBe('image/jpeg')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to the download route when the site blocks a direct fetch', async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url)
      if (u.startsWith('https://biz.example')) throw new TypeError('Failed to fetch')
      if (u.includes('/api/personalization/download-image')) {
        return new Response(JSON.stringify({ ok: true, results: [{ url: 'https://biz.example/a.jpg', ok: true, dataUrl: PNG }] }))
      }
      return new Response(new Blob(['png'], { type: 'image/png' }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const blob = await toImageBlob('https://biz.example/a.jpg')

    expect(blob.type).toBe('image/png')
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/api/personalization/download-image'))).toBe(true)
  })

  it('reports a failure instead of substituting a blank image', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes('/api/personalization/download-image')) {
        return new Response(JSON.stringify({ ok: true, results: [{ ok: false }] }))
      }
      throw new TypeError('Failed to fetch')
    }))

    await expect(toImageBlob('https://biz.example/a.jpg')).rejects.toThrow('could not be loaded')
  })
})
