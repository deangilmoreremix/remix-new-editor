/**
 * Clerk session token helper
 *
 * The server-side entitlement gates (Supabase Edge Functions `muapi-proxy`
 * and `ai-thumbnail-generator`, plus the Netlify functions `cinegen`,
 * `timeline-script`, `timeline-image-generate` and `pixabay-search`) require
 * `Authorization: Bearer <Clerk session token>` on every paid endpoint.
 *
 * App auth is vanilla @clerk/clerk-js: `window.Clerk` is the loaded instance
 * (see `clerkInit.js` — the shared singleton `ensureClerkLoaded()`), and
 * `window.Clerk.session.getToken()` resolves the current session JWT.
 *
 * Behavior contract:
 *   - Clerk not loaded yet / no session -> resolves `null` (never throws)
 *   - Signed-out sessions resolve `null` (getToken returns null)
 *   - Expired tokens are refreshed by clerk-js itself — `session.getToken()`
 *     transparently returns a fresh JWT, so no manual refresh logic is needed
 *   - Single-flight: parallel callers share one in-flight `getToken()` call
 *   - Short TTL (~30s) cache so bursts of requests don't hammer Clerk
 */

const TOKEN_TTL_MS = 30_000;

let cachedToken = null;
let cachedAt = 0;
let inFlight = null;

function getClerkSession() {
    if (typeof window === 'undefined') return null;
    const clerk = window.Clerk;
    // clerk-js sets `window.Clerk` to the instance once loading starts; until
    // `load()` resolves there is no `.session`.
    if (!clerk || !clerk.session) return null;
    return clerk.session;
}

async function fetchToken() {
    const session = getClerkSession();
    if (!session || typeof session.getToken !== 'function') return null;
    try {
        const token = await session.getToken();
        return token || null;
    } catch {
        // Clerk still loading, signed out, or a transient refresh failure.
        // Return null so callers keep their previous (header-less) behavior
        // and the server gate answers with 401 AUTH_REQUIRED.
        return null;
    }
}

/**
 * Resolve the current Clerk session JWT.
 *
 * @returns {Promise<string|null>} The session token, or `null` when Clerk is
 *   unavailable, not loaded yet, or the user is signed out.
 */
export async function getClerkToken() {
    if (cachedToken && Date.now() - cachedAt < TOKEN_TTL_MS) {
        return cachedToken;
    }
    if (!inFlight) {
        inFlight = fetchToken()
            .then((token) => {
                if (token) {
                    cachedToken = token;
                    cachedAt = Date.now();
                }
                return token;
            })
            .finally(() => {
                inFlight = null;
            });
    }
    return inFlight;
}

/**
 * Headers object carrying the Clerk bearer token — empty when unavailable.
 * Merge into a fetch `headers` object or pass as the `headers` option of
 * `supabase.functions.invoke()` (invoke-level headers win over client-level).
 *
 * @returns {Promise<{ Authorization?: string }>}
 */
export async function getClerkAuthHeaders() {
    const token = await getClerkToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Drop the cached token (sign-out, Clerk reload, tests). The next call
 * re-fetches from `window.Clerk.session.getToken()`.
 */
export function resetClerkTokenCache() {
    cachedToken = null;
    cachedAt = 0;
    inFlight = null;
}

export default getClerkToken;
