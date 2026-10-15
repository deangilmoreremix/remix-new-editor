// Asset Library IDOR guard — caller-supplied identity must match the verified
// Clerk identity (fail-closed).
//
// Regression for the bug where `resolveIdentity` trusted `authContext.userId`
// verbatim: a spoofed id (e.g. another user's Clerk id) redirected the storage
// path AND the media row to that victim identity. The fix re-reads the verified
// Clerk identity from the singleton (getClerkUserId) and refuses a contradicting
// claim before any storage/DB write.
//
// Covering both directions matters:
//   - a claimed id that matches the verified session is allowed (and is what
//     gets written), so legitimate signed-in saves keep working;
//   - a claimed id that contradicts the verified session is rejected and
//     nothing is uploaded or inserted;
//   - when there is NO verified Clerk session (signed out / no Clerk), there is
//     nothing to contradict, so the legacy path is preserved (durable saves are
//     still refused downstream for the anonymous owner).

import { describe, test, expect, beforeEach, vi } from 'vitest';

const state = {
  rows: [],
  uploads: [],
  inserts: [],
};

// The "verified" Clerk identity the module under test re-reads. Mutable so a
// single suite can simulate signed-in (a real id) and signed-out (null).
const clerk = vi.hoisted(() => ({ value: null }));

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: vi.fn(async (path, file, options) => {
          state.uploads.push({ path, file, options });
          return { data: { path }, error: null };
        }),
        remove: vi.fn(async (paths) => ({ data: paths, error: null })),
        getPublicUrl: vi.fn((path) => ({
          data: { publicUrl: `https://storage.test.local/${path}` },
          error: null,
        })),
      }),
    },
    from: () => ({
      select: () => {
        const filters = {};
        const builder = {
          eq(column, value) { filters[column] = value; return builder; },
          order() { return builder; },
          maybeSingle: async () => ({
            data: state.rows.find((r) => r.id === filters.id) || null,
            error: null,
          }),
          then(onFulfilled, onRejected) {
            let rows = state.rows.slice();
            Object.entries(filters).forEach(([column, value]) => {
              rows = rows.filter((r) => String(r[column]) === String(value));
            });
            return Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected);
          },
        };
        return builder;
      },
      insert: (row) => ({
        select: () => ({
          single: async () => {
            state.inserts.push(row);
            state.rows.push(row);
            return { data: row, error: null };
          },
        }),
      }),
      delete: () => ({ eq: async () => ({ data: null, error: null }) }),
    }),
  },
  isSupabaseConfigured: () => true,
  getUserKey: vi.fn(async () => 'anonymous'),
  // The verified identity source under test — reads "Clerk", never authContext.
  getClerkUserId: () => clerk.value,
  primeSupabaseIdentity: vi.fn(async () => null),
  assertVerifiedWriteIdentity: vi.fn(async () => undefined),
}));

const { saveAsset, listAssets, getAsset, resetAssetCache } = await import('../lib/assetLibrary.js');

function makeFile(name, type, size = 2048) {
  return new File([new Uint8Array(size)], name, { type });
}

beforeEach(() => {
  state.rows = [];
  state.uploads = [];
  state.inserts = [];
  clerk.value = null;
  resetAssetCache();
});

describe('resolveIdentity — verified-identity cross-check', () => {
  test('allows a claim that matches the verified Clerk identity and writes under it', async () => {
    clerk.value = 'user-verified';
    const asset = await saveAsset(makeFile('hero.png', 'image/png'), { userId: 'user-verified', workspaceId: 'ws-1' });

    expect(state.uploads).toHaveLength(1);
    expect(state.uploads[0].path.startsWith('smartvideo/user-verified/')).toBe(true);
    expect(state.inserts).toHaveLength(1);
    expect(state.inserts[0].user_id).toBe('user-verified');
    expect(asset.userId).toBe('user-verified');
  });

  test('rejects a spoofed claim that contradicts the verified identity — nothing is written', async () => {
    clerk.value = 'user-verified';
    await expect(
      saveAsset(makeFile('stolen.png', 'image/png'), { userId: 'user-victim', workspaceId: 'ws-1' }),
    ).rejects.toMatchObject({ code: 'ASSET_IDENTITY_MISMATCH' });

    // The spoofed identity never reached storage or the media row.
    expect(state.uploads).toHaveLength(0);
    expect(state.inserts).toHaveLength(0);
  });

  test('rejects a mismatched claim on reads as well (listAssets / getAsset)', async () => {
    clerk.value = 'user-verified';
    state.rows = [{
      id: 'asset-1', user_id: 'user-victim', workspace_id: 'ws-1', project_id: '',
      name: 'a.png', type: 'image/png', size: 10, path: 'smartvideo/user-victim/a.png',
      url: 'https://storage.test.local/smartvideo/user-victim/a.png', created_at: '2026-01-01T00:00:00Z',
    }];

    await expect(listAssets({ userId: 'user-victim', workspaceId: 'ws-1' }))
      .rejects.toMatchObject({ code: 'ASSET_IDENTITY_MISMATCH' });
    await expect(getAsset('asset-1', { userId: 'user-victim', workspaceId: 'ws-1' }))
      .rejects.toMatchObject({ code: 'ASSET_IDENTITY_MISMATCH' });
  });

  test('with no verified Clerk session the claimed id is accepted (legacy path preserved)', async () => {
    clerk.value = null;
    const asset = await saveAsset(makeFile('local.png', 'image/png'), { userId: 'user-local', workspaceId: 'ws-1' });

    expect(state.inserts[0].user_id).toBe('user-local');
    expect(asset.userId).toBe('user-local');
  });

  test('falls back to the client identity when no claim is supplied', async () => {
    clerk.value = null;
    await expect(saveAsset(makeFile('clip.mp4', 'video/mp4'), null))
      .rejects.toMatchObject({ code: 'ASSET_SIGN_IN_REQUIRED' });
    expect(state.uploads).toHaveLength(0);
    expect(state.inserts).toHaveLength(0);
  });
});
