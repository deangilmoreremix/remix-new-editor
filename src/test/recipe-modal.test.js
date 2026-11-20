// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { openRecipeModal } from '../lib/recipeIntegration.js';

vi.mock('../lib/muapi.js', () => ({
  muapi: {
    generateImage: vi.fn(async () => ({ url: 'https://cdn/img.png' })),
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
    document.querySelector('[data-select-recipe="product-commercial"]').click();
    expect(document.querySelector('.recipe-cost').textContent).toContain('2 paid generation calls');
    document.querySelector('[data-action="run-recipe"]').click();
    await vi.waitFor(() => expect(onRunRecipe).toHaveBeenCalledWith('https://cdn/clip.mp4'));
    expect(document.querySelectorAll('.step--done')).toHaveLength(2);
    const links = [...document.querySelectorAll('.recipe-result a')].map(a => a.getAttribute('href'));
    expect(links).toEqual(['https://cdn/img.png', 'https://cdn/clip.mp4']);
    expect(document.querySelector('.recipe-history__row')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('recipeHistory'))[0].results).toHaveLength(2);
  });
});
