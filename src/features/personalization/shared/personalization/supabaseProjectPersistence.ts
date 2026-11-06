/**
 * Supabase-backed persistence for personalization project state.
 *
 * Uses a debounced save so we do not write to the database on every
 * keystroke. Local state remains the source of truth during editing;
 * Supabase is the durable backing store.
 */

/**
 * Strip session-scoped blob URLs from a project state before it is serialized
 * to durable storage (Supabase or localStorage).
 *
 * `URL.createObjectURL` produces object URLs that are valid only for the
 * current browser tab session. If persisted, a page reload yields a dead link
 * that cannot be loaded. We therefore replace every blob URL with `null` so the
 * restore path falls back to source defaults instead of embedding a dead link.
 */
export function stripSessionScopedUrls(state: PersonalizationProjectState): PersonalizationProjectState {
  const isBlobUrl = (url: string | null | undefined): boolean =>
    typeof url === 'string' && url.startsWith('blob:')

  return {
    ...state,
    outputUrls: Array.isArray(state.outputUrls)
      ? state.outputUrls.filter((u) => typeof u === 'string' && !u.startsWith('blob:'))
      : [],
    assetUrls: durableAssetUrls(state.assetUrls),
    previewVideo:
      state.previewVideo && typeof state.previewVideo === 'object' && 'url' in state.previewVideo
        ? isBlobUrl((state.previewVideo as PreviewVideoRef).url)
          ? null
          : (state.previewVideo as PreviewVideoRef)
        : null,
     previewSettings: state.previewSettings
       ? {
           ...state.previewSettings,
           layers: Array.isArray(state.previewSettings.layers)
             ? state.previewSettings.layers.map((layer) => ({
                 ...layer,
                 imageUrl: isBlobUrl(layer.imageUrl) ? undefined : layer.imageUrl,
               }))
             : state.previewSettings.layers,
           audio:
             state.previewSettings.audio &&
             typeof state.previewSettings.audio === 'object' &&
             typeof state.previewSettings.audio.url === 'string' &&
             isBlobUrl(state.previewSettings.audio.url)
               ? null
               : state.previewSettings.audio,
         }
       : state.previewSettings,
  }
}

/** True for an `http(s)://` URL — the only kind that survives a reload. */
export function isDurableMediaUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}

/** Keeps only `id → http(s) URL` pairs; anything else (blob:, data:, junk) is dropped. */
export function durableAssetUrls(value: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out
  for (const [id, url] of Object.entries(value as Record<string, unknown>)) {
    if (id && isDurableMediaUrl(url)) out[id] = url
  }
  return out
}

/**
 * The URL a restored asset should load from: the saved durable URL for its id,
 * or the id itself when a legacy row stored a URL as the id. `null` means the
 * row has no loadable media for this asset, and the restore must skip it
 * rather than build an asset whose `url` is an opaque id.
 */
export function resolveRestoredAssetUrl(
  id: string,
  assetUrls: Record<string, string> | undefined,
): string | null {
  const saved = assetUrls?.[id]
  if (isDurableMediaUrl(saved)) return saved
  return isDurableMediaUrl(id) ? id : null
}

import type { ClientProfile, AssetLibrary, PersonalizationSource, GenerationOptions, GenerationState, PromptState, OutputType, VideoPersonalizationMode, ImagePersonalizationMode, PersonalizationViewMode } from './types'
import type { PersonalizationPreviewSettings, PreviewVideoRef } from './preview/types'

export interface PersonalizationProjectState {
  id?: string
  originStudio?: string
  sourceType: string
  sourceDemoId?: string | null
  sourceDemoSlug?: string | null
  viralRecordId?: string | null
  sourceMedia?: string | null
  sourceUrl?: string | null
  personalizationMode?: string | null
  model?: string | null
  originalPrompt: string
  personalizedPrompt: string
  identityAssetIds: string[]
  logoAssetIds: string[]
  productAssetIds: string[]
  brandReferenceAssetIds: string[]
  firstFrameAssetId?: string | null
  lastFrameAssetId?: string | null
  ctaAssetId?: string | null
  /**
   * Durable media URL for each saved asset id. The id lists above are only
   * identifiers; without this map a restore has nothing to load. Optional so
   * rows saved before the map existed still restore (their assets are skipped
   * unless the id itself is a durable URL — see `resolveRestoredAssetUrl`).
   */
  assetUrls?: Record<string, string>
  outputUrls: string[]
  outputType: OutputType
  clientId?: string | null
  status?: string
  ctaHeadline?: string | null
  callToAction?: string | null
  generationSettings?: Record<string, unknown>
  aiAssistState?: Record<string, unknown>
  // Guided Simple Mode + free Remotion preview (optional so projects saved
  // before the preview existed restore with defaults instead of failing).
  previewSettings?: PersonalizationPreviewSettings | null
  previewVideo?: PreviewVideoRef | null
  guidedStep?: number
  viewMode?: PersonalizationViewMode
}

