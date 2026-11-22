// @vitest-environment jsdom
/** The end card shows the found email / @handle line only when one exists. */
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { PersonalizationComposition } from '../PersonalizationComposition'
import { createDefaultPreviewSettings } from '../presets'
import { buildPreviewInput } from '../../guided/buildPreviewInput'
import type { PreviewInputProps } from '../types'

vi.mock('@remotion/media', () => ({ Video: () => <div /> }))
vi.mock('remotion', async () => ({
  AbsoluteFill: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Img: ({ src }: { src: string }) => <img src={src} alt="" />,
  Sequence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  Internals: { SequenceManager: { Provider: ({ children }: { children?: React.ReactNode }) => <>{children}</> } },
  useCurrentFrame: () => 30,
  useVideoConfig: () => ({ width: 1920, height: 1080, fps: 30, durationInFrames: 150 }),
  interpolate: (_i: number, _r: number[], out: number[]) => out[out.length - 1] ?? 1,
  spring: () => 1,
  Easing: (await vi.importActual<typeof import('remotion')>('remotion')).Easing,
}))

const mounted: Array<{ root: ReturnType<typeof createRoot>; container: HTMLElement }> = []
afterEach(() => { mounted.splice(0).forEach(({ root, container }) => { act(() => root.unmount()); container.remove() }) })

function mount(extra?: string) {
  const props: PreviewInputProps = {
    videoUrl: null, posterUrl: null, isImageSource: false, audioUrl: null,
    settings: createDefaultPreviewSettings({ showEndCard: true }),
    brand: { businessName: 'Joe', headline: '', offer: '', cta: '', phone: '', website: '', logoUrl: null, productUrl: null, serviceUrl: null, ...(extra ? { contactExtra: extra } : {}) },
  }
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ root, container })
  act(() => { root.render(<PersonalizationComposition {...props} />) })
  return container
}

describe('end card contact extra line', () => {
  it('renders the line when provided', () => {
    expect(mount('hi@joes.com   ·   @joes_pizza').querySelector('[data-testid="pz-endcard-extra"]')?.textContent).toContain('hi@joes.com')
  })
  it('renders nothing when absent', () => {
    expect(mount().querySelector('[data-testid="pz-endcard-extra"]')).toBeNull()
  })
})

describe('buildPreviewInput contactExtra', () => {
  const base = { source: null, previewSettings: createDefaultPreviewSettings(), previewVideo: null, assets: { logos: [], products: [], primaryLogo: null } as never }
  it('is built from the profile email and Instagram, absent otherwise', () => {
    expect(buildPreviewInput({ ...base, clientForm: { email: 'hi@joes.com', instagram: 'https://instagram.com/joes_pizza' } }).brand.contactExtra).toBe('hi@joes.com   ·   @joes_pizza')
    expect('contactExtra' in buildPreviewInput({ ...base, clientForm: {} }).brand).toBe(false)
  })
})
