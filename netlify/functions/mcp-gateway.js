// netlify/functions/mcp-gateway.js
// Branded gateway for the SmartVid MCP server (mcp/index.js). Routes (see netlify.toml):
//   POST /api/mcp-gateway/generate        { endpoint, payload }  -> { request_id | outputs }
//   GET  /api/mcp-gateway/result/{id}                            -> { status, outputs, error }
//   POST /api/mcp-gateway/estimate        { endpoint, payload }  -> { cost }
//   POST /api/mcp-gateway/upload          { source_url }         -> { url }
//   GET  /api/mcp-gateway/balance                                -> { balance }
// BYOK, like every other function here: the caller's SmartVid key arrives as
// `Authorization: Bearer <key>` and is used for this request only; it is never
// logged or stored, and there is no platform-key fallback. The generation backend
// is never named in a response.

const UPSTREAM = 'https://api.muapi.ai/api/v1';
const BRAND = 'SmartVid';
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
const fail = (statusCode, message) => json(statusCode, { error: { message } });
const brandText = (s) => String(s ?? '').replace(/mu-?api(?:\.ai|app)?/gi, BRAND);

const header = (h = {}, name) => Object.entries(h).find(([k]) => k.toLowerCase() === name)?.[1];
function bearerKey(headers) {
  const m = /^Bearer\s+(\S+)$/i.exec(String(header(headers, 'authorization') || ''));
  return m && /^[A-Za-z0-9._-]{16,200}$/.test(m[1]) ? m[1] : null;
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

export async function handler(event) {
  const key = bearerKey(event.headers);
  if (!key) return fail(401, 'Missing or malformed SmartVid API key. Send it as "Authorization: Bearer <key>".');

  const route = String(event.path || '').replace(/^.*\/(?:api\/mcp-gateway|mcp-gateway)/, '').replace(/\/+$/, '') || '/';
  const method = event.httpMethod;
  let input = {};
  if (method === 'POST') {
    try { input = event.body ? JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body) : {}; }
    catch { return fail(400, 'Request body must be JSON.'); }
  }

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
      // Some deployments only accept POST for status; fall back once.
      if (res.status === 404 || res.status === 405) ({ res, data } = await upstream(path, { method: 'POST', body: {}, key }));
      if (!res.ok && !data?.detail?.status) return upstreamError(res, data);
      return json(200, data?.detail?.status ? { status: data.detail.status, error: data.detail.error } : data);
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

    return fail(404, 'Unknown route.');
  } catch (err) {
    return fail(502, `${BRAND} gateway error: ${brandText(err?.message)}`);
  }
}
