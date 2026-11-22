/**
 * Guest identity: lets a visitor publish, create personal links and read their
 * leads without an account.
 *
 * The browser keeps a long-lived credential (proof of being "this guest") in
 * localStorage and trades it for a short-lived Supabase token at
 * netlify/functions/guest-token.js. The token's `sub` is a private guest id, so
 * the same owner-only RLS that protects signed-in users protects a guest.
 *
 * `getGuestOwnerClient()` returns a Supabase client that signs every request with
 * the current guest token. It is used ONLY by the publish / personal-link / lead
 * code; the app-wide client keeps its existing behaviour.
 *
 * A guest identity lives in this one browser: clearing site data loses access
 * until the guest has signed in and claimed their content (guestClaim in this file).
 */
import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseAnonKey } from './supabase.js';

export const GUEST_CREDENTIAL_KEY = 'remix_guest_credential';
const TOKEN_ENDPOINT = '/.netlify/functions/guest-token';
// Ask for a new token comfortably before the 1-hour one expires.
const REFRESH_SKEW_MS = 5 * 60 * 1000;

let session = null; // { token, sub, expiresAt }
let inflight = null;
let client = null;

const safeStorage = () => {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
};

export function readGuestCredential(storage = safeStorage()) {
  try { return storage?.getItem(GUEST_CREDENTIAL_KEY) || null; } catch { return null; }
}
function writeGuestCredential(value, storage = safeStorage()) {
  try { if (value) storage?.setItem(GUEST_CREDENTIAL_KEY, value); else storage?.removeItem(GUEST_CREDENTIAL_KEY); } catch { /* storage blocked: the guest lasts for this tab only */ }
}

/** Forget this browser's guest (after claiming, or to start over). */
export function clearGuestIdentity(storage = safeStorage()) {
  writeGuestCredential(null, storage);
  session = null;
  client = null;
}

/** True when this browser already has a guest identity (so it may have content to claim). */
export const hasGuestIdentity = (storage = safeStorage()) => !!readGuestCredential(storage);

const decodeExpiry = (token, fallbackSeconds = 3600) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (Number(payload.exp) > 0) return Number(payload.exp) * 1000;
  } catch { /* fall back to expires_in */ }
  return Date.now() + fallbackSeconds * 1000;
};

async function exchange(credential, fetchImpl) {
  const res = await fetchImpl(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credential ? { credential } : {}),
  });
  let body = null;
  try { body = await res.json(); } catch { /* handled below */ }
  return { status: res.status, ok: res.ok && body?.ok, body };
}

/**
 * The current guest session { token, sub }, creating a guest the first time.
 * @param {{ fetchImpl?: typeof fetch, storage?: Storage|null, now?: () => number }} [deps]
 */
export async function getGuestSession({ fetchImpl = (...a) => globalThis.fetch(...a), storage = safeStorage(), now = Date.now } = {}) {
  if (session && session.expiresAt - REFRESH_SKEW_MS > now()) return { token: session.token, sub: session.sub };
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      let credential = readGuestCredential(storage);
      let r = await exchange(credential, fetchImpl);
      // A credential the server no longer accepts (expired or from another deployment): start a new guest.
      if (credential && r.status === 401) {
        writeGuestCredential(null, storage);
        credential = null;
        r = await exchange(null, fetchImpl);
      }
      if (!r.ok) {
        const err = new Error(r.status === 429 ? 'Too many new guest sessions from this network. Please try again later or sign in.' : (r.body?.message || 'Guest access is unavailable right now. Please sign in.'));
        err.code = r.status === 429 ? 'guest_rate_limited' : 'guest_unavailable';
        throw err;
      }
      if (r.body.credential) writeGuestCredential(r.body.credential, storage);
      session = { token: r.body.token, sub: r.body.sub, expiresAt: decodeExpiry(r.body.token, r.body.expires_in) };
      return { token: session.token, sub: session.sub };
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * A Supabase client that acts as this guest. The token is re-read on every request, so a long editing
 * session never sends an expired one.
 */
export async function getGuestOwnerClient(deps = {}) {
  await getGuestSession(deps);
  if (client) return client;
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) throw Object.assign(new Error('The video service is unavailable'), { code: 'guest_unavailable' });
  const baseFetch = (...a) => globalThis.fetch(...a);
  client = (deps.createClientImpl || createClient)(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (input, init = {}) => {
        const { token } = await getGuestSession(deps);
        const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined) || {});
        headers.set('Authorization', `Bearer ${token}`);
        return (deps.fetchImpl ? deps.fetchImpl : baseFetch)(input, { ...init, headers });
      },
    },
  });
  return client;
}

/**
 * After sign-in: move this browser's guest videos, links and leads to the signed-in account.
 * @param {string} clerkToken  the Clerk session token (Authorization for the claim endpoint)
 * @returns {Promise<{ moved: { videos: number, links: number, leads: number } }>}
 */
export async function claimGuestContent(clerkToken, { fetchImpl = (...a) => globalThis.fetch(...a), storage = safeStorage() } = {}) {
  const credential = readGuestCredential(storage);
  if (!credential) return { moved: { videos: 0, links: 0, leads: 0 } };
  const res = await fetchImpl('/.netlify/functions/guest-claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clerkToken}` },
    body: JSON.stringify({ credential }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) throw new Error(body.message || 'Could not move your videos and links to your account.');
  clearGuestIdentity(storage);
  return { moved: body.moved || { videos: 0, links: 0, leads: 0 } };
}

/** Test seam: forget cached state. */
export function __resetGuestIdentityForTests() {
  session = null;
  inflight = null;
  client = null;
}