const API_ROUTE = '/api/personalization/project'

export interface ProjectPersistenceOptions {
  /** Delay in ms before persisting after last change (default: 1500) */
  debounceMs?: number
}

export interface LoadProjectOptions {
  /** Specific project ID to load (skips source lookup) */
  projectId?: string
  /** Source demo ID to find most recent project for */
  sourceId?: string
}

export interface LoadProjectResult {
  ok: boolean
  data?: PersonalizationProjectState
  error?: string
}

// ── Row ⇄ state mapping ──────────────────────────────────────────────────────
//
// The durable row and the client state are deliberately different shapes. The
// table `personalization_saved_projects` (see
// `supabase/migrations/20261013000000_personalization_saved_projects.sql:45-61`)
// has five jsonb columns — `source`, `client`, `assets`, `prompt`,
// `generation` — plus a handful of scalars; the client state is one flat
// object. The mapping lives here, in the only module that sees both sides, so
// the API route stays a thin DB adapter and the two shapes cannot drift.
//
// The reader is forgiving on purpose: rows written by the older
// `projectRestore.ts` client put a whole `PersonalizationSource` into `source`
// and an `AssetLibrary` into `assets`, while rows written by this module put
// the flat field groups into the same columns. Both are read.

type SavedProjectRow = Record<string, unknown>

/** A `personalization_saved_projects.id` is a uuid; anything else is not a row id. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function asRecord(value: unknown): SavedProjectRow {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as SavedProjectRow)
    : {}
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

/** Accepts `['a','b']` and `[{id:'a'},{id:'b'}]` alike. */
function toIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const ids: string[] = []
  for (const item of value) {
    if (typeof item === 'string') {
      if (item) ids.push(item)
      continue
    }
    const id = asString(asRecord(item).id)
    if (id) ids.push(id)
  }
  return ids
}

/** First candidate that is an array wins; empty arrays are skipped. */
function firstIdList(...candidates: unknown[]): string[] {
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue
    const ids = toIdList(candidate)
    if (ids.length > 0) return ids
  }
  return []
}

/**
 * Flatten a saved-project row into the client state the provider restores from.
 * Returns `null` when the row is not an object.
 */
