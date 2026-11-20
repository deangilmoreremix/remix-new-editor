// SmartVideo gateway for the CineGen web server.
//
// CineGen's server (index.mjs) is a single-user app with one data root. When
// CINEGEN_AUTH=clerk, this gateway puts the app behind the host application's
// Clerk login and gives every Clerk user their own CineGen instance and data
// root:
//
//   1. The embedding page (SmartVideo's CineGen Studio) sends the signed-in
//      user's Clerk session token to the iframe via postMessage.
//   2. The iframe POSTs it to /api/auth/session; the gateway verifies it
//      against the Clerk JWKS and sets a signed, HttpOnly session cookie.
//   3. Every /api and /media request must carry that cookie and is routed to
//      the CineGen instance for that user (data under <root>/users/<hash>).
//
// Without CINEGEN_AUTH=clerk the gateway starts the plain single-user server,
// unchanged from upstream (local development).

import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { createCineGenWebServer } from './index.mjs';

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_ROOT = path.join(SERVER_DIR, '..', '.data');
const COOKIE_NAME = 'cg_session';
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const MAX_TOKEN_BYTES = 8192;

// ─── Clerk verification (mirrors netlify/functions/_shared/clerkAuth.js) ────

function hostFromClerkKey(key) {
  const match = key?.match(/^(?:pk|sk)_[a-z]+_(.+)$/);
  if (!match) return null;
  try {
    return Buffer.from(match[1], 'base64').toString('utf8').split('$')[0] || null;
  } catch {
    return null;
  }
}

export function resolveClerkIssuer(env = process.env) {
  if (env.CLERK_ISSUER) return env.CLERK_ISSUER.replace(/\/+$/, '');
  for (const key of [env.CLERK_PUBLISHABLE_KEY, env.VITE_CLERK_PUBLISHABLE_KEY, env.CLERK_SECRET_KEY]) {
    const host = hostFromClerkKey(key);
    if (host) return `https://${host.replace(/\$$/, '')}`;
  }
  return null;
}

function createClerkVerifier(env = process.env) {
  const issuer = resolveClerkIssuer(env);
  const jwksUrl = env.CLERK_JWKS_URL || (issuer ? `${issuer}/.well-known/jwks.json` : null);
  if (!jwksUrl) {
    throw new Error('CINEGEN_AUTH=clerk needs CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, CLERK_ISSUER or CLERK_JWKS_URL.');
  }
  const jwks = createRemoteJWKSet(new URL(jwksUrl));
  const authorizedParties = (env.CINEGEN_ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);

  return async function verify(token) {
    const { payload } = await jwtVerify(token, jwks, issuer ? { issuer } : {});
    if (!payload.sub) throw new Error('Token has no subject.');
    // Clerk's `azp` is the origin the token was minted for.
    if (authorizedParties.length && payload.azp && !authorizedParties.includes(payload.azp)) {
      throw new Error('Token was issued for a different origin.');
    }
    return { userId: String(payload.sub) };
  };
}

// ─── Session cookie ──────────────────────────────────────────────────────────

function sign(secret, value) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

export function createSessionValue(secret, userId, now = Date.now()) {
  const exp = Math.floor(now / 1000) + SESSION_TTL_SECONDS;
  const body = Buffer.from(JSON.stringify({ sub: userId, exp })).toString('base64url');
  return `${body}.${sign(secret, body)}`;
}

export function readSessionValue(secret, value, now = Date.now()) {
  if (!value || typeof value !== 'string') return null;
  const [body, mac] = value.split('.');
  if (!body || !mac) return null;
  const expected = sign(secret, body);
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const { sub, exp } = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof sub !== 'string' || !sub || typeof exp !== 'number' || exp * 1000 <= now) return null;
    return sub;
  } catch {
    return null;
  }
}

function readCookie(request, name) {
  const header = request.headers.cookie || '';
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) return decodeURIComponent(part.slice(index + 1).trim());
  }
  return null;
}

