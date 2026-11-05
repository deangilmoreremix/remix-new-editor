import { describe, expect, it } from 'vitest'
import { isImageEditSupported } from '../image-editor/imageEditSupport'

describe('isImageEditSupported', () => {
  it('accepts explicit image mime types', () => {
    expect(isImageEditSupported({ mimeType: 'image/png' })).toBe(true)
    expect(isImageEditSupported({ mimeType: 'image/jpeg' })).toBe(true)
    expect(isImageEditSupported({ mimeType: 'image/webp' })).toBe(true)
    expect(isImageEditSupported({ mimeType: 'image/gif' })).toBe(true)
    expect(isImageEditSupported({ mimeType: 'image/svg+xml' })).toBe(true)
    expect(isImageEditSupported({ mimeType: 'application/pdf' })).toBe(false)
  })

  it('accepts data URLs with image mime types', () => {
    expect(isImageEditSupported({ editedDataUrl: 'data:image/png;base64,AA==' })).toBe(true)
    expect(isImageEditSupported({ editedDataUrl: 'data:image/jpeg;base64,AA==' })).toBe(true)
    expect(isImageEditSupported({ editedDataUrl: 'data:image/webp;base64,AA==' })).toBe(true)
    expect(isImageEditSupported({ editedDataUrl: 'data:image/svg+xml;base64,AA==' })).toBe(true)
    expect(isImageEditSupported({ editedDataUrl: 'data:application/pdf;base64,AA==' })).toBe(false)
  })

  it('accepts URLs with query parameters', () => {
    expect(isImageEditSupported({ url: 'https://example.com/one.jpg?w=100&h=200' })).toBe(true)
    expect(isImageEditSupported({ previewUrl: 'https://cdn.example.com/image.png?fit=max' })).toBe(true)
    expect(isImageEditSupported({ url: 'https://example.com/document.pdf?download=1' })).toBe(false)
  })

  it('accepts extensionless image-proxy assets when path has image extension', () => {
    expect(isImageEditSupported({ url: '/_next/image?url=/one.jpg' })).toBe(true)
    expect(isImageEditSupported({ url: '/_next/image?url=/two.webp' })).toBe(true)
  })

  it('rejects blob URLs and empty candidates', () => {
    expect(isImageEditSupported({ url: 'blob:http://localhost/abc' })).toBe(false)
    expect(isImageEditSupported({})).toBe(false)
    expect(isImageEditSupported({ url: '' })).toBe(false)
  })

  it('falls back across editedDataUrl, url, and previewUrl', () => {
    expect(isImageEditSupported({ previewUrl: 'data:image/png;base64,AA==' })).toBe(true)
    expect(isImageEditSupported({ url: 'https://example.com/photo.jpg' })).toBe(true)
  })
})
