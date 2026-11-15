// @vitest-environment jsdom
/**
 * DesignOverlay: a registered design on a TRANSPARENT background for hosts that
 * bring their own box (the Timeline Editor). Same slot and media resolution as
 * the modal's composition, no video / dimming / end card.
 */
import React from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { DesignOverlay } from '../DesignOverlay'
import { __resetRemotionDesignRegistry, registerRemotionDesignTemplate } from '../../templates/registry'
import type { RemotionDesignComponent, RemotionDesignComponentProps } from '../../templates/types'

vi.mock('@remotion/media', () => ({ Video: () => <div data-testid="media-video" />, Audio: () => null }))
vi.mock('remotion', async () => ({
  AbsoluteFill: ({ children, ...rest }: { children?: React.ReactNode }) => <div data-testid="fill" {...(rest as object)}>{children}</div>,
  Img: ({ src }: { src: string }) => <img src={src} alt="" />,
  Sequence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  Internals: { SequenceManager: { Provider: ({ children }: { children?: React.ReactNode }) => <>{children}</> } },
  useCurrentFrame: () => 12,
  useVideoConfig: () => ({ width: 1920, height: 1080, fps: 30, durationInFrames: 150 }),
  interpolate: (_i: number, _r: number[], out: number[]) => out[out.length - 1] ?? 1,
  spring: () => 1,
  Easing: (await vi.importActual<typeof import('remotion')>('remotion')).Easing,
}))

const received: RemotionDesignComponentProps[] = []
const Design: RemotionDesignComponent = (props) => { received.push(props); return <div data-testid="design">design</div> }

const brand = { businessName: 'Acme Roofing', headline: 'Roofing done right', offer: '20% off', cta: 'Book now', phone: '555', website: '', logoUrl: 'https://cdn.test/logo.png', productUrl: 'https://cdn.test/p.png', serviceUrl: null }
const base = { designId: 'fixture-design', brand, width: 1920, height: 1080, boxWidthPx: 960, boxHeightPx: 540 }

const mounted: Array<{ root: ReturnType<typeof createRoot>; container: HTMLElement }> = []
const mount = (el: React.ReactElement) => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ root, container })
  act(() => { root.render(el) })
  return container
}

beforeEach(() => {
  received.length = 0
  __resetRemotionDesignRegistry()
  registerRemotionDesignTemplate({
    id: 'fixture-design', name: 'Fixture', description: 'd', category: 'animated-headline',
    source: { repository: 'x/y', repositoryUrl: 'https://example.com', sourcePath: 'a.tsx', license: 'MIT', attribution: 'a' },
    component: Design,
    textSlots: [{ key: 'headline', field: 'headline', label: 'Headline', primary: true }, { key: 'business', field: 'businessName', label: 'Business' }],
    colors: [{ role: 'primary', label: 'Primary' }],
    media: [{ role: 'logo', label: 'Logo', required: true }],
    animation: { durationInFrames: 30, delayInFrames: 0, easing: 'ease-out' },
    placement: { x: 0.5, y: 0.5, scale: 0.8, opacity: 1, animation: 'none' },
    aspectRatios: ['16:9'], requiredMedia: ['logo'], capabilities: { preview: true, browserExport: true }, previewCompatible: true,
  })
})
afterEach(() => { mounted.splice(0).forEach(({ root, container }) => { act(() => root.unmount()); container.remove() }) })

describe('DesignOverlay', () => {
  it('draws the registered design with the contact\'s brand values and the local frame', () => {
    const c = mount(<DesignOverlay {...base} />)
    expect(c.querySelector('[data-testid="design"]')).toBeTruthy()
    const p = received[0]
    expect(p.textSlots).toMatchObject({ headline: 'Roofing done right', business: 'Acme Roofing' })
    expect(p.text).toBe('Roofing done right')
    expect(p.media.logo).toBe('https://cdn.test/logo.png')
    expect(p).toMatchObject({ frame: 12, fps: 30, width: 1920, height: 1080, opacity: 1 })
  })
  it('hands the design the size of the box it was given (the timeline overlay wrapper)', () => {
    mount(<DesignOverlay {...base} boxWidthPx={480} boxHeightPx={270} />)
    expect(received[0].box).toEqual({ leftPx: 0, topPx: 0, widthPx: 480, heightPx: 270 })
  })
  it('uses typed text for the primary slot and overrides for the others', () => {
    mount(<DesignOverlay {...base} text="Spring sale" textSlotOverrides={{ business: 'Acme Co' }} />)
    expect(received[0].textSlots).toMatchObject({ headline: 'Spring sale', business: 'Acme Co' })
    expect(received[0].text).toBe('Spring sale')
  })
  it('lets a chosen image replace the design\'s primary media', () => {
    mount(<DesignOverlay {...base} imageUrl="https://cdn.test/chosen.png" />)
    expect(received[0].media.logo).toBe('https://cdn.test/chosen.png')
  })
  it('draws nothing on its own: no video, no dimming, no background', () => {
    const c = mount(<DesignOverlay {...base} />)
    expect(c.querySelector('[data-testid="media-video"]')).toBeNull()
    expect(c.querySelectorAll('[data-testid="fill"]')).toHaveLength(1)
    expect((c.querySelector('[data-testid="fill"]') as HTMLElement).getAttribute('style') ?? '').not.toMatch(/background/)
  })
  it('renders nothing for a design that is not registered', () => {
    const c = mount(<DesignOverlay {...base} designId="nope" />)
    expect(c.innerHTML).toBe('')
  })
  it('uses the brand colours, with the studio defaults when none are given', () => {
    mount(<DesignOverlay {...base} brandColors={{ primary: '#123456' }} />)
    expect(received[0].colors.primary).toBe('#123456')
    expect(received[0].colors.text).toBeTruthy()
  })
})
