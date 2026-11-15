// @vitest-environment jsdom
/**
 * Media-failure resilience for the shared personalization preview composition.
 *
 * Unusual remote video URLs (codec/network/CORS restrictions) make the browser
 * fire a MEDIA_ELEMENT_ERROR on the underlying media element. The composition
 * must catch that through the media component's onError prop and degrade to the
 * same static fallback used when no video is selected — never throwing, and
 * never dropping the branding overlays rendered on top of the background.
 */
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { PersonalizationComposition } from '../PersonalizationComposition'
import { createDefaultPreviewSettings, createLayer } from '../presets'
import type { PreviewInputProps, PreviewLayer } from '../types'

/** Deterministic frame: every startFrame-0 layer is visible, end card faded in. */
let FRAME = 30

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
    // The real easing functions: some upstream designs build eased curves
    // when their module loads, so a stub would crash the import.
    Easing: (await vi.importActual<typeof import('remotion')>('remotion')).Easing,
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

/** Flushes the mocked async media error event. */
async function flushMediaError() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10))
  })
}

afterEach(() => {
  while (mounted.length > 0) {
    const { root, container } = mounted.pop()!
    act(() => root.unmount())
    container.remove()
  }
})

describe('PersonalizationComposition media failure', () => {
  it('falls back to the poster image when the remote <Video> errors, keeping overlays', async () => {
    const view = mountComposition(makeInputProps())
    expect(view.container.querySelector('[data-testid="media-video"]')).not.toBeNull()

    await flushMediaError()

    expect(view.container.querySelector('[data-testid="media-video"]')).toBeNull()
    expect(
      view.container.querySelector(`img[src="${POSTER_URL}"]`),
    ).not.toBeNull()
    // Branding overlay layers still render on top of the fallback.
    expect(view.container.textContent).toContain('Roofing done right')
  })

  it('falls back to the neutral placeholder panel when a same-origin video errors without a poster', async () => {
    const view = mountComposition(
      makeInputProps({
        videoUrl: SAME_ORIGIN_BAD_VIDEO,
        posterUrl: null,
      }),
    )
    expect(
      view.container.querySelector('[data-testid="media-video"]'),
    ).not.toBeNull()

    await flushMediaError()

    expect(
      view.container.querySelector('[data-testid="media-video"]'),
    ).toBeNull()
    expect(view.container.textContent).toContain(
      'Select a video or image to preview your branding',
    )
    expect(view.container.textContent).toContain('Roofing done right')
  })

  it('clears a recorded failure when the selected video changes', async () => {
    const view = mountComposition(makeInputProps())
    await flushMediaError()
    // Failure is showing the fallback: no media element, poster in its place.
    expect(view.container.querySelector('[data-testid="media-video"]')).toBeNull()
    expect(
      view.container.querySelector(`img[src="${POSTER_URL}"]`),
    ).not.toBeNull()

    view.rerender(makeInputProps({ videoUrl: REMOTE_GOOD_VIDEO }))

    // The healthy selection renders the video again instead of staying stuck
    // on the fallback.
    expect(view.container.querySelector('[data-testid="media-video"]')).not.toBeNull()
    expect(view.container.querySelector(`img[src="${POSTER_URL}"]`)).toBeNull()
  })
})

