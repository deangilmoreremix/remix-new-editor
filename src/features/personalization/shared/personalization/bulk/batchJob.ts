/**
 * Resumable batch jobs that run IN THE BROWSER TAB (Stage 10). There is no server queue: if the tab is closed the job stops, and
 * it is picked up again from what was saved (every finished step is persisted before the next starts). This is "resumable", not
 * "background": nothing runs while the tab is closed.
 *
 * Properties the tests pin:
 *   - finished steps are never redone (their files are kept in the artifact store and checked on resume)
 *   - one recipient's failure never stops the others; each step is retried a bounded number of times
 *   - cancel/pause is prompt and leaves the job resumable; a step interrupted by it is NOT counted as a failure
 *   - a full browser storage (QuotaExceededError) pauses the whole job with a clear message instead of failing every recipient
 *   - only one tab runs a given job at a time (Web Locks), and the saved job can be refused if the template changed
 */

export type StepName = 'thumbnail' | 'gif' | 'video'
export type ItemStatus = 'pending' | 'running' | 'done' | 'failed'
export interface StepState { status: 'pending' | 'done' | 'failed'; attempts: number; bytes?: number; fileName?: string; error?: string }
export interface BatchItem { id: string; label: string; status: ItemStatus; steps: Partial<Record<StepName, StepState>>; error?: string }
export type JobState = 'ready' | 'running' | 'paused' | 'cancelled' | 'completed'
export interface BatchJob { version: 1; id: string; createdAt: string; updatedAt: string; templateHash: string; stepNames: StepName[]; items: BatchItem[]; state: JobState; message?: string }

export interface JobStore { load(): Promise<BatchJob | null>; save(job: BatchJob): Promise<void>; clear(): Promise<void> }
export interface ArtifactStore { put(key: string, blob: Blob): Promise<void>; get(key: string): Promise<Blob | null>; clearJob(jobId: string): Promise<void> }
/**
 * A stored Blob can be a stale handle: IndexedDB may return an object for a file the browser has since discarded (private windows
 * and storage cleanup do this), and the failure only shows when the bytes are read. Reading one byte proves it is still there.
 */
export async function isReadable(blob: Blob | null): Promise<boolean> {
  if (!blob) return false
  try { await blob.slice(0, 1).arrayBuffer(); return true } catch { return false }
}
export const artifactKey = (jobId: string, itemId: string, step: StepName) => `${jobId}/${itemId}/${step}`

export function createJob(recipients: Array<{ id: string; label: string }>, stepNames: StepName[], templateHash: string, opts: { id?: string; now?: () => Date } = {}): BatchJob {
  const t = (opts.now ?? (() => new Date()))().toISOString()
  return { version: 1, id: opts.id ?? `job-${t.replace(/\D/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`, createdAt: t, updatedAt: t, templateHash, stepNames: [...stepNames], state: 'ready',
    items: recipients.map((r) => ({ id: r.id, label: r.label, status: 'pending', steps: Object.fromEntries(stepNames.map((s) => [s, { status: 'pending', attempts: 0 }])) })) }
}

/** After a reload or a crash: anything that was "running" never finished, so it goes back to pending; a job that was running is paused. */
export function recoverJob(job: BatchJob): BatchJob {
  const next: BatchJob = JSON.parse(JSON.stringify(job))
  for (const it of next.items) if (it.status === 'running') it.status = 'pending'
  if (next.state === 'running') next.state = 'paused'
  return next
}
/** Gives failed steps a fresh set of attempts. */
export function retryFailed(job: BatchJob): BatchJob {
  const next: BatchJob = JSON.parse(JSON.stringify(job))
  for (const it of next.items) {
    if (it.status !== 'failed') continue
    it.status = 'pending'; delete it.error
    for (const s of Object.values(it.steps)) if (s && s.status === 'failed') { s.status = 'pending'; s.attempts = 0; delete s.error }
  }
  if (next.state === 'completed') next.state = 'paused'
  return next
}
export const canResume = (job: BatchJob, templateHash: string): { ok: true } | { ok: false; reason: string } =>
  job.templateHash === templateHash ? { ok: true } : { ok: false, reason: 'The video design changed since this batch was started. Start a new batch so every recipient gets the same design.' }

