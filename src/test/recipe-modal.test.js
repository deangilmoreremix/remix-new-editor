// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { openRecipeModal } from '../lib/recipeIntegration.js';
import { muapi } from '../lib/muapi.js';
import { registerGeneration } from '../lib/generationHistory.js';
import { showToast } from '../lib/loading.js';

const saved = [];
vi.mock('../lib/generationHistory.js', () => ({
  registerGeneration: vi.fn(async (studio, type, url, meta) => { saved.push({ studio, type, url, ...meta, timestamp: new Date().toISOString() }); return {}; }),
  loadGenerationHistory: vi.fn(async () => saved.map((e) => ({ ...e }))),
}));
vi.mock('../lib/loading.js', () => ({ showToast: vi.fn() }));

vi.mock('../lib/muapi.js', () => ({
  muapi: {
    generateImage: vi.fn(async () => ({ url: 'https://cdn/img.png' })),
    generateI2I: vi.fn(async () => ({ url: 'https://cdn/img.png' })),
    uploadFile: vi.fn(async () => 'https://cdn/uploaded.jpg'),
    generateI2V: vi.fn(async () => ({ url: 'https://cdn/clip.mp4' })),
  },
}));

describe('RecipeModal', () => {
  let modal;
  afterEach(() => {
    modal?.destroy();
    document.body.innerHTML = '';
    saved.length = 0;
    vi.clearAllMocks();
  });

  it('opens with recipes and responds to selection and search', async () => {
    modal = await openRecipeModal({ basePrompt: 'red sneakers' });
    const overlay = document.querySelector('.modal-overlay');
    expect(overlay).toBeTruthy();
    expect(document.querySelectorAll('.recipe-card').length).toBeGreaterThan(1);

    document.querySelector('[data-select-recipe="product-commercial"]').click();
    expect(document.querySelector('.recipe-card.selected')?.dataset.selectRecipe).toBe('product-commercial');
    expect(document.querySelector('[data-action="run-recipe"]')).toBeTruthy();
    expect(document.querySelector('[data-base-prompt]').value).toBe('red sneakers');
    // Body refresh must not rebuild the overlay (which would drop it from view).
    expect(document.querySelector('.modal-overlay')).toBe(overlay);

    const search = document.querySelector('[data-search]');
    search.value = 'cinematic';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const names = [...document.querySelectorAll('.recipe-name')].map(n => n.textContent);
    expect(names).toEqual(['Cinematic Short']);
  });

  it('runs a recipe: marks each step done, links every output, and records history', async () => {
    localStorage.clear();
    const onRunRecipe = vi.fn();
    modal = await openRecipeModal({ basePrompt: 'red sneakers', onRunRecipe });
    document.querySelector('[data-select-recipe="social-ad-bundle"]').click();
    expect(document.querySelector('.recipe-cost').textContent).toContain('2 paid generation calls');
    expect(document.querySelector('.recipe-reference')).toBeNull();
    document.querySelector('[data-action="run-recipe"]').click();
    await vi.waitFor(() => expect(onRunRecipe).toHaveBeenCalledWith('https://cdn/clip.mp4', expect.objectContaining({ results: expect.any(Array) })));
    expect(document.querySelectorAll('.step--done')).toHaveLength(2);
    const links = [...document.querySelectorAll('.recipe-result a')].map(a => a.getAttribute('href'));
    expect(links).toEqual(['https://cdn/img.png', 'https://cdn/clip.mp4']);
    // Outputs are saved to the app's generation history, labelled with the studio.
    expect(registerGeneration).toHaveBeenCalledTimes(2);
    expect(registerGeneration).toHaveBeenNthCalledWith(1, 'image', 'image', 'https://cdn/img.png',
      expect.objectContaining({ model: 'flux-dev', parameters: expect.objectContaining({ recipe_id: 'social-ad-bundle', step: 1 }) }));
    expect(registerGeneration).toHaveBeenNthCalledWith(2, 'image', 'video', 'https://cdn/clip.mp4',
      expect.objectContaining({ parameters: expect.objectContaining({ step: 2, step_label: 'Generate video variant' }) }));
    // The finished-run callback gets the full result list, and the user is told where it went.
    expect(onRunRecipe.mock.calls[0][1].results).toHaveLength(2);
    await vi.waitFor(() => expect(showToast).toHaveBeenCalledWith(expect.stringContaining('2 outputs saved to your Library'), 'success'));
    // "Recent runs" is read back from the history, not from this modal's memory.
    await vi.waitFor(() => expect(document.querySelector('.recipe-history__row')).toBeTruthy());
    expect([...document.querySelectorAll('.recipe-history__row a')].map(a => a.getAttribute('href'))).toEqual(['https://cdn/img.png', 'https://cdn/clip.mp4']);
  });

  it('keeps Run disabled for photo recipes until a photo is uploaded, then runs with it', async () => {
    localStorage.clear();
    const onRunRecipe = vi.fn();
    modal = await openRecipeModal({ basePrompt: 'on wet asphalt', onRunRecipe });
    document.querySelector('[data-select-recipe="product-commercial"]').click();
    expect(document.querySelector('.recipe-reference')).toBeTruthy();
    expect(document.querySelector('[data-action="run-recipe"]').disabled).toBe(true);

    const input = document.querySelector('[data-reference-file]');
    const file = new File(['x'], 'shoe.jpg', { type: 'image/jpeg' });
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(document.querySelector('[data-action="run-recipe"]').disabled).toBe(false));
    expect(muapi.uploadFile).toHaveBeenCalledWith(file);
    expect(document.querySelector('.recipe-reference__preview img').getAttribute('src')).toBe('https://cdn/uploaded.jpg');

    document.querySelector('[data-action="run-recipe"]').click();
    await vi.waitFor(() => expect(onRunRecipe).toHaveBeenCalled());
    const { generateI2I } = muapi;
    expect(generateI2I.mock.calls[0][0]).toMatchObject({ model: 'ai-product-shot', image_url: 'https://cdn/uploaded.jpg', scene_description: 'on wet asphalt' });
  });

  it('accepts a pasted image link, rejects a non-link, and shows an upload error', async () => {
    modal = await openRecipeModal({ basePrompt: 'x' });
    document.querySelector('[data-select-recipe="character-promo"]').click();
    const url = document.querySelector('[data-reference-url]');
    url.value = 'https://cdn/face.jpg';
    url.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.querySelector('[data-action="run-recipe"]').disabled).toBe(false);
    url.dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.querySelector('.recipe-reference__preview img').getAttribute('src')).toBe('https://cdn/face.jpg');
    document.querySelector('[data-action="clear-reference"]').click();
    expect(document.querySelector('[data-action="run-recipe"]').disabled).toBe(true);

    const url2 = document.querySelector('[data-reference-url]');
    url2.value = 'not a link';
    url2.dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.querySelector('.recipe-reference__error').textContent).toContain('http');

    muapi.uploadFile.mockRejectedValueOnce(new Error('too big'));
    const input = document.querySelector('[data-reference-file]');
    Object.defineProperty(input, 'files', { value: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(document.querySelector('.recipe-reference__error').textContent).toContain('too big'));
    expect(document.querySelector('[data-action="run-recipe"]').disabled).toBe(true);
  });

  it('only lists shortcuts that exist', async () => {
    modal = await openRecipeModal({});
    modal.showShortcuts = true;
    modal._refresh();
    const keys = [...document.querySelectorAll('.shortcut-row kbd')].map(k => k.textContent);
    expect(keys).toEqual(['⌘/', '⌘F', 'Esc']);
  });

  it('shows recent runs from the history when the modal is opened', async () => {
    saved.push(
      { studio: 'image', type: 'image', url: 'https://cdn/old1.png', timestamp: '2026-11-01T10:00:00Z', parameters: { recipe_id: 'social-ad-bundle', run_id: 'r1', step: 1, step_label: 'Generate hero image' } },
      { studio: 'image', type: 'video', url: 'https://cdn/old2.mp4', timestamp: '2026-11-01T10:01:00Z', parameters: { recipe_id: 'social-ad-bundle', run_id: 'r1', step: 2, step_label: 'Generate video variant' } },
      { studio: 'image', type: 'image', url: 'https://cdn/other.png', timestamp: '2026-11-02T10:00:00Z', parameters: { recipe_id: 'character-promo', run_id: 'r2', step: 1, step_label: 'Generate character' } },
    );
    modal = await openRecipeModal({});
    document.querySelector('[data-select-recipe="social-ad-bundle"]').click();
    await vi.waitFor(() => expect(document.querySelectorAll('.recipe-history__row')).toHaveLength(1));
    expect([...document.querySelectorAll('.recipe-history__row a')].map(a => a.getAttribute('href'))).toEqual(['https://cdn/old1.png', 'https://cdn/old2.mp4']);
  });

  describe('cancel', () => {
    const hang = (signal) => new Promise((_, reject) => {
      signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); });
    });

    it('stops a running recipe, keeps nothing unfinished, and does not report success', async () => {
      muapi.generateImage.mockImplementationOnce((_p, signal) => hang(signal));
      const onRunRecipe = vi.fn();
      modal = await openRecipeModal({ basePrompt: 'x', onRunRecipe });
      document.querySelector('[data-select-recipe="social-ad-bundle"]').click();
      document.querySelector('[data-action="run-recipe"]').click();
      await vi.waitFor(() => expect(document.querySelector('[data-action="cancel-recipe"]')).toBeTruthy());
      expect(document.querySelector('.recipe-cost + .recipe-cost, .recipe-cost')).toBeTruthy();
      document.querySelector('[data-action="cancel-recipe"]').click();
      await vi.waitFor(() => expect(document.querySelector('[data-action="cancel-recipe"]')).toBeNull());
      expect(document.querySelector('.step--cancelled')).toBeTruthy();
      expect(document.querySelector('.recipe-log').textContent).toContain('Recipe cancelled.');
      expect(muapi.generateI2V).not.toHaveBeenCalled();
      expect(registerGeneration).not.toHaveBeenCalled();
      expect(onRunRecipe).not.toHaveBeenCalled();
      expect(document.querySelector('[data-action="run-recipe"]').disabled).toBe(false);
    });

    it('keeps an output that finished before the cancel', async () => {
      let release;
      muapi.generateI2V.mockImplementationOnce((_p, signal) => new Promise((resolve) => { release = () => resolve({ url: 'https://cdn/late.mp4' }); signal.addEventListener('abort', () => release()); }));
      modal = await openRecipeModal({ basePrompt: 'x' });
      document.querySelector('[data-select-recipe="social-ad-bundle"]').click();
      document.querySelector('[data-action="run-recipe"]').click();
      await vi.waitFor(() => expect(muapi.generateI2V).toHaveBeenCalled());
      document.querySelector('[data-action="cancel-recipe"]').click();
      await vi.waitFor(() => expect(document.querySelector('.recipe-log').textContent).toContain('Recipe cancelled.'));
      // The image step finished before the cancel; the late video result is kept too (it was paid for).
      expect(registerGeneration).toHaveBeenCalledTimes(2);
    });

    it('closing the modal mid-run aborts the run', async () => {
      let signalSeen;
      muapi.generateImage.mockImplementationOnce((_p, signal) => { signalSeen = signal; return hang(signal); });
      modal = await openRecipeModal({ basePrompt: 'x' });
      document.querySelector('[data-select-recipe="social-ad-bundle"]').click();
      document.querySelector('[data-action="run-recipe"]').click();
      await vi.waitFor(() => expect(signalSeen).toBeTruthy());
      modal.destroy();
      expect(signalSeen.aborted).toBe(true);
    });
  });
});
