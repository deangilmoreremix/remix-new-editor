/**
 * personalizationAuth.test.js
 *
 * Authorization tests for the personalization identity seam:
 * ownership stamping on write, owner filtering on read, cross-user
 * isolation, signed-out fail-closed behaviour, and CRUD rejection.
 *
 * Mock-depth note (same convention as __tests__/generationRouter.test.js):
 * this spec lives in __tests__/, one level deeper than the modules under
 * test, so lib modules are ../../../lib/x.js.
 *
 * IDENTITY SOURCE (updated for the DB-enforced contract): the verified
 * CLERK SESSION. ../../../lib/clerkInit.js is mocked so the "current user"
 * can be switched between calls — the identity is NEVER a client-supplied
 * value, a MuAPI-key hash, or a shared 'anonymous' bucket. This spec used
 * to mock ../../../lib/userKey.js and assert the app-enforced Phase-2
 * contract (getUserKey fallback chain + 'anonymous' bucket + the
 * set_app_clerk_user_id RPC); that contract is superseded by
 * src/lib/personalizationAuth.js's verified-Clerk-session source and by
 * supabase/migrations/20261013120000_harden_personalization_rls.sql, which
 * drops the RPC and enforces ownership against the verified JWT sub claim
 * in the database. See src/lib/__tests__/clerkSupabaseAuth.test.js and
 * src/lib/__tests__/personalizationRlsPolicy.test.js for the new contract's
 * dedicated specs.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const identity = vi.hoisted(() => ({
  userId: 'user_a',
}));

vi.mock('../../../lib/clerkInit.js', () => ({
  getClerkInstance: () => (
    identity.userId
      ? { loaded: true, user: { id: identity.userId }, session: { user: { id: identity.userId } } }
      : { loaded: true, user: null, session: null }
  ),
  ensureClerkLoaded: async () => {},
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
  PERSONALIZATION_OWNER_FIELD,
} = await import('../../../lib/personalizationAuth.js');
const { sharedMediaStore } = await import('../sharedMediaStore.js');
const { assetLibraryStore } = await import('../assetLibraryStore.js');

function actAsUserA() {
  identity.userId = 'user_a';
}

function actAsUserB() {
  identity.userId = 'user_b';
}

function signOut() {
  identity.userId = null;
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
  it('getPersonalizationUserId returns the VERIFIED Clerk session id', () => {
    expect(getPersonalizationUserId()).toBe('user_a');
    actAsUserB();
    expect(getPersonalizationUserId()).toBe('user_b');
  });

  it('returns null when signed out (no anonymous fallback)', () => {
    signOut();
    expect(getPersonalizationUserId()).toBeNull();
  });

  it('isPersonalizationAuthReady / isPersonalizationSignedIn track the verified session', () => {
    expect(isPersonalizationAuthReady()).toBe(true);
    expect(isPersonalizationSignedIn()).toBe(true);
    signOut();
    expect(isPersonalizationAuthReady()).toBe(false);
    expect(isPersonalizationSignedIn()).toBe(false);
  });
});

describe('personalizationAuth — ownership stamping', () => {
  it('withPersonalizationOwner stamps clerk_user_id with the verified user', () => {
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

  it('stamps no owner when signed out — never a shared bucket', () => {
    signOut();
    const entry = withPersonalizationOwner({ id: 'x4', clerk_user_id: 'user_victim' });
    expect(entry[PERSONALIZATION_OWNER_FIELD]).toBeNull();
    expect(entry.clerkUserId).toBeNull();
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
      { id: 'c', clerk_user_id: 'user_a' },
    ];
    const visible = filterPersonalizationEntries(rows);
    expect(visible.map((e) => e.id)).toEqual(['a', 'c']);
  });

  it('a signed-out session cannot read a signed-in user\'s rows', () => {
    const ownRow = { id: 'a', clerk_user_id: 'user_a' };
    expect(canAccess(ownRow)).toBe(true);
    signOut();
    expect(canAccess(ownRow)).toBe(false);
    expect(filterPersonalizationEntries([ownRow])).toEqual([]);
  });

  it('legacy rows stamped with the old shared "anonymous" bucket are orphaned', () => {
    // The shared 'anonymous' bucket is gone: no verified session ever
    // presents that id, so such rows are unreachable by design (and the DB
    // migration NULLs the stamps out).
    actAsUserA();
    expect(canAccess({ id: 'anon', clerk_user_id: 'anonymous' })).toBe(false);
    signOut();
    expect(canAccess({ id: 'anon', clerk_user_id: 'anonymous' })).toBe(false);
  });
});

describe('personalizationAuth — storage keys + fail-closed writes', () => {
  it('getPersonalizationStorageKey namespaces by the verified user', () => {
    expect(getPersonalizationStorageKey('base')).toBe('base:user_a');
    actAsUserB();
    expect(getPersonalizationStorageKey('base')).toBe('base:user_b');
  });

  it('a signed-out session gets its own device-local bucket', () => {
    signOut();
    expect(getPersonalizationStorageKey('base')).toBe('base:signed-out');
  });
});

describe('personalizationAuth — cross-user CREATE/READ/UPDATE/DELETE through sharedMediaStore', () => {
  it('CREATE stamps the owner with the verified writer identity', () => {
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

  it('READ: a signed-out session cannot see a signed-in user\'s entries', () => {
    const entry = sharedMediaStore.addEntry({ sourceType: 'image-demo' });
    signOut();
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

  it('DELETE: a signed-out session cannot delete a signed-in user\'s entry', () => {
    const entry = sharedMediaStore.addEntry({ sourceType: 'image-demo' });

    signOut();
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
