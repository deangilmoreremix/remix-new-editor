import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSharedMedia, registerSharedMedia, MAX_SHARED_MEDIA_ENTRIES } from '../sharedMedia'

describe('shared media history is best-effort', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('does not throw when localStorage is full', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    expect(() => registerSharedMedia({ outputUrls: ['https://cdn.example/a.png'], outputType: 'image' })).not.toThrow()
  })

  it('stores durable URLs but no data: image bytes', () => {
    registerSharedMedia({ outputUrls: ['data:image/png;base64,AAAA', 'https://cdn.example/a.png'], outputType: 'image' })
    expect(getSharedMedia()[0].outputUrls).toEqual(['https://cdn.example/a.png'])
  })

  it(`keeps only the newest ${MAX_SHARED_MEDIA_ENTRIES} entries`, () => {
    for (let i = 0; i < MAX_SHARED_MEDIA_ENTRIES + 5; i++) {
      registerSharedMedia({ outputUrls: [`https://cdn.example/${i}.png`], outputType: 'image', createdAt: new Date(2026, 0, 1, 0, 0, i).toISOString() })
    }
    const all = getSharedMedia()
    expect(all).toHaveLength(MAX_SHARED_MEDIA_ENTRIES)
    expect(all[0].outputUrls).toEqual([`https://cdn.example/${MAX_SHARED_MEDIA_ENTRIES + 4}.png`])
  })
})
