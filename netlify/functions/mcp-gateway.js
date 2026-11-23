// netlify/functions/mcp-gateway.js
// Branded gateway for the SmartVid MCP server (mcp/index.js). Routes (see netlify.toml):
//   POST /api/mcp-gateway/generate        { endpoint, payload }  -> { request_id | outputs }
//   GET  /api/mcp-gateway/result/{id}                            -> { status, outputs, error }
//   POST /api/mcp-gateway/estimate        { endpoint, payload }  -> { cost }
//   POST /api/mcp-gateway/upload          { source_url }         -> { url }
//   GET  /api/mcp-gateway/balance                                -> { balance }
//   POST /api/mcp-gateway/studio/{name}   { ...body }            -> the studio function's own response
// Auth: `Authorization: Bearer sv_live_…` (a SmartVid MCP key, see mcp-keys.js). The key resolves to a signed-in user and
// to that user's own stored upstream keys; studio routes run the app's own function handlers in-process as that user.
// There is no platform-key fallback. Local development may set MCP_ALLOW_BYOK=1 to pass an upstream key directly as the
// bearer token. The generation backend is never named in a response.

import { createSupabaseStore, resolveMcpKey, isMcpKey } from './_shared/mcpKeys.js';
import { createGovernor, createSupabaseGovernorStore } from '../../packages/studio-mcp-core/src/governor.js';
import { createBridge, createSupabaseBridgeStore, BridgeError } from '../../packages/studio-mcp-core/src/bridge.js';
import { createClient } from '@supabase/supabase-js';
import { handle as zackdHandle } from './zackd.js';
import { handle as agentAudioHandle } from './agent-audio.js';
import { handle as cinegenHandle } from './cinegen.js';
import { createPagesStudio, PAGE_ACTIONS } from './_shared/mcpPages.js';
import { createSocialStudio, SOCIAL_ACTIONS } from './_shared/mcpSocial.js';

const UPSTREAM = 'https://api.muapi.ai/api/v1';

// Studio functions the MCP may call, by name. Each runs the app's own handler as the key's user.
// (timeline-ai's generation actions are covered by /generate with the same request builders.)
export const STUDIOS = {
  zackd: (body, who) => zackdHandle(body, who.userId, { keys: who.keys }),
  'agent-audio': (body, who) => agentAudioHandle(body, who.userId, { keys: who.keys }),
  cinegen: (body, who) => cinegenHandle(body, who.userId, { key: who.keys.muapi }),
  // Video Pages: the app's own landing-page data layer, run with the key owner's identity (row-level security applies).
  pages: createPagesStudio(),
  // Social publishing: list connected accounts, publish, check a publish. Connecting or removing accounts stays in the app.
  social: createSocialStudio(),
  // Lead Finder and website discovery: the app's own personalization route handlers, run as the key's owner.
  // The user id is injected by the gateway from the verified MCP key, never taken from the request.
  personalization: async (body, who) => {
    if (!who?.userId || who.userId === 'byok') return { statusCode: 401, body: JSON.stringify({ error: { message: 'This needs a signed-in SmartVid MCP key.' } }) };
    const { runPersonalizationRoute } = await import('./_shared/personalizationRun.mts');
    return runPersonalizationRoute({ method: body?.method, path: body?.path, query: body?.query, body: body?.body }, { userId: who.userId });
  },
  // Brand Studio's site scraper (headless browser, SSRF-guarded). Loaded on demand: it pulls in the browser tooling.
  'brand-scrape': async (body, who) => {
    const { default: scrape } = await import('./brand-scrape.mts');
    const res = await scrape(new Request('https://gateway.invalid/api/scrape', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `mcp:${who.userId}` },
      body: JSON.stringify({ url: body?.url }),
    }));
    return { statusCode: res.status, body: await res.text() };
  },
};
const BRAND = 'SmartVid';
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_BODY_CHARS = 1_000_000; // JSON requests are prompts and URLs; files go through /upload by URL

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
const fail = (statusCode, message) => json(statusCode, { error: { message } });
const brandText = (s) => String(s ?? '').replace(/mu-?api(?:\.ai|app)?/gi, BRAND);

