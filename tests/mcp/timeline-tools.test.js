// @vitest-environment node
/** Timeline AI tools build exactly the request the editor's own function (netlify/functions/timeline-ai.js) builds. */
import { describe, it, expect } from 'vitest';
import { Client } from '../../packages/studio-mcp-core/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { InMemoryTransport } from '../../packages/studio-mcp-core/node_modules/@modelcontextprotocol/sdk/dist/esm/inMemory.js';
import { createCatalog, createGatewayClient, createBrandedServer } from '../../packages/studio-mcp-core/src/index.js';
import { buildSubmit } from '../../netlify/functions/timeline-ai.js';
import { brand } from '../../mcp/brand.js';
import { customTools } from '../../mcp/tools.js';

const IMG = 'https://cdn.example.com/a.png';
const IMG2 = 'https://cdn.example.com/b.png';
const VID = 'https://cdn.example.com/a.mp4';

async function setup() {
  const calls = [];
  const fetchImpl = async (u, init = {}) => {
    const path = u.replace('https://gw.test', '');
    calls.push({ path, body: init.body ? JSON.parse(init.body) : null });
    const ok = (b) => ({ ok: true, status: 200, statusText: 'OK', text: async () => JSON.stringify(b) });
    if (path === '/generate') return ok({ request_id: 'r1' });
    return ok({ status: 'completed', outputs: ['https://cdn.example.com/out.mp4'] });
  };
  const client = createGatewayClient({ gatewayUrl: 'https://gw.test', apiKey: 'k_test', brandName: brand.name, fetchImpl, pollIntervalMs: 1 });
  const server = createBrandedServer({ brand: { ...brand, customTools }, catalog: createCatalog([]), client });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const mcp = new Client({ name: 't', version: '1' });
  await Promise.all([server.connect(a), mcp.connect(b)]);
  return { mcp, calls };
}

const CASES = [
  ['smartvid_video_fill_gap', { first_frame_url: IMG, last_frame_url: IMG2, duration: 4 }, { tool: 'fill_gap', params: { firstFrameUrl: IMG, lastFrameUrl: IMG2, duration: 4 } }],
  ['smartvid_video_extend', { direction: 'after', video_url: VID, duration: 5 }, { tool: 'extend_after', params: { videoUrl: VID, duration: 5 } }],
  ['smartvid_video_extend', { direction: 'before', first_frame_url: IMG }, { tool: 'extend_before', params: { firstFrameUrl: IMG } }],
  ['smartvid_video_remove_watermark', { video_url: VID }, { tool: 'watermark_remove', params: { videoUrl: VID } }],
  ['smartvid_image_layers', { image_url: IMG }, { tool: 'layers', params: { imageUrl: IMG } }],
  ['smartvid_music_create', { prompt: 'calm piano', style: 'ambient', duration: 20 }, { tool: 'music', params: { prompt: 'calm piano', style: 'ambient', duration: 20, instrumental: true } }],
];

describe('timeline tools', () => {
  it.each(CASES)('%s matches timeline-ai', async (name, args, app) => {
    const { mcp, calls } = await setup();
    const r = JSON.parse((await mcp.callTool({ name, arguments: args })).content[0].text);
    expect(r.status).toBe('completed');
    const expected = buildSubmit(app);
    expect(expected.error).toBeUndefined();
    expect(calls[0]).toEqual({ path: '/generate', body: { endpoint: expected.endpoint, payload: expected.payload } });
  });

  it('turns builder validation errors into branded input errors without calling the gateway', async () => {
    const { mcp, calls } = await setup();
    const r = await mcp.callTool({ name: 'smartvid_video_remove_watermark', arguments: { video_url: 'https://cdn.example.com/a.mp4', model: 'nope' } });
    expect(r.isError).toBe(true);
    const e = await mcp.callTool({ name: 'smartvid_music_create', arguments: {} });
    expect(e.isError).toBe(true);
    expect(e.content[0].text).toMatch(/Describe the music/);
    expect(calls.length).toBe(0);
  });
});
