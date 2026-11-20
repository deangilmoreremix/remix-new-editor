import { describe, it, expect, vi } from 'vitest';
import { testAndSaveMuapiKey } from '../keySetup.js';

const fakeKeys = (existing = null) => {
  let key = existing;
  return {
    getMuapiKey: () => key, hasMuapiKey: () => !!key,
    setMuapiKey: vi.fn(async (k) => { key = k; }), clearMuapiKey: vi.fn(() => { key = null; }),
  };
};
const noFormat = async () => '';

describe('testAndSaveMuapiKey', () => {
  it('rejects empty and badly formatted keys without saving', async () => {
    const keys = fakeKeys();
    expect((await testAndSaveMuapiKey('  ', { keys })).status).toBe('empty');
    const r = await testAndSaveMuapiKey('abc', { keys, formatError: async () => 'too short' });
    expect(r).toMatchObject({ ok: false, status: 'format', error: 'too short' });
    expect(keys.setMuapiKey).not.toHaveBeenCalled();
  });
  it('saves a key that the probe confirms and returns the balance', async () => {
    const keys = fakeKeys();
    const r = await testAndSaveMuapiKey(' goodkey12345 ', { keys, formatError: noFormat, probe: async () => ({ status: 'valid', balance: 7 }) });
    expect(r).toEqual({ ok: true, status: 'valid', balance: 7 });
    expect(keys.getMuapiKey()).toBe('goodkey12345');
  });
  it('removes a key Muapi rejects, and restores the previous one', async () => {
    const a = fakeKeys();
    expect(await testAndSaveMuapiKey('badkey12345', { keys: a, formatError: noFormat, probe: async () => ({ status: 'invalid' }) })).toMatchObject({ ok: false, status: 'invalid' });
    expect(a.hasMuapiKey()).toBe(false);
    const b = fakeKeys('oldkey12345');
    await testAndSaveMuapiKey('badkey12345', { keys: b, formatError: noFormat, probe: async () => ({ status: 'invalid' }) });
    expect(b.getMuapiKey()).toBe('oldkey12345');
  });
  it('keeps the key but says "unverified" when the check could not run', async () => {
    const keys = fakeKeys();
    const r = await testAndSaveMuapiKey('goodkey12345', { keys, formatError: noFormat, probe: async () => ({ status: 'unknown' }) });
    expect(r).toEqual({ ok: true, status: 'unverified' });
    expect(keys.hasMuapiKey()).toBe(true);
  });
});
