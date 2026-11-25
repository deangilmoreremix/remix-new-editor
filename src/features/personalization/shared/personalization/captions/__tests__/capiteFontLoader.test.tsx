// @vitest-environment jsdom
import React, { act } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'

const delays = vi.hoisted(() => ({ open: new Set<number>(), next: 1, opened: 0 }))
vi.mock('remotion', () => ({
  useDelayRender: () => ({
    delayRender: () => { const h = delays.next++; delays.open.add(h); delays.opened++; return h },
    continueRender: (h: number) => { delays.open.delete(h) },
  }),
}))

import { loadCaptionFont, useCaptionFont } from '../capiteFontLoader'

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true })
const fontsLoad = vi.fn(async () => [{}])
beforeEach(() => {
  Object.defineProperty(document, 'fonts', { configurable: true, value: { load: fontsLoad, ready: Promise.resolve() } })
  fontsLoad.mockClear(); delays.open.clear(); delays.opened = 0
})
afterEach(() => { document.body.innerHTML = ''; document.head.querySelectorAll('style[data-caption-font]').forEach((e) => e.remove()) })

describe('loadCaptionFont', () => {
  it('registers the font from embedded data (no URL to fetch), then waits for the browser to have it', async () => {
    const out = await loadCaptionFont('Anton', { weight: 400 })
    expect(out.loaded).toBe(true)
    const style = document.head.querySelector('style[data-caption-font="Anton"]')!
    expect(style.textContent).toContain('font-family:"Capite Anton"')
    expect(style.textContent).toMatch(/src:url\(data:font\/woff2;base64,[A-Za-z0-9+/=]{100,}\)/)
    expect(style.textContent).not.toMatch(/url\((?!data:)/)
    expect(fontsLoad).toHaveBeenCalledWith('400 16px "Capite Anton"', expect.any(String))
    // and Capite's fallback came with it
    expect(document.head.querySelector('style[data-caption-font="IBM Plex Sans"]')).not.toBeNull()
  })
  it('registers each font once, and asks for italics when told to', async () => {
    await loadCaptionFont('Anton'); await loadCaptionFont('Anton', { italic: true, weight: 700 })
    expect(document.head.querySelectorAll('style[data-caption-font="Anton"]')).toHaveLength(1)
    expect(fontsLoad).toHaveBeenLastCalledWith('italic 700 16px "Capite Anton"', expect.any(String))
  })
  it('does nothing for a name that is not one of the 16', async () => {
    expect((await loadCaptionFont('Comic Sans')).loaded).toBe(false)
    expect((await loadCaptionFont(undefined)).loaded).toBe(false)
    expect(fontsLoad).not.toHaveBeenCalled()
  })
  it('reports a font that cannot load instead of throwing', async () => {
    fontsLoad.mockRejectedValueOnce(new Error('boom'))
    expect((await loadCaptionFont('Bangers')).loaded).toBe(false)
  })
})

describe('useCaptionFont', () => {
  function Probe({ name, weight }: { name?: string; weight?: number }) { useCaptionFont(name, { weight }); return null }
  const mount = async (el: React.ReactElement) => { const host = document.body.appendChild(document.createElement('div')); const root = createRoot(host); await act(async () => { root.render(el) }); return { root, rerender: async (e: React.ReactElement) => { await act(async () => { root.render(e) }) } } }
  const settle = () => act(async () => { await vi.waitFor(() => expect(delays.open.size).toBe(0), { timeout: 5000 }) })

  it('holds the render until the font is ready, then lets it go', async () => {
    await mount(<Probe name="Montserrat" weight={700} />)
    await settle()
    expect(delays.opened).toBeGreaterThan(0)
    expect(delays.open.size).toBe(0)
    expect(fontsLoad).toHaveBeenCalled()
  })
  it('never holds a render for a name that is not one of the 16', async () => {
    await mount(<Probe name="Nope" />)
    await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
    expect(delays.opened).toBe(0)
  })
  it('releases every hold when the font changes and when it unmounts', async () => {
    const { rerender, root } = await mount(<Probe name="Anton" />)
    await settle()
    await rerender(<Probe name="Outfit" />)
    await settle()
    expect(delays.open.size).toBe(0)
    await act(async () => { root.unmount() })
    expect(delays.open.size).toBe(0)
  })
})
