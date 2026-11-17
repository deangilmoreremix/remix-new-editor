// [remix] Stage 11 (port J): explicit crash recovery. FreeCut has no such module (its Stage 0 inventory found none), so this is original code.
// While a project has changes the normal debounced save has not finished, a small versioned snapshot of the editable workspace slice
// (timelines, active timeline, assets) is kept in IndexedDB. A successful save removes it. If the page dies first (crash, killed tab,
// failed save), the snapshot is still there on the next open and the user is asked "Recover unsaved changes?". The snapshot never
// replaces the saved project by itself: recovering dispatches ordinary (undoable) workspace actions, discarding deletes it.
import { createStore, get, set, del, type UseStore } from 'idb-keyval';
import type { Timeline } from '@cinegen/types/timeline';
import { PROJECT_SCHEMA_VERSION } from '@cinegen/lib/editor/project-migrations';

/** v1: timelines + assets only. v2 (Fix N): adds overlays, Spaces graph, media folders, sets, director. v1 snapshots still load. */
export const RECOVERY_VERSION = 2;
export const RECOVERY_MIN_VERSION = 1;
/** A string longer than this that starts with `data:` is a heavy inline payload: it stays out of the snapshot (the live copy is kept on recovery). */
export const RECOVERY_MAX_INLINE_DATA_CHARS = 4096;
const ELIDED_DATA = 'data:;elided';
const ELIDED_BLOB = 'blob:';
/** Snapshots older than this are ignored (stale work from a long-gone session). */
export const RECOVERY_MAX_AGE_MS = 14 * 24 * 3600 * 1000;
/** A snapshot larger than this is not written (the normal save still runs); keeps IndexedDB quota for media. */
export const RECOVERY_MAX_BYTES = 24 * 1024 * 1024;

/** The slice that is snapshotted. Assets are kept loose: only ids and plain JSON fields matter. */
type Rec = { id: string } & Record<string, unknown>;
export interface RecoverySpace { id: string; name?: string; nodes: unknown[]; edges: unknown[]; [k: string]: unknown }
export interface RecoverySlice {
  timelines: Timeline[];
  activeTimelineId: string;
  assets: Rec[];
  // v2 slices (all optional so core-only callers keep working; missing means empty)
  overlays?: Rec[];
  /** Every Space with its nodes/edges (the active space's live canvas already merged in, see resolveSpaces). Node results travel with the nodes. */
  spaces?: RecoverySpace[];
  activeSpaceId?: string;
  openSpaceIds?: string[];
  mediaFolders?: Rec[];
  director?: unknown;
  sets?: Rec[];
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

/** Deep copy that drops heavy inline `data:` payloads (and, for non-asset slices, session-only blob URLs) so they are never duplicated into the snapshot. */
export function elideHeavy<T>(v: T, blob = true): T {
  const walk = (x: unknown): unknown => {
    if (typeof x === 'string') {
      if (x.length > RECOVERY_MAX_INLINE_DATA_CHARS && x.startsWith('data:')) return ELIDED_DATA;
      if (blob && x.startsWith('blob:')) return ELIDED_BLOB;
      return x;
    }
    if (x === null || typeof x !== 'object') return x;
    if (Array.isArray(x)) return x.map(walk);
    const o: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(x as object)) { if (val !== undefined && typeof val !== 'function') o[k] = walk(val); }
    return o;
  };
  return walk(v) as T;
}

/** Puts live values back where the snapshot only has an elision marker (same path in `cur`); otherwise the key is dropped. */
export function restoreElided<T>(snap: T, cur: unknown): T {
  const walk = (s: unknown, c: unknown): unknown => {
    if (typeof s === 'string') return s === ELIDED_DATA || s === ELIDED_BLOB ? (typeof c === 'string' ? c : undefined) : s;
    if (s === null || typeof s !== 'object') return s;
    if (Array.isArray(s)) return s.map((x, i) => walk(x, Array.isArray(c) ? c[i] : undefined));
    const o: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(s as object)) {
      const r = walk(val, c && typeof c === 'object' && !Array.isArray(c) ? (c as Record<string, unknown>)[k] : undefined);
      if (r !== undefined) o[k] = r;
    }
    return o;
  };
  return walk(snap, cur) as T;
}

