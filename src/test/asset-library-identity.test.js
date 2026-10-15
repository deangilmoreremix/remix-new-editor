// Asset Library identity + workspace isolation (blockers B/C, second half).
//
// Complements src/test/asset-library.test.js (which owns the core save/read
// behaviour) with the security-focused invariants:
//   1. the verified identity is primed BEFORE any storage or DB operation,
//   2. reads are always scoped by user AND workspace; the degrade path
//      (missing workspace_id column → 42703/PGRST204) re-scopes by user only
//      and can never surface another user's rows,
//   3. ASSET_ACCESS_DENIED is raised before ANY storage operation — the
//      delete-storage-object path included,
//   4. the caller identity falls back to the shared user key (Clerk-aware!)
//      instead of silently writing 'anonymous' rows for a signed-in user.

import { describe, test, expect, beforeEach, vi } from 'vitest';

const state = {
  rows: [],
  uploads: [],
  removes: [],
  inserts: [],
  filters: {},
  sequence: [],
  missingWorkspaceColumn: false,
};

function storageFrom() {
  return {
    upload: vi.fn(async (path, file, options) => {
      state.sequence.push('storage.upload');
      state.uploads.push({ path, file, options });
      return { data: { path }, error: null };
    }),
    remove: vi.fn(async (paths) => {
      state.sequence.push('storage.remove');
      state.removes.push(paths);
      return { data: paths, error: null };
    }),
    getPublicUrl: vi.fn((path) => ({
      data: { publicUrl: `https://storage.test.local/${path}` },
      error: null,
    })),
  };
}

function makeSelectBuilder() {
  const filters = {};
  const builder = {
    eq(column, value) {
      state.sequence.push(`select.eq:${column}`);
      filters[column] = value;
      return builder;
    },
    order() { return builder; },
    maybeSingle: async () => {
      state.sequence.push('select.maybeSingle');
      const row = state.rows.find((r) => r.id === filters.id) || null;
      return { data: row, error: null };
    },
    then(onFulfilled, onRejected) {
      state.sequence.push('select.exec');
      if (state.missingWorkspaceColumn && 'workspace_id' in filters) {
        return Promise.resolve({
          data: null,
          error: { code: '42703', message: 'column media.workspace_id does not exist' },
        }).then(onFulfilled, onRejected);
      }
      let rows = state.rows.slice();
      Object.entries(filters).forEach(([column, value]) => {
        rows = rows.filter((r) => String(r[column]) === String(value));
      });
      return Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

const primeSupabaseIdentity = vi.fn(async () => {
  state.sequence.push('primeSupabaseIdentity');
  return null;
});

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    storage: { from: () => storageFrom() },
    from: () => {
      const selectBuilder = () => {
        // Each `.select()` is a fresh query (real PostgREST semantics), so the
        // recorded filters describe the LAST query issued — a degrade retry
        // therefore shows only the filters it actually sent.
        state.filters = {};
        const builder = makeSelectBuilder();
        const originalEq = builder.eq.bind(builder);
        builder.eq = (column, value) => {
          state.filters = { ...state.filters, [column]: value };
          return originalEq(column, value);
        };
        return builder;
      };
      return {
        select: () => selectBuilder(),
        insert: (row) => ({
          select: () => ({
            single: async () => {
              state.sequence.push('insert.execute');
              state.inserts.push(row);
              state.rows.push(row);
              return { data: row, error: null };
            },
          }),
        }),
        delete: () => ({
          eq: async (column, value) => {
            state.sequence.push('delete.execute');
            state.rows = state.rows.filter((r) => String(r[column]) !== String(value));
            return { data: null, error: null };
          },
        }),
      };
    },
  },
  isSupabaseConfigured: () => true,
  getUserKey: vi.fn(async () => 'user-shared-key'),
  getClerkUserId: () => null,
  assertVerifiedWriteIdentity: vi.fn(async () => undefined),
  primeSupabaseIdentity,
}));

const {
  saveAsset,
  listAssets,
  getAsset,
  deleteAsset,
  resetAssetCache,
} = await import('../lib/assetLibrary.js');

const AUTH = { userId: 'user-a', workspaceId: 'ws-1', muapiKey: 'key' };
const OTHER_AUTH = { userId: 'user-b', workspaceId: 'ws-2', muapiKey: 'key' };

function reset() {
  state.rows = [];
  state.uploads = [];
  state.removes = [];
  state.inserts = [];
  state.filters = {};
  state.sequence = [];
  state.missingWorkspaceColumn = false;
  resetAssetCache();
}

function makeFile(name, type, size = 2048) {
  return new File([new Uint8Array(size)], name, { type });
}

beforeEach(() => {
  reset();
  primeSupabaseIdentity.mockClear();
});

