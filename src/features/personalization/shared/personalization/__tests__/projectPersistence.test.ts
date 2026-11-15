/**
 * Persistence contract — Phase 3, item 1 (`400 MISSING_PROJECT_ID`).
 *
 * Two surfaces are under contract here:
 *
 * 1. `supabaseProjectPersistence.ts` (the client). INVARIANT: `loadProject`
 *    (and the sibling `listProjects` / `deleteProject`) NEVER issue a request
 *    to `/api/personalization/project` that lacks BOTH an `id` and a `list`
 *    param — that request shape is the one the route answers with
 *    `400 MISSING_PROJECT_ID`. Every branch, including the empty/whitespace
 *    guards, must either refuse to fetch or carry one of the two params.
 *
 * 2. `app/api/personalization/project/route.ts` (the server). The list RPC
 *    `personalization_saved_projects_list` returns `setof
 *    personalization_saved_projects` whose columns are
 *    id, clerk_user_id, source, client, assets, prompt, generation,
 *    output_type, mode, status, error_message, created_at, updated_at —
 *    there is NO top-level `sourceDemoId` column. The demo id lives at
 *    `source->>'id'`. The route's source filter must therefore read that
 *    location, keep the matching row, drop non-matching rows, and DEGRADE to
 *    the unfiltered list (never an empty one) when no row carries a source
 *    identifier at all. An empty list because a column name was wrong is
 *    indistinguishable from "the user never saved this project".
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import {
  loadProject,
  listProjects,
  deleteProject,
  createProjectPersistence,
  projectRowFromState,
  projectStateFromRow,
  resolveRestoredAssetUrl,
  stripSessionScopedUrls,
  type PersonalizationProjectState,
} from '../supabaseProjectPersistence'

// ── Route dependencies ────────────────────────────────────────────────────────
// The route imports @clerk/nextjs/server, @/lib/supabase,
// @/server/personalizationLog and @/server/envValidation. All four are mocked
// so the GET handler runs entirely in-process; the Supabase client is reduced
// to the single `rpc` entry point the route uses.

const routeMocks = vi.hoisted(() => ({
  auth: vi.fn(),
  createServerClient: vi.fn(),
  logPersonalization: vi.fn(),
  createCorrelationId: vi.fn(() => 'corr-p3a-test'),
  requirePersonalizationEnv: vi.fn(),
}))

vi.mock('../../../../../../netlify/functions/_personalization/shims/clerk-server', () => ({ auth: routeMocks.auth }))
vi.mock('../../../../../../netlify/functions/_personalization/src/lib/supabase', () => ({ createServerClient: routeMocks.createServerClient }))
vi.mock('../../../../../../netlify/functions/_personalization/src/server/personalizationLog', () => ({
  logPersonalization: routeMocks.logPersonalization,
  createCorrelationId: routeMocks.createCorrelationId,
}))
vi.mock('../../../../../../netlify/functions/_personalization/src/server/envValidation', () => ({
  requirePersonalizationEnv: routeMocks.requirePersonalizationEnv,
}))

// Imported AFTER the hoisted vi.mock registrations so the route module binds
// the mocked dependencies at evaluation time.
const { GET } = await import('../../../../../../netlify/functions/_personalization/app/api/personalization/project/route')

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Minimal stub of the pieces of `Response` the client actually reads. */
function stubResponse(
  body: unknown,
  init: { ok?: boolean; status?: number } = {},
): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response
}

function createRouteRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/personalization/project')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new NextRequest(url.toString(), { method: 'GET' })
}

type FetchInit = { method?: string; credentials?: string; signal?: AbortSignal }

/** Every issued request URL, in order. */
function issuedUrls(): URL[] {
  return fetchMock.mock.calls.map((call) => new URL(String(call[0])))
}

let fetchMock: ReturnType<typeof vi.fn>
let listData: unknown[]
let rpcMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()

  // Keep the loud-guard console output out of the reporter.
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})

  fetchMock = vi.fn(async () => stubResponse({ projects: [] }))
  vi.stubGlobal('fetch', fetchMock)

  routeMocks.auth.mockResolvedValue({ userId: 'user-123' })
  routeMocks.requirePersonalizationEnv.mockReturnValue({ valid: true, missingRequired: [] })

  listData = []
  rpcMock = vi.fn(async () => ({ data: listData, error: null }))
  routeMocks.createServerClient.mockReturnValue({ rpc: rpcMock })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ── Client: request-shape contract ────────────────────────────────────────────

