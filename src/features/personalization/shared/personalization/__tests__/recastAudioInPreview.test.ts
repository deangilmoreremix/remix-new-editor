import { describe, it, expect } from 'vitest'
import { buildPreviewInput } from '../guided/buildPreviewInput'
import { createDefaultPreviewSettings } from '../preview/presets'
import { EMPTY_ASSET_LIBRARY } from '../types'
import type { PreviewVideoRef } from '../preview/types'

const recast: PreviewVideoRef = {
  url: 'https://cdn.example.com/recast.mp4',
  poster: null,
  title: 'Recast',
  kind: 'recast',
  audioUrl: 'https://cdn.example.com/performance.mp4',
}

const build = (previewSettings = createDefaultPreviewSettings()) =>
  buildPreviewInput({ source: null, previewSettings, previewVideo: recast, clientForm: {}, assets: { ...EMPTY_ASSET_LIBRARY } })

describe('a silent recast plays its performance clip sound', () => {
  it('uses the recast video sound when no audio track is chosen', () => {
    expect(build().audioUrl).toBe('https://cdn.example.com/performance.mp4')
  })

  it('a chosen audio track wins', () => {
    const settings = { ...createDefaultPreviewSettings(), audio: { url: 'https://cdn.example.com/music.mp3' } } as any
    expect(build(settings).audioUrl).toBe('https://cdn.example.com/music.mp3')
  })
})
