// @vitest-environment jsdom
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { DEFAULT_CAPTION_STYLE, type CaptionSettings } from '../captions'

let FRAME = 30
vi.mock('remotion', () => ({
  AbsoluteFill: ({ children, style, ...rest }: { children?: React.ReactNode; style?: React.CSSProperties }) => <div style={style} {...(rest as object)}>{children}</div>,
  useCurrentFrame: () => FRAME,
  useVideoConfig: () => ({ fps: 30, width: 1920, height: 1080, durationInFrames: 150 }),
  useDelayRender: () => ({ delayRender: () => 1, continueRender: () => {} }),
}))
import { CaptionsLayer } from '../CaptionsLayer'

afterEach(() => { cleanup(); FRAME = 30 })
const caps = (text: string, language?: string): CaptionSettings => ({ enabled: true, cues: [{ id: 'a', start: 0.5, end: 3, text }], style: DEFAULT_CAPTION_STYLE, ...(language ? { language } : {}) })
const line = (c: CaptionSettings) => { cleanup(); render(<CaptionsLayer captions={c} compH={1080} />); return document.querySelector('[data-testid="caption-line"]') as HTMLElement }

describe('CaptionsLayer: other languages and scripts', () => {
  it('sets right-to-left languages right to left, from the saved language or from the text', () => {
    expect(line(caps('مرحبا بالعالم', 'ar')).style.direction).toBe('rtl')
    expect(line(caps('שלום עולם')).style.direction).toBe('rtl')
    expect(line(caps('Call us today')).style.direction).toBe('')
    expect(line(caps('Call us today', 'es')).style.direction).toBe('')
  })
  it('adds the script\'s fonts and keeps Latin text as it was', () => {
    expect(line(caps('مرحبا', 'ar')).style.fontFamily).toContain('Noto Sans Arabic')
    expect(line(caps('こんにちは', 'ja')).style.fontFamily).toContain('Noto Sans')
    expect(line(caps('Call us today')).style.fontFamily).not.toContain('Noto Sans Arabic')
  })
  it('sets wide scripts a little smaller, never below 60 %', () => {
    const size = (el: HTMLElement) => parseFloat(el.style.fontSize)
    const latin = size(line(caps('Call us today')))
    const cjk = size(line(caps('今日は電話してください', 'ja')))
    expect(cjk).toBeLessThan(latin)
    expect(cjk).toBeGreaterThanOrEqual(latin * 0.6 - 1)
  })
  it('puts the script\'s fonts BEFORE the generic families, so an installed Arabic or CJK font is used instead of whatever the system font covers', () => {
    for (const [text, language, font] of [['مرحبا', 'ar', 'Noto Sans Arabic'], ['שלום', 'he', 'Noto Sans Hebrew'], ['こんにちは', 'ja', 'Noto Sans JP']] as const) {
      const stack = line(caps(text, language)).style.fontFamily
      expect(stack.indexOf(font), language).toBeGreaterThan(-1)
      expect(stack.indexOf(font), language).toBeLessThan(stack.indexOf('system-ui'))
      expect(stack.indexOf(font), language).toBeLessThan(stack.indexOf('ui-sans-serif'))
    }
  })
})

describe('CaptionsLayer: the customizer', () => {
  const styled = (style: Record<string, unknown>): CaptionSettings => ({ enabled: true, cues: [{ id: 'a', start: 0.5, end: 3, text: 'call us today' }], style: { ...DEFAULT_CAPTION_STYLE, ...style } as never })
  const words = () => Array.from(document.querySelectorAll('[data-testid="caption-word"]')) as HTMLElement[]
  it('draws in the chosen font: its embedded copy first, then the fallback, then the app\'s stack', () => {
    const stack = line(styled({ fontFamily: 'Montserrat' })).style.fontFamily
    expect(stack.startsWith('"Capite Montserrat", "Capite IBM Plex Sans"')).toBe(true)
    expect(stack.indexOf('Capite Montserrat')).toBeLessThan(stack.indexOf('ui-sans-serif'))
    expect(line(styled({})).style.fontFamily).not.toContain('Capite')
  })
  it('uses the chosen weight, else bold', () => {
    expect(line(styled({ weight: 'light' })).style.fontWeight).toBe('300')
    expect(line(styled({ weight: undefined, bold: true })).style.fontWeight).toBe('800')
    expect(line(styled({ weight: undefined, bold: false })).style.fontWeight).toBe('500')
  })
  it('uses the chosen casing, which wins over the look\'s upper case', () => {
    line(styled({ uppercase: true })); expect(words()[0].style.textTransform).toBe('uppercase')
    line(styled({ uppercase: true, casing: 'original' })); expect(words()[0].style.textTransform).toBe('none')
    line(styled({ uppercase: false, casing: 'title' })); expect(words()[0].style.textTransform).toBe('capitalize')
  })
  it('moves the caption up for a positive offset and down for a negative one, by a fraction of the frame', () => {
    const wrapper = (c: CaptionSettings) => line(c).parentElement as HTMLElement
    expect(wrapper(styled({ offsetY: 0.1 })).style.transform).toBe('translateY(-108px)')
    expect(wrapper(styled({ offsetY: -0.05 })).style.transform).toBe('translateY(54px)')
    expect(wrapper(styled({})).style.transform).toBe('')
  })
})
