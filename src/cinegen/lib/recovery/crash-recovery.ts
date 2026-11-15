// [remix] Stage 11 (port J): explicit crash recovery. FreeCut has no such module (its Stage 0 inventory found none), so this is original code.
// While a project has changes the normal debounced save has not finished, a small versioned snapshot of the editable workspace slice
// (timelines, active timeline, assets) is kept in IndexedDB. A successful save removes it. If the page dies first (crash, killed tab,
// failed save), the snapshot is still there on the next open and the user is asked "Recover unsaved changes?". The snapshot never
// replaces the saved project by itself: recovering dispatches ordinary (undoable) workspace actions, discarding deletes it.
import { createStore, get, set, del, type UseStore } from 'idb-keyval';
import type { Timeline } from '@cinegen/types/timeline';
import { PROJECT_SCHEMA_VERSION } from '@cinegen/lib/editor/project-migrations';

export const RECOVERY_VERSION = 1;
/** Snapshots older than this are ignored (stale work from a long-gone session). */
export const RECOVERY_MAX_AGE_MS = 14 * 24 * 3600 * 1000;
/** A snapshot larger than this is not written (the normal save still runs); keeps IndexedDB quota for media. */
export const RECOVERY_MAX_BYTES = 24 * 1024 * 1024;

/** The slice that is snapshotted. Assets are kept loose: only ids and plain JSON fields matter. */
export interface RecoverySlice {
  timelines: Timeline[];
  activeTimelineId: string;
  assets: Array<{ id: string } & Record<string, unknown>>;
}

export interface RecoverySnapshot extends RecoverySlice {
  v: number;
  projectId: string;
  savedAt: number;
  /** Project schema version the timelines were in; recovery runs the load migrations from it (they are idempotent). */
  schema: number;
  /** Fingerprint of the slice, used to tell "same as the saved project" from "unsaved changes". */
  fingerprint: string;
}

export interface RecoveryBackend {
  get(projectId: string): Promise<unknown>;
  set(projectId: string, value: unknown): Promise<void>;
  del(projectId: string): Promise<void>;
}

export function memoryRecoveryBackend(): RecoveryBackend {
  const m = new Map<string, unknown>();
  return { get: async (k) => m.get(k), set: async (k, v) => { m.set(k, v); }, del: async (k) => { m.delete(k); } };
}

export function idbRecoveryBackend(dbName = 'cinegen-recovery', storeName = 'snapshots'): RecoveryBackend {
  let st: UseStore | null = null;
  const store = () => (st ??= createStore(dbName, storeName));
  return { get: (k) => get(k, store()), set: (k, v) => set(k, v, store()), del: (k) => del(k, store()) };
}

/** Key-order independent JSON (so a re-ordered object is not a "change"). Drops `undefined`, like JSON. */
export function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  const walk = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v as object)) return null;
    seen.add(v as object);
    if (Array.isArray(v)) return v.map(walk);
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      const x = (v as Record<string, unknown>)[k];
      if (x !== undefined && typeof x !== 'function') o[k] = walk(x);
    }
    return o;
  };
  return JSON.stringify(walk(value));
}

/** Asset fields that are session-only (blob URLs change every load) must not make two equal projects look different. */
function comparableAsset(a: Record<string, unknown>): Record<string, unknown> {
  const o = { ...a };
  if (typeof o.url === 'string' && o.url.startsWith('blob:')) o.url = 'blob:';
  if (typeof o.thumbnail === 'string' && (o.thumbnail as string).startsWith('blob:')) o.thumbnail = 'blob:';
  return o;
}

export function sliceFingerprint(s: RecoverySlice): string {
  return stableStringify({ t: s.timelines, a: s.activeTimelineId, s: s.assets.map(comparableAsset) });
}

/** JSON round trip: guarantees the stored value is plain data (no functions, no cycles, no class instances). */
function plain<T>(v: T): T { return JSON.parse(JSON.stringify(v)) as T; }

export function buildSnapshot(projectId: string, slice: RecoverySlice, now = Date.now()): RecoverySnapshot {
  const clean: RecoverySlice = plain({ timelines: slice.timelines, activeTimelineId: slice.activeTimelineId, assets: slice.assets });
  return { v: RECOVERY_VERSION, projectId, savedAt: now, schema: PROJECT_SCHEMA_VERSION, fingerprint: sliceFingerprint(clean), ...clean };
}

