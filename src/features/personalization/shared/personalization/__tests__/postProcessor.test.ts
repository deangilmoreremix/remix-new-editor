// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyPostProcessing, generateEndCardImage } from '../postProcessor'

// --- Global Image mock (must be set before postProcessor is evaluated) -------------
type ImageCallbacks = {
  onload?: (() => void) | null
  onerror?: ((err: Error) => void) | null
  crossOrigin?: string
}

const imageInstances: ImageCallbacks[] = []
let imageShouldFail = false
let imageFailError = new Error('Failed to load image')

;(globalThis as any).Image = class MockImage {
  onload: (() => void) | null = null
  onerror: ((err: Error) => void) | null = null
  crossOrigin: string = ''
  width = 800
  height = 600
  naturalWidth = 800
  naturalHeight = 600

  constructor() {
    const inst: ImageCallbacks = {
      onload: null,
      onerror: null,
      crossOrigin: '',
    }
    imageInstances.push(inst)
    Object.defineProperty(this, 'onload', {
      get() { return inst.onload ?? null },
      set(v: (() => void) | null) { inst.onload = v },
    })
    Object.defineProperty(this, 'onerror', {
      get() { return inst.onerror ?? null },
      set(v: ((err: Error) => void) | null) { inst.onerror = v },
    })
    Object.defineProperty(this, 'crossOrigin', {
      get() { return inst.crossOrigin ?? '' },
      set(v: string) { inst.crossOrigin = v },
    })
  }

  set src(v: string) {
    Object.defineProperty(this, 'src', { value: v, writable: true, configurable: true })
    if (imageShouldFail) {
      queueMicrotask(() => this.onerror?.(imageFailError))
    } else {
      queueMicrotask(() => this.onload?.())
    }
  }
}

// --- document.createElement('canvas') → mock with working getContext('2d') ---------
// jsdom's native canvas has no getContext('2d') without the canvas npm package,
// so we return a mock canvas for every 'canvas' element creation.
const originalCreateElement = document.createElement.bind(document)
vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
  if (tag === 'canvas') {
    return {
      width: 0,
      height: 0,
      getContext: () => ({
        createLinearGradient: () => ({ addColorStop: () => {} }),
        drawImage: () => {},
        fillRect: () => {},
        fillText: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        quadraticCurveTo: () => {},
        closePath: () => {},
        fill: () => {},
        textAlign: '',
        textBaseline: '',
        font: '',
        fillStyle: '',
      }),
      toBlob: (cb: (b: Blob) => void) => cb(new Blob(['test'], { type: 'image/png' })),
      toDataURL: (_type?: string) => 'data:image/png;base64,dGVzdA==',
    } as any
  }
  return originalCreateElement(tag)
})

vi.mock('@ohb/packages/studio/src/muapi', () => ({
  generateI2I: vi.fn(),
  uploadFile: vi.fn(),
  processV2V: vi.fn(),
}))

const mockProcessV2V = await import('@ohb/packages/studio/src/muapi').then(m => m.processV2V) as any

