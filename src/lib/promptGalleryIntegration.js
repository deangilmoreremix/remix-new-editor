// Prompt Gallery integration helper.
// Opens PromptGalleryModal and forwards the selected prompt through the provided callback.
export async function openPromptGallery({ appTheme = 'timeline-editor', onSelect } = {}) {
  const { PromptGalleryModal } = await import('../components/modals/PromptGalleryModal.jsx');
  const modal = new PromptGalleryModal({
    appTheme,
    onPromptSelect: (text) => {
      if (typeof onSelect === 'function') onSelect(text);
    }
  });
  modal.open();
}
