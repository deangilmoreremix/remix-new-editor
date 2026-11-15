// @vitest-environment jsdom
import React, { act } from 'react'
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useBrandingRemoval, type BrandingRemoval } from '../useBrandingRemoval'
import type { RemovalDeps } from '../brandingRemoval'

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true })

const mounted: { root: ReturnType<typeof createRoot>; el: HTMLElement }[] = []
afterEach(() => { for (const { root, el } of mounted.splice(0)) { act(() => root.unmount()); el.remove() } })

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function setup(over: Partial<RemovalDeps> = {}, opts: { videoUrl?: string | null; apiKey?: string } = {}) {
  const job = deferred<{ url?: string | null }>()
  const deps: RemovalDeps = {
    processV2V: vi.fn(() => job.promise),
    estimateV2VCost: vi.fn(async () => ({ cost: 0.2, currency: 'USD' })),
    getUserBalance: vi.fn(async () => ({ balance: 10 })),
    ...over,
  }
  const onDone = vi.fn()
  const ref: { current: BrandingRemoval | null } = { current: null }
  function Probe() { ref.current = useBrandingRemoval({ apiKey: opts.apiKey ?? 'key', videoUrl: opts.videoUrl === undefined ? 'https://v/a.mp4' : opts.videoUrl, onDone, deps }); return null }
  const el = document.createElement('div'); document.body.appendChild(el)
  const root = createRoot(el); mounted.push({ root, el })
  // React.StrictMode like the dev server: effects mount, clean up and mount again.
  act(() => { root.render(<React.StrictMode><Probe /></React.StrictMode>) })
  return { ref, deps, onDone, job }
}
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve() })

describe('useBrandingRemoval', () => {
  it('starts idle and never calls the paid job on its own', async () => {
    const { ref, deps } = setup()
    expect(ref.current!.status).toBe('idle')
    await flush()
    expect(deps.processV2V).not.toHaveBeenCalled()
  })

  it('open() only fetches the quote; the job still has not started', async () => {
    const { ref, deps } = setup()
    act(() => { ref.current!.open() })
    expect(ref.current!.status).toBe('quoting')
    await flush()
    expect(ref.current!.status).toBe('confirm')
    expect(ref.current!.quote).toEqual({ estimate: { cost: 0.2, currency: 'USD' }, balance: 10 })
    expect(deps.processV2V).not.toHaveBeenCalled()
  })

  it('confirm() from idle does nothing: a job needs the confirmation step first', async () => {
    const { ref, deps } = setup()
    act(() => { ref.current!.confirm() })
    await flush()
    expect(ref.current!.status).toBe('idle')
    expect(deps.processV2V).not.toHaveBeenCalled()
  })

  it('runs the job after confirm and applies the result exactly once', async () => {
    const { ref, deps, onDone, job } = setup()
    act(() => { ref.current!.open() }); await flush()
    act(() => { ref.current!.confirm() }); await flush()
    expect(ref.current!.status).toBe('running')
    expect(deps.processV2V).toHaveBeenCalledTimes(1)
    await act(async () => { job.resolve({ url: 'https://cdn.test/clean.mp4' }); await Promise.resolve() })
    await flush()
    expect(ref.current!.status).toBe('done')
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onDone).toHaveBeenCalledWith('https://cdn.test/clean.mp4')
    // a second confirm cannot re-run it
    act(() => { ref.current!.confirm() }); await flush()
    expect(deps.processV2V).toHaveBeenCalledTimes(1)
  })

  it('does not start when the balance is known to be empty', async () => {
    const { ref, deps } = setup({ getUserBalance: vi.fn(async () => ({ balance: 0 })) })
    act(() => { ref.current!.open() }); await flush()
    expect(ref.current!.afford.ok).toBe(false)
    act(() => { ref.current!.confirm() }); await flush()
    expect(ref.current!.status).toBe('confirm')
    expect(deps.processV2V).not.toHaveBeenCalled()
  })

  it('a failed job shows the error, applies nothing, and can be retried from confirm', async () => {
    const { ref, onDone, job } = setup()
    act(() => { ref.current!.open() }); await flush()
    act(() => { ref.current!.confirm() }); await flush()
    await act(async () => { job.reject(new Error('402 payment required')); await Promise.resolve() })
    await flush()
    expect(ref.current!.status).toBe('error')
    expect(ref.current!.error).toContain('402')
    expect(onDone).not.toHaveBeenCalled()
  })

  it('a result with no video is an error, not a silent success', async () => {
    const { ref, onDone, job } = setup()
    act(() => { ref.current!.open() }); await flush()
    act(() => { ref.current!.confirm() }); await flush()
    await act(async () => { job.resolve({ url: null }); await Promise.resolve() }); await flush()
    expect(ref.current!.status).toBe('error')
    expect(onDone).not.toHaveBeenCalled()
  })

  it('stopping while it runs ignores the result when it arrives later', async () => {
    const { ref, onDone, job } = setup()
    act(() => { ref.current!.open() }); await flush()
    act(() => { ref.current!.confirm() }); await flush()
    act(() => { ref.current!.cancel() })
    expect(ref.current!.status).toBe('idle')
    await act(async () => { job.resolve({ url: 'https://cdn.test/late.mp4' }); await Promise.resolve() }); await flush()
    expect(onDone).not.toHaveBeenCalled()
    expect(ref.current!.status).toBe('idle')
  })

  it('cancelling the confirmation leaves nothing started', async () => {
    const { ref, deps } = setup()
    act(() => { ref.current!.open() }); await flush()
    act(() => { ref.current!.cancel() })
    expect(ref.current!.status).toBe('idle')
    expect(deps.processV2V).not.toHaveBeenCalled()
  })

  it('does nothing without a video', async () => {
    const { ref, deps } = setup({}, { videoUrl: null })
    act(() => { ref.current!.open() }); await flush()
    expect(ref.current!.status).toBe('idle')
    expect(deps.estimateV2VCost).not.toHaveBeenCalled()
  })

  it('a quote that arrives after cancel is ignored', async () => {
    const slow = deferred<{ balance: number }>()
    const { ref } = setup({ getUserBalance: vi.fn(() => slow.promise) })
    act(() => { ref.current!.open() }); await flush()
    act(() => { ref.current!.cancel() })
    await act(async () => { slow.resolve({ balance: 5 }); await Promise.resolve() }); await flush()
    expect(ref.current!.status).toBe('idle')
  })
})
