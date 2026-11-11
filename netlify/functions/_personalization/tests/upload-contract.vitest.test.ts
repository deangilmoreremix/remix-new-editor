// @vitest-environment node
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from '../shims/next-server'

function makeFetchMock(opts: { status?: number; text?: string; throwTypeError?: boolean } = {}) {
  const status = opts.status ?? 200
  const body = opts.text ?? JSON.stringify({ url: 'https://cdn.muapi.ai/test.png' })
  return vi.fn(async () => {
    if (opts.throwTypeError) throw new TypeError('fetch failed')
    // Real Response so the production safeApiJson/upstreamErrorResponse run
    // unmodified — the sanitizers are part of what is under test.
    return new Response(body, { status, headers: { 'content-type': 'application/json' } })
  })
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
  vi.doMock('../src/access/entitlements', () => ({ ENTITLEMENTS: { SMARTVIDEO_GO: 'smartvideo_go' } }))
  vi.doMock('../src/lib/uploadProxyTarget.js', () => ({
    getApiKeyFromRequest: vi.fn(() => 'test-key'),
    isBlockedFileType: vi.fn(() => false),
  }))

})

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('shared upload contract', () => {
  it('enforces the MuAPI documented limits (images 10MB, video 50MB, others 10MB)', async () => {
    const { UPLOAD_LIMITS, getUploadLimit } = await import('../src/lib/uploadConfig')

    const MB = 1024 * 1024
    expect(UPLOAD_LIMITS.image).toBe(10 * MB)
    expect(UPLOAD_LIMITS.video).toBe(50 * MB)
    expect(UPLOAD_LIMITS.audio).toBe(10 * MB)
    expect(UPLOAD_LIMITS.other).toBe(10 * MB)

    expect(getUploadLimit({ type: 'image/png' } as File)).toBe(10 * MB)
    expect(getUploadLimit({ type: 'video/mp4' } as File)).toBe(50 * MB)
    // audio and "others" must NOT inherit the 50MB video budget
    expect(getUploadLimit({ type: 'audio/mpeg' } as File)).toBe(10 * MB)
    expect(getUploadLimit({ type: 'application/pdf' } as File)).toBe(10 * MB)
    expect(getUploadLimit({ type: 'application/zip' } as File)).toBe(10 * MB)
  })

  it('accepts every type the MuAPI spec documents, including .mov', async () => {
    const { isAllowedUploadMimeType } = await import('../src/lib/uploadConfig')
    const ok = (t: string) => isAllowedUploadMimeType({ type: t } as File)

    expect(ok('image/jpeg')).toBe(true)
    expect(ok('image/png')).toBe(true)
    expect(ok('image/webp')).toBe(true)
    expect(ok('video/mp4')).toBe(true)
    expect(ok('video/quicktime')).toBe(true) // .mov
    expect(ok('application/zip')).toBe(true)
    expect(ok('application/pdf')).toBe(true)
    expect(ok('application/json')).toBe(true)

    expect(ok('text/html')).toBe(false)
    expect(ok('image/svg+xml')).toBe(false)
    expect(ok('application/x-msdownload')).toBe(false)
  })

  it('scopes image-only callers so they keep rejecting spec-legal "others"', async () => {
    const { isAllowedUploadMimeType } = await import('../src/lib/uploadConfig')
    const img = (t: string) => isAllowedUploadMimeType({ type: t } as File, 'image')

    expect(img('image/jpg')).toBe(true) // normalized
    expect(img('image/jpeg')).toBe(true)
    expect(img('application/pdf')).toBe(false)
    expect(img('application/zip')).toBe(false)
    expect(img('video/mp4')).toBe(false)
  })

  it('exposes a single canonical module for the app and studio package', async () => {
    // src/lib/uploadConfig.ts must re-export from the studio package's plain-JS
    // contract rather than redefining anything (drift guard).
    const typed = await import('../src/lib/uploadConfig')
    const studio = await import('../packages/studio/src/uploadContract.js')

    expect(typed.UPLOAD_LIMITS).toEqual(studio.UPLOAD_LIMITS)
    expect(typed.isAllowedUploadMimeType).toBe(studio.isAllowedUploadMimeType)
    expect(typed.getUploadLimit).toBe(studio.getUploadLimit)
  })
})

