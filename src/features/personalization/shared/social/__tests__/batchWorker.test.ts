import { describe, it, expect, vi } from 'vitest'
import { processImage, handleWorkerRequest, type ImageDeps } from '../imageOps'
import { ImageWorkerPool, runImageJob, supportsImageWorker, type WorkerLike } from '../mediaWorkerClient'
import { createLimiter, runJobs } from '../jobQueue'
import { planBatch, targetsForPlatforms, targetsForAspects, estimateJobBytes, memoryBudgetBytes } from '../batchPlan'

// ---------- image core, with fakes ----------
const fakeImageDeps = (w = 1920, h = 1080, log: any[] = []): ImageDeps => ({
  decode: async () => ({ width: w, height: h, close: () => log.push(['close']) }),
  canvas: (cw, ch) => ({ cw, ch, getContext: () => ({ set fillStyle(v: string) { log.push(['style', v]) }, fillRect: (...a: any[]) => log.push(['fill', ...a]), drawImage: (...a: any[]) => log.push(['draw', ...a.slice(1)]) }) }),
  encode: async (c, mime, q) => { log.push(['encode', c.cw, c.ch, mime, q]); return new Blob(['x'], { type: mime }) },
})

describe('processImage (shared by the worker and the main-thread fallback)', () => {
  it('reframes to a shape (fill crops, with the source rectangle and output size)', async () => {
    const log: any[] = []
    const out = await processImage(new Blob(['i']), { aspect: '9:16', mode: 'fill', longEdge: 1920 }, fakeImageDeps(1920, 1080, log))
    expect([out.width, out.height]).toEqual([1080, 1920])
    expect(log.find((l) => l[0] === 'draw')).toEqual(['draw', 656.25, 0, 607.5, 1080, 0, 0, 1080, 1920])
    expect(out.blob.type).toBe('image/jpeg')
    expect(log.filter((l) => l[0] === 'close')).toHaveLength(1)
  })
  it('only limits the size when no shape is asked for, and never upscales', async () => {
    const big = await processImage(new Blob(['i']), { longEdge: 960 }, fakeImageDeps(1920, 1080))
    expect([big.width, big.height]).toEqual([960, 540])
    const small = await processImage(new Blob(['i']), { longEdge: 4000 }, fakeImageDeps(640, 360))
    expect([small.width, small.height]).toEqual([640, 360])
  })
  it('releases the bitmap when encoding fails, and reports an unusable canvas', async () => {
    const log: any[] = []
    const deps = fakeImageDeps(100, 100, log)
    deps.encode = async () => { throw new Error('encode failed') }
    await expect(processImage(new Blob(['i']), {}, deps)).rejects.toThrow('encode failed')
    expect(log).toContainEqual(['close'])
    const noCtx = fakeImageDeps(); noCtx.canvas = () => ({ getContext: () => null })
    await expect(processImage(new Blob(['i']), {}, noCtx)).rejects.toThrow(/Canvas is not available/)
  })
  it('the worker handler never throws: it replies with done or an error', async () => {
    const ok = await handleWorkerRequest({ id: 7, blob: new Blob(['i']), params: { aspect: '1:1', mode: 'fit' } }, fakeImageDeps())
    expect(ok).toMatchObject({ id: 7, type: 'done', width: 1080, height: 1080 })
    const bad = fakeImageDeps(); bad.decode = async () => { throw new Error('bad image') }
    expect(await handleWorkerRequest({ id: 8, blob: new Blob(['i']), params: {} }, bad)).toEqual({ id: 8, type: 'error', message: 'bad image' })
  })
})

// ---------- the worker pool, with a fake worker ----------
class FakeWorker implements WorkerLike {
  static all: FakeWorker[] = []
  onmessage: any = null; onerror: any = null; terminated = false; posted: any[] = []
  constructor() { FakeWorker.all.push(this) }
  postMessage(m: any) { this.posted.push(m) }
  terminate() { this.terminated = true }
  reply(r: any) { this.onmessage?.({ data: r }) }
}
const tick = () => new Promise((r) => setTimeout(r, 0))
const mkPool = (size = 2) => { FakeWorker.all = []; return new ImageWorkerPool(size, () => new FakeWorker()) }

