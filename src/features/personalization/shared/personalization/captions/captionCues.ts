/**
 * Turn word-level speech-to-text output into readable caption lines and the two file formats every platform accepts
 * (SRT and WebVTT). Pure: no browser APIs, so it is fully testable. The transcription itself runs on the viewer's own
 * device (see `localAI/engine.ts`).
 */
export interface WordCaption { text: string; startMs: number; endMs: number }
export interface CaptionCue { startMs: number; endMs: number; text: string; /** Per-word times, when known (lets a style highlight the word being spoken). */ words?: WordCaption[] }

/** A caption line breaks when it gets this long, lasts this long, or the speaker pauses this long. */
export const MAX_WORDS_PER_CUE = 8
export const MAX_CUE_MS = 3500
export const PAUSE_BREAK_MS = 700
/** A cue stays up at least this long so it can be read. */
export const MIN_CUE_MS = 800

const clean = (t: string) => t.replace(/\s+/g, ' ').trim()

/** Groups words into cues. Skips empty words, repairs reversed times, and keeps cues in order without overlap. */
export function groupCaptionCues(words: WordCaption[]): CaptionCue[] {
  const ordered = words
    .map((w) => ({ text: clean(String(w?.text ?? '')), startMs: Number(w?.startMs), endMs: Number(w?.endMs) }))
    .filter((w) => w.text && Number.isFinite(w.startMs) && Number.isFinite(w.endMs))
    .map((w) => ({ ...w, startMs: Math.max(0, w.startMs), endMs: Math.max(w.endMs, w.startMs) }))
    .sort((a, b) => a.startMs - b.startMs)
  const cues: CaptionCue[] = []
  let cur: { words: string[]; timed: WordCaption[]; startMs: number; endMs: number } | null = null
  const flush = () => {
    if (!cur) return
    cues.push({ startMs: cur.startMs, endMs: Math.max(cur.endMs, cur.startMs + MIN_CUE_MS), text: cur.words.join(' '), words: cur.timed })
    cur = null
  }
  for (const w of ordered) {
    if (cur) {
      const gap = w.startMs - cur.endMs
      const tooLong = w.endMs - cur.startMs > MAX_CUE_MS
      const sentenceEnd = /[.!?]$/.test(cur.words[cur.words.length - 1])
      if (gap > PAUSE_BREAK_MS || tooLong || cur.words.length >= MAX_WORDS_PER_CUE || (sentenceEnd && cur.words.length >= 3)) flush()
    }
    if (!cur) cur = { words: [], timed: [], startMs: w.startMs, endMs: w.endMs }
    cur.words.push(w.text)
    cur.timed.push({ text: w.text, startMs: w.startMs, endMs: w.endMs })
    cur.endMs = Math.max(cur.endMs, w.endMs)
  }
  flush()
  // A held-open cue must never run into the next one.
  for (let i = 0; i < cues.length - 1; i++) if (cues[i].endMs > cues[i + 1].startMs) cues[i].endMs = Math.max(cues[i].startMs + 1, cues[i + 1].startMs)
  return cues
}

function pad(n: number, len = 2) { return String(Math.floor(n)).padStart(len, '0') }

/** `00:01:02,345` (SRT) or `00:01:02.345` (WebVTT). */
export function formatTimestamp(ms: number, separator: ',' | '.' = ','): string {
  const total = Math.max(0, Math.round(ms))
  return `${pad(total / 3600000)}:${pad((total % 3600000) / 60000)}:${pad((total % 60000) / 1000)}${separator}${pad(total % 1000, 3)}`
}

export function cuesToSrt(cues: CaptionCue[]): string {
  return cues.map((c, i) => `${i + 1}\n${formatTimestamp(c.startMs)} --> ${formatTimestamp(c.endMs)}\n${c.text}`).join('\n\n') + (cues.length ? '\n' : '')
}

export function cuesToVtt(cues: CaptionCue[]): string {
  return `WEBVTT\n\n${cues.map((c) => `${formatTimestamp(c.startMs, '.')} --> ${formatTimestamp(c.endMs, '.')}\n${c.text}`).join('\n\n')}${cues.length ? '\n' : ''}`
}

/** The whole transcript as plain text, one line per cue. */
export function cuesToText(cues: CaptionCue[]): string {
  return cues.map((c) => c.text).join('\n')
}

/** "0:07" style label for the list. */
export function clockLabel(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${pad(s % 60)}`
}

/** `1:02.345`, `00:01:02,345` or `00:01:02.345` to milliseconds, or null when it is not a time. */
export function parseTimestamp(raw: string): number | null {
  const m = /^(?:(\d{1,3}):)?(\d{1,2}):(\d{1,2})[,.](\d{1,3})$/.exec(raw.trim())
  if (!m) return null
  const ms = Number(m[4].padEnd(3, '0'))
  return (Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000 + ms
}

/** Largest caption file read, so a wrong file cannot freeze the page. */
export const MAX_CAPTION_FILE_CHARS = 400_000

/**
 * Cues from the text of an .srt or .vtt file. Tolerant: ignores the WEBVTT header, NOTE/STYLE blocks, cue ids and
 * positioning settings, strips markup tags, and skips any block that has no readable time or text. Cues come back in
 * time order with no per-word times (so a look cannot pick out the spoken word on imported captions).
 */
export function parseCaptionFile(raw: string): CaptionCue[] {
  const text = String(raw ?? '').slice(0, MAX_CAPTION_FILE_CHARS).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const cues: CaptionCue[] = []
  for (const block of text.split(/\n{2,}/)) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
    const at = lines.findIndex((l) => l.includes('-->'))
    if (at < 0 || /^(NOTE|STYLE|REGION)\b/.test(lines[0])) continue
    const [from, rest] = lines[at].split('-->')
    const startMs = parseTimestamp(from), endMs = parseTimestamp((rest ?? '').trim().split(/\s+/)[0] ?? '')
    const body = clean(lines.slice(at + 1).join(' ').replace(/<[^>]*>/g, ''))
    if (startMs === null || endMs === null || !body) continue
    cues.push({ startMs, endMs: Math.max(endMs, startMs + 1), text: body })
  }
  return cues.sort((a, b) => a.startMs - b.startMs)
}
