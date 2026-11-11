// @vitest-environment jsdom
/**
 * The load check decides whether a discovered image is linked by its web
 * address (it loads) or downloaded and stored (its site blocks it).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { imageLoadsInBrowser } from '../imageLoadProbe'

function stubBrowser(outcome: 'load' | 'error' | 'never', naturalWidth = 100) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 Chrome')
  class FakeImage {
    naturalWidth = naturalWidth
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    set src(_v: string) {
      if (outcome === 'load') queueMicrotask(() => this.onload?.())
      if (outcome === 'error') queueMicrotask(() => this.onerror?.())
    }
  }
  vi.stubGlobal('Image', FakeImage)
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('imageLoadsInBrowser', () => {
  it('is true for an image that loads', async () => {
    stubBrowser('load')
    expect(await imageLoadsInBrowser('https://biz.example/a.jpg')).toBe(true)
  })

  it('is false for an image its site blocks', async () => {
    stubBrowser('error')
    expect(await imageLoadsInBrowser('https://biz.example/a.jpg')).toBe(false)
  })

  it('is false for a load that returns no pixels', async () => {
    stubBrowser('load', 0)
    expect(await imageLoadsInBrowser('https://biz.example/a.jpg')).toBe(false)
  })

  it('gives up after the timeout', async () => {
    vi.useFakeTimers()
    stubBrowser('never')
    const pending = imageLoadsInBrowser('https://slow.example/a.jpg', 1000)
    await vi.advanceTimersByTimeAsync(1000)
    expect(await pending).toBe(false)
  })

  it('is false for an empty address', async () => {
    expect(await imageLoadsInBrowser('')).toBe(false)
  })
})
