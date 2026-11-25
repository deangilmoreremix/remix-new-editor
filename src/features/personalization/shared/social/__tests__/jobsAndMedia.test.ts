import { describe, it, expect, vi } from 'vitest'
import { runJobs, failedJobs, defaultConcurrency } from '../jobQueue'
import { processVideo, MediaUnsupportedError, probeVideo } from '../mediaProcessing'

const deferred = <T = void,>() => { let resolve!: (v: T) => void; let reject!: (e: any) => void; const p = new Promise<T>((a, b) => { resolve = a; reject = b }); return { p, resolve, reject } }
const tick = () => new Promise((r) => setTimeout(r, 0))

describe('bulk job queue', () => {
  it('respects the concurrency limit and reports failures without stopping others', async () => {
    let running = 0, peak = 0
    const mk = (id: string, fail = false) => ({ id, label: id, run: async () => { running++; peak = Math.max(peak, running); await tick(); running--; if (fail) throw new Error('boom'); return id } })
    const q = runJobs([mk('a'), mk('b', true), mk('c'), mk('d')], { concurrency: 2 })
    const res = await q.done
    expect(peak).toBe(2)
    expect(res.map((r) => r.state)).toEqual(['done', 'failed', 'done', 'done'])
    expect(failedJobs(res)[0]).toMatchObject({ id: 'b', error: 'boom' })
  })
  it('cancels one running job, queued jobs, and everything', async () => {
    const gate = deferred()
    const aborted: string[] = []
    const mk = (id: string) => ({ id, label: id, run: ({ signal }: any) => new Promise<string>((res, rej) => { signal.addEventListener('abort', () => { aborted.push(id); rej(new Error('abort')) }); gate.p.then(() => res(id)) }) })
    const q = runJobs([mk('a'), mk('b'), mk('c')], { concurrency: 1 })
    await tick()
    q.cancel('c') // queued
    q.cancel('a') // running
    await tick()
    gate.resolve()
    const res = await q.done
    expect(aborted).toContain('a')
    expect(res.find((r) => r.id === 'a')?.state).toBe('cancelled')
    expect(res.find((r) => r.id === 'c')?.state).toBe('cancelled')
    expect(res.find((r) => r.id === 'b')?.state).toBe('done')
    const q2 = runJobs([mk('x'), mk('y')], { concurrency: 1 })
    q2.cancelAll()
    gate.resolve()
    expect((await q2.done).every((r) => r.state === 'cancelled')).toBe(true)
  })
  it('keeps running memory under budget and reports progress', async () => {
    let running = 0, peak = 0
    const updates: number[] = []
    const mk = (id: string) => ({ id, label: id, estimatedBytes: 600, run: async ({ progress }: any) => { running++; peak = Math.max(peak, running); progress(0.5); await tick(); running--; return 1 } })
    const q = runJobs([mk('a'), mk('b'), mk('c')], { concurrency: 3, memoryBudgetBytes: 1000, onUpdate: (s) => updates.push(s.filter((j) => j.state === 'running').length) })
    await q.done
    expect(peak).toBe(1)
    expect(defaultConcurrency({ hardwareConcurrency: 16 })).toBe(3)
    expect(defaultConcurrency({})).toBe(1)
  })
})

describe('unsupported browser + failed processing fallbacks', () => {
  it('refuses video processing without WebCodecs with a plain message', async () => {
    const orig = (globalThis as any).VideoEncoder
    delete (globalThis as any).VideoEncoder
    await expect(processVideo({ file: new Blob(['x']) })).rejects.toBeInstanceOf(MediaUnsupportedError)
    ;(globalThis as any).VideoEncoder = orig
  })
  it('releases the object URL and video element even when the video fails to load', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    const vid = document.createElement('video')
    vi.spyOn(vid, 'load').mockImplementation(() => {})
    vi.spyOn(document, 'createElement').mockImplementationOnce(() => vid)
    const p = probeVideo(new Blob(['x']))
    setTimeout(() => vid.onerror?.(new Event('error')), 0)
    await expect(p).rejects.toThrow(/could not be read/)
    expect(revoke).toHaveBeenCalledWith('blob:x')
    vi.restoreAllMocks()
  })
})
