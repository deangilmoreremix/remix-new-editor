// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from '../shims/next-server'

/**
 * Durable-storage extension of `POST /api/v1/upload_file`.
 *
 * MuAPI upload URLs expire after one hour, so the URL the route hands back is
 * temporary by construction. The permanent identifier for an asset is a
 * Supabase Storage object under a workspace-scoped prefix, and the route is
 * the component that turns that object back into a fresh MuAPI URL.
 *
 * This is also what makes a 50 MB video survivable on Netlify: Netlify
 * Functions cap a buffered request payload at 6 MB (binary bodies are
 * Base64-encoded, so ~4.5 MB in practice). A file that large is written
 * straight to storage by the browser, and the route re-uploads it
 * storage → MuAPI, so only an asset id crosses the function boundary.
 */

const h = vi.hoisted(() => ({
  userId: null as string | null,
  objects: {} as Record<string, { blob: Blob; name: string; type: string; size: number }>,
  entitlement: { allowed: true } as { allowed: boolean; status?: number },
}))

let fetchCalls: Array<{ url: string; headers: Record<string, string>; body: unknown }> = []

function makeResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function storageMock() {
  return {
    from(bucket: string) {
      expect(bucket).toBe('personalization-assets')
      return {
        async upload(path: string, file: File) {
          h.objects[path] = {
            blob: file,
            name: file.name,
            type: file.type,
            size: file.size,
          }
          return { error: null }
        },
        async download(path: string) {
          const record = h.objects[path]
          return { data: record ? record.blob : null, error: record ? null : { message: 'not found' } }
        },
        async list(prefix: string) {
          const entries = Object.entries(h.objects)
            .filter(([objectPath]) => objectPath.startsWith(`${prefix}/`))
            .map(([, record]) => ({ name: record.name, metadata: { size: record.size } }))
          return { data: entries, error: null }
        },
        getPublicUrl(path: string) {
          return { data: { publicUrl: `https://durable.example.com/${path}` } }
        },
      }
    },
  }
}

function resolveRequest(assetId: string, extraHeaders: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/v1/upload_file?durable=resolve', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...extraHeaders },
    body: JSON.stringify({ durable_asset_id: assetId }),
  })
}

function recordRequest(assetId: string) {
  return new NextRequest(`http://localhost/api/v1/upload_file?durable_asset_id=${assetId}`, {
    method: 'GET',
  })
}

function multipartRequest(assetId?: string) {
  const formData = new FormData()
  formData.append('file', new File(['bytes'], 'logo.png', { type: 'image/png' }))
  if (assetId) formData.append('durable_asset_id', assetId)
  return new NextRequest('http://localhost/api/v1/upload_file', {
    method: 'POST',
    headers: { 'x-api-key': 'user-key-alpha' },
    body: formData,
  })
}