export function projectStateFromRow(row: unknown): PersonalizationProjectState | null {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null

  const r = row as SavedProjectRow
  const source = asRecord(r.source)
  const client = asRecord(r.client)
  const assets = asRecord(r.assets)
  const prompt = asRecord(r.prompt)
  const generation = asRecord(r.generation)

  // `generation` is this module's envelope when it carries any envelope key,
  // otherwise it is a legacy `GenerationOptions` object.
  const envelopeKeys = [
    'settings',
    'aiAssistState',
    'outputUrls',
    'previewSettings',
    'previewVideo',
    'guidedStep',
    'viewMode',
  ]
  const isEnvelope = envelopeKeys.some((key) => key in generation)
  const generationSettings = isEnvelope ? asRecord(generation.settings) : generation
  const outputUrls = isEnvelope ? generation.outputUrls : undefined
  const previewSettings = isEnvelope ? generation.previewSettings : undefined
  const previewVideo = isEnvelope ? generation.previewVideo : undefined
  const guidedStep = isEnvelope ? generation.guidedStep : undefined
  const viewMode = isEnvelope ? generation.viewMode : undefined

  return {
    id: asString(r.id) ?? undefined,
    originStudio: asString(r.originStudio) ?? asString(source.originStudio) ?? undefined,
    sourceType: asString(r.sourceType) ?? asString(source.sourceType) ?? '',
    // The probe set mirrors `readSourceDemoId` in
    // `app/api/personalization/project/route.ts` EXACTLY. The route filters the
    // saved-project list with one set of locations and this module reads the
    // id with another; if the two drift apart, the server keeps a row the
    // client cannot attribute, and the restore either picks the wrong project
    // or loses a good one. The real location is `source->>'id'` (the `source`
    // jsonb column holds the `PersonalizationSource`); the others are
    // tolerated for forward-compatibility.
    sourceDemoId:
      asString(r.sourceDemoId) ??
      asString(r.source_demo_id) ??
      asString(source.id) ??
      asString(source.demoId) ??
      asString(source.demo_id) ??
      asString(source.sourceDemoId) ??
      asString(source.source_demo_id) ??
      null,
    sourceDemoSlug: asString(r.sourceDemoSlug) ?? asString(source.slug) ?? null,
    viralRecordId: asString(r.viralRecordId) ?? asString(source.viralRecordId) ?? null,
    sourceMedia: asString(r.sourceMedia) ?? asString(source.sourceMedia) ?? null,
    sourceUrl: asString(r.sourceUrl) ?? asString(source.sourceUrl) ?? null,
    personalizationMode:
      asString(r.personalizationMode) ??
      asString(r.mode) ??
      asString(source.mode) ??
      null,
    model: asString(r.model) ?? asString(source.model) ?? null,
    originalPrompt: asString(r.originalPrompt) ?? asString(prompt.original) ?? '',
    personalizedPrompt:
      asString(r.personalizedPrompt) ??
      asString(prompt.personalized) ??
      asString(prompt.edited) ??
      '',
    identityAssetIds: firstIdList(r.identityAssetIds, assets.identityAssetIds, assets.identities),
    logoAssetIds: firstIdList(r.logoAssetIds, assets.logoAssetIds, assets.logos),
    productAssetIds: firstIdList(r.productAssetIds, assets.productAssetIds, assets.products),
    brandReferenceAssetIds: firstIdList(
      r.brandReferenceAssetIds,
      assets.brandReferenceAssetIds,
      assets.brandReferences,
    ),
    firstFrameAssetId:
      asString(r.firstFrameAssetId) ??
      asString(assets.firstFrameAssetId) ??
      asString(asRecord(assets.firstFrame).id) ??
      null,
    lastFrameAssetId:
      asString(r.lastFrameAssetId) ??
      asString(assets.lastFrameAssetId) ??
      asString(asRecord(assets.lastFrame).id) ??
      null,
    ctaAssetId:
      asString(r.ctaAssetId) ??
      asString(assets.ctaAssetId) ??
      asString(asRecord(assets.ctaGraphic).id) ??
      null,
    assetUrls: durableAssetUrls(r.assetUrls ?? assets.assetUrls),
    outputUrls: firstIdList(r.outputUrls, outputUrls),
    outputType: (asString(r.outputType) ?? asString(r.output_type) ?? 'prompt') as OutputType,
    clientId: asString(r.clientId) ?? asString(client.clientId) ?? null,
    status: asString(r.status) ?? 'idle',
    ctaHeadline: asString(r.ctaHeadline) ?? asString(client.ctaHeadline) ?? null,
    callToAction: asString(r.callToAction) ?? asString(client.callToAction) ?? null,
    generationSettings,
    aiAssistState: isEnvelope ? asRecord(generation.aiAssistState) : {},
    previewSettings: (previewSettings as PersonalizationPreviewSettings | null | undefined) ?? null,
    previewVideo: (previewVideo as PreviewVideoRef | null | undefined) ?? null,
    guidedStep: typeof guidedStep === 'number' ? guidedStep : undefined,
    viewMode: viewMode as PersonalizationViewMode | undefined,
  }
}

/**
 * Flatten the client state into a row the API route's POST contract accepts.
 *
 * The route reads `body.project` and maps `source` / `client` / `assets` /
 * `prompt` / `generation` onto the table's jsonb columns, so the source demo
 * id is persisted at `source.id` — the exact place the list filter looks for
 * it (`readSourceDemoId` in `app/api/personalization/project/route.ts`).
 */
