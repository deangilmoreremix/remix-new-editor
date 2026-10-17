/**
 * Tests for src/lib/authContext.js — the client auth context used by the
 * MuAPI upload pipeline.
 *
 * Covers:
 * - getAuthContext resolves anonymous vs Clerk-signed-in identities
 *   (Clerk is mocked via the window.Clerk singleton, the same way the app
 *   exposes the loaded Clerk instance).
 * - requireMuapiKey throws with code MUAPI_KEY_MISSING without a BYOK key.
 * - assertWorkspaceAccess allows own resources and denies cross-user /
 *   cross-workspace access.
 * - No code path ever logs the MuAPI key value (sentinel spy test).
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------
// Realistic storage fakes so the apiKeyManager singleton can really
// persist/read BYOK keys (global setup.js stubs sessionStorage with
// vi.fn() whose getItem returns undefined).
// ---------------------------------------------------------------
function createStorage() {
  const store = {};
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
    clear() {
      Object.keys(store).forEach((k) => delete store[k]);
    },
    _raw: store,
  };
}

import { apiKeyManager } from '../lib/apiKeyManager.js';
import {
  getAuthContext,
  getAuthContextSync,
  requireMuapiKey,
  assertWorkspaceAccess,
  ERROR_CODES,
} from '../lib/authContext.js';

const SENTINEL_KEY = 'sentinel-muapi-key-9f8e7d6c5b4a3f21';

let consoleMethods;

function captureConsole() {
  consoleMethods = ['log', 'info', 'warn', 'error', 'debug'].map((name) => {
    const spy = vi.spyOn(console, name).mockImplementation(() => {});
    return { name, spy };
  });
}

function consoleOutputContains(text) {
  return consoleMethods.some(({ spy }) =>
    spy.mock.calls.some((args) => args.some((arg) => String(arg).includes(text))));
}

beforeEach(() => {
  const ls = createStorage();
  const ss = createStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: ls, writable: true, configurable: true });
  Object.defineProperty(globalThis, 'sessionStorage', { value: ss, writable: true, configurable: true });
  apiKeyManager.clearMuapiKey();
  captureConsole();
});

afterEach(() => {
  vi.restoreAllMocks();
  delete window.Clerk;
});

describe('getAuthContext — identity resolution', () => {
  test('resolves anonymous identity when Clerk has no signed-in user', async () => {
    window.Clerk = { loaded: true, user: null };

    const ctx = await getAuthContext();

    expect(ctx.userId).toBe('anonymous');
    expect(ctx.workspaceId).toBe('personal');
    expect(ctx.isAnonymous).toBe(true);
    expect(ctx.muapiKey).toBeNull();
    expect(ctx.hasMuapiKey).toBe(false);
  });

  test('resolves anonymous identity when Clerk is absent entirely', () => {
    window.Clerk = undefined;

    const ctx = getAuthContextSync();

    expect(ctx.userId).toBe('anonymous');
    expect(ctx.isAnonymous).toBe(true);
  });

  test('resolves the Clerk user id when signed in (sync + async)', async () => {
    window.Clerk = { loaded: true, user: { id: 'user_2xKd9Qm4' } };

    const asyncCtx = await getAuthContext();
    expect(asyncCtx.userId).toBe('user_2xKd9Qm4');
    expect(asyncCtx.isAnonymous).toBe(false);

    const syncCtx = getAuthContextSync();
    expect(syncCtx.userId).toBe('user_2xKd9Qm4');
  });

  test('resolves workspaceId from the active Clerk organization', () => {
    window.Clerk = {
      loaded: true,
      user: { id: 'user_2xKd9Qm4', organizationMemberships: [] },
      organization: { id: 'org_42Acme' },
    };

    const ctx = getAuthContextSync();
    expect(ctx.workspaceId).toBe('org_42Acme');
  });

  test('resolves workspaceId from organization memberships when no active org', () => {
    window.Clerk = {
      loaded: true,
      user: {
        id: 'user_2xKd9Qm4',
        organizationMemberships: [{ organization: { id: 'org_9beta' } }],
      },
    };

    const ctx = getAuthContextSync();
    expect(ctx.workspaceId).toBe('org_9beta');
  });

  test('resolves the BYOK MuAPI key via apiKeyManager', async () => {
    window.Clerk = { loaded: true, user: { id: 'user_2xKd9Qm4' } };
    await apiKeyManager.setMuapiKey(SENTINEL_KEY, true);

    const ctx = await getAuthContext();

    expect(ctx.muapiKey).toBe(SENTINEL_KEY);
    expect(ctx.hasMuapiKey).toBe(true);
  });

  test('treats a stored whitespace-only key as absent', async () => {
    window.Clerk = { loaded: true, user: { id: 'user_2xKd9Qm4' } };
    // Simulate a malformed/blank stored value bypassing setMuapiKey.
    globalThis.localStorage.setItem('muapi_key', btoa('muapi_2024_   '));

    const ctx = await getAuthContext();

    expect(ctx.muapiKey).toBeNull();
    expect(ctx.hasMuapiKey).toBe(false);
  });
});

describe('requireMuapiKey', () => {
  test('throws with code MUAPI_KEY_MISSING when no key is present', () => {
    const ctx = { userId: 'anonymous', workspaceId: 'personal', muapiKey: null };

    expect(() => requireMuapiKey(ctx)).toThrowError(/MuAPI key missing/i);
    try {
      requireMuapiKey(ctx);
    } catch (err) {
      expect(err.code).toBe(ERROR_CODES.MUAPI_KEY_MISSING);
    }
  });

  test('throws when the key is whitespace-only', () => {
    const ctx = { userId: 'anonymous', workspaceId: 'personal', muapiKey: '   ' };
    expect(() => requireMuapiKey(ctx)).toThrowError();
  });

  test('passes the context through when a key is present', () => {
    const ctx = { userId: 'user_a', workspaceId: 'personal', muapiKey: SENTINEL_KEY };
    expect(requireMuapiKey(ctx)).toBe(ctx);
  });
});

describe('assertWorkspaceAccess', () => {
  const authContext = { userId: 'user_a', workspaceId: 'org_1' };

  test('allows access to the caller’s own resource', () => {
    expect(() => assertWorkspaceAccess(authContext, { userId: 'user_a', workspaceId: 'org_1' })).not.toThrow();
    expect(() => assertWorkspaceAccess(authContext, { userId: 'user_a' })).not.toThrow();
    // Unowned resources (no owner fields) pass through.
    expect(() => assertWorkspaceAccess(authContext, {})).not.toThrow();
  });

  test('denies access to another user’s resource', () => {
    expect(() => assertWorkspaceAccess(authContext, { userId: 'user_b' })).toThrow();
    try {
      assertWorkspaceAccess(authContext, { userId: 'user_b' });
    } catch (err) {
      expect(err.code).toBe(ERROR_CODES.WORKSPACE_ACCESS_DENIED);
    }
  });

  test('denies access to a resource in another workspace', () => {
    expect(() => assertWorkspaceAccess(authContext, { userId: 'user_a', workspaceId: 'org_2' })).toThrow();
    expect(() =>
      assertWorkspaceAccess(authContext, { workspaceId: 'org_other' })).toThrow(); // workspace-only mismatch
  });

  test('anonymous callers may touch anonymous resources but not other users’', () => {
    const anon = { userId: 'anonymous', workspaceId: 'personal' };
    expect(() => assertWorkspaceAccess(anon, { userId: 'anonymous' })).not.toThrow();
    expect(() => assertWorkspaceAccess(anon, { userId: 'user_a' })).toThrow();
  });
});

describe('BYOK key secrecy', () => {
  test('no code path logs the MuAPI key value', async () => {
    window.Clerk = { loaded: true, user: { id: 'user_2xKd9Qm4' } };
    await apiKeyManager.setMuapiKey(SENTINEL_KEY, true);

    const ctx = await getAuthContext();
    const syncCtx = getAuthContextSync();
    requireMuapiKey(ctx);
    requireMuapiKey(syncCtx);

    // Also exercise the negative paths (missing key guard, denied access) so
    // any error message built from the key would be caught.
    try {
      requireMuapiKey({ ...ctx, muapiKey: null });
    } catch {}
    try {
      assertWorkspaceAccess(ctx, { userId: 'someone_else' });
    } catch {}

    expect(ctx.muapiKey).toBe(SENTINEL_KEY);
    expect(consoleOutputContains(SENTINEL_KEY)).toBe(false);
  });
});
