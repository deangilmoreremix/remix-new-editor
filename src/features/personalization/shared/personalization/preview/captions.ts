/**
 * Captions: timed lines of text drawn over the video, with the word being spoken highlighted. Nothing here listens to the audio:
 * the customer pastes a script or subtitles (SRT) and the lines are timed for them, then they can adjust each one. The state at any
 * frame is a pure function, so the live Player and the browser export agree.
 */
import { CAPTION_STYLES, CAPTION_STYLE_CONFIGS } from './capite/captionStyles'
import { cleanStudioCaptions, type StudioCaptions } from '../captions/studioCaptions'
import { normalizeCustom, type CaptionCasing } from '../captions/captionCustom'
import { captionFontByName, type CaptionWeight } from '../captions/capiteFonts'
import type { CaptionStyleConfig } from './capite/types'
import { transcriptToSrt, transcriptToVtt } from './capite/subtitleExport'

export interface CaptionWordTiming { text: string; /** Seconds. */ start: number; end: number }

export interface CaptionCue {
  id: string
  /** Seconds. */
  start: number
  end: number
  text: string
  /**
   * When the words were timed from the speech (the Caption Studio), their exact times. Used for the word highlight only while the words
   * still spell the line's text; an edited line falls back to sharing the line's time by word length.
   */
  words?: CaptionWordTiming[]
}

export type CaptionPosition = 'bottom' | 'middle' | 'top'
export type CaptionHighlight = 'word' | 'none'

export interface CaptionStyle {
  preset: string
  position: CaptionPosition
  /** Font size as a fraction of the frame height. */
  size: number
  /** Which word is highlighted while the line plays. */
  highlight: CaptionHighlight
  /** Text color; highlight color for the active word. Hex. */
  color: string
  highlightColor: string
  /** A rounded box behind the text. */
  box: boolean
  boxColor: string
  /** 0..1 */
  boxOpacity: number
  uppercase: boolean
  /** Use the brand's font weight/shadow look: bold with a soft shadow. */
  bold: boolean
  /** From Capite's styles (see ./capite): how the spoken word is emphasised. Absent = the plain colour highlight. */
  animation?: CaptionAnimation
  italic?: boolean
  /** Outline around the letters, in em, and its colour. */
  outline?: { size: number; color: string }
  /** Drop shadow under the letters: depth in em, 0..1 opacity, colour. */
  shadow?: { depth: number; alpha: number; color: string }
  /** Extra letter spacing in em. */
  letterSpacing?: number
  /** Extra space between words in em. */
  wordSpacing?: number
  /** Show only a few words around the spoken one (Capite's five-word window). */
  windowed?: boolean
  /** Grouping for the style chips. */
  category?: string
  /** A dragged vertical centre of the captions, 0..1 of the frame height. Wins over `position`. */
  positionY?: number
  /** The customizer: one of Capite's 16 fonts (canonical name), a weight, a casing (wins over `uppercase`) and a vertical offset as a fraction of the frame height (positive = up). */
  fontFamily?: string
  weight?: CaptionWeight
  casing?: CaptionCasing
  offsetY?: number
  /** Keep the captions off other text when they are moved. On unless false. */
  keepClear?: false
}

export type CaptionAnimation = 'highlight' | 'karaoke' | 'pop' | 'bounce' | 'scale' | 'glow' | 'box'
export const CAPTION_ANIMATIONS: CaptionAnimation[] = ['highlight', 'karaoke', 'pop', 'bounce', 'scale', 'glow', 'box']

export interface CaptionSettings {
  enabled: boolean
  cues: CaptionCue[]
  style: CaptionStyle
  /** Language of the words (ISO code such as `es` or `pt-BR`), when known: sets the font fallback, size and reading direction. Absent = worked out from the text. */
  language?: string
  /** Captions designed in the Caption Studio: its pages and full style, drawn natively. `cues` and `style` stay as the fallback for the list and the downloads. */
  studio?: StudioCaptions
}