describe('ImageWorkerPool', () => {
  it('runs a job in a worker and resolves with its result', async () => {
    const pool = mkPool()
    const p = pool.run(new Blob(['i']), { aspect: '1:1' })
    await tick()
    const w = FakeWorker.all[0]
    expect(w.posted[0]).toMatchObject({ params: { aspect: '1:1' } })
    w.reply({ id: w.posted[0].id, type: 'done', blob: new Blob(['o']), width: 10, height: 10 })
    expect(await p).toMatchObject({ width: 10, height: 10 })
    pool.terminate()
  })
  it('never exceeds its size: extra jobs wait for a free worker and reuse it', async () => {
    const pool = mkPool(1)
    const a = pool.run(new Blob(['1']), {}); const b = pool.run(new Blob(['2']), {})
    await Promise.resolve()
    expect(FakeWorker.all).toHaveLength(1)
    const w = FakeWorker.all[0]
    expect(w.posted).toHaveLength(1)
    w.reply({ id: w.posted[0].id, type: 'done', blob: new Blob([]), width: 1, height: 1 })
    await a
    await vi.waitFor(() => expect(w.posted).toHaveLength(2))
    w.reply({ id: w.posted[1].id, type: 'done', blob: new Blob([]), width: 2, height: 2 })
    expect(await b).toMatchObject({ width: 2 })
    expect(FakeWorker.all).toHaveLength(1)
    pool.terminate()
  })
  it('cancelling terminates that worker (memory released) and rejects as cancelled; the pool recovers', async () => {
    const pool = mkPool(1)
    const ac = new AbortController()
    const p = pool.run(new Blob(['i']), {}, ac.signal)
    await tick()
    const w = FakeWorker.all[0]
    ac.abort()
    await expect(p).rejects.toMatchObject({ name: 'AbortError' })
    expect(w.terminated).toBe(true)
    expect(pool.liveWorkers).toBe(0)
    const next = pool.run(new Blob(['j']), {})
    await tick()
    expect(FakeWorker.all).toHaveLength(2)
    FakeWorker.all[1].reply({ id: FakeWorker.all[1].posted[0].id, type: 'done', blob: new Blob([]), width: 3, height: 3 })
    expect(await next).toMatchObject({ width: 3 })
    pool.terminate()
  })
  it('a job waiting for a worker can be cancelled without ever starting', async () => {
    const pool = mkPool(1)
    const first = pool.run(new Blob(['1']), {})
    const ac = new AbortController()
    const waiting = pool.run(new Blob(['2']), {}, ac.signal)
    await Promise.resolve()
    ac.abort()
    await expect(waiting).rejects.toMatchObject({ name: 'AbortError' })
    expect(FakeWorker.all[0].posted).toHaveLength(1)
    FakeWorker.all[0].reply({ id: FakeWorker.all[0].posted[0].id, type: 'done', blob: new Blob([]), width: 1, height: 1 })
    await first
    pool.terminate()
  })
  it('reports a worker error and crash, and drops a crashed worker', async () => {
    const pool = mkPool(1)
    const a = pool.run(new Blob(['1']), {})
    await tick()
    const w = FakeWorker.all[0]
    w.reply({ id: w.posted[0].id, type: 'error', message: 'bad image' })
    await expect(a).rejects.toThrow('bad image')
    const b = pool.run(new Blob(['2']), {})
    await tick()
    w.onerror?.({ message: 'worker crashed' })
    await expect(b).rejects.toThrow('worker crashed')
    expect(w.terminated).toBe(true)
    pool.terminate()
  })
  it('a closed pool refuses new work and terminates every worker', async () => {
    const pool = mkPool(2)
    void pool.run(new Blob(['1']), {}).catch(() => {})
    pool.terminate()
    expect(FakeWorker.all.every((w) => w.terminated)).toBe(true)
    await expect(pool.run(new Blob(['2']), {})).rejects.toThrow(/closed/)
  })
})

