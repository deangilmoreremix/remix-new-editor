// tests/unit/clerk-token.test.js
//
// Unit tests for src/lib/clerkToken.js — the Clerk session-token resolver
// used to attach `Authorization: Bearer <Clerk session token>` to the
// entitlement-gated endpoints (muapi-proxy, ai-thumbnail-generator, cinegen,
// timeline-script, timeline-image-generate, pixabay-search).
//
// Contract under test:
//   - Clerk not loaded / no session           -> null (never throws)
//   - getToken() rejects                      -> null (never throws)
//   - loaded, signed-in session               -> session JWT
//   - expired-token refresh                   -> re-fetch after TTL expires
//                                                (clerk-js refreshes internally)
//   - single-flight cache                     -> parallel callers share one
//                                                in-flight getToken() call

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getClerkToken,
  getClerkAuthHeaders,
  resetClerkTokenCache,
} from '../../src/lib/clerkToken.js';

function setClerkSession(session) {
  window.Clerk = session ? { loaded: true, session } : { loaded: true };
}

describe('getClerkToken', () => {
  beforeEach(() => {
    resetClerkTokenCache();
    delete window.Clerk;
  });

  afterEach(() => {
    delete window.Clerk;
  });

  it('returns null (no throw) when Clerk is not loaded yet', async () => {
    delete window.Clerk;
    await expect(getClerkToken()).resolves.toBeNull();
  });

  it('returns null when window.Clerk exists but has no session', async () => {
    setClerkSession(null);
    await expect(getClerkToken()).resolves.toBeNull();
  });

  it('returns null when the session has no getToken function', async () => {
    setClerkSession({});
    await expect(getClerkToken()).resolves.toBeNull();
  });

  it('returns null when getToken() resolves null (signed out)', async () => {
    const getToken = vi.fn().mockResolvedValue(null);
    setClerkSession({ getToken });
    await expect(getClerkToken()).resolves.toBeNull();
  });

  it('returns null (no throw) when getToken() rejects', async () => {
    const getToken = vi.fn().mockRejectedValue(new Error('Clerk still loading'));
    setClerkSession({ getToken });
    await expect(getClerkToken()).resolves.toBeNull();
  });

  it('returns the session JWT for a loaded, signed-in session', async () => {
    const getToken = vi.fn().mockResolvedValue('jwt-abc');
    setClerkSession({ getToken });
    await expect(getClerkToken()).resolves.toBe('jwt-abc');
    expect(getToken).toHaveBeenCalledTimes(1);
  });

  it('serves parallel callers from a single in-flight getToken() call', async () => {
    const getToken = vi.fn().mockResolvedValue('jwt-abc');
    setClerkSession({ getToken });
    const results = await Promise.all([
      getClerkToken(),
      getClerkToken(),
      getClerkToken(),
    ]);
    expect(results).toEqual(['jwt-abc', 'jwt-abc', 'jwt-abc']);
    expect(getToken).toHaveBeenCalledTimes(1);
  });

  it('reuses the cached token within the TTL', async () => {
    const getToken = vi.fn().mockResolvedValue('jwt-abc');
    setClerkSession({ getToken });
    await getClerkToken();
    await getClerkToken();
    expect(getToken).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after the TTL so expired tokens are refreshed', async () => {
    vi.useFakeTimers();
    try {
      const getToken = vi.fn()
        .mockResolvedValueOnce('jwt-expired')
        .mockResolvedValueOnce('jwt-refreshed');
      setClerkSession({ getToken });

      await expect(getClerkToken()).resolves.toBe('jwt-expired');

      vi.advanceTimersByTime(31_000);

      await expect(getClerkToken()).resolves.toBe('jwt-refreshed');
      expect(getToken).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('resetClerkTokenCache forces a fresh fetch', async () => {
    const getToken = vi.fn().mockResolvedValue('jwt-abc');
    setClerkSession({ getToken });
    await getClerkToken();
    resetClerkTokenCache();
    await getClerkToken();
    expect(getToken).toHaveBeenCalledTimes(2);
  });
});

describe('getClerkAuthHeaders', () => {
  beforeEach(() => {
    resetClerkTokenCache();
    delete window.Clerk;
  });

  afterEach(() => {
    delete window.Clerk;
  });

  it('returns the bearer header when a session token is available', async () => {
    setClerkSession({ getToken: vi.fn().mockResolvedValue('jwt-abc') });
    await expect(getClerkAuthHeaders()).resolves.toEqual({
      Authorization: 'Bearer jwt-abc',
    });
  });

  it('returns an empty object when Clerk is unavailable', async () => {
    await expect(getClerkAuthHeaders()).resolves.toEqual({});
  });
});
