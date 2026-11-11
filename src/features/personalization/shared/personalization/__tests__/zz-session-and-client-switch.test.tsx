// @vitest-environment jsdom
/**
 * Review fixes on the real provider (renderer mocked by the shared harness):
 *  - a branded render started in one modal session never reports into the next
 *  - switching saved clients never copies one client's assets into another
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import {
  cancelActiveExport,
  getCtx,
  makeDemoSource,
  openSource,
  renderMediaOnWeb,
  renderProvider,
  resetRendererMocks,
  type HarnessRef,
} from './_createFinalVideoHarness'
import { loadClientAssets } from '../clientAssets'

const tick = (ms = 40) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })
const asset = (id: string, role: string) => ({
  id, role, name: `${id}.png`, url: `https://cdn.example/${id}.png`, uploadedUrl: `https://cdn.example/${id}.png`,
  isPrimary: true, mimeType: 'image/png', createdAt: new Date().toISOString(), uploadStatus: 'ready', uploadError: null,
})

beforeEach(() => {
  localStorage.clear()
  URL.createObjectURL = vi.fn(() => 'blob:http://localhost/x') as unknown as typeof URL.createObjectURL
  URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL
  resetRendererMocks()
})
afterEach(() => {
  cancelActiveExport()
  document.body.innerHTML = ''
})

describe('branded render and modal sessions', () => {
  it('drops a branded render that finishes after its modal session was closed', async () => {
    let finish: (v: unknown) => void = () => {}
    renderMediaOnWeb.mockImplementation(() => new Promise((resolve) => { finish = resolve }))

    const ref: HarnessRef = { current: null }
    await renderProvider(ref)
    await openSource(ref)
    await act(async () => { getCtx(ref).approvePersonalization() })
    let pending: Promise<void> | null = null
    await act(async () => { pending = getCtx(ref).createFinalVideo() })
    await vi.waitFor(() => expect(renderMediaOnWeb).toHaveBeenCalledTimes(1), { timeout: 5000 })

    const onComplete = vi.fn()
    await act(async () => { getCtx(ref).closePersonalize() })
    await act(async () => {
      getCtx(ref).openPersonalize({ source: { ...makeDemoSource(), id: 'demo-2' }, onComplete })
    })
    await tick()
    await act(async () => {
      finish({ getBlob: async () => new Blob(['old'], { type: 'video/mp4' }) })
      await pending
    })
    await tick()
    expect(getCtx(ref).result).toBeNull()
    expect(getCtx(ref).generation.status).not.toBe('complete')
    expect(onComplete).not.toHaveBeenCalled()
  })
})

describe('switching saved clients', () => {
  it('does not copy the previous client\'s assets or primaries into the newly selected one', async () => {
    const ref: HarnessRef = { current: null }
    await renderProvider(ref)
    await openSource(ref)

    // Client B first, with an empty job; then client A.
    await act(async () => { getCtx(ref).updateClientForm({ businessName: 'Client B' }) })
    await act(async () => { await getCtx(ref).saveClient() })
    const idB = getCtx(ref).selectedClientId
    await act(async () => { getCtx(ref).selectClient('') })
    await act(async () => { getCtx(ref).updateClientForm({ businessName: 'Client A' }) })
    await act(async () => { await getCtx(ref).saveClient() })
    const idA = getCtx(ref).selectedClientId
    expect(idA && idB && idA !== idB).toBeTruthy()

    // A logo added while A is selected is saved to A.
    await act(async () => { getCtx(ref).selectSavedAsset(asset('logo-a', 'logo')) })
    await tick()
    expect(loadClientAssets(idA).logos.map((l) => l.id)).toEqual(['logo-a'])

    // Picking B must leave B's library alone (A's logo is still in the job).
    await act(async () => { getCtx(ref).useSavedClient(idB) })
    await tick()
    expect(getCtx(ref).selectedClientId).toBe(idB)
    expect(loadClientAssets(idB).logos).toEqual([])
    expect(loadClientAssets(idB).primaryLogo).toBeNull()
    expect(loadClientAssets(idA).logos.map((l) => l.id)).toEqual(['logo-a'])
  })
})
