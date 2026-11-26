/**
 * Small concurrency-limited job runner for bulk media preparation:
 * progress, per-job + global cancellation, failure reporting, and a memory
 * budget (jobs declare an estimated byte cost; the runner never exceeds it).
 */
export type JobState = 'queued' | 'running' | 'done' | 'failed' | 'cancelled'

export interface JobContext { signal: AbortSignal; progress: (fraction: number) => void }
export interface JobSpec<T> { id: string; label: string; estimatedBytes?: number; run: (ctx: JobContext) => Promise<T> }
export interface JobStatus<T = unknown> { id: string; label: string; state: JobState; progress: number; result?: T; error?: string }

export interface QueueOptions {
  concurrency?: number
  /** Max summed `estimatedBytes` of running jobs. A single oversize job still runs alone. */
  memoryBudgetBytes?: number
  onUpdate?: (statuses: JobStatus[]) => void
}

export function defaultConcurrency(nav: any = globalThis.navigator): number {
  const cores = Number(nav?.hardwareConcurrency) || 2
  return Math.max(1, Math.min(3, Math.floor(cores / 2)))
}

export function runJobs<T>(specs: JobSpec<T>[], opts: QueueOptions = {}) {
  const concurrency = Math.max(1, opts.concurrency ?? defaultConcurrency())
  const budget = opts.memoryBudgetBytes ?? Infinity
  const status = new Map<string, JobStatus<T>>(specs.map((s) => [s.id, { id: s.id, label: s.label, state: 'queued', progress: 0 }]))
  const controllers = new Map<string, AbortController>()
  const all = new AbortController()
  const pending = [...specs]
  let running = 0
  let usedBytes = 0
  const emit = () => opts.onUpdate?.([...status.values()].map((s) => ({ ...s })))
  const set = (id: string, patch: Partial<JobStatus<T>>) => { status.set(id, { ...status.get(id)!, ...patch }); emit() }

  const done = new Promise<JobStatus<T>[]>((resolve) => {
    const pump = () => {
      if (all.signal.aborted) {
        for (const s of pending.splice(0)) set(s.id, { state: 'cancelled' })
      }
      while (running < concurrency && pending.length) {
        const next = pending[0]
        const cost = next.estimatedBytes ?? 0
        if (running > 0 && usedBytes + cost > budget) break // wait for memory to free up
        pending.shift()
        if (status.get(next.id)!.state === 'cancelled') continue
        const ac = new AbortController()
        controllers.set(next.id, ac)
        all.signal.addEventListener('abort', () => ac.abort(), { once: true })
        running++
        usedBytes += cost
        set(next.id, { state: 'running' })
        next.run({ signal: ac.signal, progress: (f) => set(next.id, { progress: Math.min(1, Math.max(0, f)) }) })
          .then((result) => set(next.id, { state: ac.signal.aborted ? 'cancelled' : 'done', progress: 1, result }))
          .catch((e) => set(next.id, ac.signal.aborted ? { state: 'cancelled' } : { state: 'failed', error: String(e?.message ?? e) }))
          .finally(() => { running--; usedBytes -= cost; controllers.delete(next.id); pump() })
      }
      if (running === 0 && pending.length === 0) resolve([...status.values()])
    }
    pump()
  })
  emit()

  return {
    done,
    cancelAll: () => all.abort(),
    cancel: (id: string) => {
      controllers.get(id)?.abort()
      if (status.get(id)?.state === 'queued') set(id, { state: 'cancelled' })
    },
    statuses: () => [...status.values()],
  }
}

export const failedJobs = <T,>(s: JobStatus<T>[]) => s.filter((j) => j.state === 'failed')
