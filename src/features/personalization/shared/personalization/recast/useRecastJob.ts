'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { processMotionControl, resumeGeneration } from '@ohb/packages/studio/src/muapi'
import {
  buildRecastParams,
  clearRecastJob,
  createRecastJob,
  loadRecastJob,
  restoredRecastJob,
  saveRecastJob,
  type RecastJob,
  type StartRecastInput,
} from './recastJob'

function outputUrlOf(result: unknown): string {
  const r = result as { url?: string; outputs?: string[]; output?: { url?: string } } | null
  return r?.url || r?.outputs?.[0] || r?.output?.url || ''
}

function isCancel(error: unknown, signal: AbortSignal): boolean {
  return signal.aborted || (error instanceof Error && error.name === 'AbortError')
}

/**
 * Owns the Full Body Recast job for the open source. It lives in the
 * personalization provider (not the panel), so it keeps running when the user
 * switches tabs or closes the modal, and it resumes from storage after a page
 * reload. `onDone` runs when a job finishes while its source is open; a job
 * that finished while the modal was closed (or before a reload) is left with
 * `applied: false` for the provider to apply once that source is open again.
 */
export function useRecastJob({
  apiKey,
  sourceId,
  ownerKey,
  onDone,
}: {
  apiKey: string
  sourceId: string | null | undefined
  /** The signed-in user (recastOwnerKey); jobs are only restored for their owner. */
  ownerKey: string
  onDone: (job: RecastJob) => void
}) {
  const [job, setJobState] = useState<RecastJob | null>(null)
  const jobRef = useRef<RecastJob | null>(null)
  // One controller per job, so a job for another demo keeps running (and
  // keeps its stored record up to date) while a different demo is open.
  const controllersRef = useRef(new Map<string, AbortController>())
  // Every job this page started or restored, by id, so updates to a job that
  // is no longer on screen still reach its stored record.
  const knownJobsRef = useRef(new Map<string, RecastJob>())
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  // The source open in the modal right now (null while the modal is closed).
  const openSourceRef = useRef<string | null>(sourceId || null)
  openSourceRef.current = sourceId || null

  const setJob = useCallback((next: RecastJob | null) => {
    jobRef.current = next
    setJobState(next)
    if (next) {
      knownJobsRef.current.set(next.id, next)
      saveRecastJob(next)
    }
  }, [])

  /** Update a job; the on-screen one also updates the UI. Returns it if on screen. */
  const patch = useCallback((id: string, changes: Partial<RecastJob>) => {
    const current = jobRef.current
    if (current && current.id === id) {
      const next = { ...current, ...changes }
      setJob(next)
      return next
    }
    const known = knownJobsRef.current.get(id)
    if (known) {
      const next = { ...known, ...changes }
      knownJobsRef.current.set(id, next)
      saveRecastJob(next)
    }
    return null
  }, [setJob])

  const controllerFor = (id: string) => {
    controllersRef.current.get(id)?.abort()
    const controller = new AbortController()
    controllersRef.current.set(id, controller)
    return controller
  }
  const stop = (id: string | undefined) => {
    if (!id) return
    controllersRef.current.get(id)?.abort()
    controllersRef.current.delete(id)
  }

  const finish = useCallback((id: string, url: string) => {
    if (!url) {
      patch(id, { status: 'error', error: 'The recast finished but returned no video.', finishedAt: Date.now() })
      return
    }
    const done = patch(id, { status: 'done', resultUrl: url, error: '', finishedAt: Date.now() })
    // Applied now if its source is open; otherwise when that source reopens.
    if (done && !done.applied && openSourceRef.current === done.sourceId) onDoneRef.current(done)
  }, [patch])

  const fail = useCallback((id: string, error: unknown) => {
    patch(id, {
      status: 'error',
      error: error instanceof Error ? error.message : 'Full body recast failed.',
      finishedAt: Date.now(),
    })
  }, [patch])

  const poll = useCallback(async (current: RecastJob) => {
    const controller = controllerFor(current.id)
    try {
      const result = await resumeGeneration(apiKey, current.requestId, { signal: controller.signal })
      if (controller.signal.aborted) return
      finish(current.id, outputUrlOf(result))
    } catch (error) {
      if (isCancel(error, controller.signal)) return
      fail(current.id, error)
    }
  }, [apiKey, finish, fail])

  // Another account signed in (or signed out): stop every job this page was
  // watching and forget them, whether or not the modal is open and whatever
  // job is on screen.
  const ownerRef = useRef(ownerKey)
  useEffect(() => {
    if (ownerRef.current === ownerKey) return
    ownerRef.current = ownerKey
    controllersRef.current.forEach((controller) => controller.abort())
    controllersRef.current.clear()
    knownJobsRef.current.clear()
    jobRef.current = null
    setJobState(null)
  }, [ownerKey])

  // Closing the modal (no source) leaves a running recast alone. Opening a
  // source picks up its job: the one already in memory, or one stored by an
  // earlier page load (resumed if it is still running) — only ever the
  // signed-in user's own.
  useEffect(() => {
    if (!sourceId) return
    const current = jobRef.current
    if (current && current.sourceId === sourceId && current.ownerKey === ownerKey) return
    const stored = loadRecastJob(sourceId, ownerKey)
    if (!stored) {
      jobRef.current = null
      setJobState(null)
      return
    }
    const known = knownJobsRef.current.get(stored.id)
    if (known && controllersRef.current.has(stored.id)) {
      // Still running in this page: just show it again.
      jobRef.current = known
      setJobState(known)
      return
    }
    const { job: restored, resume } = restoredRecastJob(stored)
    if (resume && !apiKey) {
      // It can't be checked without a key: say so instead of spinning forever.
      setJob({ ...restored, status: 'error', error: 'Connect your SmartVideo (MuAPI) API key in Settings, then Retry to finish this recast.', finishedAt: Date.now() })
      return
    }
    setJob(restored)
    if (resume) void poll(restored)
  }, [sourceId, ownerKey, apiKey, poll, setJob])

  useEffect(() => () => {
    controllersRef.current.forEach((controller) => controller.abort())
  }, [])

  const start = useCallback(async (input: StartRecastInput) => {
    // A recast is a paid AI call: never start a second one while one is already running
    // (a double click, or the same job started from Simple Mode and Advanced Editing).
    if (jobRef.current?.status === 'running') return
    stop(jobRef.current?.id)
    const created = createRecastJob(input)
    const controller = controllerFor(created.id)
    setJob(created)
    try {
      const result = await processMotionControl(apiKey, {
        ...buildRecastParams(created),
        signal: controller.signal,
        // Stored straight away (even if another demo is open by then) so a
        // reload can resume this exact request.
        onRequestId: (requestId: string) => { patch(created.id, { requestId }) },
      })
      if (controller.signal.aborted) return
      finish(created.id, outputUrlOf(result))
    } catch (error) {
      if (isCancel(error, controller.signal)) return
      fail(created.id, error)
    } finally {
      if (controllersRef.current.get(created.id) === controller) controllersRef.current.delete(created.id)
    }
  }, [apiKey, finish, fail, patch, setJob])

  const cancel = useCallback(() => {
    const current = jobRef.current
    stop(current?.id)
    if (current?.status === 'running') {
      patch(current.id, { status: 'cancelled', finishedAt: Date.now() })
    }
  }, [patch])

  /** Re-check the same request after an error (no new charge). */
  const retry = useCallback(() => {
    const current = jobRef.current
    if (!current || current.status !== 'error' || !current.requestId) return false
    // Without a key the poll can't succeed; keep the "connect your key" message.
    if (!apiKey) return false
    const running = patch(current.id, { status: 'running', error: '', finishedAt: 0 })
    if (running) void poll(running)
    return true
  }, [apiKey, patch, poll])

  const markApplied = useCallback(() => {
    const current = jobRef.current
    if (current && !current.applied) patch(current.id, { applied: true })
  }, [patch])

  const dismiss = useCallback(() => {
    const current = jobRef.current
    stop(current?.id)
    if (current) {
      clearRecastJob(current.sourceId, current.ownerKey)
      knownJobsRef.current.delete(current.id)
    }
    jobRef.current = null
    setJobState(null)
  }, [])

  return { job, start, cancel, retry, markApplied, dismiss }
}

export type RecastJobApi = ReturnType<typeof useRecastJob>