export function projectRowFromState(state: PersonalizationProjectState): SavedProjectRow {
  return {
    // `p_id` is a uuid in the RPC; a non-uuid id would make the upsert fail
    // with a cast error instead of inserting a fresh row.
    id: state.id && UUID_PATTERN.test(state.id) ? state.id : null,
    source: {
      id: state.sourceDemoId ?? null,
      sourceType: state.sourceType ?? null,
      slug: state.sourceDemoSlug ?? null,
      sourceMedia: state.sourceMedia ?? null,
      sourceUrl: state.sourceUrl ?? null,
      model: state.model ?? null,
      mode: state.personalizationMode ?? null,
      originStudio: state.originStudio ?? null,
      viralRecordId: state.viralRecordId ?? null,
    },
    client: {
      clientId: state.clientId ?? null,
      ctaHeadline: state.ctaHeadline ?? null,
      callToAction: state.callToAction ?? null,
    },
    assets: {
      identityAssetIds: state.identityAssetIds ?? [],
      logoAssetIds: state.logoAssetIds ?? [],
      productAssetIds: state.productAssetIds ?? [],
      brandReferenceAssetIds: state.brandReferenceAssetIds ?? [],
      firstFrameAssetId: state.firstFrameAssetId ?? null,
      lastFrameAssetId: state.lastFrameAssetId ?? null,
      ctaAssetId: state.ctaAssetId ?? null,
      assetUrls: durableAssetUrls(state.assetUrls),
    },
    prompt: {
      original: state.originalPrompt ?? '',
      personalized: state.personalizedPrompt ?? '',
    },
    generation: {
      settings: state.generationSettings ?? {},
      aiAssistState: state.aiAssistState ?? {},
      outputUrls: state.outputUrls ?? [],
      previewSettings: state.previewSettings ?? null,
      previewVideo: state.previewVideo ?? null,
      guidedStep: state.guidedStep ?? null,
      viewMode: state.viewMode ?? null,
    },
    outputType: state.outputType ?? 'prompt',
    mode: state.personalizationMode ?? null,
    status: state.status ?? 'idle',
    errorMessage: null,
  }
}

/** The saved row id from a POST response (`project` is a row or a one-row array). */
function upsertedProjectId(body: unknown): string | null {
  const project = asRecord(body).project
  const row = Array.isArray(project) ? project[0] : project
  const id = asString(asRecord(row).id)
  return id && UUID_PATTERN.test(id) ? id : null
}

export function createProjectPersistence(opts: ProjectPersistenceOptions = {}) {
  const debounceMs = opts.debounceMs ?? 1500
  let timer: ReturnType<typeof setTimeout> | null = null
  let pendingState: PersonalizationProjectState | null = null
  // The row this session writes to. Every save carries it, so autosaves update
  // one row instead of inserting a new row each time (the upsert RPC inserts
  // whenever `p_id` is null). It is set by the restore, adopted from the
  // server's response to the first insert, and reset by `setProjectId` when
  // the modal moves to another source; `epoch` makes a late response from
  // before that reset harmless.
  let projectId: string | null = null
  let epoch = 0
  // Saves run one after another, so a second save cannot race the first
  // insert's response and insert a duplicate row.
  let queue: Promise<unknown> = Promise.resolve()

  function flush(state: PersonalizationProjectState): void {
    pendingState = null
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    save(state).catch(() => {
      /* best-effort; do not throw */
    })
  }

  function save(state: PersonalizationProjectState): Promise<{ ok: boolean; error?: string }> {
    // The session is captured when the save is QUEUED: a save still waiting
    // behind an in-flight one when the modal switches source belongs to the
    // old session and must be dropped, or it would be sent with the new
    // session's row id and overwrite that project.
    const queuedEpoch = epoch
    const run = queue.then(() =>
      queuedEpoch === epoch
        ? send(state, queuedEpoch)
        : { ok: false, error: 'Superseded by a newer project session' },
    )
    queue = run.catch(() => undefined)
    return run
  }

  function send(
    state: PersonalizationProjectState,
    sentEpoch: number,
  ): Promise<{ ok: boolean; error?: string }> {
    const sanitized = stripSessionScopedUrls({ ...state, id: state.id || projectId || undefined })
    // Route the fetch through a promise step so a synchronous throw (e.g. fetch
    // missing after environment teardown) or a non-thenable return (e.g. a mock
    // returning undefined) becomes an ordinary rejected-promise flow handled by
    // the terminal `.catch` below instead of an uncaught exception inside the
    // debounce timer callback.
    return Promise.resolve()
      .then(() =>
        fetch(API_ROUTE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project: projectRowFromState(sanitized) }),
          credentials: 'same-origin',
        })
      )
      .then(async (res) => {
        if (!res) return { ok: false, error: 'No response from server' }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          return { ok: false, error: data?.error || `HTTP ${res.status}` }
        }
        if (sentEpoch === epoch && !projectId && typeof res.json === 'function') {
          const savedId = upsertedProjectId(await res.json().catch(() => null))
          if (savedId && sentEpoch === epoch) projectId = savedId
        }
        return { ok: true }
      })
      .catch((error) => {
        return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' }
      })
  }

  return {
    /** Schedule a debounced persist of the given project state */
    persist(state: PersonalizationProjectState): void {
      pendingState = state
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        if (pendingState) flush(pendingState)
      }, debounceMs)
    },

    /** Immediately persist without waiting for debounce */
    flush(state: PersonalizationProjectState): void {
      flush(state)
    },

    /**
     * Point subsequent saves at an existing row (a restored project) or, with
     * `null`, at a fresh row (a different source, or no saved project yet).
     */
    setProjectId(id: string | null | undefined): void {
      epoch += 1
      projectId = id && UUID_PATTERN.test(id) ? id : null
    },

    /** The row id saves are currently written to (`null` until the first insert). */
    getProjectId(): string | null {
      return projectId
    },

    /** Cancel any pending debounced persist */
    cancel(): void {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      pendingState = null
    },
  }
}

