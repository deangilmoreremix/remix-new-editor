// @vitest-environment jsdom
import React, { act } from 'react'
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { StudioCaptionLine } from '../StudioCaptionLine'
import { CaptionsLayer } from '../CaptionsLayer'
import { cleanStudioCaptions } from '../../captions/studioCaptions'
import type { PreviewCaptions, PersonalizationPreviewSettings } from '../types'

const frame = vi.hoisted(() => ({ current: 0 }))
vi.mock('remotion', async (orig) => ({ ...(await orig<typeof import('remotion')>()), useCurrentFrame: () => frame.current }))

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  // jsdom has no canvas: text is 10px per character, which is all the layout needs.
  HTMLCanvasElement.prototype.getContext = (() => ({ font: '', measureText: (t: string) => ({ width: t.length * 10 }) })) as never
})
afterEach(() => { document.body.innerHTML = '' })

const tok = (text: string, i: number) => ({ text: (i ? ' ' : '') + text, fromMs: i * 400, toMs: i * 400 + 400 })
const studio = (style: Record<string, unknown> = {}) => cleanStudioCaptions({
  pages: [{ startMs: 0, durationMs: 1600, tokens: ['hello', 'brave', 'new', 'world'].map(tok) }],
  style: { fontFamily: 'Anton', fontSize: 6, position: 'bottom', color: '#ffffff', highlightColor: '#ff0000', strokeColor: '#001122', stroke: true, animation: 'highlight', ...style },
})!

function draw(node: React.ReactElement) {
  const el = document.body.appendChild(document.createElement('div'))
  act(() => { createRoot(el).render(node) })
  return el
}
const line = (s: ReturnType<typeof studio>, ms: number, w = 1000, h = 1000) => draw(<StudioCaptionLine studio={s} ms={ms} width={w} height={h} fallbackStack="Arial" zIndex={9000} />)

describe('StudioCaptionLine: the Caption Studio look, drawn as DOM', () => {
  it('draws every word, with the spoken one in the highlight colour', () => {
    const el = line(studio(), 500)
    const spans = [...el.querySelectorAll('span')]
    expect(spans.map((s) => s.textContent)).toEqual(['hello', 'brave', 'new', 'world'])
    expect(spans[0].style.color).toBe('rgb(255, 255, 255)')
    expect(spans[1].style.color).toBe('rgb(255, 0, 0)')
    expect(el.querySelector('[data-testid="captions-layer"]')?.getAttribute('data-caption-source')).toBe('studio')
  })
  it('carries the font, the outline colour and the dragged height', () => {
    const lo = line(studio({ positionY: 0.2 }), 500)
    const hi = line(studio({ positionY: 0.7 }), 500)
    const topOf = (el: HTMLElement) => parseFloat((el.querySelector('span')!.parentElement as HTMLElement).style.top)
    expect(topOf(lo)).toBeLessThan(topOf(hi))
    const span = lo.querySelector('span')!
    expect(span.style.fontFamily).toContain('Anton') // a font that ships in the app
    // #001122 outline (jsdom may serialise the colour as hex or as rgb(), depending on its version)
    expect(span.style.textShadow).toMatch(/#001122|rgb\(0, 17, 34\)/i)
  })
  it('never asks for a font the app does not ship (no network at export)', () => {
    const el = line(studio({ fontFamily: 'Orbitron' }), 500)
    expect(el.querySelector('span')!.style.fontFamily).toBe('Arial')
  })
  it('draws karaoke wipes, boxed words and a line background with plain CSS', () => {
    const k = line(studio({ animation: 'karaoke' }), 600)
    expect(k.querySelector('div[style*="overflow: hidden"]')).not.toBeNull()
    expect(k.innerHTML).not.toContain('clip-path')
    const boxed = line(studio({ animation: 'box', backgroundColor: 'rgba(0, 0, 0, 0.6)' }), 500)
    expect(boxed.innerHTML).toContain('border-radius')
    const bg = line(studio({ background: true }), 500)
    expect(bg.querySelectorAll('div[style*="border-radius"]').length).toBeGreaterThan(0)
  })
  it('draws nothing between pages', () => {
    expect(line(studio(), 20_000).querySelector('span')).toBeNull()
  })
})

describe('CaptionsLayer chooses the Studio drawing when the project has one', () => {
  const settings = { fps: 30, showEndCard: false, durationInFrames: 900, brandColors: { accent: '#00ff00' } } as unknown as PersonalizationPreviewSettings
  const cues = [{ startMs: 0, endMs: 1600, text: 'legacy line' }]
  const base: PreviewCaptions = { enabled: true, forUrl: 'https://x/v.mp4', style: 'bold', position: 'bottom', cues }
  beforeEach(() => { frame.current = 15 }) // 500 ms
  const layer = (c: PreviewCaptions, url = 'https://x/v.mp4') => draw(<CaptionsLayer captions={c} videoUrl={url} settings={settings} width={1000} height={1000} />)

  it('draws the studio pages', () => {
    const el = layer({ ...base, studio: studio() })
    expect(el.querySelector('[data-caption-source="studio"]')).not.toBeNull()
    expect(el.textContent).toContain('hello')
  })
  it('keeps drawing the ordinary line when there is no studio data', () => {
    const el = layer(base)
    expect(el.querySelector('[data-caption-source]')).toBeNull()
    expect(el.querySelector('[data-testid="captions-layer"]')?.getAttribute('data-caption-text')).toBe('legacy line')
  })
  it('still only draws over its own video, while switched on', () => {
    expect(layer({ ...base, studio: studio() }, 'https://x/other.mp4').querySelector('[data-testid="captions-layer"]')).toBeNull()
    expect(layer({ ...base, enabled: false, studio: studio() }).querySelector('[data-testid="captions-layer"]')).toBeNull()
  })
})
