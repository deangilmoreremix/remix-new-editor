// Dev-only stand-in for the Supabase "muapi-proxy" edge function.
//
// The app's MuapiClient posts { endpoint, params, apiMethod } to /functions/v1/muapi-proxy and the
// real edge function forwards it to muapi. When there is no Supabase project (a fresh checkout, a CI
// box, a cloud sandbox) this plugin answers that same request locally and forwards it straight to
// https://api.muapi.ai, so the real in-app Generate buttons can be exercised.
//
// Use it through vite.devproxy.config.mjs:   npx vite --config vite.devproxy.config.mjs
//
// It is NOT part of the app, the build or any deployment, and it is never loaded by vite.config.js.
//
// Auth: the browser's own x-api-key / Authorization headers are dropped (the value in localStorage
// may be a placeholder). The request is sent with MUAPI_API_KEY from the environment when set;
// otherwise it is sent with no key and relies on the network layer to supply one (some sandboxes
// add the credential at their outbound proxy). The key is never logged.
//
// Forwarding uses `curl` so it honours HTTP(S)_PROXY and custom CA bundles the way Node's built-in
// fetch does not.
import { execFile } from 'node:child_process';

const TARGET = 'https://api.muapi.ai';
// Endpoints that live outside /api/v1 on muapi's server.
const OUTSIDE_V1 = /^(app|workflow|agents)\//;
// Read-only endpoints that must be sent as GET.
const GET_ENDPOINT = /^(predictions\/[\w.-]+\/result|account\/|history)/;
const SAFE_ENDPOINT = /^[A-Za-z0-9._\-/]+(\?[A-Za-z0-9._\-=&%]*)?$/;

/** Work out how to call muapi for one proxied request. Pure, so it can be tested. */
export function resolveUpstream({ endpoint, params, apiMethod } = {}, target = TARGET) {
  if (typeof endpoint !== 'string' || !SAFE_ENDPOINT.test(endpoint) || endpoint.includes('..') || endpoint.startsWith('/')) {
    return { error: 'Unsupported endpoint' };
  }
  const method = String(apiMethod || (GET_ENDPOINT.test(endpoint) ? 'GET' : 'POST')).toUpperCase();
  if (!['GET', 'POST', 'DELETE'].includes(method)) return { error: 'Unsupported method' };
  const url = `${target}${OUTSIDE_V1.test(endpoint) ? '/' : '/api/v1/'}${endpoint}`;
  return { url, method, body: method === 'POST' ? JSON.stringify(params ?? {}) : null };
}

function curlForward({ url, method, body }, apiKey) {
  return new Promise((resolve, reject) => {
    const args = ['-sS', '--max-time', '120', '-X', method, '-H', 'Content-Type: application/json', '-w', '\n%{http_code}'];
    if (apiKey) args.push('-H', `x-api-key: ${apiKey}`);
    if (body !== null) args.push('--data-binary', '@-');
    args.push(url);
    const child = execFile('curl', args, { maxBuffer: 32 * 1024 * 1024 }, (err, stdout) => {
      if (err && !stdout) return reject(err);
      const cut = stdout.lastIndexOf('\n');
      resolve({ status: Number(stdout.slice(cut + 1)) || 502, text: stdout.slice(0, cut) });
    });
    if (body !== null) child.stdin.end(body); else child.stdin.end();
  });
}

export function createMuapiDevProxyHandler({ forward = curlForward, target = TARGET, apiKey = process.env.MUAPI_API_KEY, log = true } = {}) {
  return async function muapiDevProxy(req, res, next) {
    if (req.method !== 'POST') return next();
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    let payload;
    try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { payload = null; }
    const send = (status, text) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.end(text);
    };
    if (!payload) return send(400, JSON.stringify({ error: 'Invalid JSON' }));
    const upstream = resolveUpstream(payload, target);
    if (upstream.error) return send(400, JSON.stringify({ error: upstream.error }));
    try {
      const result = await forward(upstream, apiKey);
      if (log) console.log(`[muapi-dev-proxy] ${upstream.method} ${payload.endpoint} -> ${result.status}`);
      send(result.status, result.text || '{}');
    } catch (err) {
      if (log) console.warn(`[muapi-dev-proxy] ${payload.endpoint} failed: ${err.message}`);
      send(502, JSON.stringify({ error: 'Upstream request failed', details: err.message }));
    }
  };
}

export function muapiDevProxyPlugin(options = {}) {
  return {
    name: 'muapi-dev-proxy',
    apply: 'serve',
    enforce: 'pre',
    configureServer(server) {
      // Registered directly (not in the returned post-hook) so it runs before the built-in handlers.
      server.middlewares.use('/functions/v1/muapi-proxy', createMuapiDevProxyHandler(options));
    },
  };
}