const header = (h = {}, name) => Object.entries(h).find(([k]) => k.toLowerCase() === name)?.[1];
function bearerToken(headers) {
  const m = /^Bearer\s+(\S+)$/i.exec(String(header(headers, 'authorization') || ''));
  return m ? m[1] : null;
}

/**
 * Who is calling: { userId, keys: { muapi, openai } } from an MCP key, or null.
 * MCP_ALLOW_BYOK=1 (local development only) lets the bearer token itself be an upstream key.
 */
async function authenticate(event, { store, env }) {
  const token = bearerToken(event.headers);
  if (!token) return null;
  if (isMcpKey(token)) return resolveMcpKey(store(), token);
  if (env.MCP_ALLOW_BYOK === '1' && /^[A-Za-z0-9._-]{16,200}$/.test(token)) return { id: null, userId: 'byok', workspaceId: 'personal', keys: { muapi: token, openai: null } };
  return null;
}

// Endpoint names are model slugs: letters, digits, dot, dash, underscore, slash. No traversal, scheme or host.
const SAFE_ENDPOINT = /^\/?[A-Za-z0-9][A-Za-z0-9._\-/]{0,120}$/;
const validEndpoint = (e) => typeof e === 'string' && SAFE_ENDPOINT.test(e) && !e.includes('..') && !e.includes('//');

const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|\[?f[cd][0-9a-f]{2}:)/i;
function validSourceUrl(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && !u.username && !u.password && !PRIVATE_HOST.test(u.hostname) && u.hostname.includes('.');
  } catch { return false; }
}

async function upstream(path, { method = 'GET', body, key, form } = {}) {
  const res = await fetch(`${UPSTREAM}${path}`, {
    method,
    headers: { 'x-api-key': key, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 200) }; }
  return { res, data };
}

function upstreamError(res, data) {
  if (res.status === 401 || res.status === 403) return fail(401, 'Your SmartVid API key was rejected, or the account is out of credit. Check it in SmartVid → Settings → API keys.');
  const detail = data?.detail?.error || data?.detail || data?.error?.message || data?.error || data?.message || res.statusText;
  return fail(res.status >= 500 ? 502 : res.status, brandText(typeof detail === 'string' ? detail : JSON.stringify(detail)));
}

/**
 * What kind of thing a request does. Decided here from the route and the body, never from anything the caller says about itself.
 * Unknown studio actions default to 'write'; add an entry when a studio gains something that deletes or publishes.
 */
export function classifyRequest(route, method, input = {}) {
  if (route === '/balance' || route.startsWith('/result/') || route === '/estimate' || route.startsWith('/bridge/sessions') || route.startsWith('/bridge/result')) return { risk: 'read', label: route.split('/')[1] };
  if (route === '/generate' || route === '/upload') return { risk: 'write', label: route.slice(1) };
  const studio = /^\/studio\/([a-z0-9-]{1,40})$/.exec(route)?.[1];
  if (studio === 'personalization') {
    const m = String(input?.method || 'GET').toUpperCase();
    return { risk: m === 'DELETE' ? 'destructive' : m === 'GET' ? 'read' : 'write', label: `personalization ${m}` };
  }
  if (studio === 'pages') {
    const a = String(input?.action || '');
    return { risk: Object.hasOwn(PAGE_ACTIONS, a) ? PAGE_ACTIONS[a] : 'write', label: `pages ${a.slice(0, 20)}` };
  }
  if (studio === 'social') {
    const a = String(input?.action || '');
    return { risk: Object.hasOwn(SOCIAL_ACTIONS, a) ? SOCIAL_ACTIONS[a] : 'write', label: `social ${a.slice(0, 20)}` };
  }
  if (route === '/raw') return { risk: 'write', label: 'raw' };
  if (studio) return { risk: 'write', label: studio };
  // A tab tool's risk is the one the TAB registered for it (looked up by the handler before this is used); nothing in the body can lower it.
  if (route === '/bridge/call') return { risk: 'write', label: `bridge ${String(input?.tool || '').slice(0, 40)}` };
  return { risk: 'write', label: route.slice(1, 40) };
}

