// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLink, pageErrorMessage, LinkError } from '../getLink.js';
import { createLinkCache } from '../linkCache.js';

const FILE = 'https://x.supabase.co/storage/v1/object/public/uploads/smartvideo/user_1/copies/aaa.mp4';
const mem = () => { const m = {}; return createLinkCache({ getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; } }); };

/** A fake supabase-js client recording what publishVideo / slug calls do. */
function fakeClient({ business = null, upsertError = null, slugTaken = 0 } = {}) {
  const rows = []; const rpcCalls = [];
  let taken = slugTaken;
  const upsertChain = (row) => ({ select: () => ({ single: async () => (upsertError ? { data: null, error: upsertError } : { data: { id: row.id }, error: null }) }) });
  return {
    rows, rpcCalls,
    from: (table) => ({
      upsert: (row) => { rows.push({ table, row }); return upsertChain(row); },
      select: () => ({ maybeSingle: async () => ({ data: business ? { business_slug: business, display_name: null } : null, error: null }) }),
    }),
    rpc: async (name, args) => { rpcCalls.push({ name, args }); if (name === 'set_video_slug' && taken > 0) { taken -= 1; return { data: null, error: { message: 'slug_taken' } }; } return { data: {}, error: null }; },
  };
}

const base = (extra = {}) => ({
  url: 'https://cdn.muapi.test/out/abc.mp4', kind: 'video', title: 'Spring promo',
  deps: { ownerKey: 'user_1', cache: mem(), copy: vi.fn(async () => ({ fileUrl: FILE, kind: 'video', reused: false })), probe: vi.fn(async () => ({ duration: 12, width: 1280, height: 720 })), getClient: vi.fn(async () => fakeClient()), signedIn: () => false, ...extra },
});

describe('getLink', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('gives a file link and a /watch page for a video', async () => {
    const o = base();
    const res = await getLink(o);
    expect(res.fileUrl).toBe(FILE);
    expect(res.watchUrl).toMatch(/\/watch\/v[a-z0-9]{20}$/);
    expect(res.pageError).toBeNull();
    const client = await o.deps.getClient.mock.results[0].value;
    expect(client.rows).toHaveLength(1);
    expect(client.rows[0].row).toMatchObject({ published: true, title: 'Spring promo' });
    expect(client.rows[0].row.project.tracks[0].items[0].src).toBe(FILE);
    expect(client.rows[0].row.id).toMatch(/^[A-Za-z0-9_-]{8,32}$/);
  });

  it('stops at the file link for images and audio (no page)', async () => {
    for (const kind of ['image', 'audio']) {
      const o = base({ copy: vi.fn(async () => ({ fileUrl: FILE.replace('.mp4', '.png'), kind, reused: false })) });
      const res = await getLink({ ...o, kind });
      expect(res).toMatchObject({ kind, watchUrl: null, canonicalUrl: null, pageError: null });
      expect(o.deps.getClient).not.toHaveBeenCalled();
      expect(o.deps.probe).not.toHaveBeenCalled();
    }
  });

  it('is idempotent: a second click reuses the file and the page (no second upload or publish)', async () => {
    const o = base();
    const first = await getLink(o);
    const second = await getLink(o);
    expect(second.fileUrl).toBe(first.fileUrl);
    expect(second.watchUrl).toBe(first.watchUrl);
    expect(second.reused).toBe(true);
    expect(o.deps.copy).toHaveBeenCalledTimes(1);
    expect(o.deps.getClient).toHaveBeenCalledTimes(1);
  });

  it('two clicks at once share one upload', async () => {
    let release; const gate = new Promise((r) => { release = r; });
    const o = base({ copy: vi.fn(async () => { await gate; return { fileUrl: FILE, kind: 'video', reused: false }; }) });
    const a = getLink(o); const b = getLink(o);
    await Promise.resolve();
    release();
    const [ra, rb] = await Promise.all([a, b]);
    expect(o.deps.copy).toHaveBeenCalledTimes(1);
    expect(ra.watchUrl).toBe(rb.watchUrl);
  });

  it('the same result gets the same /watch id for the same owner, a different one for another owner', async () => {
    const a = await getLink(base());
    const b = await getLink(base());
    const c = await getLink(base({ ownerKey: 'user_2' }));
    expect(a.watchUrl).toBe(b.watchUrl);
    expect(c.watchUrl).not.toBe(a.watchUrl);
  });

  it('keeps the file link when the page cannot be made (guest limit), and says why', async () => {
    const o = base({ getClient: vi.fn(async () => fakeClient({ upsertError: { message: 'guest_limit_videos' } })) });
    const res = await getLink(o);
    expect(res.fileUrl).toBe(FILE);
    expect(res.watchUrl).toBeNull();
    expect(res.pageError).toMatch(/up to 10 videos/);
    expect(res.pageError).toMatch(/file link still works/);
  });

  it('skips the page (not the file) when the video cannot be read', async () => {
    const res = await getLink(base({ probe: vi.fn(async () => null) }));
    expect(res.fileUrl).toBe(FILE);
    expect(res.watchUrl).toBeNull();
    expect(res.pageError).toMatch(/could not be read/);
  });

  it('retries only the page when the file was already saved', async () => {
    const o = base({ probe: vi.fn().mockResolvedValueOnce(null).mockResolvedValue({ duration: 9, width: 1280, height: 720 }) });
    const first = await getLink(o);
    expect(first.watchUrl).toBeNull();
    const second = await getLink(o);
    expect(second.watchUrl).toMatch(/\/watch\//);
    expect(o.deps.copy).toHaveBeenCalledTimes(1);
  });

  it('a signed-in owner with a business name also gets the readable address (with one retry if the name is taken)', async () => {
    const client = fakeClient({ business: 'acme', slugTaken: 1 });
    const res = await getLink(base({ getClient: vi.fn(async () => client), signedIn: () => true }));
    const slugCalls = client.rpcCalls.filter((c) => c.name === 'set_video_slug');
    expect(slugCalls).toHaveLength(2);
    expect(slugCalls[0].args.p_slug).not.toBe(slugCalls[1].args.p_slug);
    expect(res.canonicalUrl).toMatch(/\/v\/acme\/spring-promo-[a-z0-9]+$/);
  });

  it('never asks a guest for a readable address', async () => {
    const client = fakeClient({ business: 'acme' });
    const res = await getLink(base({ getClient: vi.fn(async () => client), signedIn: () => false }));
    expect(client.rpcCalls).toHaveLength(0);
    expect(res.canonicalUrl).toBeNull();
  });

  it('fails clearly when the file cannot be copied, and does not publish a page', async () => {
    const copy = vi.fn(async () => { throw Object.assign(new Error('Could not copy this file. Download it and upload it from your computer instead.'), { code: 'blocked' }); });
    const o = base({ copy });
    await expect(getLink(o)).rejects.toMatchObject({ code: 'blocked' });
    expect(o.deps.getClient).not.toHaveBeenCalled();
    await expect(getLink({ url: '' })).rejects.toBeInstanceOf(LinkError);
  });

  it('page error messages are plain', () => {
    expect(pageErrorMessage(new Error('Sign in to publish videos'))).toMatch(/Sign in/);
    expect(pageErrorMessage(new Error('weird'))).toMatch(/could not be created/);
  });
});
