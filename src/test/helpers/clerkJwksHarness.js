// Test harness: a local Clerk JWKS server with jose-minted session tokens.
//
// Shared by the Clerk verification and token-exchange suites so both exercise
// the real JWKS verification path hermetically (no network beyond 127.0.0.1,
// no secrets from any environment).

import http from 'node:http';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';

const originalFetch = global.fetch;

/**
 * src/test/setup.js replaces global fetch with a vi.fn(); jose's
 * createRemoteJWKSet (used by netlify/functions/_shared/clerkAuth.js) needs a
 * real fetch. This shim serves the local JWKS server over node's http.
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

export async function createClerkJwksHarness() {
  const validKey = await generateKeyPair('RS256');
  const foreignKey = await generateKeyPair('RS256');
  const publicJwk = {
    ...(await exportJWK(validKey.publicKey)),
    alg: 'RS256',
    use: 'sig',
  };

  const server = http.createServer((req, res) => {
    if ((req.url || '').includes('jwks.json')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ keys: [publicJwk] }));
      return;
    }
    res.writeHead(404).end();
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const jwksUrl = `http://127.0.0.1:${port}/.well-known/jwks.json`;
  const issuer = `http://127.0.0.1:${port}`;

  global.fetch = nodeFetch;
  process.env.CLERK_JWKS_URL = jwksUrl;
  delete process.env.CLERK_ISSUER;
  delete process.env.CLERK_PUBLISHABLE_KEY;
  delete process.env.CLERK_SECRET_KEY;

  const start = () => {
    global.fetch = nodeFetch;
    process.env.CLERK_JWKS_URL = jwksUrl;
  };
  const stop = async () => {
    delete process.env.CLERK_JWKS_URL;
    global.fetch = originalFetch;
    await new Promise((resolve) => server.close(resolve));
  };

  return {
    jwksUrl,
    issuer,
    validKey,
    foreignKey,
    start,
    stop,
    /** Mint a Clerk-style session token (signed by the harness key). */
    async mintToken({ subject = 'user_2xKd9Qm4', workspaceId = 'org_42Acme', key = validKey.privateKey, tokenIssuer = issuer } = {}) {
      const builder = new SignJWT(
        workspaceId ? { org_id: workspaceId } : {},
      )
        .setProtectedHeader({ alg: 'RS256' })
        .setSubject(subject)
        .setIssuedAt()
        .setIssuer(tokenIssuer)
        .setExpirationTime('10m');
      return builder.sign(key);
    },
  };
}
