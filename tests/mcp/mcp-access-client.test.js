import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listMcpKeys, createMcpKey, revokeMcpKey, mcpInstallSnippets, MCP_KEYS_ENDPOINT } from '../../src/lib/mcpAccess.js';

const km = { getMuapiKey: () => 'mu_test_key_0123456789abcdef', getOpenAIKey: () => 'sk-abcdefghijklmnopqrstuv' };
const reply = (status, body) => ({ status, ok: status < 400, json: async () => body });

describe('mcpAccess client', () => {
  beforeEach(() => { globalThis.window = { Clerk: { session: { getToken: async () => 'clerk.jwt' } } }; });

  it('sends the Clerk session; only create also sends the saved keys', async () => {
    const f = vi.fn(async () => reply(200, { ok: true, keys: [], key: 'sv_live_x', id: 'i' }));
    await listMcpKeys({ fetchImpl: f, keyManager: km });
    await createMcpKey('Claude', { fetchImpl: f, keyManager: km });
    await revokeMcpKey('abc', { fetchImpl: f, keyManager: km });
    const [list, create, revoke] = f.mock.calls;
    expect(list[0]).toBe(MCP_KEYS_ENDPOINT);
    expect(list[1].headers.Authorization).toBe('Bearer clerk.jwt');
    expect(list[1].headers['X-MuAPI-Key']).toBeUndefined();
    expect(create[1].headers['X-MuAPI-Key']).toBe('mu_test_key_0123456789abcdef');
    expect(create[1].headers['X-OpenAI-Key']).toBe('sk-abcdefghijklmnopqrstuv');
    expect(JSON.parse(create[1].body)).toEqual({ action: 'create', label: 'Claude' });
    expect(revoke[1].headers['X-MuAPI-Key']).toBeUndefined();
  });

  it('surfaces server messages and a sign-in prompt', async () => {
    await expect(createMcpKey('x', { fetchImpl: async () => reply(400, { ok: false, error: { message: 'Add your key first' } }), keyManager: km })).rejects.toThrow('Add your key first');
    await expect(listMcpKeys({ fetchImpl: async () => reply(401, {}) })).rejects.toThrow(/Sign in/);
  });

  it('install snippets carry the key and the SmartVid names only', () => {
    const s = mcpInstallSnippets('sv_live_abc');
    expect(s.claudeCode).toContain('SMARTVID_API_KEY=sv_live_abc');
    expect(JSON.parse(s.json).mcpServers.smartvid.env.SMARTVID_API_KEY).toBe('sv_live_abc');
    expect(s.claudeCode + s.json).not.toMatch(/mu-?api/i);
  });
});
