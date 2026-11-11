import { describe, it, expect } from 'vitest';
import { MuAPIProvider } from '../generationService.js';

// The AI Tools routes (google-imagen4, veo3-text-to-video) name models that
// declare no `endpoint`; the request must go to the model's own route, not a
// generic /generate one.
describe('MuAPIProvider.buildRequest endpoint fallback', () => {
  const provider = new MuAPIProvider();

  it('uses the model id for image generation', () => {
    const r = provider.buildRequest({ mode: 'generate-image', model: 'google-imagen4', prompt: 'a cat' });
    expect(r.endpoint).toBe('google-imagen4');
  });

  it('uses the model id for text-to-video', () => {
    const r = provider.buildRequest({ mode: 'text-to-video', model: 'veo3-text-to-video', prompt: 'a cat' });
    expect(r.endpoint).toBe('veo3-text-to-video');
  });

  it('still uses a generic route when no model is given', () => {
    expect(provider.buildRequest({ mode: 'generate-image', prompt: 'a cat' }).endpoint).toBe('generate');
  });
});
