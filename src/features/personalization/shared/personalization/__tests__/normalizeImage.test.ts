// @vitest-environment jsdom
/**
 * Discovered assets reach the image models re-encoded as PNG, scaled so the
 * longest side is at most NORMALIZED_MAX_DIMENSION.
 */
import { describe, expect, it, vi, afterEach } from 'vitest'
import { ensureModelSupportedImage, normalizeImageDataUrl, NORMALIZED_MAX_DIMENSION } from '../image-editor/normalizeImage'

function stubImage(width: number, height: number, fail = false) {
  class FakeImage {
    naturalWidth = width
    naturalHeight = height
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    set src(_value: string) {
      queueMicrotask(() => (fail ? this.onerror?.() : this.onload?.()))
    }
  }
  vi.stubGlobal('Image', FakeImage)
}

function stubCanvas() {
  const drawImage = vi.fn()
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }), toDataURL: vi.fn(() => 'data:image/png;base64,AAAA') }
  const original = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => (tag === 'canvas' ? canvas : original(tag))) as typeof document.createElement)
  return canvas
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('normalizeImageDataUrl', () => {
  it('re-encodes an SVG logo as PNG', async () => {
    stubImage(300, 100)
    const canvas = stubCanvas()

    const out = await normalizeImageDataUrl('data:image/svg+xml;base64,PHN2Zy8+')

    expect(out.startsWith('data:image/png')).toBe(true)
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/png')
    expect([canvas.width, canvas.height]).toEqual([300, 100])
  })

  it('scales a large photo down to the maximum dimension', async () => {
    stubImage(6000, 4000)
    const canvas = stubCanvas()

    await normalizeImageDataUrl('data:image/jpeg;base64,AAAA')

    expect(canvas.width).toBe(NORMALIZED_MAX_DIMENSION)
    expect(canvas.height).toBe(Math.round(4000 * (NORMALIZED_MAX_DIMENSION / 6000)))
  })

  it('gives an SVG with no intrinsic size a usable canvas', async () => {
    stubImage(0, 0)
    const canvas = stubCanvas()

    await normalizeImageDataUrl('data:image/svg+xml;base64,PHN2Zy8+')

    expect([canvas.width, canvas.height]).toEqual([NORMALIZED_MAX_DIMENSION, NORMALIZED_MAX_DIMENSION])
  })

  it('reports an image the browser cannot decode in plain words', async () => {
    stubImage(0, 0, true)
    stubCanvas()

    await expect(normalizeImageDataUrl('data:image/png;base64,bm90IGFuIGltYWdl')).rejects.toThrow('could not be read')
  })
})

describe('normalizeImageDataUrl without a size cap (masked edits)', () => {
  it('keeps the natural size so a mask drawn at that size still matches', async () => {
    stubImage(4000, 3000)
    const canvas = stubCanvas()

    await normalizeImageDataUrl('data:image/jpeg;base64,AAAA', Number.POSITIVE_INFINITY)

    expect([canvas.width, canvas.height]).toEqual([4000, 3000])
  })
})

describe('ensureModelSupportedImage', () => {
  it('leaves a supported JPEG untouched so it keeps its size and compression', async () => {
    const jpeg = 'data:image/jpeg;base64,AAAA'
    stubImage(4000, 3000)
    const canvas = stubCanvas()

    expect(await ensureModelSupportedImage(jpeg)).toBe(jpeg)
    expect(canvas.toDataURL).not.toHaveBeenCalled()
  })

  it('re-encodes an SVG at its natural size', async () => {
    stubImage(800, 200)
    const canvas = stubCanvas()

    const out = await ensureModelSupportedImage('data:image/svg+xml;base64,PHN2Zy8+')

    expect(out.startsWith('data:image/png')).toBe(true)
    expect([canvas.width, canvas.height]).toEqual([800, 200])
  })
})

describe('an SVG with no intrinsic size and no size cap', () => {
  it('still gets a finite canvas', async () => {
    stubImage(0, 0)
    const canvas = stubCanvas()

    await ensureModelSupportedImage('data:image/svg+xml;base64,PHN2Zy8+')

    expect([canvas.width, canvas.height]).toEqual([NORMALIZED_MAX_DIMENSION, NORMALIZED_MAX_DIMENSION])
  })
})