/** `es`, `haw`, `pt-BR`: a two or three letter code with an optional region. */
const LANGUAGE_CODE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/

export const MAX_CUES = 200
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const hex = (v: unknown, fallback: string) => (typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim()) ? v.trim() : fallback)

// ── presets (the "brand styles": they take the brand's colors) ───────────────────────────────────────────────────
export interface CaptionPresetDef {
  id: string
  label: string
  build: (brand: { primary: string; accent: string; text: string }) => Omit<CaptionStyle, 'preset'>
}

export const CAPTION_PRESETS: CaptionPresetDef[] = [
  { id: 'clean', label: 'Clean', build: (b) => ({ position: 'bottom', size: 0.055, highlight: 'none', color: b.text, highlightColor: b.accent, box: false, boxColor: '#000000', boxOpacity: 0.5, uppercase: false, bold: true }) },
  { id: 'karaoke', label: 'Word highlight', build: (b) => ({ position: 'bottom', size: 0.062, highlight: 'word', color: b.text, highlightColor: b.accent, box: false, boxColor: '#000000', boxOpacity: 0.5, uppercase: true, bold: true }) },
  { id: 'boxed', label: 'Boxed', build: (b) => ({ position: 'bottom', size: 0.05, highlight: 'word', color: '#ffffff', highlightColor: b.primary, box: true, boxColor: '#000000', boxOpacity: 0.62, uppercase: false, bold: true }) },
  { id: 'brand', label: 'Brand bar', build: (b) => ({ position: 'bottom', size: 0.052, highlight: 'none', color: '#ffffff', highlightColor: '#ffffff', box: true, boxColor: b.primary, boxOpacity: 0.9, uppercase: false, bold: true }) },
  { id: 'headline', label: 'Big middle', build: (b) => ({ position: 'middle', size: 0.085, highlight: 'word', color: b.text, highlightColor: b.accent, box: false, boxColor: '#000000', boxOpacity: 0.5, uppercase: true, bold: true }) },
]

/**
 * Capite's numbers are ASS subtitle units on a 1080x1920 frame: font size in px, outline and shadow in px, letter spacing in px,
 * word spacing as a percentage (100 = normal), shadow alpha 0..255. They are turned into fractions of the frame height and ems.
 */
const CAPITE_REFERENCE_HEIGHT = 1920
export function captionStyleFromCapite(c: CaptionStyleConfig): Omit<CaptionStyle, 'preset'> {
  const fs = Math.max(1, c.fontSize)
  return {
    position: 'bottom',
    size: clamp(c.fontSize / CAPITE_REFERENCE_HEIGHT, 0.025, 0.14),
    highlight: 'word',
    color: c.primaryColor,
    highlightColor: c.highlightColor,
    box: false,
    boxColor: '#000000',
    boxOpacity: 0.5,
    // Capite upper-cases every caption unless told otherwise (video-overlay-player.tsx `transformWordText`).
    uppercase: true,
    bold: c.bold,
    animation: c.animationType,
    italic: c.italic,
    outline: { size: clamp(c.outlineSize / fs, 0, 0.2), color: c.outlineColor },
    shadow: { depth: clamp(c.shadowDepth / fs, 0, 0.2), alpha: clamp(c.shadowAlpha / 255, 0, 1), color: c.shadowColor },
    letterSpacing: clamp(c.letterSpacing / fs, -0.05, 0.3),
    wordSpacing: clamp(((c.wordSpacing - 100) / 100) * 0.3, 0, 1),
    windowed: true,
    category: c.category ?? 'trending',
    // The look's own font, so it is drawn in the preview and the export (and named in the .ass), not only in the .ass.
    ...(captionFontByName(c.fontName) ? { fontFamily: captionFontByName(c.fontName)!.name } : {}),
  }
}

export interface CaptionPresetDef2 extends CaptionPresetDef { category: string }

