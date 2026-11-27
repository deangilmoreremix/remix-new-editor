/**
 * The Social Studio subtitle editor keeps cues in seconds ({ start, end, text }); the shared Caption Studio engines (transcription,
 * burned-in rendering) use Remotion-style captions in milliseconds. These two converters are the only place the two meet.
 */
import type { Cue } from './subtitles'

export interface StudioCaption { text: string; startMs: number; endMs: number; timestampMs: number; confidence: number | null }

export function cuesToCaptions(cues: Cue[]): StudioCaption[] {
  return cues
    .filter((c) => c.text.trim() && c.end > c.start)
    .map((c) => {
      const startMs = Math.max(0, Math.round(c.start * 1000))
      const endMs = Math.max(startMs + 1, Math.round(c.end * 1000))
      return { text: c.text, startMs, endMs, timestampMs: Math.round((startMs + endMs) / 2), confidence: null }
    })
    .sort((a, b) => a.startMs - b.startMs)
}

export function captionsToCues(captions: Array<{ text?: string; startMs?: number; endMs?: number }>): Cue[] {
  return (captions || [])
    .map((c) => ({ start: Math.max(0, Number(c.startMs) / 1000), end: Math.max(0, Number(c.endMs) / 1000), text: String(c.text ?? '').trim() }))
    .filter((c) => c.text && Number.isFinite(c.start) && Number.isFinite(c.end) && c.end > c.start)
    .sort((a, b) => a.start - b.start)
}
