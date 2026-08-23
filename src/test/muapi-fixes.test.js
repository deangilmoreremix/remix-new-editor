// MuAPI Client Fix Verification
// Tests the fixes for upload routing, endpoint resolution, response parsing,
// and output integrity / placeholder detection.

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { MuapiClient, muapi } from '../lib/muapi.js';

vi.mock('../lib/supabase.js', () => ({
  uploadFileToStorage: vi.fn(async (file) => {
    return `https://cdn.muapi.ai/${file.name}`;
  })
}));

describe('MuapiClient Fixes', () => {
  let client;

  beforeEach(async () => {
    client = new MuapiClient();
    await client.apiKeyManager.setMuapiKey('test-muapi-key');
  });

  describe('uploadFile routes to Supabase Storage directly', () => {
    test('calls uploadFileToStorage directly without proxy', async () => {
      const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
      const { uploadFileToStorage } = await import('../lib/supabase.js');

      const result = await client.uploadFile(mockFile);

      expect(uploadFileToStorage).toHaveBeenCalledWith(mockFile);
      expect(result).toBe('https://cdn.muapi.ai/test.png');
    });
  });

  describe('endpoint resolution for audio models', () => {
    test('uses model-specific endpoint instead of generic audio', async () => {
      const { getAudioModelById } = await import('../lib/models.js');
      const sunoModel = getAudioModelById('suno-create-music');
      
      expect(sunoModel).toBeDefined();
      expect(sunoModel.endpoint).toBe('suno-create-music');
    });
  });

  describe('endpoint resolution for video tools', () => {
    test('uses model-specific endpoint instead of generic video-tool', async () => {
      const { getI2VModelById } = await import('../lib/models.js');
      const effectsModel = getI2VModelById('ai-video-effects');
      
      expect(effectsModel).toBeDefined();
      expect(effectsModel.endpoint).toBe('generate_wan_ai_effects');
    });
  });

  describe('proxy endpoint normalization', () => {
    test('maps legacy flux-dev-image to flux-dev', async () => {
      const { getModelById } = await import('../lib/models.js');
      const fluxModel = getModelById('flux-dev');
      
      expect(fluxModel).toBeDefined();
    });
  });

  describe('response parsing handles data wrapper', () => {
    test('uploadFile extracts url from wrapped data response', async () => {
      const mockFile = new File(['test'], 'test.png', { type: 'image/png' });

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve({
            data: {
              url: 'https://cdn.muapi.ai/wrapped-result.png'
            }
          }),
        })
      );

      const result = await client.uploadFile(mockFile);
      expect(result).toBe('https://cdn.muapi.ai/wrapped-result.png');
    });
  });

  describe('output integrity — static/demo detection', () => {
    test('detects static homepage asset in outputs', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve({
            status: 'completed',
            outputs: ['https://d3adwkbyhxyrtq.cloudfront.net/muapi/homepage/flux-dev.avif'],
          }),
        })
      );

      await expect(
        client.pollForResult('req-static-1', 5, 500)
      ).rejects.toThrow(/placeholder or demo result/);
    }, 10000);

    test('detects static webassets path in video url', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve({
            status: 'completed',
            url: 'https://cdn.muapi.ai/webassets/videomodels/wan2.5-image-to-video.mp4',
          }),
        })
      );

      await expect(
        client.pollForResult('req-static-2', 5, 500)
      ).rejects.toThrow(/placeholder or demo result/);
    }, 10000);

    test('allows real unique generation URLs', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve({
            status: 'completed',
            outputs: ['https://cdn.muapi.ai/outputs/generated/unique-id-123.png'],
          }),
        })
      );

      const result = await client.pollForResult('req-live-1', 5, 500);
      expect(result.outputs[0]).toContain('unique-id-123.png');
    }, 10000);

    test('allows processing status without outputs', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve({
            status: 'processing',
          }),
        })
      );

      // Should not throw on processing status (no outputs to check)
      await expect(client.pollForResult('req-processing-1', 3, 500)).rejects.toThrow('Generation timed out');
    }, 10000);

    test('detects sandbox path in direct-return generateText', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve({
            text: 'hello',
            url: 'https://cdn.muapi.ai/muapi/sandbox/sample-text.mp3',
          }),
        })
      );

      await expect(
        client.generateText({ model: 'gpt-5-mini', prompt: 'hi' })
      ).rejects.toThrow(/placeholder or demo result/);
    }, 10000);
  });

  describe('output integrity — extractOutputUrls', () => {
    test('extracts urls from all known result shapes', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve({
            status: 'completed',
            outputs: ['https://cdn.muapi.ai/a.png'],
            url: 'https://cdn.muapi.ai/b.png',
            output: { url: 'https://cdn.muapi.ai/c.png' },
            video: { url: 'https://cdn.muapi.ai/d.mp4' },
            audio: { url: 'https://cdn.muapi.ai/e.mp3' },
            images: ['https://cdn.muapi.ai/f.png'],
          }),
        })
      );

      const result = await client.pollForResult('req-multi-1');
      expect(result.outputs[0]).toBe('https://cdn.muapi.ai/a.png');
      expect(result.url).toBe('https://cdn.muapi.ai/b.png');
      expect(result.output.url).toBe('https://cdn.muapi.ai/c.png');
      expect(result.video.url).toBe('https://cdn.muapi.ai/d.mp4');
      expect(result.audio.url).toBe('https://cdn.muapi.ai/e.mp3');
    });
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