/** Steps whose stored file turned out to be unreadable go back to pending (their recipients too), so "Resume" remakes exactly those. */
export function markStepsMissing(job: BatchJob, missing: Array<{ itemId: string; step: StepName }>): BatchJob {
  const next: BatchJob = JSON.parse(JSON.stringify(job))
  for (const m of missing) {
    const it = next.items.find((i) => i.id === m.itemId); const st = it?.steps[m.step]
    if (!it || !st) continue
    st.status = 'pending'; st.attempts = 0; delete st.error; delete st.bytes; it.status = 'pending'
  }
  if (missing.length && (next.state === 'completed' || next.state === 'ready')) next.state = 'paused'
  return next
}

export interface JobSummary { total: number; done: number; failed: number; pending: number; running: number; percent: number }
export function summarize(job: BatchJob): JobSummary {
  const c = { done: 0, failed: 0, pending: 0, running: 0 }
  for (const i of job.items) c[i.status] += 1
  const total = job.items.length
  return { total, ...c, percent: total ? Math.round(((c.done + c.failed) / total) * 100) : 100 }
}

export interface StepResult { blob: Blob; fileName: string }
export interface RunDeps { runStep(step: StepName, item: BatchItem, ctx: { signal: AbortSignal }): Promise<StepResult> }
export interface RunOptions {
  store: JobStore; artifacts: ArtifactStore
  signal?: AbortSignal; concurrency?: number; maxAttempts?: number
  onProgress?: (job: BatchJob) => void
  now?: () => Date; sleep?: (ms: number) => Promise<void>; retryDelayMs?: number
}

const isQuota = (e: unknown) => { const n = (e as { name?: string })?.name; return n === 'QuotaExceededError' || /quota/i.test(String((e as Error)?.message ?? '')) }
const msg = (e: unknown) => String((e as Error)?.message ?? e).slice(0, 200)

export async function runBatch(start: BatchJob, deps: RunDeps, opts: RunOptions): Promise<BatchJob> {
  const job: BatchJob = recoverJob(start)
  const now = opts.now ?? (() => new Date()); const maxAttempts = Math.max(1, opts.maxAttempts ?? 2); const conc = Math.min(4, Math.max(1, opts.concurrency ?? 1))
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const outer = opts.signal; const inner = new AbortController()
  const onAbort = () => inner.abort(); if (outer?.aborted) inner.abort(); else outer?.addEventListener('abort', onAbort, { once: true })
  let fatal: string | null = null
  let chain: Promise<void> = Promise.resolve()
  const persist = (): Promise<void> => {
    job.updatedAt = now().toISOString()
    const snap = JSON.parse(JSON.stringify(job)) as BatchJob
    chain = chain.then(() => opts.store.save(snap)).catch(() => undefined)
    try { opts.onProgress?.(snap) } catch { /* a listener must not break the run */ }
    return chain
  }

  // Recipients marked done earlier: their files may have been discarded since (private windows, storage cleanup). Anything that can no
  // longer be read goes back in the queue, so the package never ends up short of files it claims to have.
  for (const it of job.items) {
    if (it.status !== 'done') continue
    for (const step of job.stepNames) {
      const st = it.steps[step]
      if (st?.status === 'done' && !(await isReadable(await opts.artifacts.get(artifactKey(job.id, it.id, step))))) { st.status = 'pending'; st.attempts = 0; delete st.error; it.status = 'pending' }
    }
  }
  job.state = 'running'; job.message = undefined; await persist()
  const queue = job.items.filter((i) => i.status === 'pending')

  const doStep = async (item: BatchItem, step: StepName): Promise<void> => {
    const st = (item.steps[step] ??= { status: 'pending', attempts: 0 })
    if (st.status === 'done' && await isReadable(await opts.artifacts.get(artifactKey(job.id, item.id, step)))) return // finished earlier and its file can still be read
    st.status = 'pending'
    while (st.attempts < maxAttempts) {
      if (inner.signal.aborted || fatal) return
      try {
        const res = await deps.runStep(step, item, { signal: inner.signal })
        if (inner.signal.aborted) return // finished after the stop request: discard rather than half-record it
        await opts.artifacts.put(artifactKey(job.id, item.id, step), res.blob)
        Object.assign(st, { status: 'done', bytes: res.blob.size, fileName: res.fileName }); delete st.error
        await persist(); return
      } catch (e) {
        if (inner.signal.aborted) return // interrupted on purpose: not a failure, no attempt used
        if (isQuota(e)) { fatal = 'The browser has no storage left for this batch. Free some space (or make fewer videos per batch) and resume.'; return }
        st.attempts += 1; st.error = msg(e); await persist()
        if (st.attempts < maxAttempts && (opts.retryDelayMs ?? 0) > 0) await sleep(opts.retryDelayMs!)
      }
    }
    st.status = 'failed'; await persist()
  }

  const doItem = async (item: BatchItem) => {
    item.status = 'running'; await persist()
    for (const step of job.stepNames) { if (inner.signal.aborted || fatal) break; await doStep(item, step) }
    if (inner.signal.aborted || fatal) { item.status = 'pending'; await persist(); return }
    const failed = job.stepNames.filter((s) => item.steps[s]?.status === 'failed')
    item.status = failed.length ? 'failed' : 'done'
    item.error = failed.length ? failed.map((s) => `${s}: ${item.steps[s]?.error ?? 'failed'}`).join('; ').slice(0, 300) : undefined
    await persist()
  }

  let next = 0
  const worker = async () => { while (!inner.signal.aborted && !fatal) { const item = queue[next]; next += 1; if (!item) return; await doItem(item) } }
  try { await Promise.all(Array.from({ length: Math.min(conc, Math.max(1, queue.length)) }, worker)) }
  finally { outer?.removeEventListener('abort', onAbort) }

  const stopped = inner.signal.aborted || fatal !== null
  job.state = stopped ? 'paused' : 'completed'
  if (fatal) job.message = fatal
  await persist(); await chain
  return job
}

