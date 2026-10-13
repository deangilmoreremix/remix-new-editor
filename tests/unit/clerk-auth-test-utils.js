// tests/unit/clerk-auth-test-utils.js
//
// Shared helpers for the Clerk entitlement-gate unit tests (both the Deno
// supabase/functions/_shared/clerkAuth.ts helper and the Netlify
// netlify/functions/_clerk-auth.js helper, plus the gated handlers).
//
// Nothing here talks to a real provider: the Clerk JWKS endpoint and Clerk
// Backend API are served from an in-test fetch router.

const DEFAULT_ISSUER = 'https://clerk.test';
const JWKS_TTL_MS = 10 * 60 * 1000;

let keyPairPromise = null;
let otherKeyPairPromise = null;

async function getKeyPair() {
  if (!keyPairPromise) {
    keyPairPromise = crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify']
    );
  }
  return keyPairPromise;
}

// A second, unrelated RSA keypair — used to forge tokens whose signature does
// not match the JWKS key (signature-verification denial tests).
async function getOtherKeyPair() {
  if (!otherKeyPairPromise) {
    otherKeyPairPromise = crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify']
    );
  }
  return otherKeyPairPromise;
}

function base64UrlEncodeBytes(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlEncodeJson(value) {
  return base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(value)));
}

/** Public JWK (with a fixed kid) for the primary test signing key. */
async function getTestJwk() {
  const { publicKey } = await getKeyPair();
  const jwk = await crypto.subtle.exportKey('jwk', publicKey);
  return { ...jwk, kid: 'test-key-1', alg: 'RS256', use: 'sig' };
}

/**
 * Mint an RS256 Clerk-shaped session token.
 *
 * @param {object} claims extra JWT claims (sub/iat/exp/iss come from defaults)
 * @param {object} opts { header, iss, signWithOtherKey, kid }
 */
export async function signClerkToken(claims = {}, opts = {}) {
  const pair = opts.signWithOtherKey ? await getOtherKeyPair() : await getKeyPair();
  const signingKey = pair.privateKey;

  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: opts.kid ?? 'test-key-1',
    ...(opts.header || {}),
  };
  const payload = {
    azp: 'http://localhost:3100',
    sub: 'user_test_123',
    iat: now,
    exp: now + 3600,
    iss: opts.iss ?? DEFAULT_ISSUER,
    ...claims,
  };

  const signingInput = `${base64UrlEncodeJson(header)}.${base64UrlEncodeJson(payload)}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    signingKey,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${base64UrlEncodeBytes(new Uint8Array(signature))}`;
}

export function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

/**
 * Install a fetch router that serves the Clerk JWKS + Backend API (and any
 * extra routes the caller passes). Every other URL throws so a test fails
 * loudly instead of silently hitting a real provider.
 *
 * @param {object} config
 * @param {object} [config.users] map of userId -> Clerk user object
 * @param {object} [config.extra] map of URL substring -> (url, init) => response
 */
export function installClerkFetchRouter({ users = {}, extra = {} } = {}) {
  const fetchMock = vi.fn(async (url, init) => {
    const u = String(url);

    for (const [needle, responder] of Object.entries(extra)) {
      if (u.includes(needle)) return responder(u, init);
    }

    if (u.endsWith('/.well-known/jwks.json')) {
      return jsonResponse({ keys: [await getTestJwk()] });
    }

    const userMatch = /\/v1\/users\/([^/?]+)$/.exec(u);
    if (userMatch) {
      const id = decodeURIComponent(userMatch[1]);
      if (Object.prototype.hasOwnProperty.call(users, id)) {
        return jsonResponse(users[id]);
      }
      return jsonResponse({ errors: [{ message: 'not found' }] }, { ok: false, status: 404 });
    }

    throw new Error(`Unexpected fetch to ${u} — tests must not call real providers`);
  });
  globalThis.fetch = fetchMock;
  return fetchMock;
}

/** Clerk Backend API user object with (or without) legacy access. */
export function clerkUser(userId = 'user_test_123', { legacyAccess = false } = {}) {
  return {
    id: userId,
    object: 'user',
    primary_email_address_id: 'idn_1',
    email_addresses: [
      { id: 'idn_1', email_address: 'buyer@example.com' },
    ],
    public_metadata: legacyAccess ? { legacy_access: true } : {},
  };
}

export const CLERK_JWKS_TTL = JWKS_TTL_MS;
export const TEST_ISSUER = DEFAULT_ISSUER;

/**
 * Snapshot/restore process.env around Clerk-related vars.
 * Call with the vars a test needs; the previous values come back in afterAll.
 */
export function withClerkEnv(overrides) {
  const managed = [
    'CLERK_ISSUER_URL',
    'CLERK_PUBLISHABLE_KEY',
    'VITE_CLERK_PUBLISHABLE_KEY',
    'CLERK_SECRET_KEY',
    'ENVIRONMENT',
    'ALLOWED_ORIGINS',
  ];
  const saved = {};
  for (const key of managed) saved[key] = process.env[key];

  for (const key of managed) delete process.env[key];
  for (const [key, value] of Object.entries(overrides)) {
    process.env[key] = value;
  }

  return () => {
    for (const key of managed) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  };
}
