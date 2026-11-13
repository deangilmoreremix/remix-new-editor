// @vitest-environment jsdom
/**
 * The BG0 client runs inference in a Worker (WASM inference blocks the page
 * for ~10 s per image) and falls back to the main thread if the worker cannot
 * start. A fake Worker stands in for the real one.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

type Listener = (event: unknown) => void

class FakeWorker {
  static instances: FakeWorker[] = []
  static mode: 'ok' | 'fail-start' | 'error-reply' | 'hold' = 'ok'
  listeners: Record<string, Listener[]> = { message: [], error: [] }
  posted: Array<Record<string, unknown>> = []
  constructor(public url: unknown, public options?: unknown) {
    FakeWorker.instances.push(this)
  }
  addEventListener(type: string, fn: Listener) {
    this.listeners[type]?.push(fn)
  }
  removeEventListener(type: string, fn: Listener) {
    this.listeners[type] = (this.listeners[type] || []).filter((l) => l !== fn)
  }
  emit(type: string, event: unknown) {
    ;[...(this.listeners[type] || [])].forEach((l) => l(event))
  }
  terminated = false
  terminate() {
    this.terminated = true
  }
  postMessage(msg: Record<string, unknown>) {
    this.posted.push(msg)
    if (msg.type !== 'remove') return
    const id = msg.id
    queueMicrotask(() => {
      if (FakeWorker.mode === 'hold') return
      if (FakeWorker.mode === 'fail-start') return this.emit('error', { message: 'script failed to load' })
      if (FakeWorker.mode === 'error-reply') return this.emit('message', { data: { type: 'error', id, code: 'inference-failed', message: 'x' } })
      this.emit('message', { data: { type: 'progress', id, stage: 'processing', progress: 0.5, message: 'half' } })
      this.emit('message', {
        data: { type: 'done', id, blob: new Blob(['CUT'], { type: 'image/png' }), width: 2, height: 2, provider: 'wasm', quality: 'quality', durationMs: 3 },
      })
    })
  }
}

const mainThread = vi.hoisted(() => ({ calls: 0 }))
vi.mock('@bg0/browser', () => ({
  removeBackground: vi.fn(async () => {
    mainThread.calls++
    return { blob: new Blob(['MAIN'], { type: 'image/png' }), width: 1, height: 1, provider: 'wasm', quality: 'quality', durationMs: 1 }
  }),
  getBrowserCapabilities: () => ({ webgpu: false, wasm: true }),
}))

async function loadClient() {
  vi.resetModules()
  return import('../backgroundRemoval/backgroundRemovalClient')
}
const png = () => new Blob(['x'], { type: 'image/png' })

beforeEach(() => {
  FakeWorker.instances = []
  FakeWorker.mode = 'ok'
  mainThread.calls = 0
  vi.stubGlobal('Worker', FakeWorker)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BG0 client worker path', () => {
  it('runs the job in the worker, relays progress and returns its PNG', async () => {
    const { removeAssetBackground } = await loadClient()
    const onProgress = vi.fn()
    const result = await removeAssetBackground(png(), { quality: 'fast', onProgress })
    expect(FakeWorker.instances).toHaveLength(1)
    expect(FakeWorker.instances[0].options).toEqual({ type: 'module' })
    expect(FakeWorker.instances[0].posted[0]).toMatchObject({ type: 'remove', quality: 'fast' })
    expect(onProgress).toHaveBeenCalledWith({ stage: 'processing', progress: 0.5, message: 'half' })
    expect(result).toMatchObject({ width: 2, height: 2, provider: 'wasm', durationMs: 3 })
    expect(mainThread.calls).toBe(0)
  })

  it('reuses one worker for every job', async () => {
    const { removeAssetBackground } = await loadClient()
    await removeAssetBackground(png())
    await removeAssetBackground(png())
    expect(FakeWorker.instances).toHaveLength(1)
  })

  it('tells the worker to cancel when the signal aborts', async () => {
    const { removeAssetBackground } = await loadClient()
    FakeWorker.mode = 'hold' // the worker is busy and has not answered yet
    const controller = new AbortController()
    const job = removeAssetBackground(png(), { signal: controller.signal })
    await vi.waitFor(() => expect(FakeWorker.instances[0]?.posted.some((m) => m.type === 'remove')).toBe(true))
    controller.abort()
    const worker = FakeWorker.instances[0]
    expect(worker.posted.some((m) => m.type === 'cancel')).toBe(true)
    // BG0 answers the cancel with a `cancelled` error, which the client reports as such.
    const id = worker.posted.find((m) => m.type === 'remove')!.id
    worker.emit('message', { data: { type: 'error', id, code: 'cancelled', message: 'x' } })
    await expect(job).rejects.toMatchObject({ code: 'cancelled' })
  })

  it('drops a worker that ignores a cancel, so the queue is not frozen', async () => {
    vi.useFakeTimers()
    try {
      const { removeAssetBackground } = await loadClient()
      FakeWorker.mode = 'hold'
      const controller = new AbortController()
      const job = removeAssetBackground(png(), { signal: controller.signal })
      const settled = expect(job).rejects.toMatchObject({ code: 'cancelled' })
      await vi.waitFor(() => expect(FakeWorker.instances[0]?.posted.some((m) => m.type === 'remove')).toBe(true))
      controller.abort()
      await vi.advanceTimersByTimeAsync(5_100)
      await settled
      expect(FakeWorker.instances[0].terminated).toBe(true)
      // the next job starts on a fresh worker
      FakeWorker.mode = 'ok'
      await removeAssetBackground(png())
      expect(FakeWorker.instances).toHaveLength(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('gives up on a worker that never answers at all', async () => {
    vi.useFakeTimers()
    try {
      const { removeAssetBackground } = await loadClient()
      FakeWorker.mode = 'hold'
      const job = removeAssetBackground(png())
      const settled = expect(job).rejects.toMatchObject({ code: 'inference-failed' })
      await vi.advanceTimersByTimeAsync(181_000)
      await settled
    } finally {
      vi.useRealTimers()
    }
  })

  it('treats a result that arrives after the caller aborted as a cancellation', async () => {
    const { removeAssetBackground } = await loadClient()
    FakeWorker.mode = 'hold'
    const controller = new AbortController()
    const job = removeAssetBackground(png(), { signal: controller.signal })
    await vi.waitFor(() => expect(FakeWorker.instances[0]?.posted.some((m) => m.type === 'remove')).toBe(true))
    const worker = FakeWorker.instances[0]
    const id = worker.posted.find((m) => m.type === 'remove')!.id
    controller.abort() // the caller cancels...
    // ...but the worker had already finished: its result is in flight and arrives anyway.
    worker.emit('message', { data: { type: 'done', id, blob: new Blob(['CUT'], { type: 'image/png' }), width: 2, height: 2, provider: 'wasm', quality: 'quality', durationMs: 3 } })
    await expect(job).rejects.toMatchObject({ code: 'cancelled' })
  })

  it("defaults to the fast quality on every device, and an explicit quality still wins", async () => {
    const { removeAssetBackground } = await loadClient()
    await removeAssetBackground(png())
    await removeAssetBackground(png(), { quality: 'quality' })
    const qualities = FakeWorker.instances[0].posted.filter((m) => m.type === 'remove').map((m) => m.quality)
    expect(qualities).toEqual(['fast', 'quality'])
  })

  it('warms the model up with one tiny image, once, through the same queue', async () => {
    const { prefetchBackgroundRemovalModel } = await loadClient()
    await prefetchBackgroundRemovalModel()
    await prefetchBackgroundRemovalModel()
    await prefetchBackgroundRemovalModel()
    const jobs = FakeWorker.instances[0].posted.filter((m) => m.type === 'remove')
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({ quality: 'fast' })
    const warm = jobs[0].blob as Blob
    expect(warm.type).toBe('image/png')
    expect(warm.size).toBeGreaterThan(100)
    expect(warm.size).toBeLessThan(20_000) // tiny
  })

  it('never surfaces a warm-up failure', async () => {
    const { prefetchBackgroundRemovalModel } = await loadClient()
    FakeWorker.mode = 'error-reply'
    await expect(prefetchBackgroundRemovalModel()).resolves.toBeUndefined()
  })

  it('maps an error reported by the worker to a typed failure (no main-thread retry)', async () => {
    const { removeAssetBackground } = await loadClient()
    FakeWorker.mode = 'error-reply'
    await expect(removeAssetBackground(png())).rejects.toMatchObject({ code: 'inference-failed' })
    expect(mainThread.calls).toBe(0)
  })

  it('falls back to the main thread when the worker cannot start, and stops using it', async () => {
    const { removeAssetBackground } = await loadClient()
    FakeWorker.mode = 'fail-start'
    const first = await removeAssetBackground(png())
    expect(first.provider).toBe('wasm')
    expect(mainThread.calls).toBe(1)
    await removeAssetBackground(png())
    expect(mainThread.calls).toBe(2)
    expect(FakeWorker.instances).toHaveLength(1) // never retried
  })

  it('uses the main thread when Workers do not exist', async () => {
    vi.unstubAllGlobals()
    vi.stubGlobal('Worker', undefined)
    const { removeAssetBackground } = await loadClient()
    await removeAssetBackground(png())
    expect(mainThread.calls).toBe(1)
  })
})
