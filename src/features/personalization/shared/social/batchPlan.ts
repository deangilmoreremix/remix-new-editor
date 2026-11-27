/**
 * Planning for the multi-post batch screen: which files × which target shapes become which jobs, how much memory each is expected to need,
 * what each output is called. Pure, so the rules are tested without a browser.
 */
import { ASPECTS, PLATFORM_PRESETS, type AspectKey, type PlatformId } from './platformConfig'
import { exportFilename } from './exportNames'
import { validateFileType } from './validation'
import type { FitMode, CompressionPreset } from './mediaPrep'

export interface BatchFile { id: string; name: string; type: string; size: number }
export interface BatchTarget { aspect: AspectKey; label: string; platforms: PlatformId[] }

export interface BatchJobSpec {
  id: string
  fileId: string
  kind: 'image' | 'video'
  aspect: AspectKey
  label: string
  outputName: string
  estimatedBytes: number
}

/** The shapes the chosen platforms recommend (their first preferred aspect), merged so one shape is made once. */
export function targetsForPlatforms(platforms: PlatformId[]): BatchTarget[] {
  const byAspect = new Map<AspectKey, PlatformId[]>()
  for (const p of platforms) {
    const a = PLATFORM_PRESETS[p]?.aspects[0]
    if (a) byAspect.set(a, [...(byAspect.get(a) ?? []), p])
  }
  return [...byAspect.entries()].map(([aspect, ps]) => ({ aspect, platforms: ps, label: `${ASPECTS[aspect].label} · ${ps.map((p) => PLATFORM_PRESETS[p].label).join(', ')}` }))
}

export const targetsForAspects = (aspects: AspectKey[]): BatchTarget[] => aspects.map((aspect) => ({ aspect, platforms: [], label: ASPECTS[aspect].label }))

const MB = 1024 * 1024
/** Rough peak memory a job needs. Images are decoded to pixels (much larger than the file); video encodes hold several frames. */
export function estimateJobBytes(kind: 'image' | 'video', size: number): number {
  return kind === 'image' ? Math.min(256 * MB, Math.max(8 * MB, size * 12)) : Math.round(size * 2 + 64 * MB)
}

/** About a quarter of the device memory the browser reports (Chromium), else 512 MB. A single big job still runs alone. */
export function memoryBudgetBytes(nav: any = globalThis.navigator): number {
  const gb = Number(nav?.deviceMemory)
  return Number.isFinite(gb) && gb > 0 ? Math.round(gb * 1024 * MB * 0.25) : 512 * MB
}

export interface PlanResult { jobs: BatchJobSpec[]; rejected: Array<{ name: string; reason: string }> }

export function planBatch(files: BatchFile[], targets: BatchTarget[], opts: { maxFiles?: number; date?: Date } = {}): PlanResult {
  const max = opts.maxFiles ?? 40
  const jobs: BatchJobSpec[] = []
  const rejected: PlanResult['rejected'] = []
  files.forEach((f, i) => {
    if (i >= max) { rejected.push({ name: f.name, reason: `Only ${max} files per batch.` }); return }
    const v = validateFileType(f.type)
    if (!v.ok || !v.kind) { rejected.push({ name: f.name, reason: v.reason ?? 'Unsupported file.' }); return }
    const base = f.name.replace(/\.[^.]+$/, '')
    for (const t of targets) {
      const ext = v.kind === 'image' ? 'jpg' : 'mp4'
      jobs.push({
        id: `${f.id}:${t.aspect}`, fileId: f.id, kind: v.kind, aspect: t.aspect, label: `${f.name} → ${t.label}`,
        outputName: exportFilename(v.kind, base, ext, { aspect: t.aspect, platform: t.platforms.length === 1 ? t.platforms[0] : undefined, date: opts.date }),
        estimatedBytes: estimateJobBytes(v.kind, f.size),
      })
    }
  })
  return { jobs, rejected }
}

export interface BatchSettings { mode: FitMode; preset: CompressionPreset; longEdge: number }
export const DEFAULT_BATCH: BatchSettings = { mode: 'fill', preset: 'balanced', longEdge: 1920 }
