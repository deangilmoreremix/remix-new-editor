// @vitest-environment jsdom
/**
 * AI image edits reach the video: layers showing the original image switch to
 * the edited one; Smart Edit streaming leaves no timers behind.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { retargetLayerImages } from '../DemoPersonalizeProvider'
import { createDefaultPreviewSettings, createLayer } from '../preview/presets'
import { responsesSmartEditStream } from '../image-editor/responsesVisionApi'

describe('retargetLayerImages', () => {
  it('moves every layer that showed the original image to the edited one', () => {
    const settings = createDefaultPreviewSettings({
      layers: [
        createLayer('logo', { imageUrl: 'https://cdn.example.com/logo.png' }),
        createLayer('productImage', { imageUrl: 'https://cdn.example.com/other.png' }),
        createLayer('headline'),
      ],
    })
    const next = retargetLayerImages(settings, ['https://cdn.example.com/logo.png', 'blob:old'], 'blob:edited')
    expect(next.layers[0].imageUrl).toBe('blob:edited')
    expect(next.layers[1].imageUrl).toBe('https://cdn.example.com/other.png')
    expect(next.layers[2].imageUrl).toBeUndefined()
  })

  it('returns the same settings when no layer used the image', () => {
    const settings = createDefaultPreviewSettings()
    expect(retargetLayerImages(settings, ['https://cdn.example.com/none.png'], 'blob:edited')).toBe(settings)
  })
})

describe('Smart Edit streaming', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('finishes with the final image and no timers left running', async () => {
    vi.useFakeTimers()
    const final = { type: 'response.completed', response: { id: 'resp_1', output: [{ type: 'image_generation_call', id: 'ig_1', result: 'QUJD' }] } }
    const body = [
      `data: ${JSON.stringify({ type: 'response.image_generation_call.partial_image', partial_image_b64: 'UEFS', partial_image_index: 0 })}\n\n`,
      `data: ${JSON.stringify(final)}\n\n`,
    ]
    let i = 0
    const reader = {
      read: async () => (i < body.length ? { value: new TextEncoder().encode(body[i++]), done: false } : { value: undefined, done: true }),
      cancel: async () => {},
    }
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, body: { getReader: () => reader } })))
    const partials: string[] = []

    const result = await responsesSmartEditStream(
      { imageUrl: 'data:image/png;base64,AA', prompt: 'brighter', imageModel: 'gpt-image-2.5-flare' },
      (url) => partials.push(url),
    )

    expect(partials).toEqual(['data:image/png;base64,UEFS'])
    expect(result.imageDataUrl).toBe('data:image/png;base64,QUJD')
    expect(vi.getTimerCount()).toBe(0)
  })
})
