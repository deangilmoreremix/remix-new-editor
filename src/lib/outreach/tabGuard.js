// src/lib/outreach/tabGuard.js
//
// One tab edits the Video Outreach draft at a time (Web Locks API). The draft is a single localStorage
// key, so two open tabs would otherwise overwrite each other's work. A second tab is told the campaign
// is open elsewhere and can take over ("steal" the lock); the tab that lost it goes read-only and
// follows the other tab's saves (BroadcastChannel). When the editing tab closes, a waiting tab gets the
// lock back by itself. Browsers without Web Locks: no blocking, only a "changed in another tab" notice
// from the storage event.

const LOCK = 'smartvideo-outreach-draft';

/**
 * @param {object} o
 * @param {(active:boolean) => void} o.onChange  called whenever this tab gains or loses editing
 * @param {() => void} o.onRemoteSave            another tab saved the draft (reload it)
 * @returns {{ active: () => boolean, supported: boolean, takeOver: () => void, saved: () => void, destroy: () => void }}
 */
export function createTabGuard({ onChange = () => {}, onRemoteSave = () => {}, locks = globalThis.navigator?.locks, Channel = globalThis.BroadcastChannel, win = globalThis.window, storageKey = 'outreach-draft-v1' } = {}) {
  const id = Math.random().toString(36).slice(2);
  let active = true; // until we know otherwise, behave as today
  let destroyed = false;
  let release = null; // resolves the held lock's promise
  let waiting = false; // one queued request at a time
  const channel = Channel ? new Channel(LOCK) : null;
  const set = (next) => { if (next !== active) { active = next; onChange(active); } };

  const hold = (lock) => {
    if (destroyed || !lock) return undefined;
    set(true);
    return new Promise((resolve) => { release = resolve; });
  };
  const lost = (err) => {
    release = null;
    if (destroyed) return;
    if (err?.name === 'AbortError') { set(false); wait(); } // another tab took over: wait for our turn again
  };
  // Queue for the lock: we get it when the editing tab closes (or releases it).
  const wait = () => {
    if (destroyed || waiting) return;
    waiting = true;
    locks.request(LOCK, (lock) => { waiting = false; return hold(lock); }).catch((err) => { waiting = false; lost(err); });
  };

  if (locks?.request) {
    locks.request(LOCK, { ifAvailable: true }, (lock) => {
      if (!lock) { set(false); wait(); return undefined; }
      return hold(lock);
    }).catch(lost);
  }

  const onMessage = (e) => { if (e?.data?.type === 'saved' && e.data.from !== id) onRemoteSave(); };
  channel?.addEventListener?.('message', onMessage);
  // Fallback without BroadcastChannel/Web Locks: the storage event fires in other tabs on each save.
  const onStorage = (e) => { if (!channel && e.key === storageKey) onRemoteSave(); };
  win?.addEventListener?.('storage', onStorage);

  return {
    supported: !!locks?.request,
    active: () => active,
    takeOver() {
      if (!locks?.request || destroyed) return;
      locks.request(LOCK, { steal: true }, (lock) => hold(lock)).catch(lost);
    },
    saved() { channel?.postMessage?.({ type: 'saved', from: id }); },
    destroy() {
      destroyed = true;
      release?.();
      release = null;
      channel?.removeEventListener?.('message', onMessage);
      channel?.close?.();
      win?.removeEventListener?.('storage', onStorage);
    },
  };
}
