'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cancelLocalAI, isModelCached, modelInfo, type ModelInfo, type ModelKey, type Progress } from './engine'

export type LocalAIPhase = 'idle' | 'confirm' | 'running' | 'error'

export interface RunHelpers { signal: AbortSignal; onProgress: (p: Progress) => void }
export type Runner<T> = (helpers: RunHelpers) => Promise<T>

export interface LocalAIState {
  phase: LocalAIPhase
  info: ModelInfo | null
  /** 0..1 while running, when the work reports progress. */
  progress: number | null
  /** What is happening right now ("Downloading the model", "Looking at frame 2 of 5"). */
  message: string | null
  error: string | null
}

export interface LocalAI extends LocalAIState {
  /**
   * Starts the work. If the model is not in this browser yet, it first asks (phase `confirm`) and only downloads
   * after `confirm()`. Resolves with the result, or `undefined` if the person declined or cancelled.
   */
  request: <T>(runner: Runner<T>) => Promise<T | undefined>
  confirm: () => void
  /** Stops the work (a running inference can only be stopped by ending its worker) or declines the download. */
  cancel: () => void
  dismiss: () => void
}

const isAbort = (e: unknown) => (e as { name?: string })?.name === 'AbortError'

/**
 * One free in-browser AI action at a time: consent before the one-time model download, progress, cancel, and a
 * plain error. Nothing is fetched until the person says so; an already-downloaded model runs straight away.
 */
export function useLocalAI(key: ModelKey): LocalAI {
  const [state, setState] = useState<LocalAIState>({ phase: 'idle', info: null, progress: null, message: null, error: null })
  const abortRef = useRef<AbortController | null>(null)
  const pendingRef = useRef<{ run: () => void; decline: () => void } | null>(null)
  const aliveRef = useRef(true)
  const latestRef = useRef(0)
  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false; abortRef.current?.abort(); pendingRef.current?.decline() }
  }, [])
  const set = useCallback((patch: Partial<LocalAIState>) => { if (aliveRef.current) setState((s) => ({ ...s, ...patch })) }, [])

  const request = useCallback(<T,>(runner: Runner<T>): Promise<T | undefined> => new Promise<T | undefined>((resolve) => {
    // One action at a time: a newer request replaces an older one, which then settles with `undefined` (never left hanging).
    const id = ++latestRef.current
    pendingRef.current?.decline()
    pendingRef.current = null
    abortRef.current?.abort()
    const run = async () => {
      pendingRef.current = null
      const ac = new AbortController()
      abortRef.current = ac
      set({ phase: 'running', progress: null, message: 'Starting…', error: null })
      try {
        const out = await runner({
          signal: ac.signal,
          onProgress: (p) => set({ progress: typeof p.progress === 'number' ? Math.min(1, Math.max(0, p.progress)) : null, message: p.message ?? (p.stage === 'download' ? 'Downloading the model (one time)…' : p.stage ? `Working (${p.stage})…` : null) }),
        })
        const current = abortRef.current === ac
        if (current) abortRef.current = null
        if (current) set({ phase: 'idle', progress: null, message: null })
        resolve(ac.signal.aborted ? undefined : out)
      } catch (e) {
        const current = abortRef.current === ac
        if (current) abortRef.current = null
        // A run that a newer request replaced must not touch the state the newer one now owns.
        if (!current) { resolve(undefined); return }
        if (isAbort(e) || ac.signal.aborted) { set({ phase: 'idle', progress: null, message: null }); resolve(undefined); return }
        set({ phase: 'error', progress: null, message: null, error: e instanceof Error && e.message ? e.message : 'This could not be done on this device.' })
        resolve(undefined)
      }
    }
    void (async () => {
      const [info, cached] = await Promise.all([modelInfo(key).catch(() => null), isModelCached(key).catch(() => false)])
      if (!aliveRef.current || latestRef.current !== id) { resolve(undefined); return }
      set({ info, error: null })
      if (cached) { void run(); return }
      pendingRef.current = { run: () => void run(), decline: () => resolve(undefined) }
      set({ phase: 'confirm' })
    })()
  }), [key, set])

  const confirm = useCallback(() => { pendingRef.current?.run() }, [])
  const cancel = useCallback(() => {
    if (pendingRef.current) { pendingRef.current.decline(); pendingRef.current = null; set({ phase: 'idle' }); return }
    if (abortRef.current) { abortRef.current.abort(); void cancelLocalAI().catch(() => undefined) }
  }, [set])
  const dismiss = useCallback(() => set({ phase: 'idle', error: null }), [set])
  return { ...state, request, confirm, cancel, dismiss }
}
