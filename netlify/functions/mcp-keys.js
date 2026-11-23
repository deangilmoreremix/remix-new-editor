// netlify/functions/mcp-keys.js
// Create / list / revoke SmartVid MCP keys. Clerk session required: only a signed-in user can mint a key.
//   POST { action: 'create', label?, muapiKey, openaiKey? } → { ok, key, id, prefix }   (raw key shown once)
//   POST { action: 'list' }                                   → { ok, keys: [{ id, label, prefix, created_at, last_used_at }] }
//   POST { action: 'revoke', id }                             → { ok }
// Set MCP_REQUIRE_ENTITLEMENT=1 to additionally require the paid feature (as the app UI does).
import { withClerkAuth } from './_shared/clerkAuth.js';
import { createSupabaseStore, createMcpKey } from './_shared/mcpKeys.js';
import { createSupabaseGovernorStore } from '../../packages/studio-mcp-core/src/governor.js';
import { createClient } from '@supabase/supabase-js';
import { userMuapiKey, userOpenAIKey } from './_shared/byok.js';
import { claimsHaveFeature } from './website-builder-session.js';

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
const fail = (statusCode, code, message) => json(statusCode, { ok: false, error: { code, message } });

/** Days until a new key expires. MCP_KEY_MAX_DAYS caps it (and is the default when set); with neither, keys do not expire. */
function expiryDays(requested, env) {
  const max = Number(env.MCP_KEY_MAX_DAYS);
  const asked = Number(requested);
  const hasMax = Number.isFinite(max) && max > 0;
  if (Number.isFinite(asked) && asked > 0) return hasMax ? Math.min(asked, max) : Math.min(asked, 3650);
  return hasMax ? max : undefined;
}

export function createHandler({ store, env = process.env, audit } = {}) {
  return async (event) => {
    if (event.httpMethod !== 'POST') return fail(405, 'method_not_allowed', 'Use POST');
    if ((event.body || '').length > 4_000) return fail(413, 'too_large', 'Request too large');
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return fail(400, 'bad_request', 'Body must be JSON'); }
    const { userId, workspaceId, claims } = event.auth || {};
    if (!userId) return fail(401, 'not_signed_in', 'Sign in first');
    if (!env.MCP_KEY_SECRET || env.MCP_KEY_SECRET.length < 32) return fail(503, 'not_configured', 'MCP access is not configured.');
    const s = store || createSupabaseStore();

    try {
      if (body.action === 'list') {
        const keys = (await s.listForUser(userId)).map(({ id, label, key_prefix, created_at, last_used_at }) => ({ id, label, prefix: key_prefix, created_at, last_used_at }));
        return json(200, { ok: true, keys });
      }
      if (body.action === 'audit') {
        // The last 50 things this user's MCP keys did: tool, risk, outcome, time. Nothing about arguments or content.
        const src = audit || createSupabaseGovernorStore(createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } }));
        return json(200, { ok: true, events: await src.recent(userId, 50) });
      }
      if (body.action === 'revoke') {
        if (!/^[0-9a-f-]{36}$/i.test(String(body.id || ''))) return fail(400, 'bad_request', 'Invalid id');
        return (await s.revoke(userId, body.id)) ? json(200, { ok: true }) : fail(404, 'not_found', 'Key not found');
      }
      if (body.action === 'create') {
        if (env.MCP_REQUIRE_ENTITLEMENT === '1' && !claimsHaveFeature(claims)) return fail(403, 'not_entitled', 'MCP access needs a full-access plan.');
        // The user's own keys come from the same BYOK headers the app already sends to every function.
        const muapiKey = userMuapiKey(event.headers);
        const openaiKey = userOpenAIKey(event.headers);
        const r = await createMcpKey(s, { userId, workspaceId, label: body.label, muapiKey, openaiKey, expiresInDays: expiryDays(body.expiresInDays, env) });
        if (r.error) return fail(400, r.error, r.message);
        return json(200, { ok: true, key: r.key, id: r.id, prefix: r.prefix, label: r.label, expires_at: r.expires_at });
      }
      if (body.action === 'rotate') {
        // Make the replacement first, revoke the old key only once the new one exists, so a failure never leaves the user with no key.
        if (!/^[0-9a-f-]{36}$/i.test(String(body.id || ''))) return fail(400, 'bad_request', 'Invalid id');
        const current = (await s.listForUser(userId)).find((k) => k.id === body.id);
        if (!current) return fail(404, 'not_found', 'Key not found');
        const muapiKey = userMuapiKey(event.headers);
        const openaiKey = userOpenAIKey(event.headers);
        const r = await createMcpKey(s, { userId, workspaceId, label: current.label, muapiKey, openaiKey, expiresInDays: expiryDays(body.expiresInDays, env), maxActive: Infinity });
        if (r.error) return fail(400, r.error, r.message);
        await s.revoke(userId, current.id);
        return json(200, { ok: true, key: r.key, id: r.id, prefix: r.prefix, label: r.label, expires_at: r.expires_at, replaced: current.id });
      }
      return fail(400, 'bad_request', 'Unknown action');
    } catch (err) {
      console.error('[mcp-keys]', err?.message || 'error');
      return fail(500, 'server_error', 'Could not complete that request.');
    }
  };
}

export const handler = withClerkAuth(createHandler());