/**
 * Load a previously-saved Personalization project from Supabase.
 *
 * Pass `projectId` to load a specific project, or `sourceId` to find the
 * most-recently-updated project for that source demo. Returns null when no
 * saved project exists (fresh session / never saved).
 *
 * When `sourceId` is supplied we request the source-scoped form of the list
 * endpoint (`?list=true&sourceId=<id>`) instead of an unparametrised GET: the
 * route treats an unparametrised GET as a programming error and answers
 * `400 MISSING_PROJECT_ID`, which used to fire silently on every modal open.
 * The route's RLS-aware list RPC still scopes the call to the authenticated
 * user; we only narrow the rows on the server.
 *
 * INVARIANT (Phase 3, item 1): this function NEVER issues a request that lacks
 * both an `id` and a `list` param. A blank id is a programming error and fails
 * loudly in development instead of becoming a silent 400 in production.
 */
export async function loadProject(opts: LoadProjectOptions = {}): Promise<LoadProjectResult> {
  const { projectId, sourceId } = opts

  // ── Loud guards ────────────────────────────────────────────────────────────
  // An id that is present but blank is a programming error: it must fail
  // loudly in development and must NOT reach the server, because a request
  // without `id`/`list` is answered with `400 MISSING_PROJECT_ID`.
  const projectIdTrimmed = projectId != null ? String(projectId).trim() : null
  const sourceIdTrimmed = sourceId != null ? String(sourceId).trim() : null

  for (const [label, value] of [
    ['projectId', projectIdTrimmed],
    ['sourceId', sourceIdTrimmed],
  ] as const) {
    if (value === null) continue
    if (value === '') {
      const message = `loadProject: ${label} must be a non-empty string`
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.error(message, { [label]: value })
      }
      return { ok: false, error: message }
    }
  }

  // A project id addresses exactly one row; a source id addresses the most
  // recent row for that demo. When both are supplied the project id wins.
  const effectiveProjectId = projectIdTrimmed || null
  const effectiveSourceId = effectiveProjectId ? null : sourceIdTrimmed || null

  if (!effectiveProjectId && !effectiveSourceId) {
    const message = 'loadProject: requires a projectId or a sourceId'
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error(message)
    }
    return { ok: false, error: message }
  }

  const url = new URL('/api/personalization/project', typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
  if (effectiveProjectId) {
    url.searchParams.set('id', effectiveProjectId)
  } else {
    // Source-scoped restore: route must always get a param it reads, or it
    // returns `400 MISSING_PROJECT_ID`. The list RPC's RLS predicate is still
    // the only trust boundary on ownership.
    url.searchParams.set('list', 'true')
    url.searchParams.set('sourceId', effectiveSourceId as string)
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30_000)

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      credentials: 'same-origin',
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      if (res.status === 404) return { ok: true, data: undefined }
      const data = await res.json().catch(() => ({}))
      return { ok: false, error: data?.error || `HTTP ${res.status}` }
    }

    const payload = await res.json().catch(() => ({}))
    const body = payload as {
      project?: unknown
      projects?: unknown
      data?: unknown
    }

    // The route answers a single row as `{ project }` and a list as
    // `{ projects }`. `data` is accepted as a legacy alias.
    let rawEntry: unknown
    if (effectiveProjectId) {
      rawEntry = body.project ?? body.data
    } else {
      const rows = Array.isArray(body.projects)
        ? body.projects
        : Array.isArray(body.data)
          ? body.data
          : []
      rawEntry = rows[0]
    }

    const entry = projectStateFromRow(rawEntry)
    if (!entry) return { ok: true, data: undefined }

    // When a source was requested the row must belong to that source. A row
    // that carries no source identifier means the server could not filter
    // (degraded mode — the list RPC exposes no source column), so the row is
    // accepted as the caller's most recent project.
    if (effectiveSourceId) {
      if (entry.sourceDemoId && entry.sourceDemoId !== effectiveSourceId) {
        return { ok: true, data: undefined }
      }
      if (!entry.sourceDemoId && process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn(
          'loadProject: the saved project carries no source id — the server could not filter by source',
          { sourceId: effectiveSourceId },
        )
      }
    }

    return { ok: true, data: entry }
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: false, error: 'Request timed out' }
    }
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// ── Convenience aliases expected by DemoPersonalizeProvider ───────────────────