const byId = <T extends { id: string }>(l: T[] | undefined) => new Map((l ?? []).map((x) => [x.id, x] as const));
const idSorted = <T extends { id: string }>(l: T[] | undefined) => [...(l ?? [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/** The v2 slices in a stable, heavy-payload-free form (list order of id collections does not matter). */
function extComparable(s: RecoverySlice) {
  return {
    o: idSorted(elideHeavy(s.overlays ?? [])),
    sp: idSorted(elideHeavy(s.spaces ?? [])),
    as: s.activeSpaceId ?? '',
    os: [...(s.openSpaceIds ?? [])].sort(),
    f: idSorted(elideHeavy(s.mediaFolders ?? [])),
    d: elideHeavy(s.director ?? null),
    st: idSorted(elideHeavy(s.sets ?? [])),
  };
}

/** The v1 fingerprint (timelines, active timeline, assets). Used for v1 snapshots so they never prompt because of the new slices. */
export function coreFingerprint(s: RecoverySlice): string {
  return stableStringify({ t: s.timelines, a: s.activeTimelineId, s: s.assets.map(comparableAsset) });
}

export function sliceFingerprint(s: RecoverySlice): string {
  return stableStringify({ t: s.timelines, a: s.activeTimelineId, s: s.assets.map((a) => elideHeavy(comparableAsset(a), false)), x: extComparable(s) });
}

/** Fingerprint of `current` computed the way `snap` was built (v1 snapshots compare the core slice only). */
export function fingerprintFor(snap: Pick<RecoverySnapshot, 'v'>, current: RecoverySlice): string {
  return snap.v >= 2 ? sliceFingerprint(current) : coreFingerprint(current);
}

/** Merges the live canvas into the active space (exactly what the save path writes) and drops selection / drag flags. */
export function resolveSpaces(state: { spaces: RecoverySpace[]; activeSpaceId: string; nodes: unknown[]; edges: unknown[] }): RecoverySpace[] {
  const strip = (nodes: unknown[]) => (nodes ?? []).map((n) => ({ ...(n as object), selected: undefined, dragging: undefined }));
  return state.spaces.map((sp) => ({ ...sp, nodes: strip(sp.id === state.activeSpaceId ? state.nodes : sp.nodes), edges: sp.id === state.activeSpaceId ? state.edges : sp.edges }));
}

/** JSON round trip: guarantees the stored value is plain data (no functions, no cycles, no class instances). */
function plain<T>(v: T): T { return JSON.parse(JSON.stringify(v)) as T; }

function normalizeSlice(s: RecoverySlice): Required<RecoverySlice> {
  return {
    timelines: s.timelines, activeTimelineId: s.activeTimelineId, assets: elideHeavy(s.assets, false),
    overlays: elideHeavy(s.overlays ?? []), spaces: elideHeavy(s.spaces ?? []), activeSpaceId: s.activeSpaceId ?? '', openSpaceIds: [...(s.openSpaceIds ?? [])],
    mediaFolders: elideHeavy(s.mediaFolders ?? []), director: elideHeavy(s.director ?? null), sets: elideHeavy(s.sets ?? []),
  };
}

/** `version` 1 builds the legacy core-only snapshot (also the fallback when the full one does not fit). */
export function buildSnapshot(projectId: string, slice: RecoverySlice, now = Date.now(), version: 1 | 2 = 2): RecoverySnapshot {
  const full = plain(normalizeSlice(slice));
  if (version === 1) {
    const core = plain({ timelines: slice.timelines, activeTimelineId: slice.activeTimelineId, assets: slice.assets });
    return { v: 1, projectId, savedAt: now, schema: PROJECT_SCHEMA_VERSION, fingerprint: coreFingerprint(core), ...core };
  }
  return { v: 2, projectId, savedAt: now, schema: PROJECT_SCHEMA_VERSION, fingerprint: sliceFingerprint(full), ...full };
}

/** Validates an untrusted stored value. Returns null for anything unsupported (wrong version, wrong project, stale, malformed). */
export function parseSnapshot(raw: unknown, projectId: string, now = Date.now()): RecoverySnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<RecoverySnapshot>;
  if (typeof s.v !== 'number' || s.v < RECOVERY_MIN_VERSION || s.v > RECOVERY_VERSION || s.projectId !== projectId) return null;
  if (typeof s.savedAt !== 'number' || !Number.isFinite(s.savedAt) || now - s.savedAt > RECOVERY_MAX_AGE_MS || s.savedAt > now + 24 * 3600 * 1000) return null;
  if (typeof s.schema !== 'number' || s.schema > PROJECT_SCHEMA_VERSION) return null; // written by a newer build: do not guess
  if (!Array.isArray(s.timelines) || !s.timelines.length || typeof s.activeTimelineId !== 'string' || !Array.isArray(s.assets)) return null;
  for (const t of s.timelines) {
    if (!t || typeof (t as Timeline).id !== 'string' || !Array.isArray((t as Timeline).clips) || !Array.isArray((t as Timeline).tracks)) return null;
  }
  for (const a of s.assets) if (!a || typeof a.id !== 'string') return null;
  if (s.v >= 2) {
    const lists = [s.overlays, s.spaces, s.mediaFolders, s.sets];
    for (const l of lists) { if (!Array.isArray(l)) return null; for (const x of l) if (!x || typeof (x as Rec).id !== 'string') return null; }
    for (const sp of s.spaces as RecoverySpace[]) if (!Array.isArray(sp.nodes) || !Array.isArray(sp.edges)) return null;
    if (typeof s.activeSpaceId !== 'string' || !Array.isArray(s.openSpaceIds)) return null;
  }
  return s as RecoverySnapshot;
}

export type SpaceOp =
  | { kind: 'add'; space: RecoverySpace }
  | { kind: 'edit'; spaceId: string; name?: string; nodes?: unknown[]; edges?: unknown[] };

export interface RecoveryPlan {
  setTimelines: Timeline[];
  addTimelines: Timeline[];
  activeTimelineId: string | null;
  addAssets: Array<RecoverySlice['assets'][number]>;
  updateAssets: Array<RecoverySlice['assets'][number]>;
  addOverlays: Rec[]; updateOverlays: Rec[];
  addFolders: Rec[]; updateFolders: Rec[];
  addSets: Rec[]; updateSets: Rec[];
  director: unknown | null;
  spaceOps: SpaceOp[];
  openSpaceIds: string[];
  activeSpaceId: string | null;
}

function diffById(snapList: Rec[], curList: Rec[] | undefined): { add: Rec[]; update: Rec[] } {
  const cur = byId(curList); const add: Rec[] = []; const update: Rec[] = [];
  for (const x of snapList) {
    const c = cur.get(x.id);
    if (!c) add.push(restoreElided(x, undefined));
    else if (stableStringify(elideHeavy(c)) !== stableStringify(x)) update.push(restoreElided(x, c));
  }
  return { add, update };
}

/** What has to change in `current` (the freshly loaded project) to reach the snapshot. Never deletes timelines, assets, overlays, folders, sets or spaces. */
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
    if (!cur) addAssets.push(restoreElided(a, undefined));
    else if (stableStringify(elideHeavy(comparableAsset(cur), false)) !== stableStringify(elideHeavy(comparableAsset(a), false))) {
      // keep the live (restored) blob URL; take everything else from the snapshot
      const merged = restoreElided({ ...a }, cur) as Record<string, unknown> & { id: string };
      if (typeof a.url === 'string' && a.url.startsWith('blob:') && typeof cur.url === 'string') merged.url = cur.url;
      updateAssets.push(merged);
    }
  }
  const activeOk = snap.timelines.some((t) => t.id === snap.activeTimelineId);
  const plan: RecoveryPlan = {
    setTimelines, addTimelines, activeTimelineId: activeOk ? snap.activeTimelineId : null, addAssets, updateAssets,
    addOverlays: [], updateOverlays: [], addFolders: [], updateFolders: [], addSets: [], updateSets: [], director: null, spaceOps: [], openSpaceIds: [], activeSpaceId: null,
  };
  if (snap.v < 2) return plan;

  const o = diffById(snap.overlays ?? [], current.overlays); plan.addOverlays = o.add; plan.updateOverlays = o.update;
  const f = diffById(snap.mediaFolders ?? [], current.mediaFolders); plan.addFolders = f.add; plan.updateFolders = f.update;
  const st = diffById(snap.sets ?? [], current.sets); plan.addSets = st.add; plan.updateSets = st.update;
  if (snap.director != null && stableStringify(elideHeavy(current.director ?? null)) !== stableStringify(snap.director)) plan.director = restoreElided(snap.director, current.director);

  const curSpaces = byId(current.spaces);
  for (const sp of snap.spaces ?? []) {
    const c = curSpaces.get(sp.id);
    if (!c) { plan.spaceOps.push({ kind: 'add', space: restoreElided(sp, undefined) }); continue; }
    const op: SpaceOp & { kind: 'edit' } = { kind: 'edit', spaceId: sp.id };
    if (sp.name !== undefined && sp.name !== c.name) op.name = sp.name;
    if (stableStringify(elideHeavy(c.nodes)) !== stableStringify(sp.nodes)) op.nodes = restoreNodes(sp.nodes, c.nodes);
    if (stableStringify(elideHeavy(c.edges)) !== stableStringify(sp.edges)) op.edges = sp.edges;
    if (op.name !== undefined || op.nodes || op.edges) plan.spaceOps.push(op);
  }
  const known = new Set([...curSpaces.keys(), ...(snap.spaces ?? []).map((x) => x.id)]);
  const curOpen = new Set(current.openSpaceIds ?? []);
  plan.openSpaceIds = (snap.openSpaceIds ?? []).filter((id) => known.has(id) && !curOpen.has(id));
  const wantActive = (snap.activeSpaceId && known.has(snap.activeSpaceId)) ? snap.activeSpaceId : null;
  if (wantActive && (wantActive !== (current.activeSpaceId ?? '') || plan.spaceOps.length || plan.openSpaceIds.length)) plan.activeSpaceId = wantActive;
  return plan;
}

