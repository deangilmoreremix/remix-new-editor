// @vitest-environment node
// Development-instance test accounts on deploy previews (clerkAuth.js): default off, only the listed users, only that issuer.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SignJWT, generateKeyPair, exportJWK, createLocalJWKSet } from 'jose';

const PRIMARY_ISSUER = 'https://clerk.prod.example.com';
const DEV_ISSUER = 'https://wise-yeti-37.clerk.accounts.dev';
const TEST_USER = 'user_testbundle';
const sets = vi.hoisted(() => ({}));

// Real signatures, local key sets instead of network fetches.
vi.mock('jose', async (importOriginal) => ({
  ...(await importOriginal()),
  createRemoteJWKSet: (url) => sets[String(url)],
}));

let primary; let dev; let other;
async function keyPair(kid) {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' };
  return { privateKey, kid, set: createLocalJWKSet({ keys: [jwk] }) };
}
const sign = (pair, { iss, sub, exp = Math.floor(Date.now() / 1000) + 600 }) =>
  new SignJWT({}).setProtectedHeader({ alg: 'RS256', kid: pair.kid }).setIssuer(iss).setSubject(sub).setIssuedAt().setExpirationTime(exp).sign(pair.privateKey);

const saved = { ...process.env };
async function load(env = {}) {
  vi.resetModules();
  process.env = { ...saved, CLERK_ISSUER: PRIMARY_ISSUER, ...env };
  return (await import('../_shared/clerkAuth.js')).verifyClerkToken;
}

beforeEach(async () => {
  primary = await keyPair('p1'); dev = await keyPair('d1'); other = await keyPair('o1');
  sets[`${PRIMARY_ISSUER}/.well-known/jwks.json`] = primary.set;
  sets[`${DEV_ISSUER}/.well-known/jwks.json`] = dev.set;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { process.env = saved; vi.restoreAllMocks(); });

describe('production behaviour is unchanged', () => {
  it('accepts a token from the configured instance', async () => {
    const verify = await load();
    const r = await verify(await sign(primary, { iss: PRIMARY_ISSUER, sub: 'user_real' }));
    expect(r).toMatchObject({ userId: 'user_real', workspaceId: 'personal' });
  });
  it('rejects a development-instance token when the test-account settings are not set', async () => {
    const verify = await load();
    expect(await verify(await sign(dev, { iss: DEV_ISSUER, sub: TEST_USER }))).toBeNull();
  });
  it('rejects it when only one of the two settings is set', async () => {
    expect(await (await load({ CLERK_DEV_ISSUER: DEV_ISSUER }))(await sign(dev, { iss: DEV_ISSUER, sub: TEST_USER }))).toBeNull();
    expect(await (await load({ CLERK_DEV_TEST_USER_IDS: TEST_USER }))(await sign(dev, { iss: DEV_ISSUER, sub: TEST_USER }))).toBeNull();
  });
});

describe('deploy preview with a development test account allowed', () => {
  const env = { CLERK_DEV_ISSUER: DEV_ISSUER, CLERK_DEV_TEST_USER_IDS: ` ${TEST_USER} , user_other ` };
  it('accepts the listed test account', async () => {
    const r = await (await load(env))(await sign(dev, { iss: DEV_ISSUER, sub: TEST_USER }));
    expect(r).toMatchObject({ userId: TEST_USER, workspaceId: 'personal' });
  });
  it('rejects a development-instance user who is not listed', async () => {
    expect(await (await load(env))(await sign(dev, { iss: DEV_ISSUER, sub: 'user_stranger' }))).toBeNull();
  });
  it('rejects a token that only claims the development issuer but is signed with other keys', async () => {
    expect(await (await load(env))(await sign(other, { iss: DEV_ISSUER, sub: TEST_USER }))).toBeNull();
  });
  it('rejects an expired development token', async () => {
    expect(await (await load(env))(await sign(dev, { iss: DEV_ISSUER, sub: TEST_USER, exp: Math.floor(Date.now() / 1000) - 60 }))).toBeNull();
  });
  it('still accepts the production instance, and never lets the listed id through under the production issuer path', async () => {
    const verify = await load(env);
    expect(await verify(await sign(primary, { iss: PRIMARY_ISSUER, sub: 'user_real' }))).toMatchObject({ userId: 'user_real' });
    expect(await verify(await sign(other, { iss: PRIMARY_ISSUER, sub: TEST_USER }))).toBeNull();
  });
  it('rejects garbage', async () => {
    const verify = await load(env);
    expect(await verify('not-a-jwt')).toBeNull();
    expect(await verify('')).toBeNull();
  });
});
