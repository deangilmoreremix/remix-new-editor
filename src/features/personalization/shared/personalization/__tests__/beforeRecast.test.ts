import { describe, it, expect } from 'vitest'
import { restorablePreviewVideo, videoBeforeRecast } from '../DemoPersonalizeProvider'
import type { PreviewVideoRef } from '../preview/types'

const demo: PreviewVideoRef = { url: 'https://cdn.example.com/a.mp4', poster: null, title: 'A', kind: 'demo' }
const recastOf = (before: PreviewVideoRef | null, url = 'https://cdn.example.com/recast.mp4'): PreviewVideoRef => ({
  url, poster: null, title: 'Recast', kind: 'recast', beforeRecast: before,
})

describe('videoBeforeRecast', () => {
  it('keeps the current non-recast video', () => {
    expect(videoBeforeRecast(demo)).toEqual(demo)
  })
  it('recasting a recast keeps the original footage', () => {
    expect(videoBeforeRecast(recastOf(demo))).toEqual(demo)
  })
  it('is null with no video', () => {
    expect(videoBeforeRecast(null)).toBeNull()
  })
})

describe('restorablePreviewVideo', () => {
  it('restores a recast together with its own original video', () => {
    expect(restorablePreviewVideo(recastOf(demo))).toEqual(recastOf(demo))
  })
  it('a saved recast without an original has nothing to undo to', () => {
    expect(restorablePreviewVideo(recastOf(null))?.beforeRecast).toBeNull()
    expect(restorablePreviewVideo({ ...recastOf(null), beforeRecast: undefined })?.beforeRecast).toBeNull()
  })
  it('drops in-browser URLs, including the original under a recast', () => {
    expect(restorablePreviewVideo({ ...demo, url: 'blob:http://x/1' })).toBeNull()
    expect(restorablePreviewVideo(recastOf({ ...demo, url: 'blob:http://x/1' }))?.beforeRecast).toBeNull()
  })
  it('rejects malformed values', () => {
    expect(restorablePreviewVideo(null)).toBeNull()
    expect(restorablePreviewVideo('x')).toBeNull()
    expect(restorablePreviewVideo({ title: 'no url' })).toBeNull()
  })
  it('a non-recast video carries no original', () => {
    expect(restorablePreviewVideo({ ...demo, beforeRecast: demo })).toEqual(demo)
  })

  it("keeps a recast's stored sound and drops an in-browser one", () => {
    expect(restorablePreviewVideo({ ...recastOf(demo), audioUrl: 'https://cdn.example.com/clip.mp4' })?.audioUrl).toBe('https://cdn.example.com/clip.mp4')
    expect(restorablePreviewVideo({ ...recastOf(demo), audioUrl: 'blob:http://x/2' })?.audioUrl).toBeNull()
  })
})
