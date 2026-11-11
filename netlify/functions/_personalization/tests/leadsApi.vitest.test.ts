// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from '../shims/next-server'

let authUserId: string | null = 'user-123'

const supabaseMockState = {
  listData: [] as Record<string, unknown>[],
  leadRow: { id: 'lead-uuid-1', clerk_user_id: 'user-123', business_id: 'osm-node-123', stage: 'New', starred: false, notes: null, niche: 'barbershops', location: 'Austin', business: {}, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  upsertError: null as { code: string; message: string } | null,
  deleteResult: true as boolean,
  deleteError: null as { code: string; message: string } | null,
  listError: null as { code: string; message: string } | null,
}

const rpcCalls: Array<{ fn: string; args: Record<string, unknown> | undefined }> = []

function createRpcMock() {
  return vi.fn(async (fnName: string, args?: Record<string, unknown>) => {
    rpcCalls.push({ fn: fnName, args })
    switch (fnName) {
      case 'lead_finder_leads_list':
        return { data: supabaseMockState.listData || [], error: supabaseMockState.listError }
      case 'lead_finder_leads_upsert':
        if (supabaseMockState.upsertError) {
          return { data: null, error: supabaseMockState.upsertError }
        }
        return { data: supabaseMockState.leadRow, error: null }
      case 'lead_finder_leads_delete':
        if (supabaseMockState.deleteError) {
          return { data: null, error: supabaseMockState.deleteError }
        }
        return { data: supabaseMockState.deleteResult, error: null }
      default:
        return { data: null, error: null }
    }
  })
}

let rpcMock: ReturnType<typeof createRpcMock>

beforeEach(() => {
  vi.resetModules()
  authUserId = 'user-123'
  rpcCalls.length = 0

  supabaseMockState.listData = []
  supabaseMockState.leadRow = { id: 'lead-uuid-1', clerk_user_id: 'user-123', business_id: 'osm-node-123', stage: 'New', starred: false, notes: null, niche: 'barbershops', location: 'Austin', business: {}, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }
  supabaseMockState.upsertError = null
  supabaseMockState.deleteResult = true
  supabaseMockState.deleteError = null
  supabaseMockState.listError = null

  rpcMock = createRpcMock()

  vi.doMock('../shims/clerk-server', () => ({
    auth: vi.fn(async () => ({ userId: authUserId })),
  }))

  vi.doMock('../src/lib/supabase', () => ({
    createServerClient: vi.fn(() => ({
      rpc: rpcMock,
      from: vi.fn(),
    })),
  }))

  vi.doMock('../src/server/personalizationLog', () => ({
    logPersonalization: vi.fn(),
    createCorrelationId: vi.fn(() => 'corr-123'),
    sanitizeForLog: vi.fn((v: unknown) => v),
  }))

  vi.doMock('../src/server/envValidation', () => ({
    requirePersonalizationEnv: vi.fn(() => ({ valid: true, missingRequired: [] })),
  }))

  // The vitest alias resolves @/lib/* to src/lib/*, where rateLimit does not
  // live; re-export the real root module so route imports keep working.
  vi.doMock('../lib/rateLimit', async () => await import('../lib/rateLimit'))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

function createRequest(overrides: Record<string, unknown> = {}): NextRequest {
  const url = new URL(overrides.url || 'http://localhost/api/personalization/leads', 'http://localhost')

  return new NextRequest(url.toString(), {
    method: (overrides.method as string) || 'GET',
    body: overrides.body !== undefined ? JSON.stringify(overrides.body) : undefined,
    headers: {
      'content-type': 'application/json',
    },
  })
}

function createIdRequest(id: string, overrides: Record<string, unknown> = {}) {
  const req = createRequest({ ...overrides, url: `http://localhost/api/personalization/leads/${id}` })
  return [req, { params: Promise.resolve({ id }) }] as const
}

const sampleBusiness = {
  id: 'osm-node-123',
  source: 'OPENSTREETMAP',
  name: 'Fades & Co',
  category: 'Barbershop',
  city: 'Austin',
  leadScore: 82,
}

describe('GET /api/personalization/leads', () => {
  it('returns 401 when unauthenticated', async () => {
    authUserId = null
    const { GET } = await import('../app/api/personalization/leads/route')

    const response = await GET(createRequest())
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('UNAUTHENTICATED')
  })

  it('lists leads for the authenticated user', async () => {
    supabaseMockState.listData = [
      { id: 'lead-uuid-1', business_id: 'osm-node-123', stage: 'New', starred: false },
      { id: 'lead-uuid-2', business_id: 'osm-way-9', stage: 'Qualified', starred: true },
    ]

    const { GET } = await import('../app/api/personalization/leads/route')
    const response = await GET(createRequest())
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.ok).toBe(true)
    expect(data.leads.length).toBe(2)

    expect(rpcCalls[0].fn).toBe('lead_finder_leads_list')
    expect(rpcCalls[0].args?.p_clerk_user_id).toBe('user-123')
  })

  it('maps a database failure to 502 with the correlation id', async () => {
    supabaseMockState.listError = { code: 'XX000', message: 'rpc exploded' }

    const { GET } = await import('../app/api/personalization/leads/route')
    const response = await GET(createRequest())
    expect(response.status).toBe(502)
    const data = await response.json()
    expect(data.correlationId).toBe('corr-123')
  })
})

describe('POST /api/personalization/leads', () => {
  it('returns 401 when unauthenticated', async () => {
    authUserId = null
    const { POST } = await import('../app/api/personalization/leads/route')

    const response = await POST(createRequest({ method: 'POST', body: { business: sampleBusiness } }))
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('UNAUTHENTICATED')
  })

  it('rejects a missing or invalid business object with 400', async () => {
    const { POST } = await import('../app/api/personalization/leads/route')

    const response = await POST(createRequest({ method: 'POST', body: { business: { name: 'no id' } } }))
    expect(response.status).toBe(400)

    const response2 = await POST(createRequest({ method: 'POST', body: {} }))
    expect(response2.status).toBe(400)
  })

  it('rejects an unknown stage with 400', async () => {
    const { POST } = await import('../app/api/personalization/leads/route')

    const response = await POST(createRequest({
      method: 'POST',
      body: { business: sampleBusiness, stage: 'Gone' },
    }))
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Invalid stage')
  })

  it('upserts by business_id and takes the owner from auth(), not the body', async () => {
    const { POST } = await import('../app/api/personalization/leads/route')

    // A hostile body cannot redirect the write to another user's bucket: the
    // route must pass the auth() identity, and body clerk fields must be inert.
    const response = await POST(createRequest({
      method: 'POST',
      body: {
        business: sampleBusiness,
        stage: 'Qualified',
        notes: 'Great candidate',
        starred: true,
        niche: 'barbershops',
        location: 'Austin',
        clerkUserId: 'attacker-user',
        p_clerk_user_id: 'attacker-user',
      },
    }))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.ok).toBe(true)
    expect(data.lead.id).toBe('lead-uuid-1')

    expect(rpcCalls[0].fn).toBe('lead_finder_leads_upsert')
    expect(rpcCalls[0].args).toMatchObject({
      p_id: null,
      p_clerk_user_id: 'user-123',
      p_business_id: 'osm-node-123',
      p_business: sampleBusiness,
      p_stage: 'Qualified',
      p_notes: 'Great candidate',
      p_starred: true,
      p_niche: 'barbershops',
      p_location: 'Austin',
    })
  })
})

describe('PATCH /api/personalization/leads/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    authUserId = null
    const { PATCH } = await import('../app/api/personalization/leads/[id]/route')

    const [req, ctx] = createIdRequest('11111111-1111-1111-1111-111111111111', {
      method: 'PATCH',
      body: { stage: 'Qualified' },
    })
    const response = await PATCH(req, ctx)
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('UNAUTHENTICATED')
  })

  it('maps stage/notes/starred onto the upsert RPC without touching the snapshot', async () => {
    const { PATCH } = await import('../app/api/personalization/leads/[id]/route')

    const id = '22222222-2222-2222-2222-222222222222'
    const [req, ctx] = createIdRequest(id, {
      method: 'PATCH',
      body: { stage: 'Shortlisted', notes: 'Called once', starred: true },
    })
    const response = await PATCH(req, ctx)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.ok).toBe(true)
    expect(data.lead.id).toBe('lead-uuid-1')

    expect(rpcCalls[0].fn).toBe('lead_finder_leads_upsert')
    expect(rpcCalls[0].args).toMatchObject({
      p_id: id,
      p_clerk_user_id: 'user-123',
      p_business_id: null,
      p_business: null,
      p_stage: 'Shortlisted',
      p_notes: 'Called once',
      p_starred: true,
    })
  })

  it('rejects an unknown stage with 400', async () => {
    const { PATCH } = await import('../app/api/personalization/leads/[id]/route')

    const [req, ctx] = createIdRequest('22222222-2222-2222-2222-222222222222', {
      method: 'PATCH',
      body: { stage: 'Dead' },
    })
    const response = await PATCH(req, ctx)
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Invalid stage')
  })

  it('returns 404 when the RPC reports the lead is owned by someone else', async () => {
    supabaseMockState.upsertError = { code: '42501', message: 'lead not owned by caller' }

    const { PATCH } = await import('../app/api/personalization/leads/[id]/route')

    const [req, ctx] = createIdRequest('22222222-2222-2222-2222-222222222222', {
      method: 'PATCH',
      body: { stage: 'Qualified' },
    })
    const response = await PATCH(req, ctx)
    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe('Lead not found')
  })
})

