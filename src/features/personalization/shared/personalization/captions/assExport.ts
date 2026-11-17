/**
 * Advanced SubStation Alpha (.ass) export for captions, with the word-by-word effects of the 27 looks. A port of the ASS generator in Capite's
 * backend (https://github.com/muneebkhan08/Capite, `backend/subtitles.py`), without any server: text in, text out. Pure (no React, no network, no
 * repo imports); identical in remix-new-editor and OpenHiggsBolt. Times are in seconds.
 */
import { layoutFor, scriptOf } from './scripts'

export type AssAnimation = 'highlight' | 'karaoke' | 'scale' | 'bounce' | 'pop' | 'glow' | 'box'

export interface AssStyle {
  fontName: string
  /** Used instead of `fontName` for languages that are not Latin script. */
  fontNameFallback?: string
  /** Size at the 1920-px-high reference frame. */
  fontSize: number
  primaryColor: string
  highlightColor: string
  outlineColor: string
  shadowColor: string
  /** 0-255, as in Capite. */
  shadowAlpha: number
  outlineSize: number
  shadowDepth: number
  bold: boolean
  italic: boolean
  letterSpacing: number
  /** 100 = normal. */
  wordSpacing: number
  animation: AssAnimation
  /** Colour of the box of a `box` look when it should differ from the highlight colour. */
  boxColor?: string
}

export interface AssWord { text: string; start: number; end: number }

export interface AssOptions {
  words: readonly AssWord[]
  width: number
  height: number
  style: AssStyle
  /** Height of the caption as a percentage from the bottom. Default 10. */
  positionPct?: number
  language?: string
  /** Default 'uppercase', as Capite does. */
  casing?: 'uppercase' | 'title' | 'original'
  weightTransition?: 'none' | 'light-to-bold' | 'bold-to-light'
}

/** `#RRGGBB` or `#RGB` to the ASS `&HAABBGGRR` (alpha 0 = opaque). Anything unreadable is opaque white, so the file is never invalid. */
export function assColor(hex: string, alpha = 0): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex ?? '').trim())
  let rgb = m ? m[1] : 'FFFFFF'
  if (rgb.length === 3) rgb = rgb.split('').map((c) => c + c).join('')
  const a = Math.min(255, Math.max(0, Math.round(alpha)))
  const h = (n: string) => n.toUpperCase()
  return `&H${a.toString(16).padStart(2, '0').toUpperCase()}${h(rgb.slice(4, 6))}${h(rgb.slice(2, 4))}${h(rgb.slice(0, 2))}`
}

