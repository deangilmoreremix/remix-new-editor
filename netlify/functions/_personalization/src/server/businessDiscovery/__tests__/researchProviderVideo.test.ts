// @vitest-environment node
/**
 * Video-marketing detection tests for the research provider.
 *
 * Same isolation approach as researchProviderSsrf.test.ts: DNS is mocked so
 * the SSRF gate passes deterministically without touching the network, and
 * axios is spied so each test serves an inline homepage fixture. No extra
 * fetches are needed — detection runs on the already-fetched homepage HTML.
 *
 * Contract under test:
 *   - A strong video signal (embed, native <video>, .mp4/.webm source,
 *     og:video meta, wix-video) flips hasPromoVideo to `true`.
 *   - A plain YouTube/Vimeo channel link is weak evidence: noted in
 *     `signals`, but it alone never flips the verdict.
 *   - Absence of evidence is `hasPromoVideo: 'unknown'`, never `false`.
 *   - An unreachable site is `hasPromoVideo: 'unknown'`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Hoisted mocks for node:dns, mirroring researchProviderSsrf.test.ts: the
// networkSafety gate uses dns.promises.resolve4 / resolve6.
const mockResolve4 = vi.hoisted(() => vi.fn())
const mockResolve6 = vi.hoisted(() => vi.fn())

vi.mock('node:dns', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('dns') & { default: { promises: { resolve4: typeof import('dns').promises.resolve4; resolve6: typeof import('dns').promises.resolve6 } } }
  const promises = {
    ...actual.default.promises,
    resolve4: mockResolve4,
    resolve6: mockResolve6,
  }
  return {
    ...actual,
    default: { ...actual.default, promises },
  }
})

import axios from 'axios'
import { researchBusiness } from '../researchProvider'

// A public address so the SSRF gate accepts the target (8.8.8.8, Google DNS).
const PUBLIC_IP = '8.8.8.8'

describe('researchProvider video marketing', () => {
  beforeEach(() => {
    mockResolve4.mockReset()
    mockResolve6.mockReset()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function mockPublicDns(): void {
    mockResolve4.mockResolvedValue([PUBLIC_IP])
    mockResolve6.mockResolvedValue([])
  }

  function mockHomepage(html: string): void {
    vi.spyOn(axios, 'get').mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
      data: html,
    } as any)
  }

  it('reports hasPromoVideo=true for a homepage with a YouTube embed', async () => {
    mockPublicDns()
    mockHomepage(
      '<html><head><title>ok</title></head><body>' +
        '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>' +
        '</body></html>',
    )

    const result = await researchBusiness('https://example.com')
    expect(result.reachable).toBe(true)
    expect(result.videoMarketing.hasPromoVideo).toBe(true)
    expect(result.videoMarketing.signals.some((s) => /youtube video embed/i.test(s))).toBe(true)
  })

  it('reports hasPromoVideo=true for a Vimeo embed and native video sources', async () => {
    mockPublicDns()
    mockHomepage(
      '<html><head><title>ok</title></head><body>' +
        '<iframe src="https://player.vimeo.com/video/12345"></iframe>' +
        '<video controls><source src="/promo.mp4" type="video/mp4"></video>' +
        '</body></html>',
    )

    const result = await researchBusiness('https://example.com')
    expect(result.videoMarketing.hasPromoVideo).toBe(true)
    expect(result.videoMarketing.signals.some((s) => /vimeo video embed/i.test(s))).toBe(true)
    expect(result.videoMarketing.signals.some((s) => /<video>/i.test(s))).toBe(true)
  })

  it('reports hasPromoVideo=true for og:video meta and wix-video components', async () => {
    mockPublicDns()
    mockHomepage(
      '<html><head>' +
        '<meta property="og:video:url" content="https://example.com/promo.mp4">' +
        '</head><body><div class="wix-video"></div></body></html>',
    )

    const result = await researchBusiness('https://example.com')
    expect(result.videoMarketing.hasPromoVideo).toBe(true)
    expect(result.videoMarketing.signals.some((s) => /og:video:url/i.test(s))).toBe(true)
    expect(result.videoMarketing.signals.some((s) => /wix-video/i.test(s))).toBe(true)
  })

  it('keeps hasPromoVideo unknown for a homepage with only a YouTube channel link', async () => {
    mockPublicDns()
    mockHomepage(
      '<html><head><title>ok</title></head><body>' +
        '<a href="https://www.youtube.com/channel/UCabc123">Watch us</a>' +
        '</body></html>',
    )

    const result = await researchBusiness('https://example.com')
    expect(result.videoMarketing.hasPromoVideo).toBe('unknown')
    // The channel link is still noted as weak evidence.
    expect(result.videoMarketing.signals.some((s) => /youtube\/vimeo video link/i.test(s))).toBe(true)
  })

  it('keeps hasPromoVideo unknown for plain HTML with no video signals', async () => {
    mockPublicDns()
    mockHomepage(
      '<html><head><title>ok</title></head><body><p>Plain homepage, no media.</p></body></html>',
    )

    const result = await researchBusiness('https://example.com')
    expect(result.videoMarketing.hasPromoVideo).toBe('unknown')
    expect(Array.isArray(result.videoMarketing.signals)).toBe(true)
  })

  it('reports hasPromoVideo unknown when the site is unreachable', async () => {
    // Public hostname that does not resolve.
    mockResolve4.mockRejectedValueOnce(Object.assign(new Error('not found'), { code: 'ENOTFOUND' }))
    mockResolve6.mockRejectedValueOnce(Object.assign(new Error('not found'), { code: 'ENOTFOUND' }))

    const result = await researchBusiness('https://public-dead.example/')
    expect(result.reachable).toBe(false)
    expect(result.videoMarketing.hasPromoVideo).toBe('unknown')
  })
})
