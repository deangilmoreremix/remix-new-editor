import { apiKeyManager } from '../lib/apiKeyManager.js';

export function AuthModal(onSuccess) {
    const existing = document.querySelector('[data-auth-modal]');
    if (existing) existing.remove();

    import('./SettingsModal.js').then(({ SettingsModal }) => {
        const overlay = SettingsModal(() => {
            if (apiKeyManager.hasAnyKey() && onSuccess) {
                onSuccess();
            }
        });
        document.body.appendChild(overlay);
    }).catch((err) => {
        console.error('[AuthModal] Failed to open settings modal:', err);
    });
}
