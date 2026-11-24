// @vitest-environment jsdom
/**
 * The three-part timeline: opening scene, then the video in full, then the
 * closing scene. The video and its overlays start after the opening scene.
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { PersonalizationComposition } from '../PersonalizationComposition'
import { applyDesignTemplate, createDefaultPreviewSettings, totalDurationInFrames } from '../presets'
import { __resetRemotionDesignRegistry, registerRemotionDesignTemplate } from '../../templates/registry'
import type { RemotionDesignComponent, RemotionDesignTemplate } from '../../templates/types'
import type { PreviewInputProps } from '../types'

const clock = { frame: 0 }

vi.mock('@remotion/media', () => ({
  Video: () => <div data-testid="media-video" />,
  Audio: () => null,
}))

vi.mock('remotion', async () => ({
  AbsoluteFill: ({ children, ...rest }: { children?: React.ReactNode } & Record<string, unknown>) => (
    <div data-scene={rest['data-remotion-scene'] as string | undefined}>{children}</div>
  ),
  // eslint-disable-next-line @next/next/no-img-element
  Img: ({ src }: { src: string }) => <img src={src} alt="" />,
  // Records where each Sequence sits, and only mounts it while it is on screen.
  Sequence: ({ children, from = 0, durationInFrames = Infinity, name }: { children?: React.ReactNode; from?: number; durationInFrames?: number; name?: string }) =>
    clock.frame >= from && clock.frame < from + durationInFrames ? (
      <div data-sequence={name ?? 'anon'} data-from={from} data-duration={durationInFrames}>
        {children}
      </div>
    ) : null,
  Internals: { SequenceManager: { Provider: ({ children }: { children?: React.ReactNode }) => <>{children}</> } },
  useCurrentFrame: () => clock.frame,
  useVideoConfig: () => ({ width: 1920, height: 1080, fps: 30, durationInFrames: 150 }),
  interpolate: (_i: number, _r: number[], out: number[]) => out[out.length - 1] ?? 1,
  spring: () => 1,
  Easing: { out: () => (t: number) => t, inOut: () => (t: number) => t, in: () => (t: number) => t, cubic: 0, quad: 0, ease: 0, bezier: () => (t: number) => t },
}))

const Scene: RemotionDesignComponent = () => <div data-testid="scene-design">scene</div>
const Overlay: RemotionDesignComponent = () => <div data-testid="overlay-design">overlay</div>

function template(id: string, component: RemotionDesignComponent, role?: 'scene'): RemotionDesignTemplate {
  return {
    id,
    name: id,
    description: id,
    category: 'animated-headline',
    source: { repository: 'r', repositoryUrl: 'https://github.com/r', sourcePath: 'src/x.tsx', license: 'MIT', attribution: 'a' },
    component,
    textSlots: [{ key: 'headline', field: 'headline', label: 'Headline', primary: true }],
    media: [],
    placement: role === 'scene' ? { x: 0.5, y: 0.5, scale: 1, opacity: 1 } : { x: 0.5, y: 0.7, scale: 0.6, opacity: 1 },
    capabilities: { preview: true, browserExport: true },
    role,
    sceneDurationInFrames: 60,
  }
}

const BRAND: PreviewInputProps['brand'] = {
  businessName: 'Acme', headline: 'Roofs that last', offer: '', cta: 'Call now', phone: '', website: '',
  logoUrl: null, productUrl: null, serviceUrl: null,
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  __resetRemotionDesignRegistry()
  registerRemotionDesignTemplate(template('fixture-scene', Scene, 'scene'))
  registerRemotionDesignTemplate(template('fixture-overlay', Overlay))
  container = document.createElement('div')
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
})

function renderAt(frame: number, inputProps: PreviewInputProps) {
  clock.frame = frame
  act(() => root.render(<PersonalizationComposition {...inputProps} />))
}

describe('opening scene → video → closing scene', () => {
  // Built per test: the fixture designs are registered in beforeEach.
  const build = () => {
    const base = createDefaultPreviewSettings({ durationInFrames: 90, showEndCard: false })
    const settings = applyDesignTemplate(applyDesignTemplate(base, 'fixture-scene', {}, 'intro'), 'fixture-overlay', {}, 'outro')
    const inputProps: PreviewInputProps = {
      videoUrl: '/media/demo.mp4', posterUrl: null, isImageSource: false, audioUrl: null, settings, brand: BRAND,
    }
    return { settings, inputProps }
  }

  it('adds both scenes to the total length', () => {
    expect(totalDurationInFrames(build().settings)).toBe(60 + 90 + 60)
  })

  it('shows only the opening scene first, with the video waiting', () => {
    renderAt(10, build().inputProps)
    expect(container.querySelector('[data-scene="intro"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="media-video"]')).toBeNull()
  })

  it('starts the video, in full, right after the opening scene', () => {
    renderAt(65, build().inputProps)
    const video = container.querySelector('[data-sequence="Your video"]') as HTMLElement
    expect(video).not.toBeNull()
    expect(video.dataset.from).toBe('60')
    expect(video.dataset.duration).toBe('90')
    expect(container.querySelector('[data-testid="media-video"]')).not.toBeNull()
    expect(container.querySelector('[data-scene]')).toBeNull()
    // The layout's text layers show on the video's own clock.
    expect(container.textContent).toContain('Roofs that last')
  })

  it('plays the closing scene after the video ends, on the brand color for a non-scene design', () => {
    renderAt(160, build().inputProps)
    expect(container.querySelector('[data-scene="outro"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="overlay-design"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="media-video"]')).toBeNull()
  })
})