describe('loadProject request shape', () => {
  it('a sourceId request carries list=true and no id', async () => {
    await loadProject({ sourceId: 'demo-1' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = issuedUrls()[0]
    expect(url.pathname).toBe('/api/personalization/project')
    expect(url.searchParams.get('list')).toBe('true')
    expect(url.searchParams.get('sourceId')).toBe('demo-1')
    expect(url.searchParams.has('id')).toBe(false)
  })

  it('a projectId request carries id and no list', async () => {
    await loadProject({ projectId: 'proj-9' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = issuedUrls()[0]
    expect(url.searchParams.get('id')).toBe('proj-9')
    expect(url.searchParams.has('list')).toBe(false)
    expect(url.searchParams.has('sourceId')).toBe(false)
  })

  it('when both are supplied the projectId wins and no list param is sent', async () => {
    await loadProject({ projectId: 'proj-9', sourceId: 'demo-1' })

    const url = issuedUrls()[0]
    expect(url.searchParams.get('id')).toBe('proj-9')
    expect(url.searchParams.has('list')).toBe(false)
  })

  it('never issues a request without id or list — every branch, including the guards', async () => {
    const guardedBranches: Array<Parameters<typeof loadProject>[0]> = [
      {},
      { projectId: '' },
      { projectId: '   ' },
      { sourceId: '' },
      { sourceId: ' \t ' },
      { projectId: '', sourceId: '' },
      { projectId: '   ', sourceId: '  ' },
    ]

    for (const opts of guardedBranches) {
      fetchMock.mockClear()
      await loadProject(opts)
      // The guarded branches must refuse to fetch at all; anything that IS
      // fetched must carry one of the two params.
      for (const url of issuedUrls()) {
        const hasParam = url.searchParams.has('id') || url.searchParams.has('list')
        expect(hasParam, `request ${url} for ${JSON.stringify(opts)}`).toBe(true)
      }
      expect(fetchMock).not.toHaveBeenCalled()
    }

    // The happy branches do fetch, and they are the ONLY callers.
    fetchMock.mockClear()
    await loadProject({ sourceId: 'demo-1' })
    expect(issuedUrls()[0].searchParams.has('list')).toBe(true)

    fetchMock.mockClear()
    await loadProject({ projectId: 'proj-1' })
    expect(issuedUrls()[0].searchParams.has('id')).toBe(true)
  })

  it('an empty/whitespace id fails loudly and never reaches the server', async () => {
    for (const opts of [
      { projectId: '' },
      { projectId: '   ' },
      { sourceId: '' },
      { sourceId: '   ' },
      { projectId: '', sourceId: '' },
    ] as Array<Parameters<typeof loadProject>[0]>) {
      fetchMock.mockClear()
      const res = await loadProject(opts)
      expect(res.ok).toBe(false)
      expect(res.error).toMatch(/non-empty string|requires a projectId/)
      expect(fetchMock).not.toHaveBeenCalled()
    }
    // Loud: the dev guard writes to console.error (suppressed above but spied).
    expect(console.error).toHaveBeenCalled()
  })

  it('sibling helpers keep the same invariant (list / delete)', async () => {
    fetchMock.mockClear()
    await listProjects()
    expect(issuedUrls()[0].searchParams.get('list')).toBe('true')

    fetchMock.mockClear()
    await deleteProject('proj-1')
    expect(issuedUrls()[0].searchParams.get('id')).toBe('proj-1')

    fetchMock.mockClear()
    const blank = await deleteProject('   ')
    expect(blank.ok).toBe(false)
    expect(blank.error).toMatch(/non-empty string/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// ── Client: restore semantics ─────────────────────────────────────────────────

describe('loadProject restore semantics', () => {
  it('a restore of a saved project returns that project', async () => {
    fetchMock.mockImplementation(async () =>
      stubResponse({
        projects: [
          {
            id: 'row-1',
            source: { id: 'demo-1', sourceType: 'landing-demo' },
            client: {},
            assets: {},
            prompt: { original: 'orig', personalized: 'pers' },
            generation: {},
            output_type: 'video',
            status: 'complete',
          },
        ],
        sourceFilter: 'applied',
      }),
    )

    const res = await loadProject({ sourceId: 'demo-1' })

    expect(res.ok).toBe(true)
    expect(res.error).toBeUndefined()
    expect(res.data?.id).toBe('row-1')
    expect(res.data?.sourceDemoId).toBe('demo-1')
    expect(res.data?.originalPrompt).toBe('orig')
    expect(res.data?.personalizedPrompt).toBe('pers')
    expect(res.data?.outputType).toBe('video')
  })

  it('a restore of a never-saved project returns the ok/empty shape, never an error', async () => {
    const res = await loadProject({ sourceId: 'demo-never-saved' })

    expect(res.ok).toBe(true)
    expect(res.data).toBeUndefined()
    expect(res.error).toBeUndefined()
  })

  it('a row that carries no source id is accepted (degraded mode) with a dev warning', async () => {
    fetchMock.mockImplementation(async () =>
      stubResponse({
        projects: [
          {
            id: 'row-2',
            source: {},
            client: {},
            assets: {},
            prompt: { personalized: 'pers' },
            generation: {},
          },
        ],
        sourceFilter: 'unavailable',
      }),
    )

    const res = await loadProject({ sourceId: 'demo-1' })

    expect(res.ok).toBe(true)
    expect(res.data?.id).toBe('row-2')
    // Degraded mode is surfaced, never silent.
    expect(console.warn).toHaveBeenCalled()
  })

  it('a row for a DIFFERENT source is not restored', async () => {
    fetchMock.mockImplementation(async () =>
      stubResponse({
        projects: [{ id: 'row-3', source: { id: 'demo-2' }, client: {}, assets: {}, prompt: {}, generation: {} }],
      }),
    )

    const res = await loadProject({ sourceId: 'demo-1' })

    expect(res.ok).toBe(true)
    expect(res.data).toBeUndefined()
  })
})

// ── Route ─────────────────────────────────────────────────────────────────────

describe('GET /api/personalization/project', () => {
  it('the list RPC returns nothing → 200 with an empty projects array, never 400', async () => {
    listData = []

    const res = await GET(createRouteRequest({ list: 'true' }))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.projects).toEqual([])
  })

  it('returns 400 MISSING_PROJECT_ID only when BOTH id and list are absent', async () => {
    const res = await GET(createRouteRequest())

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Missing project id parameter')
    expect(routeMocks.logPersonalization).toHaveBeenCalledWith(
      expect.objectContaining({ safeErrorCode: 'MISSING_PROJECT_ID' }),
    )
  })

  it('a present-but-empty id alone still 400s; list=true alone still 200s', async () => {
    const emptyId = await GET(createRouteRequest({ id: '' }))
    expect(emptyId.status).toBe(400)

    const listOnly = await GET(createRouteRequest({ list: 'true' }))
    expect(listOnly.status).toBe(200)
  })

  it('the source filter keeps the matching row and drops non-matching ones', async () => {
    listData = [
      {
        id: 'match',
        source: { id: 'demo-1', sourceType: 'landing-demo' },
        client: {},
        assets: {},
        prompt: {},
        generation: {},
        output_type: 'video',
        status: 'complete',
      },
      {
        id: 'other',
        source: { id: 'demo-2', sourceType: 'landing-demo' },
        client: {},
        assets: {},
        prompt: {},
        generation: {},
        output_type: 'prompt',
        status: 'idle',
      },
    ]

    const res = await GET(createRouteRequest({ list: 'true', sourceId: 'demo-1' }))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.projects.map((p: { id: string }) => p.id)).toEqual(['match'])
    expect(data.sourceFilter).toBe('applied')
  })

  it('degrades to the unfiltered list when no row carries a source identifier', async () => {
    // Real RPC shape: source is a jsonb object and there is no top-level
    // sourceDemoId column. A row whose source carries no id can be matched by
    // nothing, so the filter must NOT turn "no match" into "empty list".
    listData = [
      {
        id: 'row-a',
        source: {},
        client: {},
        assets: {},
        prompt: {},
        generation: {},
        output_type: 'prompt',
        status: 'idle',
      },
      {
        id: 'row-b',
        client: {},
        assets: {},
        prompt: {},
        generation: {},
        output_type: 'prompt',
        status: 'idle',
      },
    ]

    const res = await GET(createRouteRequest({ list: 'true', sourceId: 'demo-1' }))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.projects.map((p: { id: string }) => p.id)).toEqual(['row-a', 'row-b'])
    expect(data.sourceFilter).toBe('unavailable')
    // The degrade is logged, not silent.
    expect(routeMocks.logPersonalization).toHaveBeenCalledWith(
      expect.objectContaining({ safeErrorCode: 'SOURCE_FILTER_UNAVAILABLE' }),
    )
  })

  it('an id request returns the single project', async () => {
    listData = []
    routeMocks.createServerClient.mockReturnValue({
      rpc: vi.fn(async () => ({
        data: [
          {
            id: 'proj-7',
            source: { id: 'demo-1' },
            client: {},
            assets: {},
            prompt: { original: 'o', personalized: 'p' },
            generation: {},
            output_type: 'video',
            status: 'complete',
          },
        ],
        error: null,
      })),
    })

    const res = await GET(createRouteRequest({ id: 'proj-7' }))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.project.id).toBe('proj-7')
  })
})

describe('source-scoped list filters before the row limit', () => {
  const row = (id: string, source: string) => ({
    id,
    source: { id: source },
    client: {},
    assets: {},
    prompt: {},
    generation: {},
    output_type: 'video',
    status: 'draft',
  })

  it('a sourceId request uses the source-scoped RPC', async () => {
    const rpc = vi.fn(async () => ({ data: [row('old-row', 'demo-9')], error: null }))
    routeMocks.createServerClient.mockReturnValue({ rpc })

    const res = await GET(createRouteRequest({ list: 'true', sourceId: 'demo-9' }))

    expect(res.status).toBe(200)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('personalization_saved_projects_list_by_source', {
      p_clerk_user_id: 'user-123',
      p_source_id: 'demo-9',
    })
    const data = await res.json()
    expect(data.projects.map((p: { id: string }) => p.id)).toEqual(['old-row'])
  })

  it('falls back to the plain list (still filtered) while the migration is not applied', async () => {
    const rpc = vi.fn(async (name: string) =>
      name === 'personalization_saved_projects_list_by_source'
        ? { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }
        : { data: [row('a', 'demo-1'), row('b', 'demo-9')], error: null },
    )
    routeMocks.createServerClient.mockReturnValue({ rpc })

    const res = await GET(createRouteRequest({ list: 'true', sourceId: 'demo-9' }))

    expect(res.status).toBe(200)
    expect(rpc.mock.calls.map((call) => call[0])).toEqual([
      'personalization_saved_projects_list_by_source',
      'personalization_saved_projects_list',
    ])
    const data = await res.json()
    expect(data.projects.map((p: { id: string }) => p.id)).toEqual(['b'])
  })

  it('a plain list request (no sourceId) keeps using the plain list RPC', async () => {
    const rpc = vi.fn(async () => ({ data: [], error: null }))
    routeMocks.createServerClient.mockReturnValue({ rpc })
    await GET(createRouteRequest({ list: 'true' }))
    expect(rpc).toHaveBeenCalledWith('personalization_saved_projects_list', { p_clerk_user_id: 'user-123' })
  })

  it('a real database error is not masked by the fallback', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } }))
    routeMocks.createServerClient.mockReturnValue({ rpc })
    const res = await GET(createRouteRequest({ list: 'true', sourceId: 'demo-9' }))
    expect(res.status).toBe(500)
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})

describe('asset URLs travel with asset ids (restore must have something to load)', () => {
  const state: PersonalizationProjectState = {
    sourceType: 'go-ai-viral-video',
    sourceDemoId: 'demo-1',
    originalPrompt: 'o',
    personalizedPrompt: 'p',
    identityAssetIds: ['asset_identity'],
    logoAssetIds: ['asset_logo', 'asset_local'],
    productAssetIds: [],
    brandReferenceAssetIds: [],
    outputUrls: [],
    outputType: 'video',
    assetUrls: {
      asset_identity: 'https://cdn.example.com/identity.png',
      asset_logo: 'https://cdn.example.com/logo.png',
      asset_local: 'blob:https://app.example/123',
      asset_inline: 'data:image/png;base64,AAAA',
    },
  }

  it('persists only durable http(s) URLs and reads them back', () => {
    const row = projectRowFromState(stripSessionScopedUrls(state))
    expect((row.assets as Record<string, unknown>).assetUrls).toEqual({
      asset_identity: 'https://cdn.example.com/identity.png',
      asset_logo: 'https://cdn.example.com/logo.png',
    })
    const restored = projectStateFromRow(row)
    expect(restored?.logoAssetIds).toEqual(['asset_logo', 'asset_local'])
    expect(restored?.assetUrls).toEqual({
      asset_identity: 'https://cdn.example.com/identity.png',
      asset_logo: 'https://cdn.example.com/logo.png',
    })
  })

  it('resolves a restore URL from the map, from a URL-shaped legacy id, or not at all', () => {
    const urls = { asset_logo: 'https://cdn.example.com/logo.png' }
    expect(resolveRestoredAssetUrl('asset_logo', urls)).toBe('https://cdn.example.com/logo.png')
    expect(resolveRestoredAssetUrl('https://cdn.example.com/legacy.png', undefined)).toBe('https://cdn.example.com/legacy.png')
    expect(resolveRestoredAssetUrl('asset_local', urls)).toBeNull()
    expect(resolveRestoredAssetUrl('asset_logo', undefined)).toBeNull()
  })

  it('reads a row saved before the map existed', () => {
    const legacy = projectStateFromRow({ source: { id: 'demo-1' }, assets: { logoAssetIds: ['asset_logo'] } })
    expect(legacy?.logoAssetIds).toEqual(['asset_logo'])
    expect(legacy?.assetUrls).toEqual({})
  })
})

describe('autosaves keep writing to one row', () => {
  const ROW_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
  const base: PersonalizationProjectState = {
    sourceType: 'go-ai-viral-video',
    sourceDemoId: 'demo-1',
    originalPrompt: 'o',
    personalizedPrompt: 'p',
    identityAssetIds: [],
    logoAssetIds: [],
    productAssetIds: [],
    brandReferenceAssetIds: [],
    outputUrls: [],
    outputType: 'video',
  }
  const sentIds = () =>
    fetchMock.mock.calls
      .filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST')
      .map(([, init]) => JSON.parse(String((init as RequestInit).body)).project.id)
  const settle = () => new Promise((r) => setTimeout(r, 20))

  it('back-to-back saves wait for the first insert and reuse its id', async () => {
    fetchMock.mockImplementation(async () => stubResponse({ ok: true, project: { id: ROW_ID } }))
    const persistence = createProjectPersistence({ debounceMs: 5 })
    persistence.flush(base)
    persistence.flush({ ...base, personalizedPrompt: 'p2' })
    await settle()
    expect(sentIds()).toEqual([null, ROW_ID])
    expect(persistence.getProjectId()).toBe(ROW_ID)
  })

  it('setProjectId points saves at a restored row, and null starts a fresh one', async () => {
    fetchMock.mockImplementation(async () => stubResponse({ ok: true, project: null }))
    const persistence = createProjectPersistence({ debounceMs: 5 })
    persistence.setProjectId(ROW_ID)
    persistence.flush(base)
    await settle()
    persistence.setProjectId(null)
    persistence.flush(base)
    await settle()
    persistence.setProjectId('not-a-uuid')
    persistence.flush(base)
    await settle()
    expect(sentIds()).toEqual([ROW_ID, null, null])
  })

  it('a save still queued when the source switches is dropped, not sent with the new row id', async () => {
    const releases: Array<() => void> = []
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          releases.push(() => resolve(stubResponse({ ok: true, project: null })))
        }),
    )
    const persistence = createProjectPersistence({ debounceMs: 5 })
    persistence.flush({ ...base, sourceDemoId: 'source-A' }) // in flight
    persistence.flush({ ...base, sourceDemoId: 'source-A', personalizedPrompt: 'queued' }) // queued
    await settle()
    persistence.setProjectId(ROW_ID) // restore of source B
    releases.shift()!()
    await settle()
    persistence.flush({ ...base, sourceDemoId: 'source-B' })
    await settle()
    releases.forEach((release) => release())
    await settle()
    const posts = fetchMock.mock.calls
      .filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST')
      .map(([, init]) => JSON.parse(String((init as RequestInit).body)).project)
    expect(posts.map((p) => [p.source.id, p.id])).toEqual([
      ['source-A', null],
      ['source-B', ROW_ID],
    ])
  })

  it('a response that lands after a source switch is not adopted', async () => {
    let release!: () => void
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve(stubResponse({ ok: true, project: { id: ROW_ID } }))
        }),
    )
    const persistence = createProjectPersistence({ debounceMs: 5 })
    persistence.flush(base)
    await settle()
    persistence.setProjectId(null) // the modal moved to another source
    release()
    await settle()
    expect(persistence.getProjectId()).toBeNull()
  })
})

describe('a saved video missing its approved layers says so after a restore', () => {
  const base: PersonalizationProjectState = {
    sourceType: 'go-ai-viral-video',
    sourceDemoId: 'demo-1',
    originalPrompt: 'o',
    personalizedPrompt: 'p',
    identityAssetIds: [],
    logoAssetIds: [],
    productAssetIds: [],
    brandReferenceAssetIds: [],
    outputUrls: ['https://cdn.example.com/generated.mp4'],
    outputType: 'video',
  }

  it('keeps the flag through save and restore', () => {
    const restored = projectStateFromRow(projectRowFromState({ ...base, layersMissing: true }))
    expect(restored?.layersMissing).toBe(true)
    expect(restored?.outputUrls).toEqual(['https://cdn.example.com/generated.mp4'])
  })

  it('a project with its layers carries no flag', () => {
    const restored = projectStateFromRow(projectRowFromState(base))
    expect(restored?.layersMissing).toBeUndefined()
  })
})
