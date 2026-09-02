export const MODAL_SHORTCUTS = (extra = {}) => ({
  '⌘/': 'Show shortcuts',
  '⌘F': 'Focus search',
  'Esc': 'Close',
  ...extra,
});

export function renderShortcutsOverlay(shortcuts) {
  return `
    <div class="shortcuts-overlay" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div class="shortcuts-panel">
        <h3>Keyboard Shortcuts</h3>
        <div class="shortcuts-list">
          ${Object.entries(shortcuts).map(([key, label]) => `
            <div class="shortcut-row">
              <kbd>${key}</kbd>
              <span class="shortcut-label">${label}</span>
            </div>
          `).join('')}
        </div>
        <button type="button" class="modal-btn modal-btn-secondary shortcuts-close-btn">Close</button>
      </div>
    </div>
  `;
}
