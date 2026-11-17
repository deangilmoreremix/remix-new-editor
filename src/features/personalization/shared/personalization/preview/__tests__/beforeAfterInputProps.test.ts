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

  it('shows the footage as it was: no look, no background removal, no captions', () => {
    const edited = {
      videoUrl: 'https://cdn.example.com/a.mp4',
      settings: { layers: [], showEndCard: true, look: { preset: 'noir' }, cutout: { enabled: true }, captions: { enabled: true } },
    } as unknown as PreviewInputProps
    const before = buildBeforeInputProps(edited)
    expect(before.settings.look).toBeUndefined()
    expect(before.settings.cutout).toBeUndefined()
    expect(before.settings.captions).toBeUndefined()
    // the edited props are untouched, so the After pane keeps them
    expect(edited.settings.look).toBeTruthy()
  })
})
