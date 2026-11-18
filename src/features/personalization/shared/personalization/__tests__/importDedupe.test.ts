import { describe, it, expect } from 'vitest'
import { findAlreadyImported, normalizeImageAddress } from '../backgroundRemoval/importDedupe'

const item = (id: string, url: string, cut = false) => ({
  id,
  previewUrl: url,
  originalPreviewUrl: url,
  editedDataUrl: cut ? 'data:image/png;base64,AAAA' : undefined,
  edited: cut,
  editMetadata: cut ? ({ operation: 'remove_background', engine: 'bg0' } as never) : undefined,
})

describe('normalizeImageAddress', () => {
  it('ignores hash, tracking params, param order and a trailing slash', () => {
    const a = normalizeImageAddress('https://shop.example/a.jpg?b=2&a=1&utm_source=x#frag')
    const b = normalizeImageAddress('https://shop.example/a.jpg?a=1&b=2')
    expect(a).toBe(b)
  })
  it('has no address for data/blob/invalid urls', () => {
    expect(normalizeImageAddress('data:image/png;base64,AA')).toBeNull()
    expect(normalizeImageAddress('blob:https://x/1')).toBeNull()
    expect(normalizeImageAddress('not a url')).toBeNull()
  })
})

describe('findAlreadyImported', () => {
  it('skips a picture already in the library', () => {
    const skip = findAlreadyImported([item('d1', 'https://shop.example/logo.png')], [
      { url: 'https://shop.example/logo.png', originalUrl: 'https://shop.example/logo.png' },
    ])
    expect([...skip]).toEqual(['d1'])
  })
  it('matches the same picture with tracking params', () => {
    const skip = findAlreadyImported([item('d1', 'https://shop.example/p.jpg?utm_campaign=a')], [
      { url: 'https://shop.example/p.jpg' },
    ])
    expect([...skip]).toEqual(['d1'])
  })
  it('keeps a cutout whose library copy is the untouched original (keep both)', () => {
    const skip = findAlreadyImported([item('d1', 'https://shop.example/p.jpg', true)], [
      { url: 'https://shop.example/p.jpg', originalUrl: 'https://shop.example/p.jpg' },
    ])
    expect(skip.size).toBe(0)
  })
  it('skips a cutout already in the library as a cutout', () => {
    const skip = findAlreadyImported([item('d1', 'https://shop.example/p.jpg', true)], [
      { url: 'https://cdn/x.png', uploadedUrl: 'https://cdn/x.png', originalUrl: 'https://shop.example/p.jpg', editedDataUrl: 'data:image/png;base64,AAAA', edited: true, editMetadata: { operation: 'remove_background', engine: 'bg0' } as never },
    ])
    expect([...skip]).toEqual(['d1'])
  })
  it('keeps only the first of two same-picture items in one import', () => {
    const skip = findAlreadyImported(
      [item('d1', 'https://shop.example/p.jpg'), item('d2', 'https://shop.example/p.jpg?utm_x=1'), item('d3', 'https://shop.example/q.jpg')],
      [],
    )
    expect([...skip]).toEqual(['d2'])
  })
  it('never skips an item with no usable address', () => {
    expect(findAlreadyImported([item('d1', 'blob:https://x/1')], [{ url: 'blob:https://x/1' }]).size).toBe(0)
  })
  it('keeps a new cutout when the library copy is an AI-edited variant, not a cutout', () => {
    const skip = findAlreadyImported([item('d1', 'https://shop.example/p.jpg', true)], [
      { url: 'https://cdn/x.png', originalUrl: 'https://shop.example/p.jpg', editedDataUrl: 'data:image/png;base64,BBBB', edited: true, editMetadata: { operation: 'edit', engine: 'ai' } as never },
    ])
    expect(skip.size).toBe(0)
  })
  it('never drops an AI-edited discovered variant of a picture already in the library', () => {
    const edited = { id: 'd1', previewUrl: 'https://shop.example/p.jpg', originalPreviewUrl: 'https://shop.example/p.jpg', editedDataUrl: 'data:image/png;base64,CCCC', edited: true, editMetadata: { operation: 'edit', engine: 'ai' } as never }
    const skip = findAlreadyImported([edited, { ...edited, id: 'd2' }], [{ url: 'https://shop.example/p.jpg', originalUrl: 'https://shop.example/p.jpg' }])
    expect(skip.size).toBe(0)
  })
})
