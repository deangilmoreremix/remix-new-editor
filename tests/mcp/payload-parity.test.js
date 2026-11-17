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
    if (!d.required) continue;
    if (n === 'prompt') continue;
    const one = /video/i.test(n) ? VID : /audio/i.test(n) ? AUD : /image|frame|url|mask|swap|reference/i.test(n) ? IMG : (d.enum?.[0] ?? d.default ?? (/int|number/.test(d.type) ? 1 : 'x'));
    out[n] = d.type === 'array' || /_list$|_files$/.test(n) ? [one] : one;
  }
  return out;
};

const CALLS = {
  t2i: (m, i) => client.generateImage({ model: m, ...i }),
  i2i: (m, i) => client.generateI2I({ model: m, ...i }),
  t2v: (m, i) => client.generateVideo({ model: m, ...i }),
  i2v: (m, i) => client.generateI2V({ model: m, ...i }),
  v2v: (m, i) => client.processV2V({ model: m, ...i }),
  lipsync: (m, i) => client.processLipSync({ model: m, ...i }),
  audio: (m, i) => client.generateAudio({ model: m, ...i }),
};

// Model-specific fields the app's own client does not forward (its UI never sets them) while the MCP follows the model's schema.
// An entry here is a documented gap in the app, not in the MCP. The test fails if the app starts (or stops) sending them.
const APP_GAPS = {
  "ai-dance-effects": [
    "prompt"
  ],
  "ai-dress-change": [
    "garment_image_url"
  ],
  "ai-object-eraser": [
    "mask_image_url"
  ],
  "gpt4o-edit": [
    "mask_image_url"
  ],
  "elevenlabs-text-to-dialogue-v3": [
    "dialogue"
  ],
  "gemini-2-5-pro-tts": [
    "dialogue_turns",
    "speakers"
  ],
  "gemini-3-1-flash-tts": [
    "dialogue_turns",
    "speakers"
  ],
  "ltx-2.3-video-extend": [
    "prompt"
  ],
  "mmaudio-v2-video-to-video": [
    "prompt"
  ],
  "runway-aleph-v2v": [
    "prompt"
  ],
  "seedance-2-video-edit": [
    "video_urls"
  ],
  "minimax-music-3.0": [
    "lyrics"
  ],
  "suno-add-instrumental": [
    "tags",
    "title"
  ],
  "suno-add-vocals": [
    "title"
  ],
  "suno-convert-to-wav": [
    "audio_id",
    "task_id"
  ],
  "suno-generate-mashup": [
    "audios_list"
  ]
};

describe('catalog-driven studios send what the MCP would send (every model)', () => {
  for (const [kind, call] of Object.entries(CALLS)) {
    const models = entries.filter((e) => e.kind === kind && !/watermark/.test(e.id) && !e.fixedRoute);
    test.each(models.map((e) => [e.key, e]))(`${kind}: %s`, async (_key, e) => {
      const inputs = { prompt: 'a red fox', ...mediaFor(e) };
      const mcp = catalog.buildRequest(e.key, inputs);
      const appInputs = { ...inputs };
      const f = e.imageField;
      if (f && inputs[f] !== undefined) appInputs.image_url = [].concat(inputs[f])[0];
      await call(e.id, appInputs);
      const got = sent();
      const fixed = endpointFixes[e.id];
      // Where the live catalog corrects a route the app's generic path still sends, the MCP's route wins (see known divergences).
      if (!fixed) expect(got.endpoint).toBe(mcp.endpoint.replace(/^\//, ''));
      const differing = Object.entries(mcp.payload).filter(([k, v]) => JSON.stringify(got.params[k]) !== JSON.stringify(v)).map(([k]) => k).sort();
      if (process.env.PARITY_PRINT && differing.length) process.stderr.write(`PARITY ${e.id} ${JSON.stringify(differing)}\n`);
      expect(differing, `fields the app client does not send as the MCP does for ${e.id}`).toEqual([...(APP_GAPS[e.key] || [])].sort());
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
