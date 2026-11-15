/**
 * Debounced Supabase project persistence — regression for the duplicated
 * persist effect (Phase 3 final review, finding 1).
 *
 * `DemoPersonalizeProvider` once carried two byte-identical effects that both
 * called `projectPersistence.current.persist(buildProjectPayload())` with the
 * same dependency list and no cleanup. The debouncer coalesced the pair, so the
 * wire never saw a second request, but every commit built and scheduled the
 * payload twice. These tests pin the contract with a mocked persistence layer:
 *
 *   - one `persist` call per committed state change (two meant the duplicate
 *     effect was back);
 *   - one POST per completed debounce cycle, carrying the latest payload,
 *     however many edits landed inside the window;
 *   - the restore path cancels the in-flight debounce and settles into a
 *     single write;
 *   - closing the modal schedules nothing new but does not drop the pending
 *     write for the edits made before it closed;
 *   - unmounting cancels the pending write (no write after teardown);
 *   - anonymous sessions never persist.
 *
 * The real `createProjectPersistence` runs underneath (with a short debounce)
 * so the debounce/flush/cancel semantics under test are the production ones;
 * only `fetch` and `loadProject` are stubbed.
 */

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

const DEBOUNCE_MS = 40

const persistenceSpy = vi.hoisted(() => ({
  persist: vi.fn(),
  flush: vi.fn(),
  cancel: vi.fn(),
  loadProject: vi.fn(),
}))

vi.mock('../supabaseProjectPersistence', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../supabaseProjectPersistence')>()
  return {
    ...actual,
    loadProject: persistenceSpy.loadProject,
    createProjectPersistence: () => {
      const real = actual.createProjectPersistence({ debounceMs: DEBOUNCE_MS })
      return {
        persist: (state: Parameters<typeof real.persist>[0]) => {
          persistenceSpy.persist(state)
          real.persist(state)
        },
        flush: (state: Parameters<typeof real.flush>[0]) => {
          persistenceSpy.flush(state)
          real.flush(state)
        },
        cancel: () => {
          persistenceSpy.cancel()
          real.cancel()
        },
        setProjectId: real.setProjectId,
        getProjectId: real.getProjectId,
      }
    },
  }
})

vi.mock('@ohb/packages/studio/src/muapi', () => ({ uploadFile: vi.fn() }))
vi.mock('../assetUploadService', () => ({ uploadPersonalizationAsset: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}))
vi.mock('@ohb/components/SocialPublishProvider', () => ({
  SocialPublishContext: {
    Provider: ({ children }: { children: React.ReactNode }) => children,
    Consumer: ({ children }: { children: (value: null) => React.ReactNode }) => children(null),
  },
  useSocialPublish: () => { throw new Error('useSocialPublish must be used within a <SocialPublishProvider>') },
}))
vi.mock('@ohb/lib/authConfig', () => ({
  useAuthConfig: () => ({ apiKey: 'test-key', openaiKey: '', setApiKey: vi.fn(), setOpenAiKey: vi.fn(), clearApiKey: vi.fn(), clearOpenAiKey: vi.fn(), clearAllKeys: vi.fn(), hasApiKey: true, hasOpenaiKey: false, isAuthenticated: true }),
}))
vi.mock('../promptPersonalizer', () => ({ personalizePrompt: vi.fn(), regeneratePrompt: vi.fn() }))
vi.mock('../generationRouter', () => ({ runGeneration: vi.fn() }))
vi.mock('../postProcessor', () => ({ applyPostProcessing: vi.fn(), generateEndCardImage: vi.fn() }))
vi.mock('../PersonalizationModal', () => ({ default: () => null }))
vi.mock('../editedAssetPersistence', () => ({ persistEditedPersonalizationAsset: vi.fn() }))

const { DemoPersonalizeProvider, useDemoPersonalize } = await import('../DemoPersonalizeProvider')

const RESTORED_ID = '11111111-2222-4333-8444-555555555555'
const INSERTED_ID = '99999999-8888-4777-8666-555555555555'

const SOURCE = {
  id: 'demo-persist-1',
  title: 'Persistence test',
  mediaType: 'video',
  originalPrompt: 'Original prompt',
  sourceMedia: 'https://cdn.example.com/original.mp4',
  poster: null,
  fullPrompt: 'Original prompt',
  shortPrompt: 'Original prompt',
  sourceType: 'go-ai-viral-video',
  model: 'kling-o1-video-edit',
  sourceMetadata: {},
}

type PersonalizeCtx = ReturnType<typeof useDemoPersonalize>
let capturedCtx: PersonalizeCtx | null = null

function TestCapture() {
  capturedCtx = useDemoPersonalize()
  return null
}

