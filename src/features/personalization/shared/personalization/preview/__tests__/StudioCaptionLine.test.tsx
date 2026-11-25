// @vitest-environment jsdom
import React, { act } from 'react'
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { StudioCaptionLine } from '../StudioCaptionLine'
import { CaptionsLayer } from '../CaptionsLayer'
import { cleanStudioCaptions } from '../../captions/studioCaptions'
import { normalizeCaptions, type CaptionSettings } from '../captions'

const frame = vi.hoisted(() => ({ current: 0 }))
vi.mock('remotion', async (orig) => ({ ...(await orig<typeof import('remotion')>()), useCurrentFrame: () => frame.current, useVideoConfig: () => ({ fps: 30, width: 1000, height: 1000, durationInFrames: 900 }) }))

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
  it('carries the outline colour and the dragged height', () => {
    const lo = line(studio({ positionY: 0.2 }), 500)
    const hi = line(studio({ positionY: 0.7 }), 500)
    const topOf = (el: HTMLElement) => parseFloat((el.querySelector('span')!.parentElement as HTMLElement).style.top)
    expect(topOf(lo)).toBeLessThan(topOf(hi))
    // #001122 outline (jsdom may serialise the colour as hex or as rgb(), depending on its version)
    expect(lo.querySelector('span')!.style.textShadow).toMatch(/#001122|rgb\(0, 17, 34\)/i)
  })
  it('draws in the chosen font, as its embedded "Capite" alias with the composition font behind it', () => {
    for (const fontFamily of ['Anton', 'Orbitron', 'Roboto', 'Inter']) {
      const ff = line(studio({ fontFamily }), 500).querySelector('span')!.style.fontFamily
      expect(ff, fontFamily).toContain(`Capite ${fontFamily}`)
      expect(ff.endsWith('Arial'), fontFamily).toBe(true) // the stack the test passes as the composition's own
    }
  })
  it('keeps the composition font for a font that is not embedded', () => {
    expect(line(studio({ fontFamily: 'Comic Sans' }), 500).querySelector('span')!.style.fontFamily).toBe('"Comic Sans", Arial')
  })
  it('draws the chosen weight, or the look\'s own (bold 800, else 500)', () => {
    expect(line(studio({ weight: 'light' }), 500).querySelector('span')!.style.fontWeight).toBe('300')
    expect(line(studio({ weight: 'bold', bold: false }), 500).querySelector('span')!.style.fontWeight).toBe('700')
    expect(line(studio({ bold: true }), 500).querySelector('span')!.style.fontWeight).toBe('800')
    expect(line(studio({ bold: false }), 500).querySelector('span')!.style.fontWeight).toBe('500')
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
  const cues = [{ id: 'c1', start: 0, end: 1.6, text: 'legacy line' }]
  const base = normalizeCaptions({ enabled: true, cues, style: {} })!
  beforeEach(() => { frame.current = 15 }) // 0.5 s at 30 fps
  const layer = (c: CaptionSettings) => draw(<CaptionsLayer captions={c} compH={1000} />)

  it('draws the studio pages', () => {
    const el = layer({ ...base, studio: studio() })
    expect(el.querySelector('[data-caption-source="studio"]')).not.toBeNull()
    expect(el.textContent).toContain('hello')
  })
  it('keeps drawing the ordinary line when there is no studio data', () => {
    const el = layer(base)
    expect(el.querySelector('[data-caption-source]')).toBeNull()
    expect(el.textContent).toContain('legacy line')
  })
  it('draws nothing while switched off', () => {
    expect(layer({ ...base, enabled: false, studio: studio() }).querySelector('[data-testid="captions-layer"]')).toBeNull()
  })
})