export type SavedProject = PersonalizationProjectState

export async function saveProject(state: PersonalizationProjectState): Promise<{ ok: boolean; error?: string }> {
  const sanitized = stripSessionScopedUrls(state)
  // Same hardening as `save` above: a synchronous throw or non-thenable return
  // from fetch becomes a handled `{ ok: false, error }` result rather than an
  // uncaught exception.
  return Promise.resolve()
    .then(() =>
      fetch(API_ROUTE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: projectRowFromState(sanitized) }),
        credentials: 'same-origin',
      })
    )
    .then(async (res) => {
      if (!res) return { ok: false, error: 'No response from server' }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        return { ok: false, error: data?.error || `HTTP ${res.status}` }
      }
      return { ok: true }
    })
    .catch((error) => {
      return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' }
    })
}

export async function listProjects(): Promise<PersonalizationProjectState[]> {
  const url = new URL('/api/personalization/project', typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
  // The route answers a list request with `{ projects }`; `data` is accepted as
  // a legacy alias.
  url.searchParams.set('list', 'true')
  const res = await fetch(url.toString(), {
    method: 'GET',
    credentials: 'same-origin',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.error || `HTTP ${res.status}`)
  }
  const payload = await res.json().catch(() => ({}))
  const body = payload as { projects?: unknown; data?: unknown }
  const rows = Array.isArray(body.projects)
    ? body.projects
    : Array.isArray(body.data)
      ? body.data
      : []
  return rows
    .map((row) => projectStateFromRow(row))
    .filter((state): state is PersonalizationProjectState => state !== null)
}

export async function deleteProject(projectId: string): Promise<{ ok: boolean; error?: string }> {
  // Same loud guard as `loadProject`: a blank id is a programming error. It
  // must fail locally and must NOT reach the server, because a request whose
  // only param is a blank `id` is answered with `400 MISSING_PROJECT_ID`
  // (the route's falsy check treats an empty param as absent).
  const trimmed = typeof projectId === 'string' ? projectId.trim() : ''
  if (!trimmed) {
    const message = 'deleteProject: projectId must be a non-empty string'
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error(message)
    }
    return { ok: false, error: message }
  }
  const url = new URL('/api/personalization/project', typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
  url.searchParams.set('id', trimmed)
  const res = await fetch(url.toString(), {
    method: 'DELETE',
    credentials: 'same-origin',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { ok: false, error: data?.error || `HTTP ${res.status}` }
  }
  return { ok: true }
}
