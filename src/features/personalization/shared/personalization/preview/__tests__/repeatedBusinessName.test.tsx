// @vitest-environment jsdom
/**
 * The business name is drawn once: a headline/tagline with no text of its
 * own that would only repeat the business name already on screen is skipped,
 * and the headline falls back to real copy (CTA headline, product) first.
 */
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { PersonalizationComposition } from '../PersonalizationComposition'
import { createDefaultPreviewSettings, applyLayoutPreset } from '../presets'
import type { PreviewInputProps } from '../types'
import { buildPreviewInput } from '../../guided/buildPreviewInput'

/** Deterministic frame: every startFrame-0 layer is visible, end card faded in. */
const FRAME = 30

const REMOTE_BAD_VIDEO = 'https://cdn.example.com/bad-video.mp4'
const REMOTE_GOOD_VIDEO = 'https://cdn.example.com/good-video.mp4'
const SAME_ORIGIN_BAD_VIDEO = '/uploads/bad-clip.mp4'
const POSTER_URL = 'https://cdn.example.com/poster.jpg'

/**
 * `@remotion/media`'s <Video> renders the background for BOTH same-origin and
 * remote sources — one code path, which is also what makes it exportable by the
 * web renderer. URLs containing "bad" fail; anything else loads fine.
 */
vi.mock('@remotion/media', () => {
  const { useEffect } = require('react') as typeof import('react')

  /**
   * Mirrors the browser: media failures arrive asynchronously, after the
   * composition's mount effects have already run.
   */
  const scheduleMediaError = (
    onError: ((err: Error) => void) | undefined,
    src: string,
  ): void => {
    if (typeof onError !== 'function' || !src.includes('bad')) return
    setTimeout(() => {
      onError(new Error('MEDIA_ELEMENT_ERROR: Format error'))
    }, 0)
  }

  return {
    Video: ({ src, onError }: { src: string; onError?: (err: Error) => void }) => {
      useEffect(() => {
        scheduleMediaError(onError, src)
      }, [onError, src])
      return <div data-testid="media-video" />
    },
  }
})

vi.mock('remotion', async () => {
  return {
    AbsoluteFill: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Img: ({ src }: { src: string }) => <img src={src} alt="" />,
    Sequence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    Internals: {
      SequenceManager: {
        Provider: ({ children }: { children?: React.ReactNode }) => (
          <>{children}</>
        ),
      },
    },
    useCurrentFrame: () => FRAME,
    useVideoConfig: () => ({
      width: 1920,
      height: 1080,
      fps: 30,
      durationInFrames: 150,
    }),
    interpolate: (
      _input: number,
      _inputRange: number[],
      outputRange: number[],
    ) => outputRange[outputRange.length - 1] ?? 1,
    spring: () => 1,
    Easing: {
      out: () => (t: number) => t,
      in: () => (t: number) => t,
      inOut: () => (t: number) => t,
      bezier: () => (t: number) => t,
      back: () => (t: number) => t,
      cubic: (t: number) => t,
      quad: (t: number) => t,
      ease: (t: number) => t,
      linear: (t: number) => t,
    },
  }
})

function makeInputProps(
  overrides: Partial<PreviewInputProps> = {},
): PreviewInputProps {
  return {
    videoUrl: REMOTE_BAD_VIDEO,
    posterUrl: POSTER_URL,
    isImageSource: false,
    audioUrl: null,
    settings: createDefaultPreviewSettings(),
    brand: {
      businessName: 'Acme Roofing',
      headline: 'Roofing done right',
      offer: '',
      cta: '',
      phone: '',
      website: '',
      logoUrl: null,
      productUrl: null,
      serviceUrl: null,
    },
    ...overrides,
  }
}

const mounted: Array<{ root: ReturnType<typeof createRoot>; container: HTMLElement }> =
  []

function mountComposition(inputProps: PreviewInputProps) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ root, container })
  // If the media failure escaped as an unhandled throw, act() below would
  // reject and fail the test.
  act(() => {
    root.render(<PersonalizationComposition {...inputProps} />)
  })
  return {
    container,
    root,
    rerender: (next: PreviewInputProps) => {
      act(() => {
        root.render(<PersonalizationComposition {...next} />)
      })
    },
  }
}