describe('applyPostProcessing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    imageShouldFail = false
    imageFailError = new Error('Failed to load image')
    imageInstances.length = 0
  })

  it('applies image logo watermark via add-image-watermark', async () => {
    imageShouldFail = false

    const result = await applyPostProcessing({
      generatedUrl: 'https://example.com/generated-image.png',
      type: 'image',
      postProcessing: { logo: 'https://example.com/logo.png' },
      apiKey: 'test-key',
    })

    expect(result.finalUrl).toMatch(/^data:image\/png;base64,/)
    expect(result.applied).toContain('logo-overlay')
    expect(result.originalUrl).toBe('https://example.com/generated-image.png')
  })

  it('falls back to original image when image watermark fails', async () => {
    imageShouldFail = true
    imageFailError = new Error('Failed to load image')

    const result = await applyPostProcessing({
      generatedUrl: 'https://example.com/generated-image.png',
      type: 'image',
      postProcessing: { logo: 'https://example.com/logo.png' },
      apiKey: 'test-key',
    })

    expect(result.finalUrl).toBe('https://example.com/generated-image.png')
    expect(result.failed).toBe('logo-overlay')
    expect(result.originalUrl).toBe('https://example.com/generated-image.png')
  })

  it('applies video watermark via add-video-watermark', async () => {
    mockProcessV2V.mockResolvedValue({ url: 'https://example.com/watermarked-video.mp4' })

    const result = await applyPostProcessing({
      generatedUrl: 'https://example.com/generated-video.mp4',
      type: 'video',
      postProcessing: { logo: 'https://example.com/logo.png' },
      apiKey: 'test-key',
    })

    expect(mockProcessV2V).toHaveBeenCalledWith('test-key', expect.objectContaining({
      model: 'add-video-watermark',
      video_url: 'https://example.com/generated-video.mp4',
      image_url: 'https://example.com/logo.png',
    }))
    expect(result.finalUrl).toBe('https://example.com/watermarked-video.mp4')
    expect(result.applied).toContain('video-overlay')
  })

  it('applies multiple overlays sequentially for video', async () => {
    mockProcessV2V
      .mockResolvedValueOnce({ url: 'https://example.com/video-with-logo.mp4' })
      .mockResolvedValueOnce({ url: 'https://example.com/video-with-logo-and-cta.mp4' })

    const result = await applyPostProcessing({
      generatedUrl: 'https://example.com/generated-video.mp4',
      type: 'video',
      postProcessing: {
        logo: 'https://example.com/logo.png',
        endCard: 'https://example.com/cta-card.png',
      },
      apiKey: 'test-key',
    })

    expect(mockProcessV2V).toHaveBeenCalledTimes(2)
    expect(result.finalUrl).toBe('https://example.com/video-with-logo-and-cta.mp4')
    expect(result.applied).toEqual(['video-overlay', 'video-overlay'])
  })

  it('stops on first video overlay failure and returns current URL', async () => {
    mockProcessV2V
      .mockResolvedValueOnce({ url: 'https://example.com/video-with-logo.mp4' })
      .mockResolvedValueOnce({})

    const result = await applyPostProcessing({
      generatedUrl: 'https://example.com/generated-video.mp4',
      type: 'video',
      postProcessing: {
        logo: 'https://example.com/logo.png',
        endCard: 'https://example.com/cta-card.png',
      },
      apiKey: 'test-key',
    })

    expect(mockProcessV2V).toHaveBeenCalledTimes(2)
    expect(result.finalUrl).toBe('https://example.com/video-with-logo.mp4')
    expect(result.failed).toBe('video-overlay')
  })

  it('returns original URL when no post-processing is requested', async () => {
    const result = await applyPostProcessing({
      generatedUrl: 'https://example.com/generated.png',
      type: 'image',
      postProcessing: {},
      apiKey: 'test-key',
    })

    expect(result.finalUrl).toBe('https://example.com/generated.png')
    expect(result.originalUrl).toBe('https://example.com/generated.png')
    expect(result.applied).toEqual([])
  })
})

describe('generateEndCardImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    imageShouldFail = false
    imageFailError = new Error('Failed to load image')
    imageInstances.length = 0
  })

  it('generates a canvas end card and returns a PNG data URL', async () => {
    const result = await generateEndCardImage(
      {
        businessName: 'ABC Roofing',
        ctaHeadline: 'Limited Time Offer',
        callToAction: 'Book Now',
        offer: 'Free Roof Inspection',
        phone: '555-555-5555',
        website: 'abcroofing.com',
      },
      null,
      'test-key',
    )

    expect(result).toMatch(/^data:image\/png;base64,/)
  })

  it('skips logo when no logoFile is provided', async () => {
    const result = await generateEndCardImage(
      {
        businessName: 'Test Co',
        ctaHeadline: 'Act Now',
        callToAction: 'Click Here',
      },
      null,
      'test-key',
    )

    expect(result).toMatch(/^data:image\/png;base64,/)
  })

  it('draws logo when logoFile is provided', async () => {
    const logoFile = new Blob(['logo'], { type: 'image/png' }) as any
    ;(logoFile as any).name = 'logo.png'

    const result = await generateEndCardImage(
      {
        businessName: 'Test Co',
      },
      logoFile,
      'test-key',
    )

    expect(result).toMatch(/^data:image\/png;base64,/)
  })

  it('returns null when not in a browser environment', async () => {
    const originalWindow = (globalThis as any).window
    ;(globalThis as any).window = undefined

    const result = await generateEndCardImage(
      { businessName: 'Test' } as any,
      null,
      'test-key',
    )

    ;(globalThis as any).window = originalWindow
    expect(result).toBeNull()
  })
})
