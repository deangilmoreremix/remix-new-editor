/**
 * VidBee gate — host glue for the vendored upstream VidBee web app (apps/vidbee).
 *
 * Upstream VidBee is single-tenant and has no login (it can browse server folders and change the
 * download directory), so it is only reachable through this gate:
 *   POST /api/vidbee/session  (Bearer auth + allowlist)  → sets a short-lived HttpOnly cookie
 *   ANY  /vidbee/*            (cookie required)          → streams to the VidBee web server
 * Allowlist: VIDBEE_ALLOWED_USERS="id1,email@x.com" (user id or email). Unset = everyone in
 * NODE_ENV=development, nobody otherwise.
 */
/* global URL */
import crypto from 'node:crypto';
import http from 'node:http';
import cors from 'cors';
import express from 'express';

const COOKIE = 'vidbee_session';
const TTL_MS = 8 * 3600 * 1000;
const secret = process.env.VIDBEE_SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const target = () => new URL(process.env.VIDBEE_WEB_URL || 'http://127.0.0.1:3300');

const sign = (v) => crypto.createHmac('sha256', secret).update(v).digest('hex');
const issue = (userId) => { const exp = Date.now() + TTL_MS; const body = `${Buffer.from(String(userId)).toString('base64url')}.${exp}`; return `${body}.${sign(body)}`; };
const verify = (token) => {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return false;
  const body = parts.slice(0, 2).join('.');
  const want = sign(body);
  return parts[2].length === want.length && crypto.timingSafeEqual(Buffer.from(parts[2]), Buffer.from(want)) && Number(parts[1]) > Date.now();
};
const readCookie = (req, name) => (req.headers.cookie || '').split(/;\s*/).map((c) => c.split('=')).find(([k]) => k === name)?.[1];

export const isAllowed = (user, env = process.env) => {
  const list = (env.VIDBEE_ALLOWED_USERS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!list.length) return (env.NODE_ENV || 'development') === 'development';
  return [user?.id, user?.email].filter(Boolean).some((v) => list.includes(String(v).toLowerCase()));
};

/**
 * The cookie is SameSite=None on HTTPS (Media Hub runs in an iframe), so the browser attaches it to cross-site requests.
 * State-changing requests must therefore come from VidBee's own pages: same origin as this host. A browser always sends
 * Origin (and Sec-Fetch-Site) on a cross-site POST; requests without either do not come from a web page.
 */
export const isSameOriginMutation = (req) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
  const site = req.headers['sec-fetch-site'];
  if (site) return site === 'same-origin' || site === 'none';
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase();
  try { return new URL(origin).host.toLowerCase() === host; } catch { return false; }
};

export function createVidBeeRouters({ auth }) {
  const session = express.Router();
  // Credentialed CORS for this one endpoint only (the cookie is scoped to /vidbee and is HttpOnly).
  const sessionCors = cors({ origin: true, credentials: true });
  session.options('/session', sessionCors);
  session.post('/session', sessionCors, auth, (req, res) => {
    if (!isAllowed(req.user)) return res.status(403).json({ error: 'Media Hub is not enabled for your account. Ask an admin to add you to VIDBEE_ALLOWED_USERS.' });
    const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.setHeader('Set-Cookie', `${COOKIE}=${issue(req.user.id)}; Path=/vidbee; HttpOnly; Max-Age=${TTL_MS / 1000}; SameSite=${secure ? 'None; Secure' : 'Lax'}`);
    res.json({ ok: true, path: '/vidbee/' });
  });

  const proxy = (req, res) => {
    if (!verify(readCookie(req, COOKIE))) return res.status(401).type('text').send('Open Media Hub from the app to start a session.');
    if (!isSameOriginMutation(req)) return res.status(403).type('text').send('Cross-site request blocked.');
    const t = target();
    const headers = { ...req.headers, host: t.host };
    delete headers.cookie; // never forward host-app credentials upstream
    delete headers.authorization;
    const up = http.request({ hostname: t.hostname, port: t.port, method: req.method, path: req.originalUrl, headers }, (r) => {
      res.writeHead(r.statusCode || 502, r.headers);
      r.pipe(res);
    });
    up.on('error', () => { if (!res.headersSent) res.status(502).type('text').send('Media Hub service is not running.'); else res.destroy(); });
    res.on('close', () => up.destroy());
    req.pipe(up);
  };
  return { session, proxy };
}

/**
 * Mount the gate on an Express app in the one order that works:
 *  1. `/api/vidbee` (credentialed CORS for the session endpoint) BEFORE the global `cors()`. The global handler
 *     answers every OPTIONS preflight itself with `Access-Control-Allow-Origin: *` and no `Allow-Credentials`,
 *     which makes a browser on another origin block the cookie-setting POST.
 *  2. the global CORS handler.
 *  3. `/vidbee` (the proxy) before the body parsers, so request streams pass through untouched.
 */
export function installVidBee(app, { auth, cors: globalCors }) {
  const { session, proxy } = createVidBeeRouters({ auth });
  app.use('/api/vidbee', session);
  app.use(globalCors);
  app.use('/vidbee', proxy);
}

