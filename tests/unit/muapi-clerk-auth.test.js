// tests/unit/muapi-clerk-auth.test.js
//
// Unit tests that MuapiClient calls routed through the entitlement-gated
// muapi-proxy Supabase Edge Function carry
// `Authorization: Bearer <Clerk session token>` when Clerk has a session —
// and preserve the previous header behavior (x-api-key, no Authorization,
// no crash) when Clerk is unavailable.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { muapi } from '../../src/lib/muapi.js';
import { apiKeyManager } from '../../src/lib/apiKeyManager.js';
import { resetClerkTokenCache } from '../../src/lib/clerkToken.js';

function jsonOk(body) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function setSignedInClerk(token) {
  window.Clerk = {
    loaded: true,
    session: { getToken: vi.fn().mockResolvedValue(token) },
  };
}

function setSignedOutClerk() {
  window.Clerk = {
    loaded: true,
    session: { getToken: vi.fn().mockResolvedValue(null) },
  };
}

describe('MuapiClient proxy Authorization header', () => {
  let fetchMock;

  beforeEach(async () => {
    resetClerkTokenCache();
    delete window.Clerk;
    fetchMock = vi.fn(async () => jsonOk({}));
    global.fetch = fetchMock;
    await apiKeyManager.setMuapiKey('test-muapi-key-123456');
  });

  afterEach(() => {
    delete window.Clerk;
    apiKeyManager.clearMuapiKey();
  });

  it('attaches the Clerk session token to proxy requests', async () => {
    setSignedInClerk('clerk-jwt-123');
    await muapi.makeRequest('some-endpoint', { prompt: 'hi' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(muapi.proxyUrl);
    expect(init.headers.Authorization).toBe('Bearer clerk-jwt-123');
    expect(init.headers['x-api-key']).toBe('test-muapi-key-123456');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('omits Authorization but keeps x-api-key when Clerk is unavailable', async () => {
    await muapi.makeRequest('some-endpoint', {});

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
    expect(init.headers['x-api-key']).toBe('test-muapi-key-123456');
  });

  it('attaches the token on proxyJson passthrough calls', async () => {
    setSignedInClerk('clerk-jwt-xyz');
    await muapi.proxyJson('publish', { params: { a: 1 } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer clerk-jwt-xyz');
  });

  it('shares one getToken() call across parallel proxy requests', async () => {
    setSignedInClerk('clerk-jwt-parallel');
    await Promise.all([
      muapi.makeRequest('endpoint-a', {}),
      muapi.makeRequest('endpoint-b', {}),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(window.Clerk.session.getToken).toHaveBeenCalledTimes(1);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init.headers.Authorization).toBe('Bearer clerk-jwt-parallel');
    }
  });

  it('generateImage proxies with the Clerk token when signed in', async () => {
    setSignedInClerk('clerk-jwt-image');
    const result = await muapi.generateImage({ model: 'flux-dev', prompt: 'x' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(muapi.proxyUrl);
    expect(init.headers.Authorization).toBe('Bearer clerk-jwt-image');
    expect(JSON.parse(init.body)).toMatchObject({
      endpoint: 'flux-dev-image',
      generationType: 'image',
    });
    expect(result).toEqual({});
  });

  it('generateImage keeps prior behavior (no Authorization, no crash) when signed out', async () => {
    setSignedOutClerk();
    const result = await muapi.generateImage({ model: 'flux-dev', prompt: 'x' });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
    expect(init.headers['x-api-key']).toBe('test-muapi-key-123456');
    expect(result).toEqual({});
  });
});