/** Nodes are matched by id so a heavy payload elided from the snapshot is taken from the live node with the same id. */
function restoreNodes(snapNodes: unknown[], curNodes: unknown[]): unknown[] {
  const cur = new Map((curNodes as Array<{ id: string }>).map((n) => [n.id, n]));
  return snapNodes.map((n) => restoreElided(n, cur.get((n as { id: string }).id)));
}

/** The ordinary workspace actions (all undoable, all in WORKSPACE_PERSIST_ACTIONS) that apply a plan; the caller sends them through wrappedDispatch. */
export function recoveryActions(plan: RecoveryPlan, migrate: (t: Timeline[]) => Timeline[] = (t) => t): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const asset of plan.addAssets) out.push({ type: 'ADD_ASSET', asset });
  for (const asset of plan.updateAssets) out.push({ type: 'UPDATE_ASSET', asset });
  for (const folder of plan.addFolders) out.push({ type: 'ADD_FOLDER', folder });
  for (const folder of plan.updateFolders) out.push({ type: 'UPDATE_FOLDER', folder });
  for (const overlay of plan.addOverlays) out.push({ type: 'ADD_OVERLAY', overlay });
  for (const overlay of plan.updateOverlays) out.push({ type: 'UPDATE_OVERLAY', overlayId: overlay.id, updates: overlay });
  for (const set of plan.addSets) out.push({ type: 'ADD_SET', set });
  for (const set of plan.updateSets) out.push({ type: 'UPDATE_SET', setId: set.id, updates: set });
  if (plan.director) out.push({ type: 'SET_DIRECTOR', director: plan.director });
  for (const timeline of migrate(plan.setTimelines)) out.push({ type: 'SET_TIMELINE', timelineId: timeline.id, timeline });
  for (const timeline of migrate(plan.addTimelines)) out.push({ type: 'ADD_TIMELINE', timeline });
  if (plan.activeTimelineId) out.push({ type: 'SET_ACTIVE_TIMELINE', timelineId: plan.activeTimelineId });
  // Spaces: a canvas edit targets the active space, so each edited space is activated first; the snapshot's own active space is restored last
  for (const op of plan.spaceOps) {
    if (op.kind === 'add') { out.push({ type: 'ADD_SPACE', space: op.space }); continue; }
    out.push({ type: 'SET_ACTIVE_SPACE', spaceId: op.spaceId });
    if (op.name !== undefined) out.push({ type: 'RENAME_SPACE', spaceId: op.spaceId, name: op.name });
    if (op.nodes) out.push({ type: 'SET_NODES', nodes: op.nodes });
    if (op.edges) out.push({ type: 'SET_EDGES', edges: op.edges });
  }
  for (const spaceId of plan.openSpaceIds) out.push({ type: 'OPEN_SPACE', spaceId });
  if (plan.activeSpaceId) out.push({ type: 'SET_ACTIVE_SPACE', spaceId: plan.activeSpaceId });
  return out;
}

