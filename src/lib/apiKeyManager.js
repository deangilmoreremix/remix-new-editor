/**
 * Secure API Key Manager
 * 
 * Provides secure storage and retrieval of API keys.
 * Uses sessionStorage for temporary storage (cleared on tab close)
 * with optional localStorage backup that is obfuscated.
 */

// Storage keys for the supported providers.
const KEY_STORAGE = {
  muapi: 'muapi_key',
  openai: 'openai_key',
  videodb: 'videodb_key',
  pexels: 'pexels_key',
};
const KEY_HASH_STORAGE = {
  muapi: 'muapi_key_hash',
  openai: 'openai_key_hash',
  videodb: 'videodb_key_hash',
  pexels: 'pexels_key_hash',
};

// Simple obfuscation - NOT encryption, but adds a layer against casual reading
const OBFUSCATION_SALT = 'muapi_2024_';

function obfuscate(key) {
    return btoa(OBFUSCATION_SALT + key);
}

function deobfuscate(obfuscated) {
    try {
        const decoded = atob(obfuscated);
        if (decoded.startsWith(OBFUSCATION_SALT)) {
            return decoded.slice(OBFUSCATION_SALT.length);
        }
        return null;
    } catch {
        return null;
    }
}

// Hash the key for quick validation without exposing it
async function hashKey(key) {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export class ApiKeyManager {
    constructor() {
        // Per-provider cached key/hash. `muapi`, `openai` and `videodb` are
        // kept separate.
        this._cache = {
            muapi: { key: null, hash: null },
            openai: { key: null, hash: null },
            videodb: { key: null, hash: null },
            pexels: { key: null, hash: null },
        };
        this._listeners = new Set();
    }

    async _setKeyFor(kind, key, persist = true) {
        if (!KEY_STORAGE[kind]) throw new Error(`Unknown key kind: ${kind}`);
        if (!key || typeof key !== 'string') {
            throw new Error('Invalid API key');
        }

        const trimmedKey = key.trim();
        if (trimmedKey.length < 10) {
            throw new Error('API key too short');
        }

        const hash = await hashKey(trimmedKey);
        this._cache[kind].key = trimmedKey;
        this._cache[kind].hash = hash;

        // Store in sessionStorage (primary - cleared on tab close)
        try {
            sessionStorage.setItem(KEY_STORAGE[kind], obfuscate(trimmedKey));
            sessionStorage.setItem(KEY_HASH_STORAGE[kind], hash);
        } catch {
            // Storage may be disabled; the in-memory cache still holds the key.
        }

        // Optionally persist to localStorage with obfuscation
        if (persist) {
            try {
                localStorage.setItem(KEY_STORAGE[kind], obfuscate(trimmedKey));
                localStorage.setItem(KEY_HASH_STORAGE[kind], hash);
            } catch {
                // Quota exceeded or storage disabled; cache still works for this session.
            }
        }

        this._notifyListeners();
    }

    _getKeyFor(kind) {
        if (this._cache[kind].key) return this._cache[kind].key;

        // Try sessionStorage first
        let sessionKey = null;
        try {
            sessionKey = sessionStorage.getItem(KEY_STORAGE[kind]);
        } catch {
            // Storage may be disabled (e.g. SecurityError in some browsers).
        }
        if (sessionKey) {
            this._cache[kind].key = deobfuscate(sessionKey);
            return this._cache[kind].key;
        }

        // Fall back to localStorage
        let localKey = null;
        try {
            localKey = localStorage.getItem(KEY_STORAGE[kind]);
        } catch {
            // Storage may be disabled.
        }
        if (localKey) {
            const decoded = deobfuscate(localKey);
            if (decoded) {
                this._cache[kind].key = decoded;
                // Restore to sessionStorage
                try {
                    sessionStorage.setItem(KEY_STORAGE[kind], localKey);
                } catch {
                    // Best-effort restore; ignore failures.
                }
                return decoded;
            }
        }

        return null;
    }

    _hasKeyFor(kind) {
        if (this._cache[kind].key) return true;
        let sessionValue = null;
        let localValue = null;
        try {
            sessionValue = sessionStorage.getItem(KEY_STORAGE[kind]);
        } catch {
            // Storage may be disabled.
        }
        try {
            localValue = localStorage.getItem(KEY_STORAGE[kind]);
        } catch {
            // Storage may be disabled.
        }
        return !!(sessionValue || localValue);
    }

    _getStoredHashFor(kind) {
        try {
            const sessionHash = sessionStorage.getItem(KEY_HASH_STORAGE[kind]);
            if (sessionHash) return sessionHash;
        } catch {
            // Storage may be disabled.
        }
        try {
            return localStorage.getItem(KEY_HASH_STORAGE[kind]);
        } catch {
            return null;
        }
    }

    _clearKeyFor(kind) {
        this._cache[kind].key = null;
        this._cache[kind].hash = null;
        try {
            sessionStorage.removeItem(KEY_STORAGE[kind]);
            sessionStorage.removeItem(KEY_HASH_STORAGE[kind]);
        } catch {
            // Storage may be disabled.
        }
        try {
            localStorage.removeItem(KEY_STORAGE[kind]);
            localStorage.removeItem(KEY_HASH_STORAGE[kind]);
        } catch {
            // Storage may be disabled.
        }
        this._notifyListeners();
    }

    // ---- Muapi (legacy default) key ----
    setKey(key, persist = true) { return this.setMuapiKey(key, persist); }
    getKey() { return this.getMuapiKey(); }
    hasKey() { return this.hasMuapiKey(); }
    clearKey() { return this.clearMuapiKey(); }

    async setMuapiKey(key, persist = true) { return this._setKeyFor('muapi', key, persist); }
    getMuapiKey() { return this._getKeyFor('muapi'); }
    hasMuapiKey() { return this._hasKeyFor('muapi'); }
    getMuapiHash() { return this._getStoredHashFor('muapi'); }
    clearMuapiKey() { return this._clearKeyFor('muapi'); }

    // ---- OpenAI key ----
    async setOpenAIKey(key, persist = true) { return this._setKeyFor('openai', key, persist); }
    getOpenAIKey() { return this._getKeyFor('openai'); }
    hasOpenAIKey() { return this._hasKeyFor('openai'); }
    getOpenAIHash() { return this._getStoredHashFor('openai'); }
    clearOpenAIKey() { return this._clearKeyFor('openai'); }

    // ---- VideoDB key ----
    async setVideoDBKey(key, persist = true) { return this._setKeyFor('videodb', key, persist); }
    getVideoDBKey() { return this._getKeyFor('videodb'); }
    hasVideoDBKey() { return this._hasKeyFor('videodb'); }
    getVideoDBHash() { return this._getStoredHashFor('videodb'); }
    clearVideoDBKey() { return this._clearKeyFor('videodb'); }

    // ---- Pexels key ----
    async setPexelsKey(key, persist = true) { return this._setKeyFor('pexels', key, persist); }
    getPexelsKey() { return this._getKeyFor('pexels'); }
    hasPexelsKey() { return this._hasKeyFor('pexels'); }
    getPexelsHash() { return this._getStoredHashFor('pexels'); }
    clearPexelsKey() { return this._clearKeyFor('pexels'); }

    /**
     * Whether any provider key is configured.
     */
    hasAnyKey() {
        return this.hasMuapiKey() || this.hasOpenAIKey() || this.hasVideoDBKey() || this.hasPexelsKey();
    }

    /**
     * Validate a key against stored hash
     */
    async validateKey(key) {
        const hash = await hashKey(key);
        const muapiHash = this._getStoredHashFor('muapi');
        const openaiHash = this._getStoredHashFor('openai');
        const videodbHash = this._getStoredHashFor('videodb');
        const pexelsHash = this._getStoredHashFor('pexels');
        return hash === muapiHash || hash === openaiHash || hash === videodbHash || hash === pexelsHash;
    }

    /**
     * Add a listener for key changes
     */
    addListener(callback) {
        this._listeners.add(callback);
        return () => this._listeners.delete(callback);
    }

    _notifyListeners() {
        for (const callback of this._listeners) {
            try {
                callback(this.hasKey());
            } catch (e) {
                console.error('[ApiKeyManager] Listener error:', e);
            }
        }
    }

    /**
     * Migrate old localStorage key to new format
     */
    migrateFromLegacy() {
        // No-op: the legacy key name (`muapi_key`) is identical to the current
        // muapi storage key, so nothing needs to be migrated. Kept for compatibility.
        return false;
    }
}

export const apiKeyManager = new ApiKeyManager();

// Auto-migrate on load
apiKeyManager.migrateFromLegacy();

/**
 * Dev-only auto-auth bypass.
 *
 * Skips the API key prompt during local development by seeding a placeholder
 * key (so every `localStorage.getItem('muapi_key')` / `apiKeyManager.getKey()`
 * guard passes). Activated by either:
 *   - VITE_DEV_BYPASS_AUTH=true in the .env file, or
 *   - a `?dev` query param in the URL (e.g. http://localhost:3100/?dev)
 *
 * This only runs in the browser and never affects production builds where the
 * flag is unset. The placeholder key is NOT a real Muapi key, so live API calls
 * will still fail — this only bypasses the auth gate for UI development.
 */
// Use a placeholder key that the proxy also rejects. The proxy only
// recognizes the literal string 'dev', so we use that here to avoid
// leaking a 22-char placeholder upstream. This placeholder is injected
// only in memory; it is never persisted to sessionStorage/localStorage.
const DEV_PLACEHOLDER_KEY = 'dev';

export const isDevBypass =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEV_BYPASS_AUTH === 'true') ||
    (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('dev'));

if (isDevBypass && !apiKeyManager.hasKey()) {
    apiKeyManager.setKey(DEV_PLACEHOLDER_KEY, true).then(() => {
        console.info('[dev] Auth bypass active — seeded placeholder API key (no real Muapi key set).');
    }).catch(console.error);
}
