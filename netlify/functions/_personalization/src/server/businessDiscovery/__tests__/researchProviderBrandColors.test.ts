/**
 * Brand-colour detection in the research provider. Same isolation as
 * researchProviderVideo.test.ts: DNS is mocked so the SSRF gate passes, and
 * axios serves inline fixtures keyed by URL.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockResolve4 = vi.hoisted(() => vi.fn())
const mockResolve6 = vi.hoisted(() => vi.fn())

vi.mock('node:dns', async (importOriginal) => {
  const actual = (await importOriginal()) as any
  const promises = { ...actual.default.promises, resolve4: mockResolve4, resolve6: mockResolve6 }
  return { ...actual, default: { ...actual.default, promises } }
})

import axios from 'axios'
import { researchBusiness } from '../researchProvider'

function serve(routes: Record<string, { type: string; body: string }>) {
  return vi.spyOn(axios, 'get').mockImplementation(async (url: any) => {
    const route = routes[String(url)]
    if (!route) throw new Error(`unexpected fetch ${url}`)
    return { status: 200, headers: { 'content-type': route.type }, data: route.body } as any
  })
}

describe('researchProvider brand colours', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockResolve4.mockReset().mockResolvedValue(['8.8.8.8'])
    mockResolve6.mockReset().mockResolvedValue([])
  })
  afterEach(() => vi.restoreAllMocks())

  it('reads theme-color and inline brand variables without extra requests', async () => {
    const spy = serve({
      'https://example.com/': {
        type: 'text/html',
        body: '<html><head><meta name="theme-color" content="#e63946"><style>:root{--accent:#1d3557}</style>' +
          '<link rel="stylesheet" href="/site.css"></head><body>hi</body></html>',
      },
    })
    const result = await researchBusiness('https://example.com')
    expect(result.brandColors?.primary).toBe('#e63946')
    expect(result.brandColors?.accent).toBe('#1d3557')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('falls back to the site stylesheet when the page names no brand colour', async () => {
    serve({
      'https://example.com/': {
        type: 'text/html',
        body: '<html><head><link rel="stylesheet" href="/css/site.css"></head><body>hi</body></html>',
      },
      'https://example.com/css/site.css': {
        type: 'text/css',
        body: ':root{--brand-primary:#2a9d8f}.btn{background:#2a9d8f}a{color:#e76f51}a:hover{color:#e76f51}',
      },
    })
    const result = await researchBusiness('https://example.com')
    expect(result.brandColors?.primary).toBe('#2a9d8f')
    expect(result.brandColors?.accent).toBe('#e76f51')
  })

  it('a failing stylesheet never fails the research', async () => {
    serve({
      'https://example.com/': {
        type: 'text/html',
        body: '<html><head><link rel="stylesheet" href="/missing.css"></head><body>hi</body></html>',
      },
    })
    const result = await researchBusiness('https://example.com')
    expect(result.reachable).toBe(true)
    expect(result.brandColors).toEqual({ palette: [], sources: [] })
  })
})

describe('researchProvider page Markdown', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockResolve4.mockReset().mockResolvedValue(['8.8.8.8'])
    mockResolve6.mockReset().mockResolvedValue([])
  })
  afterEach(() => vi.restoreAllMocks())

  it('returns the homepage content as Markdown', async () => {
    serve({
      'https://example.com/': {
        type: 'text/html',
        body: '<html><body><nav><a href="/">Home</a></nav><main><h1>Acme</h1><p>We fix pipes fast.</p></main></body></html>',
      },
    })
    const result = await researchBusiness('https://example.com')
    expect(result.pageMarkdown).toBe('# Acme\n\nWe fix pipes fast.')
  })
})
