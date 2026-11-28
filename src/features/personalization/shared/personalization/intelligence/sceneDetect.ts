/** Scene-cut detection on small luma grids sampled from a video. Pure; sampling lives in `videoIntel.ts`. */

export interface LumaFrame { t: number; luma: Uint8Array | Uint8ClampedArray | number[] }
export interface SceneCut { t: number; strength: number }

/** Mean absolute difference between two equally sized grids, 0..1. */
export function frameDifference(a: LumaFrame['luma'], b: LumaFrame['luma']): number {
  const n = Math.min(a.length, b.length)
  if (!n) return 0
  let s = 0
  for (let i = 0; i < n; i++) s += Math.abs((a[i] as number) - (b[i] as number))
  return s / n / 255
}

/**
 * A cut is a difference clearly above the clip's own typical frame-to-frame change (median + k*MAD) and above an
 * absolute floor, so a static clip never invents cuts and a very busy one does not flag every frame.
 */
export function detectSceneCuts(frames: LumaFrame[], opts: { k?: number; floor?: number; minGapSec?: number } = {}): SceneCut[] {
  const { k = 2.5, floor = 0.12, minGapSec = 0.8 } = opts
  if (frames.length < 3) return []
  const diffs = frames.slice(1).map((f, i) => frameDifference(frames[i]!.luma, f.luma))
  // Median + MAD, not mean + std: one real cut in a short clip inflates the std so much that it can never exceed it.
  const sorted = [...diffs].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]!
  const devs = diffs.map((d) => Math.abs(d - median)).sort((a, b) => a - b)
  const mad = Math.max(0.02, 1.4826 * devs[Math.floor(devs.length / 2)]!)
  const threshold = Math.max(floor, median + k * mad)
  const cuts: SceneCut[] = []
  diffs.forEach((d, i) => {
    if (d < threshold) return
    const t = frames[i + 1]!.t
    const last = cuts[cuts.length - 1]
    if (last && t - last.t < minGapSec) { if (d > last.strength) { last.t = t; last.strength = d } return }
    cuts.push({ t, strength: d })
  })
  return cuts
}

export interface Scene { start: number; end: number }

export function scenesFromCuts(cuts: { t: number }[], duration: number): Scene[] {
  const edges = [0, ...cuts.map((c) => c.t).filter((t) => t > 0 && t < duration), duration]
  return edges.slice(0, -1).map((s, i) => ({ start: s, end: edges[i + 1]! })).filter((s) => s.end - s.start > 0.05)
}

/** Start/end times for an overlay so it does not straddle a hard cut: the longest scene that begins after `after`. */
export function recommendOverlayWindow(scenes: Scene[], minSec = 2): Scene | null {
  const usable = scenes.filter((s) => s.end - s.start >= minSec)
  if (!usable.length) return null
  return [...usable].sort((a, b) => (b.end - b.start) - (a.end - a.start))[0]!
}
