// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { sampleFrames } from '../frameSampler'

describe('sampleFrames source URL', () => {
  it('reads an X-hosted video through the same-origin proxy, not the raw cross-site URL', async () => {
    const raw = 'https://video.twimg.com/amplify_video/1/vid/avc1/1920x1080/a.mp4?tag=29'
    const srcs: string[] = []
    const create = document.createElement.bind(document)
    const spy = vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      const el = create(tag)
      if (tag === 'video') {
        Object.defineProperty(el, 'src', { set: (v: string) => { srcs.push(v) }, get: () => srcs[srcs.length - 1] ?? '' })
        // Fail fast: nothing is decoded in jsdom.
        setTimeout(() => el.dispatchEvent(new Event('error')), 0)
      }
      return el
    }) as typeof document.createElement)
    try {
      await sampleFrames(raw, { timeoutMs: 200 })
    } finally {
      spy.mockRestore()
    }
    expect(srcs[0]).toBe(`/api/media/remote?url=${encodeURIComponent(raw)}`)
  })

  it('leaves same-origin and blob URLs alone', async () => {
    const srcs: string[] = []
    const create = document.createElement.bind(document)
    const spy = vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      const el = create(tag)
      if (tag === 'video') {
        Object.defineProperty(el, 'src', { set: (v: string) => { srcs.push(v) }, get: () => '' })
        setTimeout(() => el.dispatchEvent(new Event('error')), 0)
      }
      return el
    }) as typeof document.createElement)
    try {
      await sampleFrames('/media/a.mp4', { timeoutMs: 200 })
    } finally {
      spy.mockRestore()
    }
    expect(srcs[0]).toBe('/media/a.mp4')
  })
})
