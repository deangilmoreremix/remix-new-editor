// Recipe integration helper.
// Outputs are saved to the generation history by the modal itself; this opener
// adds the one thing every studio needs when a run finishes: tell the user where
// the result went. `studio` labels the saved outputs with the studio that opened
// the recipe.
export async function openRecipeModal({ onRunRecipe = () => {}, basePrompt = '', studio = 'image' } = {}) {
  const { RecipeModal } = await import('../components/modals/RecipeModal.jsx');
  const modal = new RecipeModal({
    basePrompt,
    studio,
    onRunRecipe: (url, info = {}) => {
      const count = info.results?.length || 1;
      import('./loading.js')
        .then(({ showToast }) => showToast(
          `${info.recipe?.name || 'Recipe'} finished. ${count} output${count === 1 ? '' : 's'} saved to your Library.`,
          'success'
        ))
        .catch(() => {});
      if (typeof onRunRecipe === 'function') onRunRecipe(url, info);
    }
  });
  modal.open();
  return modal;
}