/** Capite's 27 styles as presets (fixed colours, not brand colours). See ./capite/captionStyles.ts. */
export const CAPITE_PRESETS: CaptionPresetDef2[] = CAPTION_STYLES.map((id) => {
  const c = CAPTION_STYLE_CONFIGS[id]
  return { id: `capite-${id}`, label: c.name, category: c.category ?? 'trending', build: () => captionStyleFromCapite(c) }
})
export const CAPTION_PRESET_CATEGORIES: { id: string; label: string }[] = [
  { id: 'brand', label: 'Your brand' },
  { id: 'trending', label: 'Trending' },
  { id: 'pop-expressive', label: 'Pop' },
  { id: 'editorial-film', label: 'Film' },
  { id: 'clean-tech', label: 'Clean' },
]
export const ALL_CAPTION_PRESETS: CaptionPresetDef[] = [...CAPTION_PRESETS, ...CAPITE_PRESETS]

export function captionPreset(id: string, brand: { primary: string; accent: string; text: string }): CaptionStyle | undefined {
  const p = ALL_CAPTION_PRESETS.find((x) => x.id === id)
  return p ? { preset: p.id, ...p.build(brand) } : undefined
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = { preset: 'karaoke', ...CAPTION_PRESETS[1].build({ primary: '#29d3f2', accent: '#facc15', text: '#ffffff' }) }

// ── normalizing saved data ──────────────────────────────────────────────────────────────────────────────────────
const MAX_WORDS_PER_CUE = 24
/** Word timings read back from storage: kept only when every word is valid and together they spell the line. */
function cleanWords(raw: unknown, text: string): CaptionWordTiming[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_WORDS_PER_CUE) return undefined
  const out: CaptionWordTiming[] = []
  for (const w of raw) {
    if (!isRecord(w) || typeof w.text !== 'string' || !w.text.trim() || !finite(w.start) || !finite(w.end)) return undefined
    const start = clamp(w.start, 0, 3600)
    out.push({ text: w.text.trim().slice(0, 40), start, end: clamp(w.end, start, 3600) })
  }
  return out.map((w) => w.text).join(' ') === text.split(/\s+/).filter(Boolean).join(' ') ? out : undefined
}

export function normalizeCues(raw: unknown): CaptionCue[] {
  if (!Array.isArray(raw)) return []
  const out: CaptionCue[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!isRecord(item) || typeof item.text !== 'string' || !item.text.trim() || !finite(item.start) || !finite(item.end)) continue
    const start = clamp(item.start, 0, 3600)
    const end = clamp(item.end, start + 0.1, 3600)
    let id = typeof item.id === 'string' && item.id ? item.id : `cue_${out.length}`
    while (seen.has(id)) id += '_'
    seen.add(id)
    const text = item.text.trim().slice(0, 240)
    const words = cleanWords(item.words, text)
    out.push({ id, start, end, text, ...(words ? { words } : {}) })
    if (out.length >= MAX_CUES) break
  }
  return out.sort((a, b) => a.start - b.start)
}