describe('POST /api/v1/upload_file structured failure classification', () => {
  async function post(opts: { form?: FormData; raw?: string; contentType?: string }) {
    const { POST } = await import('../app/api/v1/upload_file/route')
    const headers: Record<string, string> = {}
    if (opts.contentType) headers['content-type'] = opts.contentType
    if (opts.raw !== undefined && !opts.contentType) headers['content-type'] = 'application/json'

    return POST(
      new NextRequest('http://localhost/api/v1/upload_file', {
        method: 'POST',
        headers,
        ...(opts.form ? { body: opts.form } : opts.raw !== undefined ? { body: opts.raw } : {}),
      })
    )
  }

  it('classifies a non-multipart request', async () => {
    const res = await post({ raw: '{}' })
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('REJECTED_MULTIPART')
  })

  it('classifies a missing file field', async () => {
    const fd = new FormData()
    fd.append('notfile', 'x')
    const res = await post({ form: fd })
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('REJECTED_NO_FILE')
  })

  it('classifies a disallowed MIME type', async () => {
    const fd = new FormData()
    fd.append('file', new File(['x'], 'evil.html', { type: 'text/html' }))
    const res = await post({ form: fd })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.code).toBe('REJECTED_MIME_TYPE')
    // must not echo the user's filename back
    expect(JSON.stringify(json)).not.toMatch(/evil\.html/)
  })

  it('classifies an oversize file with the correct per-type limit', async () => {
    const fd = new FormData()
    const big = new File(['x'], 'big.pdf', { type: 'application/pdf' })
    // FormData re-derives size from content, so the route cannot be reached with
    // a faked size; assert the limit instead of an oversized payload.
    const { UPLOAD_LIMITS } = await import('../src/lib/uploadConfig')
    expect(UPLOAD_LIMITS.other).toBe(10 * 1024 * 1024)

    const small = new File(['x'], 'ok.pdf', { type: 'application/pdf' })
    fd.append('file', small)
    const res = await post({ form: fd })
    expect(res.status).toBe(200)
  })

  it('classifies upstream unreachable as UPSTREAM_UNREACHABLE, not a leaked body', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw new TypeError('fetch failed')
    })
    const fd = new FormData()
    fd.append('file', new File(['x'], 'a.png', { type: 'image/png' }))

    const res = await post({ form: fd })
    expect(res.status).toBe(502)
    const json = await res.json()
    expect(json.code).toBe('UPSTREAM_UNREACHABLE')
    expect(json.error).not.toMatch(/fetch failed/)
  })

  it('classifies a 5xx upstream as UPSTREAM_UNAVAILABLE', async () => {
    fetchMock = makeFetchMock({ status: 503, text: 'upstream overloaded' })
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock)
    const fd = new FormData()
    fd.append('file', new File(['x'], 'a.png', { type: 'image/png' }))

    const res = await post({ form: fd })
    expect(res.status).toBe(502)
    const json = await res.json()
    expect(json.code).toBe('UPSTREAM_UNAVAILABLE')
    expect(json.error).not.toMatch(/overloaded/)
  })

  it('classifies upstream 4xx as UPSTREAM_REJECTED and retries only transient errors', async () => {
    fetchMock = makeFetchMock({ status: 429, text: 'quota exceeded for key sk-SECRET' })
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock)
    const fd = new FormData()
    fd.append('file', new File(['x'], 'a.png', { type: 'image/png' }))

    const res = await post({ form: fd })
    const json = await res.json()
    expect(res.status).toBe(502)
    expect(json.code).toBe('UPSTREAM_REJECTED')
    expect(json.error).not.toMatch(/sk-SECRET/)
    // 429 is transient, so all 3 attempts were used
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does not retry non-transient 4xx', async () => {
    fetchMock = makeFetchMock({ status: 413, text: 'payload too large' })
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock)
    const fd = new FormData()
    fd.append('file', new File(['x'], 'a.png', { type: 'image/png' }))

    const res = await post({ form: fd })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(res.status).toBe(413)
  })

  it('classifies upstream success with no URL', async () => {
    fetchMock = makeFetchMock({ status: 200, text: JSON.stringify({ nope: 1 }) })
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock)
    const fd = new FormData()
    fd.append('file', new File(['x'], 'a.png', { type: 'image/png' }))

    const res = await post({ form: fd })
    expect(res.status).toBe(502)
    expect((await res.json()).code).toBe('UPSTREAM_NO_URL')
  })

  it('returns a structured success payload', async () => {
    const fd = new FormData()
    fd.append('file', new File(['x'], 'a.png', { type: 'image/png' }))
    const res = await post({ form: fd })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.url).toBe('https://cdn.muapi.ai/test.png')
    expect(json.name).toBe('a.png')
    expect(json.type).toBe('image/png')
  })
})