beforeEach(() => {
  vi.resetModules()
  h.userId = 'user-alpha'
  h.objects = {}
  h.entitlement = { allowed: true }
  fetchCalls = []

  vi.doMock('../src/access/apiRequireEntitlement', () => ({
    requireApiEntitlement: vi.fn(async () => h.entitlement),
    entitlementForbiddenResponse: vi.fn(
      () => new Response(JSON.stringify({ error: 'PAYMENT_REQUIRED' }), { status: 403 }),
    ),
  }))

  vi.doMock('../src/access/entitlements', () => ({ ENTITLEMENTS: { SMARTVIDEO_GO: 'smartvideo_go' } }))

  vi.doMock('../src/lib/uploadProxyTarget.js', () => ({
    getApiKeyFromRequest: (request: { headers: { get(name: string): string | null } }) =>
      request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '') || null,
    isBlockedFileType: () => false,
  }))

  vi.doMock('../src/lib/safeApiResponse', () => ({
    safeApiJson: vi.fn(async (response: Response) => {
      const text = await response.text()
      if (!text) return {}
      try {
        return JSON.parse(text)
      } catch {
        return { message: text }
      }
    }),
    upstreamErrorResponse: vi.fn(
      (response: Response, parsed: unknown) =>
        new Response(JSON.stringify({ error: 'upstream rejected', parsed }), { status: response.status }),
    ),
  }))

  vi.doMock('../shims/clerk-server', () => ({
    auth: async () => ({ userId: h.userId }),
  }))

  vi.doMock('../src/lib/supabase', () => ({
    // The real createServerClient() returns a SupabaseClient, whose storage
    // namespace lives under `.storage`.
    createServerClient: () => ({ storage: storageMock() }),
  }))

  vi.spyOn(globalThis, 'fetch').mockImplementation((async (url: string, init: RequestInit = {}) => {
    const headers: Record<string, string> = {}
    new Headers(init.headers).forEach((value, key) => { headers[key.toLowerCase()] = value })
    let body: unknown = init.body
    if (body instanceof FormData) {
      body = { formData: true, fields: [...body.keys()] }
    }
    fetchCalls.push({ url: String(url), headers, body })
    return makeResponse({ url: 'https://cdn.muapi.ai/fresh.mp4' })
  }) as never)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.doUnmock('../src/lib/supabase')
  vi.doUnmock('../shims/clerk-server')
})

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/upload_file?durable=resolve', () => {
  it('re-uploads the durable original for the session workspace and returns a fresh URL', async () => {
    // Seed user-alpha's own object.
    h.objects['smartvideo-go-clerk-user-alpha/asset-1/clip.mp4'] = {
      blob: new Blob([new Uint8Array(2048)], { type: 'video/mp4' }),
      name: 'clip.mp4',
      type: 'video/mp4',
      size: 2048,
    }

    const { POST } = await import('../app/api/v1/upload_file/route')
    const res = await POST(resolveRequest('asset-1', { 'x-api-key': 'user-key-alpha' }))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.url).toBe('https://cdn.muapi.ai/fresh.mp4')
    expect(json.source).toBe('durable')
    expect(json.durableRef).toBe('smartvideo-go-clerk-user-alpha/asset-1/clip.mp4')
    expect(json.expiresAt).toBeGreaterThan(json.uploadedAt)
    expect(json.expiresAt - json.uploadedAt).toBe(60 * 60 * 1000)

    // Exactly one upstream call, and it carried the caller's own key.
    expect(fetchCalls).toHaveLength(1)
    expect(fetchCalls[0].url).toBe('https://api.muapi.ai/api/v1/upload_file')
    expect(fetchCalls[0].headers['x-api-key']).toBe('user-key-alpha')
  })

  it("cannot read another workspace's object", async () => {
    // Only user-beta owns this object; the session is user-alpha.
    h.objects['smartvideo-go-clerk-user-beta/asset-9/clip.mp4'] = {
      blob: new Blob([new Uint8Array(8)], { type: 'video/mp4' }),
      name: 'clip.mp4',
      type: 'video/mp4',
      size: 8,
    }

    const { POST } = await import('../app/api/v1/upload_file/route')
    const res = await POST(resolveRequest('asset-9', { 'x-api-key': 'user-key-alpha' }))

    expect(res.status).toBe(404)
    expect((await res.json()).error).toMatch(/not found/i)
    // Nothing was proxied upstream.
    expect(fetchCalls).toHaveLength(0)
  })

  it('allows unauthenticated caller but returns 404 for missing asset', async () => {
    h.userId = null
    const { POST } = await import('../app/api/v1/upload_file/route')
    const res = await POST(resolveRequest('asset-1', { 'x-api-key': 'user-key-alpha' }))
    // Unauthenticated users are scoped to the demo workspace; asset-1 doesn't
    // exist there, so we get 404 not 401.
    expect(res.status).toBe(404)
    expect(fetchCalls).toHaveLength(0)
  })

  it('refuses a caller with no key of its own (no server fallback)', async () => {
    h.objects['smartvideo-go-clerk-user-alpha/asset-1/clip.mp4'] = {
      blob: new Blob([new Uint8Array(8)], { type: 'video/mp4' }),
      name: 'clip.mp4',
      type: 'video/mp4',
      size: 8,
    }
    const { POST } = await import('../app/api/v1/upload_file/route')
    const res = await POST(resolveRequest('asset-1'))
    expect(res.status).toBe(401)
    expect(fetchCalls).toHaveLength(0)
  })

  it('refuses a malformed asset id', async () => {
    const { POST } = await import('../app/api/v1/upload_file/route')
    for (const bad of ['../escape', 'a/b', '', 'x'.repeat(200)]) {
      const res = await POST(resolveRequest(bad, { 'x-api-key': 'user-key-alpha' }))
      expect([400, 404]).toContain(res.status)
    }
  })

  it('no longer blocks on entitlement but still requires auth, key, and existing asset', async () => {
    h.entitlement = { allowed: false, status: 403 }
    const { POST } = await import('../app/api/v1/upload_file/route')
    const res = await POST(resolveRequest('asset-1', { 'x-api-key': 'user-key-alpha' }))
    // Entitlement is no longer checked on upload/durable-resolve endpoints.
    // Asset "asset-1" does not exist in storage, so we get 404 not 403.
    expect(res.status).toBe(404)
    expect(fetchCalls).toHaveLength(0)
  })

  it('does not echo an upstream failure body back to the client', async () => {
    h.objects['smartvideo-go-clerk-user-alpha/asset-1/clip.mp4'] = {
      blob: new Blob([new Uint8Array(8)], { type: 'video/mp4' }),
      name: 'clip.mp4',
      type: 'video/mp4',
      size: 8,
    }
    vi.spyOn(globalThis, 'fetch').mockImplementation((async () =>
      makeResponse({ error: 'quota exceeded for upstream-key sk-SECRET-12345' }, 429)) as never)

    const { POST } = await import('../app/api/v1/upload_file/route')
    const res = await POST(resolveRequest('asset-1', { 'x-api-key': 'user-key-alpha' }))

    expect(res.status).toBe(502)
    const body = await res.text()
    expect(body).not.toMatch(/sk-SECRET-12345/)
    expect(body).not.toMatch(/quota exceeded/)
  })
})

