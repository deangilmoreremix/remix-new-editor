// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { openRecipeModal } from '../lib/recipeIntegration.js';
import { muapi } from '../lib/muapi.js';

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
    await vi.waitFor(() => expect(onRunRecipe).toHaveBeenCalledWith('https://cdn/clip.mp4'));
    expect(document.querySelectorAll('.step--done')).toHaveLength(2);
    const links = [...document.querySelectorAll('.recipe-result a')].map(a => a.getAttribute('href'));
    expect(links).toEqual(['https://cdn/img.png', 'https://cdn/clip.mp4']);
    expect(document.querySelector('.recipe-history__row')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('recipeHistory'))[0].results).toHaveLength(2);
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
});
