// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { loadRecastVideos, saveRecastVideos } from '../recastJob'

beforeEach(() => localStorage.clear())

describe('saved recast videos keep their performance clip', () => {
  it('round-trips the clip so the sound can be kept after a reload', () => {
    saveRecastVideos('demo-1', 'owner-a', [
      { id: 'v1', url: 'https://cdn.example.com/recast.mp4', name: 'Recast', sourceUrl: 'https://cdn.example.com/performance.mp4' },
    ])
    expect(loadRecastVideos('demo-1', 'owner-a')).toEqual([
      { id: 'v1', url: 'https://cdn.example.com/recast.mp4', name: 'Recast', sourceUrl: 'https://cdn.example.com/performance.mp4' },
    ])
  })

  it('drops a clip that cannot be played after a reload, and reads older entries without one', () => {
    localStorage.setItem('pz_recast_videos:owner-a:demo-1', JSON.stringify([
      { id: 'v1', url: 'https://cdn.example.com/a.mp4', name: 'A', sourceUrl: 'blob:http://x/1' },
      { id: 'v2', url: 'https://cdn.example.com/b.mp4', name: 'B' },
    ]))
    const loaded = loadRecastVideos('demo-1', 'owner-a')
    expect(loaded).toHaveLength(2)
    expect(loaded[0].sourceUrl).toBeUndefined()
    expect(loaded[1].sourceUrl).toBeUndefined()
  })
})
