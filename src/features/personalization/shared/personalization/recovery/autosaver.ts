/**
 * Debounced autosave with a single writer at a time and cross-tab awareness (Stage 12).
 *   - changes are saved after a quiet period; identical content is not rewritten
 *   - a Web Lock serialises writes between tabs (so two tabs cannot interleave a read-modify-write of the history)
 *   - a BroadcastChannel tells other tabs "a newer draft was saved here"; a tab that sees that while it holds unsaved edits reports a
 *     CONFLICT instead of silently overwriting (the owner chooses)
 */
import { hashSettings, makeSnapshot, pushSnapshot, type Snapshot } from './snapshot'
import type { DraftStore } from './draftStore'

export interface ChannelLike { postMessage(m: unknown): void; addEventListener(t: 'message', fn: (e: { data: unknown }) => void): void; close(): void }
export type SaveState = { status: 'idle' } | { status: 'saved'; at: string } | { status: 'error'; message: string } | { status: 'conflict'; at: string }
export interface AutosaverOptions {
  key: string; store: DraftStore | null; debounceMs?: number; now?: () => Date
  locks?: LockManager | undefined; channel?: ChannelLike | null; tabId?: string
  setTimer?: (fn: () => void, ms: number) => unknown; clearTimer?: (h: unknown) => void
  onState?: (s: SaveState) => void
}

export function createAutosaver(o: AutosaverOptions) {
  const now = o.now ?? (() => new Date()); const wait = o.debounceMs ?? 1500
  const setT = o.setTimer ?? ((fn, ms) => setTimeout(fn, ms)); const clearT = o.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>))
  const tab = o.tabId ?? Math.random().toString(36).slice(2, 10)
  const locks = 'locks' in o ? o.locks : (globalThis as { navigator?: { locks?: LockManager } }).navigator?.locks
  let timer: unknown = null; let pending: unknown; let lastHash = ''; let chain: Promise<void> = Promise.resolve(); let remoteNewer: string | null = null; let closed = false
  const emit = (s: SaveState) => { try { o.onState?.(s) } catch { /* a listener must not break saving */ } }

  o.channel?.addEventListener('message', (e) => {
    const m = e.data as { type?: string; key?: string; tab?: string; savedAt?: string; hash?: string }
    if (!m || m.type !== 'draft-saved' || m.key !== o.key || m.tab === tab || typeof m.savedAt !== 'string') return
    remoteNewer = m.savedAt
    if (timer !== null || (pending !== undefined && hashSettings(pending) !== lastHash)) emit({ status: 'conflict', at: m.savedAt }) // this tab has edits waiting: they would replace the other tab's draft
  })

  const write = async (settings: unknown): Promise<void> => {
    if (!o.store) return
    const snap: Snapshot = makeSnapshot(settings, now())
    if (snap.hash === lastHash) return
    const run = async () => { const list = await o.store!.load(o.key); await o.store!.save(o.key, pushSnapshot(list, snap)) }
    try {
      if (locks) await locks.request(`smartvideo-autosave:${o.key}`, { mode: 'exclusive' }, run); else await run()
      lastHash = snap.hash; remoteNewer = null; emit({ status: 'saved', at: snap.savedAt })
      try { o.channel?.postMessage({ type: 'draft-saved', key: o.key, tab, savedAt: snap.savedAt, hash: snap.hash }) } catch { /* no channel */ }
    } catch (e) { emit({ status: 'error', message: 'Your changes could not be saved in this browser (storage may be full or blocked).' }); void e }
  }
  return {
    tabId: tab,
    /** Call on every change. */
    schedule(settings: unknown) { if (closed) return; pending = settings; if (timer !== null) clearT(timer); timer = setT(() => { timer = null; chain = chain.then(() => write(pending)) }, wait) },
    /** Save right now (before leaving the page, or when the owner presses "Save a draft"). */
    async flush(): Promise<void> { if (timer !== null) { clearT(timer); timer = null } if (pending !== undefined) chain = chain.then(() => write(pending)); await chain },
    /** Mark the current content as already stored (after restoring a draft) so it is not rewritten. */
    markSaved(settings: unknown) { lastHash = hashSettings(settings) },
    hasRemoteNewer: () => remoteNewer,
    close() { closed = true; if (timer !== null) clearT(timer); o.channel?.close() },
  }
}
