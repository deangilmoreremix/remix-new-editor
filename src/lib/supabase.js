import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// The shared owner identity for callers without a verified Clerk session.
// The app-tagged RLS policies scope a no-JWT caller to strictly this owner,
// so it must never be replaced by a per-key hash or any other local value.
const ANONYMOUS_USER_ID = 'anonymous';

// Validate environment variables at startup
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] Missing required environment variables: VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY');
  // Provide a graceful degradation - still export client but log warning
}

// Create client with error handling (kept raw — the identity proxy below
// refreshes its Authorization / x-user-key headers on every request).
let rawClient = createSupabaseClient();

// ─── Verified identity (Clerk → Supabase token exchange) ─────────────────────
//
// The public anon key cannot prove who the caller is, so the `x-user-key`
// header alone is not a security boundary. When a Clerk session exists the
// client fetches a short-lived Supabase-compatible JWT from the
// netlify/functions/supabase-token token exchange and presents it as
// `Authorization: Bearer <token>`. The RLS policies trust the JWT's `sub`
// claim (the database verifies the signature) and only fall back to the
// header-derived 'anonymous' owner when no verified JWT is present.
//
// When the exchange is unavailable (no SUPABASE_JWT_SECRET, function not
// deployed, offline) the client degrades to today's header identity so
// nothing breaks.

const TOKEN_ENDPOINT = import.meta.env.VITE_SUPABASE_TOKEN_FUNCTION_URL
  || (typeof window !== 'undefined' && window.location && window.location.origin
    ? `${window.location.origin}/.netlify/functions/supabase-token`
    : '');
const TOKEN_STORAGE_KEY = 'remix_supabase_access_token';
// Refresh comfortably before the minted token expires (server TTL is 1 hour).
const TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1000;
const DEFAULT_TOKEN_TTL_MS = 60 * 60 * 1000;

let cachedToken = null; // { value, subject, expiresAt }
let tokenInFlight = null;

/** Authenticated user id from the Clerk singleton (null when signed out). */
function getClerkUserId() {
  try {
    const user = window.Clerk?.user;
    return user && user.id ? user.id : null;
  } catch {
    return null;
  }
}

/**
 * Single source of truth for the caller identity used by this client — and
 * by every shared-database write derived from it (storage paths and
 * public.media row identity):
 *   - the verified Clerk user id when a Clerk session exists,
 *   - otherwise STRICTLY the shared 'anonymous' owner.
 * The offline per-key hash from userKey.js is never an identity here: under
 * the app-tagged RLS policies a caller without a verified JWT is scoped to
 * 'anonymous' only, so a hashed owner would be denied. Signed-in callers
 * always produce the Clerk user id — the same identity authContext.js
 * exposes — so every writer path agrees.
 */
function getIdentity() {
  const clerkId = getClerkUserId();
  if (clerkId) return clerkId;
  return ANONYMOUS_USER_ID;
}

/** Reconciles the requested identity with the cached token. */
function usableToken(identity) {
  if (!cachedToken || !cachedToken.value) return null;
  if (cachedToken.subject !== identity) return null;
  if (cachedToken.expiresAt <= Date.now() + TOKEN_REFRESH_SKEW_MS) return null;
  return cachedToken;
}

function readStoredToken() {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.value === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredToken(token) {
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token));
  } catch { /* storage unavailable — in-memory cache still serves this tab */ }
}

function clearCachedToken() {
  cachedToken = null;
}

/**
 * Preferred expiry for a minted token: its own `exp` claim (decoded client
 * side), falling back to the endpoint's `expires_in`. Never throws.
 */
function decodeTokenExpiry(token, fallbackSeconds) {
  const fallback = Date.now() + Math.max(1, Number(fallbackSeconds) || 3600) * 1000;
  try {
    const payload = token.split('.')[1];
    if (!payload) return fallback;
    const json = typeof atob === 'function'
      ? atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
      : null;
    if (!json) return fallback;
    const exp = Number(JSON.parse(json).exp);
    if (Number.isFinite(exp) && exp > 0) return exp * 1000;
  } catch { /* malformed payload — trust expires_in */ }
  return fallback;
}

async function fetchClerkSessionToken() {
  try {
    const session = window.Clerk?.session;
    if (!session || typeof session.getToken !== 'function') return null;
    const token = await session.getToken();
    return token || null;
  } catch {
    return null;
  }
}

/**
 * Fetch (and cache) the verified Supabase access token for the current
 * caller. Returns null when no Clerk session exists or the exchange is
 * unavailable — callers then keep using the `x-user-key` header identity.
 * Never throws, never logs any token material.
 */
