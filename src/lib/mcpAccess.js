/**
 * Client for SmartVid MCP access keys (netlify/functions/mcp-keys.js).
 * Creating a key sends the user's own saved API keys once (same BYOK headers every function gets); the server
 * stores them encrypted and hands back a long-lived key to paste into an MCP client. The raw key is shown once.
 */
import { byokHeaders } from './editor/agent/audioGen.js';

export const MCP_KEYS_ENDPOINT = '/api/mcp-keys';

async function authHeader() {
  try {
    const token = await globalThis.window?.Clerk?.session?.getToken?.();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function call(body, { fetchImpl = fetch, keyManager } = {}) {
  const res = await fetchImpl(MCP_KEYS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()), ...(body.action === 'create' ? byokHeaders(keyManager) : {}) },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (res.status === 401) throw new Error('Sign in to manage MCP access.');
  if (!res.ok || !data?.ok) throw new Error(data?.error?.message || data?.error || `MCP access is unavailable (HTTP ${res.status}).`);
  return data;
}

export const listMcpKeys = (opts) => call({ action: 'list' }, opts).then((d) => d.keys);
export const createMcpKey = (label, opts) => call({ action: 'create', label }, opts);
export const revokeMcpKey = (id, opts) => call({ action: 'revoke', id }, opts);

/** The install snippets shown next to a new key. */
export function mcpInstallSnippets(rawKey, { url = 'https://smartvid.app/api/mcp-gateway', repoPath = '/path/to/remix-new-editor' } = {}) {
  return {
    claudeCode: `claude mcp add smartvid -e SMARTVID_API_KEY=${rawKey} -- node ${repoPath}/mcp/index.js`,
    json: JSON.stringify({ mcpServers: { smartvid: { command: 'node', args: [`${repoPath}/mcp/index.js`], env: { SMARTVID_API_KEY: rawKey, SMARTVID_API_URL: url } } } }, null, 2),
  };
}