describe('layer rotation in the composition', () => {
  const withLayers = (layers: PreviewLayer[], brand: Partial<PreviewInputProps['brand']> = {}) => {
    const settings = { ...createDefaultPreviewSettings({ showEndCard: false }), layers }
    const base = makeInputProps()
    return makeInputProps({ settings, videoUrl: null, isImageSource: true, brand: { ...base.brand, ...brand } })
  }

  it('rotates a text layer on its own text element, about its center', () => {
    const { container } = mountComposition(withLayers([{ ...createLayer('headline'), text: 'Hello rotated', rotation: 20 }]))
    const rotated = [...container.querySelectorAll('[style*="rotate(20deg)"]')] as HTMLElement[]
    const text = rotated.find((e) => e.textContent?.includes('Hello'))!
    expect(text).toBeTruthy()
    expect(text.style.transformOrigin).toBe('center center')
    // its accent rule is carried along (and is the only other rotated element)
    const rule = rotated.find((e) => !e.textContent)!
    expect(rule).toBeTruthy()
    expect(rule.style.transform).toBe('rotate(20deg)')
    expect(rotated).toHaveLength(2)
  })

  it('keeps the centering translate and the rotation in one transform, translate first', () => {
    const { container } = mountComposition(withLayers([{ ...createLayer('tagline'), text: 'Short', rotation: -12 }]))
    const el = container.querySelector('[style*="rotate(-12deg)"]') as HTMLElement
    expect(el).toBeTruthy()
    expect(el.style.transform).toBe('translateX(-50%) rotate(-12deg)')
  })

  it('rotates the CTA pill', () => {
    const { container } = mountComposition(withLayers([{ ...createLayer('cta'), text: 'Book now', rotation: -10 }]))
    const pill = container.querySelector('[style*="rotate(-10deg)"]') as HTMLElement
    expect(pill).toBeTruthy()
    expect(pill.textContent).toBe('Book now')
  })

  // Image wrappers and design layers are covered by the real web-renderer stills (this file's AbsoluteFill mock drops `style`).

  it('draws nothing rotated when no layer is rotated', () => {
    const { container } = mountComposition(withLayers([{ ...createLayer('headline'), text: 'Plain' }, createLayer('cta', { text: 'Go' })]))
    expect(container.innerHTML).not.toContain('rotate(')
  })
})

describe('burned-in captions', () => {
  const cues = [
    { startMs: 500, endMs: 1500, text: 'Call us today', words: [{ text: 'Call', startMs: 500, endMs: 800 }, { text: 'us', startMs: 800, endMs: 1100 }, { text: 'today', startMs: 1100, endMs: 1500 }] },
  ]
  const withCaptions = (over: Record<string, unknown> = {}, frame = 30) => {
    FRAME = frame
    const settings = { ...createDefaultPreviewSettings(), fps: 30, durationInFrames: 150, captions: { enabled: true, forUrl: REMOTE_GOOD_VIDEO, style: 'bold' as const, position: 'bottom' as const, cues, ...over } }
    return makeInputProps({ videoUrl: REMOTE_GOOD_VIDEO, settings })
  }
  const layer = (c: HTMLElement) => c.querySelector('[data-testid="captions-layer"]')
  afterEach(() => { FRAME = 30 })

  it('draws the line being spoken, with the current word picked out', () => {
    const { container } = mountComposition(withCaptions({}, 30)) // 1000 ms: "us" is being spoken
    expect(layer(container)?.getAttribute('data-caption-text')).toBe('Call us today')
    const spans = [...layer(container)!.querySelectorAll('span')]
    expect(spans.map((s) => s.textContent?.trim())).toEqual(['Call', 'us', 'today'])
    expect(spans[1].style.color).not.toBe(spans[0].style.color)
  })
  it('draws nothing between lines, when switched off, or before they start', () => {
    expect(layer(mountComposition(withCaptions({}, 90)).container)).toBeNull() // 3000 ms: after the cue
    expect(layer(mountComposition(withCaptions({}, 3)).container)).toBeNull() // 100 ms: before it
    expect(layer(mountComposition(withCaptions({ enabled: false }, 30)).container)).toBeNull()
  })
  it('never draws over a different video than the one they were written for', () => {
    expect(layer(mountComposition(withCaptions({ forUrl: 'https://cdn.example.com/other.mp4' }, 30)).container)).toBeNull()
  })
  it('hides during the end card', () => {
    const input = withCaptions({ cues: [{ startMs: 0, endMs: 9000, text: 'Long line' }] }, 120) // end card starts at frame 105 of 150
    expect(layer(mountComposition(input).container)).toBeNull()
    const early = withCaptions({ cues: [{ startMs: 0, endMs: 9000, text: 'Long line' }] }, 60)
    expect(layer(mountComposition(early).container)?.getAttribute('data-caption-text')).toBe('Long line')
  })
  it('works in the plain styles too (no per-word colouring)', () => {
    const { container } = mountComposition(withCaptions({ style: 'bar' }, 30))
    expect(layer(container)?.querySelectorAll('span').length).toBe(0)
    expect(layer(container)?.textContent).toBe('Call us today')
  })
})