export async function getSupabaseAccessToken({ forceRefresh = false } = {}) {
  const identity = getIdentity();
  if (!identity || identity === 'anonymous') {
    // Anonymous callers have no session to exchange.
    return null;
  }

  if (!forceRefresh) {
    const cached = usableToken(identity);
    if (cached) return cached.value;
    const stored = readStoredToken();
    if (stored && stored.subject === identity
        && stored.expiresAt > Date.now() + TOKEN_REFRESH_SKEW_MS) {
      cachedToken = stored;
      return stored.value;
    }
  }

  if (tokenInFlight) return tokenInFlight;

  tokenInFlight = (async () => {
    try {
      const clerkToken = await fetchClerkSessionToken();
      if (!clerkToken) return null;
      if (typeof fetch !== 'function' || !TOKEN_ENDPOINT) return null;
      const response = await fetch(TOKEN_ENDPOINT, {
        method: 'GET',
        headers: { Authorization: `Bearer ${clerkToken}` },
      });
      if (!response || !response.ok) return null;
      const payload = await response.json();
      const value = payload?.token;
      if (!value) return null;
      const ttlSeconds = Number(payload?.expires_in) > 0 ? Number(payload.expires_in) : 3600;
      cachedToken = {
        value,
        subject: identity,
        expiresAt: decodeTokenExpiry(value, ttlSeconds),
      };
      if (cachedToken.expiresAt > Date.now() + DEFAULT_TOKEN_TTL_MS * 2) {
        // Guard against a bogus far-future expires_in.
        cachedToken.expiresAt = Date.now() + DEFAULT_TOKEN_TTL_MS;
      }
      writeStoredToken(cachedToken);
      return cachedToken.value;
    } catch {
      // Exchange unavailable — the caller falls back to the header identity.
      return null;
    } finally {
      tokenInFlight = null;
    }
  })();

  return tokenInFlight;
}

/**
 * FAIL-CLOSED guard for shared-database writes.
 *
 * The `x-user-key` header is client-controlled and is no longer trusted by any
 * RLS policy, so a signed-in caller whose verified Supabase token cannot be
 * obtained (token exchange unreachable, SUPABASE_JWT_SECRET not configured)
 * must NOT silently degrade to that header identity — otherwise a broken
 * exchange would quietly turn authenticated writes into unauthenticated ones.
 * Callers with a real identity must present a verified token; anonymous
 * callers are the caller's responsibility (the Asset Library requires sign-in
 * for durable assets).
 *
 * @param {string} identity the resolved database identity (Clerk id or 'anonymous')
 * @throws Error with code SECURE_SESSION_UNAVAILABLE when a non-anonymous
 *         identity cannot be backed by a verified token.
 */
export async function assertVerifiedWriteIdentity(identity) {
  if (!identity || identity === 'anonymous') return; // anonymous scope, not a verified identity
  const token = await getSupabaseAccessToken();
  if (!token) {
    const err = new Error(
      'Secure session unavailable — cannot verify your identity for this upload. Please try again shortly.',
    );
    err.code = 'SECURE_SESSION_UNAVAILABLE';
    throw err;
  }
}

/**
 * Attach the caller identity to a raw Supabase client:
 *   - verified JWT present  → `Authorization: Bearer <jwt>` (the RLS policies
 *     then derive the owner from the verified `sub` claim and ignore the
 *     header entirely; the truthful `x-user-key` stays attached for the
 *     server-side consumers that still read it),
 *   - no verified identity  → `x-user-key` alone (anonymous header
 *     fallback, unchanged behaviour).
 */
function applyIdentity(client, token) {
  const identity = getIdentity();
  // Identity changed (sign-out / account switch): the cached token is stale.
  if (cachedToken && identity && cachedToken.subject !== identity) clearCachedToken();
  const bearer = token ? `Bearer ${token}` : null;
  try {
    if (client?.rest?.headers) {
      if (bearer) client.rest.headers.Authorization = bearer;
      else delete client.rest.headers.Authorization;
      client.rest.headers['x-user-key'] = identity;
    }
    if (client?.storage?.headers) {
      if (bearer) client.storage.headers.Authorization = bearer;
      else delete client.storage.headers.Authorization;
      client.storage.headers['x-user-key'] = identity;
    }
  } catch { /* identity unavailable — policies fall back to the anonymous owner */ }
}

/**
 * Prime a client's identity, awaiting the token exchange so requests after
 * this call carry the verified identity. Resolves immediately for anonymous
 * callers or when the exchange is unavailable.
 */
export async function primeSupabaseIdentity(client = rawClient) {
  const token = await getSupabaseAccessToken();
  applyIdentity(client, token);
  return token;
}