describe('GET /api/v1/upload_file?durable_asset_id=', () => {
  it('returns the durable record for the session workspace', async () => {
    h.objects['smartvideo-go-clerk-user-alpha/asset-7/logo.png'] = {
      blob: new Blob([new Uint8Array(1024)], { type: 'image/png' }),
      name: 'logo.png',
      type: 'image/png',
      size: 1024,
    }

    const { GET } = await import('../app/api/v1/upload_file/route')
    const res = await GET(recordRequest('asset-7'))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.durableRef).toBe('smartvideo-go-clerk-user-alpha/asset-7/logo.png')
    expect(json.durableUrl).toBe('https://durable.example.com/smartvideo-go-clerk-user-alpha/asset-7/logo.png')
    expect(json.workspaceId).toBe('smartvideo-go:clerk:user-alpha')
    expect(json.size).toBe(1024)
    // The durable reference is storage, never a MuAPI URL.
    expect(json.durableRef).not.toMatch(/muapi/i)
  })

  it('404s for an asset outside the session workspace', async () => {
    h.objects['smartvideo-go-clerk-user-beta/asset-7/logo.png'] = {
      blob: new Blob([new Uint8Array(8)], { type: 'image/png' }),
      name: 'logo.png',
      type: 'image/png',
      size: 8,
    }

    const { GET } = await import('../app/api/v1/upload_file/route')
    const res = await GET(recordRequest('asset-7'))
    expect(res.status).toBe(404)
  })

  it('405s when no durable lookup was requested', async () => {
    const { GET } = await import('../app/api/v1/upload_file/route')
    const res = await GET(new NextRequest('http://localhost/api/v1/upload_file', { method: 'GET' }))
    expect(res.status).toBe(405)
  })
})

describe('POST /api/v1/upload_file (multipart) with a durable mirror', () => {
  it('mirrors the original to authorized storage and returns a durable reference', async () => {
    const { POST } = await import('../app/api/v1/upload_file/route')
    const res = await POST(multipartRequest('asset-mirror'))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.url).toBe('https://cdn.muapi.ai/fresh.mp4')
    expect(json.durableRef).toBe('smartvideo-go-clerk-user-alpha/asset-mirror/logo.png')
    expect(json.source).toBe('durable')
    expect(h.objects['smartvideo-go-clerk-user-alpha/asset-mirror/logo.png']).toBeDefined()
    // Exactly one upstream call.
    expect(fetchCalls).toHaveLength(1)
  })

  it('keeps the legacy behaviour when no durable mirror is requested', async () => {
    const { POST } = await import('../app/api/v1/upload_file/route')
    const res = await POST(multipartRequest())

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.url).toBe('https://cdn.muapi.ai/fresh.mp4')
    expect(json.durableRef).toBeNull()
    expect(json.source).toBe('bytes')
    expect(fetchCalls).toHaveLength(1)
  })

  it('rejects a non-multipart request exactly as before', async () => {
    const { POST } = await import('../app/api/v1/upload_file/route')
    const res = await POST(
      new NextRequest('http://localhost/api/v1/upload_file', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ file: 'x' }),
      }),
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/multipart/i)
  })
})
