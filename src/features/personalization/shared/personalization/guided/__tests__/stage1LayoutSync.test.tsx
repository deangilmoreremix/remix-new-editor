// @vitest-environment jsdom
/**
 * Stage 1 — account sync for saved layouts: the remote adapter against a fake fetch, and the panel end to end
 * (signed in, signed out, server failing, and the "no silent upload" rule).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  LAYOUTS_API,
  SAVED_LAYOUTS_KEY,
  deleteRemoteLayout,
  fetchRemoteLayouts,
  mergeLayouts,
  saveRemoteLayout,
  snapshotLayout,
  type SavedLayout,
} from '../savedLayouts'
import { LayerToolsPanel } from '../LayerToolsPanel'
import { createDefaultPreviewSettings, createLayer } from '../../preview/presets'

const GEOM = { aspectRatio: '16:9', layers: [{ id: 'headline', kind: 'headline', x: 0.3, y: 0.3, scale: 0.1, opacity: 1, visible: true, rotation: 15 }] }
const remoteLayout = (name: string, id = '11111111-1111-4111-8111-111111111111') => ({ id, name, createdAt: 1, ...GEOM })
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function memoryStorage(initial: Record<string, string> = {}): Storage & { data: Record<string, string> } {
  const data = { ...initial }
  return { data, getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v }, removeItem: (k: string) => { delete data[k] }, clear: () => {}, key: () => null, length: 0 } as never
}

describe('remote adapter', () => {
  it('lists layouts, dropping malformed rows', async () => {
    const f = vi.fn(async () => json(200, { ok: true, layouts: [remoteLayout('Corner'), { id: 'x', name: '', layers: [] }, 'junk'] }))
    const r = await fetchRemoteLayouts(f as never)
    expect(r.ok && r.data.map((l) => l.name)).toEqual(['Corner'])
    expect(f).toHaveBeenCalledWith(LAYOUTS_API, expect.objectContaining({ method: 'GET', credentials: 'same-origin' }))
  })
  it.each([
    [401, 'unauthenticated'], [403, 'unauthenticated'], [404, 'unavailable'], [405, 'unavailable'], [409, 'limit'], [400, 'invalid'], [413, 'invalid'], [500, 'error'], [502, 'error'],
  ])('maps HTTP %s to "%s"', async (status, reason) => {
    const r = await fetchRemoteLayouts((async () => json(status, { error: 'x' })) as never)
    expect(r).toMatchObject({ ok: false, reason })
  })
  it('treats a non-JSON answer (an SPA fallback page) and a network error as "unavailable"', async () => {
    expect(await fetchRemoteLayouts((async () => new Response('<html>app</html>', { status: 200 })) as never)).toMatchObject({ ok: false, reason: 'unavailable' })
    expect(await fetchRemoteLayouts((async () => { throw new TypeError('Failed to fetch') }) as never)).toMatchObject({ ok: false, reason: 'unavailable' })
    expect(await fetchRemoteLayouts((async () => json(200, { ok: true })) as never)).toMatchObject({ ok: false, reason: 'unavailable' })
  })
  it('saves sending GEOMETRY only', async () => {
    let sent: any = null
    const f = vi.fn(async (_u: string, init: RequestInit) => { sent = JSON.parse(String(init.body)); return json(200, { ok: true, layout: remoteLayout('Corner') }) })
    const local = { id: 'layout-1', name: 'Corner', createdAt: 5, ...GEOM, secretText: 'leak', layers: [{ ...GEOM.layers[0], text: 'Private', imageUrl: 'https://x/p.png' }] } as unknown as SavedLayout
    const r = await saveRemoteLayout(local, f as never)
    expect(r.ok && r.data.name).toBe('Corner')
    expect(f).toHaveBeenCalledWith(LAYOUTS_API, expect.objectContaining({ method: 'POST' }))
    // The adapter forwards what it was given; the server re-normalizes. The body must still name only the documented fields.
    expect(Object.keys(sent).sort()).toEqual(['layout', 'name'])
    expect(Object.keys(sent.layout).sort()).toEqual(['aspectRatio', 'layers'])
  })
  it('reports a full account and invalid layouts', async () => {
    expect(await saveRemoteLayout({ id: 'a', name: 'n', createdAt: 0, ...GEOM } as never, (async () => json(409, {})) as never)).toMatchObject({ ok: false, reason: 'limit' })
    expect(await saveRemoteLayout({ id: 'a', name: 'n', createdAt: 0, ...GEOM } as never, (async () => json(200, { ok: true, layout: { nope: 1 } })) as never)).toMatchObject({ ok: false, reason: 'error' })
  })
  it('deletes by id; a missing layout counts as gone; failures are reported', async () => {
    const f = vi.fn(async () => json(200, { ok: true }))
    expect(await deleteRemoteLayout('abc/def', f as never)).toEqual({ ok: true, data: true })
    expect(f).toHaveBeenCalledWith(`${LAYOUTS_API}?id=abc%2Fdef`, expect.objectContaining({ method: 'DELETE' }))
    expect(await deleteRemoteLayout('x', (async () => json(404, {})) as never)).toEqual({ ok: true, data: true })
    expect(await deleteRemoteLayout('x', (async () => json(500, {})) as never)).toMatchObject({ ok: false, reason: 'error' })
  })
  it('merges with the account copy winning on a name collision (case-insensitive)', () => {
    const merged = mergeLayouts(
      [remoteLayout('Corner')] as never,
      [{ ...remoteLayout('corner', 'layout-local-1') }, { ...remoteLayout('Other', 'layout-local-2') }] as never,
    )
    expect(merged.map((l) => `${l.name}:${l.source}`)).toEqual(['Corner:account', 'Other:browser'])
  })
})

describe('LayerToolsPanel layouts (signed in / out / failing)', () => {
  beforeEach(() => vi.stubGlobal('crypto', { randomUUID: () => 'uuid-test' }))
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })
  const settings = { ...createDefaultPreviewSettings(), layers: [createLayer('headline', { text: 'Secret headline', x: 0.3, y: 0.3 })] }
  const mount = (fetchFn: typeof fetch, storage: Storage) =>
    render(<LayerToolsPanel settings={settings} selected={undefined} selectionIds={[]} compW={1920} compH={1080} edit={vi.fn()} onSelect={vi.fn()} snapGrid={false} onSnapGridChange={vi.fn()} layoutFetch={fetchFn} layoutStorage={storage} />)
  const calls = (f: ReturnType<typeof vi.fn>) => f.mock.calls.map((c) => `${(c[1] as RequestInit)?.method ?? 'GET'} ${String(c[0])}`)

  it('signed in: lists account layouts, saves to the account (not to the browser) and says so', async () => {
    const store = memoryStorage()
    const f = vi.fn(async (_u: string, init?: RequestInit) => init?.method === 'POST' ? json(200, { ok: true, layout: remoteLayout('Mine', '22222222-2222-4222-8222-222222222222') }) : json(200, { ok: true, layouts: [remoteLayout('Corner')] }))
    mount(f as never, store)
    await screen.findByLabelText('Apply layout Corner')
    expect(screen.getByTestId('layouts-sync-status').textContent).toMatch(/account/)
    fireEvent.change(screen.getByLabelText('Layout name'), { target: { value: 'Mine' } })
    await act(async () => { fireEvent.click(screen.getByLabelText('Save layout')) })
    await screen.findByLabelText('Apply layout Mine')
    expect(calls(f)).toEqual([`GET ${LAYOUTS_API}`, `POST ${LAYOUTS_API}`])
    expect(screen.getByRole('status').textContent).toMatch(/to your account/)
    expect(store.data[SAVED_LAYOUTS_KEY] ?? '[]').toBe('[]')
    expect(JSON.stringify(f.mock.calls[1][1])).not.toContain('Secret headline')
  })

  it('signed out (401): says why, keeps layouts in the browser and never POSTs', async () => {
    const store = memoryStorage()
    const f = vi.fn(async () => json(401, { error: 'UNAUTHENTICATED' }))
    mount(f as never, store)
    await waitFor(() => expect(screen.getByTestId('layouts-sync-status').textContent).toMatch(/Sign in/))
    fireEvent.change(screen.getByLabelText('Layout name'), { target: { value: 'Local' } })
    await act(async () => { fireEvent.click(screen.getByLabelText('Save layout')) })
    expect(store.data[SAVED_LAYOUTS_KEY]).toContain('Local')
    expect(store.data[SAVED_LAYOUTS_KEY]).not.toContain('Secret headline')
    expect(calls(f)).toEqual([`GET ${LAYOUTS_API}`])
    expect(screen.queryByLabelText(/Upload layout/)).toBeNull()
  })

  it('NEVER uploads silently: a browser layout is only uploaded when the user presses Upload', async () => {
    const mine = snapshotLayout(settings, 'Old browser layout', 'layout-old', 1)!
    const store = memoryStorage({ [SAVED_LAYOUTS_KEY]: JSON.stringify([mine]) })
    const f = vi.fn(async (_u: string, init?: RequestInit) => init?.method === 'POST' ? json(200, { ok: true, layout: remoteLayout('Old browser layout', '33333333-3333-4333-8333-333333333333') }) : json(200, { ok: true, layouts: [] }))
    mount(f as never, store)
    await screen.findByLabelText('Upload layout Old browser layout to my account')
    expect(screen.getByText(/this browser/)).toBeTruthy()
    expect(calls(f)).toEqual([`GET ${LAYOUTS_API}`]) // listed, not uploaded
    await act(async () => { fireEvent.click(screen.getByLabelText('Upload layout Old browser layout to my account')) })
    await waitFor(() => expect(calls(f)).toContain(`POST ${LAYOUTS_API}`))
    await waitFor(() => expect(store.data[SAVED_LAYOUTS_KEY]).toBe('[]')) // browser copy dropped once it is in the account
    expect(screen.getByRole('status').textContent).toMatch(/Uploaded/)
  })

  it('server failing on save: falls back to the browser so the work is never lost', async () => {
    const store = memoryStorage()
    const f = vi.fn(async (_u: string, init?: RequestInit) => init?.method === 'POST' ? json(500, { error: 'x' }) : json(200, { ok: true, layouts: [] }))
    mount(f as never, store)
    await waitFor(() => expect(screen.getByTestId('layouts-sync-status').textContent).toMatch(/account/))
    fireEvent.change(screen.getByLabelText('Layout name'), { target: { value: 'Keep me' } })
    await act(async () => { fireEvent.click(screen.getByLabelText('Save layout')) })
    expect(store.data[SAVED_LAYOUTS_KEY]).toContain('Keep me')
    expect(screen.getByRole('status').textContent).toMatch(/in this browser instead/)
  })

  it('full account (409): keeps the layout in the browser and says the limit was reached', async () => {
    const store = memoryStorage()
    const f = vi.fn(async (_u: string, init?: RequestInit) => init?.method === 'POST' ? json(409, { error: 'LAYOUT_LIMIT_REACHED' }) : json(200, { ok: true, layouts: [] }))
    mount(f as never, store)
    await waitFor(() => expect(screen.getByTestId('layouts-sync-status').textContent).toMatch(/account/))
    fireEvent.change(screen.getByLabelText('Layout name'), { target: { value: 'Too many' } })
    await act(async () => { fireEvent.click(screen.getByLabelText('Save layout')) })
    expect(screen.getByRole('status').textContent).toMatch(/limit of 30/)
    expect(store.data[SAVED_LAYOUTS_KEY]).toContain('Too many')
  })

  it('deleting an account layout calls DELETE with its id', async () => {
    const f = vi.fn(async (_u: string, init?: RequestInit) => init?.method === 'DELETE' ? json(200, { ok: true }) : json(200, { ok: true, layouts: [remoteLayout('Corner')] }))
    mount(f as never, memoryStorage())
    const del = await screen.findByLabelText('Delete layout Corner')
    await act(async () => { fireEvent.click(del) })
    await waitFor(() => expect(screen.queryByLabelText('Apply layout Corner')).toBeNull())
    expect(calls(f)).toContain(`DELETE ${LAYOUTS_API}?id=11111111-1111-4111-8111-111111111111`)
  })

  it('network down: behaves as browser-only with an explanation', async () => {
    const f = vi.fn(async () => { throw new TypeError('Failed to fetch') })
    mount(f as never, memoryStorage())
    await waitFor(() => expect(screen.getByTestId('layouts-sync-status').textContent).toMatch(/stay in this browser/))
  })
})