/**
 * Create the underlying Supabase client, degrading to a mock when the SDK
 * cannot be constructed (missing/invalid config, test environments).
 */
function createSupabaseClient() {
  try {
    return createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder', {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      global: {
        headers: {
          'X-Client-Info': 'smartvideo'
        }
      }
    });
  } catch (error) {
    console.error('[Supabase] Failed to initialize client:', error);
    // Return a mock client for graceful degradation
    return {
      storage: {
        from: () => ({
          upload: () => Promise.reject(new Error('Supabase not configured')),
          getPublicUrl: () => ({ data: { publicUrl: null } })
        })
      },
      auth: {
        getSession: () => Promise.resolve({ data: { session: null } })
      }
    };
  }
}

/**
 * Attach the caller identity to every request. Signed-in callers get the
 * cached verified JWT as `Authorization` (the policies then trust the
 * verified `sub` claim, not the header); anonymous callers keep the
 * `x-user-key` fallback. The identity can change at runtime (Clerk
 * sign-in/out), so it is refreshed lazily on every `.from()` / `.storage`
 * access instead of being frozen at startup. When no verified token is
 * cached yet, an exchange is kicked off in the background so the next
 * request carries it.
 */
function refreshUserHeader(client) {
  const identity = getIdentity();
  const cached = usableToken(identity);
  applyIdentity(client, cached ? cached.value : null);
  if (identity !== 'anonymous' && !cached) {
    // Warm the cache in the background; this request still carries the
    // header identity (which equals the Clerk id when signed in).
    getSupabaseAccessToken().then((token) => {
      if (token) applyIdentity(rawClient, token);
    }).catch(() => {});
  }
}

/**
 * Caller identity shared by every consumer of this module: the verified
 * Clerk user id when signed in, otherwise STRICTLY 'anonymous'. Every
 * shared-database write built on it (upload path identity, media row
 * identity, the identity headers) follows this same rule.
 */
export function getUserKey() {
  return getIdentity();
}

/** Refresh the shared client's identity header (also called internally). */
export function refreshSupabaseUserHeader() {
  refreshUserHeader(rawClient);
}

// Wrap the client so identity-bearing requests always carry a fresh
// verified `Authorization` (or the anonymous `x-user-key` fallback); the
// proxy is transparent to all existing consumers.
const supabase = new Proxy(rawClient, {
  get(target, prop) {
    if (prop === 'from' || prop === 'storage' || prop === 'rpc' || prop === 'functions') {
      refreshUserHeader(target);
    }
    const value = target[prop];
    return typeof value === 'function' ? value.bind(target) : value;
  }
});

export { supabase, rawClient };

export function isSupabaseConfigured() {
  return !!(supabaseUrl && supabaseAnonKey);
}

export function getSupabaseUrl() {
  return supabaseUrl || '';
}

export function getSupabaseAnonKey() {
  return import.meta.env.VITE_SUPABASE_ANON_KEY || '';
}

export async function uploadFileToStorage(file) {
  // Prime the verified identity so the upload carries a trusted `sub`.
  await primeSupabaseIdentity();
  const ext = sanitizeFileExtension(file.name);
  const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
  // App-tagged prefix: the `uploads` bucket is shared with other apps, so
  // this app's objects live under `smartvideo/${userId}/...` (governed by the
  // smartvideo_uploads_* storage policies). The path identity is the same
  // shared-DB identity every writer uses — the Clerk user id when signed
  // in, otherwise 'anonymous' — never the offline BYOK hash.
  const path = `smartvideo/${getIdentity()}/${uniqueName}`;

  const timeoutMs = 60000;
  const uploadPromise = supabase.storage
    .from('uploads')
    .upload(path, file, { contentType: file.type, upsert: false });

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Upload to storage timed out')), timeoutMs);
  });

  const { error } = await Promise.race([uploadPromise, timeoutPromise]).catch(err => ({ error: err }));

  if (error) {
    // Preserve original error code for debugging
    const enhanced = new Error(`Upload failed: ${error.message || error}`);
    enhanced.code = error.code || error.statusCode;
    enhanced.originalError = error;
    throw enhanced;
  }

  const { data: urlData } = supabase.storage
    .from('uploads')
    .getPublicUrl(path);

  return urlData.publicUrl;
}

/**
 * Sanitize file extension to prevent path traversal.
 * Extracts only the last extension, rejects paths with slashes.
 */
function sanitizeFileExtension(fileName) {
  if (!fileName) return 'bin';
  // Reject any path separators
  if (fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) {
    return 'bin';
  }
  const parts = fileName.split('.');
  if (parts.length < 2) return 'bin';
  // Only use the last extension, alphanumeric only
  const ext = parts.pop().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return ext || 'bin';
}
