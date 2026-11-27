/**
 * Runs image jobs in a small pool of dedicated Web Workers (OffscreenCanvas), keeping the page responsive during bulk preparation.
 * Falls back to the main thread (same `processImage`) where workers or OffscreenCanvas are missing. Cancelling a job terminates its worker, so
 * memory is released immediately; the pool creates a fresh worker the next time one is needed.
 */
import { browserImageDeps, processImage, type ImageOpParams, type ProcessedImage, type WorkerReply } from './imageOps'

export class JobCancelledError extends Error { constructor() { super('Cancelled'); this.name = 'AbortError' } }

export function supportsImageWorker(g: any = globalThis): boolean {
  return typeof g.Worker === 'function' && typeof g.OffscreenCanvas === 'function' && typeof g.createImageBitmap === 'function'
}

export type WorkerLike = Pick<Worker, 'postMessage' | 'terminate'> & { onmessage: ((e: MessageEvent<WorkerReply>) => void) | null; onerror: ((e: any) => void) | null }
const defaultFactory = (): WorkerLike => new Worker(new URL('./media.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike

export class ImageWorkerPool {
  private slots: Array<{ w: WorkerLike; busy: boolean }> = []
  private waiting: Array<() => void> = []
  private seq = 0
  private closed = false
  constructor(private size = 2, private factory: () => WorkerLike = defaultFactory) {}

  /** Number of live workers (for tests / diagnostics). */
  get liveWorkers() { return this.slots.length }

  private async acquire(signal?: AbortSignal) {
    for (;;) {
      if (this.closed) throw new Error('The worker pool was closed.')
      if (signal?.aborted) throw new JobCancelledError()
      const free = this.slots.find((s) => !s.busy)
      if (free) { free.busy = true; return free }
      if (this.slots.length < this.size) { const s = { w: this.factory(), busy: true }; this.slots.push(s); return s }
      await new Promise<void>((res) => { this.waiting.push(res); signal?.addEventListener('abort', () => res(), { once: true }) }) // wake on cancel too
    }
  }
  private release(slot: { w: WorkerLike; busy: boolean }, drop: boolean) {
    if (drop) { slot.w.terminate(); this.slots = this.slots.filter((s) => s !== slot) } else slot.busy = false
    this.waiting.shift()?.()
  }

  async run(blob: Blob, params: ImageOpParams, signal?: AbortSignal): Promise<ProcessedImage> {
    const slot = await this.acquire(signal)
    const id = ++this.seq
    return new Promise<ProcessedImage>((resolve, reject) => {
      let settled = false
      const finish = (drop: boolean, fn: () => void) => { if (settled) return; settled = true; signal?.removeEventListener('abort', onAbort); slot.w.onmessage = null; slot.w.onerror = null; this.release(slot, drop); fn() }
      const onAbort = () => finish(true, () => reject(new JobCancelledError())) // terminating is the only way to stop a running worker
      slot.w.onmessage = (e) => {
        const m = e.data
        if (m.id !== id) return
        if (m.type === 'done') finish(false, () => resolve({ blob: m.blob, width: m.width, height: m.height }))
        else finish(false, () => reject(new Error(m.message)))
      }
      slot.w.onerror = (e) => finish(true, () => reject(new Error(e?.message || 'The image worker failed.')))
      if (signal?.aborted) return onAbort()
      signal?.addEventListener('abort', onAbort, { once: true })
      slot.w.postMessage({ id, blob, params })
    })
  }

  terminate() {
    this.closed = true
    for (const s of this.slots) s.w.terminate()
    this.slots = []
    this.waiting.splice(0).forEach((r) => r())
  }
}

/** Runs one image job in the pool when workers are supported, otherwise on the main thread. */
export async function runImageJob(blob: Blob, params: ImageOpParams, opts: { pool?: ImageWorkerPool | null; signal?: AbortSignal } = {}): Promise<ProcessedImage & { where: 'worker' | 'main' }> {
  if (opts.signal?.aborted) throw new JobCancelledError()
  if (opts.pool) return { ...(await opts.pool.run(blob, params, opts.signal)), where: 'worker' }
  const out = await processImage(blob, params, browserImageDeps())
  if (opts.signal?.aborted) throw new JobCancelledError()
  return { ...out, where: 'main' }
}
