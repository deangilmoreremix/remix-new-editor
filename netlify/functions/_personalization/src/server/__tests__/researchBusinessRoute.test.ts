// @vitest-environment node
/**
 * Unit tests for app/api/personalization/research-business/route.ts.
 *
 * Fully offline and deterministic. Mocking/isolation approach:
 * - '../businessDiscovery/researchProvider' — the module the route
 *   dynamic-imports — is mocked at the module boundary, so no test depends on
 *   the provider's internals (it is concurrently being rewritten for SSRF
 *   protection). Tests drive it by rejecting/resolving researchBusiness with
 *   the exact error shapes the SSRF guard throws.
 * - '../personalizationLog' and '../envValidation' are mocked.
 * - '../../../lib/rateLimit' lives at the repo-root lib/ directory and does NOT
 *   resolve under vitest (the @/lib/* alias points at /src/lib), so the
 *   limiter module is stubbed — the same idiom as
 *   tests/vfx-rate-limit-keying.vitest.test.ts. The stub re-implements the
 *   only two behaviors the route depends on (`userId || ip || 'anon'` key
 *   normalization and per-key counting) backed by a hoisted hits Map that the
 *   beforeEach reset clears, so in-process limiter state can never leak
 *   between tests or between route test files sharing a worker. The stub is
 *   spy-wrapped so tests can also assert exactly which key/max the route used.
 *
 * These tests live in src/server/__tests__/ rather than next to the route
 * because that is the existing convention for personalization route unit
 * tests (see downloadImageRoute.test.ts) and the only location matched by
 * this suite's vitest include patterns.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from '../../../shims/next-server'

vi.mock('../personalizationLog', () => ({
  logPersonalization: vi.fn(),
  createCorrelationId: vi.fn(),
  sanitizeForLog: vi.fn((s: unknown) => s),
}))

vi.mock('../envValidation', () => ({
  validatePersonalizationEnv: vi.fn(),
}))

// The route is now gated by requireApiEntitlement, which pulls in the real
// server-only Clerk auth() and the Supabase-backed
// resolveSmartVideoAccessForUser. Stub both seams at the module boundary (the
// tests/proxy-routes.vitest.test.ts idiom) so the entitled path is exercised
// without a Clerk session or Supabase env; the entitlement-gate case flips
// resolveSmartVideoAccessForUser to hasSmartVideoGo:false to assert the 403.
vi.mock('../../../shims/clerk-server', () => ({
  auth: vi.fn(async () => ({ userId: 'test-user' })),
}))

vi.mock('../../../tests/stubs/resolveAccess', () => ({
  resolveSmartVideoAccessForUser: vi.fn(async () => ({ hasSmartVideoGo: true })),
}))

// The provider is mocked at the module boundary only: researchBusiness (and
// its sibling export for API parity) are controllable spies.
vi.mock('../businessDiscovery/researchProvider', () => ({
  researchBusiness: vi.fn(),
  enrichClientProfileFromResearch: vi.fn(),
}))

// Rate-limiter stub. resolveRateLimitKey mirrors lib/rateLimit.ts
// (`userId || clientIp || 'anon'`); rateLimit/rateLimit429 are spies whose
// counting implementation is installed in beforeEach against a per-test
// reset Map (see the header comment).
const rateLimitMocks = vi.hoisted(() => ({
  hits: new Map<string, number>(),
  rateLimit: vi.fn(),
  rateLimit429: vi.fn(),
}))

vi.mock('../../../lib/rateLimit', () => ({
  resolveRateLimitKey: (userId?: string | null, clientIp?: string | null) =>
    userId || clientIp || 'anon',
  rateLimit: rateLimitMocks.rateLimit,
  rateLimit429: rateLimitMocks.rateLimit429,
}))

// Import after mocks are registered
import { POST } from '../../../app/api/personalization/research-business/route'
import { auth } from '../../../shims/clerk-server'
import { resolveSmartVideoAccessForUser } from '../../../tests/stubs/resolveAccess'
import { researchBusiness } from '../businessDiscovery/researchProvider'
import { logPersonalization, createCorrelationId } from '../personalizationLog'
import { validatePersonalizationEnv } from '../envValidation'

const RESEARCH_PAYLOAD = {
  canonicalUrl: 'https://example.com/',
  finalUrl: 'https://example.com/',
  reachable: true,
  statusCode: 200,
  contentType: 'text/html; charset=utf-8',
  title: 'Example Co',
  description: 'We sell example things',
  logoUrl: 'https://example.com/logo.png',
  socialLinks: { facebook: 'https://facebook.com/example' },
  jsonLd: [{ '@type': 'Organization', name: 'Example Co' }],
  openGraph: { title: 'Example Co' },
  twitterCard: {},
  contactInfo: {
    phones: ['+1-512-555-0100'],
    emails: ['hi@example.com'],
    addresses: ['Austin, TX'],
  },
}

function post(body: unknown, headers: Record<string, string> = {}) {
  const req = new NextRequest('http://localhost/api/personalization/research-business', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  return POST(req)
}

function errorWithCode(message: string, code: string): Error & { code?: string } {
  const err = new Error(message) as Error & { code?: string }
  err.code = code
  return err
}

beforeEach(() => {
  vi.resetAllMocks()
  // Reset the limiter stub's per-key counters (the isolation mechanism).
  rateLimitMocks.hits.clear()

  // Default: an authenticated, entitled caller so the gate opens and every
  // pre-existing case exercises the handler's own logic.
  vi.mocked(auth).mockResolvedValue({ userId: 'test-user' } as any)
  vi.mocked(resolveSmartVideoAccessForUser).mockResolvedValue({ hasSmartVideoGo: true } as any)

  vi.mocked(createCorrelationId).mockReturnValue('test-correlation-id')
  vi.mocked(validatePersonalizationEnv).mockReturnValue({ valid: true, missingRequired: [] } as any)
  vi.mocked(researchBusiness).mockResolvedValue(RESEARCH_PAYLOAD as any)

  // Counting limiter with the same allow/deny semantics as lib/rateLimit.ts:
  // the (max+1)-th hit inside the window is denied with a 60s retry-after.
  rateLimitMocks.rateLimit.mockImplementation((key: string, opts?: { max?: number }) => {
    const max = opts?.max ?? 10
    const count = (rateLimitMocks.hits.get(key) ?? 0) + 1
    rateLimitMocks.hits.set(key, count)
    if (count > max) return { allowed: false, remaining: 0, retryAfterMs: 60_000 }
    return { allowed: true, remaining: max - count, retryAfterMs: 0 }
  })
  rateLimitMocks.rateLimit429.mockImplementation((retryAfterMs: number) =>
    NextResponse.json(
      { error: 'Rate limit exceeded. Please wait before retrying.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } },
    ),
  )
})

// ---------------------------------------------------------------------------
// No entitlement gate: research-business is free for the demo experience
// ---------------------------------------------------------------------------

describe('research-business route — no entitlement gate', () => {
  it('200 when the caller is authenticated but unentitled (free demo route)', async () => {
    vi.mocked(resolveSmartVideoAccessForUser).mockResolvedValue({ hasSmartVideoGo: false } as any)

    const res = await post({ websiteUrl: 'https://example.com' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)

    // Discovery machinery runs because there is no entitlement gate.
    expect(researchBusiness).toHaveBeenCalled()
  })

  it('200 when the caller has no session (free demo route, unauthenticated OK)', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as any)

    const res = await post({ websiteUrl: 'https://example.com' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)

    // Discovery machinery runs because there is no auth gate on this route.
    expect(researchBusiness).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// 400 validation
// ---------------------------------------------------------------------------

describe('research-business route — validation 400s', () => {
  it('400 when websiteUrl is missing', async () => {
    const res = await post({})
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('websiteUrl is required')
    expect(researchBusiness).not.toHaveBeenCalled()
  })

  it('400 when websiteUrl exceeds 2048 characters', async () => {
    const res = await post({ websiteUrl: `https://example.com/${'a'.repeat(2100)}` })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('websiteUrl must be at most 2048 characters')
    expect(researchBusiness).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// 200 happy path
// ---------------------------------------------------------------------------

describe('research-business route — success flow', () => {
  it('200 returns the research payload from the provider', async () => {
    const res = await post({ websiteUrl: 'https://example.com' })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.research).toEqual(RESEARCH_PAYLOAD)
    expect(researchBusiness).toHaveBeenCalledWith('https://example.com')
    expect(logPersonalization).toHaveBeenCalledWith(
      expect.objectContaining({
        route: '/api/personalization/research-business',
        stage: 'research',
        provider: 'STATIC_HTTP',
        httpStatus: 200,
      }),
    )
  })

  it('200 logs STATIC_HTTP_FAILED when the site is unreachable', async () => {
    vi.mocked(researchBusiness).mockResolvedValue({
      ...RESEARCH_PAYLOAD,
      reachable: false,
    } as any)

    const res = await post({ websiteUrl: 'https://example.com' })
    expect(res.status).toBe(200)
    expect(logPersonalization).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'STATIC_HTTP_FAILED' }),
    )
  })
})

// ---------------------------------------------------------------------------
// 502 upstream fetch failures
// ---------------------------------------------------------------------------

describe('research-business route — upstream 502s', () => {
  it('502 with GENERIC body + correlationId + x-correlation-id on ENOTFOUND fetch failure', async () => {
    vi.mocked(researchBusiness).mockRejectedValue(errorWithCode('fetch failed', 'ENOTFOUND'))

    const res = await post({ websiteUrl: 'https://example.com' })
    expect(res.status).toBe(502)

    const body = await res.json()
    expect(body.error).toBe('Personalization runtime error')
    // No internals leaked to the caller; the node code is the safe code.
    expect(body.error).not.toMatch(/fetch failed|ENOTFOUND|dns/i)
    expect(body.code).toBe('ENOTFOUND')
    expect(body.correlationId).toBe('test-correlation-id')
    expect(res.headers.get('x-correlation-id')).toBe('test-correlation-id')
  })

  it("502 for a bare 'fetch failed' message without a node code", async () => {
    vi.mocked(researchBusiness).mockRejectedValue(new Error('fetch failed'))

    const res = await post({ websiteUrl: 'https://example.com' })
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.code).toBe('PERSONALIZATION_RUNTIME_ERROR')
  })
})

// ---------------------------------------------------------------------------
// 400 blocked-URL (SSRF) failures
//
// The provider is now SSRF-protected (see researchProvider.ts, validated by
// src/lib/networkSafety.ts): every rejected target throws a
// BlockedTargetError whose message is
// `Blocked URL: private/unsafe target (reason) is not allowed`. The route
// classifies thrown messages with /not allowed|Private|Invalid/i → 400
// before falling back to 502/500, so EVERY rejection below must map to 400
// (caller mistake), never 502. The legacy urlSecurity message forms are kept
// as a second case set in case a future rewrite drops the wrapper.
// ---------------------------------------------------------------------------

describe('research-business route — blocked-URL 400s', () => {
  const ssrfMessages = [
    // Actual messages thrown by the SSRF-guarded provider (researchProvider.ts,
    // validated by src/lib/networkSafety.ts):
    'Blocked URL: private/unsafe target (blocked_host) is not allowed',
    'Blocked URL: private/unsafe target (resolved_to_blocked_ip) is not allowed',
    'Blocked URL: private/unsafe target (invalid_url) is not allowed',
    'Blocked URL: private/unsafe target (Only http/https protocols are allowed) is not allowed',
    'Blocked URL: private/unsafe target (redirect to blocked_host) is not allowed',
    'Blocked URL: private/unsafe target (too many redirects) is not allowed',
    'Blocked URL: private/unsafe target (malformed redirect Location header) is not allowed',
    // Raw networkSafety messages (src/lib/networkSafety.ts):
    'Private network addresses are not allowed',
    'Private network addresses are not allowed (unspecified address 0.0.0.0/[::]) is not allowed',
    'Only http/https protocols are allowed',
    // Legacy urlSecurity message forms:
    'Blocked: private/loopback/link-local/metadata IP', // e.g. 127.0.0.1, 10.x, 169.254.169.254, ::1
    'Blocked: internal/private hostname', // e.g. localhost, *.internal, *.local, *.lan
    'Blocked address (private/loopback/link-local/metadata)', // DNS-resolved private address
    'Invalid URL', // unparseable input
    'Only http(s) URLs are allowed',
    'DNS resolution failed',
    'Private network addresses are not allowed', // legacy discoverAssets sanitizeUrl message
  ]

  for (const message of ssrfMessages) {
    it(`400 (generic body, no leak) when the provider blocks the target: "${message}"`, async () => {
      vi.mocked(researchBusiness).mockRejectedValue(new Error(message))

      const res = await post({ websiteUrl: 'http://127.0.0.1/secret' })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('Personalization runtime error')
      expect(body.error).not.toContain(message)
      expect(body.correlationId).toBe('test-correlation-id')
    })
  }
})

// ---------------------------------------------------------------------------
// 400 explicit classification of the two "no-keyword" validator messages
//
// `Only http/https protocols are allowed` (non-HTTP(S) protocol, exported by
// src/lib/networkSafety.ts) and `DNS resolution failed` (unresolvable
// hostname) are the two validator rejections that carry none of the words in
// the general 400 regex. Both are caller mistakes — the supplied URL is
// unusable regardless of network conditions — so they must map to 400, not
// fall through to 500. These are pinned here so the classification helpers
// in the route cannot silently regress to misreporting them as internal
// failures. The legacy urlSecurity spellings are asserted as well so the
// classification stays robust to either wording.
// ---------------------------------------------------------------------------

describe('research-business route — no-keyword validator 400s', () => {
  const callerMistakeMessages = [
    // networkSafety (src/lib/networkSafety.ts) protocol rejection.
    'Only http/https protocols are allowed',
    // Legacy urlSecurity protocol rejection spelling.
    'Only http(s) URLs are allowed',
    // Unresolvable hostname.
    'DNS resolution failed',
    // Case variance must not break the classification.
    'only http/https protocols are allowed',
    'only http(s) urls are allowed',
    'dns resolution failed',
    // Wrapped by the provider as a BlockedTargetError.
    'Blocked URL: private/unsafe target (Only http/https protocols are allowed) is not allowed',
    'Blocked URL: private/unsafe target (Only http(s) URLs are allowed) is not allowed',
    'Blocked URL: private/unsafe target (DNS resolution failed) is not allowed',
  ]

  for (const message of callerMistakeMessages) {
    it(`400 when the provider throws the caller mistake: "${message}"`, async () => {
      vi.mocked(researchBusiness).mockRejectedValue(new Error(message))

      const res = await post({ websiteUrl: 'http://127.0.0.1/secret' })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('Personalization runtime error')
      expect(body.correlationId).toBe('test-correlation-id')
      expect(res.headers.get('x-correlation-id')).toBe('test-correlation-id')
    })
  }

  it('400 for a DNS-resolution failure even when the error carries a node code', async () => {
    // The provider may propagate a DNS error with a node code attached; the
    // caller-mistake classification must still win over the upstream check.
    vi.mocked(researchBusiness).mockRejectedValue(errorWithCode('DNS resolution failed', 'ENOTFOUND'))

    const res = await post({ websiteUrl: 'http://127.0.0.1/secret' })
    // Caller mistakes are checked before the fetch-level heuristic, so a node
    // code on a blocked URL must not downgrade it to 502.
    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// Mapping unchanged for everything else
// ---------------------------------------------------------------------------

describe('research-business route — unchanged 502/500 mapping', () => {
  it('502 (not 400) for a transport-level DNS failure against a validated URL', async () => {
    // axios/undici surfaces this as `fetch failed` with a node code — it
    // belongs to the upstream group, not the caller-mistake group, so the new
    // patterns must not sweep it into 400.
    vi.mocked(researchBusiness).mockRejectedValue(errorWithCode('fetch failed', 'ENOTFOUND'))

    const res = await post({ websiteUrl: 'https://example.com' })
    expect(res.status).toBe(502)
  })

  it('502 (not 400) for a network error mentioning DNS', async () => {
    vi.mocked(researchBusiness).mockRejectedValue(new Error('network unreachable while resolving DNS'))

    const res = await post({ websiteUrl: 'https://example.com' })
    expect(res.status).toBe(502)
  })

  it('500 for an unclassifiable provider error', async () => {
    vi.mocked(researchBusiness).mockRejectedValue(new Error('unexpected parsing boom'))

    const res = await post({ websiteUrl: 'https://example.com' })
    expect(res.status).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// 500 unexpected failures
// ---------------------------------------------------------------------------

describe('research-business route — unexpected 500', () => {
  it('500 with a generic body for an unclassifiable provider error', async () => {
    vi.mocked(researchBusiness).mockRejectedValue(new Error('unexpected parsing boom'))

    const res = await post({ websiteUrl: 'https://example.com' })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Personalization runtime error')
    expect(body.correlationId).toBe('test-correlation-id')
    expect(res.headers.get('x-correlation-id')).toBe('test-correlation-id')
  })
})

// ---------------------------------------------------------------------------
// Rate limiting: key derivation (x-real-ip first, LAST x-forwarded-for hop,
// anon fallback) and per-IP buckets
// ---------------------------------------------------------------------------

describe('research-business route — rate-limit key derivation', () => {
  it('prefers x-real-ip over the x-forwarded-for hops', async () => {
    await post({ websiteUrl: 'https://example.com' }, {
      'x-real-ip': '8.8.8.8',
      'x-forwarded-for': '1.2.3.4, 9.9.9.9',
    })
    expect(rateLimitMocks.rateLimit).toHaveBeenCalledWith('8.8.8.8', {
      windowMs: 60_000,
      max: 10,
    })
  })

  it('uses the LAST x-forwarded-for hop (proxy-appended), not the client-controlled first hop', async () => {
    await post({ websiteUrl: 'https://example.com' }, {
      'x-forwarded-for': '1.2.3.4, 203.0.113.7',
    })
    expect(rateLimitMocks.rateLimit).toHaveBeenCalledWith('203.0.113.7', {
      windowMs: 60_000,
      max: 10,
    })
  })

  it('rotating the client-controlled first XFF hop does NOT mint a fresh bucket', async () => {
    await post({ websiteUrl: 'https://example.com' }, { 'x-forwarded-for': '9.9.9.1, 203.0.113.5' })
    await post({ websiteUrl: 'https://example.com' }, { 'x-forwarded-for': '9.9.9.2, 203.0.113.5' })
    const keys = rateLimitMocks.rateLimit.mock.calls.map((c) => c[0])
    expect(keys).toEqual(['203.0.113.5', '203.0.113.5'])
  })

  it("falls back to the shared 'anon' bucket with a much higher max (100/min) when no proxy headers exist", async () => {
    // 11 anonymous requests all succeed: the shared bucket degrades
    // gracefully instead of every anonymous caller sharing 10/min.
    for (let i = 0; i < 11; i++) {
      const res = await post({ websiteUrl: 'https://example.com' })
      expect(res.status).toBe(200)
    }
    expect(rateLimitMocks.rateLimit).toHaveBeenCalledWith('anon', {
      windowMs: 60_000,
      max: 100,
    })
  })
})

describe('research-business route — rate limiting behavior', () => {
  it('429 with Retry-After after 10 requests for one IP, while a different x-real-ip is not limited', async () => {
    const ipA = { 'x-real-ip': '203.0.113.10' }
    for (let i = 0; i < 10; i++) {
      const res = await post({ websiteUrl: 'https://example.com' }, ipA)
      expect(res.status).toBe(200)
    }

    const blocked = await post({ websiteUrl: 'https://example.com' }, ipA)
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('retry-after')).toBe('60')
    const body = await blocked.json()
    expect(body.error).toMatch(/rate limit exceeded/i)
    expect(rateLimitMocks.rateLimit429).toHaveBeenCalledWith(60_000)

    // A different x-real-ip derives a different key → its own bucket.
    const otherIp = await post({ websiteUrl: 'https://example.com' }, {
      'x-real-ip': '198.51.100.99',
    })
    expect(otherIp.status).toBe(200)
  })
})
