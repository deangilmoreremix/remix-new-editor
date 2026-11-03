// Recipe integration helper.
export async function openRecipeModal({ onRunRecipe = () => {}, basePrompt = '' } = {}) {
  const { RecipeModal } = await import('../components/modals/RecipeModal.jsx');
  const modal = new RecipeModal({
    basePrompt,
    onRunRecipe: (url) => {
      if (typeof onRunRecipe === 'function') onRunRecipe(url);
    }
  });
  modal.open();
  return modal;
}
