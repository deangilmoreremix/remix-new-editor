// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { openRecipeModal } from '../lib/recipeIntegration.js';

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
});
