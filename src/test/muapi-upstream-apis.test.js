import { describe, test, expect, vi, beforeEach } from 'vitest';
import { MuapiClient } from '../lib/muapi.js';

// Each proxy call: record the JSON body, answer with the next queued response.
function mockProxy(...responses) {
  const calls = [];
  const queue = [...responses];
  global.fetch = vi.fn(async (_url, init) => {
    calls.push(JSON.parse(init.body));
    const next = queue.length > 1 ? queue.shift() : queue[0];
    return { ok: next.ok !== false, status: next.status || 200, statusText: 'OK', text: async () => JSON.stringify(next.body || {}), json: async () => next.body };
  });
  return calls;
}

describe('upstream API calls', () => {
  let client;

  beforeEach(async () => {
    client = new MuapiClient();
    await client.apiKeyManager.setMuapiKey('test-muapi-key');
  });

  test('runMotionGraphics posts the upstream payload and polls to the output', async () => {
    const calls = mockProxy(
      { body: { request_id: 'mg-1' } },
      { body: { status: 'completed', outputs: ['https://cdn.muapi.ai/outputs/mg-unique-1.mp4'] } },
    );
    const ids = [];
    const res = await client.runMotionGraphics({ prompt: 'kinetic title', onRequestId: (id) => ids.push(id) });
    expect(calls[0]).toMatchObject({ endpoint: 'motion-graphics', params: { prompt: 'kinetic title', aspect_ratio: '16:9', duration_seconds: 6 } });
    expect(calls[1].endpoint).toBe('predictions/mg-1/result');
    expect(ids).toEqual(['mg-1']);
    expect(res.url).toContain('mg-unique-1.mp4');
    expect(res.request_id).toBe('mg-1');
  });

  test('runMotionGraphics needs a prompt; edit needs a request id and an edit prompt', async () => {
    mockProxy({ body: {} });
    await expect(client.runMotionGraphics({ prompt: '  ' })).rejects.toThrow(/Describe the motion graphic/);
    await expect(client.runMotionGraphicsEdit({ edit_prompt: 'x' })).rejects.toThrow(/Pick the generation/);
    await expect(client.runMotionGraphicsEdit({ request_id: 'r1', edit_prompt: '' })).rejects.toThrow(/Describe the change/);
  });

  test('runMotionGraphicsEdit sends the source request id', async () => {
    const calls = mockProxy({ body: { request_id: 'mg-2' } }, { body: { status: 'completed', outputs: ['https://cdn.muapi.ai/outputs/mg-unique-2.mp4'] } });
    await client.runMotionGraphicsEdit({ request_id: 'mg-1', edit_prompt: 'make it blue', duration_seconds: 8 });
    expect(calls[0]).toMatchObject({ endpoint: 'motion-graphics-edit', params: { request_id: 'mg-1', edit_prompt: 'make it blue', duration_seconds: 8, aspect_ratio: '16:9' } });
  });

  test('generateMarketingStudioAd picks the 1080p endpoint and forwards references', async () => {
    const calls = mockProxy({ body: { request_id: 'ad-1' } }, { body: { status: 'completed', outputs: ['https://cdn.muapi.ai/outputs/ad-unique-1.mp4'] } });
    await client.generateMarketingStudioAd({ prompt: 'ad', resolution: '1080p', aspect_ratio: '9:16', images_list: ['a.png', 'b.png'], video_files: ['v.mp4'] });
    expect(calls[0].endpoint).toBe('sd-2-vip-omni-reference-1080p');
    expect(calls[0].params).toEqual({ prompt: 'ad', aspect_ratio: '9:16', duration: 5, images_list: ['a.png', 'b.png'], video_files: ['v.mp4'] });

    const calls2 = mockProxy({ body: { request_id: 'ad-2' } }, { body: { status: 'completed', outputs: ['https://cdn.muapi.ai/outputs/ad-unique-2.mp4'] } });
    await client.generateMarketingStudioAd({ prompt: 'ad' });
    expect(calls2[0].endpoint).toBe('seedance-2-vip-omni-reference');
  });

  test('a failed submit surfaces the API error', async () => {
    mockProxy({ ok: false, status: 402, body: { error: 'no credits' } });
    await expect(client.runMotionGraphics({ prompt: 'x' })).rejects.toThrow(/API Request Failed: 402/);
  });

  test('getHistory builds the query and uses a GET-style list call', async () => {
    const calls = mockProxy({ body: { data: [], next_cursor: null } });
    await client.getHistory({ cursor: 'abc+/=', limit: 25 });
    expect(calls[0].endpoint).toBe('history?cursor=abc%2B%2F%3D&limit=25');
    expect(calls[0].generationType).toBe('list');
  });

  test('deleteMedia sends a DELETE through the proxy', async () => {
    const calls = mockProxy({ body: { ok: true } });
    await client.deleteMedia('req-9');
    expect(calls[0]).toMatchObject({ endpoint: 'predictions/req-9/media', apiMethod: 'DELETE' });
    await expect(client.deleteMedia('')).rejects.toThrow(/request id/);
  });

  test('calculateDynamicCost and estimateV2VCost post the expected bodies', async () => {
    const calls = mockProxy({ body: { cost: 3 } });
    await client.calculateDynamicCost('nano-banana', { prompt: 'x' });
    expect(calls[0]).toMatchObject({ endpoint: 'app/calculate_dynamic_cost', params: { task_name: 'nano-banana', payload: { prompt: 'x' } } });

    const calls2 = mockProxy({ body: { cost: 5 } });
    await client.estimateV2VCost({ model: 'Some-Endpoint', video_url: 'v.mp4', signal: undefined });
    expect(calls2[0].endpoint).toBe('models/some-endpoint/estimate-cost');
    expect(calls2[0].params).toEqual({ video_url: 'v.mp4' });
    await expect(client.estimateV2VCost({})).rejects.toThrow(/model is required/);
  });

  test('app interest routes post the app name and list interests', async () => {
    const calls = mockProxy({ body: { ok: true } });
    await client.registerAppInterest('OpenClaw');
    expect(calls[0]).toMatchObject({ endpoint: 'app/interest', params: { app_name: 'OpenClaw' } });
    await client.getAppInterests();
    expect(calls[1]).toMatchObject({ endpoint: 'app/interests', generationType: 'list' });
    await expect(client.registerAppInterest('')).rejects.toThrow(/app name/);
  });
});

describe('face-swap image models', () => {
  test('generateI2I sends the second image under the model swapField', async () => {
    const client = new MuapiClient();
    await client.apiKeyManager.setMuapiKey('test-muapi-key');
    const calls = mockProxy({ body: { request_id: 'fs-1' } }, { body: { status: 'completed', outputs: ['https://cdn.muapi.ai/outputs/fs-unique-1.png'] } });
    await client.generateI2I({ model: 'ai-image-face-swap', image_url: 'https://cdn.example.com/target.png', images_list: ['https://cdn.example.com/target.png'], swap_url: 'https://cdn.example.com/face.png' });
    expect(calls[0].endpoint).toBe('ai-image-face-swap');
    expect(calls[0].params.swap_url).toBe('https://cdn.example.com/face.png');
  });
});
