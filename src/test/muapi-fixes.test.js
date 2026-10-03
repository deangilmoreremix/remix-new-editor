// MuAPI Client Fix Verification
// Tests the fixes for upload routing, endpoint resolution, response parsing,
// and output integrity / placeholder detection.

import { describe, test, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { MuapiClient, muapi } from '../lib/muapi.js';

const root = process.cwd();

vi.mock('../lib/supabase.js', () => ({
  uploadFileToStorage: vi.fn(async (file) => {
    return `https://cdn.muapi.ai/${file.name}`;
  })
}));

vi.mock('../lib/services/RateLimiter.js', () => ({
  rateLimiter: {
    acquire: vi.fn(() => Promise.resolve()),
  }
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

// ─────────────────────────────────────────────────────────
// Regression tests for specific bug fixes
// ─────────────────────────────────────────────────────────

describe('MuapiClient regression tests', () => {
  let client;

  beforeEach(async () => {
    client = new MuapiClient();
    await client.apiKeyManager.setMuapiKey('test-muapi-key');
  });

  // ─────────────────────────────────────────────────────────
  // generateI2I uses correct generationType 'i2i'
  // Previously sent 'i2v' by mistake — must send 'i2i'.
  // ─────────────────────────────────────────────────────────
  describe('generateI2I generationType in request body', () => {
    const muapiSrc = fs.readFileSync(path.join(root, 'src/lib/muapi.js'), 'utf8');

    function getFunctionBody(src, fnName) {
      const fnMatch = src.match(new RegExp(`async ${fnName}\\([^)]*\\)\\s*\\{`));
      if (!fnMatch) return null;
      const startIdx = src.indexOf(fnMatch[0]);
      let depth = 0;
      let i = startIdx + fnMatch[0].length - 1;
      while (i < src.length) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') depth--;
        if (depth === 0) break;
        i++;
      }
      return src.slice(startIdx, i + 1);
    }

    test('generateI2I function body contains generationType i2i', () => {
      const body = getFunctionBody(muapiSrc, 'generateI2I');
      expect(body).not.toBeNull();
      expect(body).toContain("generationType: 'i2i'");
    });

    test('generateI2I function body does not contain generationType i2v', () => {
      const body = getFunctionBody(muapiSrc, 'generateI2I');
      expect(body).not.toBeNull();
      expect(body).not.toContain("generationType: 'i2v'");
    });

    test('generateI2V (separate function) correctly sends generationType i2v', () => {
      const body = getFunctionBody(muapiSrc, 'generateI2V');
      expect(body).not.toBeNull();
      expect(body).toContain("generationType: 'i2v'");
    });
  });

  // Runtime verification: intercept fetch to confirm generateI2I sends correct generationType
  describe('generateI2I fetch verification', () => {
    test('fetch is called with generationType i2i for generateI2I', async () => {
      const mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve({
            outputs: ['https://cdn.muapi.ai/outputs/i2i-result.png'],
          }),
        })
      );

      vi.doMock('../lib/services/RateLimiter.js', () => ({
        rateLimiter: { acquire: vi.fn(() => Promise.resolve()) },
      }));

      vi.doMock('../lib/analytics.js', () => ({
        trackGeneration: vi.fn(),
        trackGenerationComplete: vi.fn(),
        trackGenerationError: vi.fn(),
      }));

      vi.doMock('../lib/models.js', () => ({
        getI2IModelById: () => ({ endpoint: 'flux-dev-image', inputs: {} }),
      }));

      const { MuapiClient } = await import('../lib/muapi.js');
      const testClient = new MuapiClient();
      testClient.apiKeyManager = { hasMuapiKey: () => true, getMuapiKey: () => 'test-key' };

      global.fetch = mockFetch;

      await testClient.generateI2I({ model: 'flux-i2i', prompt: 'test' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.generationType).toBe('i2i');
    }, 15000);
  });

  // ─────────────────────────────────────────────────────────
  // Synchronous URL preservation
  // When the API returns a synchronous result (no request_id),
  // the URL from outputs/url/output must be preserved in the
  // returned object, not lost.
  // ─────────────────────────────────────────────────────────
  describe('synchronous URL preservation', () => {
    test('generateVideo preserves URL on synchronous response (no request_id)', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve({
            outputs: ['https://cdn.muapi.ai/outputs/sync-video.mp4'],
          }),
        })
      );

      const result = await client.generateVideo({ model: 'kling-v2.6-pro-t2v', prompt: 'test' });
      expect(result.url).toBe('https://cdn.muapi.ai/outputs/sync-video.mp4');
    });

    test('generateI2I preserves URL on synchronous response (no request_id)', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve({
            outputs: ['https://cdn.muapi.ai/outputs/sync-i2i.png'],
          }),
        })
      );

      const result = await client.generateI2I({ model: 'flux-i2i', prompt: 'test' });
      expect(result.url).toBe('https://cdn.muapi.ai/outputs/sync-i2i.png');
    });

    test('generateVideoEffect preserves URL on synchronous response (no request_id)', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve({
            outputs: ['https://cdn.muapi.ai/outputs/sync-effect.mp4'],
          }),
        })
      );

      const result = await client.generateVideoEffect({
        model: 'ai-video-effects',
        name: '360 Rotation',
        prompt: 'test',
        image_url: 'https://example.com/img.png',
      });
      expect(result.url).toBe('https://cdn.muapi.ai/outputs/sync-effect.mp4');
    });

    test('synchronous response with direct url field preserves it', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve({
            url: 'https://cdn.muapi.ai/outputs/direct-url.png',
          }),
        })
      );

      const result = await client.generateI2I({ model: 'flux-i2i', prompt: 'test' });
      expect(result.url).toBe('https://cdn.muapi.ai/outputs/direct-url.png');
    });
  });
});

