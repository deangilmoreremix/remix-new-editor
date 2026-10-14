// Shared-database caller identity — the regression suite for the
// verified-identity RLS model (migration
// supabase/migrations/20261014120000_smartvideo_media_rls_tagged.sql).
//
// DOCUMENTED RULE (rationale):
//   signed-in → authContext.userId is the Clerk user id and matches
//               getUserKey();
//   signed-out → authContext.userId is 'anonymous' even when a BYOK MuAPI
//               key exists (the BYOK hash is an offline-only identity and
//               must never be written to the shared DB).
//
// Asserted here:
//   (a) signed-in → storage path `smartvideo/<clerk-id>/...` and media row
//       user_id = Clerk id,
//   (b) signed-out with a MuAPI key present → path `smartvideo/anonymous/...`
//       and row user_id 'anonymous' (the regression test for the bug where
//       the `user_<hash>` identity reached the shared DB and was denied by
//       the owner-scoped policies),
//   (c) assetLibrary (and the hybrid offline-sync writer) use the SAME
//       identity for the object path and the media row — no path/row drift.
//
// The offline BYOK hash is genuinely produced in this suite: userKey.js runs
// for real (apiKeyManager and offlineStorage are mocked, not userKey), so the
// tests prove the hash exists for the caller and is still never written.

import { describe, test, expect, beforeEach, afterAll, vi } from 'vitest';

const CLERK_ID = 'user_2xKd9Qm4';
const BYOK_KEY = 'muapi_live_regression_key_0123456789';

// Shared mutable state (declared via vi.hoisted so the mock factories below
// can reach it despite vi.mock hoisting).
const shared = vi.hoisted(() => ({
  byok: { key: null },
  offline: { media: [] },
  uploads: [],
  inserts: [],
  upserts: [],
  rows: [],
}));

// The BYOK key the signed-out caller has stored (drives userKey.js's hash).
vi.mock('../lib/apiKeyManager.js', () => ({
  apiKeyManager: {
    getMuapiKey: () => shared.byok.key,
    setMuapiKey: (key) => { shared.byok.key = key; },
    clearMuapiKey: () => { shared.byok.key = null; },
    hasMuapiKey: () => !!shared.byok.key,
  },
}));

// offline-storage instantiates an IndexedDB service at module scope; the mock
// keeps the suite hermetic (only the current user id / export / save paths
// are exercised).
vi.mock('../lib/offline-storage.js', () => ({
  offlineStorage: {
    getCurrentUserId: () => 'anonymous',
    exportData: async () => ({ projects: [], media: [], generations: [] }),
    saveMedia: async (media) => { shared.offline.media.push(media); return media; },
    saveProject: async (p) => p,
    saveGeneration: async (g) => g,
    loadMedia: async () => null,
    loadProject: async () => null,
    listMedia: async () => [],
    listProjects: async () => [],
    listGenerations: async () => [],
    deleteProject: async () => {},
  },
}));

// Supabase SDK fake: captures every storage path, media insert and media
// upsert the real supabase.js / assetLibrary.js / hybrid-supabase.js issue,
// so the identity decisions can be asserted without any network.
vi.mock('@supabase/supabase-js', () => {
  const headers = { rest: {}, storage: {} };
  function makeQuery() {
    const filters = {};
    const builder = {
      eq(column, value) { filters[column] = value; return builder; },
      order() { return builder; },
      maybeSingle: async () => ({
        data: shared.rows.find((r) => r.id === filters.id) || null,
        error: null,
      }),
      then(onFulfilled, onRejected) {
        let rows = shared.rows.slice();
        Object.entries(filters).forEach(([column, value]) => {
          rows = rows.filter((r) => String(r[column]) === String(value));
        });
        return Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected);
      },
    };
    return builder;
  }
  return {
    createClient: () => ({
      rest: { headers: headers.rest },
      storage: {
        headers: headers.storage,
        from: (bucket) => ({
          upload: async (path, file, options) => {
            shared.uploads.push({ bucket, path, options });
            return { data: { path }, error: null };
          },
          remove: async (paths) => ({ data: paths, error: null }),
          getPublicUrl: (path) => ({
            data: { publicUrl: `https://storage.test.local/${bucket}/${path}` },
            error: null,
          }),
          download: async () => ({ data: null, error: new Error('not found') }),
        }),
      },
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        getUser: async () => ({ data: { user: null }, error: null }),
      },
      from: (table) => ({
        select: () => makeQuery(),
        insert: (row) => ({
          select: () => ({
            single: async () => {
              shared.inserts.push({ table, row });
              shared.rows.push(row);
              return { data: row, error: null };
            },
          }),
        }),
        upsert: async (row) => {
          shared.upserts.push({ table, row });
          return { data: row, error: null };
        },
        delete: () => ({ eq: async () => ({ data: null, error: null }) }),
      }),
    }),
  };
});