describe('worker support and the main-thread fallback', () => {
  it('detects missing pieces', () => {
    expect(supportsImageWorker({})).toBe(false)
    expect(supportsImageWorker({ Worker: function () {}, OffscreenCanvas: function () {} })).toBe(false)
    expect(supportsImageWorker({ Worker: function () {}, OffscreenCanvas: function () {}, createImageBitmap: () => {} })).toBe(true)
  })
  it('runImageJob uses the pool when given one and honours an already-cancelled signal', async () => {
    const pool = { run: vi.fn(async () => ({ blob: new Blob([]), width: 1, height: 1 })) } as any
    expect(await runImageJob(new Blob(['i']), {}, { pool })).toMatchObject({ where: 'worker' })
    const ac = new AbortController(); ac.abort()
    await expect(runImageJob(new Blob(['i']), {}, { pool, signal: ac.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(pool.run).toHaveBeenCalledTimes(1)
  })
})

// ---------- limiter ----------
describe('createLimiter', () => {
  it('keeps heavy work to n at a time and always frees the slot, even on failure', async () => {
    const limit = createLimiter(1)
    let running = 0, peak = 0
    const task = (fail = false) => limit(async () => { running++; peak = Math.max(peak, running); await new Promise((r) => setTimeout(r, 5)); running--; if (fail) throw new Error('x') })
    const results = await Promise.allSettled([task(), task(true), task(), task()])
    expect(peak).toBe(1)
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled', 'fulfilled'])
  })
})

// ---------- planning ----------
const f = (name: string, type: string, size = 1_000_000, id = name) => ({ id, name, type, size })
describe('batch planning', () => {
  it('turns platforms into merged target shapes', () => {
    const t = targetsForPlatforms(['tiktok', 'instagram', 'youtube', 'x'])
    expect(t.map((x) => x.aspect).sort()).toEqual(['16:9', '9:16'])
    expect(t.find((x) => x.aspect === '9:16')?.platforms).toEqual(['tiktok', 'instagram'])
    expect(targetsForAspects(['1:1']).map((x) => x.label)).toEqual(['Square 1:1'])
  })
  it('makes one job per file per shape with clear output names and rejects unsupported files', () => {
    const plan = planBatch([f('Launch Day.png', 'image/png'), f('clip.mp4', 'video/mp4'), f('notes.pdf', 'application/pdf')], targetsForAspects(['9:16', '1:1']), { date: new Date('2026-01-02T00:00:00Z') })
    expect(plan.jobs.map((j) => j.outputName)).toEqual([
      'launch-day_9x16_2026-01-02.jpg', 'launch-day_1x1_2026-01-02.jpg', 'clip_9x16_2026-01-02.mp4', 'clip_1x1_2026-01-02.mp4',
    ])
    expect(plan.jobs.map((j) => j.kind)).toEqual(['image', 'image', 'video', 'video'])
    expect(plan.rejected).toEqual([{ name: 'notes.pdf', reason: expect.stringContaining('supported') }])
    expect(new Set(plan.jobs.map((j) => j.id)).size).toBe(4)
  })
  it('caps the number of files', () => {
    const files = Array.from({ length: 5 }, (_, i) => f(`a${i}.png`, 'image/png'))
    const plan = planBatch(files, targetsForAspects(['1:1']), { maxFiles: 3 })
    expect(plan.jobs).toHaveLength(3)
    expect(plan.rejected).toHaveLength(2)
  })
  it('estimates memory and derives a budget from the device', () => {
    expect(estimateJobBytes('image', 1_000_000)).toBe(12_000_000)
    expect(estimateJobBytes('image', 100)).toBe(8 * 1024 * 1024)
    expect(estimateJobBytes('image', 100_000_000)).toBe(256 * 1024 * 1024)
    expect(estimateJobBytes('video', 10_000_000)).toBeGreaterThan(10_000_000 * 2)
    expect(memoryBudgetBytes({ deviceMemory: 8 })).toBe(2 * 1024 * 1024 * 1024)
    expect(memoryBudgetBytes({})).toBe(512 * 1024 * 1024)
  })
  it('works end to end with the job queue: cancellation, failures and the memory budget', async () => {
    const plan = planBatch([f('a.png', 'image/png', 30_000_000), f('b.png', 'image/png', 30_000_000), f('c.png', 'image/png', 1000)], targetsForAspects(['1:1']))
    let running = 0, peak = 0
    const specs = plan.jobs.map((j, i) => ({ id: j.id, label: j.label, estimatedBytes: j.estimatedBytes, run: async () => { running++; peak = Math.max(peak, running); await new Promise((r) => setTimeout(r, 5)); running--; if (i === 2) throw new Error('bad file'); return j.outputName } }))
    const q = runJobs(specs, { concurrency: 3, memoryBudgetBytes: 300 * 1024 * 1024 })
    const res = await q.done
    expect(peak).toBeLessThan(3) // two 256 MB jobs cannot run together inside a 300 MB budget
    expect(res.map((r) => r.state)).toEqual(['done', 'done', 'failed'])
  })
})