export function normalizeCaptions(raw: unknown): CaptionSettings | undefined {
  if (!isRecord(raw)) return undefined
  const s = isRecord(raw.style) ? raw.style : {}
  const d = DEFAULT_CAPTION_STYLE
  const style: CaptionStyle = {
    preset: typeof s.preset === 'string' ? s.preset : d.preset,
    position: s.position === 'top' || s.position === 'middle' || s.position === 'bottom' ? s.position : d.position,
    size: finite(s.size) ? clamp(s.size, 0.025, 0.14) : d.size,
    highlight: s.highlight === 'none' ? 'none' : s.highlight === 'word' ? 'word' : d.highlight,
    color: hex(s.color, d.color),
    highlightColor: hex(s.highlightColor, d.highlightColor),
    box: s.box === true || (s.box === undefined && d.box),
    boxColor: hex(s.boxColor, d.boxColor),
    boxOpacity: finite(s.boxOpacity) ? clamp(s.boxOpacity, 0, 1) : d.boxOpacity,
    uppercase: s.uppercase === true || (s.uppercase === undefined && d.uppercase),
    bold: s.bold !== false,
  }
  if (typeof s.animation === 'string' && (CAPTION_ANIMATIONS as string[]).includes(s.animation)) style.animation = s.animation as CaptionAnimation
  if (s.italic === true) style.italic = true
  if (isRecord(s.outline) && finite(s.outline.size) && s.outline.size > 0) style.outline = { size: clamp(s.outline.size, 0, 0.2), color: hex(s.outline.color, '#000000') }
  if (isRecord(s.shadow) && finite(s.shadow.depth) && finite(s.shadow.alpha) && s.shadow.alpha > 0) style.shadow = { depth: clamp(s.shadow.depth, 0, 0.2), alpha: clamp(s.shadow.alpha, 0, 1), color: hex(s.shadow.color, '#000000') }
  if (finite(s.letterSpacing) && s.letterSpacing !== 0) style.letterSpacing = clamp(s.letterSpacing, -0.05, 0.3)
  if (finite(s.wordSpacing) && s.wordSpacing > 0) style.wordSpacing = clamp(s.wordSpacing, 0, 1)
  if (s.windowed === true) style.windowed = true
  if (typeof s.category === 'string' && s.category.length <= 30) style.category = s.category
  if (finite(s.positionY)) style.positionY = clamp(s.positionY, 0.04, 0.96)
  Object.assign(style, normalizeCustom(s))
  const studio = cleanStudioCaptions(raw.studio)
  return { enabled: raw.enabled === true, cues: normalizeCues(raw.cues), style, ...(studio ? { studio } : {}), ...(typeof raw.language === 'string' && LANGUAGE_CODE.test(raw.language) ? { language: raw.language } : {}) }
}

// ── turning a script or subtitles into timed lines ──────────────────────────────────────────────────────────────
const parseTime = (t: string): number | null => {
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/.exec(t.trim())
  if (!m) return null
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, '0')) / 1000
}

/** Reads SRT (or WebVTT-style) subtitles. Returns [] when the text is not subtitles. */
export function parseSubtitles(text: string): CaptionCue[] {
  const blocks = text.replace(/\r/g, '').split(/\n{2,}/)
  const cues: CaptionCue[] = []
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
    const timeIdx = lines.findIndex((l) => l.includes('-->'))
    if (timeIdx < 0) continue
    const [a, b] = lines[timeIdx].split('-->').map((x) => x.trim().split(/\s+/)[0])
    const start = parseTime(a)
    const end = parseTime(b)
    const body = lines.slice(timeIdx + 1).join(' ').replace(/<[^>]+>/g, '').trim()
    if (start === null || end === null || end <= start || !body) continue
    cues.push({ id: `cue_${cues.length}`, start, end, text: body })
  }
  return normalizeCues(cues)
}

/** Splits a plain script into lines of about `wordsPerCue` words (breaking at sentence ends when close) and spreads them over `durationSec`. */
export function scriptToCues(script: string, durationSec: number, wordsPerCue = 6): CaptionCue[] {
  const words = script.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  if (words.length === 0 || !(durationSec > 0)) return []
  const groups: string[][] = []
  let cur: string[] = []
  for (const w of words) {
    cur.push(w)
    const sentenceEnd = /[.!?]$/.test(w) && cur.length >= Math.ceil(wordsPerCue / 2)
    if (cur.length >= wordsPerCue || sentenceEnd) { groups.push(cur); cur = [] }
  }
  if (cur.length) { if (groups.length && cur.length < 3) groups[groups.length - 1].push(...cur); else groups.push(cur) }
  const total = groups.reduce((n, g) => n + g.join(' ').length, 0)
  let t = 0
  return normalizeCues(groups.map((g, i) => {
    const len = (g.join(' ').length / total) * durationSec
    const cue = { id: `cue_${i}`, start: t, end: Math.min(durationSec, t + len), text: g.join(' ') }
    t += len
    return cue
  }))
}

