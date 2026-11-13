/**
 * Captions for personalized videos (Stage 6): validated cues, SRT/VTT import and export, word-highlight pages, quality
 * checks, scene-cut detection and codec classification. Pure: no React, no Remotion rendering, no clock.
 *
 * Times are milliseconds from the START OF THE VIDEO (the composition's frame 0). The composition draws the page that is
 * showing at the current frame, so the Player, the stage and the export show the same words at the same moments.
 * Transcription is real or absent: nothing here invents text.
 */
import { parseSrt, parseVtt, type Caption } from '@remotion/captions'

export interface CaptionCue { text: string; startMs: number; endMs: number }

export type CaptionPosition = 'top' | 'middle' | 'bottom'
export type HighlightMode = 'none' | 'active' | 'karaoke'

export interface CaptionStyle {
  preset: string
  /** Font size as a percentage of the frame height. */
  fontSize: number
  position: CaptionPosition
  color: string
  highlightColor: string
  highlight: HighlightMode
  uppercase: boolean
  bold: boolean
  stroke: boolean
  background: boolean
  backgroundColor: string
  /** Word-level cues starting within this window of the page's first word share a page. */
  combineMs: number
}

export type CaptionSource = 'srt' | 'vtt' | 'typed' | 'transcribed'

export interface CaptionTrack {
  enabled: boolean
  cues: CaptionCue[]
  style: CaptionStyle
  source: CaptionSource
}

export const MAX_CUES = 5000
export const MAX_CUE_TEXT = 500
export const MAX_DURATION_MS = 10 * 60 * 60 * 1000
const COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\))$/

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d

export const CAPTION_PRESETS: Record<string, { label: string } & Omit<CaptionStyle, 'preset'>> = {
  tiktok: { label: 'Word highlight', fontSize: 6, position: 'bottom', color: '#FFFFFF', highlightColor: '#FFE14D', highlight: 'active', uppercase: true, bold: true, stroke: true, background: false, backgroundColor: 'rgba(0,0,0,0.6)', combineMs: 900 },
  classic: { label: 'Classic subtitles', fontSize: 4.6, position: 'bottom', color: '#FFFFFF', highlightColor: '#FFFFFF', highlight: 'none', uppercase: false, bold: false, stroke: false, background: true, backgroundColor: 'rgba(0,0,0,0.6)', combineMs: 2600 },
  box: { label: 'Boxed words', fontSize: 5.4, position: 'bottom', color: '#FFFFFF', highlightColor: '#EB5054', highlight: 'active', uppercase: false, bold: true, stroke: false, background: true, backgroundColor: 'rgba(0,0,0,0.6)', combineMs: 1200 },
  karaoke: { label: 'Karaoke', fontSize: 6, position: 'middle', color: 'rgba(255,255,255,0.55)', highlightColor: '#FFFFFF', highlight: 'karaoke', uppercase: true, bold: false, stroke: true, background: false, backgroundColor: 'rgba(0,0,0,0.6)', combineMs: 1600 },
  minimal: { label: 'Minimal', fontSize: 4.2, position: 'bottom', color: '#FFFFFF', highlightColor: '#FFFFFF', highlight: 'none', uppercase: false, bold: false, stroke: true, background: false, backgroundColor: 'rgba(0,0,0,0.6)', combineMs: 2000 },
}

export function defaultCaptionStyle(preset = 'tiktok'): CaptionStyle {
  const p = CAPTION_PRESETS[preset] ?? CAPTION_PRESETS.tiktok
  const { label: _l, ...rest } = p
  void _l
  return { preset: CAPTION_PRESETS[preset] ? preset : 'tiktok', ...rest }
}

export function normalizeCue(raw: unknown): CaptionCue | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.text !== 'string' || !finite(r.startMs)) return null
  const startMs = Math.round(clamp(r.startMs, 0, MAX_DURATION_MS))
  const endMs = Math.round(clamp(finite(r.endMs) ? r.endMs : startMs + 500, startMs + 1, MAX_DURATION_MS + 1))
  const text = r.text.replace(/\r/g, '').slice(0, MAX_CUE_TEXT)
  if (!text.trim()) return null
  return { text, startMs, endMs }
}

export function normalizeCues(raw: unknown): CaptionCue[] {
  if (!Array.isArray(raw)) return []
  const out: CaptionCue[] = []
  for (const c of raw) { if (out.length >= MAX_CUES) break; const n = normalizeCue(c); if (n) out.push(n) }
  return out.sort((a, b) => a.startMs - b.startMs)
}