describe('DELETE /api/personalization/leads/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    authUserId = null
    const { DELETE } = await import('../app/api/personalization/leads/[id]/route')

    const [req, ctx] = createIdRequest('11111111-1111-1111-1111-111111111111', { method: 'DELETE' })
    const response = await DELETE(req, ctx)
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('UNAUTHENTICATED')
  })

  it('deletes the lead and reports ok', async () => {
    const { DELETE } = await import('../app/api/personalization/leads/[id]/route')

    const id = '33333333-3333-3333-3333-333333333333'
    const [req, ctx] = createIdRequest(id, { method: 'DELETE' })
    const response = await DELETE(req, ctx)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.ok).toBe(true)
    expect(data.deleted).toBe(true)

    expect(rpcCalls[0].fn).toBe('lead_finder_leads_delete')
    expect(rpcCalls[0].args).toMatchObject({ p_id: id, p_clerk_user_id: 'user-123' })
  })

  it('returns 404 when nothing was deleted for this owner', async () => {
    supabaseMockState.deleteResult = false

    const { DELETE } = await import('../app/api/personalization/leads/[id]/route')

    const [req, ctx] = createIdRequest('33333333-3333-3333-3333-333333333333', { method: 'DELETE' })
    const response = await DELETE(req, ctx)
    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe('Lead not found')
  })
})
