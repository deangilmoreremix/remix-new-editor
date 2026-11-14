// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { handle, handler } from '../recipient-video.js';
import { BUCKET, isObjectPath, objectSize, removeObject, signDownload, signUpload } from '../_storage/signedUrls.js';

const env = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'service-secret' };
const TOKEN = 'Abcdefghijklmnopqrstuvwxyz012345';
const hash = createHash('sha256').update(TOKEN).digest('hex');
const PATH = `vidAAAAAAAA/11111111-1111-4111-8111-111111111111/${'a'.repeat(32)}.mp4`;
const cfg = { url: 'https://db.test', key: 'service-secret' };

describe('signed URL helper', () => {
  it('only accepts object paths of the exact scheme', () => {
    expect(isObjectPath(PATH)).toBe(true);
    for (const bad of ['', null, '../x', 'vid/../../etc/passwd', `vidAAAAAAAA/11111111-1111-4111-8111-111111111111/${'a'.repeat(32)}.exe`, `vidAAAAAAAA/not-a-uuid/${'a'.repeat(32)}.mp4`, PATH + '/x', 'x'.repeat(300)]) expect(isObjectPath(bad), String(bad)).toBe(false);
  });
  it('asks Storage for a download URL with the service key, a bounded lifetime, and no redirects; refuses unexpected paths without a call', async () => {
    const f = vi.fn(async () => ({ ok: true, json: async () => ({ signedURL: `/object/sign/${BUCKET}/${PATH}?token=abc` }) }));
    expect(await signDownload(cfg, PATH, 600, f)).toBe(`https://db.test/storage/v1/object/sign/${BUCKET}/${PATH}?token=abc`);
    const [url, init] = f.mock.calls[0]; expect(url).toBe(`https://db.test/storage/v1/object/sign/${BUCKET}/${PATH}`); expect(init).toMatchObject({ method: 'POST', redirect: 'manual' }); expect(JSON.parse(init.body)).toEqual({ expiresIn: 600 }); expect(init.headers.Authorization).toBe('Bearer service-secret')
    await expect(signDownload(cfg, '../x', 600, f)).rejects.toThrow(/unexpected object path/); expect(f).toHaveBeenCalledTimes(1);
    await expect(signDownload(cfg, PATH, 600, vi.fn(async () => ({ ok: false, status: 500 })))).rejects.toThrow(/HTTP 500/); await expect(signDownload(cfg, PATH, 600, vi.fn(async () => ({ ok: true, json: async () => ({}) })))).rejects.toThrow(/no signed URL/);
  });
  it('mints an upload URL for exactly one path, deletes tolerantly, and reads object size from Storage', async () => {
    const up = vi.fn(async () => ({ ok: true, json: async () => ({ url: `/object/upload/sign/${BUCKET}/${PATH}?token=t` }) })); expect(await signUpload(cfg, PATH, up)).toContain('/object/upload/sign/'); expect(up.mock.calls[0][0]).toBe(`https://db.test/storage/v1/object/upload/sign/${BUCKET}/${PATH}`)
    expect(await removeObject(cfg, PATH, vi.fn(async () => ({ ok: false, status: 404 })))).toBe(true); expect(await removeObject(cfg, PATH, vi.fn(async () => ({ ok: false, status: 500 })))).toBe(false); expect(await removeObject(cfg, '../x', vi.fn())).toBe(false)
    expect(await objectSize(cfg, PATH, vi.fn(async () => ({ ok: true, json: async () => ({ size: 4096 }) })))).toBe(4096); expect(await objectSize(cfg, PATH, vi.fn(async () => ({ ok: false })))).toBeNull(); expect(await objectSize(cfg, PATH, vi.fn(async () => ({ ok: true, json: async () => ({ size: 0 }) })))).toBeNull()
  });
});

