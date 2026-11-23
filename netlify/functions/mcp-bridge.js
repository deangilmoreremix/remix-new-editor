// netlify/functions/mcp-bridge.js
// The tab half of the MCP live-tab bridge. Clerk session required: only the signed-in owner's own tab can register, poll or answer,
// and a command is only ever handed to a session of the same user (enforced in the core bridge and again by the store queries).
//   POST { action: 'register', sessionId?, label, studio, tools: [{ name, description, risk, schema }] } -> { ok, session }
//   POST { action: 'poll', sessionId }                                                                 -> { ok, commands, gone? }
//   POST { action: 'respond', sessionId, commandId, status: 'done'|'error'|'declined', result?, error? } -> { ok }
//   POST { action: 'close', sessionId }                                                                -> { ok }
import { createClient } from '@supabase/supabase-js';
import { withClerkAuth } from './_shared/clerkAuth.js';
import { createBridge, createSupabaseBridgeStore, BridgeError } from '../../packages/studio-mcp-core/src/bridge.js';

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
const fail = (statusCode, code, message) => json(statusCode, { ok: false, error: { code, message } });
const ID = /^[0-9a-f-]{36}$/i;

export function createHandler({ bridge, env = process.env } = {}) {
  return async (event) => {
    if (event.httpMethod !== 'POST') return fail(405, 'method_not_allowed', 'Use POST');
    if ((event.body || '').length > 1_500_000) return fail(413, 'too_large', 'Request too large');
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return fail(400, 'bad_request', 'Body must be JSON'); }
    const userId = event.auth?.userId;
    if (!userId) return fail(401, 'not_signed_in', 'Sign in first');
    let b = bridge;
    if (!b) {
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return fail(503, 'not_configured', 'MCP tab control is not configured.');
      b = createBridge({ store: createSupabaseBridgeStore(createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })), brandName: 'SmartVid' });
    }
    try {
      if (body.action === 'register') {
        if (body.sessionId && !ID.test(String(body.sessionId))) return fail(400, 'bad_request', 'Invalid sessionId');
        return json(200, { ok: true, session: await b.register(userId, { label: body.label, studio: body.studio, tools: body.tools, sessionId: body.sessionId || undefined }) });
      }
      if (!ID.test(String(body.sessionId || ''))) return fail(400, 'bad_request', 'Invalid sessionId');
      if (body.action === 'poll') return json(200, { ok: true, ...(await b.poll(userId, body.sessionId)) });
      if (body.action === 'respond') {
        if (!ID.test(String(body.commandId || ''))) return fail(400, 'bad_request', 'Invalid commandId');
        const row = await b.respond(userId, body.sessionId, body.commandId, { status: body.status, result: body.result, error: body.error });
        return row ? json(200, { ok: true }) : fail(404, 'not_found', 'That command is not waiting for an answer.');
      }
      if (body.action === 'close') { await b.close(userId, body.sessionId); return json(200, { ok: true }); }
      return fail(400, 'bad_request', 'Unknown action');
    } catch (err) {
      if (err instanceof BridgeError) return fail(err.status, err.code, err.message);
      console.error('[mcp-bridge]', err?.message || 'error');
      return fail(500, 'server_error', 'Could not complete that request.');
    }
  };
}

export const handler = withClerkAuth(createHandler());
