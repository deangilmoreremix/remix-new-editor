// @vitest-environment jsdom
import React, { act } from 'react'
import { describe, it, expect, vi, afterEach, beforeAll, beforeEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useLocalAI, type LocalAI, type Runner } from '../useLocalAI'

const engine = vi.hoisted(() => ({ isModelCached: vi.fn(), modelInfo: vi.fn(), cancelLocalAI: vi.fn() }))
vi.mock('../engine', () => engine)

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true })
const INFO = { key: 'detr', label: 'Object detection', feature: 'x', sizeMB: 45, license: 'Apache-2.0' }
beforeEach(() => { engine.modelInfo.mockResolvedValue(INFO); engine.isModelCached.mockResolvedValue(false); engine.cancelLocalAI.mockResolvedValue(undefined) })
afterEach(() => { vi.clearAllMocks(); document.body.innerHTML = '' })

function mount() {
  const ref: { current: LocalAI | null } = { current: null }
  const Probe = () => { ref.current = useLocalAI('detr'); return null }
  const root = createRoot(document.body.appendChild(document.createElement('div')))
  act(() => { root.render(<Probe />) })
  return { ref, root }
}
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })

describe('useLocalAI', () => {
  it('asks before downloading and runs only after confirm', async () => {
    const { ref } = mount()
    const runner = vi.fn<Runner<string>>(async () => 'done')
    let result: Promise<string | undefined> = Promise.resolve(undefined)
    act(() => { result = ref.current!.request(runner) })
    await flush()
    expect(ref.current!.phase).toBe('confirm')
    expect(ref.current!.info?.sizeMB).toBe(45)
    expect(runner).not.toHaveBeenCalled()
    act(() => { ref.current!.confirm() })
    await flush()
    expect(await result).toBe('done')
    expect(ref.current!.phase).toBe('idle')
  })
  it('runs straight away when the model is already in this browser', async () => {
    engine.isModelCached.mockResolvedValue(true)
    const { ref } = mount()
    const runner = vi.fn<Runner<number>>(async () => 7)
    let result: Promise<number | undefined> = Promise.resolve(undefined)
    act(() => { result = ref.current!.request(runner) })
    await flush()
    expect(runner).toHaveBeenCalledTimes(1)
    expect(await result).toBe(7)
  })
  it('resolves undefined and downloads nothing when the person declines', async () => {
    const { ref } = mount()
    const runner = vi.fn<Runner<string>>(async () => 'x')
    let result: Promise<string | undefined> = Promise.resolve('unset')
    act(() => { result = ref.current!.request(runner) })
    await flush()
    act(() => { ref.current!.cancel() })
    expect(await result).toBeUndefined()
    expect(runner).not.toHaveBeenCalled()
    expect(ref.current!.phase).toBe('idle')
  })
  it('reports progress, and cancelling aborts the work and ends the worker', async () => {
    engine.isModelCached.mockResolvedValue(true)
    const { ref } = mount()
    let signal!: AbortSignal
    let report!: (p: { progress: number; stage: string }) => void
    const runner: Runner<string> = ({ signal: s, onProgress }) => { signal = s; report = onProgress; return new Promise((_, rej) => s.addEventListener('abort', () => rej(Object.assign(new Error('Cancelled'), { name: 'AbortError' })))) }
    let result: Promise<string | undefined> = Promise.resolve(undefined)
    act(() => { result = ref.current!.request(runner) })
    await flush()
    act(() => { report({ progress: 0.4, stage: 'download' }) })
    expect(ref.current!.progress).toBe(0.4)
    expect(ref.current!.message).toMatch(/Downloading/)
    act(() => { ref.current!.cancel() })
    expect(await result).toBeUndefined()
    await flush()
    expect(signal.aborted).toBe(true)
    expect(engine.cancelLocalAI).toHaveBeenCalled()
    expect(ref.current!.phase).toBe('idle')
  })
  it('turns a failure into a plain error state', async () => {
    engine.isModelCached.mockResolvedValue(true)
    const { ref } = mount()
    let result: Promise<unknown> = Promise.resolve(undefined)
    act(() => { result = ref.current!.request(async () => { throw new Error('This clip has no audio') }) })
    await flush()
    expect(await result).toBeUndefined()
    expect(ref.current!.phase).toBe('error')
    expect(ref.current!.error).toBe('This clip has no audio')
    act(() => { ref.current!.dismiss() })
    expect(ref.current!.phase).toBe('idle')
  })
  it('aborts running work when the component goes away', async () => {
    engine.isModelCached.mockResolvedValue(true)
    const { ref, root } = mount()
    let signal!: AbortSignal
    act(() => { void ref.current!.request(({ signal: s }) => { signal = s; return new Promise(() => {}) }) })
    await flush()
    act(() => { root.unmount() })
    expect(signal.aborted).toBe(true)
  })

  describe('two requests at once', () => {
    it('settles the first one (undefined) when a second arrives while it waits for consent', async () => {
      const { ref } = mount()
      let first: Promise<string | undefined> = Promise.resolve('x')
      let second: Promise<string | undefined> = Promise.resolve('x')
      act(() => { first = ref.current!.request(async () => 'one') })
      await flush()
      expect(ref.current!.phase).toBe('confirm')
      act(() => { second = ref.current!.request(async () => 'two') })
      await flush()
      expect(await first).toBeUndefined()
      act(() => { ref.current!.confirm() })
      await flush()
      expect(await second).toBe('two')
    })
    it('stops the earlier run when a second request starts', async () => {
      engine.isModelCached.mockResolvedValue(true)
      const { ref } = mount()
      let firstSignal: AbortSignal | undefined
      let first: Promise<string | undefined> = Promise.resolve('x')
      act(() => { first = ref.current!.request(({ signal }) => { firstSignal = signal; return new Promise<string>(() => {}) }) })
      await flush()
      expect(firstSignal?.aborted).toBe(false)
      act(() => { void ref.current!.request(async () => 'two') })
      await flush()
      expect(firstSignal?.aborted).toBe(true)
      void first
    })
  })
})
