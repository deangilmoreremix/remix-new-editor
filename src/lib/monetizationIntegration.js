// Monetization Hub integration helper.
export async function openMonetizationHub({ onSelectTrack, onSelectTemplate } = {}) {
  const { MonetizationHubModal } = await import('../components/modals/MonetizationHubModal.jsx');
  const modal = new MonetizationHubModal({
    onSelectTrack: (url) => {
      if (typeof onSelectTrack === 'function') onSelectTrack(url);
    },
    onSelectTemplate: (template) => {
      if (typeof onSelectTemplate === 'function') onSelectTemplate(template);
    }
  });
  modal.open();
}
