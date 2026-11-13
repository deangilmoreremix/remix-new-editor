/**
 * The end card must stack above every overlay layer.
 *
 * Layers carry z-indices up to `stackOrder * 100 + 99` (see `layerZIndex`), so an
 * end card without its own stacking level would be painted underneath layers that
 * stay visible through the last frames.
 */
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { PersonalizationComposition } from '../PersonalizationComposition'
import { createDefaultPreviewSettings } from '../presets'
import { layerZIndex, MEDIA_ROLE_CONTRACTS, type OverlayMediaRole } from '../mediaRoles'
import type { PreviewInputProps } from '../types'

const sequenceStyles: Array<React.CSSProperties | undefined> = []

vi.mock('@remotion/media', () => ({ Video: () => <div data-testid="media-video" /> }))

vi.mock('remotion', () => ({
  AbsoluteFill: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Img: ({ src }: { src: string }) => <img src={src} alt="" />,
  Sequence: ({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) => {
    sequenceStyles.push(style)
    return <>{children}</>
  },
  Internals: { SequenceManager: { Provider: ({ children }: { children?: React.ReactNode }) => <>{children}</> } },
  useCurrentFrame: () => 30,
  useVideoConfig: () => ({ width: 1920, height: 1080, fps: 30, durationInFrames: 150 }),
  interpolate: (_i: number, _r: number[], out: number[]) => out[out.length - 1] ?? 1,
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
}))

const mounted: Array<{ root: ReturnType<typeof createRoot>; container: HTMLElement }> = []

afterEach(() => {
  sequenceStyles.length = 0
  for (const { root, container } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

function props(showEndCard: boolean): PreviewInputProps {
  return {
    videoUrl: 'https://cdn.example.com/video.mp4',
    posterUrl: null,
    isImageSource: false,
    audioUrl: null,
    settings: { ...createDefaultPreviewSettings(), showEndCard },
    brand: {
      businessName: 'Acme Roofing',
      headline: 'Roofing done right',
      offer: '',
      cta: 'Call now',
      phone: '555-0100',
      website: 'acme.example',
      logoUrl: null,
      productUrl: null,
      serviceUrl: null,
    },
  }
}

function mount(inputProps: PreviewInputProps) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ root, container })
  act(() => {
    root.render(<PersonalizationComposition {...inputProps} />)
  })
}

describe('end card stacking', () => {
  it('gives the end card a stacking level above the highest possible layer', () => {
    mount(props(true))
    const highestLayer = Math.max(
      ...(Object.keys(MEDIA_ROLE_CONTRACTS) as OverlayMediaRole[]).map((role) => layerZIndex(role, 99)),
    )
    const zIndexes = sequenceStyles.map((style) => style?.zIndex).filter((z): z is number => typeof z === 'number')
    expect(zIndexes.length).toBeGreaterThan(0)
    expect(Math.min(...zIndexes)).toBeGreaterThan(highestLayer)
  })

  it('adds no end-card sequence when the end card is off', () => {
    mount(props(false))
    expect(sequenceStyles.filter((style) => typeof style?.zIndex === 'number')).toHaveLength(0)
  })
})
