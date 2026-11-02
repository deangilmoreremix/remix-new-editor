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
import { createDefaultPreviewSettings } from '../presets'
import type { PreviewInputProps } from '../types'

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
    Easing: { out: () => (t: number) => t, cubic: 0 },
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
