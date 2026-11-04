// Auth headers for the ai-thumbnail-generator edge function.
//
// The function runs a Clerk entitlement gate (supabase/functions/_shared/
// clerkAuth.ts): every request must carry the signed-in user's Clerk session
// token as `Authorization: Bearer <token>`, or it is rejected with
// 401 AUTH_REQUIRED. The Supabase anon key still goes in `apikey` for the
// Supabase gateway. Signed-out callers fall back to the anon key so the
// function returns its normal 401 (shown to the user as "sign in").
import { getClerkSessionToken, getSupabaseAnonKey } from './supabase.js';

export async function thumbnailAuthHeaders() {
  const anon = getSupabaseAnonKey();
  const clerkToken = await getClerkSessionToken();
  const headers = { Authorization: `Bearer ${clerkToken || anon}` };
  if (anon) headers.apikey = anon;
  return headers;
}

/**
 * Turn a 401/403 from the entitlement gate into a message people can act on.
 * Returns null for any other error so callers keep their existing message.
 */
export async function thumbnailAuthErrorMessage(error) {
  const res = error?.context;
  const status = res?.status;
  if (status !== 401 && status !== 403) return null;
  let body = null;
  try { body = typeof res.clone === 'function' ? await res.clone().json() : null; } catch { /* not JSON */ }
  if (status === 403 || body?.error === 'PAYMENT_REQUIRED') {
    return 'Thumbnail Studio is part of SmartVideo AI. Upgrade your plan to generate thumbnails.';
  }
  return 'Please sign in to use Thumbnail Studio.';
}