export function normalizeCaptionStyle(raw: unknown): CaptionStyle {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const preset = typeof r.preset === 'string' && CAPTION_PRESETS[r.preset] ? r.preset : 'tiktok'
  const d = defaultCaptionStyle(preset)
  const color = (v: unknown, f: string) => (typeof v === 'string' && COLOR.test(v.trim()) ? v.trim() : f)
  const pos = r.position === 'top' || r.position === 'middle' || r.position === 'bottom' ? r.position : d.position
  const hl = r.highlight === 'none' || r.highlight === 'active' || r.highlight === 'karaoke' ? r.highlight : d.highlight
  return {
    preset, position: pos, highlight: hl,
    fontSize: round(clamp(finite(r.fontSize) ? r.fontSize : d.fontSize, 2, 14), 1),
    color: color(r.color, d.color), highlightColor: color(r.highlightColor, d.highlightColor), backgroundColor: color(r.backgroundColor, d.backgroundColor),
    uppercase: typeof r.uppercase === 'boolean' ? r.uppercase : d.uppercase, bold: typeof r.bold === 'boolean' ? r.bold : d.bold,
    stroke: typeof r.stroke === 'boolean' ? r.stroke : d.stroke, background: typeof r.background === 'boolean' ? r.background : d.background,
    combineMs: Math.round(clamp(finite(r.combineMs) ? r.combineMs : d.combineMs, 100, 6000)),
  }
}

export function normalizeCaptionTrack(raw: unknown): CaptionTrack | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const r = raw as Record<string, unknown>
  const source: CaptionSource = r.source === 'srt' || r.source === 'vtt' || r.source === 'transcribed' ? r.source : 'typed'
  return { enabled: r.enabled !== false, cues: normalizeCues(r.cues), style: normalizeCaptionStyle(r.style), source }
}

// ── import / export ─────────────────────────────────────────────────────────────────────────────────────────────

export class CaptionParseError extends Error {
  constructor(message: string) { super(message); this.name = 'CaptionParseError' }
}

/** Parses SRT or VTT text. Throws CaptionParseError with a plain message when nothing usable is found. */
export function parseCaptionFile(text: string, fileName = ''): { cues: CaptionCue[]; format: 'srt' | 'vtt' } {
  const src = String(text || '').replace(/^﻿/, '')
  if (!src.trim()) throw new CaptionParseError('The file is empty.')
  if (src.length > 5_000_000) throw new CaptionParseError('The file is too large to be a subtitle file.')
  const format = /\.vtt$/i.test(fileName) || /^WEBVTT/.test(src.trim()) ? 'vtt' : 'srt'
  let captions: Caption[] = []
  try { captions = (format === 'vtt' ? parseVtt({ input: src }) : parseSrt({ input: src })).captions } catch { captions = [] }
  const cues = normalizeCues(captions.map((c) => ({ text: c.text.trim(), startMs: c.startMs, endMs: c.endMs })))
  if (cues.length === 0) throw new CaptionParseError(`No subtitles were found. Check that this is a ${format.toUpperCase()} file with times like 00:00:01,000 --> 00:00:03,000.`)
  return { cues, format }
}

const pad = (n: number, w: number) => String(n).padStart(w, '0')
const clock = (ms: number, sep: ',' | '.') => { const t = Math.max(0, Math.round(ms)); return `${pad(Math.floor(t / 3600000), 2)}:${pad(Math.floor((t % 3600000) / 60000), 2)}:${pad(Math.floor((t % 60000) / 1000), 2)}${sep}${pad(t % 1000, 3)}` }

/** What viewers read: word-level cues are joined into the same pages the video shows. */
export function readableCues(cues: CaptionCue[], style: Pick<CaptionStyle, 'combineMs'>): CaptionCue[] {
  return captionPages(cues, style).map((p) => ({ text: p.text.trim(), startMs: p.startMs, endMs: p.startMs + p.durationMs }))
}

export function cuesToSrt(cues: CaptionCue[], style: Pick<CaptionStyle, 'combineMs'> = { combineMs: 0 }): string {
  const list = style.combineMs > 0 ? readableCues(cues, style) : cues
  return list.map((c, i) => `${i + 1}\n${clock(c.startMs, ',')} --> ${clock(c.endMs, ',')}\n${c.text.trim()}\n`).join('\n')
}
export function cuesToVtt(cues: CaptionCue[], style: Pick<CaptionStyle, 'combineMs'> = { combineMs: 0 }): string {
  const list = style.combineMs > 0 ? readableCues(cues, style) : cues
  return `WEBVTT\n\n${list.map((c) => `${clock(c.startMs, '.')} --> ${clock(c.endMs, '.')}\n${c.text.trim()}`).join('\n\n')}\n`
}

