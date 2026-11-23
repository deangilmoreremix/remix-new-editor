import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from '../_personalization/shims/next-server'
import { GET } from '../_personalization/app/api/media/remote/route'

const TWIMG = 'https://video.twimg.com/amplify_video/1/vid/avc1/1920x1080/a.mp4?tag=29'
const CDN = 'https://cdn.seedance2prompt.com/a.mp4'
const call = (target, init) => GET(new NextRequest(`http://localhost/api/media/remote?url=${encodeURIComponent(target)}`, init))

describe('media proxy Referer for hotlink-protected hosts', () => {
  let fetchMock
  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response('abc', { status: 206, headers: { 'content-type': 'video/mp4', 'content-range': 'bytes 0-2/9' } }))
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('sends the x.com Referer and a browser User-Agent to video.twimg.com, and keeps Range', async () => {
    expect((await call(TWIMG, { headers: { range: 'bytes=0-2' } })).status).toBe(206)
    const h = fetchMock.mock.calls[0][1].headers
    expect(h.Referer).toBe('https://x.com/')
    expect(h['User-Agent']).toMatch(/Mozilla/)
    expect(h.Range).toBe('bytes=0-2')
  })

  it('sends no Referer to other hosts', async () => {
    await call(CDN)
    const h = fetchMock.mock.calls[0][1].headers
    expect(h.Referer).toBeUndefined()
    expect(h['User-Agent']).toBe('OpenHiggsBolt-Personalization-Preview')
  })
})
