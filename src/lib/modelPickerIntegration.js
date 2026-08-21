// Model Picker integration helper.
export async function openModelPicker({ currentModelId, onSelectModel } = {}) {
  const { ModelPickerModal } = await import('../components/modals/ModelPickerModal.jsx');
  const modal = new ModelPickerModal({
    currentModelId: currentModelId || '',
    onSelectModel: (modelId) => {
      if (typeof onSelectModel === 'function') onSelectModel(modelId);
    }
  });
  modal.open();
}
