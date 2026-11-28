/**
 * Netlify function: social-publish-key  (Clerk session required)
 *
 *   GET     -> { enabled }                 whether automatic publishing is on for this account
 *   PUT     { apiKey, consent: true }      store the MuAPI key (AES-256-GCM, server-side only) so scheduled
 *                                          posts can publish while no browser is open
 *   DELETE                                 remove the key and cancel this account's pending automatic jobs
 *
 * The key is never returned, logged or readable by the browser (the table has no client policy).
 */
import { withClerkAuth } from './_shared/clerkAuth.js';
import { userMuapiKey } from './_shared/byok.js';
import { encryptKey, secretKey } from './_shared/socialKeyCrypto.js';
import { rest, supabaseConfig } from './_shared/supabaseRest.js';

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });

export async function handle(event, { env = process.env, fetchImpl = fetch } = {}) {
  const owner = event.auth?.userId;
  if (!owner) return json(401, { error: 'unauthorized' });
  const cfg = supabaseConfig(env);
  if (!cfg.url || !cfg.key) return json(503, { error: 'not_configured' });
  const call = rest(cfg, fetchImpl);
  const me = `clerk_user_id=eq.${encodeURIComponent(owner)}`;
  try {
    if (event.httpMethod === 'GET') {
      const rows = await call(`social_publish_credentials?select=updated_at&${me}&limit=1`);
      return json(200, { enabled: !!rows?.length, available: !!secretKey(env), updatedAt: rows?.[0]?.updated_at ?? null });
    }
    if (event.httpMethod === 'PUT') {
      if (!secretKey(env)) return json(503, { error: 'Automatic publishing is not set up on the server yet.' });
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'bad_request' }); }
      if (body.consent !== true) return json(400, { error: 'Please confirm you allow SmartVideo to publish on your behalf.' });
      const key = userMuapiKey({ 'x-muapi-key': body.apiKey });
      if (!key) return json(400, { error: 'That does not look like a MuAPI key.' });
      const ciphertext = encryptKey(key, owner, env);
      await call('social_publish_credentials?on_conflict=clerk_user_id', {
        method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
        body: { clerk_user_id: owner, key_ciphertext: ciphertext, updated_at: new Date().toISOString() },
      });
      return json(200, { enabled: true });
    }
    if (event.httpMethod === 'DELETE') {
      // Jobs that have not started cannot publish without a key: cancel them so nothing fails silently later.
      await call(`scheduled_posts?${me}&auto_publish=eq.true&status=eq.scheduled`, { method: 'PATCH', prefer: 'return=minimal', body: { status: 'cancelled', cancelled_at: new Date().toISOString(), last_error: 'Automatic publishing was turned off.' } });
      await call(`social_publish_credentials?${me}`, { method: 'DELETE', prefer: 'return=minimal' });
      return json(200, { enabled: false });
    }
    return json(405, { error: 'method_not_allowed' });
  } catch {
    return json(500, { error: 'failed' });
  }
}

export const handler = withClerkAuth((event) => handle(event));