describe('verified identity is primed before any storage/DB work', () => {
  test('saveAsset primes identity before the storage upload', async () => {
    await saveAsset(makeFile('hero.png', 'image/png'), AUTH);

    expect(primeSupabaseIdentity).toHaveBeenCalled();
    const primedAt = state.sequence.indexOf('primeSupabaseIdentity');
    const uploadedAt = state.sequence.indexOf('storage.upload');
    expect(primedAt).toBeGreaterThanOrEqual(0);
    expect(uploadedAt).toBeGreaterThan(primedAt);
    // The authenticated bearer (verified sub) is attached through the same
    // call, so the RLS policies never depend on the header alone. The path
    // is app-tagged: smartvideo/<userId>/... (shared uploads bucket).
    expect(state.uploads[0].path.startsWith('smartvideo/user-a/')).toBe(true);
  });

  test('listAssets / getAsset / deleteAsset prime identity too', async () => {
    state.rows = [{
      id: 'asset-1', user_id: 'user-a', workspace_id: 'ws-1', project_id: '',
      name: 'a.png', type: 'image/png', size: 10, path: 'user-a/a.png',
      url: 'https://storage.test.local/user-a/a.png', created_at: '2026-01-01T00:00:00Z',
    }];

    await listAssets(AUTH);
    expect(state.sequence).toContain('primeSupabaseIdentity');

    state.sequence = [];
    await getAsset('asset-1', AUTH);
    expect(state.sequence[0]).toBe('primeSupabaseIdentity');

    state.sequence = [];
    await deleteAsset('asset-1', AUTH);
    expect(state.sequence[0]).toBe('primeSupabaseIdentity');
  });

  test('falls back to the shared user key when no auth context is supplied', async () => {
    const asset = await saveAsset(makeFile('hero.png', 'image/png'), null);
    expect(state.inserts[0].user_id).toBe('user-shared-key');
    expect(state.inserts[0].workspace_id).toBe('personal');
    expect(asset.userId).toBe('user-shared-key');
  });
});

describe('workspace-scoped reads and the degrade path', () => {
  beforeEach(() => {
    state.rows = [
      {
        id: 'asset-1', user_id: 'user-a', workspace_id: 'ws-1', project_id: '',
        name: 'a.png', type: 'image/png', size: 10, path: 'user-a/a.png',
        url: 'https://storage.test.local/user-a/a.png', created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'asset-2', user_id: 'user-a', workspace_id: 'ws-2', project_id: '',
        name: 'b.png', type: 'image/png', size: 20, path: 'user-a/b.png',
        url: 'https://storage.test.local/user-a/b.png', created_at: '2026-01-02T00:00:00Z',
      },
      {
        id: 'asset-3', user_id: 'user-b', workspace_id: 'ws-1', project_id: '',
        name: 'c.png', type: 'image/png', size: 30, path: 'user-b/c.png',
        url: 'https://storage.test.local/user-b/c.png', created_at: '2026-01-03T00:00:00Z',
      },
    ];
  });

  test('scopes the query by user AND workspace', async () => {
    const assets = await listAssets(AUTH);
    expect(assets.map((a) => a.id)).toEqual(['asset-1']);
    expect(state.filters.user_id).toBe('user-a');
    expect(state.filters.workspace_id).toBe('ws-1');
  });

  test('missing workspace column degrades to a user-scoped select only', async () => {
    state.missingWorkspaceColumn = true;
    const assets = await listAssets(AUTH);
    // User-scoped only: own rows (any workspace) but never another user's.
    expect(assets.map((a) => a.id)).toEqual(['asset-1', 'asset-2']);
    expect(state.filters.user_id).toBe('user-a');
    expect(state.filters.workspace_id).toBeUndefined();
  });

  test('ASSET_ACCESS_DENIED for another workspace row before any storage op', async () => {
    await expect(getAsset('asset-2', AUTH)).rejects.toMatchObject({ code: 'ASSET_ACCESS_DENIED' });
    expect(state.uploads).toHaveLength(0);
    expect(state.removes).toHaveLength(0);
    expect(state.sequence.filter((s) => s.startsWith('storage.'))).toHaveLength(0);
  });

  test('a denied delete never touches another owner\'s stored object', async () => {
    await expect(deleteAsset('asset-3', OTHER_AUTH)).rejects.toMatchObject({ code: 'ASSET_ACCESS_DENIED' });
    expect(state.removes).toEqual([]);
    expect(state.rows.map((r) => r.id)).toEqual(['asset-1', 'asset-2', 'asset-3']);
  });

  test('an allowed delete removes the object then the row', async () => {
    await deleteAsset('asset-1', AUTH);
    expect(state.removes).toEqual([['user-a/a.png']]);
    expect(state.rows.map((r) => r.id)).toEqual(['asset-2', 'asset-3']);
  });
});