function sessionCookie(value, { secure, maxAge }) {
  // SameSite=None is required for the cookie to be sent inside the
  // cross-origin iframe; it is only valid together with Secure (HTTPS).
  const attrs = [`${COOKIE_NAME}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', `Max-Age=${maxAge}`];
  attrs.push(secure ? 'Secure; SameSite=None; Partitioned' : 'SameSite=Lax');
  return attrs.join('; ');
}

function sendJson(response, status, value, headers = {}) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...headers,
  });
  response.end(body);
}

async function readBody(request, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('Body too large.'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

// ─── Gateway ─────────────────────────────────────────────────────────────────

export async function createCineGenGateway(options = {}) {
  const env = options.env || process.env;
  const dataRoot = path.resolve(options.dataRoot || env.CINEGEN_WEB_DATA_ROOT || DEFAULT_DATA_ROOT);
  const sessionSecret = options.sessionSecret || env.CINEGEN_SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error('CINEGEN_AUTH=clerk needs CINEGEN_SESSION_SECRET (at least 32 characters).');
  }
  const verify = options.verifyToken || createClerkVerifier(env);
  const allowedOrigins = (env.CINEGEN_ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const secureCookies = options.secureCookies ?? env.NODE_ENV === 'production';

  // Static files (the built client) are user-independent.
  const publicApp = await createCineGenWebServer({ ...options.serverOptions, dataRoot: path.join(dataRoot, 'public') });

  const userApps = new Map();
  function appForUser(userId) {
    let pending = userApps.get(userId);
    if (!pending) {
      const userDir = crypto.createHash('sha256').update(userId).digest('hex').slice(0, 32);
      pending = createCineGenWebServer({ ...options.serverOptions, dataRoot: path.join(dataRoot, 'users', userDir) });
      pending.catch(() => userApps.delete(userId));
      userApps.set(userId, pending);
    }
    return pending;
  }

  const frameAncestors = ["'self'", ...allowedOrigins].join(' ');

  const server = http.createServer(async (request, response) => {
    response.setHeader('Content-Security-Policy', `frame-ancestors ${frameAncestors}`);
    try {
      const url = new URL(request.url || '/', 'http://cinegen.local');
      const pathname = url.pathname;

      if (pathname === '/api/auth/config' && request.method === 'GET') {
        sendJson(response, 200, { ok: true, result: { mode: 'clerk', allowedOrigins } });
        return;
      }

      if (pathname === '/api/auth/session' && request.method === 'POST') {
        const auth = request.headers.authorization || '';
        const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
        await readBody(request, MAX_TOKEN_BYTES);
        if (!token || token.length > MAX_TOKEN_BYTES) {
          sendJson(response, 401, { ok: false, error: { message: 'Sign in required.', code: 'UNAUTHENTICATED' } });
          return;
        }
        let identity;
        try {
          identity = await verify(token);
        } catch (error) {
          console.warn('[cinegen-gateway] token rejected:', error?.message || error);
          sendJson(response, 401, { ok: false, error: { message: 'Invalid session.', code: 'UNAUTHENTICATED' } });
          return;
        }
        const cookie = sessionCookie(createSessionValue(sessionSecret, identity.userId), { secure: secureCookies, maxAge: SESSION_TTL_SECONDS });
        sendJson(response, 200, { ok: true, result: { signedIn: true } }, { 'Set-Cookie': cookie });
        return;
      }

      if (pathname === '/api/auth/session' && request.method === 'DELETE') {
        sendJson(response, 200, { ok: true, result: { signedIn: false } }, {
          'Set-Cookie': sessionCookie('', { secure: secureCookies, maxAge: 0 }),
        });
        return;
      }

      if (pathname === '/api/health') {
        publicApp.server.emit('request', request, response);
        return;
      }

      const needsUser = pathname.startsWith('/api/') || pathname.startsWith('/media/');
      if (!needsUser) {
        publicApp.server.emit('request', request, response);
        return;
      }

      const userId = readSessionValue(sessionSecret, readCookie(request, COOKIE_NAME));
      if (!userId) {
        sendJson(response, 401, { ok: false, error: { message: 'Sign in required.', code: 'UNAUTHENTICATED' } });
        return;
      }
      const app = await appForUser(userId);
      app.server.emit('request', request, response);
    } catch (error) {
      console.error('[cinegen-gateway]', error);
      if (!response.headersSent) {
        sendJson(response, error?.status || 500, { ok: false, error: { message: 'Gateway error.', code: 'GATEWAY_ERROR' } });
      } else {
        response.destroy();
      }
    }
  });

  return {
    server,
    userApps,
    async listen(port = Number(env.PORT || 8787), host = env.HOST || '127.0.0.1') {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => { server.off('error', reject); resolve(); });
      });
      return server.address();
    },
    async close() {
      const apps = await Promise.allSettled([publicApp, ...userApps.values()]);
      await Promise.allSettled(apps.filter((r) => r.status === 'fulfilled').map((r) => r.value.close()));
      if (server.listening) await new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

async function main() {
  const authMode = process.env.CINEGEN_AUTH || 'none';
  const app = authMode === 'clerk' ? await createCineGenGateway() : await createCineGenWebServer();
  const address = await app.listen();
  const port = typeof address === 'object' && address ? address.port : 8787;
  console.log(`[cinegen-web] server ready on port ${port} (auth: ${authMode})`);

  const shutdown = async () => {
    await app.close().catch((error) => console.error('[cinegen-web] shutdown failed', error));
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error('[cinegen-web] failed to start', error);
    process.exitCode = 1;
  });
}
