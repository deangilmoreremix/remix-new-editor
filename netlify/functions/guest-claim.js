// netlify/functions/guest-claim.js
//
// Moves a guest's videos, personal links and leads to the signed-in account.
//
//   POST { credential }  with  Authorization: Bearer <Clerk session token>
//   -> { ok, moved: { videos, links, leads } }
//
// Both identities are proven here before anything moves: the Clerk token (withClerkAuth)
// and the guest credential (signed by guest-token.js). Only then does the service role call
// claim_guest_content(guest, user), which re-owns the rows in one transaction. A signed-in
// account can claim many guests (several browsers); a guest can be claimed once, since the
// rows no longer belong to the guest afterwards.
//
// Required environment: SUPABASE_JWT_SECRET, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL (or VITE_SUPABASE_URL).
import { withClerkAuth } from './_shared/clerkAuth.js';
import { guestKeys, verifyCredential, MAX_BODY } from './guest-token.js';

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});
const fail = (statusCode, error, message) => json(statusCode, { ok: false, error, message });

export async function claim({ userId, credential }, { fetchImpl = fetch, env = process.env, nowSeconds = Math.floor(Date.now() / 1000) } = {}) {
  const keys = guestKeys(env);
  const url = String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!keys || !url || !key) return fail(503, 'not_configured', 'Moving guest content is not configured');
  if (typeof userId !== 'string' || !userId || userId.startsWith('guest_')) return fail(401, 'unauthorized', 'Sign in to keep your videos');

  const proof = await verifyCredential(credential, keys, nowSeconds);
  if (!proof) return fail(401, 'invalid_credential', 'This guest session is no longer valid');

  let res;
  try {
    res = await fetchImpl(`${url}/rest/v1/rpc/claim_guest_content`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_guest: proof.guestId, p_user: userId }),
    });
  } catch (err) {
    console.error('[guest-claim] request failed:', err?.message);
    return fail(502, 'upstream', 'Could not move your videos right now. Please try again.');
  }
  if (!res.ok) {
    console.error('[guest-claim] rpc failed with HTTP', res.status);
    return fail(502, 'upstream', 'Could not move your videos right now. Please try again.');
  }
  const moved = await res.json().catch(() => null);
  return json(200, { ok: true, moved: { videos: Number(moved?.videos) || 0, links: Number(moved?.links) || 0, leads: Number(moved?.leads) || 0 } });
}

export const handler = withClerkAuth(async (event) => {
  if (event.httpMethod !== 'POST') return fail(405, 'method_not_allowed', 'Use POST');
  const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
  if (raw.length > MAX_BODY) return fail(413, 'too_large', 'Request too large');
  let body;
  try { body = JSON.parse(raw || '{}'); } catch { return fail(400, 'bad_request', 'Body must be JSON'); }
  return claim({ userId: event.auth?.userId, credential: body?.credential });
});
