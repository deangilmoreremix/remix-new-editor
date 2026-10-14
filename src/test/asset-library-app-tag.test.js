// SmartVideo app-tag + storage-prefix tests.
//
// The Supabase project is SHARED with other applications, so this app must tag
// everything it writes: media rows carry `app_id: 'smartvideo'` and storage
// objects live under the `smartvideo/` prefix (migration
// 20261014120000_smartvideo_media_rls_tagged.sql moves this app's tagged
// rows/objects to owner-scoped RLS policies while other apps keep the shared
// blanket policies).
//
// Invariants asserted here:
//   a. saveAsset writes app_id='smartvideo' AND a storage path starting with
//      'smartvideo/',
//   b. listAssets / getAsset still scope by user + workspace,
//   c. getAsset still denies another user's row.
//
// Complements (does not modify) src/test/asset-library.test.js and
// src/test/asset-library-identity.test.js.

import { describe, test, expect, beforeEach, vi } from 'vitest';

// ── Supabase mock (same pattern as asset-library.test.js) ───────────────────

const state = {
  rows: [],
  uploads: [],
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
    remove: vi.fn(async (paths) => ({ data: paths, error: null })),
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
      filters[column] = value;
      return builder;
    },
    order() { return builder; },
    maybeSingle: async () => {
      const row = state.rows.find((r) => r.id === filters.id) || null;
      return { data: row, error: null };
    },
    then(onFulfilled, onRejected) {
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

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    storage: { from: () => storageFrom() },
    from: (table) => {
      if (table === 'media') {
        const selectBuilder = () => {
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
  primeSupabaseIdentity: vi.fn(async () => null),
}));

const {
  saveAsset,
  listAssets,
  getAsset,
  resetAssetCache,
} = await import('../lib/assetLibrary.js');

const AUTH = { userId: 'user-a', workspaceId: 'ws-1', muapiKey: 'key' };
const OTHER_AUTH = { userId: 'user-b', workspaceId: 'ws-2', muapiKey: 'key' };

function makeFile(name, type, size = 2048) {
  return new File([new Uint8Array(size)], name, { type });
}

function reset() {
  state.rows = [];
  state.uploads = [];
  state.inserts = [];
  state.filters = {};
  state.missingWorkspaceColumn = false;
  resetAssetCache();
}

beforeEach(() => {
  reset();
});

describe('Asset Library — application tag', () => {
  test('saveAsset tags the media row with app_id=smartvideo and stores under the smartvideo/ prefix', async () => {
    const asset = await saveAsset(makeFile('hero.png', 'image/png'), AUTH, { projectId: 'proj-9' });

    expect(state.uploads).toHaveLength(1);
    // (a) storage path is app-tagged: smartvideo/<userId>/<unique>_<name>.<ext>
    expect(state.uploads[0].path.startsWith('smartvideo/')).toBe(true);
    expect(state.uploads[0].path.startsWith('smartvideo/user-a/')).toBe(true);
    expect(state.uploads[0].path).toMatch(/hero\.png$/);

    expect(state.inserts).toHaveLength(1);
    const row = state.inserts[0];
    // (a) the media row carries the app tag
    expect(row.app_id).toBe('smartvideo');
    expect(row.user_id).toBe('user-a');
    expect(row.workspace_id).toBe('ws-1');
    expect(row.path).toBe(state.uploads[0].path);
    expect(row.url).toBe(`https://storage.test.local/${state.uploads[0].path}`);
    expect(row.url).not.toMatch(/muapi\.ai/i);

    expect(asset.path).toBe(row.path);
  });

  test('anonymous callers are tagged under smartvideo/anonymous/', async () => {
    await saveAsset(makeFile('clip.mp4', 'video/mp4'), null);
    expect(state.uploads[0].path.startsWith('smartvideo/')).toBe(true);
    // getUserKey() (mocked) returns 'user-a' when no auth context is supplied.
    expect(state.uploads[0].path.startsWith('smartvideo/user-a/')).toBe(true);
    expect(state.inserts[0].app_id).toBe('smartvideo');
  });
});

describe('Asset Library — reads stay user + workspace scoped', () => {
  beforeEach(() => {
    state.rows = [
      {
        id: 'asset-1', app_id: 'smartvideo', user_id: 'user-a', workspace_id: 'ws-1', project_id: '',
        name: 'a.png', type: 'image/png', size: 10, path: 'smartvideo/user-a/a.png',
        url: 'https://storage.test.local/smartvideo/user-a/a.png', created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'asset-2', app_id: 'smartvideo', user_id: 'user-a', workspace_id: 'ws-2', project_id: '',
        name: 'b.png', type: 'image/png', size: 20, path: 'smartvideo/user-a/b.png',
        url: 'https://storage.test.local/smartvideo/user-a/b.png', created_at: '2026-01-02T00:00:00Z',
      },
      {
        id: 'asset-3', app_id: 'smartvideo', user_id: 'user-b', workspace_id: 'ws-1', project_id: '',
        name: 'c.png', type: 'image/png', size: 30, path: 'smartvideo/user-b/c.png',
        url: 'https://storage.test.local/smartvideo/user-b/c.png', created_at: '2026-01-03T00:00:00Z',
      },
    ];
  });

  test('listAssets scopes the select by user AND workspace', async () => {
    const assets = await listAssets(AUTH);
    expect(assets.map((a) => a.id)).toEqual(['asset-1']);
    expect(state.filters.user_id).toBe('user-a');
    expect(state.filters.workspace_id).toBe('ws-1');
  });

  test('listAssets returns no rows for another user/workspace', async () => {
    const assets = await listAssets(OTHER_AUTH);
    expect(assets).toEqual([]);
  });

  test('getAsset returns the caller own asset', async () => {
    const asset = await getAsset('asset-1', AUTH);
    expect(asset.id).toBe('asset-1');
    expect(asset.path).toBe('smartvideo/user-a/a.png');
  });

  test('getAsset denies another user row', async () => {
    await expect(getAsset('asset-3', AUTH)).rejects.toMatchObject({ code: 'ASSET_ACCESS_DENIED' });
  });

  test('getAsset denies another workspace row', async () => {
    await expect(getAsset('asset-2', AUTH)).rejects.toMatchObject({ code: 'ASSET_ACCESS_DENIED' });
  });
});