/** One tab at a time per job. Uses Web Locks when the browser has them; otherwise it says it could not guarantee exclusivity. */
export async function withExclusiveRun<T>(name: string, fn: () => Promise<T>, locks: LockManager | undefined = (globalThis as { navigator?: { locks?: LockManager } }).navigator?.locks): Promise<{ ran: true; value: T; exclusive: boolean } | { ran: false }> {
  if (!locks) return { ran: true, value: await fn(), exclusive: false }
  return locks.request(`smartvideo-batch:${name}`, { ifAvailable: true }, async (lock) => (lock ? { ran: true as const, value: await fn(), exclusive: true } : { ran: false as const }))
}

// ---------------------------------------------------------------- stores
export function createMemoryStores(): { store: JobStore; artifacts: ArtifactStore & { size(): number } } {
  let saved: BatchJob | null = null; const blobs = new Map<string, Blob>()
  return {
    store: { load: async () => (saved ? JSON.parse(JSON.stringify(saved)) : null), save: async (j) => { saved = JSON.parse(JSON.stringify(j)) }, clear: async () => { saved = null } },
    artifacts: { put: async (k, b) => { blobs.set(k, b) }, get: async (k) => blobs.get(k) ?? null, clearJob: async (id) => { for (const k of [...blobs.keys()]) if (k.startsWith(`${id}/`)) blobs.delete(k) }, size: () => blobs.size },
  }
}

/** IndexedDB-backed stores (idb-keyval). Job state is small JSON; the files are Blobs, kept out of the job record. */
export async function createIdbStores(namespace = 'smartvideo-batch'): Promise<{ store: JobStore; artifacts: ArtifactStore }> {
  const { createStore, get, set, del, keys } = await import('idb-keyval')
  const jobs = createStore(`${namespace}-jobs`, 'kv'); const files = createStore(`${namespace}-files`, 'kv')
  return {
    store: { load: async () => ((await get('current', jobs)) as BatchJob | undefined) ?? null, save: (j) => set('current', j, jobs), clear: () => del('current', jobs) },
    artifacts: { put: (k, b) => set(k, b, files), get: async (k) => ((await get(k, files)) as Blob | undefined) ?? null, clearJob: async (id) => { for (const k of await keys(files)) if (String(k).startsWith(`${id}/`)) await del(k, files) } },
  }
}
