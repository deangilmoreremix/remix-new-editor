/**
 * The bridge between the Caption Studio and this editor's own captions. The Studio makes the words (on-device transcription, with the time of
 * every word) and a look; this file turns that into `CaptionSettings` (lines + style) the existing layer already draws, and back, so a person can
 * reopen the Studio on captions they made or pasted. Pure: no browser code, fully testable. The Studio's font is deliberately not carried over:
 * this editor draws every caption in its one bundled font so the preview and the export always match.
 */
import {
  CAPTION_ANIMATIONS, DEFAULT_CAPTION_STYLE, MAX_CUES, captionPreset,
  type CaptionAnimation, type CaptionCue, type CaptionPosition, type CaptionSettings, type CaptionStyle, type CaptionWordTiming,
} from './captions'

export interface StudioPage { startMs: number; durationMs: number; tokens: { text: string; fromMs: number; toMs: number }[] }
/** What `studioPayload()` in the Caption Studio returns. */
export interface StudioPayload { pages: StudioPage[]; style: Record<string, unknown> }
type Brand = { primary: string; accent: string; text: string }

/** The only font the Studio may offer here (the editor's bundled Inter subset). */
export const STUDIO_FONTS: readonly string[] = Object.freeze(['Inter'])

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** `#rgb`, `#rrggbb`, `rgb()` or `rgba()` → { hex, alpha }; null when it is not a colour. */
export function parseColor(v: unknown): { hex: string; alpha: number } | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  if (/^#[0-9a-f]{6}$/i.test(t)) return { hex: t.toLowerCase(), alpha: 1 }
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(t)
  if (short) return { hex: `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase(), alpha: 1 }
  const m = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(t)
  if (!m) return null
  const h = (n: string) => clamp(Number(n), 0, 255).toString(16).padStart(2, '0')
  return { hex: `#${h(m[1])}${h(m[2])}${h(m[3])}`, alpha: m[4] === undefined ? 1 : clamp(Number(m[4]), 0, 1) }
}
const hexOr = (v: unknown, fallback: string) => parseColor(v)?.hex ?? fallback

/** Studio looks that are not one of the 27 Capite looks, mapped to this editor's own presets. */
const BASIC_TO_PRESET: Record<string, string> = { tiktok: 'karaoke', classic: 'clean', box: 'boxed', karaoke: 'karaoke', minimal: 'clean' }
const PRESET_TO_BASIC: Record<string, string> = { karaoke: 'tiktok', clean: 'classic', boxed: 'box', brand: 'classic', headline: 'tiktok' }

/** Studio pages + style → captions (lines with exact word times, and the style). `truncated` is true when the video has more lines than a project keeps. */
export function studioToCaptionSettings(payload: StudioPayload, brand: Brand): { settings: CaptionSettings; truncated: boolean } {
  const cues: CaptionCue[] = []
  for (const page of payload.pages) {
    const words: CaptionWordTiming[] = page.tokens
      .map((t) => ({ text: t.text.trim(), start: Math.max(0, t.fromMs / 1000), end: Math.max(0, t.toMs / 1000) }))
      .filter((w) => w.text)
      .map((w) => ({ ...w, end: Math.max(w.start, w.end) }))
    if (words.length === 0) continue
    const start = words[0].start
    cues.push({ id: `cue_${cues.length}`, start, end: Math.max(words[words.length - 1].end, start + 0.1), text: words.map((w) => w.text).join(' '), words })
  }
  cues.sort((a, b) => a.start - b.start)
  // The layer shows the first line that covers a moment, so lines must not overlap.
  cues.forEach((c, i) => { const next = cues[i + 1]; if (next && c.end > next.start) c.end = Math.max(c.start + 0.1, next.start) })
  const truncated = cues.length > MAX_CUES
  return { settings: { enabled: true, cues: cues.slice(0, MAX_CUES), style: studioToCaptionStyle(payload.style, brand) }, truncated }
}

export function studioToCaptionStyle(st: Record<string, unknown>, brand: Brand): CaptionStyle {
  const presetKey = typeof st.preset === 'string' ? st.preset : 'tiktok'
  const baseId = presetKey.startsWith('capite-') ? presetKey : (BASIC_TO_PRESET[presetKey] ?? 'karaoke')
  const base = captionPreset(baseId, brand) ?? DEFAULT_CAPTION_STYLE
  const animation = typeof st.animation === 'string' && (CAPTION_ANIMATIONS as string[]).includes(st.animation) ? (st.animation as CaptionAnimation) : base.animation
  const bg = parseColor(st.backgroundColor)
  const position: CaptionPosition = st.position === 'top' || st.position === 'middle' || st.position === 'bottom' ? st.position : base.position
  const out: CaptionStyle = {
    ...base,
    preset: base.preset,
    position,
    size: clamp((num(st.fontSize) ?? base.size * 100) / 100, 0.025, 0.14),
    highlight: st.highlightActive === false ? 'none' : 'word',
    color: hexOr(st.color, base.color),
    highlightColor: hexOr(st.highlightColor, base.highlightColor),
    uppercase: st.uppercase === true,
    bold: st.bold !== false,
    // The Studio's "background" is a box behind each line (its own boxed-word look is the 'box' animation instead).
    box: st.background === true && animation !== 'box',
    boxColor: bg?.hex ?? base.boxColor,
    boxOpacity: bg ? clamp(bg.alpha, 0, 1) : base.boxOpacity,
  }
  if (animation) out.animation = animation
  else delete out.animation
  if (st.italic === true) out.italic = true
  else delete out.italic
  if (st.stroke === true) out.outline = { size: base.outline?.size ?? 0.06, color: hexOr(st.strokeColor, base.outline?.color ?? '#000000') }
  else delete out.outline
  const y = num(st.positionY)
  if (y !== null) out.positionY = clamp(y, 0.04, 0.96)
  return out
}

/** Existing captions → what the Studio needs to open on them: words with times, and a look. */
export function captionsToStudioInput(c: CaptionSettings): { words: { text: string; startMs: number; endMs: number }[]; style: Record<string, unknown> } {
  const words: { text: string; startMs: number; endMs: number }[] = []
  for (const cue of c.cues) {
    const parts = cue.text.split(/\s+/).filter(Boolean)
    if (parts.length === 0) continue
    if (cue.words && cue.words.length === parts.length && cue.words.every((w, i) => w.text === parts[i])) {
      cue.words.forEach((w) => words.push({ text: w.text, startMs: Math.round(w.start * 1000), endMs: Math.round(w.end * 1000) }))
    } else {
      // No exact times: share the line's time by word length, the same way the layer does.
      const total = parts.reduce((n, w) => n + w.length + 1, 0)
      let t = cue.start
      parts.forEach((text, i) => {
        const end = i === parts.length - 1 ? cue.end : t + ((cue.end - cue.start) * (text.length + 1)) / total
        words.push({ text, startMs: Math.round(t * 1000), endMs: Math.round(end * 1000) })
        t = end
      })
    }
  }
  return { words, style: captionStyleToStudio(c.style) }
}

export function captionStyleToStudio(s: CaptionStyle): Record<string, unknown> {
  const rgba = (hex: string, a: number) => { const p = parseColor(hex)?.hex ?? '#000000'; const n = parseInt(p.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})` }
  return {
    preset: s.preset.startsWith('capite-') ? s.preset : (PRESET_TO_BASIC[s.preset] ?? 'tiktok'),
    fontFamily: STUDIO_FONTS[0],
    fontSize: Math.round(s.size * 1000) / 10,
    position: s.position,
    ...(typeof s.positionY === 'number' ? { positionY: s.positionY } : {}),
    color: s.color,
    highlightColor: s.highlightColor,
    uppercase: s.uppercase,
    bold: s.bold,
    italic: s.italic === true,
    stroke: !!s.outline,
    strokeColor: s.outline?.color ?? '#000000',
    background: s.box && s.animation !== 'box',
    backgroundColor: rgba(s.boxColor, s.boxOpacity),
    highlightActive: s.highlight === 'word',
  }
}
