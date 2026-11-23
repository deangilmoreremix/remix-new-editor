// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLink, pageErrorMessage, LinkError } from '../getLink.js';
import { createLinkCache } from '../linkCache.js';

const FILE = 'https://x.supabase.co/storage/v1/object/public/uploads/smartvideo/user_1/copies/aaa.mp4';
const mem = () => { const m = {}; return createLinkCache({ getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; } }); };

/** A fake supabase-js client: records upserts and RPCs, and answers the reads getLink makes. */
function fakeClient({ business = null, upsertError = null, slugTaken = 0, published = true, hasRow = true } = {}) {
  const rows = []; const rpcCalls = [];
  let taken = slugTaken;
  const upsertChain = (row) => ({ select: () => ({ single: async () => (upsertError ? { data: null, error: upsertError } : { data: { id: row.id }, error: null }) }) });
  const state = { published, hasRow };
  return {
    rows, rpcCalls, state,
    from: (table) => ({
      upsert: (row) => { rows.push({ table, row }); return upsertChain(row); },
      select: () => ({
        maybeSingle: async () => ({ data: business ? { business_slug: business, display_name: null } : null, error: null }), // video_owner_profiles
        eq: () => ({ maybeSingle: async () => ({ data: state.hasRow ? { id: 'x', title: 't', published: state.published, slug: null } : null, error: null }) }), // published_videos by id
      }),
    }),
    rpc: async (name, args) => { rpcCalls.push({ name, args }); if (name === 'set_video_slug' && taken > 0) { taken -= 1; return { data: null, error: { message: 'slug_taken' } }; } return { data: {}, error: null }; },
  };
}

