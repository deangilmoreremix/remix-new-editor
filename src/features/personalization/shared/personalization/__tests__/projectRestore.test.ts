/**
 * Personalization project restore — persistence reconstruction & error handling
 *
 * projectRestore.ts persists/loads full project state through the
 * `/api/personalization/project` API. `loadProject` is the restore entry point:
 * it rehydrates a `SavedProject` from the persisted (snake_case) payload. These
 * tests mock global fetch (no Supabase/network) and verify:
 *   - a persisted payload is correctly reconstructed into camelCase state
 *   - default values are applied for missing fields
 *   - a missing/invalid/HTTP-failed/threw payload yields a safe error object
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { loadProject, listProjects } from '../projectRestore'

const originalFetch = globalThis.fetch

/**
 * Request init passed by projectRestore: a method, a JSON header record and
 * same-origin credentials. Declaring it keeps the mocked call arguments typed
 * so the assertions below read real properties instead of an opaque tuple.
 */
type ProjectRestoreFetchInit = {
  method: string
  headers: Record<string, string>
  body?: BodyInit | null
  credentials?: RequestCredentials
}

function jsonResponse(body: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}) {
  return { ok, status, json: async () => body } as unknown as Response
}

describe('projectRestore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('reconstructs a SavedProject from a persisted snake_case payload', async () => {
    const persisted = {
      id: 'proj-123',
      source: { id: 'demo-1', sourceType: 'landing-demo', mediaType: 'video', title: 'Demo' },
      client: { businessName: 'Acme Roofing', industry: 'Roofing' },
      assets: { identities: [], logos: [], products: [], brandReferences: [] },
      prompt: { personalized: 'A personalized prompt about Acme Roofing' },
      output_type: 'video',
      mode: 'recreate',
      generation: { engine: 'smartvideo-recommended' },
      status: 'complete',
      error_message: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
    }
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init: ProjectRestoreFetchInit) =>
      jsonResponse({ project: persisted }),
    )
    globalThis.fetch = fetchMock

    const res = await loadProject('proj-123')

    expect(res.ok).toBe(true)
    expect(res.error).toBeUndefined()
    const project = res.project!
    expect(project).toBeTruthy()
    expect(project.id).toBe('proj-123')
    expect(project.client.businessName).toBe('Acme Roofing')
    expect(project.prompt.personalized).toBe('A personalized prompt about Acme Roofing')
    // snake_case → camelCase reconstruction
    expect(project.outputType).toBe('video')
    expect(project.status).toBe('complete')
    expect(project.errorMessage).toBeNull()
    expect(project.createdAt).toBe('2026-01-01T00:00:00.000Z')
    expect(project.updatedAt).toBe('2026-01-02T00:00:00.000Z')

    // Restores via the project endpoint with the id encoded in the query string.
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/api/personalization/project')
    expect(String(url)).toContain('id=proj-123')
    expect(init.method).toBe('GET')
  })

  it('applies safe defaults when persisted fields are missing', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ project: { id: 'proj-2' } }))
    globalThis.fetch = fetchMock as any

    const res = await loadProject('proj-2')

    expect(res.ok).toBe(true)
    expect(res.project!.outputType).toBe('prompt')
    expect(res.project!.mode).toBeNull()
    expect(res.project!.status).toBe('idle')
    expect(res.project!.errorMessage).toBeNull()
    expect(res.project!.source).toEqual({})
    expect(res.project!.client).toEqual({})
  })

  it('returns an error when the project payload is missing', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}))
    globalThis.fetch = fetchMock as any

    const res = await loadProject('does-not-exist')

    expect(res.ok).toBe(false)
    expect(res.project).toBeUndefined()
    expect(res.error).toBe('Project not found')
  })

  it('returns the upstream error on an HTTP failure', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ error: 'Database unavailable' }, { ok: false, status: 500 }),
    )
    globalThis.fetch = fetchMock as any

    const res = await loadProject('proj-x')

    expect(res.ok).toBe(false)
    expect(res.project).toBeUndefined()
    expect(res.error).toBe('Database unavailable')
  })

  it('normalizes a thrown fetch error into a safe result', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('Network down')
    })
    globalThis.fetch = fetchMock as any

    const res = await loadProject('proj-y')

    expect(res.ok).toBe(false)
    expect(res.project).toBeUndefined()
    expect(res.error).toBe('Network down')
  })

  it('listProjects reconstructs every persisted row', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        projects: [
          { id: 'a', output_type: 'image', status: 'complete' },
          { id: 'b', output_type: 'video', status: 'idle' },
        ],
      }),
    )
    globalThis.fetch = fetchMock as any

    const res = await listProjects()

    expect(res.ok).toBe(true)
    expect(res.projects).toHaveLength(2)
    expect(res.projects![0].id).toBe('a')
    expect(res.projects![0].outputType).toBe('image')
    expect(res.projects![0].status).toBe('complete')
    expect(res.projects![1].id).toBe('b')
    expect(res.projects![1].outputType).toBe('video')
  })
})
