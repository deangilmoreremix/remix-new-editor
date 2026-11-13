/**
 * Reusable layouts (Stage 1): a named snapshot of where each layer sits, so the
 * same arrangement can be applied to another prospect's project.
 *
 * A layout stores GEOMETRY and presentation only — position, size, rotation,
 * opacity, visibility, lock, grouping and the source-footage transform. It never
 * stores text, images, URLs, brand values or custom-field values, so applying a
 * layout can never leak one prospect's content into another's video.
 *
 * Storage is this browser's localStorage (per browser/profile, not synced to
 * Supabase). Every storage call is guarded: it can throw or be empty in private
 * windows and the editor must keep working without it.
 */
import { normalizeRotation, normalizeSourceTransform } from '../preview/layerTransform'
import type {
  PersonalizationPreviewSettings,
  PreviewAspectRatio,
  PreviewLayer,
  PreviewLayerKind,
  SourceTransform,
} from '../preview/types'

export const SAVED_LAYOUTS_KEY = 'smartvideo.personalization.savedLayouts.v1'
export const MAX_SAVED_LAYOUTS = 30
const MAX_NAME = 60

export interface LayoutLayerSnapshot {
  id: string
  kind: PreviewLayerKind
  x: number
  y: number
  scale: number
  opacity: number
  visible: boolean
  rotation?: number
  locked?: boolean
  groupId?: string
}

export interface SavedLayout {
  id: string
  name: string
  createdAt: number
  aspectRatio: PreviewAspectRatio
  layers: LayoutLayerSnapshot[]
  sourceTransform?: SourceTransform
}

const ASPECTS: PreviewAspectRatio[] = ['16:9', '9:16', '1:1', '4:5']
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Captures the arrangement of the current settings. Design layers are skipped (they belong to a design, not a layout). */
export function snapshotLayout(
  settings: PersonalizationPreviewSettings,
  name: string,
  id: string,
  createdAt: number,
): SavedLayout | null {
  const cleanName = name.trim().slice(0, MAX_NAME)
  if (!cleanName) return null
  const layers: LayoutLayerSnapshot[] = settings.layers
    .filter((l) => l.kind !== 'design')
    .map((l) => {
      const snap: LayoutLayerSnapshot = {
        id: l.id, kind: l.kind, x: l.x, y: l.y, scale: l.scale, opacity: l.opacity, visible: l.visible,
      }
      if (l.rotation) snap.rotation = l.rotation
      if (l.locked) snap.locked = true
      if (l.groupId) snap.groupId = l.groupId
      return snap
    })
  if (layers.length === 0) return null
  const layout: SavedLayout = { id, name: cleanName, createdAt, aspectRatio: settings.aspectRatio, layers }
  if (settings.sourceTransform) layout.sourceTransform = { ...settings.sourceTransform }
  return layout
}

/**
 * Applies a layout to the current settings. Each snapshot is matched to a layer
 * by id first, then by kind (first unmatched layer of that kind). Layers the
 * layout does not mention are untouched; text, images and timing never change.
 * Returns how many layers were matched so the UI can report it honestly.
 */
export function applyLayout(
  settings: PersonalizationPreviewSettings,
  layout: SavedLayout,
): { settings: PersonalizationPreviewSettings; matched: number } {
  const used = new Set<string>()
  const pairs = new Map<string, LayoutLayerSnapshot>()
  const free = (l: PreviewLayer) => l.kind !== 'design' && !used.has(l.id)
  for (const snap of layout.layers) {
    const target =
      settings.layers.find((l) => l.id === snap.id && free(l) && l.kind === snap.kind) ??
      settings.layers.find((l) => l.kind === snap.kind && free(l))
    if (target) {
      used.add(target.id)
      pairs.set(target.id, snap)
    }
  }
  const layers = settings.layers.map((l) => {
    const snap = pairs.get(l.id)
    if (!snap) return l
    const next: PreviewLayer = {
      ...l,
      x: clamp01(snap.x),
      y: clamp01(snap.y),
      scale: Math.min(1, Math.max(0.02, snap.scale)),
      opacity: clamp01(snap.opacity),
      visible: snap.visible,
      placementSource: 'manual',
    }
    const rotation = normalizeRotation(snap.rotation)
    if (rotation !== undefined) next.rotation = rotation
    else delete next.rotation
    if (snap.locked) next.locked = true
    else delete next.locked
    if (snap.groupId) next.groupId = snap.groupId
    else delete next.groupId
    return next
  })
  const out: PersonalizationPreviewSettings = { ...settings, layers }
  if (layout.sourceTransform) out.sourceTransform = { ...layout.sourceTransform }
  else delete out.sourceTransform
  return { settings: out, matched: pairs.size }
}