export function createHandler({ store = () => createSupabaseStore(), studios = STUDIOS, env = process.env, governor = defaultGovernor(env), bridge = defaultBridge(env) } = {}) {
  return async function gateway(event) {
  let who;
  try { who = await authenticate(event, { store, env }); } catch (err) {
    console.error('[mcp-gateway] auth failed:', err?.message || 'error');
    return fail(503, `${BRAND} MCP access is temporarily unavailable.`);
  }
  if (!who) return fail(401, 'Missing, invalid or revoked SmartVid MCP key. Create one in Settings → MCP access and send it as "Authorization: Bearer <key>".');
  const key = who.keys.muapi;

  const route = String(event.path || '').split('?')[0].replace(/^.*\/(?:api\/mcp-gateway|mcp-gateway)/, '').replace(/\/+$/, '') || '/';
  const method = event.httpMethod;
  let input = {};
  if (method === 'POST') {
    if (String(event.body || '').length > MAX_BODY_CHARS) return fail(413, 'Request body is too large.');
    try { input = event.body ? JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body) : {}; }
    catch { return fail(400, 'Request body must be JSON.'); }
  }

  // Safeguards: confirm for destructive/publish, a daily cap, and an audit row for every call.
  const cls = classifyRequest(route, method, input);
  if (route === '/bridge/call' && bridge) {
    try { cls.risk = (await bridge.toolRisk(who.userId, input?.session, input?.tool)) || 'write'; } catch { cls.risk = 'write'; }
  }
  if (governor) {
    const gate = await governor.check({ keyId: who.id, risk: cls.risk, confirm: input?.confirm === true, label: cls.label });
    if (!gate.ok) return json(gate.status, { error: { message: gate.message, code: gate.code } });
  } else if ((cls.risk === 'destructive' || cls.risk === 'publish') && input?.confirm !== true) {
    return json(409, { error: { message: `This would ${cls.risk === 'publish' ? 'publish or send' : 'delete or overwrite'} something. Nothing was done. Call again with confirm: true.`, code: 'confirm_required' } });
  }
  const started = Date.now();
  const run = async () => {
  try {
    if (route === '/generate' && method === 'POST') {
      if (!validEndpoint(input.endpoint)) return fail(400, 'Invalid endpoint.');
      const { res, data } = await upstream(`/${input.endpoint.replace(/^\//, '')}`, { method: 'POST', body: input.payload || {}, key });
      if (!res.ok) return upstreamError(res, data);
      return json(200, data);
    }

    if (route === '/estimate' && method === 'POST') {
      if (!validEndpoint(input.endpoint)) return fail(400, 'Invalid endpoint.');
      const { res, data } = await upstream(`/models/${input.endpoint.replace(/^\//, '')}/estimate-cost`, { method: 'POST', body: input.payload || {}, key });
      if (!res.ok) return upstreamError(res, data);
      return json(200, data);
    }

    const resultMatch = /^\/result\/([A-Za-z0-9._-]{1,100})$/.exec(route);
    if (resultMatch && method === 'GET') {
      const path = `/predictions/${resultMatch[1]}/result`;
      let { res, data } = await upstream(path, { key });
      let verb = 'GET';
      // Some deployments only accept POST for status; fall back once.
      if (res.status === 404 || res.status === 405) { ({ res, data } = await upstream(path, { method: 'POST', body: {}, key })); verb = 'POST'; }
      if (!res.ok && !data?.detail?.status) return upstreamError(res, data);
      const out = json(200, data?.detail?.status ? { status: data.detail.status, error: data.detail.error } : data);
      out.headers['X-Poll-Method'] = res.ok ? verb : `${verb} (failed)`; // lets the smoke run settle which verb the upstream status route accepts
      return out;
    }

    if (route === '/balance' && method === 'GET') {
      const { res, data } = await upstream('/account/balance', { key });
      if (!res.ok) return upstreamError(res, data);
      return json(200, data);
    }

    if (route === '/upload' && method === 'POST') {
      // Multipart bodies exceed function limits; re-hosting a public https URL is the supported path.
      if (!validSourceUrl(input.source_url)) return fail(400, 'Provide "source_url": a public https URL. (Direct uploads are not supported through this gateway.)');
      const src = await fetch(input.source_url, { redirect: 'error' });
      if (!src.ok) return fail(400, `Could not fetch source_url (${src.status}).`);
      const len = Number(src.headers.get('content-length') || 0);
      if (len > MAX_UPLOAD_BYTES) return fail(413, 'File is too large (25 MB max).');
      const buf = Buffer.from(await src.arrayBuffer());
      if (buf.length > MAX_UPLOAD_BYTES) return fail(413, 'File is too large (25 MB max).');
      const form = new FormData();
      form.append('file', new Blob([buf], { type: src.headers.get('content-type') || 'application/octet-stream' }), new URL(input.source_url).pathname.split('/').pop() || 'file');
      const { res, data } = await upstream('/upload_file', { method: 'POST', form, key });
      if (!res.ok) return upstreamError(res, data);
      return json(200, { url: data.url || data.file_url || data.data?.url });
    }

    if (route.startsWith('/bridge/')) {
      if (!bridge) return fail(503, 'Tab control is not configured on this server.');
      if (who.userId === 'byok') return fail(401, 'This needs a signed-in SmartVid MCP key.');
      try {
        if (route === '/bridge/sessions' && method === 'GET') return json(200, { sessions: await bridge.sessions(who.userId) });
        if (route === '/bridge/call' && method === 'POST') {
          const asked = Number(input.wait_ms);
          const waitMs = Math.min(Math.max(Number.isFinite(asked) ? asked : 20_000, 0), 25_000); // 0 means "do not wait"
          const out = await bridge.call(who.userId, { session: input.session, tool: input.tool, args: input.args, waitMs });
          return json(200, JSON.parse(brandText(JSON.stringify(out))));
        }
        const res = /^\/bridge\/result\/([A-Za-z0-9-]{8,64})$/.exec(route);
        if (res && method === 'GET') {
          const q = event.queryStringParameters?.wait ?? new URL(String(event.path || '/'), 'https://x.invalid').searchParams.get('wait');
          const wait = Math.min(Math.max(Number(q) || 0, 0), 25_000);
          return json(200, JSON.parse(brandText(JSON.stringify(await bridge.waitFor(who.userId, res[1], wait)))));
        }
      } catch (err) {
        if (err instanceof BridgeError) return json(err.status, { error: { message: brandText(err.message), code: err.code } });
        throw err;
      }
      return fail(404, 'Unknown route.');
    }

    const studioMatch = /^\/studio\/([a-z0-9-]{1,40})$/.exec(route);
    if (studioMatch && method === 'POST') {
      const run = Object.hasOwn(studios, studioMatch[1]) ? studios[studioMatch[1]] : null;
      if (!run) return fail(404, 'Unknown studio.');
      const out = await run(input, who);
      // The studios' own messages may name the generation provider; scrub the body before it leaves.
      return { statusCode: out.statusCode || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: brandText(out.body ?? '{}') };
    }

    return fail(404, 'Unknown route.');
  } catch (err) {
    return fail(502, `${BRAND} gateway error: ${brandText(err?.message)}`);
  }
  };
  const out = await run();
  if (governor) await governor.record({ keyId: who.id, userId: who.userId, tool: cls.label, risk: cls.risk, ok: (out?.statusCode || 200) < 400, ms: Date.now() - started });
  return out;
  };
}

function defaultBridge(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    return createBridge({ store: createSupabaseBridgeStore(createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })), brandName: BRAND });
  } catch { return null; }
}

function defaultGovernor(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    return createGovernor({ store: createSupabaseGovernorStore(admin), caps: { destructive: Number(env.MCP_CAP_DESTRUCTIVE) || 50, publish: Number(env.MCP_CAP_PUBLISH) || 20 } });
  } catch { return null; }
}

export const handler = createHandler();
