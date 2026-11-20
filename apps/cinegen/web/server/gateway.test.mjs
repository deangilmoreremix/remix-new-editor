import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createCineGenGateway, createSessionValue, readSessionValue, resolveClerkIssuer } from './gateway.mjs';

const SECRET = 'x'.repeat(40);

// Stand-in for Clerk: tokens look like "valid:<userId>".
async function fakeVerify(token) {
  if (!token.startsWith('valid:')) throw new Error('bad token');
  return { userId: token.slice('valid:'.length) };
}

async function startGateway(t) {
  const dataRoot = await mkdtemp(path.join(tmpdir(), 'cinegen-gateway-'));
  const gateway = await createCineGenGateway({
    dataRoot,
    sessionSecret: SECRET,
    verifyToken: fakeVerify,
    secureCookies: false,
    env: { CINEGEN_ALLOWED_ORIGINS: 'https://smartvid.app' },
  });
  const address = await gateway.listen(0, '127.0.0.1');
  t.after(async () => {
    await gateway.close();
    await rm(dataRoot, { recursive: true, force: true });
  });
  return `http://127.0.0.1:${address.port}`;
}

async function signIn(baseUrl, token) {
  const response = await fetch(`${baseUrl}/api/auth/session`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const cookie = response.headers.get('set-cookie');
  return { status: response.status, cookie: cookie ? cookie.split(';')[0] : null };
}

async function rpc(baseUrl, cookie, namespace, method, ...args) {
  const response = await fetch(`${baseUrl}/api/rpc/${namespace}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ args }),
  });
  return { status: response.status, body: await response.json() };
}

test('session values round-trip and reject tampering or expiry', () => {
  const value = createSessionValue(SECRET, 'user_1', 0);
  assert.equal(readSessionValue(SECRET, value, 0), 'user_1');
  assert.equal(readSessionValue('y'.repeat(40), value, 0), null);
  assert.equal(readSessionValue(SECRET, value.replace(/^./, 'A'), 0), null);
  assert.equal(readSessionValue(SECRET, value, 13 * 60 * 60 * 1000), null);
});

test('resolves the Clerk issuer from a publishable key', () => {
  const key = `pk_live_${Buffer.from('clerk.smartvid.app$').toString('base64')}`;
  assert.equal(resolveClerkIssuer({ CLERK_PUBLISHABLE_KEY: key }), 'https://clerk.smartvid.app');
});

test('API and media require a Clerk-verified session', async (t) => {
  const baseUrl = await startGateway(t);

  assert.equal((await rpc(baseUrl, null, 'project', 'list')).status, 401);
  assert.equal((await fetch(`${baseUrl}/media/anything.png`)).status, 401);
  assert.equal((await rpc(baseUrl, 'cg_session=forged.value', 'project', 'list')).status, 401);
  assert.equal((await signIn(baseUrl, 'not-a-clerk-token')).status, 401);

  const config = await (await fetch(`${baseUrl}/api/auth/config`)).json();
  assert.equal(config.result.mode, 'clerk');

  const page = await fetch(`${baseUrl}/`);
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'self' https:\/\/smartvid\.app/);
});

test('each Clerk user gets their own projects', async (t) => {
  const baseUrl = await startGateway(t);
  const alice = await signIn(baseUrl, 'valid:user_alice');
  const bob = await signIn(baseUrl, 'valid:user_bob');
  assert.equal(alice.status, 200);
  assert.ok(alice.cookie && bob.cookie);

  const created = await rpc(baseUrl, alice.cookie, 'project', 'create', 'Alice film');
  assert.equal(created.status, 200, JSON.stringify(created.body));

  const aliceList = await rpc(baseUrl, alice.cookie, 'project', 'list');
  const bobList = await rpc(baseUrl, bob.cookie, 'project', 'list');
  assert.equal(aliceList.body.result.length, 1);
  assert.equal(bobList.body.result.length, 0);
});