/** Validates an untrusted stored value. Returns null for anything unsupported (wrong version, wrong project, stale, malformed). */
export function parseSnapshot(raw: unknown, projectId: string, now = Date.now()): RecoverySnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<RecoverySnapshot>;
  if (s.v !== RECOVERY_VERSION || s.projectId !== projectId) return null;
  if (typeof s.savedAt !== 'number' || !Number.isFinite(s.savedAt) || now - s.savedAt > RECOVERY_MAX_AGE_MS || s.savedAt > now + 24 * 3600 * 1000) return null;
  if (typeof s.schema !== 'number' || s.schema > PROJECT_SCHEMA_VERSION) return null; // written by a newer build: do not guess
  if (!Array.isArray(s.timelines) || !s.timelines.length || typeof s.activeTimelineId !== 'string' || !Array.isArray(s.assets)) return null;
  for (const t of s.timelines) {
    if (!t || typeof (t as Timeline).id !== 'string' || !Array.isArray((t as Timeline).clips) || !Array.isArray((t as Timeline).tracks)) return null;
  }
  for (const a of s.assets) if (!a || typeof a.id !== 'string') return null;
  return s as RecoverySnapshot;
}

export interface RecoveryPlan {
  setTimelines: Timeline[];
  addTimelines: Timeline[];
  activeTimelineId: string | null;
  addAssets: Array<RecoverySlice['assets'][number]>;
  updateAssets: Array<RecoverySlice['assets'][number]>;
}

/** What has to change in `current` (the freshly loaded project) to reach the snapshot. Never deletes anything. */
export function planRecovery(snap: RecoverySnapshot, current: RecoverySlice): RecoveryPlan {
  const tlById = new Map(current.timelines.map((t) => [t.id, t]));
  const setTimelines: Timeline[] = []; const addTimelines: Timeline[] = [];
  for (const t of snap.timelines) {
    const cur = tlById.get(t.id);
    if (!cur) addTimelines.push(t);
    else if (stableStringify(cur) !== stableStringify(t)) setTimelines.push(t);
  }
  const assetById = new Map(current.assets.map((a) => [a.id, a]));
  const addAssets: RecoveryPlan['addAssets'] = []; const updateAssets: RecoveryPlan['updateAssets'] = [];
  for (const a of snap.assets) {
    const cur = assetById.get(a.id);
    if (!cur) addAssets.push(a);
    else if (stableStringify(comparableAsset(cur)) !== stableStringify(comparableAsset(a))) {
      // keep the live (restored) blob URL; take everything else from the snapshot
      const merged = { ...a } as Record<string, unknown> & { id: string };
      if (typeof a.url === 'string' && a.url.startsWith('blob:') && typeof cur.url === 'string') merged.url = cur.url;
      updateAssets.push(merged);
    }
  }
  const activeOk = snap.timelines.some((t) => t.id === snap.activeTimelineId);
  return { setTimelines, addTimelines, activeTimelineId: activeOk ? snap.activeTimelineId : null, addAssets, updateAssets };
}

export function summarize(snap: RecoverySnapshot): { clips: number; timelines: number; savedAt: number } {
  return { clips: snap.timelines.reduce((n, t) => n + t.clips.length, 0), timelines: snap.timelines.length, savedAt: snap.savedAt };
}

export class RecoveryStore {
  constructor(private backend: RecoveryBackend = idbRecoveryBackend(), private clock: () => number = Date.now) {}

  /** Never throws: recovery is a safety net, it must not break editing. Returns false when nothing was written. */
  async write(projectId: string, slice: RecoverySlice): Promise<boolean> {
    try {
      const snap = buildSnapshot(projectId, slice, this.clock());
      if (JSON.stringify(snap).length > RECOVERY_MAX_BYTES) return false;
      await this.backend.set(projectId, snap);
      return true;
    } catch { return false; }
  }

  async read(projectId: string): Promise<RecoverySnapshot | null> {
    try {
      const raw = await this.backend.get(projectId);
      const snap = parseSnapshot(raw, projectId, this.clock());
      if (!snap && raw !== undefined) await this.backend.del(projectId); // unsupported / stale / corrupt: drop it
      return snap;
    } catch { return null; }
  }

  async clear(projectId: string): Promise<void> { try { await this.backend.del(projectId); } catch { /* nothing stored */ } }
}

export const recoveryStore = new RecoveryStore();
