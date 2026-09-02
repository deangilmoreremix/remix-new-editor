// Recipe integration helper.
export async function openRecipeModal({ onRunRecipe = () => {} } = {}) {
  const { RecipeModal } = await import('../components/modals/RecipeModal.jsx');
  const modal = new RecipeModal({
    onRunRecipe: (url) => {
      if (typeof onRunRecipe === 'function') onRunRecipe(url);
    }
  });
  modal.open();
}
