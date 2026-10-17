// Clerk JWKS verification (blocker A step 1).
//
// netlify/functions/_shared/clerkAuth.js verifies the `Authorization: Bearer`
// token against the Clerk JWKS resolved from the environment. This suite
// stands up a local JWKS endpoint (127.0.0.1) so the verification path can be
// exercised hermetically, with real jose-signed tokens:
//   - a validly signed session token verifies and yields the Clerk identity,
//   - a tampered payload, a foreign signing key, a wrong issuer and an
//     expired token are all rejected (null),
//   - missing/invalid tokens and an unconfigured instance are rejected.
//
// Only test key material is used; no secret from any environment is read.

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import http from 'node:http';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';

let server;
let jwksUrl;
let validKey;
let foreignKey;
const SIGNED_TOKENS = [];
const originalFetch = global.fetch;

/**
 * src/test/setup.js replaces global fetch with a vi.fn(); restore a real
 * fetch for the JWKS lookup using node's http module (the JWKS server is
 * local to this suite, so the shim only ever serves it).
 */
function nodeFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request(url, { method: options.method || 'GET' }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(new Response(Buffer.concat(chunks), {
        status: res.statusCode || 200,
        headers: { 'content-type': 'application/json' },
      })));
    });
    request.on('error', reject);
    request.end();
  });
}

beforeAll(async () => {
  validKey = await generateKeyPair('RS256');
  foreignKey = await generateKeyPair('RS256');
  const publicJwk = {
    ...(await exportJWK(validKey.publicKey)),
    alg: 'RS256',
    use: 'sig',
  };

  server = http.createServer((req, res) => {
    if ((req.url || '').includes('jwks.json')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ keys: [publicJwk] }));
      return;
    }
    res.writeHead(404).end();
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  jwksUrl = `http://127.0.0.1:${port}/.well-known/jwks.json`;

  global.fetch = nodeFetch;

  process.env.CLERK_JWKS_URL = jwksUrl;
  delete process.env.CLERK_ISSUER;
  delete process.env.CLERK_PUBLISHABLE_KEY;
  delete process.env.CLERK_SECRET_KEY;
});

afterAll(async () => {
  delete process.env.CLERK_JWKS_URL;
  global.fetch = originalFetch;
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function mintToken(overrides = {}, key = validKey.privateKey) {
  const jwt = await new SignJWT({ org_id: 'org_42Acme', ...overrides })
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject('user_2xKd9Qm4')
    .setIssuedAt()
    .setIssuer(jwksUrl.replace(/\/\.well-known\/jwks\.json$/, ''))
    .setExpirationTime('10m')
    .sign(key);
  SIGNED_TOKENS.push(jwt);
  return jwt;
}

describe('verifyClerkToken', () => {
  test('verifies a signed Clerk session token', async () => {
    const { verifyClerkToken } = await import('../../netlify/functions/_shared/clerkAuth.js');
    const token = await mintToken();

    const auth = await verifyClerkToken(token);

    expect(auth).not.toBeNull();
    expect(auth.userId).toBe('user_2xKd9Qm4');
    expect(auth.workspaceId).toBe('org_42Acme');
    expect(auth.claims.sub).toBe('user_2xKd9Qm4');
  });

  test('defaults the workspace to personal without an org claim', async () => {
    const { verifyClerkToken } = await import('../../netlify/functions/_shared/clerkAuth.js');
    const { SignJWT: Sign } = await import('jose');
    const token = await new Sign()
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('user_personalOnly')
      .setIssuedAt()
      .setIssuer(jwksUrl.replace(/\/\.well-known\/jwks\.json$/, ''))
      .setExpirationTime('10m')
      .sign(validKey.privateKey);

    const auth = await verifyClerkToken(token);
    expect(auth.userId).toBe('user_personalOnly');
    expect(auth.workspaceId).toBe('personal');
  });

  test('rejects a tampered payload (sub/workspace rewritten in transit)', async () => {
    const { verifyClerkToken } = await import('../../netlify/functions/_shared/clerkAuth.js');
    const token = await mintToken();
    const [header, payload, signature] = token.split('.');
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    decoded.sub = 'user_attacker';
    const tampered = Buffer.from(JSON.stringify(decoded)).toString('base64url');

    const auth = await verifyClerkToken(`${header}.${tampered}.${signature}`);
    expect(auth).toBeNull();
  });

  test('rejects a token signed with a foreign key', async () => {
    const { verifyClerkToken } = await import('../../netlify/functions/_shared/clerkAuth.js');
    const token = await mintToken({}, foreignKey.privateKey);
    expect(await verifyClerkToken(token)).toBeNull();
  });

  test('rejects a wrong-issuer token', async () => {
    const { verifyClerkToken } = await import('../../netlify/functions/_shared/clerkAuth.js');
    const { SignJWT: Sign } = await import('jose');
    const token = await new Sign()
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('user_wrongIssuer')
      .setIssuedAt()
      .setIssuer('https://evil.example')
      .setExpirationTime('10m')
      .sign(validKey.privateKey);

    expect(await verifyClerkToken(token)).toBeNull();
  });

  test('rejects an expired token', async () => {
    const { verifyClerkToken } = await import('../../netlify/functions/_shared/clerkAuth.js');
    const { SignJWT: Sign } = await import('jose');
    const token = await new Sign()
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('user_expired')
      .setIssuedAt(0)
      .setIssuer(jwksUrl.replace(/\/\.well-known\/jwks\.json$/, ''))
      .setExpirationTime(1)
      .sign(validKey.privateKey);

    expect(await verifyClerkToken(token)).toBeNull();
  });

  test('rejects missing or malformed tokens', async () => {
    const { verifyClerkToken } = await import('../../netlify/functions/_shared/clerkAuth.js');
    expect(await verifyClerkToken('')).toBeNull();
    expect(await verifyClerkToken(null)).toBeNull();
    expect(await verifyClerkToken('not-a-jwt')).toBeNull();
    expect(SIGNED_TOKENS.length).toBeGreaterThan(0);
  });
});

describe('withClerkAuth', () => {
  test('401s a request without a Bearer token and passes verified auth to the handler', async () => {
    const { withClerkAuth } = await import('../../netlify/functions/_shared/clerkAuth.js');
    const inner = vi.fn(async (event) => ({ statusCode: 200, body: JSON.stringify(event.auth) }));
    const wrapped = withClerkAuth(inner);

    const denied = await wrapped({ httpMethod: 'GET', headers: {} });
    expect(denied.statusCode).toBe(401);
    expect(inner).not.toHaveBeenCalled();

    const token = await mintToken();
    const ok = await wrapped({ httpMethod: 'GET', headers: { Authorization: `Bearer ${token}` } });
    expect(ok.statusCode).toBe(200);
    expect(inner).toHaveBeenCalledTimes(1);
    expect(JSON.parse(ok.body).userId).toBe('user_2xKd9Qm4');
  });

  test('answers OPTIONS preflight without requiring a token', async () => {
    const { withClerkAuth } = await import('../../netlify/functions/_shared/clerkAuth.js');
    const inner = vi.fn();
    const wrapped = withClerkAuth(inner);

    const preflight = await wrapped({ httpMethod: 'OPTIONS', headers: {} });
    expect(preflight.statusCode).toBe(200);
    expect(inner).not.toHaveBeenCalled();
  });
});