// ── pages and word highlight ─────────────────────────────────────────────────────────────────────────────────────

export interface CaptionToken { text: string; fromMs: number; toMs: number }
export interface CaptionPage { text: string; startMs: number; durationMs: number; tokens: CaptionToken[] }

/** A silence this long between two words always starts a new page, so a caption never stays up through a pause. */
export const PAGE_GAP_MS = 700
export const PAGE_MAX_WORDS = 8
export const PAGE_MAX_CHARS = 42

/**
 * Groups cues into pages.
 *  - A sentence cue (text with spaces) is ONE page; its words share the cue's time in proportion to their length, so
 *    word highlight works on subtitle files too.
 *  - Word cues are grouped until the page is `combineMs` old, a pause of PAGE_GAP_MS passes, or it is full.
 */
export function captionPages(cues: CaptionCue[], style: Pick<CaptionStyle, 'combineMs'>): CaptionPage[] {
  const sorted = [...cues].sort((a, b) => a.startMs - b.startMs)
  const pages: CaptionPage[] = []
  let cur: CaptionToken[] = []
  const flush = () => {
    if (!cur.length) return
    const startMs = cur[0].fromMs, endMs = cur[cur.length - 1].toMs
    pages.push({ text: cur.map((t, i) => (i ? ' ' : '') + t.text).join(''), startMs, durationMs: Math.max(1, endMs - startMs), tokens: cur.map((t, i) => ({ ...t, text: (i ? ' ' : '') + t.text })) })
    cur = []
  }
  for (const c of sorted) {
    const text = c.text.trim()
    if (!text) continue
    if (/\S\s+\S/.test(text)) {
      flush()
      const ws = text.split(/\s+/); const total = ws.reduce((n, w) => n + w.length, 0) || 1; let at = c.startMs
      const toks = ws.map((w) => { const len = ((c.endMs - c.startMs) * w.length) / total; const t = { text: w, fromMs: Math.round(at), toMs: Math.round(at + len) }; at += len; return t })
      toks[toks.length - 1].toMs = c.endMs
      pages.push({ text: ws.join(' '), startMs: c.startMs, durationMs: Math.max(1, c.endMs - c.startMs), tokens: toks.map((t, i) => ({ ...t, text: (i ? ' ' : '') + t.text })) })
      continue
    }
    const last = cur[cur.length - 1]
    const chars = cur.reduce((n, t) => n + t.text.length + 1, 0)
    if (last && (c.startMs - last.toMs > PAGE_GAP_MS || c.startMs - cur[0].fromMs >= clamp(style.combineMs, 100, 6000) || cur.length >= PAGE_MAX_WORDS || chars + text.length > PAGE_MAX_CHARS)) flush()
    cur.push({ text, fromMs: c.startMs, toMs: c.endMs })
  }
  flush()
  return pages
}

/** The page showing at `ms` (it stays up `holdMs` after its last word), or null. */
export function pageAt(pages: CaptionPage[], ms: number, holdMs = 400): CaptionPage | null {
  for (let i = pages.length - 1; i >= 0; i -= 1) {
    const p = pages[i]
    if (ms >= p.startMs) {
      const last = p.tokens.length ? p.tokens[p.tokens.length - 1].toMs : p.startMs + p.durationMs
      return ms < Math.max(p.startMs + p.durationMs, last + holdMs) ? p : null
    }
  }
  return null
}

export type WordState = 'active' | 'spoken' | 'upcoming'
export function wordState(token: { fromMs: number; toMs: number }, ms: number): WordState {
  if (ms >= token.fromMs && ms < token.toMs) return 'active'
  return ms >= token.toMs ? 'spoken' : 'upcoming'
}

/** The colour of a word at `ms` for the style's highlight mode. */
export function wordColor(style: CaptionStyle, token: { fromMs: number; toMs: number }, ms: number): string {
  const s = wordState(token, ms)
  if (style.highlight === 'active') return s === 'active' ? style.highlightColor : style.color
  if (style.highlight === 'karaoke') return s === 'upcoming' ? style.color : style.highlightColor
  return style.color
}