// The asset library must be configured for the write paths under test.
vi.stubEnv('VITE_SUPABASE_URL', 'https://fake.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'fake-anon-key');

const { getAuthContext, getAuthContextSync } = await import('../lib/authContext.js');
const {
  getUserKey: getClientIdentity,
  uploadFileToStorage,
} = await import('../lib/supabase.js');
const { saveAsset } = await import('../lib/assetLibrary.js');
const {
  getUserKey: getHybridIdentity,
  hybridSupabase,
  uploadFileToStorage: hybridUploadFileToStorage,
} = await import('../lib/hybrid-supabase.js');
// The REAL offline identity helper — proves what userKey.js would return.
const { getUserKey: getOfflineUserKey } = await import('../lib/userKey.js');

function signedIn(clerkId = CLERK_ID) {
  window.Clerk = {
    loaded: true,
    user: { id: clerkId },
    session: { getToken: async () => 'clerk-session-jwt' },
  };
}

function signedOut() {
  window.Clerk = { loaded: true, user: null };
}

function makeFile(name, type, size = 2048) {
  return new File([new Uint8Array(size)], name, { type });
}

function makeOfflineMedia(id) {
  return {
    id,
    blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'video/mp4' }),
    name: 'clip.mp4',
    type: 'video/mp4',
    size: 3,
    project_id: 'proj-1',
    created_at: '2026-10-14T00:00:00Z',
  };
}

beforeEach(() => {
  shared.uploads = [];
  shared.inserts = [];
  shared.upserts = [];
  shared.rows = [];
  shared.offline.media = [];
  shared.byok.key = null;
  signedOut();
  // Hermetic token exchange: the signed-in path primes a verified JWT.
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ token: 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.sig', expires_in: 3600 }),
  }));
});

afterAll(() => {
  vi.unstubAllEnvs();
  delete window.Clerk;
});

describe('shared-DB identity — signed-in callers', () => {
  test('(a) storage path and media row carry the Clerk id', async () => {
    signedIn();

    await uploadFileToStorage(makeFile('hero.png', 'image/png'));
    const upload = shared.uploads.at(-1);
    expect(upload.path.startsWith(`smartvideo/${CLERK_ID}/`)).toBe(true);

    const ctx = await getAuthContext();
    expect(ctx.userId).toBe(CLERK_ID);
    expect(ctx.userId).toBe(await getClientIdentity());

    await saveAsset(makeFile('clip.mp4', 'video/mp4'), ctx);
    const assetUpload = shared.uploads.at(-1);
    const { table, row } = shared.inserts.at(-1);
    expect(table).toBe('media');
    // (a) row identity = Clerk id, app tag kept
    expect(row.user_id).toBe(CLERK_ID);
    expect(row.app_id).toBe('smartvideo');
    // (c) object path and row use the SAME identity — no drift
    expect(assetUpload.path.split('/')[1]).toBe(CLERK_ID);
    expect(assetUpload.path.split('/')[1]).toBe(row.user_id);
  });

  test('(c) the hybrid offline-sync writer uses the same identity for path and row', async () => {
    signedIn();

    await hybridUploadFileToStorage(makeFile('clip.mp4', 'video/mp4'));
    expect(shared.uploads.at(-1).path.startsWith(`smartvideo/${CLERK_ID}/`)).toBe(true);

    await hybridSupabase.syncMediaToRemote(makeOfflineMedia('med-1'));
    const { table, row } = shared.upserts.at(-1);
    expect(table).toBe('media');
    expect(row.user_id).toBe(CLERK_ID);
    expect(row.app_id).toBe('smartvideo');
    // media-bucket path shape kept: <ownerId>/<mediaId>_<name>
    expect(row.path.split('/')[0]).toBe(CLERK_ID);
    expect(row.path.split('/')[0]).toBe(row.user_id);
  });
});

