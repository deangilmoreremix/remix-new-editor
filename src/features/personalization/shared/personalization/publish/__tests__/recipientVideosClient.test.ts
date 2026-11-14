// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { MAX_VIDEO_BYTES, RECIPIENT_VIDEOS_API, removeRecipientVideo, uploadRecipientVideo } from '../recipientVideosClient'

const mp4 = (n = 5000) => new Blob([new Uint8Array(n)], { type: 'video/mp4' })
const PATH = 'vidAAAAAAAA/11111111-1111-4111-8111-111111111111/' + 'a'.repeat(32) + '.mp4'
function world(over: { urlStatus?: number; putOk?: boolean; regStatus?: number; putThrows?: boolean } = {}) {
  const calls: Array<{ url: string; method: string; body?: any }> = []
  const f = vi.fn(async (url: string, init: any) => {
    calls.push({ url, method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body })
    if (url === RECIPIENT_VIDEOS_API) { const b = JSON.parse(init.body); if (b.action === 'upload-url') return { status: over.urlStatus ?? 200, json: async () => ({ ok: (over.urlStatus ?? 200) === 200, uploadUrl: 'https://db.test/storage/v1/object/upload/sign/recipient-videos/x?token=t', path: PATH }) }; return { status: over.regStatus ?? 200, json: async () => ({ ok: (over.regStatus ?? 200) === 200, bytes: 5000 }) } }
    if (over.putThrows) throw new Error('offline'); return { ok: over.putOk ?? true, status: over.putOk === false ? 500 : 200 }
  })
  return { f: f as unknown as typeof fetch, calls }
}
describe('uploadRecipientVideo', () => {
  it('asks the server for a signed URL, PUTs the file there with the same form Supabase uses, then records it', async () => {
    const w = world(); const r = await uploadRecipientVideo('vidAAAAAAAA', '11111111-1111-4111-8111-111111111111', mp4(), w.f)
    expect(r).toEqual({ ok: true, bytes: 5000 }); expect(w.calls.map((c) => c.method)).toEqual(['POST', 'PUT', 'POST']); expect(w.calls[0].body).toMatchObject({ action: 'upload-url', contentType: 'video/mp4', bytes: 5000 })
    expect(w.calls[1].url).toMatch(/^https:\/\/db\.test\/storage\/v1\/object\/upload\/sign\//); expect(w.calls[1].body).toBeInstanceOf(FormData); expect(w.calls[2].body).toEqual({ action: 'register', videoId: 'vidAAAAAAAA', linkId: '11111111-1111-4111-8111-111111111111', path: PATH })
  })
  it('refuses a wrong type or size before any request, and maps each failure to a plain message without ever throwing', async () => {
    const w = world(); for (const bad of [new Blob(['x'], { type: 'image/gif' }), new Blob([], { type: 'video/mp4' })]) expect(await uploadRecipientVideo('v', 'l', bad, w.f)).toMatchObject({ ok: false, reason: 'invalid' }); expect(w.f).not.toHaveBeenCalled()
    const big = { type: 'video/mp4', size: MAX_VIDEO_BYTES + 1 } as Blob; expect(await uploadRecipientVideo('v', 'l', big, w.f)).toMatchObject({ reason: 'invalid' })
    for (const [status, reason] of [[401, 'unauthenticated'], [404, 'not-found'], [503, 'not-configured'], [429, 'rate-limited'], [400, 'invalid'], [500, 'unavailable']] as const) expect(await uploadRecipientVideo('v', 'l', mp4(), world({ urlStatus: status }).f), String(status)).toMatchObject({ ok: false, reason })
    expect(await uploadRecipientVideo('v', 'l', mp4(), world({ putOk: false }).f)).toMatchObject({ reason: 'upload-failed' }); expect(await uploadRecipientVideo('v', 'l', mp4(), world({ putThrows: true }).f)).toMatchObject({ reason: 'upload-failed' })
    expect(await uploadRecipientVideo('v', 'l', mp4(), world({ regStatus: 409 }).f)).toMatchObject({ reason: 'not-recorded' }); expect(await uploadRecipientVideo('v', 'l', mp4(), world({ regStatus: 404 }).f)).toMatchObject({ reason: 'not-found' })
    expect(await uploadRecipientVideo('v', 'l', mp4(), (async () => { throw new Error('x') }) as unknown as typeof fetch)).toMatchObject({ reason: 'unavailable' })
  })
  it('never PUTs to a non-https address the server returned', async () => {
    const f = vi.fn(async (url: string) => (url === RECIPIENT_VIDEOS_API ? { status: 200, json: async () => ({ ok: true, uploadUrl: 'http://169.254.169.254/x', path: PATH }) } : { ok: true })) as unknown as typeof fetch
    expect(await uploadRecipientVideo('v', 'l', mp4(), f)).toMatchObject({ reason: 'unavailable' }); expect((f as any).mock.calls).toHaveLength(1)
  })
  it('removes a video', async () => { expect(await removeRecipientVideo('l', vi.fn(async () => ({ status: 200 })) as unknown as typeof fetch)).toBe(true); expect(await removeRecipientVideo('l', vi.fn(async () => { throw new Error('x') }) as unknown as typeof fetch)).toBe(false) })
})