export interface CaptionLayout { fontPx: number; bottomPx: number | null; topPx: number | null; centered: boolean; maxWidthPx: number }
/** Where the caption block sits. Sizes follow the frame height so every export size looks the same. */
export function captionLayout(style: Pick<CaptionStyle, 'fontSize' | 'position'>, compW: number, compH: number): CaptionLayout {
  const fontPx = Math.round(compH * (style.fontSize / 100) * 10) / 10
  const margin = Math.round(compH * 0.07)
  return {
    fontPx, maxWidthPx: Math.round(compW * 0.88), centered: style.position === 'middle',
    bottomPx: style.position === 'bottom' ? margin : null, topPx: style.position === 'top' ? margin : null,
  }
}

// ── editing and quality ──────────────────────────────────────────────────────────────────────────────────────────

export function addCue(cues: CaptionCue[], atMs: number, lengthMs = 2000, text = 'New caption'): CaptionCue[] {
  const c = normalizeCue({ text, startMs: atMs, endMs: atMs + lengthMs })
  return c ? normalizeCues([...cues, c]) : cues
}
export function updateCue(cues: CaptionCue[], index: number, patch: Partial<CaptionCue>): CaptionCue[] {
  if (!cues[index]) return cues
  const next = [...cues]; const merged = normalizeCue({ ...cues[index], ...patch })
  if (!merged) return cues
  next[index] = merged
  return normalizeCues(next)
}
export function deleteCue(cues: CaptionCue[], index: number): CaptionCue[] { return cues.filter((_, i) => i !== index) }
export function shiftCues(cues: CaptionCue[], deltaMs: number): CaptionCue[] {
  return normalizeCues(cues.map((c) => ({ ...c, startMs: c.startMs + deltaMs, endMs: c.endMs + deltaMs })).filter((c) => c.endMs > 0))
}
/** Splits a cue at its middle word boundary, dividing the time in proportion to the words. */
export function splitCue(cues: CaptionCue[], index: number): CaptionCue[] {
  const c = cues[index]; if (!c) return cues
  const words = c.text.trim().split(/\s+/)
  if (words.length < 2) return cues
  const cut = Math.floor(words.length / 2)
  const mid = Math.round(c.startMs + ((c.endMs - c.startMs) * cut) / words.length)
  return normalizeCues([...cues.slice(0, index), { text: words.slice(0, cut).join(' '), startMs: c.startMs, endMs: mid }, { text: words.slice(cut).join(' '), startMs: mid, endMs: c.endMs }, ...cues.slice(index + 1)])
}
export function mergeCues(cues: CaptionCue[], index: number): CaptionCue[] {
  const a = cues[index], b = cues[index + 1]; if (!a || !b) return cues
  return normalizeCues([...cues.slice(0, index), { text: `${a.text.trim()} ${b.text.trim()}`, startMs: a.startMs, endMs: Math.max(a.endMs, b.endMs) }, ...cues.slice(index + 2)])
}

export type CaptionProblemKind = 'overlap' | 'past-end' | 'too-fast' | 'too-long' | 'too-short'
export interface CaptionProblem { index: number; kind: CaptionProblemKind; message: string }

export const MAX_CPS = 20
export const MAX_LINE_CHARS = 42
export const MIN_CUE_MS = 300

/** Checks sentence-level cues for the things viewers notice. Word-level cues (single words) are only checked for overlap and the end. */
export function captionProblems(cues: CaptionCue[], videoMs: number): CaptionProblem[] {
  const out: CaptionProblem[] = []
  cues.forEach((c, i) => {
    const text = c.text.trim(); const dur = c.endMs - c.startMs; const sentence = /\S\s+\S/.test(text)
    if (c.startMs >= videoMs) out.push({ index: i, kind: 'past-end', message: `Starts after the video ends (${(c.startMs / 1000).toFixed(1)} s).` })
    else if (c.endMs > videoMs + 50) out.push({ index: i, kind: 'past-end', message: 'Runs past the end of the video.' })
    const prev = cues[i - 1]
    if (prev && sentence && /\S\s+\S/.test(prev.text.trim()) && c.startMs < prev.endMs) out.push({ index: i, kind: 'overlap', message: 'Overlaps the caption before it.' })
    if (sentence) {
      if (text.length / (dur / 1000) > MAX_CPS) out.push({ index: i, kind: 'too-fast', message: `Too fast to read (${Math.round(text.length / (dur / 1000))} characters per second; keep under ${MAX_CPS}).` })
      if (text.split('\n').some((l) => l.length > MAX_LINE_CHARS) || (!text.includes('\n') && text.length > MAX_LINE_CHARS * 2)) out.push({ index: i, kind: 'too-long', message: `Very long line (over ${MAX_LINE_CHARS} characters).` })
      if (dur < MIN_CUE_MS) out.push({ index: i, kind: 'too-short', message: 'Shows for less than 0.3 s.' })
    }
  })
  return out
}

