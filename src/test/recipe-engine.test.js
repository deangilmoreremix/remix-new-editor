import { describe, it, expect, vi } from 'vitest';
import { RECIPES, getRecipeById, runRecipe } from '../lib/recipeEngine.js';

const fakeClient = (outputs = {}) => ({
  generateImage: vi.fn(async () => ({ url: outputs.image ?? 'https://cdn/img.png' })),
  generateI2V: vi.fn(async () => ({ url: outputs.i2v ?? 'https://cdn/clip.mp4' })),
  generateVideo: vi.fn(async () => ({ url: outputs.t2v ?? 'https://cdn/t2v.mp4' })),
  generateAudio: vi.fn(async () => ({ url: outputs.audio ?? 'https://cdn/song.mp3' })),
  processVideoTool: vi.fn(async () => ({ url: outputs.tool ?? 'https://cdn/up.mp4' })),
});

describe('runRecipe chaining', () => {
  it('sends the previous output as image_url and keeps the base prompt as the prompt', async () => {
    const client = fakeClient();
    const url = await runRecipe(client, getRecipeById('product-commercial'), { basePrompt: 'red sneaker' });
    expect(url).toBe('https://cdn/clip.mp4');
    const params = client.generateI2V.mock.calls[0][0];
    expect(params.image_url).toBe('https://cdn/img.png');
    expect(params.prompt).toBe('red sneaker');
    expect(params.model).toBe('wan-3.0-i2v');
  });

  it('sends the generated clip to the upscaler as video_url', async () => {
    const client = fakeClient();
    await runRecipe(client, getRecipeById('upscale-workflow'), { basePrompt: 'city timelapse' });
    expect(client.generateVideo).toHaveBeenCalledTimes(1);
    expect(client.processVideoTool.mock.calls[0][0].video_url).toBe('https://cdn/t2v.mp4');
  });

  it('reports every finished step, not just the last', async () => {
    const client = fakeClient();
    const onStep = vi.fn();
    await runRecipe(client, getRecipeById('cinematic-short'), { basePrompt: 'a storm', onStep });
    const done = onStep.mock.calls.map(c => c[0]).filter(s => s.status === 'done');
    expect(done.map(s => s.url)).toEqual(['https://cdn/t2v.mp4', 'https://cdn/song.mp3']);
    expect(client.generateAudio.mock.calls[0][0].prompt).toBe('Cinematic soundtrack for: a storm');
  });

  it('throws when a step fails, after delivering earlier outputs', async () => {
    const client = fakeClient();
    client.generateI2V.mockRejectedValueOnce(new Error('boom'));
    const onStep = vi.fn();
    const onLog = vi.fn();
    await expect(runRecipe(client, getRecipeById('product-commercial'), { basePrompt: 'x', onStep, onLog })).rejects.toThrow('boom');
    expect(onStep.mock.calls.some(c => c[0].status === 'done' && c[0].url === 'https://cdn/img.png')).toBe(true);
    expect(onLog).toHaveBeenCalledWith('Error: boom');
  });

  it('stops instead of calling a chained step with nothing to chain from', async () => {
    const client = fakeClient({ image: '' });
    client.generateImage.mockResolvedValueOnce({});
    await expect(runRecipe(client, getRecipeById('product-commercial'), { basePrompt: 'x' })).rejects.toThrow(/needs the previous step/);
    expect(client.generateI2V).not.toHaveBeenCalled();
  });

  it('every chained step declares a supported input and no recipe uses a URL as a prompt', () => {
    for (const r of RECIPES) {
      r.steps.forEach((s, i) => {
        expect(s.prompt).not.toContain('{{previous}}');
        if (s.input) {
          expect(['image_url', 'video_url', 'audio_url']).toContain(s.input);
          expect(i).toBeGreaterThan(0);
        }
      });
    }
  });
});
