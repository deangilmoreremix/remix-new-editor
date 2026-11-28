/** Thumbnail suggestions: rank sampled frames by measurable qualities. No face claim: faces are not detected here. */
export interface FrameStats { t: number; sharpness: number; brightness: number; contrast: number }
export interface ThumbPick extends FrameStats { score: number }

/** 0..1. Rewards sharpness and mid-tone brightness with real tonal range; penalises dark, blown-out or flat frames. */
export function scoreFrame(f: FrameStats): number {
  const sharp = Math.min(1, f.sharpness / 300)
  const bright = 1 - Math.min(1, Math.abs(f.brightness - 125) / 125)
  const range = Math.min(1, f.contrast / 60)
  return Math.round((0.5 * sharp + 0.3 * bright + 0.2 * range) * 1000) / 1000
}

/** Best `n` frames at least `minGapSec` apart, so the suggestions are visibly different. */
export function pickThumbnails(frames: FrameStats[], n = 3, minGapSec = 1.5): ThumbPick[] {
  const ranked = frames.map((f) => ({ ...f, score: scoreFrame(f) })).sort((a, b) => b.score - a.score)
  const out: ThumbPick[] = []
  for (const f of ranked) {
    if (out.length >= n) break
    if (out.every((o) => Math.abs(o.t - f.t) >= minGapSec)) out.push(f)
  }
  return out
}
