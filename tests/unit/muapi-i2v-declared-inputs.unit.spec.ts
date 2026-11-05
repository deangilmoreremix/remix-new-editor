import { describe, it, expect, vi, beforeEach } from 'vitest';

// Review fix on #58: generateI2V forwards the end frame (last_frame_url) and
// Character Lock (character_consistency) to models that declare them.
vi.mock('../../src/lib/apiKeyManager.js', () => ({
  apiKeyManager: {
    getMuapiKey: () => 'test-muapi-key',
    hasMuapiKey: () => true,
    getOpenAIKey: () => null,
  },
}));

import { MuapiClient } from '../../src/lib/muapi.js';

function captureBody() {
  const bodies: any[] = [];
  global.fetch = vi.fn(async (_url, init: any) => {
    bodies.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ outputs: ['https://cdn.test/out.mp4'] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as any;
  return bodies;
}

const sent = (body: any) => body.params || body.payload || body;

describe('generateI2V: declared end-frame and Character Lock inputs', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('sends last_frame_url and character_consistency to Seedance 2.5 I2V (declares both)', async () => {
    const bodies = captureBody();
    await new MuapiClient().generateI2V({
      model: 'seedance-2.5-i2v', prompt: 'a cat', image_url: 'https://cdn.test/s.png',
      last_frame_url: 'https://cdn.test/e.png', character_consistency: true, onlyDeclaredInputs: true,
    });
    const p = sent(bodies[0]);
    expect(p.last_frame_url).toBe('https://cdn.test/e.png');
    expect(p.character_consistency).toBe(true);
  });

  it('does not send character_consistency to a model that does not declare it', async () => {
    const bodies = captureBody();
    await new MuapiClient().generateI2V({
      model: 'kling-v2.6-pro-i2v', prompt: 'a cat', image_url: 'https://cdn.test/s.png',
      character_consistency: true, onlyDeclaredInputs: true,
    });
    const p = sent(bodies[0]);
    expect(p.character_consistency).toBeUndefined();
    expect(p.last_frame_url).toBeUndefined();
  });
});