const ctx = (): PersonalizeCtx => {
  if (!capturedCtx) throw new Error('provider not mounted')
  return capturedCtx
}

type ProjectWrite = { project: { id: string | null; prompt: { personalized: string } } & Record<string, unknown> }

let fetchMock: ReturnType<typeof vi.fn>
let root: Root | null = null
let container: HTMLDivElement | null = null

/** POSTs to the project route — the only durable write the provider makes. */
function projectWrites(): ProjectWrite[] {
  return fetchMock.mock.calls
    .filter(([url, init]) => String(url).startsWith('/api/personalization/project') && init?.method === 'POST')
    .map(([, init]) => JSON.parse(String(init.body)))
}

async function settle(ms = DEBOUNCE_MS * 3) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })
}

async function mount(access?: 'anonymous') {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root!.render(
      <DemoPersonalizeProvider access={access}>
        <TestCapture />
      </DemoPersonalizeProvider>,
    )
  })
}

async function open(opts: Record<string, unknown> = {}) {
  await act(async () => {
    ctx().openPersonalize({ source: SOURCE, ...opts })
  })
  // Let the restore promise (mocked `loadProject`) resolve and the debounce
  // that follows it complete, so each test starts from a quiet persister.
  await settle()
}

beforeEach(() => {
  localStorage.clear()
  persistenceSpy.persist.mockClear()
  persistenceSpy.flush.mockClear()
  persistenceSpy.cancel.mockClear()
  persistenceSpy.loadProject.mockReset()
  persistenceSpy.loadProject.mockResolvedValue({ ok: true, data: undefined })
  fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(async () => {
  if (root) {
    await act(async () => root!.unmount())
    root = null
  }
  container?.remove()
  container = null
  vi.unstubAllGlobals()
})

describe('DemoPersonalizeProvider debounced project persistence', () => {
  it('schedules exactly one persist per committed state change', async () => {
    await mount()
    await open()
    persistenceSpy.persist.mockClear()

    await act(async () => {
      ctx().updatePersonalizedPrompt('Edit one')
    })
    // A duplicated persist effect would make this 2.
    expect(persistenceSpy.persist).toHaveBeenCalledTimes(1)
    expect(persistenceSpy.persist.mock.calls[0][0].personalizedPrompt).toBe('Edit one')

    await act(async () => {
      ctx().updatePersonalizedPrompt('Edit two')
    })
    expect(persistenceSpy.persist).toHaveBeenCalledTimes(2)
  })

  it('writes once per completed debounce cycle, with the latest payload, under rapid edits', async () => {
    await mount()
    await open()
    fetchMock.mockClear()

    for (const text of ['a', 'ab', 'abc', 'abcd', 'abcde']) {
      await act(async () => {
        ctx().updatePersonalizedPrompt(text)
      })
    }
    // Still inside the debounce window: nothing on the wire yet.
    expect(projectWrites()).toHaveLength(0)

    await settle()
    const writes = projectWrites()
    expect(writes).toHaveLength(1)
    expect(writes[0].project.prompt.personalized).toBe('abcde')

    // A second, separate cycle produces exactly one more write.
    await act(async () => {
      ctx().updatePersonalizedPrompt('second cycle')
    })
    await settle()
    expect(projectWrites()).toHaveLength(2)
    expect(projectWrites()[1].project.prompt.personalized).toBe('second cycle')
  })

  it('restore cancels the pending debounce and settles into a single write', async () => {
    persistenceSpy.loadProject.mockResolvedValue({
      ok: true,
      data: {
        id: RESTORED_ID,
        sourceType: 'go-ai-viral-video',
        sourceDemoId: SOURCE.id,
        originalPrompt: 'Original prompt',
        personalizedPrompt: 'Restored prompt',
        identityAssetIds: [],
        logoAssetIds: [],
        productAssetIds: [],
        brandReferenceAssetIds: [],
        outputUrls: [],
        outputType: 'video',
        guidedStep: 2,
        viewMode: 'advanced',
      },
    })
    await mount()
    await act(async () => {
      ctx().openPersonalize({ source: SOURCE })
    })
    await settle()

    expect(persistenceSpy.loadProject).toHaveBeenCalledTimes(1)
    // The modal opens fresh: the saved project is offered, not loaded, and the
    // untouched session writes nothing over it.
    expect(ctx().resumableProject).not.toBeNull()
    expect(ctx().promptState.personalized).toBe('')
    expect(projectWrites()).toHaveLength(0)

    await act(async () => {
      await ctx().resumeLastProject()
    })
    await settle()
    // The restore guard: the in-flight debounce is cancelled before loading.
    expect(persistenceSpy.cancel).toHaveBeenCalled()
    const writes = projectWrites()
    expect(writes).toHaveLength(1)
    expect(writes[0].project.prompt.personalized).toBe('Restored prompt')
    // The autosave updates the restored row instead of inserting a new one.
    expect(writes[0].project.id).toBe(RESTORED_ID)

    // Nothing else is queued once the restore has settled.
    await settle()
    expect(projectWrites()).toHaveLength(1)
  })

  it('closing the modal keeps the pending write and schedules no new one', async () => {
    await mount()
    await open()
    fetchMock.mockClear()

    await act(async () => {
      ctx().updatePersonalizedPrompt('Edited before close')
    })
    persistenceSpy.persist.mockClear()
    await act(async () => {
      ctx().closePersonalize()
    })
    // Close clears `source`, so the effect bails out instead of persisting.
    expect(persistenceSpy.persist).not.toHaveBeenCalled()

    await settle()
    const writes = projectWrites()
    expect(writes).toHaveLength(1)
    expect(writes[0].project.prompt.personalized).toBe('Edited before close')
  })

  it('unmounting cancels the pending write — no write after teardown', async () => {
    await mount()
    await open()
    fetchMock.mockClear()

    await act(async () => {
      ctx().updatePersonalizedPrompt('Edited before unmount')
    })
    await act(async () => root!.unmount())
    root = null

    await settle()
    expect(projectWrites()).toHaveLength(0)
  })

  it('approval flushes immediately and does not double-write when the debounce would have fired', async () => {
    await mount()
    await open()
    fetchMock.mockClear()

    await act(async () => {
      ctx().updatePersonalizedPrompt('Approved copy')
    })
    await act(async () => {
      ctx().approvePersonalization()
    })
    // The flush is on the wire before the debounce window ends ...
    expect(projectWrites()).toHaveLength(1)
    expect(projectWrites()[0].project.prompt.personalized).toBe('Approved copy')
    expect(persistenceSpy.flush).toHaveBeenCalledTimes(1)

    await settle()
    // ... and the approval's own state change schedules at most one more cycle.
    expect(projectWrites().length).toBeLessThanOrEqual(2)
  })

  it('after the first insert, later autosaves update that row instead of inserting again', async () => {
    fetchMock.mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, project: [{ id: INSERTED_ID }] }),
    }))
    await mount()
    await open()
    // An untouched fresh session saves nothing.
    expect(projectWrites()).toHaveLength(0)

    await act(async () => {
      ctx().updatePersonalizedPrompt('first save')
    })
    await settle()
    const first = projectWrites()
    expect(first).toHaveLength(1)
    expect(first[0].project.id).toBeNull() // no saved project yet: insert

    await act(async () => {
      ctx().updatePersonalizedPrompt('second save')
    })
    await settle()
    const writes = projectWrites()
    expect(writes).toHaveLength(2)
    expect(writes[1].project.id).toBe(INSERTED_ID)
  })

  it('a restore response from an earlier session is discarded', async () => {
    const SOURCE_B = { ...SOURCE, id: 'demo-persist-B', title: 'Source B' }
    const ROW_A = 'aaaaaaaa-0000-4000-8000-00000000000a'
    const ROW_B = 'bbbbbbbb-0000-4000-8000-00000000000b'
    const savedRow = (id: string, sourceDemoId: string, prompt: string) => ({
      ok: true,
      data: {
        id,
        sourceType: 'go-ai-viral-video',
        sourceDemoId,
        originalPrompt: 'Original prompt',
        personalizedPrompt: prompt,
        identityAssetIds: [],
        logoAssetIds: [],
        productAssetIds: [],
        brandReferenceAssetIds: [],
        outputUrls: [],
        outputType: 'video',
      },
    })
    let resolveA!: (value: unknown) => void
    persistenceSpy.loadProject.mockImplementation(({ sourceId }: { sourceId: string }) =>
      sourceId === SOURCE.id
        ? new Promise((resolve) => { resolveA = resolve })
        : Promise.resolve(savedRow(ROW_B, SOURCE_B.id, 'Prompt B')),
    )
    await mount()
    await act(async () => {
      ctx().openPersonalize({ source: SOURCE })
    })
    await act(async () => {
      ctx().closePersonalize()
    })
    await act(async () => {
      ctx().openPersonalize({ source: SOURCE_B })
    })
    await settle()
    await act(async () => {
      await ctx().resumeLastProject()
    })
    await settle()
    fetchMock.mockClear()

    // Source A's restore finally answers — after B is open and restored.
    await act(async () => {
      resolveA(savedRow(ROW_A, SOURCE.id, 'Prompt A'))
    })
    await settle()
    expect(ctx().promptState.personalized).toBe('Prompt B')

    await act(async () => {
      ctx().updatePersonalizedPrompt('edit on B')
    })
    await settle()
    const writes = projectWrites()
    expect(writes).toHaveLength(1)
    expect(writes[0].project.id).toBe(ROW_B)
    expect(writes[0].project.source).toMatchObject({ id: SOURCE_B.id })
  })

  it('saves the first edit after reopening the same source', async () => {
    await mount()
    await open()
    await act(async () => {
      ctx().closePersonalize()
    })
    await open()
    fetchMock.mockClear()

    await act(async () => {
      ctx().updatePersonalizedPrompt('first edit after reopen')
    })
    await settle()
    const writes = projectWrites()
    expect(writes).toHaveLength(1)
    expect(writes[0].project.prompt.personalized).toBe('first edit after reopen')
  })

  it('reopening the same source starts from an empty form again', async () => {
    await mount()
    await open()
    await act(async () => {
      ctx().updatePersonalizedPrompt('typed in the first session')
    })
    await act(async () => {
      ctx().closePersonalize()
    })
    await open()
    expect(ctx().promptState.personalized).toBe('')
  })

  it('a fresh session is not attached to the last selected client', async () => {
    await mount()
    await act(async () => {
      ctx().openPersonalize({ source: SOURCE })
    })
    await act(async () => {
      ctx().selectClient('client-from-last-time')
    })
    await act(async () => {
      ctx().closePersonalize()
    })
    await open()
    // Saving a new business now creates a client instead of updating the old one.
    expect(ctx().selectedClientId).toBe('')
  })

  it('saves a preview edit made before any business is entered', async () => {
    await mount()
    await open()
    fetchMock.mockClear()

    await act(async () => {
      ctx().updatePreviewBrandColors({ primary: '#123456' })
    })
    await settle()
    expect(projectWrites()).toHaveLength(1)
  })

  it('saves generation settings and output choices made before any business is entered', async () => {
    await mount()
    await open()
    fetchMock.mockClear()

    await act(async () => {
      ctx().updateGenOptions({ aspectRatio: '9:16' })
    })
    await settle()
    expect(projectWrites()).toHaveLength(1)
  })

  it('writes no local preview while the fresh session is untouched', async () => {
    await mount()
    await act(async () => {
      ctx().openPersonalize({ source: SOURCE })
    })
    // Past the 800ms mirror debounce: an untouched session must not overwrite
    // the preview the user may still choose to continue.
    await settle(1000)
    expect(Object.keys(localStorage).filter((k) => k.includes(SOURCE.id))).toEqual([])
  })

  it('anonymous sessions never persist', async () => {
    await mount('anonymous')
    await open()
    await act(async () => {
      ctx().updatePersonalizedPrompt('anonymous edit')
    })
    await settle()
    expect(persistenceSpy.persist).not.toHaveBeenCalled()
    expect(projectWrites()).toHaveLength(0)
  })
})

