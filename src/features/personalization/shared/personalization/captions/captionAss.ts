import type { PreviewCaptions } from '../preview/types'
import { generateAss, cuesToWords, type AssAnimation, type AssStyle, type AssWord } from './assExport'
import { capiteStyleById } from './capiteStyles'
import { detectScript, representativeLanguage } from './scripts'

/**
 * The project's captions as an .ass file (Advanced SubStation Alpha) for editors and players that take styled subtitles. Lines that have the
 * real time of each word use it; the others share the line's time between their words by length. A Capite look keeps its font, colours,
 * outline and word effect; the three built-in looks are given matching numbers (the dark bar of "Bar" has no ASS equivalent and is drawn as
 * a plain outlined style).
 */
const POSITION_PCT = { bottom: 10, middle: 46, top: 86 } as const

const BUILT_IN: Record<'bold' | 'bar' | 'clean', Omit<AssStyle, 'highlightColor'>> = {
  bold: { fontName: 'Inter', fontNameFallback: 'Noto Sans', fontSize: 105, primaryColor: '#FFFFFF', outlineColor: '#000000', shadowColor: '#000000', shadowAlpha: 128, outlineSize: 7, shadowDepth: 0, bold: true, italic: false, letterSpacing: 0, wordSpacing: 100, animation: 'highlight' },
  bar: { fontName: 'Inter', fontNameFallback: 'Noto Sans', fontSize: 84, primaryColor: '#FFFFFF', outlineColor: '#000000', shadowColor: '#000000', shadowAlpha: 128, outlineSize: 6, shadowDepth: 0, bold: true, italic: false, letterSpacing: 0, wordSpacing: 100, animation: 'highlight' },
  clean: { fontName: 'Inter', fontNameFallback: 'Noto Sans', fontSize: 84, primaryColor: '#FFFFFF', outlineColor: '#000000', shadowColor: '#000000', shadowAlpha: 128, outlineSize: 3, shadowDepth: 3, bold: true, italic: false, letterSpacing: 0, wordSpacing: 100, animation: 'highlight' },
}

export function captionsToAss(c: PreviewCaptions, o: { width: number; height: number; accent: string }): string {
  const words: AssWord[] = c.cues.flatMap((cue, group) => cue.words?.length
    ? cue.words.map((w) => ({ text: w.text, start: w.startMs / 1000, end: w.endMs / 1000, group }))
    : cuesToWords([{ start: cue.startMs / 1000, end: cue.endMs / 1000, text: cue.text }]).map((w) => ({ ...w, group })))
  if (!words.length) return ''
  const language = c.language ?? representativeLanguage(detectScript(c.cues.map((x) => x.text).join(' ')))
  const look = capiteStyleById(c.style)
  const style: AssStyle = look
    ? {
        fontName: look.fontName, fontNameFallback: look.fontNameFallback, fontSize: look.fontSize, primaryColor: look.primaryColor, highlightColor: look.highlightColor,
        outlineColor: look.outlineColor, shadowColor: look.shadowColor, shadowAlpha: look.shadowAlpha, outlineSize: look.outlineSize, shadowDepth: look.shadowDepth,
        bold: look.bold, italic: look.italic, letterSpacing: look.letterSpacing, wordSpacing: look.wordSpacing, animation: look.animationType as AssAnimation,
      }
    : { ...BUILT_IN[(c.style === 'bar' || c.style === 'clean' ? c.style : 'bold') as 'bold' | 'bar' | 'clean'], highlightColor: c.style === 'bold' ? o.accent : '#FFFFFF' }
  return generateAss({ words, width: o.width, height: o.height, style, language, positionPct: POSITION_PCT[c.position], casing: look ? 'uppercase' : 'original' })
}
