// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from '../../shims/next-server'

// The route resolves a style key against two compile-time upstreams: the
// published site media (current upstream bytes) first and the GitHub release
// asset as a fallback.
const PRIMARY_BASE = 'https://vincentwei1021.github.io/video-shotcraft/media'
const FALLBACK_BASE =
  'https://github.com/Vincentwei1021/video-shotcraft/releases/download/gallery-media'

const STYLE_KEY = 'basic-3d-scene'
const PRIMARY_URL = `${PRIMARY_BASE}/${STYLE_KEY}.mp4`
const FALLBACK_URL = `${FALLBACK_BASE}/${STYLE_KEY}.mp4`

function makeRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init)
}

/** A real upstream response, so the route sees the same shape a fetch would give it. */
function upstreamResponse(
  status: number,
  headers: Record<string, string> = {},
  body: string | null = null
): Response {
  return new Response(body, { status, headers })
}

/** The URLs the route actually asked the network for, in call order. */
function calledUrls(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls.map((call) => String(call[0]))
}

/** The request headers of every upstream call, lower-cased for easy lookup. */
function calledHeaders(fetchMock: ReturnType<typeof vi.fn>): Record<string, string>[] {
  return fetchMock.mock.calls.map((call) => {
    const init = call[1] as RequestInit | undefined
    const headers = (init?.headers ?? {}) as Record<string, string>
    const lowered: Record<string, string> = {}
    for (const key of Object.keys(headers)) lowered[key.toLowerCase()] = headers[key]
    return lowered
  })
}

async function callRoute(styleKey: string, init?: RequestInit) {
  const { GET } = await import('../../app/api/media/shotcraft/[styleKey]/route')
  return GET(makeRequest(`http://localhost/api/media/shotcraft/${encodeURIComponent(styleKey)}.mp4`, init), {
    params: Promise.resolve({ styleKey }),
  })
}

describe('GET /api/media/shotcraft/[styleKey]', () => {
  let originalFetch: typeof global.fetch
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    originalFetch = global.fetch
    vi.resetModules()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    global.fetch = originalFetch
  })

  it('serves a 206 from the primary site origin', async () => {
    fetchMock.mockImplementation(async () =>
      upstreamResponse(
        206,
        {
          'content-type': 'video/mp4',
          'accept-ranges': 'bytes',
          'content-range': 'bytes 0-1023/4096',
          'content-length': '11',
        },
        'mp4-bytes'
      )
    )

    const res = await callRoute(STYLE_KEY)

    expect(res.status).toBe(206)
    expect(res.headers.get('content-type')).toBe('video/mp4')
    expect(res.headers.get('accept-ranges')).toBe('bytes')
    expect(res.headers.get('content-range')).toBe('bytes 0-1023/4096')
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600, stale-while-revalidate=86400')
    // The primary origin answered, so the fallback is never contacted.
    expect(calledUrls(fetchMock)).toEqual([PRIMARY_URL])
  })

  it('falls back to the release asset when the primary origin misses', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).startsWith(PRIMARY_BASE)) return upstreamResponse(404)
      // The release asset serves octet-stream; the route still declares mp4.
      return upstreamResponse(200, { 'content-type': 'application/octet-stream' }, 'fallback')
    })

    const res = await callRoute(STYLE_KEY)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('video/mp4')
    expect(calledUrls(fetchMock)).toEqual([PRIMARY_URL, FALLBACK_URL])
  })

  it('returns 404 (not 502) when both origins miss', async () => {
    fetchMock.mockImplementation(async () => upstreamResponse(404))

    const res = await callRoute(STYLE_KEY)

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Upstream returned 404' })
    expect(calledUrls(fetchMock)).toEqual([PRIMARY_URL, FALLBACK_URL])
  })

  it('returns 416 and preserves the upstream Content-Range for an unsatisfiable range', async () => {
    // 416 is retryable, so the fallback is tried and also refuses the range.
    fetchMock.mockImplementation(async () =>
      upstreamResponse(416, { 'content-range': 'bytes */4096' })
    )

    const res = await callRoute(STYLE_KEY, { headers: { range: 'bytes=9999-10000' } })

    expect(res.status).toBe(416)
    expect(res.headers.get('content-range')).toBe('bytes */4096')
    expect(await res.json()).toEqual({ error: 'Upstream returned 416' })
    expect(calledUrls(fetchMock)).toEqual([PRIMARY_URL, FALLBACK_URL])
  })

  it('returns 502 when both origins throw a network error', async () => {
    fetchMock.mockImplementation(async () => {
      throw new Error('network unreachable')
    })

    const res = await callRoute(STYLE_KEY)

    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'network unreachable' })
    expect(calledUrls(fetchMock)).toEqual([PRIMARY_URL, FALLBACK_URL])
  })

  it.each(['Not A Key', '../etc/passwd', 'UPPER'])(
    'rejects the invalid key %s without contacting any upstream',
    async (styleKey) => {
      const res = await callRoute(styleKey)

      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'Invalid media key' })
      expect(vi.mocked(global.fetch)).not.toHaveBeenCalled()
    }
  )

  it('aborts a redirect to a disallowed host without requesting it', async () => {
    fetchMock.mockImplementation(async () =>
      upstreamResponse(302, { location: 'https://evil.example.com/x.mp4' }, 'redirecting')
    )

    const res = await callRoute(STYLE_KEY)

    const urls = calledUrls(fetchMock)
    expect(urls.some((url) => url.includes('evil.example.com'))).toBe(false)
    expect(urls).toEqual([PRIMARY_URL, FALLBACK_URL])
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toContain('left the allowed hosts')
  })

  it('forwards the incoming Range header to the upstream', async () => {
    fetchMock.mockImplementation(async () =>
      upstreamResponse(
        206,
        { 'accept-ranges': 'bytes', 'content-range': 'bytes 0-1023/4096' },
        'mp4-bytes'
      )
    )

    const res = await callRoute(STYLE_KEY, { headers: { range: 'bytes=0-1023' } })

    expect(res.status).toBe(206)
    expect(calledHeaders(fetchMock)[0].range).toBe('bytes=0-1023')
  })
})
