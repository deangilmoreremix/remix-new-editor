import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Client } from '../../packages/studio-mcp-core/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { InMemoryTransport } from '../../packages/studio-mcp-core/node_modules/@modelcontextprotocol/sdk/dist/esm/inMemory.js';
import { createCatalog, createGatewayClient, createBrandedServer } from '../../packages/studio-mcp-core/src/index.js';
import { brand, endpointFixes } from '../../mcp/brand.js';

const entries = JSON.parse(readFileSync(new URL('../../mcp/catalog.json', import.meta.url), 'utf8'));
const catalog = createCatalog(entries, { endpointFixes });

function fakeGateway() {
  const calls = [];
  let polls = 0;
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    const path = url.replace('https://gw.test', '');
    const ok = (b) => ({ ok: true, status: 200, statusText: 'OK', text: async () => JSON.stringify(b) });
    if (path === '/generate') return ok({ request_id: 'r1' });
    if (path === '/result/r1') return ok(++polls < 2 ? { status: 'processing' } : { status: 'completed', outputs: ['https://cdn.test/a.png'] });
    if (path === '/balance') return ok({ balance: 42 });
    if (path === '/estimate') return ok({ cost: 3 });
    return { ok: false, status: 500, statusText: 'x', text: async () => JSON.stringify({ detail: 'muapi.ai upstream exploded' }) };
  };
  return { fetchImpl, calls };
}

async function connect(fetchImpl, apiKey = 'k_test') {
  const client = createGatewayClient({ gatewayUrl: 'https://gw.test', apiKey, brandName: brand.name, fetchImpl, pollIntervalMs: 1 });
  const server = createBrandedServer({ brand, catalog, client });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const mcp = new Client({ name: 't', version: '1' });
  await Promise.all([server.connect(a), mcp.connect(b)]);
  return mcp;
}
const body = (r) => JSON.parse(r.content[0].text);

describe('SmartVid MCP', () => {
  it('registers branded tools and leaks no upstream name', async () => {
    const mcp = await connect(fakeGateway().fetchImpl);
    const { tools } = await mcp.listTools();
    const names = tools.map((t) => t.name);
    expect(names.every((n) => n.startsWith('smartvid_'))).toBe(true);
    for (const n of ['image_generate', 'image_edit', 'video_generate', 'video_from_image', 'lipsync', 'audio_generate', 'avatar_generate', 'get_result', 'account_balance']) {
      expect(names).toContain(`smartvid_${n}`);
    }
    expect(JSON.stringify(tools)).not.toMatch(/mu-?api/i);
    expect(JSON.stringify(entries)).not.toMatch(/mu-?api/i);
  });

  it('generates an image: validates, submits, polls, returns outputs', async () => {
    const gw = fakeGateway();
    const mcp = await connect(gw.fetchImpl);
    const model = entries.find((e) => e.kind === 't2i').key;
    const r = body(await mcp.callTool({ name: 'smartvid_image_generate', arguments: { model, inputs: { prompt: 'a cat' } } }));
    expect(r).toEqual({ status: 'completed', request_id: 'r1', outputs: ['https://cdn.test/a.png'] });
    expect(gw.calls[0].init.headers.Authorization).toBe('Bearer k_test');
  });

  it('rejects bad inputs and wrong-kind models before calling the gateway', async () => {
    const gw = fakeGateway();
    const mcp = await connect(gw.fetchImpl);
    const t2i = entries.find((e) => e.kind === 't2i').key;
    const v = entries.find((e) => e.kind === 't2v').key;
    const bad = await mcp.callTool({ name: 'smartvid_image_generate', arguments: { model: t2i, inputs: { nope: 1 } } });
    expect(bad.isError).toBe(true);
    const wrong = await mcp.callTool({ name: 'smartvid_image_generate', arguments: { model: v, inputs: { prompt: 'x' } } });
    expect(wrong.isError).toBe(true);
    expect(gw.calls.length).toBe(0);
  });

  it('scrubs upstream names from gateway errors and reports a missing key', async () => {
    const mcp = await connect(fakeGateway().fetchImpl);
    const r = await mcp.callTool({ name: 'smartvid_upload_file', arguments: { url: 'https://example.com/a.png' } });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain('SmartVid');
    expect(r.content[0].text).not.toMatch(/mu-?api/i);
    const noKey = await connect(fakeGateway().fetchImpl, '');
    const r2 = await noKey.callTool({ name: 'smartvid_account_balance', arguments: {} });
    expect(r2.content[0].text).toMatch(/Missing SmartVid API key/);
  });
});
