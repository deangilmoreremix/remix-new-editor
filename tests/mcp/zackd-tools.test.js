// @vitest-environment node
/** Zack D tools send the gateway exactly the bodies the studio function accepts (checked with zackd.js's own buildSubmit). */
import { describe, it, expect } from 'vitest';
import { Client } from '../../packages/studio-mcp-core/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { InMemoryTransport } from '../../packages/studio-mcp-core/node_modules/@modelcontextprotocol/sdk/dist/esm/inMemory.js';
import { createCatalog, createGatewayClient, createBrandedServer } from '../../packages/studio-mcp-core/src/index.js';
import { buildSubmit } from '../../netlify/functions/zackd.js';
import { brand } from '../../mcp/brand.js';
import { customTools } from '../../mcp/tools.js';

async function setup(script) {
  const calls = [];
  const fetchImpl = async (u, init = {}) => {
    const path = u.replace('https://gw.test', '');
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ path, body });
    const out = script(path, body, calls.length);
    return { ok: true, status: 200, statusText: 'OK', text: async () => JSON.stringify(out) };
  };
  const client = createGatewayClient({ gatewayUrl: 'https://gw.test', apiKey: 'sv_live_x', brandName: brand.name, fetchImpl, pollIntervalMs: 1 });
  client.sleep = async () => {};
  const server = createBrandedServer({ brand: { ...brand, customTools }, catalog: createCatalog([]), client });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const mcp = new Client({ name: 't', version: '1' });
  await Promise.all([server.connect(a), mcp.connect(b)]);
  return { mcp, calls };
}
const text = (r) => JSON.parse(r.content[0].text);

describe('zackd tools', () => {
  it('submit: bodies pass the studio function\'s own validation, then poll status to completion', async () => {
    let polls = 0;
    const { mcp, calls } = await setup((path, body) => (body.action === 'submit' ? { ok: true, requestId: 'req12345' } : ++polls < 2 ? { ok: true, status: 'pending' } : { ok: true, status: 'done', url: 'https://cdn.example.com/x.png' }));
    const out = text(await mcp.callTool({ name: 'smartvid_zackd_submit', arguments: { kind: 'image', prompt: 'a cat', aspect: '9:16' } }));
    expect(out).toEqual({ status: 'completed', request_id: 'req12345', url: 'https://cdn.example.com/x.png' });
    const sent = calls[0];
    expect(sent.path).toBe('/studio/zackd');
    expect(buildSubmit(sent.body).error).toBeUndefined();
    expect(calls.slice(1).every((c) => c.body.action === 'status' && c.body.requestId === 'req12345')).toBe(true);
  });

  it.each([
    [{ kind: 'clip', image_url: 'https://cdn.example.com/a.png', prompt: 'zoom' }],
    [{ kind: 'tts', text: 'Hello there' }],
    [{ kind: 'music', mood: 'calm', duration: 20 }],
    [{ kind: 'captions', video_url: 'https://cdn.example.com/a.mp4' }],
  ])('every kind builds a request zackd accepts: %j', async (args) => {
    const { mcp, calls } = await setup(() => ({ ok: true, status: 'done', url: 'https://cdn.example.com/o' }));
    await mcp.callTool({ name: 'smartvid_zackd_submit', arguments: args });
    expect(buildSubmit(calls[0].body).error).toBeUndefined();
  });

  it('trends/script/status map to the function actions; wait=false returns the id', async () => {
    const { mcp, calls } = await setup((p, body) => (body.action === 'submit' ? { ok: true, requestId: 'req12345' } : { ok: true, topics: [], map: {} }));
    await mcp.callTool({ name: 'smartvid_zackd_trends', arguments: { query: 'space' } });
    await mcp.callTool({ name: 'smartvid_zackd_script', arguments: { topic: 'black holes', max_beats: 5 } });
    expect(calls[0].body).toEqual({ action: 'trends', query: 'space' });
    expect(calls[1].body).toEqual({ action: 'script', topic: 'black holes', maxBeats: 5 });
    const r = text(await mcp.callTool({ name: 'smartvid_zackd_submit', arguments: { kind: 'image', prompt: 'x', wait: false } }));
    expect(r).toEqual({ status: 'processing', request_id: 'req12345' });
  });
});

describe('brand_scrape', () => {
  it('calls the scraper studio and drops the screenshot unless asked', async () => {
    const { mcp, calls } = await setup(() => ({ ok: true, data: { title: 'Acme', colors: ['#fff'], screenshot: 'AAAA' } }));
    const r = text(await mcp.callTool({ name: 'smartvid_brand_scrape', arguments: { url: 'https://acme.example.com' } }));
    expect(calls[0]).toEqual({ path: '/studio/brand-scrape', body: { url: 'https://acme.example.com' } });
    expect(r.data.title).toBe('Acme');
    expect(JSON.stringify(r)).not.toContain('AAAA');
    const full = text(await mcp.callTool({ name: 'smartvid_brand_scrape', arguments: { url: 'https://acme.example.com', include_screenshot: true } }));
    expect(full.data.screenshot).toBe('AAAA');
  });
});

describe('voiceover_create', () => {
  it('sends a request agent-audio accepts, waits for the job, and passes OpenAI through', async () => {
    const { buildRequest } = await import('../../netlify/functions/agent-audio.js');
    let polls = 0;
    const { mcp, calls } = await setup((path, body) => (body.action === 'submit' ? (body.provider === 'openai' ? { ok: true, status: 'done', url: 'data:audio/mp3;base64,AAA' } : { ok: true, requestId: 'aud12345' }) : ++polls < 2 ? { ok: true, status: 'pending' } : { ok: true, status: 'done', url: 'https://cdn.example.com/v.mp3' }));
    const r = text(await mcp.callTool({ name: 'smartvid_voiceover_create', arguments: { text: 'Hello world', voice: 'Calm_Woman', speed: 1.1 } }));
    expect(r).toEqual({ status: 'completed', request_id: 'aud12345', url: 'https://cdn.example.com/v.mp3' });
    expect(calls[0].path).toBe('/studio/agent-audio');
    expect(buildRequest(calls[0].body).error).toBeUndefined();
    const o = text(await mcp.callTool({ name: 'smartvid_voiceover_create', arguments: { text: 'Hi', provider: 'openai', voice: 'marin' } }));
    expect(o).toEqual({ status: 'completed', url: 'data:audio/mp3;base64,AAA' });
    expect(buildRequest(calls.at(-1).body).error).toBeUndefined();
  });
});
