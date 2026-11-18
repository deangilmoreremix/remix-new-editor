import { describe, it, expect, vi } from 'vitest'
import { coverSource, containDest, parseSize } from '../thumbnailVariants'
import { THUMBNAIL_ASPECTS, THUMBNAIL_ASPECT_SIZES, thumbnailAspectFor, pickThumbnailUrl } from '../socialPayloads'
import { publishOne } from '../publishOrchestrator'
import { isAllowedImageSize } from '../../../lib/openaiImageOptions'

describe('thumbnail shapes', () => {
  it('every shape size is allowed by Images 2.6 custom-size rules and matches its ratio', () => {
    for (const a of THUMBNAIL_ASPECTS) {
      const size = THUMBNAIL_ASPECT_SIZES[a]
      expect(isAllowedImageSize(size)).toBe(true)
      const { w, h } = parseSize(size)
      const [aw, ah] = a.split(':').map(Number)
      expect(Math.abs(w / h - aw / ah)).toBeLessThan(0.02)
    }
  })

  it('crops around the focus point without leaving the picture', () => {
    const r = coverSource(1600, 900, 864, 1536, 0.5, 0.5) // wide picture into a tall shape
    expect(r.h).toBeCloseTo(900)
    expect(r.w).toBeCloseTo(900 * (864 / 1536))
    expect(r.x).toBeGreaterThanOrEqual(0)
    expect(r.x + r.w).toBeLessThanOrEqual(1600 + 1e-6)
    const left = coverSource(1600, 900, 864, 1536, 0, 0.5)
    expect(left.x).toBe(0)
    const right = coverSource(1600, 900, 864, 1536, 1, 0.5)
    expect(right.x + right.w).toBeCloseTo(1600)
  })

  it('fits the whole picture inside the shape, centred', () => {
    const d = containDest(1600, 900, 1024, 1024)
    expect(d.w).toBeCloseTo(1024)
    expect(d.h).toBeCloseTo(576)
    expect(d.y).toBeCloseTo((1024 - 576) / 2)
  })
})

describe('which thumbnail each network gets', () => {
  const thumb = { imageUrl: 'https://x/main.jpg', variants: { '9:16': 'https://x/tall.jpg', '4:5': 'https://x/feed.jpg' } }
  it('maps platforms to shapes', () => {
    expect(thumbnailAspectFor('youtube')).toBe('16:9')
    expect(thumbnailAspectFor('instagram')).toBe('9:16')
    expect(thumbnailAspectFor('instagram', { placement: 'timeline' })).toBe('4:5')
    expect(thumbnailAspectFor('tiktok')).toBeNull()
  })
  it('uses the matching version, else the main thumbnail', () => {
    expect(pickThumbnailUrl(thumb, 'instagram')).toBe('https://x/tall.jpg')
    expect(pickThumbnailUrl(thumb, 'instagram', { placement: 'timeline' })).toBe('https://x/feed.jpg')
    expect(pickThumbnailUrl(thumb, 'youtube')).toBe('https://x/main.jpg') // no 16:9 version made
    expect(pickThumbnailUrl({ imageUrl: 'https://x/main.jpg' }, 'instagram')).toBe('https://x/main.jpg')
    expect(pickThumbnailUrl(undefined, 'instagram')).toBeUndefined()
  })
  it('publishes the Instagram cover in the Reels shape', async () => {
    const igPublish = vi.fn(async () => ({ request_id: 'r1' }))
    const deps: any = { publish: { instagram: igPublish }, poll: async () => ({ status: 'completed', url: 'https://ig/p' }) }
    const res = await publishOne(
      { id: 'd', platform: 'instagram', accountId: '5', accountName: 'a', enabled: true, settings: {} } as any,
      { type: 'video', url: 'https://cdn.example.com/a.mp4' } as any,
      { master: 'hi', platforms: {}, variants: [] } as any,
      thumb as any,
      'key',
      deps,
    )
    expect(res.status).toBe('published')
    expect((igPublish.mock.calls[0] as any[])[1].cover_url).toBe('https://x/tall.jpg')
  })
})
