// @vitest-environment node
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from '../shims/next-server'

const MUAPI_UPLOAD_URL = 'https://api.muapi.ai/api/v1/upload_file'

function makeFetchMock() {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    async json() {
      return { url: 'https://cdn.muapi.ai/test.mp4' }
    },
    async text() {
      return JSON.stringify({ url: 'https://cdn.muapi.ai/test.mp4' })
    },
  }))
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.resetModules()
  fetchMock = makeFetchMock()
  vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock)

  vi.doMock('../src/access/apiRequireEntitlement', () => ({
    requireApiEntitlement: vi.fn(async () => ({ allowed: true })),
    entitlementForbiddenResponse: vi.fn(() => new Response(JSON.stringify({ error: 'PAYMENT_REQUIRED' }), { status: 403 })),
  }))

  vi.doMock('../src/access/entitlements', () => ({
    ENTITLEMENTS: { SMARTVIDEO_GO: 'smartvideo_go' },
  }))

  vi.doMock('../src/lib/uploadProxyTarget.js', () => ({
    getApiKeyFromRequest: vi.fn(() => 'test-api-key'),
    isBlockedFileType: vi.fn(() => false),
  }))

  vi.doMock('../src/lib/safeApiResponse', () => ({
    safeApiJson: vi.fn(async (res: Response) => {
      const text = await res.text()
      if (!text) return {}
      try { return JSON.parse(text) } catch { return { message: text } }
    }),
  }))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('POST /api/v1/upload_file', () => {
  it('returns 401 when x-api-key is missing', async () => {
    vi.doMock('../src/lib/uploadProxyTarget.js', () => ({
      getApiKeyFromRequest: vi.fn(() => null),
      isBlockedFileType: vi.fn(() => false),
    }))

    const { POST } = await import('../app/api/v1/upload_file/route')

    const formData = new FormData()
    formData.append('file', new File(['test'], 'test.jpg', { type: 'image/jpeg' }))

    const res = await POST(
      new NextRequest('http://localhost/api/v1/upload_file', {
        method: 'POST',
        body: formData,
      })
    )

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toMatch(/Unauthorized/i)
  })

  it('returns 200 when entitlement is missing but auth and API key are valid', async () => {
    vi.doMock('../src/access/apiRequireEntitlement', () => ({
      requireApiEntitlement: vi.fn(async () => ({ allowed: false, status: 403, entitlement: 'smartvideo_go' })),
      entitlementForbiddenResponse: vi.fn(() => new Response(JSON.stringify({ error: 'PAYMENT_REQUIRED' }), { status: 403 })),
    }))

    const { POST } = await import('../app/api/v1/upload_file/route')

    const formData = new FormData()
    formData.append('file', new File(['test'], 'test.jpg', { type: 'image/jpeg' }))

    const res = await POST(
      new NextRequest('http://localhost/api/v1/upload_file', {
        method: 'POST',
        body: formData,
      })
    )

    // Upload no longer requires SMARTVIDEO_GO entitlement — demo uploads are
    // permitted for any authenticated user with a valid API key.
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.url).toBe('https://cdn.muapi.ai/test.mp4')
  })

  it('returns 400 for non-multipart content type', async () => {
    const { POST } = await import('../app/api/v1/upload_file/route')

    const res = await POST(
      new NextRequest('http://localhost/api/v1/upload_file', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ file: 'test' }),
      })
    )

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/multipart/i)
  })

  it('returns 400 for disallowed MIME type', async () => {
    const { POST } = await import('../app/api/v1/upload_file/route')

    const formData = new FormData()
    formData.append('file', new File(['test'], 'test.exe', { type: 'application/x-msdownload' }))

    const res = await POST(
      new NextRequest('http://localhost/api/v1/upload_file', {
        method: 'POST',
        body: formData,
      })
    )

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/Invalid file type/i)
  })

  it('returns 400 for oversize image file', async () => {
    const { POST } = await import('../app/api/v1/upload_file/route')

    const largeContent = new Uint8Array(11 * 1024 * 1024)
    const formData = new FormData()
    formData.append('file', new File([largeContent], 'large.jpg', { type: 'image/jpeg' }))

    const res = await POST(
      new NextRequest('http://localhost/api/v1/upload_file', {
        method: 'POST',
        body: formData,
      })
    )

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/File too large/i)
  })

  it('returns 400 for oversize video file', async () => {
    const { POST } = await import('../app/api/v1/upload_file/route')

    const largeContent = new Uint8Array(51 * 1024 * 1024)
    const formData = new FormData()
    formData.append('file', new File([largeContent], 'large.mp4', { type: 'video/mp4' }))

    const res = await POST(
      new NextRequest('http://localhost/api/v1/upload_file', {
        method: 'POST',
        body: formData,
      })
    )

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/File too large/i)
  })

  it('returns 502 when MuAPI returns no URL', async () => {
    fetchMock.mockImplementationOnce(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      async json() {
        return { status: 'ok' }
      },
      async text() {
        return JSON.stringify({ status: 'ok' })
      },
    }))

    const { POST } = await import('../app/api/v1/upload_file/route')

    const formData = new FormData()
    formData.append('file', new File(['test'], 'test.jpg', { type: 'image/jpeg' }))

    const res = await POST(
      new NextRequest('http://localhost/api/v1/upload_file', {
        method: 'POST',
        body: formData,
      })
    )

    expect(res.status).toBe(502)
    const json = await res.json()
    expect(json.error).toMatch(/No URL returned/i)
  })

  it('uses AbortSignal.timeout when forwarding upload to MuAPI', async () => {
    const { POST } = await import('../app/api/v1/upload_file/route')

    const formData = new FormData()
    formData.append('file', new File(['test'], 'test.jpg', { type: 'image/jpeg' }))

    const req = new NextRequest('http://localhost/api/v1/upload_file', {
      method: 'POST',
      body: formData,
    })

    await POST(req)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const calledFetch = fetchMock.mock.calls[0]
    expect(calledFetch[0]).toBe(MUAPI_UPLOAD_URL)
    expect(calledFetch[1]).toBeDefined()
    expect(calledFetch[1].signal).toBeInstanceOf(AbortSignal)
  })

  it('never echoes the raw upstream error body back to the client', async () => {
    // Regression guard: the retry layer embeds the upstream response text inside
    // the thrown Error message. The catch block used to return that message
    // verbatim, leaking upstream detail (and any identifiers it contained).
    fetchMock.mockImplementation(async () => ({
      ok: false,
      status: 429,
      headers: new Headers({ 'content-type': 'application/json' }),
      async json() { return {} },
      async text() { return 'quota exceeded for upstream-key sk-SECRET-12345' },
    }))

    const { POST } = await import('../app/api/v1/upload_file/route')

    const formData = new FormData()
    formData.append('file', new File(['test'], 'test.jpg', { type: 'image/jpeg' }))

    const res = await POST(
      new NextRequest('http://localhost/api/v1/upload_file', {
        method: 'POST',
        body: formData,
      })
    )

    expect(res.status).toBe(502)
    const body = await res.text()
    expect(body).not.toMatch(/sk-SECRET-12345/)
    expect(body).not.toMatch(/quota exceeded/)
    expect(body).toMatch(/MuAPI upload failed/i)
  })

  // ── MuAPI spec conformance ────────────────────────────────────────────────  // https://muapi.ai/docs/file-upload documents Videos as ".mp4, .mov" and an
  // "Others" category of ".zip, .pdf, .json" at 10MB. Both were previously
  // rejected by our allowlist, which would have returned a spurious 400 for
  // formats MuAPI explicitly supports.

  it.each([
    ['video/quicktime', 'clip.mov', 48 * 1024 * 1024],
    ['application/zip', 'bundle.zip', 5 * 1024 * 1024],
    ['application/pdf', 'brief.pdf', 5 * 1024 * 1024],
    ['application/json', 'payload.json', 5 * 1024 * 1024],
  ])('accepts spec-supported %s (%s)', async (mimeType, filename, declaredSize) => {
    const { POST } = await import('../app/api/v1/upload_file/route')

    const file = new File(['x'], filename, { type: mimeType })
    // Avoid allocating large buffers just to satisfy a size check.
    Object.defineProperty(file, 'size', { value: declaredSize })

    const formData = new FormData()
    formData.append('file', file)

    const res = await POST(
      new NextRequest('http://localhost/api/v1/upload_file', {
        method: 'POST',
        body: formData,
      })
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.url).toBe('https://cdn.muapi.ai/test.mp4')
  })

  it('allows a .mov video up to 50MB like other video formats', async () => {
    const { POST } = await import('../app/api/v1/upload_file/route')

    const formData = new FormData()
    const file = new File(['x'], 'clip.mov', { type: 'video/quicktime' })
    Object.defineProperty(file, 'size', { value: 50 * 1024 * 1024 })
    formData.append('file', file)

    const res = await POST(
      new NextRequest('http://localhost/api/v1/upload_file', {
        method: 'POST',
        body: formData,
      })
    )

    expect(res.status).toBe(200)
  })

  it('treats the "others" category with the 10MB limit, not the 50MB video limit', async () => {
    // Asserted on the shared config directly: a FormData round-trip re-derives
    // `size` from real content, so the route-level size check cannot be faked
    // cheaply. This lock is what keeps .zip/.pdf/.json from inheriting the
    // 50MB video budget.
    const { getUploadLimit, isAllowedUploadMimeType } = await import('../src/lib/uploadConfig')

    const mk = (type: string) => new File(['x'], 'f', { type })

    expect(getUploadLimit(mk('application/pdf'))).toBe(10 * 1024 * 1024)
    expect(getUploadLimit(mk('application/zip'))).toBe(10 * 1024 * 1024)
    expect(getUploadLimit(mk('application/json'))).toBe(10 * 1024 * 1024)
    expect(getUploadLimit(mk('video/quicktime'))).toBe(50 * 1024 * 1024)

    expect(isAllowedUploadMimeType(mk('video/quicktime'))).toBe(true)
    expect(isAllowedUploadMimeType(mk('application/pdf'))).toBe(true)
    expect(isAllowedUploadMimeType(mk('application/zip'))).toBe(true)
    expect(isAllowedUploadMimeType(mk('application/json'))).toBe(true)
    // Still rejects genuinely dangerous types.
    expect(isAllowedUploadMimeType(mk('text/html'))).toBe(false)
    expect(isAllowedUploadMimeType(mk('application/x-msdownload'))).toBe(false)

    // Category scoping: an image-only caller (MuAPIImageClient.uploadImage,
    // VfxClient.uploadImage) must keep rejecting types that the spec allows
    // elsewhere, otherwise its own contract ("JPG, PNG or WebP") breaks.
    expect(isAllowedUploadMimeType(mk('application/pdf'), 'image')).toBe(false)
    expect(isAllowedUploadMimeType(mk('application/zip'), 'image')).toBe(false)
    expect(isAllowedUploadMimeType(mk('image/jpg'), 'image')).toBe(true)
    expect(isAllowedUploadMimeType(mk('image/png'), 'image')).toBe(true)
  })
})
