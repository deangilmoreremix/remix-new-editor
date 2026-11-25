import { generateAss, cuesToWords, type AssAnimation, type AssStyle, type AssWord } from '../captions/assExport'
import { inferLanguage } from '../captions/scripts'
import { CAPTION_STYLE_CONFIGS } from './capite/captionStyles'
import { visibleWordRange } from './capite/activeWord'
import { assBoldOf, assCasingOf, offsetPositionPct, resolveCasing, resolveWeight } from '../captions/captionCustom'
import type { CaptionSettings } from './captions'

/**
 * The project's captions as an .ass file (Advanced SubStation Alpha) for editors and players that take styled subtitles. Each line's time is
 * shared between its words by length. A Capite look keeps its font; every style keeps its colours, outline, shadow, spacing, casing and
 * word effect. Sizes are fractions of the frame height and ems here and pixels at the 1920-px reference frame in the file.
 */
const POSITION_PCT = { bottom: 10, middle: 46, top: 86 } as const
const REFERENCE_HEIGHT = 1920

export function captionsToAss(c: CaptionSettings, o: { width: number; height: number }): string {
  // A caption's language: the saved one, else read from its own letters (so English next to Japanese keeps its own font).
  const lang = (text: string) => c.language ?? inferLanguage(text)
  const words: AssWord[] = c.cues.flatMap((cue, group) => cuesToWords([cue]).map((w) => ({ ...w, group, language: lang(cue.text) })))
  if (!words.length) return ''
  const st = c.style
  const config = st.preset.startsWith('capite-') ? (CAPTION_STYLE_CONFIGS as Record<string, { fontName: string; fontNameFallback: string } | undefined>)[st.preset.slice('capite-'.length)] : undefined
  const fontSize = Math.round(st.size * REFERENCE_HEIGHT)
  // No "Highlight word" means no word effect at all (the preview marks no word active); a box behind the whole caption is a background.
  const animation: AssAnimation = st.highlight === 'none' ? 'highlight' : st.animation ?? 'highlight'
  const style: AssStyle = {
    fontName: st.fontFamily ?? config?.fontName ?? 'Inter',
    fontNameFallback: config?.fontNameFallback ?? 'Noto Sans',
    fontSize,
    primaryColor: st.color,
    // No highlight: the spoken word keeps the text colour.
    highlightColor: st.highlight === 'none' ? st.color : st.highlightColor,
    outlineColor: st.outline?.color ?? '#000000',
    shadowColor: st.shadow?.color ?? '#000000',
    shadowAlpha: st.shadow ? Math.round((1 - st.shadow.alpha) * 255) : 255,
    outlineSize: st.outline ? st.outline.size * fontSize : 0,
    shadowDepth: st.shadow ? st.shadow.depth * fontSize : 0,
    bold: assBoldOf(resolveWeight(st.weight, st.bold)),
    italic: st.italic === true,
    letterSpacing: st.letterSpacing ? st.letterSpacing * fontSize : 0,
    wordSpacing: st.wordSpacing ? 100 + (st.wordSpacing / 0.3) * 100 : 100,
    animation,
    background: st.box ? { color: st.boxColor, opacity: st.boxOpacity } : undefined,
  }
  const language = lang(c.cues.map((x) => x.text).join(' '))
  return generateAss({ words, width: o.width, height: o.height, style, language, positionPct: offsetPositionPct(POSITION_PCT[st.position], st.offsetY), casing: assCasingOf(resolveCasing(st.casing, st.uppercase)), sizing: 'preview', visibleRange: st.windowed ? (st.highlight === 'none' ? (count) => visibleWordRange(count, -1) : visibleWordRange) : undefined })
}