/** Subtitles if the text looks like SRT, otherwise a script spread over the video. */
export function cuesFromText(text: string, durationSec: number): CaptionCue[] {
  if (text.includes('-->')) {
    const subs = parseSubtitles(text)
    if (subs.length) return subs
  }
  return scriptToCues(text, durationSec)
}

// ── what is on screen at a frame ──────────────────────────────────────────────────────────────────────────────────
export function activeCue(cues: readonly CaptionCue[], frame: number, fps: number): CaptionCue | null {
  const t = frame / Math.max(1, fps)
  return cues.find((c) => t >= c.start && t < c.end) ?? null
}

export interface CaptionWord {
  text: string
  active: boolean
  /** Seconds since this word became the spoken one (0 when it is not). */
  elapsed?: number
  /** 0..1 through the spoken word (used by the karaoke wipe). */
  progress?: number
}

/** The words of a cue, with the one being spoken at `frame` marked. Words share the line's time in proportion to their length. */
export function captionWords(cue: CaptionCue, frame: number, fps: number, highlight: CaptionHighlight): CaptionWord[] {
  const words = cue.text.split(/\s+/).filter(Boolean)
  if (highlight === 'none') return words.map((text) => ({ text, active: false }))
  // Words timed from the speech: highlight exactly the word being said (only while the words still spell the line).
  if (cue.words && cue.words.length === words.length && cue.words.every((w, i) => w.text === words[i])) {
    const t = frame / Math.max(1, fps)
    let activeIdx = 0
    cue.words.forEach((w, i) => { if (t >= w.start) activeIdx = i })
    const aw = cue.words[activeIdx]
    return words.map((text, i) => (i === activeIdx
      ? { text, active: true, elapsed: Math.max(0, t - aw.start), progress: clamp((t - aw.start) / Math.max(0.001, aw.end - aw.start), 0, 1) }
      : { text, active: false }))
  }
  const progress = clamp((frame / Math.max(1, fps) - cue.start) / Math.max(0.001, cue.end - cue.start), 0, 0.9999)
  const weights = words.map((w) => w.length + 1)
  const total = weights.reduce((a, b) => a + b, 0)
  let acc = 0
  let activeIdx = words.length - 1
  let wordStart = 0
  let wordEnd = 1
  for (let i = 0; i < words.length; i++) {
    const before = acc
    acc += weights[i] / total
    if (progress < acc) { activeIdx = i; wordStart = before; wordEnd = acc; break }
    wordStart = before; wordEnd = acc
  }
  const span = Math.max(0.0001, wordEnd - wordStart)
  const cueSec = Math.max(0.001, cue.end - cue.start)
  return words.map((text, i) => (i === activeIdx
    ? { text, active: true, elapsed: Math.max(0, (progress - wordStart) * cueSec), progress: clamp((progress - wordStart) / span, 0, 1) }
    : { text, active: false }))
}

/** Entrance of a line: rises and fades in over the first few frames. */
export function cueEntrance(cue: CaptionCue, frame: number, fps: number): { opacity: number; rise: number } {
  const p = clamp((frame / Math.max(1, fps) - cue.start) / 0.18, 0, 1)
  const e = 1 - (1 - p) ** 3
  return { opacity: e, rise: (1 - e) * 0.012 }
}

export function newCue(start: number, end: number, text = 'New line'): CaptionCue {
  return { id: `cue_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, start, end, text }
}

// ── subtitle files (Capite's exporter, fed with our lines) ───────────────────────────────────────────────────────
const toTranscript = (cues: readonly CaptionCue[]) => ({ language: 'en', segments: cues.map((c) => ({ id: c.id, start: c.start, end: c.end, text: c.text, words: [] })) })
export const cuesToSrt = (cues: readonly CaptionCue[]): string => transcriptToSrt(toTranscript(cues))
export const cuesToVtt = (cues: readonly CaptionCue[]): string => transcriptToVtt(toTranscript(cues))