function fakeFetch({ hit = { object_path: PATH, content_type: 'video/mp4' }, limit = { allowed: true }, signFails = false } = {}) {
  const calls = [];
  const fn = vi.fn(async (url, init) => {
    calls.push({ url, body: init?.body ? JSON.parse(init.body) : null });
    if (url.includes('/rpc/rate_limit_check')) return { ok: true, json: async () => limit };
    if (url.includes('/rpc/recipient_video_resolve')) return { ok: true, json: async () => hit };
    if (url.includes('/storage/v1/object/sign/')) return signFails ? { ok: false, status: 500 } : { ok: true, json: async () => ({ signedURL: `/object/sign/${BUCKET}/${PATH}?token=zzz` }) };
    return { ok: false, status: 404 };
  });
  fn.calls = calls; return fn;
}

describe('recipient-video function', () => {
  it('trades a live token for THIS video for a short-lived signed URL; the plain token never reaches the database', async () => {
    const f = fakeFetch(); const res = await handle({ video: 'vidAAAAAAAA', token: TOKEN, ip: '203.0.113.9' }, { fetchImpl: f, env }); const j = JSON.parse(res.body)
    expect(res.statusCode).toBe(200); expect(j).toMatchObject({ ok: true, contentType: 'video/mp4', expiresIn: 3600 }); expect(j.url).toMatch(/^https:\/\/db\.test\/storage\/v1\/object\/sign\//)
    expect(f.calls.find((c) => c.url.includes('recipient_video_resolve')).body).toEqual({ p_video_id: 'vidAAAAAAAA', p_token_hash: hash }); expect(JSON.stringify(f.calls)).not.toContain(TOKEN); expect(JSON.stringify(f.calls)).not.toContain('203.0.113.9')
    expect(res.headers['Cache-Control']).toBe('no-store'); expect(res.headers['Referrer-Policy']).toBe('no-referrer')
  });
  it('unknown, revoked, expired, other-video and made-up tokens all answer the same 404', async () => {
    const res = await handle({ video: 'vidAAAAAAAA', token: TOKEN }, { fetchImpl: fakeFetch({ hit: null }), env }); expect(res.statusCode).toBe(404); expect(JSON.parse(res.body)).toEqual({ ok: false, error: 'not_found' })
    for (const bad of [{ video: 'x', token: TOKEN }, { video: 'vidAAAAAAAA', token: 'short' }, { video: 'vidAAAAAAAA', token: 'x'.repeat(40) }, { video: "a'; drop", token: TOKEN }, { video: undefined, token: undefined }]) { const f = fakeFetch(); expect((await handle(bad, { fetchImpl: f, env })).statusCode).toBe(404); expect(f).not.toHaveBeenCalled() }
  });
  it('fails closed without configuration, rate limits per client, and never leaks internals', async () => {
    expect((await handle({ video: 'vidAAAAAAAA', token: TOKEN }, { fetchImpl: fakeFetch(), env: {} })).statusCode).toBe(503)
    expect((await handle({ video: 'vidAAAAAAAA', token: TOKEN }, { fetchImpl: fakeFetch({ limit: { allowed: false } }), env })).statusCode).toBe(429)
    const err = vi.spyOn(console, 'error').mockImplementation(() => {}); const bad = await handle({ video: 'vidAAAAAAAA', token: TOKEN }, { fetchImpl: fakeFetch({ signFails: true }), env }); expect(bad.statusCode).toBe(502); expect(bad.body).not.toMatch(/storage|service-secret|HTTP/); err.mockRestore()
    expect((await handle({ video: 'vidAAAAAAAA', token: TOKEN }, { fetchImpl: fakeFetch({ hit: { object_path: '../../x' } }), env })).statusCode).toBe(502) // a poisoned row is never signed
  });
  it('the Netlify handler only serves GET and reads the query', async () => {
    expect((await handler({ httpMethod: 'POST' })).statusCode).toBe(405)
    const prev = { ...process.env }; Object.assign(process.env, env); const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch())
    const res = await handler({ httpMethod: 'GET', queryStringParameters: { video: 'vidAAAAAAAA', r: TOKEN }, headers: { 'x-nf-client-connection-ip': '198.51.100.7' } }); expect(res.statusCode).toBe(200); spy.mockRestore(); process.env = prev
  });
});
