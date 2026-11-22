// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';

const SECRET_RAW = crypto.randomBytes(24);
process.env.CLERK_WEBHOOK_SIGNING_SECRET = `whsec_${SECRET_RAW.toString('base64')}`;
process.env.SUPABASE_URL = 'https://db.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-secret';

const calls = { upsert: [], rpc: [], del: [] };
let rpcResult = { error: null };
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      upsert: async (row) => { calls.upsert.push(row); return { error: null }; },
      delete: () => ({ eq: async (c, v) => { calls.del.push([c, v]); return { error: null }; } }),
    }),
    rpc: async (name, args) => { calls.rpc.push([name, args]); if (rpcResult.throws) throw new Error('boom'); return rpcResult; },
  }),
}));

const { handler, recordSignup } = await import('../clerk-webhook.js');

// A request signed the way Svix does it: base64 HMAC-SHA256 of "<id>.<timestamp>.<body>", sent as "v1,<signature>".
function signed(payload, { badSignature = false, extraOld = false } = {}) {
  const body = JSON.stringify(payload);
  const id = 'msg_test123';
  const ts = String(Math.floor(Date.now() / 1000));
  let sig = crypto.createHmac('sha256', SECRET_RAW).update(`${id}.${ts}.${body}`).digest('base64');
  if (badSignature) sig = crypto.createHmac('sha256', SECRET_RAW).update('other').digest('base64');
  const header = extraOld ? `v1,${Buffer.from('old-secret-signature-xxxxxxxxxxxxxxxxxx').toString('base64')} v1,${sig}` : `v1,${sig}`;
  return { httpMethod: 'POST', body, headers: { 'svix-id': id, 'svix-timestamp': ts, 'svix-signature': header } };
}
const user = { id: 'user_abc', first_name: 'Sam', email_addresses: [{ id: 'e1', email_address: 'sam@example.com' }], primary_email_address_id: 'e1' };

describe('clerk-webhook: signup event', () => {
  beforeEach(() => { calls.upsert.length = 0; calls.rpc.length = 0; calls.del.length = 0; rpcResult = { error: null }; });

  it('user.created syncs the user and records one signup event', async () => {
    const r = await handler(signed({ type: 'user.created', data: user }));
    expect(r.statusCode).toBe(200);
    expect(calls.upsert).toHaveLength(1);
    expect(calls.rpc).toEqual([['record_onboarding_signup', { p_clerk_user_id: 'user_abc' }]]);
  });
  it('accepts a signature list where only one entry matches (secret rotation)', async () => {
    expect((await handler(signed({ type: 'user.created', data: user }, { extraOld: true }))).statusCode).toBe(200);
    expect(calls.rpc).toHaveLength(1);
  });
  it('user.updated and user.deleted do not record a signup', async () => {
    await handler(signed({ type: 'user.updated', data: user }));
    await handler(signed({ type: 'user.deleted', data: { id: 'user_abc' } }));
    expect(calls.rpc).toHaveLength(0);
    expect(calls.del).toEqual([['clerk_id', 'user_abc']]);
  });
  it('a failing or throwing signup event never changes the answer', async () => {
    rpcResult = { error: { message: 'function does not exist' } };
    expect((await handler(signed({ type: 'user.created', data: user }))).statusCode).toBe(200);
    rpcResult = { throws: true };
    expect((await handler(signed({ type: 'user.created', data: user }))).statusCode).toBe(200);
    expect(calls.upsert).toHaveLength(2);
  });
  it('a bad signature is refused and nothing is written', async () => {
    const r = await handler(signed({ type: 'user.created', data: user }, { badSignature: true }));
    expect(r.statusCode).toBe(400);
    expect(calls.upsert).toHaveLength(0);
    expect(calls.rpc).toHaveLength(0);
  });
  it('only POST is accepted', async () => {
    expect((await handler({ httpMethod: 'GET', headers: {} })).statusCode).toBe(405);
  });
  it('recordSignup needs a user id', async () => {
    const sb = { rpc: async () => ({ error: null }) };
    expect(await recordSignup(sb, {})).toBe(false);
    expect(await recordSignup(sb, { id: 'u1' })).toBe(true);
  });
});
