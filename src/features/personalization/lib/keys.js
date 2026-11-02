/**
 * Central client-side API-key resolution.
 *
 * Both the MuAPI key and the OpenAI key are entered by the user in the
 * Settings popup and persisted to localStorage. Previously the OpenAI key was
 * read ONLY from a build-time env var (`NEXT_PUBLIC_OPENAI_API_KEY`), which is
 * empty for end users, so OpenAI image generation always failed with an auth
 * error. Centralizing resolution here guarantees every endpoint category
 * (image / video / social / openai) pulls the key from the same user-supplied
 * source.
 *
 * BYOK note: the MuAPI key has NO env fallback. A server-side MuAPI key would
 * let an upstream call bill the operator instead of the requesting user, so a
 * missing key resolves to '' and the UI prompts the user to add it in Settings.
 */

export const MUAPI_KEY_STORAGE = 'muapi_key';
export const OPENAI_KEY_STORAGE = 'openai_key';
export const MUAPI_KEY_API_ENDPOINT = '/api/auth/muapi-key';
export const MUAPI_KEY_COOKIE = 'muapi_key';
export const OPENAI_KEY_COOKIE = 'openai_key';

// Safely read a localStorage value in any environment (SSR / Node tests).
function readStorage(key) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {
    /* localStorage may throw in private mode / sandboxed iframes */
  }
  return null;
}

/**
 * Resolve the MuAPI key.
 * Priority: explicit arg > window.__MUAPI_KEY__ > localStorage.
 * No server-side env fallback (BYOK): with nothing configured this returns ''
 * and the caller prompts the user to add their key in Settings.
 */
export function resolveMuapiKey(explicitKey) {
  if (explicitKey && String(explicitKey).trim()) return String(explicitKey).trim();
  if (typeof window !== 'undefined' && window.__MUAPI_KEY__) return window.__MUAPI_KEY__;
  const stored = readStorage(MUAPI_KEY_STORAGE);
  if (stored && stored.trim()) return stored.trim();
  return '';
}

/**
 * Resolve the OpenAI key.
 * Priority: explicit arg > localStorage > build-time env var.
 * NOTE: the env fallback is the user-supplied `NEXT_PUBLIC_OPENAI_API_KEY`
 * (public, baked into the client bundle by the user's own build) — never a
 * server secret. For browser users the key comes from localStorage set via
 * the Settings popup.
 */
export function resolveOpenAIKey(explicitKey) {
  if (explicitKey && String(explicitKey).trim()) return String(explicitKey).trim();
  const stored = readStorage(OPENAI_KEY_STORAGE);
  if (stored && stored.trim()) return stored.trim();
  const env =
    (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_OPENAI_API_KEY) || '';
  return env ? String(env).trim() : '';
}

// Minimal sanity check: keys should be non-empty and not obviously pasted
// with surrounding whitespace/quotes. We deliberately do NOT strip non-Latin1
// bytes here — a valid MuAPI/OpenAI key may legitimately contain any byte, and
// stripping previously truncated real keys.
export function isValidKeyFormat(key) {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (trimmed.length < 8) return false;
  // Reject if the user pasted the key wrapped in quotes.
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return false;
  }
  return true;
}

// Strip only known-problematic invisible characters that commonly corrupt
// copied API keys, while preserving all printable ASCII and valid key content.
// This is the single source of truth for key sanitization — import it instead
// of duplicating this logic in every file that handles API keys.
export function cleanApiKey(apiKey) {
  if (!apiKey) return '';
  return String(apiKey)
    .replace(/[\u200B-\u200D\uFEFF\u2060\u00AD]/g, '')
    .replace(/^[\s\u0000-\x1F]+|[\s\u0000-\x1F]+$/g, '')
    .trim();
}
