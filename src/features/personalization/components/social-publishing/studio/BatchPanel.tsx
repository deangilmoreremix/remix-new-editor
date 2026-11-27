'use client'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ASPECTS, type AspectKey, type PlatformId } from '@ohb/shared/social/platformConfig'
import { COMPRESSION_PRESETS, formatBytes, type CompressionPreset, type FitMode } from '@ohb/shared/social/mediaPrep'
import { planBatch, targetsForAspects, targetsForPlatforms, memoryBudgetBytes, DEFAULT_BATCH, type BatchJobSpec } from '@ohb/shared/social/batchPlan'
import { runJobs, defaultConcurrency, createLimiter, type JobStatus } from '@ohb/shared/social/jobQueue'
import { ImageWorkerPool, runImageJob, supportsImageWorker } from '@ohb/shared/social/mediaWorkerClient'
import { processVideo } from '@ohb/shared/social/mediaProcessing'
import { downloadBlob } from '@ohb/shared/social/exportNames'
import { validateFileType } from '@ohb/shared/social/validation'
import type { ImageOpParams } from '@ohb/shared/social/imageOps'
import type { Asset } from '../types'
import { btn, btnPrimary, field, h4 } from './useStudio'

export interface BatchRunners {
  image: (blob: Blob, params: ImageOpParams, signal: AbortSignal) => Promise<{ blob: Blob }>
  video: (o: { file: Blob; aspect: AspectKey; mode: FitMode; preset: CompressionPreset; longEdge: number; onProgress: (f: number) => void; signal: AbortSignal }) => Promise<{ blob: Blob }>
}

interface Props {
  asset: Asset
  platforms: PlatformId[]
  onReplaceAsset?: (a: Asset) => void
  /** Injectable for tests. */
  runners?: BatchRunners
  concurrency?: number
}

interface Item { id: string; file: File }
interface Result { blob: Blob; url: string; name: string }

