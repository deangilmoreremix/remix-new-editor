// Monetization Hub integration helper.
export async function openMonetizationHub({ onSelectTrack, onSelectTemplate } = {}) {
  const { MonetizationHubModal } = await import('../components/modals/MonetizationHubModal.jsx');
  const modal = new MonetizationHubModal({
    onRunRecipe: (url) => {
      if (typeof onSelectTrack === 'function') onSelectTrack(url);
    }
  });
  modal.open();
}
