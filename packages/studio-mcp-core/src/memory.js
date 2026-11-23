// In-memory MCP connection: a real MCP client talking to a branded server in the same process.
// Used by the smoke run so tools are exercised through the same protocol layer Claude uses.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

export async function connectInMemory(server, { name = 'smoke', version = '1' } = {}) {
  const [a, b] = InMemoryTransport.createLinkedPair();
  const mcp = new Client({ name, version });
  await Promise.all([server.connect(a), mcp.connect(b)]);
  return mcp;
}

/** A real MCP client speaking streamable HTTP through any fetch implementation (tests call the handler directly with it). */
export async function connectOverHttp({ url, fetchImpl, headers = {}, name = 'http-test', version = '1' }) {
  const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
  const mcp = new Client({ name, version });
  await mcp.connect(new StreamableHTTPClientTransport(new URL(url), { fetch: fetchImpl, requestInit: { headers } }));
  return mcp;
}

/** A real MCP client that starts a server as a child process and talks to it over stdio (used to check built packages). */
export async function connectStdio({ command, args = [], env = {}, name = 'stdio-test', version = '1' }) {
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
  const mcp = new Client({ name, version });
  await mcp.connect(new StdioClientTransport({ command, args, env: { PATH: process.env.PATH, ...env }, stderr: 'pipe' }));
  return mcp;
}
