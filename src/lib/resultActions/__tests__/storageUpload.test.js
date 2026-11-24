// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { uploadToUploadsBucket, verifyPublicFile, describeUploadError } from '../storageUpload.js';
import { isOurStorageUrl, isHttpUrl, isHttpsUrl, isLocalUrl } from '../urls.js';
import { getGuestSalt } from '../ownerClient.js';

const PUBLIC = (p) => `https://x.supabase.co/storage/v1/object/public/uploads/${p}`;
const file = (size = 10) => { const f = new File([new Uint8Array(size)], 'a.mp4', { type: 'video/mp4' }); return f; };
const head = (status, headers = {}) => ({ ok: status < 300, status, headers: { get: (h) => headers[h.toLowerCase()] ?? null } });

/** A fake hybrid client. The wrapper getter `storage` THROWS: the code must use the raw `supabase` client only. */
function hybrid({ uploadResult = { data: {}, error: null }, uploadImpl } = {}) {
  const upload = uploadImpl || vi.fn(async () => uploadResult);
  const raw = { storage: { from: vi.fn(() => ({ upload, getPublicUrl: (p) => ({ data: { publicUrl: PUBLIC(p) } }) })) } };
  const client = { supabase: raw, refreshUserHeader: vi.fn(async () => {}) };
  Object.defineProperty(client, 'storage', { get() { throw new Error('the offline-fallback wrapper must not be used'); } });
  return { client, upload };
}

describe('uploadToUploadsBucket', () => {
  it('uploads through the real client, never the offline wrapper, and returns the public address', async () => {
    const { client, upload } = hybrid();
    const out = await uploadToUploadsBucket('smartvideo/u/copies/a.mp4', file(10), { client, fetchImpl: async () => head(200, { 'content-length': '10' }) });
    expect(out).toEqual({ url: PUBLIC('smartvideo/u/copies/a.mp4'), existed: false });
    expect(upload).toHaveBeenCalledWith('smartvideo/u/copies/a.mp4', expect.any(File), { contentType: 'video/mp4', upsert: false });
    expect(client.refreshUserHeader).toHaveBeenCalled();
  });

  it('a rejected upload is an ERROR (the old wrapper reported success and kept a local copy)', async () => {
    const cases = [
      [{ statusCode: '403', message: 'new row violates row-level security policy' }, /not allowed to save/],
      [{ statusCode: '413', message: 'The object exceeded the maximum allowed size' }, /larger than the storage limit/],
      [{ statusCode: '400', message: 'mime type video/x-foo is not supported' }, /file type is not allowed/],
      [{ message: 'Failed to fetch' }, /Saving the file failed/],
    ];
    for (const [error, message] of cases) {
      const { client } = hybrid({ uploadResult: { data: null, error } });
      const fetchImpl = vi.fn();
      await expect(uploadToUploadsBucket('smartvideo/u/copies/a.mp4', file(), { client, fetchImpl })).rejects.toMatchObject({ code: 'upload_failed', message: expect.stringMatching(message) });
      expect(fetchImpl).not.toHaveBeenCalled(); // nothing is "confirmed" for a file that was never stored
    }
  });

  it('a thrown network error is an upload_failed error too', async () => {
    const { client } = hybrid({ uploadImpl: vi.fn(async () => { throw new TypeError('NetworkError'); }) });
    await expect(uploadToUploadsBucket('smartvideo/u/copies/a.mp4', file(), { client })).rejects.toMatchObject({ code: 'upload_failed' });
  });

  it('times out with its own code', async () => {
    const { client } = hybrid({ uploadImpl: vi.fn(() => new Promise(() => {})) });
    await expect(uploadToUploadsBucket('smartvideo/u/copies/a.mp4', file(), { client, timeoutMs: 20 })).rejects.toMatchObject({ code: 'timeout' });
  });

  it('refuses to claim success when the stored file cannot be found or is the wrong size', async () => {
    const { client } = hybrid();
    await expect(uploadToUploadsBucket('p/a.mp4', file(10), { client, fetchImpl: async () => head(404) })).rejects.toMatchObject({ code: 'upload_failed', message: expect.stringMatching(/not saved/) });
    await expect(uploadToUploadsBucket('p/a.mp4', file(10), { client, fetchImpl: async () => head(200, { 'content-length': '3' }) })).rejects.toMatchObject({ code: 'upload_failed' });
    await expect(uploadToUploadsBucket('p/a.mp4', file(10), { client, fetchImpl: async () => { throw new TypeError('offline'); } })).rejects.toMatchObject({ code: 'unconfirmed' });
  });

  it('an existing file of the same size is reused; a different size under the same name is a conflict', async () => {
    const exists = { data: null, error: { statusCode: '409', message: 'The resource already exists' } };
    const same = await uploadToUploadsBucket('p/a.mp4', file(10), { client: hybrid({ uploadResult: exists }).client, fetchImpl: async () => head(200, { 'content-length': '10' }) });
    expect(same.existed).toBe(true);
    await expect(uploadToUploadsBucket('p/a.mp4', file(10), { client: hybrid({ uploadResult: exists }).client, fetchImpl: async () => head(200, { 'content-length': '99' }) })).rejects.toMatchObject({ code: 'conflict' });
  });

  it('fails clearly when the storage service is not available', async () => {
    const client = { supabase: null, refreshUserHeader: async () => {} };
    await expect(uploadToUploadsBucket('p/a.mp4', file(), { client })).rejects.toMatchObject({ code: 'upload_failed', message: expect.stringMatching(/unavailable/) });
  });
});

