'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { affordability, loadDefaultDeps, loadQuote, removeBranding, type Affordability, type Quote, type RemovalDeps } from './brandingRemoval'

export type BrandingRemovalStatus = 'idle' | 'quoting' | 'confirm' | 'running' | 'done' | 'error'

export interface BrandingRemoval {
  status: BrandingRemovalStatus
  quote: Quote | null
  afford: Affordability
  error: string | null
  /** Opens the confirmation (fetches the cost estimate and balance). Never starts the job. */
  open: () => void
  /** Closes the confirmation, or stops waiting for a running job. */
  cancel: () => void
  /** Starts the paid job. Only call this from an explicit "Remove branding" click in the confirmation. */
  confirm: () => void
  reset: () => void
}

/**
 * State machine for one removal. A job can only start from the `confirm` state, which is only entered by
 * `open()` (a click). `cancel()` while running cannot recall the provider job, so it stops waiting and ignores
 * the result; the UI says so plainly.
 */
export function useBrandingRemoval(opts: {
  apiKey: string
  videoUrl: string | null
  onDone: (url: string) => void
  /** Test seam: replaces the real MuAPI calls. */
  deps?: RemovalDeps
}): BrandingRemoval {
  const { apiKey, videoUrl, onDone, deps } = opts
  const [status, setStatus] = useState<BrandingRemovalStatus>('idle')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [error, setError] = useState<string | null>(null)
  const token = useRef(0)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const mounted = useRef(true)
  // Set true on every mount: React Strict Mode runs mount -> cleanup -> mount in development, and a cleanup that only
  // cleared the flag left it false for good, so every result was ignored.
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; token.current++ } }, [])

  const getDeps = useCallback(async () => deps ?? (await loadDefaultDeps()), [deps])

  const open = useCallback(() => {
    if (!videoUrl) return
    const mine = ++token.current
    setError(null); setQuote(null); setStatus('quoting')
    void (async () => {
      const d = await getDeps()
      const q = await loadQuote(d, { apiKey, videoUrl })
      if (!mounted.current || token.current !== mine) return
      setQuote(q); setStatus('confirm')
    })().catch(() => { if (mounted.current && token.current === mine) { setQuote({ estimate: null, balance: null }); setStatus('confirm') } })
  }, [apiKey, videoUrl, getDeps])

  const confirm = useCallback(() => {
    if (status !== 'confirm' || !videoUrl) return
    if (!affordability(quote?.balance ?? null).ok) return
    const mine = ++token.current
    setError(null); setStatus('running')
    void (async () => {
      try {
        const d = await getDeps()
        const { url } = await removeBranding(d, { apiKey, videoUrl })
        if (!mounted.current || token.current !== mine) return // stopped waiting: ignore the result
        setStatus('done')
        onDoneRef.current(url)
      } catch (e) {
        if (!mounted.current || token.current !== mine) return
        setError(e instanceof Error ? e.message : 'Removing the branding failed. Your original video is unchanged.')
        setStatus('error')
      }
    })()
  }, [status, videoUrl, quote, apiKey, getDeps])

  const cancel = useCallback(() => { token.current++; setStatus('idle'); setError(null) }, [])
  const reset = useCallback(() => { token.current++; setStatus('idle'); setError(null); setQuote(null) }, [])

  return { status, quote, afford: affordability(quote?.balance ?? null), error, open, cancel, confirm, reset }
}
