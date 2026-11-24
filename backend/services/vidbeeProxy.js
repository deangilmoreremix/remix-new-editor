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
import https from 'node:https';
import cors from 'cors';
import express from 'express';

const COOKIE = 'vidbee_session';
const TTL_MS = 8 * 3600 * 1000;
const secret = process.env.VIDBEE_SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.VIDBEE_SESSION_SECRET && process.env.NODE_ENV === 'production') {
  console.warn('[vidbee gate] VIDBEE_SESSION_SECRET is not set: sessions will end on every restart. Set it to a long random value.');
}
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
 * The cookie is SameSite=None on HTTPS (SmartVidDownloader runs in an iframe), so the browser attaches it to cross-site requests.
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

/** A page load (the iframe itself, not an API call or asset) gets a small page instead of bare text. */
const wantsPage = (req) => {
  const dest = req.headers['sec-fetch-dest'];
  if (dest) return dest === 'iframe' || dest === 'document';
  return req.method === 'GET' && /text\/html/.test(String(req.headers.accept || ''));
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
/**
 * Error page shown inside the SmartVidDownloader iframe. "Reconnect" asks the parent app (MediaHubPage) to start a new
 * session. The message goes only to `parentOrigin` (the app passes it as `?parent=`); without one there is no button.
 */
export const errorPage = (title, detail, { reconnect = false, parentOrigin = null } = {}) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>SmartVidDownloader</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a0a;color:#e4e4e7;font:15px/1.5 system-ui,sans-serif;text-align:center;padding:24px;box-sizing:border-box}
h1{font-size:20px;margin:0 0 8px;color:#fff}p{margin:0 0 20px;color:#a1a1aa;max-width:420px}
button{background:#d9ff00;color:#000;border:0;border-radius:12px;padding:10px 20px;font-weight:800;font-size:14px;cursor:pointer}</style></head>
<body><main><h1>${esc(title)}</h1><p>${esc(detail)}</p>${reconnect && parentOrigin ? `<button type="button" data-origin="${esc(parentOrigin)}" onclick="parent.postMessage({type:'smartviddownloader:reconnect'},this.dataset.origin)">Reconnect</button>` : reconnect ? '<p>Open SmartVidDownloader again from SmartVid.</p>' : ''}</main></body></html>`;
/**
 * API calls / assets get plain text. When the fix is a new session (`reconnect`), they also get `X-SmartVid-Reconnect: 1`:
 * the embedded app (brand/rebrand.mjs patch on the renderer's fetch) then asks MediaHubPage to reconnect, since it never
 * sees the HTML page above.
 */
export const RECONNECT_HEADER = 'X-SmartVid-Reconnect';
/** The embedding app's origin from `?parent=`, only if it is a plain http(s) origin. */
export const parentOriginOf = (req) => {
  const raw = req.query?.parent ?? new URL(req.originalUrl || req.url || '/', 'http://x').searchParams.get('parent');
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const u = new URL(raw);
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.origin === raw ? u.origin : null;
  } catch { return null; }
};
const fail = (req, res, status, text, title, detail, opts) => {
  if (wantsPage(req)) return res.status(status).type('html').send(errorPage(title, detail, { ...opts, parentOrigin: parentOriginOf(req) }));
  if (opts?.reconnect) res.setHeader(RECONNECT_HEADER, '1');
  return res.status(status).type('text').send(text);
};

export function createVidBeeRouters({ auth }) {
  const session = express.Router();
  // Credentialed CORS for this one endpoint only (the cookie is scoped to /vidbee and is HttpOnly).
  const sessionCors = cors({ origin: true, credentials: true });
  session.options('/session', sessionCors);
  session.post('/session', sessionCors, auth, (req, res) => {
    if (!isAllowed(req.user)) return res.status(403).json({ error: 'SmartVidDownloader is not enabled for your account. Ask an admin to give you access.' });
    const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.setHeader('Set-Cookie', `${COOKIE}=${issue(req.user.id)}; Path=/vidbee; HttpOnly; Max-Age=${TTL_MS / 1000}; SameSite=${secure ? 'None; Secure' : 'Lax'}`);
    res.json({ ok: true, path: '/vidbee/' });
  });

  const proxy = (req, res) => {
    if (!verify(readCookie(req, COOKIE))) return fail(req, res, 401, 'Open SmartVidDownloader from the app to start a session.', 'Your session has ended', 'SmartVidDownloader sessions last 8 hours. Reconnect to keep downloading.', { reconnect: true });
    if (!isSameOriginMutation(req)) return res.status(403).type('text').send('Cross-site request blocked.');
    if (process.env.NODE_ENV === 'production' && !process.env.VIDBEE_WEB_URL) {
      return fail(req, res, 503, 'SmartVidDownloader is not configured (VIDBEE_WEB_URL).', 'SmartVidDownloader is not set up', 'The service address has not been configured on the server.', {});
    }
    const t = target();
    const secure = t.protocol === 'https:';
    const headers = { ...req.headers, host: t.host };
    delete headers.cookie; // never forward host-app credentials upstream
    delete headers.authorization;
    delete headers['x-vidbee-gate'];
    delete headers['x-smartvid-gate'];
    // Shared secret: the web edition refuses requests that do not come through this gate (VIDBEE_GATE_TOKEN, same value
    // on both sides). Sent under both header names so either build of the web edition accepts it.
    if (process.env.VIDBEE_GATE_TOKEN) { headers['x-vidbee-gate'] = process.env.VIDBEE_GATE_TOKEN; headers['x-smartvid-gate'] = process.env.VIDBEE_GATE_TOKEN; }
    const up = (secure ? https : http).request({ hostname: t.hostname, port: t.port || (secure ? 443 : 80), method: req.method, path: req.originalUrl, headers }, (r) => {
      res.writeHead(r.statusCode || 502, r.headers);
      r.pipe(res);
    });
    // Give up on an upstream that has gone silent (live streams send keep-alives well inside this window).
    up.setTimeout(10 * 60 * 1000, () => up.destroy(new Error('upstream timeout')));
    up.on('error', () => { if (!res.headersSent) fail(req, res, 502, 'SmartVidDownloader service is not running.', 'SmartVidDownloader is not available', 'The download service is not responding right now. Try again in a minute.', { reconnect: true }); else res.destroy(); });
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