export function summarize(snap: RecoverySnapshot): { clips: number; timelines: number; savedAt: number; overlays: number; nodes: number; spaces: number } {
  return {
    clips: snap.timelines.reduce((n, t) => n + t.clips.length, 0), timelines: snap.timelines.length, savedAt: snap.savedAt,
    overlays: snap.overlays?.length ?? 0, nodes: (snap.spaces ?? []).reduce((n, sp) => n + sp.nodes.length, 0), spaces: snap.spaces?.length ?? 0,
  };
}

export class RecoveryStore {
  constructor(private backend: RecoveryBackend = idbRecoveryBackend(), private clock: () => number = Date.now) {}

  /** Never throws and never blocks the save. Returns false when nothing was written. If the full (v2) snapshot is too big or the store refuses it
   *  (quota), it falls back to the small core (v1: timelines + assets) snapshot; if that fails too, nothing is stored. */
  async write(projectId: string, slice: RecoverySlice): Promise<boolean> {
    const now = this.clock();
    for (const version of [2, 1] as const) {
      try {
        const snap = buildSnapshot(projectId, slice, now, version);
        if (JSON.stringify(snap).length > RECOVERY_MAX_BYTES) continue;
        await this.backend.set(projectId, snap);
        return true;
      } catch { /* quota / serialisation: try the smaller form */ }
    }
    return false;
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
