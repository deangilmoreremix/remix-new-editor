import { describe, it, expect } from 'vitest'
import { SHARPEN_BELOW_PX, blobToFile, fileToFileList, sharpenedFileName, shouldOfferSharpen } from '../imageUpscale'

describe('shouldOfferSharpen', () => {
  it('offers small pictures, not big ones, not icons, not vectors', () => {
    expect(shouldOfferSharpen(300, 200)).toBe(true)
    expect(shouldOfferSharpen(SHARPEN_BELOW_PX - 1, 100)).toBe(true)
    expect(shouldOfferSharpen(SHARPEN_BELOW_PX, 100)).toBe(false)
    expect(shouldOfferSharpen(1920, 1080)).toBe(false)
    expect(shouldOfferSharpen(16, 16)).toBe(false)
    expect(shouldOfferSharpen(200, 200, 'image/svg+xml')).toBe(false)
    expect(shouldOfferSharpen(undefined, undefined, 'data:image/svg+xml;base64,AAA')).toBe(false)
  })
  it('offers a picture whose size is not known yet', () => {
    expect(shouldOfferSharpen(undefined, undefined, 'image/png')).toBe(true)
    expect(shouldOfferSharpen(0, 0)).toBe(true)
  })
})

describe('names and files', () => {
  it('names the copy as a PNG and does not stack suffixes', () => {
    expect(sharpenedFileName('logo.jpg')).toBe('logo-sharper.png')
    expect(sharpenedFileName('logo-sharper.png')).toBe('logo-sharper.png')
    expect(sharpenedFileName('')).toBe('image-sharper.png')
  })
  it('wraps a blob as an image file', () => {
    const f = blobToFile(new Blob(['x'], { type: 'image/png' }), 'a.png')
    expect(f).toBeInstanceOf(File); expect(f.type).toBe('image/png'); expect(f.name).toBe('a.png')
  })
  it('returns null (so the caller falls back to a URL) where a FileList cannot be built', () => {
    const saved = (globalThis as { DataTransfer?: unknown }).DataTransfer
    ;(globalThis as { DataTransfer?: unknown }).DataTransfer = undefined
    expect(fileToFileList(new File(['x'], 'a.png'))).toBeNull()
    ;(globalThis as { DataTransfer?: unknown }).DataTransfer = saved
  })
})
