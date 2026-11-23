import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { muapi } from '../lib/muapi.js';
import { MUAPI_APP_TEMPLATES } from '../lib/muapiAppTemplates.js';
import appsMap from '../data/muapiStudioAppsMap.json';

// Mocked fetch: nothing leaves the machine. Confirms that a muapi app template's model, once run
// through the real client, produces the endpoint and payload shape the Studio uses
// (see muapiStudioAppsMap.json -> meta.howItWorks).
let calls;
beforeEach(() => {
  calls = [];
  muapi.apiKeyManager = { hasMuapiKey: () => true, getMuapiKey: () => 'test-key', getProvider: () => 'muapi' };
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return { ok: true, status: 200, statusText: 'OK', json: async () => ({ outputs: ['https://example.com/out.png'], status: 'completed' }), text: async () => '' };
  }));
});
afterEach(() => vi.unstubAllGlobals());

const tpl = (slug) => MUAPI_APP_TEMPLATES.find((t) => t.id === `muapi-${slug}`);
const endpointOf = (slug) => appsMap.apps.find((a) => a.id === slug).endpoint.model;

describe('muapi app templates through the real client (mocked network)', () => {
  it('image preset (Angles) sends images_list to the seedream edit endpoint', async () => {
    const t = tpl('angles');
    await muapi.generateI2I({ model: t.model, prompt: 'p', image_url: 'https://example.com/in.png', aspect_ratio: '1:1', resolution: '1K' });
    expect(calls).toHaveLength(1);
    const { endpoint, params } = calls[0].body;
    expect(endpoint).toBe(endpointOf('angles'));
    expect(params.images_list).toEqual(['https://example.com/in.png']);
    expect(params.prompt).toBe('p');
    expect(params.aspect_ratio).toBe('1:1');
  });

  it('video preset (Mukbang) sends images_list, aspect ratio and duration to seedance', async () => {
    const t = tpl('mukbang');
    await muapi.generateI2V({ model: t.model, prompt: 'p', image_url: 'https://example.com/in.png', aspect_ratio: '16:9', duration: 5 });
    const { endpoint, params } = calls[0].body;
    expect(endpoint).toBe(endpointOf('mukbang'));
    expect(params.images_list).toEqual(['https://example.com/in.png']);
    expect(params.duration).toBe(5);
  });

  it('video preset on wan (Recast) sends a single image_url', async () => {
    const t = tpl('recast');
    await muapi.generateI2V({ model: t.model, prompt: 'p', image_url: 'https://example.com/in.png', aspect_ratio: '16:9', resolution: '480p', duration: 5 });
    const { endpoint, params } = calls[0].body;
    expect(endpoint).toBe(endpointOf('recast'));
    expect(params.image_url).toBe('https://example.com/in.png');
    expect(params.images_list).toBeUndefined();
  });

  it('image face swap forwards the second image as swap_url', async () => {
    const t = tpl('face-swap');
    await muapi.generateI2I({ model: t.model, image_url: 'https://example.com/a.png', swap_url: 'https://example.com/b.png' });
    const { endpoint, params } = calls[0].body;
    expect(endpoint).toBe(endpointOf('face-swap'));
    expect(params.image_url).toBe('https://example.com/a.png');
    expect(params.swap_url).toBe('https://example.com/b.png');
  });
});
