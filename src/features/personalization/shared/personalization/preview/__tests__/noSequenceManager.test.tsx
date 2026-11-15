// @vitest-environment jsdom
/**
 * Newer remotion (4.0.5xx) has no `Internals.SequenceManager`. The composition used to read
 * `Internals.SequenceManager.Provider` unconditionally, which crashed the window's preview and
 * its browser export in a real browser. It must render with or without that provider.
 */
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { PersonalizationComposition } from '../PersonalizationComposition'
import { createDefaultPreviewSettings } from '../presets'

vi.mock('@remotion/media', () => ({ Video: () => <div data-testid="media-video" />, Audio: () => null }))
vi.mock('remotion', async () => ({
  AbsoluteFill: ({ children }: { children?: React.ReactNode }) => <div data-testid="fill">{children}</div>,
  Img: ({ src }: { src: string }) => <img src={src} alt="" />,
  Sequence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  // exactly the shape of remotion 4.0.540: there is no `SequenceManager` here
  Internals: { SequenceManagerProvider: () => null },
  useCurrentFrame: () => 10,
  useVideoConfig: () => ({ width: 1920, height: 1080, fps: 30, durationInFrames: 150 }),
  interpolate: (_i: number, _r: number[], out: number[]) => out[out.length - 1] ?? 1,
  spring: () => 1,
  Easing: (await vi.importActual<typeof import('remotion')>('remotion')).Easing,
}))

const brand = { businessName: 'Acme', headline: 'Hello', offer: '', cta: '', phone: '', website: '', logoUrl: null, productUrl: null, serviceUrl: null }
const mounted: Array<{ root: ReturnType<typeof createRoot>; container: HTMLElement }> = []
afterEach(() => { mounted.splice(0).forEach(({ root, container }) => { act(() => root.unmount()); container.remove() }) })

describe('PersonalizationComposition without Internals.SequenceManager', () => {
  it('renders the video and layers instead of throwing', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    mounted.push({ root, container })
    expect(() => act(() => {
      root.render(<PersonalizationComposition videoUrl="https://cdn.test/v.mp4" posterUrl={null} isImageSource={false} audioUrl={null} settings={createDefaultPreviewSettings()} brand={brand} />)
    })).not.toThrow()
    expect(container.querySelector('[data-testid="media-video"]')).toBeTruthy()
  })
})
