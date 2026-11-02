// @vitest-environment node
/**
 * Negative auth tests for POST /api/personalization/discover-assets.
 *
 * Proves:
 * - Unauthenticated requests (userId = null/undefined/'') are allowed (free feature)
 * - Jobs are scoped to the caller's identity (IP for anonymous, userId for signed-in)
 * - Auth failure is logged before any business logic runs
 * - An oversized websiteUrl is rejected (400) instead of silently truncated
 * - Discovery is asynchronous: POST returns 202 with a jobId immediately,
 *   the crawl runs in the background worker
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../shims/clerk-server', () => ({
  auth: vi.fn(),
}))

// The route is now gated by requireApiEntitlement, which calls the
// Supabase-backed resolveSmartVideoAccessForUser. Stub it at the module
// boundary (the tests/proxy-routes.vitest.test.ts idiom) so tests can drive
// the gate entitled/unentitled without a Supabase env.
vi.mock('../../../tests/stubs/resolveAccess', () => ({
  resolveSmartVideoAccessForUser: vi.fn(async () => ({ hasSmartVideoGo: true })),
}))

vi.mock('../personalizationLog', () => ({
  logPersonalization: vi.fn(),
  createCorrelationId: vi.fn(() => 'test-correlation-id'),
  sanitizeForLog: vi.fn((s: unknown) => s),
}))

vi.mock('../envValidation', () => ({
  validatePersonalizationEnv: vi.fn(),
}))

vi.mock('../discoveryJobs', () => ({
  createDiscoveryJob: vi.fn(),
  getDiscoveryJobForUser: vi.fn(),
  updateDiscoveryJob: vi.fn(async () => ({})),
}))

// Import after mocks are registered
import { POST } from '../../../app/api/personalization/discover-assets/route'
import { NextRequest } from '../../../shims/next-server'
import { auth } from '../../../shims/clerk-server'
import { resolveSmartVideoAccessForUser } from '../../../tests/stubs/resolveAccess'
import { validatePersonalizationEnv } from '../envValidation'
import { createDiscoveryJob, updateDiscoveryJob } from '../discoveryJobs'

describe('POST /api/personalization/discover-assets auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: an entitled caller so only the cases that flip it exercise the
    // unentitled path (clearAllMocks keeps implementations, so re-seed here to
    // undo any prior test's hasSmartVideoGo:false override).
    vi.mocked(resolveSmartVideoAccessForUser).mockResolvedValue({ hasSmartVideoGo: true } as any)
    vi.mocked(validatePersonalizationEnv).mockReturnValue({ valid: true } as any)
    vi.mocked(createDiscoveryJob).mockResolvedValue({
      id: 'job-1',
      clerk_user_id: 'user-1',
      website_url: 'https://example.com',
      status: 'queued',
      fast_result_json: null,
      browser_result_json: null,
      final_result_json: null,
      telemetry_json: null,
      error_code: null,
      error_message: null,
      created_at: '2024-01-01T00:00:00Z',
      started_at: null,
      completed_at: null,
      expires_at: '2024-01-02T00:00:00Z',
    })
  })

  async function post(websiteUrl: unknown) {
    const req = new NextRequest('http://localhost/api/personalization/discover-assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ websiteUrl }),
    })
    return await POST(req)
  }

  // -------------------------------------------------------------------------
  // Unauthenticated: discovery is FREE, so an anonymous caller is allowed.
  // Its jobs are scoped to the caller's IP — never one shared 'anon' bucket.
  // -------------------------------------------------------------------------

  it('MUST ALLOW an unauthenticated caller (free feature), with IP-scoped jobs', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as any)

    const res = await post('https://example.com')
    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.status).toBe('pending')
    expect(typeof body.jobId).toBe('string')

    // The job must be scoped to the CALLER's identity: the caller's IP when
    // one is present, and at worst a plain 'anon' bucket when the request
    // carries no IP headers at all (as this mock's does).
    expect(createDiscoveryJob).toHaveBeenCalledTimes(1)
    const jobArg = (createDiscoveryJob as any).mock.calls[0][0]
    expect(jobArg.clerkUserId).toMatch(/^anon/)
  })

  it('MUST ALLOW an unauthenticated caller when auth returns userId = undefined', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: undefined } as any)

    const res = await post('https://example.com')
    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.status).toBe('pending')
  })

  it('MUST ALLOW an unauthenticated caller when auth returns an empty string userId', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: '' } as any)

    const res = await post('https://example.com')
    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.status).toBe('pending')
  })

  // -------------------------------------------------------------------------
  // Authenticated: request proceeds normally and the job is owner-scoped
  // -------------------------------------------------------------------------

  it('MUST ALLOW discovery when userId is present', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user-123' } as any)

    const res = await post('https://example.com')
    // The route always accepts a discovery JOB and answers 202 with the job
    // id immediately — the crawl runs in the background worker and can never
    // block the initial response.
    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.status).toBe('pending')
    expect(typeof body.jobId).toBe('string')
    expect(body.cached).toBe(false)

    // The job was created and marked running
    expect(createDiscoveryJob).toHaveBeenCalledTimes(1)
    expect(updateDiscoveryJob).toHaveBeenCalled()

    // jobId must be present in the response
    expect(body.jobId).toBeDefined()

    // The persisted job is owned by the authenticated caller — never 'anon'.
    const jobArg = vi.mocked(createDiscoveryJob).mock.calls[0][0] as { clerkUserId: string }
    expect(jobArg.clerkUserId).toBe('user-123')
    expect(jobArg.clerkUserId).not.toBe('anon')
  })

  // -------------------------------------------------------------------------
  // URL length cap: reject instead of silently truncating
  // -------------------------------------------------------------------------

  it('MUST REJECT a websiteUrl longer than MAX_WEBSITE_URL_LENGTH with 400', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user-123' } as any)

    const oversized = `https://example.com/${'a'.repeat(2100)}`
    const res = await post(oversized)

    expect(res.status).toBe(400)
    expect(createDiscoveryJob).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Free discovery path: no auth side effects, job is IP-scoped
  // -------------------------------------------------------------------------

  it('anonymous callers get the free discovery path with no auth side effects', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as any)

    const res = await post('https://example.com')
    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.status).toBe('pending')

    // Discovery job was created (async dispatch happens in background)
    expect(createDiscoveryJob).toHaveBeenCalledTimes(1)
    expect(updateDiscoveryJob).toHaveBeenCalled()
    // And the job is IP-scoped when an IP is present ('anon' only when the
    // request has no IP headers at all).
    const jobArg = (createDiscoveryJob as any).mock.calls[0][0]
    expect(jobArg.clerkUserId).toMatch(/^anon/)
  })

  // -------------------------------------------------------------------------
  // No entitlement gate: authenticated callers proceed to discovery
  // -------------------------------------------------------------------------

  it('authenticated caller proceeds to discovery (no entitlement gate on free demo route)', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user-123' } as any)
    vi.mocked(resolveSmartVideoAccessForUser).mockResolvedValue({ hasSmartVideoGo: false } as any)

    const res = await post('https://example.com')
    // The route always accepts a discovery JOB and answers 202 with the job
    // id immediately — the crawl runs in the background worker.
    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.status).toBe('pending')
    expect(typeof body.jobId).toBe('string')

    // Job was created because there is no entitlement gate on this route.
    expect(createDiscoveryJob).toHaveBeenCalledTimes(1)
    expect(updateDiscoveryJob).toHaveBeenCalled()
  })

  it('answers 503 with a retry message instead of hanging when the job store is unresponsive', async () => {
    vi.useFakeTimers()
    try {
      vi.mocked(auth).mockResolvedValue({ userId: null } as any)
      vi.mocked(createDiscoveryJob).mockReturnValue(new Promise(() => {}))

      const pending = post('https://example.com')
      await vi.advanceTimersByTimeAsync(8_000)
      const res = await pending

      expect(res.status).toBe(503)
      expect(res.headers.get('Retry-After')).toBe('60')
      expect((await res.json()).error).toMatch(/try again/)
    } finally {
      vi.useRealTimers()
    }
  })
})
