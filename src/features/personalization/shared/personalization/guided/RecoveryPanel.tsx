'use client'

/**
 * Autosave, draft recovery and backups for the design (Stage 12). Changes are saved in this browser a moment after you stop editing;
 * if the page was closed or crashed, the last draft is offered when you come back. A backup file (.zip) holds the design so it can be
 * kept elsewhere and restored. Videos, music, pictures and recordings are NOT in a draft or a backup: only the design settings.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PersonalizationPreviewSettings } from '../preview/types'
import { createAutosaver, type ChannelLike, type SaveState } from '../recovery/autosaver'
import { pickDraftStore, type DraftStore } from '../recovery/draftStore'
import { BackupError, buildBackup, draftToOffer, readBackup, restoreSettings, type Snapshot } from '../recovery/snapshot'
import { browserDownloadBlob } from './ThumbnailGifPanel'
import { C, chipStyle, hintStyle, labelStyle, softPanelStyle } from './tokens'

export interface RecoveryPanelProps {
  settings: PersonalizationPreviewSettings
  edit: (fn: (prev: PersonalizationPreviewSettings) => PersonalizationPreviewSettings) => void
  draftKey?: string
  /** Test seams. */
  storeFn?: () => Promise<DraftStore | null>
  locks?: LockManager | undefined
  channelFactory?: (name: string) => ChannelLike | null
  downloadFn?: (fileName: string, blob: Blob) => void
  debounceMs?: number
}
const small = { ...chipStyle(false), minHeight: 28, fontSize: 10 } as const
const row = { display: 'flex', gap: 6, flexWrap: 'wrap' as const, alignItems: 'center' }
const clock = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }

