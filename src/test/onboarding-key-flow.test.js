// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MuapiClient } from '../lib/muapi.js';
import { ApiKeyManager } from '../lib/apiKeyManager.js';

const clientWith = (key) => {
  const c = new MuapiClient();
  c.apiKeyManager = { getMuapiKey: () => key, hasMuapiKey: () => !!key };
  return c;
};

describe('muapi.checkKey (the onboarding "Test")', () => {
  afterEach(() => vi.unstubAllGlobals());
  const reply = (status, body = {}) => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => body })));

  it('reports valid with the balance', async () => {
    reply(200, { balance: 42 });
    expect(await clientWith('k'.repeat(12)).checkKey()).toEqual({ status: 'valid', balance: 42 });
  });
  it('401/403 means the key is invalid', async () => {
    reply(401); expect((await clientWith('k'.repeat(12)).checkKey()).status).toBe('invalid');
    reply(403); expect((await clientWith('k'.repeat(12)).checkKey()).status).toBe('invalid');
  });
  it('server trouble, a network error or an odd reply is "unknown", never "invalid"', async () => {
    reply(500); expect((await clientWith('k'.repeat(12)).checkKey()).status).toBe('unknown');
    reply(200, { nope: 1 }); expect((await clientWith('k'.repeat(12)).checkKey()).status).toBe('unknown');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect((await clientWith('k'.repeat(12)).checkKey()).status).toBe('unknown');
  });
  it('no key means missing, with no request', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f);
    expect((await clientWith(null).checkKey()).status).toBe('missing');
    expect(f).not.toHaveBeenCalled();
  });
});

describe('dev bypass placeholder key', () => {
  it('the literal "dev" placeholder is accepted, while other short keys are still rejected', async () => {
    const m = new ApiKeyManager();
    await expect(m.setMuapiKey('dev', false)).resolves.not.toThrow();
    expect(m.hasMuapiKey()).toBe(true);
    await expect(m.setMuapiKey('abc', false)).rejects.toThrow('too short');
  });
});