/** Real transcription output (Whisper chunks) → word cues; empty words dropped, never invented. */
export function chunksToCues(chunks: Array<{ text?: string; timestamp?: [number, number | null] }>): CaptionCue[] {
  const out: CaptionCue[] = []
  for (const ch of chunks) {
    const text = String(ch.text ?? '').trim(); if (!text || !ch.timestamp) continue
    const [s, e] = ch.timestamp; if (!finite(s)) continue
    const c = normalizeCue({ text, startMs: s * 1000, endMs: (finite(e) ? e : s + 0.3) * 1000 }); if (c) out.push(c)
  }
  return normalizeCues(out)
}

// ── scene cuts (pure; frames are sampled by the caller) ──────────────────────────────────────────────────────────

export interface SceneParams { /** 0..1: higher = fewer cuts. */ threshold: number; minSceneSec: number }
export const DEFAULT_SCENE_PARAMS: SceneParams = { threshold: 0.5, minSceneSec: 0.8 }

/** Mean absolute difference between two same-size luma frames, 0..1. */
export function lumaDifference(a: Uint8Array | Uint8ClampedArray, b: Uint8Array | Uint8ClampedArray): number {
  const n = Math.min(a.length, b.length); if (!n) return 0
  let s = 0; for (let i = 0; i < n; i += 1) s += Math.abs(a[i] - b[i])
  return s / n / 255
}

/**
 * Cut times (seconds) from consecutive frame differences. A cut is a difference that is both large in absolute terms and
 * much larger than its neighbours (so a camera move, a fade or a flash is not a cut), at least `minSceneSec` after the last.
 */
export function detectCuts(diffs: number[], times: number[], params: SceneParams = DEFAULT_SCENE_PARAMS): number[] {
  const cuts: number[] = []
  const floor = 0.04 + 0.2 * clamp(params.threshold, 0, 1) // absolute: a cut changes at least this much of the picture
  const ratio = 2 + 4 * clamp(params.threshold, 0, 1) // relative: and is this many times the local activity
  for (let i = 0; i < diffs.length; i += 1) {
    const d = diffs[i]; if (d < floor) continue
    const around: number[] = []; for (let k = Math.max(0, i - 4); k <= Math.min(diffs.length - 1, i + 4); k += 1) if (k !== i) around.push(diffs[k])
    const local = around.length ? around.reduce((x, y) => x + y, 0) / around.length : 0
    if (d < Math.max(local, 0.005) * ratio) continue
    if (diffs.slice(Math.max(0, i - 1), i).some((x) => x > d)) continue // not the biggest of its neighbours → not this frame
    if (diffs[i + 1] !== undefined && diffs[i + 1] > d) continue
    const t = times[i + 1] ?? times[i]
    if (cuts.length && t - cuts[cuts.length - 1] < params.minSceneSec) continue
    cuts.push(Math.round(t * 1000) / 1000)
  }
  return cuts
}

// ── codec classification (no media access: works on codec strings) ──────────────────────────────────────────────

export interface CodecAdvice { family: string; level: 'ok' | 'warn' | 'bad'; message: string }
export function classifyVideoCodec(codec: string | null | undefined): CodecAdvice {
  const c = (codec ?? '').toLowerCase()
  if (!c) return { family: 'unknown', level: 'warn', message: 'The video codec could not be read.' }
  if (/^avc|h\.?264|^avc1/.test(c)) return { family: 'H.264', level: 'ok', message: 'H.264 plays and exports everywhere.' }
  if (/^vp9|^vp09/.test(c)) return { family: 'VP9', level: 'ok', message: 'VP9 plays in current Chrome, Edge and Firefox.' }
  if (/^vp8/.test(c)) return { family: 'VP8', level: 'ok', message: 'VP8 plays in all current browsers.' }
  if (/^av01|av1/.test(c)) return { family: 'AV1', level: 'warn', message: 'AV1 needs a recent browser; older ones cannot decode it.' }
  if (/^hev|^hvc|h\.?265|hevc/.test(c)) return { family: 'HEVC', level: 'warn', message: 'HEVC (H.265) only decodes in some browsers (Safari, and Chrome with hardware support). Convert to H.264 for reliable results.' }
  if (/prores|mpeg|mjpeg|dnx/.test(c)) return { family: c, level: 'bad', message: 'Browsers cannot decode this codec. Convert the video to H.264 (MP4) first.' }
  return { family: c, level: 'warn', message: `Unrecognised codec "${c}". If the preview stays black, convert to H.264 (MP4).` }
}
