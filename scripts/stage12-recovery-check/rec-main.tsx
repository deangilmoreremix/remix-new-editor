// Browser side of the Stage 12 check: the REAL OPFS draft store, Web Locks, BroadcastChannel and the real autosaver and backup code.
import { createDefaultPreviewSettings } from '@ohb/shared/personalization/preview/presets'
import { pickDraftStore } from '@ohb/shared/personalization/recovery/draftStore'
import { createAutosaver } from '@ohb/shared/personalization/recovery/autosaver'
import { buildBackup, draftToOffer, readBackup } from '@ohb/shared/personalization/recovery/snapshot'

const W = window as any
const S = (width: number, extra: Record<string, unknown> = {}) => ({ ...createDefaultPreviewSettings(), width, ...extra })
const b64 = async (blob: Blob) => { const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000)); return btoa(s) }
const mkSaver = async (key: string, onState?: (s: any) => void, tabId?: string) => {
  const store = await pickDraftStore(); const channel = new BroadcastChannel('stage12-check')
  return { store, saver: createAutosaver({ key, store, channel: channel as any, debounceMs: 30, onState, tabId }) }
}
W.kind = async () => (await pickDraftStore())?.kind ?? null
W.hasApis = () => ({ locks: Boolean(navigator.locks), bc: typeof BroadcastChannel !== 'undefined', opfs: Boolean(navigator.storage?.getDirectory) })
W.saveDraft = async (key: string, widths: number[]) => { const { saver } = await mkSaver(key); for (const w of widths) { saver.schedule(S(w)); await saver.flush() } return true }
W.loadDraft = async (key: string, current: number) => { const store = await pickDraftStore(); const list = await store!.load(key); const offer = draftToOffer(list, S(current)); return { n: list.length, widths: list.map((s: any) => s.settings.width), offerWidth: offer ? (offer.settings as any).width : null } }
/** Two savers on the same key in this page + a second tab running writes: interleaved saves from both must never corrupt the history. */
W.hammer = async (key: string, tab: string, base: number, count: number) => {
  const states: string[] = []; const { saver } = await mkSaver(key, (s) => states.push(s.status), tab)
  for (let i = 0; i < count; i += 1) { saver.schedule(S(base + i)); await saver.flush(); if (i % 3 === 0) await new Promise((r) => setTimeout(r, 2)) }
  return { states: [...new Set(states)] }
}
W.conflictProbe = async (key: string) => {
  const states: any[] = []; const { saver } = await mkSaver(key, (s) => states.push(s), 'tab-B'); saver.markSaved(S(1)); saver.schedule(S(2)) // unsaved edit, timer pending
  W.__saver = saver; W.__states = states; return true
}
W.conflictState = () => (W.__states as any[]).map((s) => s.status)
/** An aborted OPFS write must leave the previous file exactly as it was. */
W.abortedWrite = async () => {
  const root = await navigator.storage.getDirectory(); const fh = await root.getFileHandle('abort-probe.txt', { create: true })
  const w1 = await fh.createWritable(); await w1.write('KEEP'); await w1.close()
  const w2 = await fh.createWritable(); await w2.write('PARTIAL-NEW-CONTENT'); await (w2 as any).abort()
  const after = await (await fh.getFile()).text(); await root.removeEntry('abort-probe.txt'); return after
}
W.backup = async () => { const blob = await buildBackup(S(4321, { audio: { url: 'blob:http://x/1' } }), new Date('2026-11-14T09:00:00Z')); return b64(blob) }
W.restoreBackup = async (b: string) => { const bytes = Uint8Array.from(atob(b), (c) => c.charCodeAt(0)); try { const r = await readBackup(new Blob([bytes])); return { ok: true, width: r.settings.width, stripped: r.strippedBlobUrls } } catch (e: any) { return { ok: false, error: e.message } } }
W.ready = true