export function RecoveryPanel({ settings, edit, draftKey = 'default', storeFn, locks, channelFactory, downloadFn, debounceMs }: RecoveryPanelProps) {
  const [ready, setReady] = useState(false)
  const [available, setAvailable] = useState(true)
  const [offer, setOffer] = useState<Snapshot | null>(null)
  const [state, setState] = useState<SaveState>({ status: 'idle' })
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null)
  const saver = useRef<ReturnType<typeof createAutosaver> | null>(null)
  const storeRef = useRef<DraftStore | null>(null)
  const settingsRef = useRef(settings); settingsRef.current = settings
  // Injected callbacks are read through a ref: an inline function must not re-create the autosaver on every render.
  const seams = useRef({ storeFn, locks, channelFactory }); seams.current = { storeFn, locks, channelFactory }
  const dl = downloadFn ?? browserDownloadBlob

  useEffect(() => {
    let live = true
    void (async () => {
      const { storeFn: sf, locks: lk, channelFactory: cf } = seams.current
      const store = await (sf ?? (() => pickDraftStore()))().catch(() => null)
      if (!live) return
      storeRef.current = store; setAvailable(Boolean(store))
      const channel = cf ? cf('smartvideo-autosave') : typeof BroadcastChannel !== 'undefined' ? (new BroadcastChannel('smartvideo-autosave') as unknown as ChannelLike) : null
      saver.current = createAutosaver({ key: draftKey, store, ...(lk !== undefined ? { locks: lk } : {}), channel, debounceMs, onState: (s) => { if (live) setState(s) } })
      if (store) { const found = draftToOffer(await store.load(draftKey), settingsRef.current); if (found && live) setOffer(found) }
      if (live) setReady(true)
    })()
    return () => { live = false; void saver.current?.flush().finally(() => saver.current?.close()) }
  }, [draftKey, debounceMs])

  // Save after changes: not while a restore offer is waiting (saving the starting state would push the draft down the history).
  useEffect(() => { if (ready && !offer) saver.current?.schedule(settings) }, [settings, ready, offer])
  useEffect(() => {
    const leave = () => { void saver.current?.flush() }
    const hidden = () => { if (document.visibilityState === 'hidden') leave() }
    window.addEventListener('pagehide', leave); document.addEventListener('visibilitychange', hidden)
    return () => { window.removeEventListener('pagehide', leave); document.removeEventListener('visibilitychange', hidden) }
  }, [])

  const restore = useCallback((snap: Snapshot) => {
    const next = restoreSettings(snap); edit(() => next); saver.current?.markSaved(next); setOffer(null); setState({ status: 'idle' })
    setMsg({ text: `Restored the draft from ${clock(snap.savedAt)}.${snap.strippedBlobUrls ? ` ${snap.strippedBlobUrls} item${snap.strippedBlobUrls === 1 ? '' : 's'} that existed only in the browser's memory (for example a clip you just recorded) must be added again.` : ''}`, bad: snap.strippedBlobUrls > 0 })
  }, [edit])
  const discard = async () => { await storeRef.current?.clear(draftKey); setOffer(null); setMsg({ text: 'The saved draft was discarded.', bad: false }) }
  const useOther = async () => { const list = await storeRef.current?.load(draftKey); if (list?.[0]) restore(list[0]) }
  const keepMine = async () => { setState({ status: 'idle' }); await saver.current?.flush() }
  const backup = async () => { try { dl(`design-backup-${new Date().toISOString().slice(0, 10)}.zip`, await buildBackup(settings)); setMsg({ text: 'Backup downloaded. It holds the design settings only, not the video, music or pictures.', bad: false }) } catch { setMsg({ text: 'The backup could not be made.', bad: true }) } }
  const fromFile = async (file: File | undefined) => {
    if (!file) return
    try { const b = await readBackup(file); edit(() => b.settings); saver.current?.markSaved(b.settings); setMsg({ text: `Restored the backup${b.savedAt ? ` made ${b.savedAt.slice(0, 16).replace('T', ' ')} UTC` : ''}.${b.strippedBlobUrls ? ` ${b.strippedBlobUrls} item${b.strippedBlobUrls === 1 ? '' : 's'} that were only in the browser's memory when it was made are not included.` : ''}`, bad: b.strippedBlobUrls > 0 }) }
    catch (e) { setMsg({ text: e instanceof BackupError ? e.message : 'That file could not be restored. Nothing was changed.', bad: true }) }
  }

  return (
    <div style={{ ...softPanelStyle, display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="recovery-panel">
      <div style={labelStyle}>Autosave and backup</div>
      {offer ? (
        <div role="alert" data-testid="recovery-offer" style={{ ...hintStyle, color: C.text }}>
          A draft saved at {clock(offer.savedAt)} was found, different from what is on screen. Restore it?
          <div style={row}><button type="button" style={small} onClick={() => restore(offer)}>Restore the draft</button><button type="button" style={small} onClick={() => void discard()}>Discard it</button><button type="button" style={small} onClick={() => setOffer(null)}>Keep what is on screen</button></div>
        </div>
      ) : null}
      {state.status === 'conflict' ? (
        <div role="alert" data-testid="recovery-conflict" style={{ ...hintStyle, color: C.text }}>
          This design was also saved from another tab at {clock(state.at)}. Saving here would replace that draft.
          <div style={row}><button type="button" style={small} onClick={() => void useOther()}>Use the other tab&apos;s draft</button><button type="button" style={small} onClick={() => void keepMine()}>Keep my version</button></div>
        </div>
      ) : null}
      <p style={hintStyle} data-testid="recovery-status">
        {!ready ? 'Checking for a saved draft…' : !available ? 'Autosave is not available in this browser (storage is blocked). Download a backup to keep your work.' : state.status === 'saved' ? `Autosaved at ${clock(state.at)}.` : state.status === 'error' ? state.message : offer ? 'Autosave is paused until you choose above.' : 'Changes are saved in this browser a moment after you stop editing.'}
      </p>
      <div style={row}>
        <button type="button" style={small} onClick={() => void backup()}>Download a backup (.zip)</button>
        <label style={{ ...small, display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>Restore from a backup file<input aria-label="Backup file" type="file" accept=".zip,application/zip" style={{ display: 'none' }} onChange={(e) => { void fromFile(e.target.files?.[0]); e.target.value = '' }} /></label>
      </div>
      {msg ? <div role={msg.bad ? 'alert' : 'status'} data-testid="recovery-message" style={hintStyle}>{msg.text}</div> : null}
    </div>
  )
}