describe('verifyPublicFile', () => {
  it('reads the size from HEAD, falls back to a 1-byte range when HEAD is refused, and reports a missing file', async () => {
    expect(await verifyPublicFile('https://x/a', { fetchImpl: async () => head(200, { 'content-length': '42' }) })).toEqual({ exists: true, size: 42 });
    const calls = [];
    const fetchImpl = async (url, init) => { calls.push(init.method); return init.method === 'HEAD' ? head(405) : head(206, { 'content-range': 'bytes 0-0/1234' }); };
    expect(await verifyPublicFile('https://x/a', { fetchImpl })).toEqual({ exists: true, size: 1234 });
    expect(calls).toEqual(['HEAD', 'GET']);
    expect(await verifyPublicFile('https://x/a', { fetchImpl: async () => head(404) })).toEqual({ exists: false, size: null });
    await expect(verifyPublicFile('https://x/a', { fetchImpl: async () => head(500) })).rejects.toMatchObject({ code: 'unconfirmed' });
  });
});

describe('describeUploadError', () => {
  it('never leaks a long raw message', () => {
    expect(describeUploadError({ message: 'x'.repeat(500) }).length).toBeLessThan(140);
  });
});

describe('addresses', () => {
  it('isOurStorageUrl needs https, OUR host and the public-object path', () => {
    const own = 'https://x.supabase.co';
    expect(isOurStorageUrl(PUBLIC('smartvideo/u/a.mp4'), own)).toBe(true);
    for (const bad of [
      'https://evil.example/storage/v1/object/public/uploads/a.mp4',
      'https://x.supabase.co.evil.example/storage/v1/object/public/uploads/a.mp4',
      'http://x.supabase.co/storage/v1/object/public/uploads/a.mp4',
      'https://x.supabase.co/storage/v1/object/sign/uploads/a.mp4',
      'https://x.supabase.co/rest/v1/?u=/storage/v1/object/public/',
      'https://cdn.x/out/a.mp4?next=/storage/v1/object/public/',
      'not a url', '', null, undefined,
    ]) expect(isOurStorageUrl(bad, own)).toBe(false);
    expect(isOurStorageUrl(PUBLIC('a.mp4'), '')).toBe(false); // unknown own host: nothing counts as ours
  });
  it('scheme helpers', () => {
    expect([isHttpUrl('http://a'), isHttpUrl('https://a'), isHttpUrl('javascript:x')]).toEqual([true, true, false]);
    expect([isHttpsUrl('https://a'), isHttpsUrl('http://a')]).toEqual([true, false]);
    expect([isLocalUrl('blob:x'), isLocalUrl('data:x'), isLocalUrl('https://a')]).toEqual([true, true, false]);
  });
});

describe('guest salt', () => {
  it('is created once, kept, and different per browser', () => {
    const make = () => { const m = {}; return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; } }; };
    const a = make(); const b = make();
    const s1 = getGuestSalt(a);
    expect(s1).toMatch(/^[a-z0-9]{12}$/);
    expect(getGuestSalt(a)).toBe(s1);
    expect(getGuestSalt(b)).not.toBe(s1);
  });
  it('still returns a salt when storage is blocked', () => {
    const blocked = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(getGuestSalt(blocked)).toMatch(/^[a-z0-9]{12}$/);
  });
  it('replaces a damaged stored value', () => {
    const store = { v: 'x' };
    const storage = { getItem: () => store.v, setItem: (_, v) => { store.v = v; } };
    expect(getGuestSalt(storage)).toMatch(/^[a-z0-9]{12}$/);
  });
});