describe('saved recast videos and the "Continue with …" offer', () => {
  const RECAST = { id: 'rv-1', url: 'https://cdn.example.com/recast.mp4', name: 'Recast', sourceUrl: 'https://cdn.example.com/performance.mp4' }

  async function savedRecastsKey() {
    const { recastOwnerKey } = await import('../recast/recastJob')
    return `pz_recast_videos:${recastOwnerKey('test-key')}:${SOURCE.id}`
  }

  beforeEach(async () => {
    localStorage.setItem(await savedRecastsKey(), JSON.stringify([RECAST]))
    persistenceSpy.loadProject.mockResolvedValue({
      ok: true,
      data: {
        id: RESTORED_ID,
        sourceType: 'go-ai-viral-video',
        sourceDemoId: SOURCE.id,
        originalPrompt: 'Original prompt',
        personalizedPrompt: 'Restored prompt',
        identityAssetIds: [],
        logoAssetIds: [],
        productAssetIds: [],
        brandReferenceAssetIds: [],
        outputUrls: [],
        outputType: 'video',
      },
    })
  })

  it('loading saved recasts still offers the saved project and writes nothing over it', async () => {
    await mount()
    await open()

    expect((ctx().assets.presenterVideos || []).map((v) => v.url)).toContain(RECAST.url)
    expect(ctx().resumableProject).not.toBeNull()
    expect(projectWrites()).toHaveLength(0)
  })

  it('continuing the saved project keeps the saved recasts', async () => {
    await mount()
    await open()
    await act(async () => {
      await ctx().resumeLastProject()
    })
    await settle()

    expect(ctx().promptState.personalized).toBe('Restored prompt')
    expect((ctx().assets.presenterVideos || []).map((v) => v.url)).toContain(RECAST.url)
    expect(JSON.parse(localStorage.getItem(await savedRecastsKey()) || '[]')).toHaveLength(1)
  })
})