/** Validates stored layouts; anything malformed is dropped rather than trusted. */
export function normalizeSavedLayouts(raw: unknown): SavedLayout[] {
  if (!Array.isArray(raw)) return []
  const out: SavedLayout[] = []
  for (const item of raw) {
    if (out.length >= MAX_SAVED_LAYOUTS) break
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const name = typeof r.name === 'string' ? r.name.trim().slice(0, MAX_NAME) : ''
    const id = typeof r.id === 'string' && r.id ? r.id.slice(0, 64) : ''
    if (!name || !id || !Array.isArray(r.layers)) continue
    const layers: LayoutLayerSnapshot[] = []
    for (const l of r.layers) {
      if (!l || typeof l !== 'object') continue
      const s = l as Record<string, unknown>
      if (typeof s.id !== 'string' || typeof s.kind !== 'string' || s.kind === 'design') continue
      const snap: LayoutLayerSnapshot = {
        id: s.id.slice(0, 64),
        kind: s.kind as PreviewLayerKind,
        x: clamp01(num(s.x, 0.5)),
        y: clamp01(num(s.y, 0.5)),
        scale: Math.min(1, Math.max(0.02, num(s.scale, 1))),
        opacity: clamp01(num(s.opacity, 1)),
        visible: s.visible !== false,
      }
      const rotation = normalizeRotation(s.rotation)
      if (rotation !== undefined) snap.rotation = rotation
      if (s.locked === true) snap.locked = true
      if (typeof s.groupId === 'string' && s.groupId) snap.groupId = s.groupId.slice(0, 64)
      layers.push(snap)
    }
    if (layers.length === 0) continue
    const layout: SavedLayout = {
      id, name, createdAt: num(r.createdAt, 0),
      aspectRatio: ASPECTS.includes(r.aspectRatio as PreviewAspectRatio) ? (r.aspectRatio as PreviewAspectRatio) : '16:9',
      layers,
    }
    const st = normalizeSourceTransform(r.sourceTransform)
    if (st) layout.sourceTransform = st
    out.push(layout)
  }
  return out
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

export function loadSavedLayouts(store: Storage | null = storage()): SavedLayout[] {
  if (!store) return []
  try {
    const raw = store.getItem(SAVED_LAYOUTS_KEY)
    return raw ? normalizeSavedLayouts(JSON.parse(raw)) : []
  } catch {
    return []
  }
}

/** Returns false (and keeps the in-memory list the caller holds) when storage is unavailable or full. */
export function persistSavedLayouts(layouts: SavedLayout[], store: Storage | null = storage()): boolean {
  if (!store) return false
  try {
    store.setItem(SAVED_LAYOUTS_KEY, JSON.stringify(layouts.slice(0, MAX_SAVED_LAYOUTS)))
    return true
  } catch {
    return false
  }
}

// ── Account sync (Supabase, via the server route) ────────────────────────────────────────────────────────────────
// The server route stores GEOMETRY ONLY and re-validates with `normalizeSavedLayouts`. Browser storage stays as the
// offline fallback; nothing is uploaded unless the user asks (see `useSavedLayouts`).

export const LAYOUTS_API = '/api/personalization/layouts'

export type RemoteFailure = 'unauthenticated' | 'unavailable' | 'limit' | 'invalid' | 'error'
export type RemoteResult<T> = { ok: true; data: T } | { ok: false; reason: RemoteFailure; message: string }

const REMOTE_MESSAGES: Record<RemoteFailure, string> = {
  unauthenticated: 'Sign in to keep layouts in your account.',
  unavailable: 'Account layouts are not available here, so layouts stay in this browser.',
  limit: 'You have reached the limit of 30 saved layouts. Delete one first.',
  invalid: 'That layout could not be saved.',
  error: 'Something went wrong talking to the server. Your layout is still saved in this browser.',
}

function failure<T>(reason: RemoteFailure): RemoteResult<T> {
  return { ok: false, reason, message: REMOTE_MESSAGES[reason] }
}

async function call(
  fetchFn: typeof fetch,
  url: string,
  init: RequestInit,
): Promise<{ status: number; json: Record<string, unknown> | null } | null> {
  try {
    const res = await fetchFn(url, { credentials: 'same-origin', ...init })
    let json: Record<string, unknown> | null = null
    try { json = (await res.json()) as Record<string, unknown> } catch { json = null }
    return { status: res.status, json }
  } catch {
    return null // offline / blocked
  }
}

function reasonFor(status: number): RemoteFailure {
  if (status === 401 || status === 403) return 'unauthenticated'
  if (status === 404 || status === 405) return 'unavailable'
  if (status === 409) return 'limit'
  if (status === 400 || status === 413) return 'invalid'
  return 'error'
}

/** The signed-in user's layouts. A non-JSON answer (e.g. an SPA fallback page) means the endpoint is not there. */
export async function fetchRemoteLayouts(fetchFn: typeof fetch = fetch): Promise<RemoteResult<SavedLayout[]>> {
  const r = await call(fetchFn, LAYOUTS_API, { method: 'GET' })
  if (!r) return failure('unavailable')
  if (r.status !== 200) return failure(reasonFor(r.status))
  if (!r.json || r.json.ok !== true || !Array.isArray(r.json.layouts)) return failure('unavailable')
  return { ok: true, data: normalizeSavedLayouts(r.json.layouts) }
}

/** Saves (or replaces, by name) one layout. Only geometry fields are sent. */
export async function saveRemoteLayout(layout: SavedLayout, fetchFn: typeof fetch = fetch): Promise<RemoteResult<SavedLayout>> {
  const { aspectRatio, layers, sourceTransform } = layout
  const r = await call(fetchFn, LAYOUTS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: layout.name, layout: { aspectRatio, layers, ...(sourceTransform ? { sourceTransform } : {}) } }),
  })
  if (!r) return failure('unavailable')
  if (r.status !== 200) return failure(reasonFor(r.status))
  const saved = normalizeSavedLayouts([r.json?.layout])[0]
  return saved ? { ok: true, data: saved } : failure('error')
}

export async function deleteRemoteLayout(id: string, fetchFn: typeof fetch = fetch): Promise<RemoteResult<true>> {
  const r = await call(fetchFn, `${LAYOUTS_API}?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!r) return failure('unavailable')
  if (r.status === 404) return { ok: true, data: true } // already gone
  if (r.status !== 200) return failure(reasonFor(r.status))
  return { ok: true, data: true }
}

const nameKey = (name: string) => name.trim().toLowerCase()

export type LayoutSource = 'account' | 'browser'

/**
 * One list for the UI: account layouts first, then browser-only layouts whose names are not already in the account
 * (the account copy wins when names collide, as the server replaces by name too).
 */
export function mergeLayouts(
  remote: SavedLayout[],
  local: SavedLayout[],
): Array<SavedLayout & { source: LayoutSource }> {
  const taken = new Set(remote.map((l) => nameKey(l.name)))
  return [
    ...remote.map((l) => ({ ...l, source: 'account' as const })),
    ...local.filter((l) => !taken.has(nameKey(l.name))).map((l) => ({ ...l, source: 'browser' as const })),
  ]
}