describe('shared-DB identity — signed-out callers with a BYOK MuAPI key', () => {
  test('(b) the offline BYOK hash exists but never reaches the shared DB', async () => {
    signedOut();
    shared.byok.key = BYOK_KEY;

    // The offline identity genuinely IS the hash for this caller…
    const offlineHash = getOfflineUserKey();
    expect(offlineHash).toMatch(/^user_[0-9a-z]+$/);

    // …yet every shared-DB write uses the shared 'anonymous' owner.
    const ctx = await getAuthContext();
    expect(ctx.userId).toBe('anonymous');
    expect(ctx.hasMuapiKey).toBe(true);

    await uploadFileToStorage(makeFile('hero.png', 'image/png'));
    const upload = shared.uploads.at(-1);
    expect(upload.path.startsWith('smartvideo/anonymous/')).toBe(true);
    expect(upload.path).not.toContain(offlineHash);

    await saveAsset(makeFile('clip.mp4', 'video/mp4'), ctx);
    const assetUpload = shared.uploads.at(-1);
    const { row } = shared.inserts.at(-1);
    expect(assetUpload.path.startsWith('smartvideo/anonymous/')).toBe(true);
    expect(assetUpload.path).not.toContain(offlineHash);
    expect(row.user_id).toBe('anonymous');
    expect(row.user_id).not.toBe(offlineHash);
    expect(row.app_id).toBe('smartvideo');
    // (c) object path and row still agree on the SAME identity
    expect(assetUpload.path.split('/')[1]).toBe('anonymous');
    expect(assetUpload.path.split('/')[1]).toBe(row.user_id);
  });

  test('(b) the hybrid offline-sync writer also writes anonymous, never the hash', async () => {
    signedOut();
    shared.byok.key = BYOK_KEY;

    const offlineHash = getOfflineUserKey();
    expect(offlineHash).toMatch(/^user_[0-9a-z]+$/);

    await hybridUploadFileToStorage(makeFile('clip.mp4', 'video/mp4'));
    const upload = shared.uploads.at(-1);
    expect(upload.path.startsWith('smartvideo/anonymous/')).toBe(true);
    expect(upload.path).not.toContain(offlineHash);

    await hybridSupabase.syncMediaToRemote(makeOfflineMedia('med-2'));
    const { row } = shared.upserts.at(-1);
    expect(row.user_id).toBe('anonymous');
    expect(row.user_id).not.toBe(offlineHash);
    expect(row.app_id).toBe('smartvideo');
    expect(row.path.split('/')[0]).toBe('anonymous');
    expect(row.path.split('/')[0]).toBe(row.user_id);
  });
});

describe('shared-DB identity — consistency across writers', () => {
  test('sign-in / sign-out switch every writer to the same identity', async () => {
    signedIn();
    const ctx = getAuthContextSync();
    expect(ctx.userId).toBe(CLERK_ID);
    expect(await getClientIdentity()).toBe(ctx.userId);
    expect(await getHybridIdentity()).toBe(ctx.userId);

    signedOut();
    shared.byok.key = BYOK_KEY;
    const anonCtx = getAuthContextSync();
    expect(anonCtx.userId).toBe('anonymous');
    expect(await getClientIdentity()).toBe(anonCtx.userId);
    expect(await getHybridIdentity()).toBe(anonCtx.userId);
  });

  test('saveAsset without an auth context falls back to the shared-DB identity', async () => {
    signedOut();
    shared.byok.key = BYOK_KEY;

    await saveAsset(makeFile('clip.mp4', 'video/mp4'), null);
    const assetUpload = shared.uploads.at(-1);
    const { row } = shared.inserts.at(-1);
    expect(assetUpload.path.startsWith('smartvideo/anonymous/')).toBe(true);
    expect(row.user_id).toBe('anonymous');
    expect(assetUpload.path.split('/')[1]).toBe(row.user_id);
  });
});
