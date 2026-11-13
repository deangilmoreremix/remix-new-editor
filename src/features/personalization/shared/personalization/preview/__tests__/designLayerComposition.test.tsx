// @vitest-environment jsdom
/**
 * The design layer of the shared personalization preview composition.
 *
 * A registered Remotion design must be mounted as its own component, inside
 * the layer's box, with the resolved brand values — and an unregistered
 * design must render nothing at all (and warn only once).
 */
import React from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { PersonalizationComposition } from '../PersonalizationComposition'
import { applyDesignTemplate, createDefaultPreviewSettings } from '../presets'
import { __resetRemotionDesignRegistry, registerRemotionDesignTemplate } from '../../templates/registry'
import type { RemotionDesignComponent, RemotionDesignComponentProps } from '../../templates/types'
import type { PreviewInputProps } from '../types'

/** Deterministic frame: the layer's startFrame is 0, so it is visible. */
const FRAME = 30

vi.mock('@remotion/media', () => ({
  Video: () => <div data-testid="media-video" />,
  Audio: () => null,
}))

vi.mock('remotion', async () => {
  return {
    AbsoluteFill: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    // A stand-in for Remotion's `<Img/>`, which needs a registered composition.
    // It is a plain `<img>` on purpose — the rule is disabled for this ONE
    // line, not for the file and not for the project.
    // eslint-disable-next-line @next/next/no-img-element
    Img: ({ src }: { src: string }) => <img src={src} alt="" />,
    Sequence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    Internals: {
      SequenceManager: {
        Provider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
      },
    },
    useCurrentFrame: () => FRAME,
    useVideoConfig: () => ({ width: 1920, height: 1080, fps: 30, durationInFrames: 150 }),
    interpolate: (
      _input: number,
      _inputRange: number[],
      outputRange: number[],
    ) => outputRange[outputRange.length - 1] ?? 1,
    spring: () => 1,
    // The real easing functions: some upstream designs build eased curves
    // when their module loads, so a stub would crash the import.
    Easing: (await vi.importActual<typeof import('remotion')>('remotion')).Easing,
  }
})

/** Records the props the composition handed to the design component. */
const received: RemotionDesignComponentProps[] = []

const Design: RemotionDesignComponent = (props) => {
  received.push(props)
  return <div data-testid="design-layer">design</div>
}

function registerFixture() {
  registerRemotionDesignTemplate({
    id: 'fixture-design',
    name: 'Fixture design',
    description: 'A design used by the composition test.',
    category: 'animated-headline',
    source: {
      repository: 'example/repo',
      repositoryUrl: 'https://example.com/example/repo',
      sourcePath: 'src/Design.tsx',
      license: 'MIT',
      attribution: 'Example attribution',
    },
    component: Design,
    textSlots: [
      { key: 'headline', field: 'headline', label: 'Headline', primary: true },
      { key: 'business', field: 'businessName', label: 'Business name' },
    ],
    colors: [{ role: 'primary', label: 'Primary' }],
    media: [{ role: 'logo', label: 'Logo', required: true }],
    animation: { durationInFrames: 30, delayInFrames: 0, easing: 'ease-out' },
    placement: { x: 0.5, y: 0.5, scale: 0.8, opacity: 1, animation: 'none' },
    aspectRatios: ['16:9', '1:1'],
    requiredMedia: ['logo'],
    capabilities: { preview: true, browserExport: true },
    previewCompatible: true,
  })
}

function makeInputProps(
  overrides: Partial<PreviewInputProps> = {},
): PreviewInputProps {
  return {
    videoUrl: 'https://cdn.example.com/clip.mp4',
    posterUrl: 'https://cdn.example.com/poster.jpg',
    isImageSource: false,
    audioUrl: null,
    settings: createDefaultPreviewSettings(),
    brand: {
      businessName: 'Acme Roofing',
      headline: 'Roofing done right',
      offer: '20% off',
      cta: 'Book now',
      phone: '',
      website: '',
      logoUrl: 'https://cdn.example.com/logo.png',
      productUrl: null,
      serviceUrl: null,
    },
    ...overrides,
  }
}

const mounted: Array<{ root: ReturnType<typeof createRoot>; container: HTMLElement }> = []

function mountComposition(inputProps: PreviewInputProps) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ root, container })
  act(() => {
    root.render(<PersonalizationComposition {...inputProps} />)
  })
  return container
}

beforeEach(() => {
  received.length = 0
  __resetRemotionDesignRegistry()
})

afterEach(() => {
  while (mounted.length > 0) {
    const { root, container } = mounted.pop()!
    act(() => root.unmount())
    container.remove()
  }
  __resetRemotionDesignRegistry()
  vi.restoreAllMocks()
})

describe('PersonalizationComposition design layer', () => {
  it('mounts the registered design component with the resolved brand values', () => {
    registerFixture()
    const settings = applyDesignTemplate(
      createDefaultPreviewSettings(),
      'fixture-design',
      { headline: 'Roofing done right', businessName: 'Acme Roofing' },
    )

    const container = mountComposition(makeInputProps({ settings }))

    expect(container.querySelector('[data-testid="design-layer"]')).not.toBeNull()
    expect(received).toHaveLength(1)

    const props = received[0]
    // The primary slot carries what the customer typed on the layer.
    expect(props.text).toBe('Roofing done right')
    expect(props.textSlots).toEqual({
      headline: 'Roofing done right',
      business: 'Acme Roofing',
    })
    expect(props.colors).toEqual({
      primary: '#d9ff00',
      accent: '#28c98b',
      text: '#ffffff',
      backgroundDim: 0.18,
    })
    expect(props.media).toEqual({ logo: 'https://cdn.example.com/logo.png' })
    expect(props.width).toBe(1920)
    expect(props.height).toBe(1080)
    expect(props.fps).toBe(30)
    expect(props.opacity).toBe(1)
    expect(props.color).toBe('#ffffff')
    // The design box is a scaled copy of the composition.
    expect(props.box.widthPx).toBe(Math.round(0.8 * 1920))
    expect(props.box.heightPx).toBe(Math.round(0.8 * 1080))
  })

  it('lets the layer text override the primary slot', () => {
    registerFixture()
    const settings = applyDesignTemplate(
      createDefaultPreviewSettings(),
      'fixture-design',
      { headline: 'From the brand' },
    )
    settings.layers = settings.layers.map((layer) => ({ ...layer, text: 'Typed by the customer' }))

    mountComposition(makeInputProps({ settings }))

    expect(received[0].text).toBe('Typed by the customer')
    expect(received[0].textSlots.headline).toBe('Typed by the customer')
  })

  it('renders nothing and warns once for an unregistered design', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const settings = createDefaultPreviewSettings()
    settings.layers = [
      {
        id: 'design',
        kind: 'design',
        visible: true,
        x: 0.5,
        y: 0.5,
        scale: 1,
        animation: 'none',
        animationDelay: 0,
        startFrame: 0,
        opacity: 1,
        designId: 'not-registered',
      },
    ]

    const container = mountComposition(makeInputProps({ settings }))

    expect(container.querySelector('[data-testid="design-layer"]')).toBeNull()
    expect(received).toHaveLength(0)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain('not-registered')
  })
})
