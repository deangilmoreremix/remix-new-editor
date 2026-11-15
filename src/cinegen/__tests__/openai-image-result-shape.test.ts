// [remix] An OpenAI image run must be readable by Elements (data.*) AND by Spaces / Studio model nodes (top-level url / images.0.url).
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/editor/ai/openaiImages.js', () => ({
  generateImages: vi.fn(async () => ({ assets: [{ url: 'data:image/png;base64,AAAA' }], model: 'gpt-image-2.6-flare' })),
  DEFAULT_IMAGE_MODEL: 'gpt-image-2.6-flare',
  DETAIL_IMAGE_MODEL: 'gpt-image-2.6-sunburst',
}));

import { runWorkflow } from '../lib/cloud/funding';

describe('OpenAI image result shape', () => {
  it('exposes the image at both data.* and the top level', async () => {
    const r = await runWorkflow({ apiKey: '', nodeId: 'n', nodeType: 'gpt-image-2.6-flare', modelId: 'gpt-image-2.6-flare', outputType: 'image', inputs: { prompt: 'a lantern' } } as never) as Record<string, any>;
    expect(r.url).toBe('data:image/png;base64,AAAA');
    expect(r.images[0].url).toBe('data:image/png;base64,AAAA');
    expect(r.data.url).toBe('data:image/png;base64,AAAA');
    expect(r.data.images[0].url).toBe('data:image/png;base64,AAAA');
  });
});
