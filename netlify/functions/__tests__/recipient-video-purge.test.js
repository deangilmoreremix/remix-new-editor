import { describe, it, expect, vi } from 'vitest'
import { purge } from '../recipient-video-purge.js'

const P = (c) => `vidAAAAAAAA/11111111-1111-1111-1111-111111111111/${c.repeat(32)}.mp4`
const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' }
const res = (status, body) => ({ ok: status < 300, status, json: async () => body })

describe('recipient-video-purge', () => {
  it('does nothing without configuration', async () => {
    const f = vi.fn(); expect(await purge({ fetchImpl: f, env: {} })).toMatchObject({ ok: false, error: 'not_configured' }); expect(f).not.toHaveBeenCalled()
  })
  it('deletes each returned object once and reports the count', async () => {
    const f = vi.fn(async (u, o) => (String(u).includes('/rpc/') ? res(200, [{ object_path: P('a') }, { object_path: P('b') }]) : res(200, {})))
    const r = await purge({ fetchImpl: f, env }); expect(r).toEqual({ ok: true, removed: 2, failed: 0 })
    const del = f.mock.calls.filter(([, o]) => o?.method === 'DELETE'); expect(del).toHaveLength(2); expect(String(del[0][0])).toContain('/storage/v1/object/recipient-videos/')
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ p_limit: 200 })
  })
  it('counts a file that cannot be deleted instead of hiding it', async () => {
    const f = vi.fn(async (u, o) => (String(u).includes('/rpc/') ? res(200, [{ object_path: P('a') }]) : res(500, {})))
    expect(await purge({ fetchImpl: f, env })).toEqual({ ok: true, removed: 0, failed: 1 })
  })
  it('counts a deletion that throws, and keeps going', async () => {
    const f = vi.fn(async (u) => { if (String(u).includes('/rpc/')) return res(200, [{ object_path: P('a') }, { object_path: P('b') }]); if (String(u).includes(`${'a'.repeat(32)}`)) throw new Error('network'); return res(200, {}) })
    expect(await purge({ fetchImpl: f, env })).toEqual({ ok: true, removed: 1, failed: 1 })
  })
  it('never deletes a path outside the expected scheme', async () => {
    const f = vi.fn(async (u) => (String(u).includes('/rpc/') ? res(200, [{ object_path: '../../other/secret.mp4' }]) : res(200, {})))
    expect(await purge({ fetchImpl: f, env })).toEqual({ ok: true, removed: 0, failed: 1 }); expect(f.mock.calls.some(([, o]) => o?.method === 'DELETE')).toBe(false)
  })
  it('reports a failing database call', async () => {
    expect(await purge({ fetchImpl: async () => res(500, {}), env })).toMatchObject({ ok: false, error: 'rpc_failed_500' })
  })
})
