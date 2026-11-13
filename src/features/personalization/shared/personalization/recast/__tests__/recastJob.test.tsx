// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

const muapi = vi.hoisted(() => ({
  processMotionControl: vi.fn(),
  resumeGeneration: vi.fn(),
}))
vi.mock('@ohb/packages/studio/src/muapi', () => muapi)

import {
  RECAST_MAX_RUN_MS,
  buildRecastParams,
  clampRecastDuration,
  loadRecastJob,
  restoredRecastJob,
  saveRecastJob,
  validateRecastClipFile,
  validateRecastDuration,
  type RecastJob,
} from '../recastJob'
import { useRecastJob } from '../useRecastJob'

const OWNER = 'owner-a'
const INPUT = {
  sourceId: 'demo-1',
  ownerKey: OWNER,
  sourceUrl: 'https://cdn.example.com/source.mp4',
  sourceLabel: 'Current video',
  identityId: 'person-1',
  identityName: 'Ana',
  identityUrl: 'https://cdn.example.com/ana.png',
  duration: 7.4,
  prompt: '  keep the wave ',
}

function storedJob(patch: Partial<RecastJob> = {}): RecastJob {
  return {
    id: 'recast_1', sourceId: 'demo-1', ownerKey: OWNER, status: 'running', requestId: 'req-9',
    sourceUrl: INPUT.sourceUrl, sourceLabel: 'Current video', identityId: 'person-1', identityName: 'Ana',
    identityUrl: INPUT.identityUrl, duration: 7, prompt: '', startedAt: Date.now() - 60_000,
    finishedAt: 0, resultUrl: '', error: '', applied: false, ...patch,
  }
}

beforeEach(() => {
  localStorage.clear()
  muapi.processMotionControl.mockReset()
  muapi.resumeGeneration.mockReset()
})
afterEach(() => localStorage.clear())

describe('recast helpers', () => {
  it('validates the clip type, size and 4–30 s length', () => {
    expect(validateRecastClipFile({ type: 'video/mp4', size: 10 })).toBe('')
    expect(validateRecastClipFile({ type: '', size: 10, name: 'take.MOV' })).toBe('')
    expect(validateRecastClipFile({ type: 'video/webm', size: 10, name: 'a.webm' })).toMatch(/MP4 or MOV/)
    expect(validateRecastClipFile({ type: 'video/mp4', size: 51 * 1024 * 1024 })).toMatch(/50 MB/)
    expect(validateRecastDuration(3)).toMatch(/at least 4/)
    expect(validateRecastDuration(31)).toMatch(/30 seconds or shorter/)
    expect(validateRecastDuration(12)).toBe('')
    expect(clampRecastDuration(2)).toBe(4)
    expect(clampRecastDuration(44)).toBe(30)
  })

  it('builds the open-genjutsu Seedance payload', () => {
    expect(buildRecastParams({ ...INPUT, duration: 7.4, prompt: ' keep the wave ' })).toEqual({
      model: 'seedance-2.5-motion-control',
      video_url: INPUT.sourceUrl,
      images_list: [INPUT.identityUrl],
      aspect_ratio: 'adaptive',
      duration: 7,
      generate_audio: false,
      prompt: 'keep the wave',
    })
  })

  it('resumes fresh running jobs and times out old or unsubmitted ones', () => {
    expect(restoredRecastJob(storedJob()).resume).toBe(true)
    const stale = restoredRecastJob(storedJob({ startedAt: Date.now() - RECAST_MAX_RUN_MS - 1 }))
    expect(stale).toMatchObject({ resume: false, job: { status: 'error' } })
    expect(stale.job.error).toMatch(/Timed out/)
    const unsent = restoredRecastJob(storedJob({ requestId: '' }))
    expect(unsent.job.error).toMatch(/Try again/)
  })
})

