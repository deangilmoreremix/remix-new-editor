// @vitest-environment jsdom
/**
 * Background removal loads image bytes without `fetch()`-ing data: URLs
 * (OpenHiggsBolt's production CSP has no `data:` in connect-src).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { loadImageBlob, dataUrlToBlob, resetProxyChoiceForTests, SIGNED_IN_REFUSAL_MEMORY_MS } from '../backgroundRemoval/loadImageBlob'

const read = (blob: Blob): Promise<string> =>
  // A Response's blob is a Node Blob (has .text()); jsdom's own Blob needs a FileReader.
  typeof (blob as Blob & { text?: unknown }).text === 'function'
    ? blob.text()
    : new Promise<string>((resolve) => {
    const r = new FileReader() // jsdom's Blob has no .text()
    r.onload = () => resolve(String(r.result))
    r.readAsText(blob)
  })

afterEach(() => {
  vi.unstubAllGlobals()
  resetProxyChoiceForTests()
})

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

  it('signed-out visitors use the public download route, signed-in ones the personalization route', async () => {
    const proxyBody = { ok: true, results: [{ ok: true, dataUrl: `data:image/jpeg;base64,${btoa('X')}` }] }
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      calls.push(url)
      if (url.includes('/download-image')) return new Response(JSON.stringify(proxyBody), { status: 200 })
      throw new TypeError('blocked by CSP')
    }))
    await loadImageBlob('https://shop.example/a.jpg', { anonymous: true })
    await loadImageBlob('https://shop.example/b.jpg')
    expect(calls.filter((u) => u.includes('/download-image'))).toEqual([
      '/api/demo/download-image',
      '/api/personalization/download-image',
    ])
  })

  it('a visitor without a sign-in session falls back to the public route, then skips the refused route', async () => {
    const okBody = { ok: true, results: [{ ok: true, dataUrl: `data:image/jpeg;base64,${btoa('PUBLIC')}` }] }
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      calls.push(url)
      if (url === '/api/personalization/download-image') return new Response('{"error":"UNAUTHENTICATED"}', { status: 401 })
      if (url === '/api/demo/download-image') return new Response(JSON.stringify(okBody), { status: 200 })
      throw new TypeError('blocked by CSP')
    }))
    expect(await read(await loadImageBlob('https://shop.example/a.jpg'))).toBe('PUBLIC')
    expect(await read(await loadImageBlob('https://shop.example/b.jpg'))).toBe('PUBLIC')
    expect(calls.filter((u) => u.includes('/download-image'))).toEqual([
      '/api/personalization/download-image', // first image: refused with 401
      '/api/demo/download-image',             // ...so the public route answers
      '/api/demo/download-image',             // second image goes straight to the public route
    ])
  })

  it('retries the signed-in route after the refusal memory expires (e.g. the visitor signed in meanwhile)', async () => {
    vi.useFakeTimers()
    try {
      const okBody = { ok: true, results: [{ ok: true, dataUrl: `data:image/jpeg;base64,${btoa('X')}` }] }
      let signedIn = false
      const calls: string[] = []
      vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        calls.push(url)
        if (url === '/api/personalization/download-image') {
          return signedIn ? new Response(JSON.stringify(okBody), { status: 200 }) : new Response('{}', { status: 401 })
        }
        if (url === '/api/demo/download-image') return new Response(JSON.stringify(okBody), { status: 200 })
        throw new TypeError('blocked by CSP')
      }))
      await loadImageBlob('https://shop.example/a.jpg') // 401, then public
      signedIn = true
      vi.advanceTimersByTime(SIGNED_IN_REFUSAL_MEMORY_MS + 1_000)
      await loadImageBlob('https://shop.example/b.jpg') // signed-in route is tried again and works
      expect(calls.filter((u) => u.includes('/download-image'))).toEqual([
        '/api/personalization/download-image',
        '/api/demo/download-image',
        '/api/personalization/download-image',
      ])
    } finally {
      vi.useRealTimers()
    }
  })

  it('only an auth refusal reaches the public route: a signed-in 429, 5xx, network error or failed image does not', async () => {
    for (const failure of ['429', '500', 'throw', 'image-failed'] as const) {
      resetProxyChoiceForTests()
      const calls: string[] = []
      vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        calls.push(url)
        if (url === '/api/personalization/download-image') {
          if (failure === '429') return new Response('{}', { status: 429 })
          if (failure === '500') return new Response('{}', { status: 500 })
          if (failure === 'image-failed') return new Response(JSON.stringify({ ok: true, results: [{ ok: false, error: 'x' }] }), { status: 200 })
          throw new TypeError('network')
        }
        if (url === '/api/demo/download-image') return new Response(JSON.stringify({ ok: true, results: [{ ok: true, dataUrl: 'data:image/png;base64,AA==' }] }), { status: 200 })
        throw new TypeError('blocked by CSP')
      }))
      await expect(loadImageBlob('https://shop.example/a.jpg')).rejects.toThrow('could not be loaded')
      expect(calls.filter((u) => u.includes('/download-image'))).toEqual(['/api/personalization/download-image'])
    }
  })

  it('a signed-in user never touches the public route', async () => {
    const okBody = { ok: true, results: [{ ok: true, dataUrl: `data:image/jpeg;base64,${btoa('SIGNED')}` }] }
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      calls.push(url)
      if (url === '/api/personalization/download-image') return new Response(JSON.stringify(okBody), { status: 200 })
      throw new TypeError('blocked by CSP')
    }))
    expect(await read(await loadImageBlob('https://shop.example/a.jpg'))).toBe('SIGNED')
    expect(calls.some((u) => u === '/api/demo/download-image')).toBe(false)
  })

  describe('stalled hosts and cancellation', () => {
    /** A fetch that never answers until its signal aborts, like a host that stops sending. */
    const hangUntilAborted = (init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
      })

    it('gives up on a stalled direct download after the timeout and uses the proxy', async () => {
      const proxyBody = { ok: true, results: [{ ok: true, dataUrl: `data:image/jpeg;base64,${btoa('VIAPROXY')}` }] }
      const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
        String(input).includes('/api/personalization/download-image')
          ? new Response(JSON.stringify(proxyBody), { status: 200 })
          : hangUntilAborted(init),
      )
      vi.stubGlobal('fetch', fetchSpy)
      const blob = await loadImageBlob('https://slow.example/a.jpg', { directTimeoutMs: 30 })
      expect(await read(blob)).toBe('VIAPROXY')
    })

    it('rejects promptly with an AbortError when the caller cancels a stalled download (no proxy fallback)', async () => {
      const fetchSpy = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => hangUntilAborted(init))
      vi.stubGlobal('fetch', fetchSpy)
      const controller = new AbortController()
      const pending = loadImageBlob('https://slow.example/a.jpg', { signal: controller.signal })
      await Promise.resolve()
      controller.abort()
      await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
      expect(fetchSpy).toHaveBeenCalledTimes(1) // the proxy was not tried after the cancel
    })

    it('does nothing when the signal is already aborted', async () => {
      const fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)
      const controller = new AbortController()
      controller.abort()
      await expect(loadImageBlob('https://x.example/a.jpg', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('also bounds a stalled proxy', async () => {
      vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => hangUntilAborted(init)))
      await expect(loadImageBlob('https://slow.example/a.jpg', { directTimeoutMs: 20, proxyTimeoutMs: 20 })).rejects.toThrow('could not be loaded')
    })
  })
})
