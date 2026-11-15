import { describe, expect, it } from 'vitest'
import { buildBeforeInputProps } from '../BeforeAfterPreview'
import type { PreviewInputProps } from '../types'

const props = {
  videoUrl: 'https://cdn.example.com/recast.mp4',
  settings: { layers: [{ id: 'logo', visible: true }], showEndCard: true },
} as unknown as PreviewInputProps

describe('buildBeforeInputProps', () => {
  it('shows the same video without overlays by default', () => {
    const before = buildBeforeInputProps(props)
    expect(before.videoUrl).toBe('https://cdn.example.com/recast.mp4')
    expect(before.settings.layers.every((layer) => !layer.visible)).toBe(true)
    expect(before.settings.showEndCard).toBe(false)
  })

  it('shows the original video when the after video replaced it (Full Body Recast)', () => {
    const before = buildBeforeInputProps(props, 'https://cdn.example.com/original.mp4')
    expect(before.videoUrl).toBe('https://cdn.example.com/original.mp4')
    expect(props.videoUrl).toBe('https://cdn.example.com/recast.mp4')
  })
})