describe('useRecastJob', () => {
  it('stores the request id as soon as it is known, then finishes once', async () => {
    let resolveRun!: (value: unknown) => void
    muapi.processMotionControl.mockImplementation((_key: string, params: { onRequestId: (id: string) => void }) => {
      params.onRequestId('req-1')
      return new Promise((resolve) => { resolveRun = resolve })
    })
    const onDone = vi.fn()
    const { result } = renderHook(() => useRecastJob({ apiKey: 'k', sourceId: 'demo-1', ownerKey: OWNER, onDone }))

    act(() => { void result.current.start(INPUT) })
    await waitFor(() => expect(loadRecastJob('demo-1', OWNER)?.requestId).toBe('req-1'))
    expect(muapi.processMotionControl).toHaveBeenCalledWith('k', expect.objectContaining({
      model: 'seedance-2.5-motion-control',
      video_url: INPUT.sourceUrl,
      images_list: [INPUT.identityUrl],
      aspect_ratio: 'adaptive',
      duration: 7,
      generate_audio: false,
    }))
    expect(result.current.job?.status).toBe('running')

    await act(async () => { resolveRun({ url: 'https://cdn.example.com/out.mp4' }) })
    expect(result.current.job).toMatchObject({ status: 'done', resultUrl: 'https://cdn.example.com/out.mp4' })
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('never starts a second paid recast while one is running (double click / two panels)', async () => {
    muapi.processMotionControl.mockClear()
    let resolveRun!: (value: unknown) => void
    muapi.processMotionControl.mockImplementation((_key: string, params: { onRequestId: (id: string) => void }) => {
      params.onRequestId('req-dup')
      return new Promise((resolve) => { resolveRun = resolve })
    })
    const { result } = renderHook(() => useRecastJob({ apiKey: 'k', sourceId: 'demo-1', ownerKey: OWNER, onDone: vi.fn() }))
    act(() => { void result.current.start(INPUT) })
    await waitFor(() => expect(result.current.job?.status).toBe('running'))
    await act(async () => { await result.current.start(INPUT) })
    expect(muapi.processMotionControl).toHaveBeenCalledTimes(1)
    await act(async () => { resolveRun({ url: 'https://cdn.example.com/out.mp4' }) })
  })
  it('resumes a stored running job after a reload, by its request id', async () => {
    saveRecastJob(storedJob())
    muapi.resumeGeneration.mockResolvedValue({ url: 'https://cdn.example.com/out.mp4' })
    const onDone = vi.fn()
    const { result } = renderHook(() => useRecastJob({ apiKey: 'k', sourceId: 'demo-1', ownerKey: OWNER, onDone }))

    await waitFor(() => expect(result.current.job?.status).toBe('done'))
    expect(muapi.resumeGeneration).toHaveBeenCalledWith('k', 'req-9', expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(muapi.processMotionControl).not.toHaveBeenCalled()
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('cancel stops waiting and ignores a late result', async () => {
    let resolveRun!: (value: unknown) => void
    muapi.processMotionControl.mockImplementation((_key: string, params: { onRequestId: (id: string) => void }) => {
      params.onRequestId('req-1')
      return new Promise((resolve) => { resolveRun = resolve })
    })
    const onDone = vi.fn()
    const { result } = renderHook(() => useRecastJob({ apiKey: 'k', sourceId: 'demo-1', ownerKey: OWNER, onDone }))
    act(() => { void result.current.start(INPUT) })
    await waitFor(() => expect(result.current.job?.requestId).toBe('req-1'))

    act(() => result.current.cancel())
    expect(result.current.job?.status).toBe('cancelled')
    await act(async () => { resolveRun({ url: 'https://cdn.example.com/late.mp4' }) })
    expect(result.current.job?.status).toBe('cancelled')
    expect(onDone).not.toHaveBeenCalled()
  })

  it('retry re-checks the same request after an error', async () => {
    muapi.processMotionControl.mockImplementation(async (_key: string, params: { onRequestId: (id: string) => void }) => {
      params.onRequestId('req-1')
      throw new Error('Network down')
    })
    muapi.resumeGeneration.mockResolvedValue({ outputs: ['https://cdn.example.com/out.mp4'] })
    const onDone = vi.fn()
    const { result } = renderHook(() => useRecastJob({ apiKey: 'k', sourceId: 'demo-1', ownerKey: OWNER, onDone }))
    await act(async () => { await result.current.start(INPUT) })
    expect(result.current.job).toMatchObject({ status: 'error', error: 'Network down', requestId: 'req-1' })

    act(() => { result.current.retry() })
    await waitFor(() => expect(result.current.job?.status).toBe('done'))
    expect(muapi.processMotionControl).toHaveBeenCalledTimes(1)
    expect(muapi.resumeGeneration).toHaveBeenCalledWith('k', 'req-1', expect.anything())
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('a finished job that was already applied is not applied again on reopen', async () => {
    saveRecastJob(storedJob({ status: 'done', resultUrl: 'https://cdn.example.com/out.mp4', applied: true }))
    const onDone = vi.fn()
    const { result } = renderHook(() => useRecastJob({ apiKey: 'k', sourceId: 'demo-1', ownerKey: OWNER, onDone }))
    await waitFor(() => expect(result.current.job?.status).toBe('done'))
    expect(onDone).not.toHaveBeenCalled()
  })

  it("never restores another account's job from this browser", async () => {
    saveRecastJob(storedJob())
    localStorage.setItem('pz_recast_job:demo-1', JSON.stringify(storedJob({ ownerKey: undefined as unknown as string })))
    const onDone = vi.fn()
    const { result } = renderHook(() => useRecastJob({ apiKey: 'k2', sourceId: 'demo-1', ownerKey: 'owner-b', onDone }))
    await act(async () => {})
    expect(result.current.job).toBeNull()
    expect(muapi.resumeGeneration).not.toHaveBeenCalled()
    // The old unscoped entry can't be attributed to anyone, so it is dropped.
    expect(localStorage.getItem('pz_recast_job:demo-1')).toBeNull()
  })

  it('keeps the request id and result when another demo is opened mid-run', async () => {
    let sendRequestId!: (id: string) => void
    let resolveRun!: (value: unknown) => void
    muapi.processMotionControl.mockImplementation((_key: string, params: { onRequestId: (id: string) => void }) => {
      sendRequestId = params.onRequestId
      return new Promise((resolve) => { resolveRun = resolve })
    })
    const onDone = vi.fn()
    const { result, rerender } = renderHook(
      ({ sourceId }) => useRecastJob({ apiKey: 'k', sourceId, ownerKey: OWNER, onDone }),
      { initialProps: { sourceId: 'demo-1' } },
    )
    act(() => { void result.current.start(INPUT) })
    rerender({ sourceId: 'demo-2' })

    act(() => sendRequestId('req-1'))
    expect(loadRecastJob('demo-1', OWNER)?.requestId).toBe('req-1')
    await act(async () => { resolveRun({ url: 'https://cdn.example.com/out.mp4' }) })
    // Finished in the background: stored, applied when demo-1 is opened again.
    expect(loadRecastJob('demo-1', OWNER)).toMatchObject({ status: 'done', resultUrl: 'https://cdn.example.com/out.mp4', applied: false })
    expect(onDone).not.toHaveBeenCalled()
  })

  it('aborts a pending run and hides its job when another account signs in', async () => {
    let signal!: AbortSignal
    muapi.processMotionControl.mockImplementation((_key: string, params: { signal: AbortSignal }) => {
      signal = params.signal
      return new Promise(() => {})
    })
    const { result, rerender } = renderHook(
      ({ ownerKey }) => useRecastJob({ apiKey: 'k', sourceId: 'demo-1', ownerKey, onDone: vi.fn() }),
      { initialProps: { ownerKey: OWNER } },
    )
    act(() => { void result.current.start(INPUT) })
    expect(result.current.job?.status).toBe('running')
    rerender({ ownerKey: 'owner-b' })
    expect(signal.aborted).toBe(true)
    expect(result.current.job).toBeNull()
    expect(loadRecastJob('demo-1', 'owner-b')).toBeNull()
  })

  it('aborts a pending run when the account changes while the modal is closed', async () => {
    let signal!: AbortSignal
    muapi.processMotionControl.mockImplementation((_key: string, params: { signal: AbortSignal }) => {
      signal = params.signal
      return new Promise(() => {})
    })
    const { result, rerender } = renderHook(
      ({ ownerKey, sourceId }: { ownerKey: string; sourceId: string | null }) => useRecastJob({ apiKey: 'k', sourceId, ownerKey, onDone: vi.fn() }),
      { initialProps: { ownerKey: OWNER, sourceId: 'demo-1' as string | null } },
    )
    act(() => { void result.current.start(INPUT) })
    rerender({ ownerKey: OWNER, sourceId: null })
    expect(signal.aborted).toBe(false)
    rerender({ ownerKey: 'owner-b', sourceId: null })
    expect(signal.aborted).toBe(true)
    expect(result.current.job).toBeNull()
  })

  it('aborts a background run when the account changes after opening a demo with no job', async () => {
    let signal!: AbortSignal
    muapi.processMotionControl.mockImplementation((_key: string, params: { signal: AbortSignal }) => {
      signal = params.signal
      return new Promise(() => {})
    })
    const { result, rerender } = renderHook(
      ({ ownerKey, sourceId }) => useRecastJob({ apiKey: 'k', sourceId, ownerKey, onDone: vi.fn() }),
      { initialProps: { ownerKey: OWNER, sourceId: 'demo-1' } },
    )
    act(() => { void result.current.start(INPUT) })
    rerender({ ownerKey: OWNER, sourceId: 'demo-2' })
    expect(result.current.job).toBeNull()
    expect(signal.aborted).toBe(false)
    rerender({ ownerKey: 'owner-b', sourceId: 'demo-2' })
    expect(signal.aborted).toBe(true)
    expect(loadRecastJob('demo-1', 'owner-b')).toBeNull()
  })

  it('Retry does nothing without an API key and keeps the connect-your-key message', () => {
    localStorage.setItem(`pz_recast_job:${OWNER}:demo-1`, JSON.stringify({
      id: 'recast_9', sourceId: 'demo-1', ownerKey: OWNER, status: 'running', requestId: 'req-9',
      sourceUrl: 'https://x/a.mp4', sourceLabel: 'a', identityId: 'p', identityName: 'P', identityUrl: 'https://x/p.jpg',
      duration: 5, prompt: '', startedAt: Date.now(), finishedAt: 0, resultUrl: '', error: '', applied: false,
    }))
    const { result } = renderHook(() => useRecastJob({ apiKey: '', sourceId: 'demo-1', ownerKey: OWNER, onDone: vi.fn() }))
    expect(result.current.job?.status).toBe('error')
    const error = result.current.job?.error
    expect(error).toContain('Connect your SmartVideo')
    let retried = true
    act(() => { retried = result.current.retry() })
    expect(retried).toBe(false)
    expect(result.current.job?.status).toBe('error')
    expect(result.current.job?.error).toBe(error)
    expect(muapi.resumeGeneration).not.toHaveBeenCalled()
  })
})

