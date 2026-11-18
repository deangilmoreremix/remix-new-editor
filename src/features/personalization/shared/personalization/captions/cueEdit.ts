import type { PreviewCaptionCue } from '../preview/types'
import { clampNudge } from './textTools'

/**
 * Editing a caption's times (milliseconds). Pure; no React.
 * Word times that came with the cue are kept where they still fit the new window and trimmed to it, so a small nudge does not throw
 * away the word-by-word timing; words that fall outside are dropped, and the list with them when none are left.
 */
export function retimeCue(cue: PreviewCaptionCue, startMs: number, endMs: number): PreviewCaptionCue {
  const start = Math.max(0, Math.round(startMs))
  const end = Math.max(start + 1, Math.round(endMs))
  const { words, ...rest } = cue
  const kept = (words ?? [])
    .map((w) => ({ ...w, startMs: Math.max(w.startMs, start), endMs: Math.min(w.endMs, end) }))
    .filter((w) => w.endMs > w.startMs)
  return { ...rest, startMs: start, endMs: end, ...(kept.length ? { words: kept } : {}) }
}

/** Moves a caption's start and/or end by the given milliseconds: at least 0.1 s long, never before 0 or after `maxMs` (the video's length). */
export function nudgeCue(cue: PreviewCaptionCue, dStartMs: number, dEndMs: number, maxMs: number): PreviewCaptionCue {
  const [s, e] = clampNudge(cue.startMs / 1000, cue.endMs / 1000, dStartMs / 1000, dEndMs / 1000)
  const end = Math.min(Math.round(e * 1000), Math.max(100, Math.round(maxMs)))
  const start = Math.min(Math.round(s * 1000), Math.max(0, end - 100))
  return retimeCue(cue, start, end)
}
