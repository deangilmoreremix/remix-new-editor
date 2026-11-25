/** SRT / WebVTT parse + serialize (pure; no DOM). Times are seconds. */
export interface Cue { id?: string; start: number; end: number; text: string }

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

export function formatTimestamp(seconds: number, sep: ',' | '.'): string {
  const ms = Math.max(0, Math.round(seconds * 1000))
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(ms % 1000, 3)}`
}

export function parseTimestamp(raw: string): number | null {
  const m = raw.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/)
  if (!m) return null
  const ms = Number(m[4].padEnd(3, '0'))
  return Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + ms / 1000
}

/** Auto-detects SRT vs WebVTT. Malformed blocks are skipped; returns the cues that parsed. */
export function parseSubtitles(input: string): Cue[] {
  const text = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim()
  const blocks = text.split(/\n{2,}/)
  const cues: Cue[] = []
  for (const block of blocks) {
    const lines = block.split('\n')
    const ti = lines.findIndex((l) => l.includes('-->'))
    if (ti < 0) continue
    const [a, bRaw] = lines[ti].split('-->')
    const b = (bRaw || '').trim().split(/\s+/)[0] // drop cue settings (align:, position:)
    const start = parseTimestamp(a)
    const end = parseTimestamp(b)
    if (start === null || end === null || end <= start) continue
    const body = lines.slice(ti + 1).join('\n').replace(/<[^>]+>/g, '').trim()
    if (!body) continue
    cues.push({ id: ti > 0 ? lines[0].trim() : undefined, start, end, text: body })
  }
  return cues.sort((x, y) => x.start - y.start)
}

export function toSrt(cues: Cue[]): string {
  return cues.map((c, i) => `${i + 1}\n${formatTimestamp(c.start, ',')} --> ${formatTimestamp(c.end, ',')}\n${c.text}`).join('\n\n') + '\n'
}

export function toVtt(cues: Cue[], position?: 'top' | 'middle' | 'bottom'): string {
  const line = position === 'top' ? ' line:10%' : position === 'middle' ? ' line:50%' : ''
  return 'WEBVTT\n\n' + cues.map((c, i) => `${c.id || i + 1}\n${formatTimestamp(c.start, '.')} --> ${formatTimestamp(c.end, '.')}${line}\n${c.text}`).join('\n\n') + '\n'
}

/** Shift every cue (e.g. to align with a trimmed start); cues ending before 0 are dropped. */
export function shiftCues(cues: Cue[], deltaSeconds: number): Cue[] {
  return cues
    .map((c) => ({ ...c, start: Math.max(0, c.start + deltaSeconds), end: c.end + deltaSeconds }))
    .filter((c) => c.end > 0 && c.end > c.start)
}

/** Overlaps / bad timings the editor should flag. */
export function validateCues(cues: Cue[]): string[] {
  const issues: string[] = []
  cues.forEach((c, i) => {
    if (c.end <= c.start) issues.push(`Cue ${i + 1} ends before it starts.`)
    if (i > 0 && c.start < cues[i - 1].end) issues.push(`Cue ${i + 1} overlaps the previous cue.`)
    if (c.text.length / Math.max(0.1, c.end - c.start) > 25) issues.push(`Cue ${i + 1} is hard to read (too much text for its duration).`)
  })
  return issues
}