export function BatchPanel({ asset, platforms, onReplaceAsset, runners, concurrency }: Props) {
  const [items, setItems] = useState<Item[]>([])
  const [aspects, setAspects] = useState<Set<AspectKey>>(() => { const rec = targetsForPlatforms(platforms).map((t) => t.aspect); return new Set<AspectKey>(rec.length ? rec : ['9:16']) })
  const [settings, setSettings] = useState(DEFAULT_BATCH)
  const [statuses, setStatuses] = useState<JobStatus<string>[]>([])
  const [results, setResults] = useState<Record<string, Result>>({})
  const [rejected, setRejected] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [drag, setDrag] = useState(false)
  const queueRef = useRef<ReturnType<typeof runJobs> | null>(null)
  const poolRef = useRef<ImageWorkerPool | null>(null)
  const urlsRef = useRef<Set<string>>(new Set())
  const seq = useRef(0)
  const videoLimit = useRef(createLimiter(1)).current // video encodes are heavy: one at a time even if images run in parallel
  const workers = useMemo(() => supportsImageWorker(), [])
  const budget = useMemo(() => memoryBudgetBytes(), [])
  const conc = concurrency ?? defaultConcurrency()

  useEffect(() => () => {
    queueRef.current?.cancelAll()
    poolRef.current?.terminate()
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u)); urlsRef.current.clear()
  }, [])

  const defaultRunners: BatchRunners = useMemo(() => ({
    image: (blob, params, signal) => {
      if (workers && !poolRef.current) poolRef.current = new ImageWorkerPool(Math.min(2, conc))
      return runImageJob(blob, params, { pool: poolRef.current, signal })
    },
    video: (o) => processVideo({ file: o.file, aspect: o.aspect, mode: o.mode, preset: o.preset, longEdge: o.longEdge, onProgress: o.onProgress, signal: o.signal }),
  }), [workers, conc])
  const run = runners ?? defaultRunners

  const files = useMemo(() => items.map((i) => ({ id: i.id, name: i.file.name, type: i.file.type, size: i.file.size })), [items])
  const targets = useMemo(() => targetsForAspects([...aspects]), [aspects])
  const plan = useMemo(() => planBatch(files, targets), [files, targets])

  const addFiles = (list: File[]) => {
    const bad: string[] = []
    const ok: Item[] = []
    for (const f of list) {
      const v = validateFileType(f.type)
      if (!v.ok) bad.push(`${f.name}: ${v.reason}`); else ok.push({ id: `f${++seq.current}`, file: f })
    }
    setRejected(bad)
    if (ok.length) setItems((x) => [...x, ...ok])
  }

  const execute = useCallback((specs: BatchJobSpec[]) => {
    const byFile = new Map(items.map((i) => [i.id, i.file]))
    setRunning(true)
    const jobs = specs.map((j) => ({
      id: j.id, label: j.label, estimatedBytes: j.estimatedBytes,
      run: async (ctx: { signal: AbortSignal; progress: (f: number) => void }) => {
        const file = byFile.get(j.fileId) as File
        const out = j.kind === 'image'
          ? await run.image(file, { aspect: j.aspect, mode: settings.mode, longEdge: settings.longEdge, mime: 'image/jpeg', quality: COMPRESSION_PRESETS[settings.preset].imageQuality }, ctx.signal)
          : await videoLimit(() => run.video({ file, aspect: j.aspect, mode: settings.mode, preset: settings.preset, longEdge: settings.longEdge, onProgress: ctx.progress, signal: ctx.signal }))
        const url = URL.createObjectURL(out.blob); urlsRef.current.add(url)
        setResults((r) => ({ ...r, [j.id]: { blob: out.blob, url, name: j.outputName } }))
        return j.outputName
      },
    }))
    const q = runJobs(jobs, { concurrency: conc, memoryBudgetBytes: budget, onUpdate: (s) => setStatuses((prev) => mergeStatuses(prev, s as JobStatus<string>[])) })
    queueRef.current = q
    void q.done.finally(() => setRunning(false))
  }, [items, run, settings, conc, budget, videoLimit])

  const start = () => { setStatuses([]); execute(plan.jobs) }
  const retryFailed = () => {
    const failed = new Set(statuses.filter((s) => s.state === 'failed' || s.state === 'cancelled').map((s) => s.id))
    execute(plan.jobs.filter((j) => failed.has(j.id)))
  }
  const clear = () => {
    queueRef.current?.cancelAll()
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u)); urlsRef.current.clear()
    setItems([]); setStatuses([]); setResults({}); setRejected([]); setRunning(false)
  }

  const done = statuses.filter((s) => s.state === 'done').length
  const failed = statuses.filter((s) => s.state === 'failed')
  const cancelled = statuses.filter((s) => s.state === 'cancelled').length
  const toggleAspect = (a: AspectKey) => setAspects((s) => { const n = new Set(s); n.has(a) ? n.delete(a) : n.add(a); return n })

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-white/50">Prepare several files at once, each in the shapes you choose, with progress, cancel and a report of anything that failed. Images are prepared {workers ? 'in background workers, so the page stays responsive' : 'on the main thread (this browser has no OffscreenCanvas workers, so the page may feel slower)'}. Videos are encoded one at a time.</p>

      <section aria-label="Batch files" className="space-y-2">
        <h4 className={h4}>Files</h4>
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles([...e.dataTransfer.files]) }}
          className={`rounded-xl border-2 border-dashed p-4 text-center text-xs ${drag ? 'border-[#d9ff00] bg-[#d9ff00]/10 text-white' : 'border-white/15 text-white/50'}`}>
          Drop images and videos here or{' '}
          <label className="underline cursor-pointer text-white/80">browse<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm" className="sr-only" onChange={(e) => { addFiles([...(e.target.files || [])]); e.target.value = '' }} /></label>
        </div>
        {rejected.length > 0 && <ul role="alert" className="text-[11px] text-red-300 space-y-0.5">{rejected.map((r) => <li key={r}>{r}</li>)}</ul>}
        {plan.rejected.length > 0 && <ul role="alert" className="text-[11px] text-amber-200">{plan.rejected.map((r) => <li key={r.name}>{r.name}: {r.reason}</li>)}</ul>}
        <ul className="space-y-1">{items.map((i) => (
          <li key={i.id} className="flex items-center gap-2 text-[11px] rounded border border-white/10 px-2 py-1">
            <span className="flex-1 truncate">{i.file.name} <span className="text-white/40">({formatBytes(i.file.size)})</span></span>
            <button type="button" aria-label={`Remove ${i.file.name}`} disabled={running} className="text-white/40 hover:text-red-300 disabled:opacity-30" onClick={() => setItems((x) => x.filter((y) => y.id !== i.id))}>×</button>
          </li>
        ))}</ul>
      </section>

      <section aria-label="Batch settings" className="space-y-2">
        <h4 className={h4}>Shapes &amp; quality</h4>
        <div className="flex flex-wrap gap-3 text-[11px] text-white/70">
          {(Object.keys(ASPECTS) as AspectKey[]).map((a) => <label key={a} className="flex items-center gap-1.5"><input type="checkbox" checked={aspects.has(a)} onChange={() => toggleAspect(a)} disabled={running} /> {ASPECTS[a].label}</label>)}
          <button type="button" className={btn} disabled={running || !platforms.length} onClick={() => setAspects(new Set(targetsForPlatforms(platforms).map((t) => t.aspect)))}>Match my destinations</button>
        </div>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Fit" className={`${field} !w-auto`} value={settings.mode} disabled={running} onChange={(e) => setSettings({ ...settings, mode: e.target.value as FitMode })}><option value="fill">Fill (crop)</option><option value="fit">Fit (letterbox)</option></select>
          <select aria-label="Quality" className={`${field} !w-auto`} value={settings.preset} disabled={running} onChange={(e) => setSettings({ ...settings, preset: e.target.value as CompressionPreset })}>{Object.entries(COMPRESSION_PRESETS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}</select>
        </div>
        <p className="text-[10px] text-white/40">{items.length} file{items.length === 1 ? '' : 's'} × {aspects.size} shape{aspects.size === 1 ? '' : 's'} = {plan.jobs.length} jobs · up to {conc} at a time · memory limit about {formatBytes(budget)}.</p>
      </section>

      <div className="flex flex-wrap gap-2 items-center">
        <button type="button" className={btnPrimary} disabled={running || plan.jobs.length === 0} onClick={start}>Prepare {plan.jobs.length || ''} {plan.jobs.length === 1 ? 'file' : 'files'}</button>
        {running && <button type="button" className={btn} onClick={() => queueRef.current?.cancelAll()}>Cancel all</button>}
        {!running && (failed.length > 0 || cancelled > 0) && <button type="button" className={btn} onClick={retryFailed}>Retry {failed.length + cancelled} not finished</button>}
        {!running && done > 1 && <button type="button" className={btn} onClick={() => Object.values(results).forEach((r, i) => setTimeout(() => downloadBlob(r.blob, r.name), i * 300))}>Download all ({done})</button>}
        {(items.length > 0 || statuses.length > 0) && <button type="button" className={btn} disabled={running} onClick={clear}>Clear</button>}
      </div>

      {statuses.length > 0 && (
        <section aria-label="Batch progress" className="space-y-1.5">
          <h4 className={h4}>Progress · {done} of {statuses.length} done{failed.length ? ` · ${failed.length} failed` : ''}{cancelled ? ` · ${cancelled} cancelled` : ''}</h4>
          <ul className="space-y-1.5">{statuses.map((s) => {
            const r = results[s.id]
            return (
              <li key={s.id} className="rounded-lg border border-white/10 p-2 text-[11px]">
                <div className="flex items-center gap-2"><span className="flex-1 truncate">{s.label}</span>
                  <span className={s.state === 'failed' ? 'text-red-300' : s.state === 'done' ? 'text-emerald-300' : 'text-white/50'}>{s.state}</span>
                  {(s.state === 'running' || s.state === 'queued') && <button type="button" className="underline" aria-label={`Cancel ${s.label}`} onClick={() => queueRef.current?.cancel(s.id)}>Cancel</button>}
                </div>
                {s.state === 'running' && <div className="mt-1 h-1 rounded bg-white/10"><div className="h-full rounded bg-[#d9ff00]" style={{ width: `${Math.round(Math.max(0.05, s.progress) * 100)}%` }} /></div>}
                {s.state === 'failed' && <p role="alert" className="mt-1 text-red-300">{s.error}. The original file is unchanged.</p>}
                {r && (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-white/50">{r.name} · {formatBytes(r.blob.size)}</span>
                    <button type="button" className={btn} onClick={() => downloadBlob(r.blob, r.name)}>Download</button>
                    <button type="button" className={btn} disabled={!onReplaceAsset} onClick={() => onReplaceAsset?.({ ...asset, type: r.blob.type.startsWith('video') ? 'video' : 'image', url: r.url })}>Use as post media</button>
                  </div>
                )}
              </li>
            )
          })}</ul>
        </section>
      )}
    </div>
  )
}

/** Keeps earlier results visible when a retry run only reports its own subset. */
function mergeStatuses(prev: JobStatus<string>[], next: JobStatus<string>[]): JobStatus<string>[] {
  const map = new Map(prev.map((s) => [s.id, s]))
  for (const n of next) map.set(n.id, n)
  return [...map.values()]
}
