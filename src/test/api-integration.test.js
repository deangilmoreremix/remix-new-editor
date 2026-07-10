/**
 * Comprehensive tests for MuapiClient new methods and openaiService fixes.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { MuapiClient, muapi } from '../lib/muapi.js';

describe('MuapiClient new methods', () => {
  let client;

  beforeEach(() => {
    client = new MuapiClient();
    client.proxyUrl = 'https://test.supabase.co/functions/v1/muapi-proxy';
    global.fetch = vi.fn();
  });

  test('generateMusic posts to suno-create-music endpoint and polls', async () => {
    // First call: submit returns request_id
    // Second call: poll returns completed
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ request_id: 'music-123', status: 'processing' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: 'completed',
          outputs: ['https://cdn.muapi.ai/song.mp3']
        })
      });

    const result = await client.generateMusic({ model: 'suno-create-music', prompt: 'cinematic music', duration: 30 });

    expect(fetch).toHaveBeenCalledTimes(2);
    const firstCallBody = JSON.parse(fetch.mock.calls[0][1].body);
    expect(firstCallBody.endpoint).toBe('suno-create-music');
    expect(firstCallBody.params.prompt).toBe('cinematic music');
    expect(result.url).toBe('https://cdn.muapi.ai/song.mp3');
  });

  test('generateMusic falls back to suno-create-music when model missing', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ request_id: 'm1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'completed', outputs: ['url'] }) });

    await client.generateMusic({ prompt: 'test' });

    const callBody = JSON.parse(fetch.mock.calls[0][1].body);
    expect(callBody.endpoint).toBe('suno-create-music');
  });

  test('generateVideoEffect posts to generate_wan_ai_effects and polls', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ request_id: 'fx-123', status: 'processing' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: 'completed',
          outputs: ['https://cdn.muapi.ai/effect.mp4']
        })
      });

    const result = await client.generateVideoEffect({
      prompt: 'make it explode',
      image_url: 'https://example.com/img.jpg',
      name: 'Building Explosion',
      aspect_ratio: '16:9',
      duration: 5
    });

    const callBody = JSON.parse(fetch.mock.calls[0][1].body);
    expect(callBody.endpoint).toBe('generate_wan_ai_effects');
    expect(callBody.params.prompt).toBe('make it explode');
    expect(callBody.params.name).toBe('Building Explosion');
    expect(result.url).toBe('https://cdn.muapi.ai/effect.mp4');
  });

  test('listAssets posts to the first-party /assets backend (not muapi)', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ assets: [{ id: '1', name: 'test' }] })
      });

    const result = await client.listAssets({ project: 'proj-1', category: 'element' });

    const [url, init] = fetch.mock.calls[0];
    expect(url).toMatch(/\/functions\/v1\/assets$/);
    expect(JSON.parse(init.body).project).toBe('proj-1');
    expect(JSON.parse(init.body).category).toBe('element');
    expect(result.assets[0].name).toBe('test');
  });

  test('makeRequest sends generic request to proxy', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: 'ok' })
      });

    const result = await client.makeRequest('custom-endpoint', { foo: 'bar' });

    const callBody = JSON.parse(fetch.mock.calls[0][1].body);
    expect(callBody.endpoint).toBe('custom-endpoint');
    expect(callBody.params.foo).toBe('bar');
    expect(result).toEqual({ result: 'ok' });
  });

  test('makeRequest throws on empty endpoint', async () => {
    await expect(client.makeRequest('', {})).rejects.toThrow('Endpoint is required');
    await expect(client.makeRequest(null, {})).rejects.toThrow('Endpoint is required');
  });

  test('new methods pass AbortSignal to underlying requests', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ request_id: 'sig-1', status: 'processing' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'completed', outputs: ['url'] }) });

    const controller = new AbortController();
    // Calling convention used by studios: signal as second arg
    await client.generateMusic({ prompt: 'test' }, controller.signal);

    // Verify signal was forwarded to fetch calls
    expect(fetch.mock.calls[0][1].signal).toBe(controller.signal);
  });
});

describe('openaiService fixes', () => {
  test('openaiService imports without undefined constant errors', async () => {
    const mod = await import('../lib/openaiService.js');
    expect(mod.openaiService).toBeDefined();
    expect(typeof mod.openaiService.generateImage).toBe('function');
    expect(typeof mod.openaiService.editImage).toBe('function');
    expect(typeof mod.openaiService.generateVariations).toBe('function');
    expect(typeof mod.openaiService.multiTurnImageEditing).toBe('function');
    expect(typeof mod.openaiService.streamImageGeneration).toBe('function');
  });

  test('streamImageGeneration throws descriptive error', async () => {
    const { openaiService } = await import('../lib/openaiService.js');
    await expect(openaiService.streamImageGeneration({ prompt: 'test' }))
      .rejects.toThrow('Streaming image generation is not supported');
  });

  test('generateImage throws when no key configured', async () => {
    const { openaiService } = await import('../lib/openaiService.js');
    await expect(openaiService.generateImage({ prompt: 'test' }))
      .rejects.toThrow('OpenAI API key not configured');
  });

  test('editImage throws when no key configured', async () => {
    const { openaiService } = await import('../lib/openaiService.js');
    await expect(openaiService.editImage({ image: 'base64', prompt: 'test' }))
      .rejects.toThrow('OpenAI API key not configured');
  });

  test('generateVariations throws when no key configured', async () => {
    const { openaiService } = await import('../lib/openaiService.js');
    await expect(openaiService.generateVariations({ image: 'base64' }))
      .rejects.toThrow('OpenAI API key not configured');
  });

  test('multiTurnImageEditing throws when no key configured', async () => {
    const { openaiService } = await import('../lib/openaiService.js');
    await expect(openaiService.multiTurnImageEditing({ input: 'test' }))
      .rejects.toThrow('OpenAI API key not configured');
  });
});

describe('MuapiClient singleton', () => {
  test('exports singleton instance', async () => {
    const { muapi } = await import('../lib/muapi.js');
    expect(muapi).toBeInstanceOf(MuapiClient);
  });

  test('getKey from apiKeyManager', async () => {
    const { muapi } = await import('../lib/muapi.js');
    expect(muapi.getKey).toBeDefined();
    const key = muapi.getKey();
    expect(key === null || typeof key === 'string').toBe(true);
  });
});
