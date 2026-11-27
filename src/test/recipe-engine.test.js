import { describe, it, expect, vi } from 'vitest';
import { loadGenerationHistory } from '../lib/generationHistory.js';
import { RECIPES, getRecipeById, runRecipe } from '../lib/recipeEngine.js';

const fakeClient = (outputs = {}) => ({
  generateI2I: vi.fn(async () => ({ url: outputs.i2i ?? 'https://cdn/img.png' })),
  generateImage: vi.fn(async () => ({ url: outputs.image ?? 'https://cdn/img.png' })),
  generateI2V: vi.fn(async () => ({ url: outputs.i2v ?? 'https://cdn/clip.mp4' })),
  generateVideo: vi.fn(async () => ({ url: outputs.t2v ?? 'https://cdn/t2v.mp4' })),
  generateAudio: vi.fn(async () => ({ url: outputs.audio ?? 'https://cdn/song.mp3' })),
  processVideoTool: vi.fn(async () => ({ url: outputs.tool ?? 'https://cdn/up.mp4' })),
});

describe('runRecipe chaining', () => {
  it('sends the previous output as image_url and keeps the base prompt as the prompt', async () => {
    const client = fakeClient();
    const url = await runRecipe(client, getRecipeById('product-commercial'), { basePrompt: 'red sneaker', referenceImage: 'https://cdn/shoe.jpg' });
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
    await expect(runRecipe(client, getRecipeById('product-commercial'), { basePrompt: 'x', referenceImage: 'https://cdn/shoe.jpg', onStep, onLog })).rejects.toThrow('boom');
    expect(onStep.mock.calls.some(c => c[0].status === 'done' && c[0].url === 'https://cdn/img.png')).toBe(true);
    expect(onLog).toHaveBeenCalledWith('Error: boom');
  });

  it('stops instead of calling a chained step with nothing to chain from', async () => {
    const client = fakeClient();
    client.generateI2I.mockResolvedValueOnce({});
    await expect(runRecipe(client, getRecipeById('product-commercial'), { basePrompt: 'x', referenceImage: 'https://cdn/shoe.jpg' })).rejects.toThrow(/needs the previous step/);
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

  it('Product Commercial sends the photo as image_url and the text as scene_description (no prompt) to ai-product-shot', async () => {
    const client = fakeClient();
    await runRecipe(client, getRecipeById('product-commercial'), { basePrompt: 'on wet asphalt at night', referenceImage: 'https://cdn/shoe.jpg' });
    const params = client.generateI2I.mock.calls[0][0];
    expect(params.model).toBe('ai-product-shot');
    expect(params.image_url).toBe('https://cdn/shoe.jpg');
    expect(params.scene_description).toBe('on wet asphalt at night');
    expect(params).not.toHaveProperty('prompt');
    expect(client.generateImage).not.toHaveBeenCalled();
    expect(client.generateI2V.mock.calls[0][0].image_url).toBe('https://cdn/img.png');
  });

  it('Character Promo sends the face reference as image_url to flux-pulid', async () => {
    const client = fakeClient();
    await runRecipe(client, getRecipeById('character-promo'), { basePrompt: 'in a neon city', referenceImage: 'https://cdn/face.jpg' });
    const params = client.generateImage.mock.calls[0][0];
    expect(params).toMatchObject({ model: 'flux-pulid', image_url: 'https://cdn/face.jpg', prompt: 'in a neon city' });
    expect(client.generateI2V.mock.calls[0][0].image_url).toBe('https://cdn/img.png');
  });

  it('refuses to start a recipe that needs a photo without one, before any paid call', async () => {
    for (const id of ['product-commercial', 'character-promo']) {
      const client = fakeClient();
      const onLog = vi.fn();
      await expect(runRecipe(client, getRecipeById(id), { basePrompt: 'x', onLog })).rejects.toThrow(/is required/);
      expect(client.generateI2I).not.toHaveBeenCalled();
      expect(client.generateImage).not.toHaveBeenCalled();
      expect(onLog).toHaveBeenCalledWith(expect.stringContaining('Error:'));
    }
  });

  it('every reference step belongs to a recipe that declares a reference', () => {
    for (const r of RECIPES) {
      if (r.steps.some(s => s.reference)) expect(r.reference?.required).toBe(true);
      if (r.reference) expect(r.steps[0].reference).toBe(true);
    }
  });

  it('cancels before the next step and never starts it', async () => {
    const client = fakeClient();
    const ctrl = new AbortController();
    client.generateImage.mockImplementationOnce(async () => { ctrl.abort(); return { url: 'https://cdn/img.png' }; });
    const onStep = vi.fn();
    const onLog = vi.fn();
    await expect(runRecipe(client, getRecipeById('social-ad-bundle'), { basePrompt: 'x', signal: ctrl.signal, onStep, onLog })).rejects.toMatchObject({ name: 'AbortError' });
    expect(client.generateI2V).not.toHaveBeenCalled();
    // The step that returned after the cancel is still reported (it was paid for).
    expect(onStep.mock.calls.some(c => c[0].status === 'done' && c[0].url === 'https://cdn/img.png')).toBe(true);
    expect(onLog.mock.calls.filter(c => c[0] === 'Cancelled')).toHaveLength(1);
  });

  it('passes the abort signal to the muapi call and refuses to start when already aborted', async () => {
    const client = fakeClient();
    const ctrl = new AbortController();
    await runRecipe(client, getRecipeById('music-track'), { basePrompt: 'x', signal: ctrl.signal });
    expect(client.generateAudio.mock.calls[0][1]).toBe(ctrl.signal);
    ctrl.abort();
    await expect(runRecipe(fakeClient(), getRecipeById('music-track'), { basePrompt: 'x', signal: ctrl.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('runRecipe saves finished videos to the Library', () => {
  it('registers every video step, not only the last one', async () => {
    localStorage.removeItem('video_history');
    await runRecipe(fakeClient({ i2v: 'https://cdn/recipe-clip.mp4' }), getRecipeById('product-commercial'), { basePrompt: 'red sneaker', referenceImage: 'https://cdn/shoe.jpg' });
    await new Promise((r) => setTimeout(r, 0));
    const urls = (await loadGenerationHistory()).filter((h) => h.type === 'video').map((h) => h.url);
    expect(urls).toContain('https://cdn/recipe-clip.mp4');
  });
});
