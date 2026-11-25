import { describe, expect, it } from 'vitest'
import { isSvgImageUrl, rasterizeSvgImages } from '../webExport'
import { createDefaultPreviewSettings } from '../preview/presets'
import type { PreviewInputProps } from '../preview/types'

describe('SVG images in the browser export', () => {
  it('recognises SVG files and data URLs only', () => {
    expect(isSvgImageUrl('/media/logo.svg')).toBe(true)
    expect(isSvgImageUrl('https://cdn.example.com/logo.SVG?v=2')).toBe(true)
    expect(isSvgImageUrl('data:image/svg+xml;utf8,<svg/>')).toBe(true)
    expect(isSvgImageUrl('/media/logo.png')).toBe(false)
    expect(isSvgImageUrl('https://cdn.example.com/svg-logo.png')).toBe(false)
    expect(isSvgImageUrl(null)).toBe(false)
  })

  it('returns the very same props when there is no SVG to convert', async () => {
    const inputProps: PreviewInputProps = {
      videoUrl: '/media/demo.mp4',
      posterUrl: null,
      isImageSource: false,
      audioUrl: null,
      settings: createDefaultPreviewSettings(),
      brand: {
        businessName: 'Acme', headline: '', offer: '', cta: '', phone: '', website: '',
        logoUrl: '/media/logo.png', productUrl: null, serviceUrl: null,
      },
    }
    expect(await rasterizeSvgImages(inputProps)).toBe(inputProps)
  })
})
