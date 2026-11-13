'use client'

/**
 * Saved layouts for the editor: the signed-in user's account layouts (Supabase, via the server route) merged with the ones kept
 * in this browser. Rules:
 *   - Browser storage always works and is the fallback; the editor never depends on the network.
 *   - Account sync switches on only if the server answers for a signed-in user; otherwise the reason is shown, honestly.
 *   - NOTHING is uploaded silently: a browser-only layout is uploaded only when the user presses Upload.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MAX_SAVED_LAYOUTS,
  deleteRemoteLayout,
  fetchRemoteLayouts,
  loadSavedLayouts,
  mergeLayouts,
  persistSavedLayouts,
  saveRemoteLayout,
  type LayoutSource,
  type SavedLayout,
} from './savedLayouts'

export type SyncStatus = 'checking' | 'account' | 'browser'
const nameKey = (n: string) => n.trim().toLowerCase()

export interface UseSavedLayoutsOptions {
  fetchFn?: typeof fetch
  storage?: Storage | null
}

export function useSavedLayouts({ fetchFn, storage }: UseSavedLayoutsOptions = {}) {
  const doFetch = useMemo<typeof fetch>(() => fetchFn ?? ((...a) => fetch(...a)), [fetchFn])
  const [local, setLocal] = useState<SavedLayout[]>(() => (storage === undefined ? loadSavedLayouts() : loadSavedLayouts(storage)))
  const [remote, setRemote] = useState<SavedLayout[]>([])
  const [status, setStatus] = useState<SyncStatus>('checking')
  const [statusMessage, setStatusMessage] = useState('')
  const [note, setNote] = useState('')
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    fetchRemoteLayouts(doFetch).then((r) => {
      if (!mounted.current) return
      if (r.ok) { setRemote(r.data); setStatus('account'); setStatusMessage('') }
      else { setStatus('browser'); setStatusMessage(r.message) }
    })
    return () => { mounted.current = false }
  }, [doFetch])

  const writeLocal = useCallback((next: SavedLayout[]): boolean => {
    setLocal(next)
    return storage === undefined ? persistSavedLayouts(next) : persistSavedLayouts(next, storage)
  }, [storage])

  const layouts: Array<SavedLayout & { source: LayoutSource }> = useMemo(() => mergeLayouts(remote, local), [remote, local])

  /** Save a snapshot. In account mode it goes to the account (and any same-name browser copy is dropped); otherwise to this browser. */
  const save = useCallback(async (layout: SavedLayout): Promise<void> => {
    if (status === 'account') {
      const r = await saveRemoteLayout(layout, doFetch)
      if (!mounted.current) return
      if (r.ok) {
        setRemote((prev) => [r.data, ...prev.filter((l) => nameKey(l.name) !== nameKey(r.data.name))])
        writeLocal(local.filter((l) => nameKey(l.name) !== nameKey(layout.name)))
        setNote(`Saved “${layout.name}” to your account.`)
        return
      }
      // Fall through to the browser so the work is never lost.
      const kept = writeLocal([layout, ...local.filter((l) => nameKey(l.name) !== nameKey(layout.name))].slice(0, MAX_SAVED_LAYOUTS))
      setNote(`${r.message}${kept ? ` Saved “${layout.name}” in this browser instead.` : ' Saved for this session only.'}`)
      return
    }
    const kept = writeLocal([layout, ...local.filter((l) => nameKey(l.name) !== nameKey(layout.name))].slice(0, MAX_SAVED_LAYOUTS))
    setNote(kept ? `Saved “${layout.name}” in this browser.` : 'Saved for this session only — browser storage is unavailable.')
  }, [status, doFetch, local, writeLocal])

  const remove = useCallback(async (layout: SavedLayout & { source: LayoutSource }): Promise<void> => {
    if (layout.source === 'account') {
      const r = await deleteRemoteLayout(layout.id, doFetch)
      if (!mounted.current) return
      if (!r.ok) { setNote(r.message); return }
      setRemote((prev) => prev.filter((l) => l.id !== layout.id))
      setNote(`Deleted “${layout.name}”.`)
      return
    }
    const kept = writeLocal(local.filter((l) => l.id !== layout.id))
    setNote(kept ? `Deleted “${layout.name}”.` : `Removed “${layout.name}” for this session only.`)
  }, [doFetch, local, writeLocal])

  /** Explicit user action: copy a browser-only layout into the account, then drop the browser copy. */
  const upload = useCallback(async (layout: SavedLayout): Promise<void> => {
    if (status !== 'account') { setNote(statusMessage || 'Sign in to keep layouts in your account.'); return }
    const r = await saveRemoteLayout(layout, doFetch)
    if (!mounted.current) return
    if (!r.ok) { setNote(r.message); return }
    setRemote((prev) => [r.data, ...prev.filter((l) => nameKey(l.name) !== nameKey(r.data.name))])
    writeLocal(local.filter((l) => l.id !== layout.id))
    setNote(`Uploaded “${layout.name}” to your account.`)
  }, [status, statusMessage, doFetch, local, writeLocal])

  return { layouts, status, statusMessage, note, setNote, save, remove, upload }
}