const base = (extra = {}) => ({
  url: 'https://cdn.muapi.test/out/abc.mp4', kind: 'video', title: 'AI video',
  deps: {
    ownerKey: 'user_1', cache: mem(), signedIn: () => false, guestSalt: 'salt-a',
    copy: vi.fn(async () => ({ fileUrl: FILE, kind: 'video', reused: false })),
    probe: vi.fn(async () => ({ duration: 12, width: 1280, height: 720 })),
    getClient: vi.fn(async () => fakeClient()),
    verifyFile: vi.fn(async () => ({ exists: true, size: 10 })),
    ...extra,
  },
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
    expect(client.rows[0].row).toMatchObject({ published: true, title: 'AI video' });
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
    const client = await o.deps.getClient.mock.results[0].value;
    expect(client.rows).toHaveLength(1);
  });

  it('two clicks at once share one upload', async () => {
    let release; const gate = new Promise((r) => { release = r; });
    const o = base({ copy: vi.fn(async () => { await gate; return { fileUrl: FILE, kind: 'video', reused: false }; }) });
    const a = getLink(o); const b = getLink(o);
    await Promise.resolve(); await Promise.resolve();
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

  it('two signed-out people (same folder "anonymous") get different files and different pages', async () => {
    const copies = [];
    const copy = vi.fn(async (src, o) => { copies.push(o); return { fileUrl: FILE, kind: 'video', reused: false }; });
    const one = await getLink(base({ ownerKey: 'anonymous', guestSalt: 'salt-a', copy }));
    const two = await getLink(base({ ownerKey: 'anonymous', guestSalt: 'salt-b', copy }));
    expect(one.watchUrl).not.toBe(two.watchUrl);
    expect(copies[0].ownerKey).toBe('anonymous');
    expect(copies[0].scope).not.toBe(copies[1].scope);
    expect(copies[0].scope).toBe('anonymous:salt-a');
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

  describe('a remembered link is checked before it is reused', () => {
    it('copies again when the saved file is gone', async () => {
      const o = base();
      await getLink(o);
      o.deps.verifyFile.mockResolvedValue({ exists: false });
      const again = await getLink(o);
      expect(o.deps.copy).toHaveBeenCalledTimes(2);
      expect(again.reused).toBe(false);
    });
    it('copies again when the check itself fails', async () => {
      const o = base();
      await getLink(o);
      o.deps.verifyFile.mockRejectedValue(new Error('offline'));
      await getLink(o);
      expect(o.deps.copy).toHaveBeenCalledTimes(2);
    });
    it('publishes the page again when it was unpublished or deleted, with the same id', async () => {
      const client = fakeClient();
      const o = base({ getClient: vi.fn(async () => client) });
      const first = await getLink(o);
      client.state.published = false;
      const again = await getLink(o);
      expect(client.rows).toHaveLength(2);
      expect(client.rows[1].row.id).toBe(client.rows[0].row.id);
      expect(again.watchUrl).toBe(first.watchUrl);
      client.state.hasRow = false;
      await getLink(o);
      expect(client.rows).toHaveLength(3);
    });
    it('keeps the page when it is still published (no second publish)', async () => {
      const client = fakeClient();
      const o = base({ getClient: vi.fn(async () => client) });
      await getLink(o); await getLink(o); await getLink(o);
      expect(client.rows).toHaveLength(1);
    });
  });

  describe('readable address', () => {
    it('a signed-in owner with a business name also gets it (one retry if the name is taken)', async () => {
      const client = fakeClient({ business: 'acme', slugTaken: 1 });
      const res = await getLink(base({ getClient: vi.fn(async () => client), signedIn: () => true }));
      const slugCalls = client.rpcCalls.filter((c) => c.name === 'set_video_slug');
      expect(slugCalls).toHaveLength(2);
      expect(slugCalls[0].args.p_slug).not.toBe(slugCalls[1].args.p_slug);
      expect(res.canonicalUrl).toMatch(/\/v\/acme\/ai-video-[a-z0-9]+$/);
    });
    it('is tried again later when it failed the first time (a missing address is never remembered)', async () => {
      const client = fakeClient({ business: null });
      const o = base({ getClient: vi.fn(async () => client), signedIn: () => true });
      const first = await getLink(o);
      expect(first.canonicalUrl).toBeNull();
      client.rpcCalls.length = 0;
      const withBusiness = fakeClient({ business: 'acme' });
      o.deps.getClient = vi.fn(async () => withBusiness);
      const second = await getLink(o);
      expect(second.canonicalUrl).toMatch(/\/v\/acme\//);
      expect(second.watchUrl).toBe(first.watchUrl);
    });
    it('never asks a guest for it', async () => {
      const client = fakeClient({ business: 'acme' });
      const res = await getLink(base({ getClient: vi.fn(async () => client), signedIn: () => false }));
      expect(client.rpcCalls).toHaveLength(0);
      expect(res.canonicalUrl).toBeNull();
    });
  });

  describe('one identity per click', () => {
    it('passes the identity chosen at the click to the owner client', async () => {
      const o = base({ signedIn: () => false });
      await getLink(o);
      expect(o.deps.getClient).toHaveBeenCalledWith({ signedIn: false });
    });
    it('stops with a clear message when the person signs in while the file is being copied', async () => {
      let state = false;
      const o = base({ signedIn: () => state, copy: vi.fn(async () => { state = true; return { fileUrl: FILE, kind: 'video', reused: false }; }) });
      await expect(getLink(o)).rejects.toMatchObject({ code: 'identity_changed' });
      expect(o.deps.getClient).not.toHaveBeenCalled();
    });
  });

  it('fails clearly when the file cannot be copied, and does not publish a page', async () => {
    const copy = vi.fn(async () => { throw Object.assign(new Error('Could not copy this file. Download it and upload it from your computer instead.'), { code: 'blocked' }); });
    const o = base({ copy });
    await expect(getLink(o)).rejects.toMatchObject({ code: 'blocked' });
    expect(o.deps.getClient).not.toHaveBeenCalled();
    await expect(getLink({ url: '' })).rejects.toBeInstanceOf(LinkError);
  });

  it('does not leave a failed attempt in the cache or the running list', async () => {
    const copy = vi.fn().mockRejectedValueOnce(Object.assign(new Error('boom'), { code: 'upload_failed' })).mockResolvedValue({ fileUrl: FILE, kind: 'video', reused: false });
    const o = base({ copy });
    await expect(getLink(o)).rejects.toThrow('boom');
    const retry = await getLink(o);
    expect(retry.fileUrl).toBe(FILE);
    expect(copy).toHaveBeenCalledTimes(2);
  });

  it('page error messages are plain', () => {
    expect(pageErrorMessage(new Error('Sign in to publish videos'))).toMatch(/Sign in/);
    expect(pageErrorMessage(new Error('weird'))).toMatch(/could not be created/);
  });
});
