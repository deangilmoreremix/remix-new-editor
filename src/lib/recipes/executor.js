// Recipe Executor — runs a registered recipe by building its prompt and
// delegating to SmartVideo's existing router. No generation logic is
// duplicated here; studios are reached through the standard navigate() flow,
// and the built prompt is broadcast so any studio can opt in to prefill.

import { getRecipe } from './registry.js';
import { navigate } from '../router.js';

const state = { last: null };

export function executeRecipe(id, context = {}) {
  const recipe = getRecipe(id);
  if (!recipe) {
    console.warn(`[Recipes] unknown recipe: ${id}`);
    return null;
  }

  const prompt = recipe.buildPrompt(context);
  const application = {
    recipeId: id,
    recipeTitle: recipe.title,
    target: recipe.target,
    prompt,
    context,
    at: Date.now(),
  };
  state.last = application;

  if (typeof window !== 'undefined') {
    window.__lastRecipeApplication = application;
    window.dispatchEvent(new CustomEvent('recipe:applied', { detail: application }));
  }

  // Delegate to the existing router — existing studio execution only.
  navigate(recipe.target, {});
  return application;
}

export function getLastRecipeApplication() {
  return state.last;
}

export { getRecipePrompt } from './registry.js';
