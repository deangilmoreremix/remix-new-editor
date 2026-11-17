/**
 * Parity: for the same inputs, the MCP builds the same backend request the real studio client does.
 * Runs the app's own MuapiClient (src/lib/muapi.js) against a mocked fetch and compares with the MCP catalog's buildRequest.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { MuapiClient } from '../../src/lib/muapi.js';
import { createCatalog } from '../../packages/studio-mcp-core/src/catalog.js';
import { endpointFixes } from '../../mcp/brand.js';

vi.mock('../../src/lib/services/RateLimiter.js', () => ({ rateLimiter: { acquire: vi.fn(() => Promise.resolve()) } }));
vi.mock('../../src/lib/supabase.js', () => ({ uploadFileToStorage: vi.fn(async (f) => `https://cdn.example.com/${f?.name ?? 'file'}`) }));
vi.mock('../../src/lib/analytics.js', () => ({ analytics: { trackGeneration: vi.fn(), trackGenerationComplete: vi.fn(), trackGenerationError: vi.fn() } }));

const entries = JSON.parse(readFileSync(path.resolve(process.cwd(), 'mcp/catalog.json'), 'utf8'));
const catalog = createCatalog(entries, { endpointFixes });
const IMG = 'https://cdn.example.com/in.png';
const VID = 'https://cdn.example.com/in.mp4';
const AUD = 'https://cdn.example.com/in.mp3';

let client;
let fetchMock;
beforeEach(async () => {
  client = new MuapiClient();
  await client.apiKeyManager.setMuapiKey('test-key-0123456789');
  fetchMock = vi.fn(() => Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve({ outputs: ['https://cdn.example.com/out.png'] }) }));
  global.fetch = fetchMock;
});
const sent = () => { const b = JSON.parse(fetchMock.mock.calls[0][1].body); return { endpoint: String(b.endpoint).replace(/^\//, ''), params: b.params ?? b }; };
// Models whose route the app's client still sends under the old name (live catalog says otherwise): see the divergence test.
const first = (kind) => entries.find((e) => e.kind === kind && !e.id.includes('watermark') && !endpointFixes[e.id]);
const mediaFor = (e) => {
  const out = {};
  for (const [n, d] of Object.entries(e.inputs || {})) {
    if (!d.required && !/^(image_url|video_url|audio_url)$/.test(n)) continue;
    if (/video/i.test(n)) out[n] = VID; else if (/audio/i.test(n)) out[n] = AUD; else if (/image|frame/i.test(n)) out[n] = d.type === 'array' ? [IMG] : IMG;
  }
  return out;
};

// kind -> app client call
const CALLS = {
  t2i: (m, i) => client.generateImage({ model: m, ...i }),
  i2i: (m, i) => client.generateI2I({ model: m, ...i }),
  t2v: (m, i) => client.generateVideo({ model: m, ...i }),
  i2v: (m, i) => client.generateI2V({ model: m, ...i }),
  v2v: (m, i) => client.processV2V({ model: m, ...i }),
  lipsync: (m, i) => client.processLipSync({ model: m, ...i }),
  audio: (m, i) => client.generateAudio({ model: m, ...i }),
};

describe('catalog-driven studios send what the MCP would send', () => {
  for (const [kind, call] of Object.entries(CALLS)) {
    test(kind, async () => {
      const e = first(kind);
      const inputs = { prompt: 'a red fox', ...mediaFor(e) };
      const mcp = catalog.buildRequest(e.key, inputs);
      await call(e.id, inputs);
      const app = sent();
      expect(app.endpoint).toBe(mcp.endpoint.replace(/^\//, ''));
      for (const [k, v] of Object.entries(mcp.payload)) {
        expect(app.params[k], `${e.id}.${k}`).toEqual(v);
      }
    });
  }
});

describe('known divergences (MCP is correct per the live catalog)', () => {
  test.each(Object.entries(endpointFixes))('%s: app sends the old route, MCP sends %s', async (id, fixed) => {
    const e = entries.find((x) => x.id === id);
    const kind = { i2i: 'generateI2I', t2i: 'generateImage' }[e.kind];
    if (!kind) return;
    await client[kind]({ model: id, prompt: 'x', ...mediaFor(e) });
    expect(sent().endpoint).toBe(e.endpoint); // app: unfixed route
    expect(catalog.buildRequest(e.key, { prompt: 'x', ...mediaFor(e) }).endpoint).toBe(`/${fixed}`);
  });
});

describe('fixed-route studios', () => {
  test('motion graphics', async () => {
    const mcp = catalog.buildRequest('motion-graphics', { prompt: 'logo reveal' });
    await client.runMotionGraphics({ prompt: 'logo reveal' });
    const app = sent();
    expect(app.endpoint).toBe('motion-graphics');
    expect(app.params).toMatchObject({ prompt: 'logo reveal' });
    expect(mcp.endpoint).toBe('/motion-graphics');
  });
  test('commercial ad (720p and 1080p endpoints)', async () => {
    const inputs = { prompt: 'sneaker ad', images_list: [IMG] };
    await client.generateMarketingStudioAd({ ...inputs });
    expect(sent().endpoint).toBe(catalog.buildRequest('commercial-ad', inputs).endpoint.slice(1));
    fetchMock.mockClear();
    await client.generateMarketingStudioAd({ ...inputs, resolution: '1080p' });
    expect(sent().endpoint).toBe(catalog.buildRequest('commercial-ad-1080p', inputs).endpoint.slice(1));
  });
  test('effects (generate_wan_ai_effects)', async () => {
    const e = entries.find((x) => x.id === 'ai-video-effects');
    const name = e.inputs.name.enum[0];
    const mcp = catalog.buildRequest(e.key, { name, image_url: IMG });
    await client.generateVideoEffect({ model: e.id, name, image_url: IMG });
    const app = sent();
    expect(app.endpoint).toBe(mcp.endpoint.slice(1));
    expect(app.params).toMatchObject({ name, image_url: IMG });
  });
  test('motion control', async () => {
    const e = entries.find((x) => x.kind === 'motion');
    const inputs = { video_url: VID, images_list: [IMG] };
    const mcp = catalog.buildRequest(e.key, inputs);
    await client.processMotionControl({ model: e.id, ...inputs });
    const app = sent();
    expect(app.endpoint).toBe(mcp.endpoint.slice(1));
    expect(app.params).toMatchObject({ video_url: VID, images_list: [IMG] });
  });
  test('recast', async () => {
    const e = entries.find((x) => x.kind === 'recast');
    const inputs = { video_url: VID, image_url: IMG };
    const mcp = catalog.buildRequest(e.key, inputs);
    await client.processRecast({ model: e.id, ...inputs });
    const app = sent();
    expect(app.endpoint).toBe(mcp.endpoint.slice(1));
    expect(app.params).toMatchObject(mcp.payload);
  });
});