/** Seconds to ASS time `H:MM:SS.cc`. */
export function assTime(sec: number): string {
  const cs = Math.max(0, Math.round((Number.isFinite(sec) ? sec : 0) * 100))
  const h = Math.floor(cs / 360000), m = Math.floor((cs % 360000) / 6000), s = Math.floor((cs % 6000) / 100), c = cs % 100
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`
}

/** Words with times from lines that only have a start, an end and text: each line's time is shared between its words by length. */
export function cuesToWords(cues: readonly { start: number; end: number; text: string }[]): AssWord[] {
  const out: AssWord[] = []
  for (const c of cues) {
    const tokens = String(c.text ?? '').split(/\s+/).filter(Boolean)
    if (!tokens.length || !(c.end > c.start)) continue
    const weights = tokens.map((t) => t.length + 1)
    const total = weights.reduce((a, b) => a + b, 0)
    let t = c.start
    tokens.forEach((text, i) => {
      const end = i === tokens.length - 1 ? c.end : t + ((c.end - c.start) * weights[i]) / total
      out.push({ text, start: t, end })
      t = end
    })
  }
  return out
}

// Emoji and pictographs the renderer cannot draw. (Capite's own pattern uses one huge range that also matches CJK and Arabic letters, which
// would delete the words of those languages, so this uses the Unicode definition of emoji instead.)
const EMOJI = /(?:\p{Extended_Pictographic}|[\u{1F1E0}-\u{1F1FF}]|\u{FE0F}|\u{200D})+/gu
const escapeAss = (t: string) => t.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}').replace(/\n/g, ' ')
const flag = (v: boolean) => (v ? -1 : 0)
const round1 = (n: number) => Math.round(n * 10) / 10
const display = (w: string, casing: AssOptions['casing']) => (casing === 'title' ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : casing === 'original' ? w : w.toUpperCase())

interface Placed { text: string; start: number; end: number; line: number }

/** The ASS file text, or '' when there are no words. */
export function generateAss(o: AssOptions): string {
  const language = o.language ?? 'en'
  const style = o.style
  const words = o.words
    .map((w) => ({ text: String(w.text ?? '').replace(EMOJI, '').trim(), start: Number(w.start), end: Number(w.end) }))
    .filter((w) => w.text && Number.isFinite(w.start) && Number.isFinite(w.end))
    .map((w) => ({ ...w, end: Math.max(w.end, w.start) }))
  if (!words.length) return ''

  const positionPct = o.positionPct ?? 10
  const dim = Math.max(o.height / 1920, 0.35)
  const { maxChars, fontScale } = layoutFor(language, style.fontSize)

  // Groups of up to two lines.
  const groups: Placed[][] = []
  let lines: Placed[][] = [[]]
  let chars = [0]
  const flush = () => { const flat = lines.flatMap((l) => l); if (flat.length) groups.push(flat); lines = [[]]; chars = [0] }
  for (const w of words) {
    const li = lines.length - 1
    const withWord = chars[li] + (lines[li].length ? 1 : 0) + w.text.length
    if (withWord <= maxChars || !lines.flat().length) { lines[li].push({ ...w, line: li }); chars[li] = withWord; continue }
    if (li + 1 < 2) { lines.push([{ ...w, line: li + 1 }]); chars.push(w.text.length); continue }
    flush()
    lines[0].push({ ...w, line: 0 }); chars[0] = w.text.length
  }
  flush()

  const latin = !o.language || scriptOf(language)?.id === 'latin'
  const fontName = latin ? style.fontName : style.fontNameFallback ?? style.fontName
  const isBox = style.animation === 'box'
  const fontSize = Math.floor(style.fontSize * fontScale * dim)
  const primary = assColor(style.primaryColor)
  let outline: number, shadow: number, borderStyle: number, outlineColour: string, backColour: string
  if (isBox) {
    borderStyle = 3
    outline = round1(Math.max(style.outlineSize, 8) * fontScale * dim)
    outlineColour = assColor(style.outlineColor, 255) // inactive words get no box
    shadow = 0
    backColour = assColor('#000000', 255)
  } else {
    borderStyle = 1
    outline = round1(style.outlineSize * fontScale * dim)
    outlineColour = assColor(style.outlineColor)
    shadow = round1(style.shadowDepth * fontScale * dim)
    backColour = assColor(style.shadowColor, style.shadowAlpha)
  }
  const margin = Math.floor(40 * dim)
  const marginV = Math.floor((o.height * positionPct) / 100)

  const head = [
    '[Script Info]',
    '; Script generated by captions/assExport',
    'ScriptType: v4.00+',
    'WrapStyle: 3',
    'ScaledBorderAndShadow: yes',
    `PlayResX: ${Math.round(o.width)}`,
    `PlayResY: ${Math.round(o.height)}`,
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Default,${fontName},${fontSize},${primary},&H000000FF,${outlineColour},${backColour},${flag(style.bold)},${flag(style.italic)},0,0,100,100,0.5,0,${borderStyle},${outline},${shadow},2,${margin},${margin},${marginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ]

  const activeW = o.weightTransition === 'light-to-bold' ? '\\b900' : o.weightTransition === 'bold-to-light' ? '\\b300' : ''
  const idleW = o.weightTransition === 'light-to-bold' ? '\\b300' : o.weightTransition === 'bold-to-light' ? '\\b900' : ''
  const posX = Math.floor(o.width / 2)
  const posY = o.height - Math.floor((o.height * positionPct) / 100)
  const hi = assColor(style.highlightColor)
  const boxCol = assColor(style.boxColor ?? style.highlightColor)
  const rtl = scriptOf(language)?.rtl === true
  const big = fontScale >= 1

  const events: string[] = []
  for (const group of groups) {
    const lineEnd = group[group.length - 1].end
    group.forEach((word, idx) => {
      const eventEnd = idx < group.length - 1 ? group[idx + 1].start : lineEnd
      const parts: string[] = []
      let prevLine: number | null = null
      group.forEach((w, i) => {
        if (prevLine !== null && w.line !== prevLine) parts.push('\\N')
        const t = escapeAss(display(w.text, o.casing))
        if (i === idx) {
          switch (style.animation) {
            case 'box': { const p = big ? 106 : 103; parts.push(`{\\3a&H00&\\3c${boxCol}\\1c${primary}\\t(0,40,\\fscx${p}\\fscy${p})\\t(40,90,\\fscx100\\fscy100)${activeW}}${t}{\\r}`); break }
            case 'karaoke': {
              if (rtl) parts.push(`{\\c${hi}${activeW}}${t}{\\r}`)
              else parts.push(`{\\kf${w.end > w.start ? Math.floor((w.end - w.start) * 100) : 30}\\c${hi}${activeW}}${t}{\\r}`)
              break
            }
            case 'scale': parts.push(`{\\fscx110\\fscy110${activeW}\\c${hi}}${t}{\\r}`); break
            case 'bounce': { const p = big ? 120 : 112; parts.push(`{\\t(0,50,\\fscx${p}\\fscy${p})\\t(50,100,\\fscx100\\fscy100)${activeW}\\c${hi}}${t}{\\r}`); break }
            case 'pop': { const p = big ? 115 : 108; parts.push(`{\\t(0,40,\\fscx${p}\\fscy${p})\\t(40,90,\\fscx100\\fscy100)${activeW}\\c${hi}}${t}{\\r}`); break }
            case 'glow': parts.push(`{\\blur4${activeW}\\c${hi}}${t}{\\r}`); break
            default: parts.push(`{${activeW}\\c${hi}}${t}{\\r}`)
          }
        } else parts.push(idleW ? `{${idleW}}${t}{\\r}` : t)
        prevLine = w.line
      })
      let text = style.wordSpacing !== 100 ? parts.join(`{\\fscx${style.wordSpacing}} {\\fscx100}`) : parts.join(' ')
      if (style.letterSpacing !== 0) text = `{\\fsp${style.letterSpacing}}${text}`
      text = `{\\pos(${posX},${posY})}${text}`
      const end = Math.max(eventEnd - 0.01, word.start + 0.01)
      events.push(`Dialogue: 0,${assTime(word.start)},${assTime(end)},Default,,0,0,0,,${text}`)
    })
  }
  return [...head, ...events, ''].join('\n')
}