afterEach(() => {
  for (const { root, container } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

const count = (text: string, needle: string) => text.split(needle).length - 1

describe('repeated business name', () => {
  it('draws the business name once when the headline would only repeat it', () => {
    const props = makeInputProps({ videoUrl: 'https://cdn.example.com/good.mp4' })
    props.brand = { ...props.brand, headline: 'Acme Roofing' }
    const { container } = mountComposition(props)
    // Same as with the headline layer switched off (the end card also shows the name).
    const hidden = { ...props, settings: { ...props.settings, layers: props.settings.layers.map((l) => (l.kind === 'headline' ? { ...l, visible: false } : l)) } }
    const { container: withoutHeadline } = mountComposition(hidden)
    expect(count(container.textContent || '', 'Acme Roofing')).toBe(count(withoutHeadline.textContent || '', 'Acme Roofing'))
    expect(props.settings.layers.some((l) => l.kind === 'headline' && l.visible)).toBe(true)
  })

  it('still draws a headline with its own copy', () => {
    const { container } = mountComposition(makeInputProps({ videoUrl: 'https://cdn.example.com/good.mp4' }))
    expect(container.textContent).toContain('Acme Roofing')
    expect(container.textContent).toContain('Roofing done right')
  })

  it('the headline falls back to the CTA headline, then the product, before the name', () => {
    const base = { source: null, previewSettings: createDefaultPreviewSettings(), previewVideo: null, assets: { identities: [], logos: [], products: [], brandReferences: [] } as any }
    expect(buildPreviewInput({ ...base, clientForm: { businessName: 'Red Zebra', ctaHeadline: 'Best burgers in town' } } as any).brand.headline).toBe('Best burgers in town')
    expect(buildPreviewInput({ ...base, clientForm: { businessName: 'Red Zebra', productService: 'Smash burgers' } } as any).brand.headline).toBe('Smash burgers')
    expect(buildPreviewInput({ ...base, clientForm: { businessName: 'Red Zebra' } } as any).brand.headline).toBe('Red Zebra')
  })

  it('a cleared text layer falls back like the editor shows it', () => {
    const props = makeInputProps({ videoUrl: 'https://cdn.example.com/good.mp4' })
    props.settings = { ...props.settings, layers: props.settings.layers.map((l) => (l.kind === 'businessName' ? { ...l, text: '' } : l)) }
    const { container } = mountComposition(props)
    expect(container.textContent).toContain('Acme Roofing')
  })

  it('the CTA color is the button color', () => {
    const props = makeInputProps({ videoUrl: 'https://cdn.example.com/good.mp4' })
    props.brand = { ...props.brand, cta: 'Book now' }
    props.settings = {
      ...props.settings,
      layers: [...props.settings.layers.filter((l) => l.kind !== 'cta'), { ...props.settings.layers[0], id: 'cta', kind: 'cta', visible: true, text: undefined, color: '#ff0000', imageUrl: undefined, startFrame: 0, animation: 'none' } as PreviewInputProps['settings']['layers'][number]],
    }
    const { container } = mountComposition(props)
    const pill = Array.from(container.querySelectorAll('span')).find((el) => el.textContent === 'Book now') as HTMLElement
    expect(pill.style.background).toMatch(/rgb\(255, 0, 0\)|#ff0000/)
  })

  it('service promotion draws a fallback headline/tagline pair once, not twice', () => {
    const props = makeInputProps({ videoUrl: 'https://cdn.example.com/good.mp4' })
    props.brand = { ...props.brand, businessName: 'Kreindler & Kreindler LLP', headline: 'Kreindler & Kreindler LLP' }
    props.settings = applyLayoutPreset({ ...props.settings, showEndCard: false }, 'service-promotion')
    const kinds = props.settings.layers.map((l) => l.kind)
    expect(kinds).toContain('headline')
    expect(kinds).toContain('tagline')
    const { container } = mountComposition(props)
    // headline and tagline both fall back to the same text: drawn once.
    expect(count(container.textContent || '', 'Kreindler & Kreindler LLP')).toBe(1)
  })

  it('a fallback headline yields to a tagline whose own text is the same', () => {
    const props = makeInputProps({ videoUrl: 'https://cdn.example.com/good.mp4' })
    props.brand = { ...props.brand, businessName: 'Acme Roofing', headline: 'Acme Roofing' }
    const base = applyLayoutPreset({ ...props.settings, showEndCard: false }, 'service-promotion')
    props.settings = {
      ...base,
      layers: base.layers.map((l) => (l.kind === 'tagline' ? { ...l, text: 'Acme Roofing' } : l)),
    }
    const { container } = mountComposition(props)
    expect(count(container.textContent || '', 'Acme Roofing')).toBe(1)
  })

  it('own text on two layers is never dropped', () => {
    const props = makeInputProps({ videoUrl: 'https://cdn.example.com/good.mp4' })
    props.brand = { ...props.brand, businessName: 'Acme Roofing', headline: 'Acme Roofing' }
    const base = applyLayoutPreset({ ...props.settings, showEndCard: false }, 'service-promotion')
    props.settings = {
      ...base,
      layers: base.layers.map((l) =>
        l.kind === 'tagline' || l.kind === 'headline' ? { ...l, text: 'Acme Roofing' } : l,
      ),
    }
    const { container } = mountComposition(props)
    expect(count(container.textContent || '', 'Acme Roofing')).toBe(2)
  })
})
