// Permanent Asset Library tests.
//
// The Asset Library is the durable home for every file referenced by a MuAPI
// studio. Two invariants matter most and are asserted here:
//   1. the `media` row stores the PERMANENT Supabase Storage URL — never a
//      MuAPI temporary URL,
//   2. reads are scoped to the caller's workspace, and another user's/workspace's
//      row is refused with ASSET_ACCESS_DENIED.

import { describe, test, expect, beforeEach, vi } from 'vitest';

// ── Supabase mock ──────────────────────────────────────────────────────────

const state = {
  rows: [],
  uploads: [],
  removes: [],
  inserts: [],
  filters: {},
  missingWorkspaceColumn: false,
};

function storageFrom() {
  return {
    upload: vi.fn(async (path, file, options) => {
      state.uploads.push({ path, file, options });
      return { data: { path }, error: null };
    }),
    remove: vi.fn(async (paths) => {
      state.removes.push(paths);
      return { data: paths, error: null };
    }),
    getPublicUrl: vi.fn((path) => ({
      data: { publicUrl: `https://storage.test.local/${path}` },
      error: null,
    })),
  };
}

function makeSelectBuilder(table) {
  const filters = {};
  const builder = {
    eq(column, value) {
      filters[column] = value;
      return builder;
    },
    order() { return builder; },
    maybeSingle: async () => {
      const row = state.rows.find((r) => r.id === filters.id) || null;
      return { data: row, error: null };
    },
    single: async () => ({ data: state.rows[0] || null, error: null }),
    then(onFulfilled, onRejected) {
      if (table === 'media' && state.missingWorkspaceColumn && 'workspace_id' in filters) {
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

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    storage: { from: () => storageFrom() },
    from: (table) => {
      if (table === 'media') {
        const record = (filters) => { state.filters = { ...state.filters, ...filters }; };
        const selectBuilder = () => {
          const builder = makeSelectBuilder('media');
          const originalEq = builder.eq.bind(builder);
          builder.eq = (column, value) => { record({ [column]: value }); return originalEq(column, value); };
          return builder;
        };
        return {
          select: () => selectBuilder(),
          insert: (row) => ({
            select: () => ({
              single: async () => {
                state.inserts.push(row);
                state.rows.push(row);
                return { data: row, error: null };
              },
            }),
          }),
          delete: () => ({
            eq: async (column, value) => {
              state.rows = state.rows.filter((r) => String(r[column]) !== String(value));
              return { data: null, error: null };
            },
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  },
  isSupabaseConfigured: () => true,
  getUserKey: vi.fn(async () => 'user-a'),
  getClerkUserId: () => null,
  assertVerifiedWriteIdentity: vi.fn(async () => undefined),
}));

const {
  saveAsset,
  listAssets,
  getAsset,
  resolvePermanentMediaReference,
  deleteAsset,
  findDuplicateAsset,
  downloadAssetBytes,  resetAssetCache,
} = await import('../lib/assetLibrary.js');

const AUTH = { userId: 'user-a', workspaceId: 'ws-1', muapiKey: 'key' };
const OTHER_AUTH = { userId: 'user-b', workspaceId: 'ws-2', muapiKey: 'key' };

// Every test starts with an empty storage-removal record (deleteAsset tests
// assert on it, so it must not leak across tests).
beforeEach(() => {
  state.removes = [];
});

function makeFile(name, type, size = 2048) {
  return new File([new Uint8Array(size)], name, { type });
}

describe('Asset Library — saveAsset', () => {
  beforeEach(() => {
    state.rows = [];
    state.uploads = [];
    state.inserts = [];
    state.filters = {};
    state.missingWorkspaceColumn = false;
  });

  test('uploads to the uploads bucket with a user-scoped path and inserts a permanent media row', async () => {
    const asset = await saveAsset(makeFile('hero.png', 'image/png'), AUTH, { projectId: 'proj-9' });

    expect(state.uploads).toHaveLength(1);
    // Application-tagged path: the app tag scopes the shared `uploads` bucket
    // (see supabase/migrations/20261014120000_smartvideo_media_rls_tagged.sql).
    expect(state.uploads[0].path.startsWith('smartvideo/user-a/')).toBe(true);
    expect(state.uploads[0].path).toMatch(/hero\.png$/);

    expect(state.inserts).toHaveLength(1);
    const row = state.inserts[0];
    expect(row.user_id).toBe('user-a');
    expect(row.workspace_id).toBe('ws-1');
    expect(row.app_id).toBe('smartvideo');
    expect(row.project_id).toBe('proj-9');
    expect(row.type).toBe('image/png');
    expect(row.size).toBe(2048);
    expect(row.path).toBe(state.uploads[0].path);

    // Permanent storage URL only — never a MuAPI temporary URL.
    expect(row.url).toBe(`https://storage.test.local/${state.uploads[0].path}`);
    expect(row.url).not.toMatch(/muapi\.ai/i);

    expect(asset.url).toBe(row.url);
    expect(asset.url).not.toMatch(/muapi\.ai/i);
    expect(asset.id).toBe(row.id);
    expect(asset.userId).toBe('user-a');
    expect(asset.workspaceId).toBe('ws-1');
    expect(asset.path).toBe(row.path);
  });

  test('defaults project_id to an empty string when no project is supplied', async () => {
    await saveAsset(makeFile('clip.mp4', 'video/mp4'), AUTH);
    expect(state.inserts[0].project_id).toBe('');
  });

  test('still persists the permanent URL when the workspace column is missing', async () => {
    state.missingWorkspaceColumn = true;
    const asset = await saveAsset(makeFile('legacy.png', 'image/png'), AUTH);
    expect(asset.url).not.toMatch(/muapi\.ai/i);
    expect(asset.url).toMatch(/^https:\/\//);
  });
});

describe('Asset Library — listAssets / getAsset', () => {
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
    state.missingWorkspaceColumn = false;
  });

  test('scopes the select to the caller user + workspace', async () => {
    const assets = await listAssets(AUTH);
    expect(assets.map((a) => a.id)).toEqual(['asset-1']);
    expect(state.filters.user_id).toBe('user-a');
    expect(state.filters.workspace_id).toBe('ws-1');
  });

  test('filters by type category and by MIME type', async () => {
    const byCategory = await listAssets(AUTH, { type: 'image' });
    expect(byCategory.map((a) => a.id)).toEqual(['asset-1']);
    const byMime = await listAssets(AUTH, { type: 'image/png' });
    expect(byMime.map((a) => a.id)).toEqual(['asset-1']);
    const none = await listAssets(AUTH, { type: 'video' });
    expect(none).toEqual([]);
  });

  test('returns own assets', async () => {
    const asset = await getAsset('asset-1', AUTH);
    expect(asset.id).toBe('asset-1');
    expect(asset.url).toBe('https://storage.test.local/user-a/a.png');
  });

  test('throws ASSET_ACCESS_DENIED for another user row', async () => {
    await expect(getAsset('asset-3', AUTH)).rejects.toMatchObject({ code: 'ASSET_ACCESS_DENIED' });
  });

  test('throws ASSET_ACCESS_DENIED for another workspace row', async () => {
    await expect(getAsset('asset-2', AUTH)).rejects.toMatchObject({ code: 'ASSET_ACCESS_DENIED' });
  });

  test('throws ASSET_NOT_FOUND for unknown ids', async () => {
    await expect(getAsset('nope', AUTH)).rejects.toMatchObject({ code: 'ASSET_NOT_FOUND' });
  });

  test('deletes only own rows', async () => {
    await deleteAsset('asset-1', AUTH);
    expect(state.rows.map((r) => r.id)).toEqual(['asset-2', 'asset-3']);
    await expect(deleteAsset('asset-3', AUTH)).rejects.toMatchObject({ code: 'ASSET_ACCESS_DENIED' });
  });

  test('delete removes the stored object, not just the row', async () => {
    await deleteAsset('asset-1', AUTH);
    expect(state.removes).toEqual([['user-a/a.png']]);
    expect(state.rows.map((r) => r.id)).not.toContain('asset-1');
  });

  test('a denied delete never removes another owner\'s stored object', async () => {
    await expect(deleteAsset('asset-3', AUTH)).rejects.toMatchObject({ code: 'ASSET_ACCESS_DENIED' });
    expect(state.removes).toEqual([]);
  });
});

describe('Asset Library — resolvePermanentMediaReference', () => {
  beforeEach(() => {
    state.rows = [{
      id: 'asset-1', user_id: 'user-a', workspace_id: 'ws-1', project_id: '',
      name: 'a.png', type: 'image/png', size: 4096, path: 'user-a/a.png',
      url: 'https://storage.test.local/user-a/a.png', created_at: '2026-01-01T00:00:00Z',
    }];
    state.missingWorkspaceColumn = false;
  });

  test('returns permanent fields only (no MuAPI URL)', async () => {
    const ref = await resolvePermanentMediaReference('asset-1', AUTH);
    expect(ref).toEqual({
      url: 'https://storage.test.local/user-a/a.png',
      path: 'user-a/a.png',
      name: 'a.png',
      mime: 'image/png',
      category: 'image',
      sizeBytes: 4096,
    });
    expect(ref.url).not.toMatch(/muapi\.ai/i);
  });

  test('applies the same access check as getAsset', async () => {
    await expect(resolvePermanentMediaReference('asset-1', OTHER_AUTH))
      .rejects.toMatchObject({ code: 'ASSET_ACCESS_DENIED' });
  });
});

describe('Asset Library — findDuplicateAsset', () => {
  beforeEach(() => {
    state.rows = [{
      id: 'asset-1', user_id: 'user-a', workspace_id: 'ws-1', project_id: '',
      name: 'hero.png', type: 'image/png', size: 2048, path: 'user-a/hero.png',
      url: 'https://storage.test.local/user-a/hero.png', created_at: '2026-01-01T00:00:00Z',
    }];
    state.missingWorkspaceColumn = false;
    resetAssetCache();
  });

  test('finds an existing asset by name + size after the cache is warmed', async () => {
    await listAssets(AUTH);
    const duplicate = findDuplicateAsset(AUTH, { name: 'hero.png', size: 2048, type: 'image/png' });
    expect(duplicate?.id).toBe('asset-1');
    const other = findDuplicateAsset(AUTH, { name: 'hero.png', size: 999, type: 'image/png' });
    expect(other).toBeNull();
  });

  test('returns null when the cache has not been warmed', async () => {
    expect(findDuplicateAsset(AUTH, { name: 'hero.png', size: 2048, type: 'image/png' })).toBeNull();
  });
});

describe('Asset Library — downloadAssetBytes', () => {
  beforeEach(() => {
    state.rows = [];
    state.missingWorkspaceColumn = false;
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
    }));
  });

  test('fetches the permanent URL into a File', async () => {
    const file = await downloadAssetBytes({
      url: 'https://storage.test.local/user-a/hero.png',
      name: 'hero.png',
      mime: 'image/png',
    });
    expect(globalThis.fetch).toHaveBeenCalledWith('https://storage.test.local/user-a/hero.png');
    expect(file.name).toBe('hero.png');
    expect(file.type).toBe('image/png');
    expect(file.size).toBe(3);
  });

  test('refuses MuAPI temporary URLs (permanent references only)', async () => {
    await expect(downloadAssetBytes({ url: 'https://api.muapi.ai/tmp/abc' }))
      .rejects.toMatchObject({ code: 'ASSET_URL_TEMPORARY' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test('surfaces a clear error when the permanent URL cannot be fetched', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 404 }));
    await expect(downloadAssetBytes('https://storage.test.local/missing.png'))
      .rejects.toMatchObject({ code: 'ASSET_DOWNLOAD_FAILED' });
  });
});
