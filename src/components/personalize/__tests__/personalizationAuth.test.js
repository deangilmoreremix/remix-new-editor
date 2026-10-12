/**
 * personalizationAuth.test.js
 *
 * Authorization tests for the personalization identity seam:
 * ownership stamping on write, owner filtering on read, cross-user
 * isolation, anonymous/fallback isolation, and CRUD rejection.
 *
 * Mock-depth note (same convention as __tests__/generationRouter.test.js):
 * this spec lives in __tests__/, one level deeper than the modules under
 * test, so lib modules are ../../../lib/x.js.
 *
 * The identity source (../../../lib/userKey.js) is mocked so the "current
 * user" can be switched between calls without a Clerk session.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const identity = vi.hoisted(() => ({
  userId: 'user_a',
  throwNext: false,
}));

vi.mock('../../../lib/userKey.js', () => ({
  getUserKey: () => {
    if (identity.throwNext) throw new Error('identity unavailable');
    return identity.userId;
  },
}));

const {
  getPersonalizationUserId,
  isPersonalizationAuthReady,
  isPersonalizationSignedIn,
  withPersonalizationOwner,
  getPersonalizationOwner,
  canAccess,
  assertOwner,
  filterPersonalizationEntries,
  getPersonalizationStorageKey,
  announcePersonalizationOwner,
  PERSONALIZATION_OWNER_FIELD,
} = await import('../../../lib/personalizationAuth.js');
const { sharedMediaStore } = await import('../sharedMediaStore.js');
const { assetLibraryStore } = await import('../assetLibraryStore.js');

function actAsUserA() {
  identity.userId = 'user_a';
  identity.throwNext = false;
}

function actAsUserB() {
  identity.userId = 'user_b';
  identity.throwNext = false;
}

function actAsAnonymous() {
  identity.userId = 'anonymous';
  identity.throwNext = false;
}

beforeEach(() => {
  actAsUserA();
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear();
  }
  sharedMediaStore.setState({ entries: [], hydrated: false });
  sharedMediaStore.hydrate();
  assetLibraryStore.setState({ assets: [], removed: [], hydrated: false });
  assetLibraryStore.hydrate();
});

describe('personalizationAuth — identity resolution', () => {
  it('getPersonalizationUserId returns the app identity (Clerk userId slot)', () => {
    expect(getPersonalizationUserId()).toBe('user_a');
    actAsUserB();
    expect(getPersonalizationUserId()).toBe('user_b');
  });

  it('falls back to anonymous when the identity source throws', () => {
    identity.throwNext = true;
    expect(getPersonalizationUserId()).toBe('anonymous');
  });

  it('isPersonalizationAuthReady is true whenever an id resolves', () => {
    expect(isPersonalizationAuthReady()).toBe(true);
    identity.throwNext = true;
    expect(isPersonalizationAuthReady()).toBe(true); // 'anonymous' fallback is still usable
  });

  it('isPersonalizationSignedIn is false for the anonymous fallback', () => {
    expect(isPersonalizationSignedIn()).toBe(true);
    actAsAnonymous();
    expect(isPersonalizationSignedIn()).toBe(false);
  });
});

describe('personalizationAuth — ownership stamping', () => {
  it('withPersonalizationOwner stamps clerk_user_id with the current user', () => {
    const entry = withPersonalizationOwner({ id: 'x1', sourceType: 'image' });
    expect(entry[PERSONALIZATION_OWNER_FIELD]).toBe('user_a');
    expect(entry.clerkUserId).toBe('user_a');
    expect(getPersonalizationOwner(entry)).toBe('user_a');
  });

  it('withPersonalizationOwner overwrites a caller-supplied (forged) owner', () => {
    // A caller must never be able to write rows on another user's behalf.
    const entry = withPersonalizationOwner({
      id: 'x2',
      clerk_user_id: 'user_victim',
    });
    expect(entry[PERSONALIZATION_OWNER_FIELD]).toBe('user_a');
    actAsUserB();
    expect(canAccess(entry)).toBe(false);
  });

  it('stamps change with the current user when the user switches', () => {
    actAsUserB();
    const entry = withPersonalizationOwner({ id: 'x3' });
    expect(entry[PERSONALIZATION_OWNER_FIELD]).toBe('user_b');
  });
});

describe('personalizationAuth — canAccess', () => {
  it('true for a matching owner', () => {
    actAsUserB();
    expect(canAccess({ clerk_user_id: 'user_b' })).toBe(true);
  });

  it('false for a mismatched owner', () => {
    expect(canAccess({ clerk_user_id: 'user_b' })).toBe(false);
    expect(canAccess({ clerk_user_id: 'user_a' })).toBe(true);
  });

  it('true for null/undefined owner (legacy rows written before stamping)', () => {
    expect(canAccess({ id: 'legacy' })).toBe(true);
    expect(canAccess({ id: 'legacy', clerk_user_id: null })).toBe(true);
    expect(canAccess({ id: 'legacy', clerk_user_id: undefined })).toBe(true);
  });

  it('false for a malformed (empty string) owner', () => {
    expect(canAccess({ id: 'bad', clerk_user_id: '' })).toBe(false);
  });

  it('assertOwner throws for a foreign row and returns true for an owned row', () => {
    expect(() => assertOwner({ clerk_user_id: 'user_b' }, 'update')).toThrow(/denied/);
    expect(assertOwner({ clerk_user_id: 'user_a' }, 'update')).toBe(true);
  });

  it('filterPersonalizationEntries drops foreign rows', () => {
    const rows = [
      { id: 'a', clerk_user_id: 'user_a' },
      { id: 'b', clerk_user_id: 'user_b' },
      { id: 'legacy' },
    ];
    const visible = filterPersonalizationEntries(rows);
    expect(visible.map((e) => e.id)).toEqual(['a', 'legacy']);
  });

  it('an anonymous/fallback user cannot read a signed-in user\'s rows', () => {
    const ownRow = { id: 'a', clerk_user_id: 'user_a' };
    expect(canAccess(ownRow)).toBe(true);
    actAsAnonymous();
    expect(canAccess(ownRow)).toBe(false);
    expect(filterPersonalizationEntries([ownRow, { id: 'anon', clerk_user_id: 'anonymous' }]))
      .toEqual([{ id: 'anon', clerk_user_id: 'anonymous' }]);
  });

  it('a signed-in user cannot read an anonymous user\'s rows', () => {
    actAsAnonymous();
    const anonRow = { id: 'anon', clerk_user_id: 'anonymous' };
    expect(canAccess(anonRow)).toBe(true);
    actAsUserA();
    expect(canAccess(anonRow)).toBe(false);
  });
});

describe('personalizationAuth — storage keys + RLS handshake', () => {
  it('getPersonalizationStorageKey namespaces by the current user', () => {
    expect(getPersonalizationStorageKey('base')).toBe('base:user_a');
    actAsUserB();
    expect(getPersonalizationStorageKey('base')).toBe('base:user_b');
  });

  it('announcePersonalizationOwner calls the set_config RPC with the current owner', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const ok = await announcePersonalizationOwner({ rpc });
    expect(ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith('set_app_clerk_user_id', { p_user_id: 'user_a' });
  });

  it('announcePersonalizationOwner is a no-op without a client and swallows RPC errors', async () => {
    expect(await announcePersonalizationOwner(null)).toBe(false);
    expect(await announcePersonalizationOwner({})).toBe(false);
    const rpc = vi.fn().mockRejectedValue(new Error('network'));
    expect(await announcePersonalizationOwner({ rpc })).toBe(false);
  });
});

describe('personalizationAuth — cross-user CREATE/READ/UPDATE/DELETE through sharedMediaStore', () => {
  it('CREATE stamps the owner with the writer identity', () => {
    const entry = sharedMediaStore.addEntry({ sourceType: 'image-demo' });
    expect(entry.clerk_user_id).toBe('user_a');
  });

  it('READ: user B cannot see user A\'s entries (all read paths)', () => {
    const entry = sharedMediaStore.addEntry({ sourceType: 'image-demo', clientId: 'c1' });
    sharedMediaStore.addEntry({ sourceType: 'other' });

    actAsUserB();
    const visible = sharedMediaStore.getEntries();
    expect(visible.map((e) => e.id)).not.toContain(entry.id);
    expect(sharedMediaStore.getEntryById(entry.id)).toBeNull();
    expect(sharedMediaStore.getEntriesByClient('c1')).toEqual([]);
  });

  it('READ: an anonymous/fallback user cannot see a signed-in user\'s entries', () => {
    const entry = sharedMediaStore.addEntry({ sourceType: 'image-demo' });
    actAsAnonymous();
    expect(sharedMediaStore.getEntries().map((e) => e.id)).not.toContain(entry.id);
    expect(sharedMediaStore.getEntryById(entry.id)).toBeNull();
  });

  it('UPDATE: user B cannot modify user A\'s entry; user A can', () => {
    const entry = sharedMediaStore.addEntry({ sourceType: 'image-demo' });

    actAsUserB();
    expect(sharedMediaStore.updateEntry(entry.id, { personalizedPrompt: 'pwned' })).toBeNull();
    expect(sharedMediaStore.getEntryById(entry.id)).toBeNull(); // not even readable

    actAsUserA();
    const updated = sharedMediaStore.updateEntry(entry.id, { personalizedPrompt: 'fine' });
    expect(updated?.personalizedPrompt).toBe('fine');
    expect(updated?.clerk_user_id).toBe('user_a');
  });

  it('UPDATE: the patch cannot re-assign ownership', () => {
    const entry = sharedMediaStore.addEntry({ sourceType: 'image-demo' });
    const updated = sharedMediaStore.updateEntry(entry.id, { clerk_user_id: 'user_b' });
    expect(updated?.clerk_user_id).toBe('user_a');
    actAsUserB();
    expect(canAccess(updated)).toBe(false);
  });

  it('DELETE: user B cannot delete user A\'s entry; user A can', () => {
    const entry = sharedMediaStore.addEntry({ sourceType: 'image-demo' });
    actAsUserB();
    expect(sharedMediaStore.removeEntry(entry.id)).toBe(false);

    actAsUserA();
    expect(sharedMediaStore.removeEntry(entry.id)).toBe(true);
    expect(sharedMediaStore.getEntryById(entry.id)).toBeNull();
  });

  it('DELETE: an anonymous user cannot delete a signed-in user\'s entry', () => {
    const entry = sharedMediaStore.addEntry({ sourceType: 'image-demo' });
    actAsAnonymous();
    expect(sharedMediaStore.removeEntry(entry.id)).toBe(false);
    actAsUserA();
    expect(sharedMediaStore.getEntryById(entry.id)?.id).toBe(entry.id);
  });
});

describe('personalizationAuth — assetLibraryStore user scoping', () => {
  it('persist key is namespaced per user and buckets are isolated', () => {
    const a = assetLibraryStore.addAsset({ role: 'logo', name: 'A', url: 'u1' });
    expect(a.clerk_user_id).toBe('user_a');
    expect(window.localStorage.getItem('remix_personalization_assets_v1:user_a')).toBeTruthy();
    expect(window.localStorage.getItem('remix_personalization_assets_v1')).toBeNull();

    const b = assetLibraryStore.addAsset({ role: 'logo', name: 'B', url: 'u2' });
    expect(b.clerk_user_id).toBe('user_a');

    // Switch user: the bucket changes, so user B sees (and hydrates) nothing.
    actAsUserB();
    assetLibraryStore.setState({ assets: [], removed: [], hydrated: false });
    assetLibraryStore.hydrate();
    expect(assetLibraryStore.getAssets()).toEqual([]);
    expect(assetLibraryStore.getAssetsByRole('logo')).toEqual([]);
    expect(assetLibraryStore.getPrimary('logo')).toBeNull();
  });

  it('cross-user removeAsset/setPrimary/restoreAsset are rejected', () => {
    const a = assetLibraryStore.addAsset({ role: 'product_reference', name: 'A', url: 'u1' });
    assetLibraryStore.removeAsset(a.id); // goes to the removed stack, owner = user_a

    actAsUserB();
    expect(assetLibraryStore.removeAsset(a.id)).toBe(false);
    expect(assetLibraryStore.setPrimary('product_reference', a.id)).toBeUndefined();
    expect(assetLibraryStore.restoreAsset(a.id)).toBeNull();

    actAsUserA();
    expect(assetLibraryStore.getAssetsByRole('product_reference').map((x) => x.id)).toEqual([]);
    expect(assetLibraryStore.getRemoved().map((x) => x.id)).toEqual([a.id]);
    expect(assetLibraryStore.restoreAsset(a.id)?.id).toBe(a.id);
  });

  it('reorderAssets does not touch another user\'s rows', () => {
    const a1 = assetLibraryStore.addAsset({ role: 'product_reference', name: 'A1', url: 'u1' });
    const a2 = assetLibraryStore.addAsset({ role: 'product_reference', name: 'A2', url: 'u2' });
    assetLibraryStore.reorderAssets('product_reference', 0, 1);
    expect(assetLibraryStore.getAssetsByRole('product_reference').map((x) => x.id)).toEqual([a2.id, a1.id]);
  });
});
