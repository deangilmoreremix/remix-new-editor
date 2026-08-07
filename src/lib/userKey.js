import { apiKeyManager } from './apiKeyManager.js';
import { offlineStorage } from './offline-storage.js';

export function getUserKey() {
    try {
        const userId = offlineStorage.getCurrentUserId();
        if (userId && userId !== 'anonymous') return userId;
    } catch {}

    const key = apiKeyManager.getMuapiKey();
    if (!key) return 'anonymous';
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        const char = key.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return 'user_' + Math.abs(hash).toString(36);
}
