// Live smoke run: one cheapest call per model kind and one call per custom tool, through the real MCP server and gateway.
// Pure planning/running logic with injected I/O so it can be tested offline (see createFakeGateway). Never prints the key.
import { createCatalog } from './catalog.js';
import { createGatewayClient } from './client.js';
import { createBrandedServer, GENERATION_TOOLS } from './server.js';
import { connectInMemory } from './memory.js';

export const SAMPLE_PROMPT = 'A small red ball on a plain white table, soft daylight';
const MEDIA = /image|frame|mask|reference/i;

export function extractCost(d) {
  if (!d || typeof d !== 'object') return null;
  for (const k of ['cost', 'estimated_cost', 'estimate', 'price', 'credits', 'usd', 'total']) {
    const v = d[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  }
  return d.data ? extractCost(d.data) : null;
}

/** Inputs for one cheap call to `entry`, or { skip } when a required input cannot be satisfied (e.g. no sample video). */
export function sampleInputs(entry, samples = {}) {
  const inputs = {};
  for (const [name, def] of Object.entries(entry.inputs || {})) {
    const required = !!def.required || (name === 'prompt' && entry.hasPrompt !== false);
    const isDuration = name === 'duration' || name === 'duration_seconds';
    if (!required && !isDuration) continue;
    if (name === 'request_id') return { skip: 'needs the id of an earlier job' };
    if (name === 'prompt' || /^(text|script)$/.test(name)) { inputs[name] = SAMPLE_PROMPT; continue; }
    if (isDuration) {
      const opts = def.enum ? def.enum.map(Number).filter(Number.isFinite) : [];
      const lo = opts.length ? Math.min(...opts) : def.minimum;
      if (lo !== undefined && Number.isFinite(Number(lo))) inputs[name] = Number(lo);
      else if (required) inputs[name] = Number(def.default) || 5;
      continue;
    }
    const kind = /video/i.test(name) ? 'video' : /audio/i.test(name) ? 'audio' : MEDIA.test(name) || /url/i.test(name) ? 'image' : null;
    if (kind) {
      const url = samples[kind];
      if (!url) return { skip: `needs a sample ${kind} URL (${name})` };
      inputs[name] = def.type === 'array' || /_list$|_files$/.test(name) ? [url] : url;
    } else if (def.enum?.length) inputs[name] = def.enum[0];
    else if (/int|number|float/.test(def.type)) inputs[name] = Number(def.default) || 1;
    else if (def.type === 'array') inputs[name] = ['x'];
    else inputs[name] = def.default ?? 'x';
  }
  return { inputs };
}

/** Candidate models per kind: those whose required inputs we can satisfy, fewest requirements first, capped at n. */
export function candidatesFor(entries, kind, { samples, n = 8 } = {}) {
  return entries
    .filter((e) => e.kind === kind)
    .map((e) => ({ e, s: sampleInputs(e, samples) }))
    .filter((c) => !c.s.skip)
    .sort((a, b) => Object.values(a.e.inputs || {}).filter((d) => d.required).length - Object.values(b.e.inputs || {}).filter((d) => d.required).length || a.e.key.localeCompare(b.e.key))
    .slice(0, n)
    .map((c) => ({ entry: c.e, inputs: c.s.inputs }));
}

export function toolForKind(kind, extra = []) {
  return [...GENERATION_TOOLS, ...extra].find((t) => t.kinds?.includes(kind));
}

/**
 * Build the run plan. `client.estimate` is called (no spend) for each candidate; the cheapest with a known cost wins per kind.
 * Returns { items: [{ id, kind?, tool, model, args, estUsd, estimated }], skipped: [{ id, reason }], total }.
 */
export async function buildPlan({ catalog, client, samples = {}, candidates = 8, only, cases = [], allowUnknownCost = false, brandTools = [] }) {
  const items = [];
  const skipped = [];
  const kinds = catalog.kinds().filter((k) => !only || only.includes(k));
  for (const kind of kinds) {
    const tool = toolForKind(kind, brandTools);
    if (!tool) { skipped.push({ id: `kind:${kind}`, reason: 'no generation tool serves this kind' }); continue; }
    const list = candidatesFor(catalog.entries, kind, { samples, n: candidates });
    if (!list.length) { skipped.push({ id: `kind:${kind}`, reason: 'no model whose required inputs can be satisfied with the sample inputs given' }); continue; }
    const priced = [];
    for (const c of list) {
      try {
        const { endpoint, payload } = catalog.buildRequest(c.entry.key, c.inputs);
        priced.push({ ...c, cost: extractCost(await client.estimate(endpoint, payload)) });
      } catch { priced.push({ ...c, cost: null }); }
    }
    const known = priced.filter((p) => p.cost !== null).sort((a, b) => a.cost - b.cost);
    const pick = known[0] || (allowUnknownCost ? priced[0] : null);
    if (!pick) { skipped.push({ id: `kind:${kind}`, reason: 'cost could not be estimated (re-run with --allow-unknown-cost to run the first candidate)' }); continue; }
    items.push({ id: `kind:${kind}`, kind, tool: tool.name, model: pick.entry.key, args: { model: pick.entry.key, inputs: pick.inputs, wait: true }, estUsd: pick.cost ?? 0, estimated: pick.cost !== null, timeoutMs: tool.timeoutMs || 600_000 });
  }
  for (const c of cases) {
    if (only && !only.includes(c.id) && !only.includes(c.tool)) continue;
    const missing = (c.needs || []).filter((n) => !samples[n]);
    if (missing.length) { skipped.push({ id: `tool:${c.tool}`, reason: `needs a sample ${missing.join(', ')} URL` }); continue; }
    items.push({ id: `tool:${c.tool}`, tool: c.tool, args: typeof c.args === 'function' ? c.args(samples) : c.args, estUsd: c.estUsd ?? 0, estimated: false, assumed: c.estUsd !== undefined, timeoutMs: c.timeoutMs || 600_000 });
  }
  const total = items.reduce((s, i) => s + (i.estUsd || 0), 0);
  return { items, skipped, total };
}

/** Returns an error message when a live run is not explicitly authorised to spend, else null. */
export function spendGuard({ dry, yes, cap }) {
  if (dry) return null;
  if (!yes || cap === undefined || !Number.isFinite(cap) || cap <= 0) return 'Not running. To spend, pass both --confirm-spend <max amount> and --yes. Calls stop before the cap would be exceeded.';
  return null;
}

export function renderPlan(plan) {
  const lines = ['Smoke plan (no calls made yet):', ''];
  for (const i of plan.items) lines.push(`  ${i.id.padEnd(28)} ${i.tool.padEnd(22)} ${(i.model || '').padEnd(36)} ~$${(i.estUsd || 0).toFixed(3)}${i.estimated ? '' : i.assumed ? ' (assumed)' : ' (unestimated)'}`);
  for (const s of plan.skipped) lines.push(`  ${s.id.padEnd(28)} SKIPPED: ${s.reason}`);
  lines.push('', `Estimated total: ~$${plan.total.toFixed(3)} (units as reported by the estimate route; assumed USD)`);
  return lines.join('\n');
}

const scrub = (s, key) => {
  let t = String(s ?? '');
  if (key) t = t.split(key).join('[key]');
  return t.replace(/sv_live_[A-Za-z0-9_-]+/g, 'sv_live_[key]').replace(/mu-?api(?:\.ai|app)?/gi, 'provider').slice(0, 400);
};

/** Run the plan through an MCP client. Stops spending once the cap would be exceeded. */
export async function runPlan(plan, { mcp, prefix, cap, key, now = () => Date.now(), log = () => {} }) {
  const results = [];
  let spent = 0;
  for (const item of plan.items) {
    if (cap !== undefined && spent + (item.estUsd || 0) > cap) {
      results.push({ id: item.id, tool: item.tool, status: 'skipped', reason: `spend cap $${cap} would be exceeded` });
      continue;
    }
    const started = now();
    log(`running ${item.id} (${item.tool}${item.model ? ' / ' + item.model : ''})`);
    try {
      const res = await mcp.callTool({ name: `${prefix}_${item.tool}`, arguments: item.args }, undefined, { timeout: item.timeoutMs });
      spent += item.estUsd || 0;
      let body; try { body = JSON.parse(res.content?.[0]?.text ?? '{}'); } catch { body = { raw: String(res.content?.[0]?.text ?? '').slice(0, 200) }; }
      const failed = res.isError || body.status === 'failed' || body.error;
      const processing = body.status === 'processing';
      results.push({
        id: item.id, tool: item.tool, model: item.model, estUsd: item.estUsd || 0, ms: now() - started,
        status: failed ? 'fail' : processing ? 'pending' : 'pass',
        requestId: body.request_id || body.run_id, error: failed ? scrub(body.error || body.raw || 'tool reported an error', key) : undefined,
        note: processing ? 'still running when the timeout hit; check get_result' : undefined,
      });
    } catch (err) {
      spent += item.estUsd || 0;
      results.push({ id: item.id, tool: item.tool, model: item.model, estUsd: item.estUsd || 0, ms: now() - started, status: 'fail', error: scrub(err?.message, key) });
    }
  }
  return { results, spent };
}

/** No-spend negative checks against the gateway over plain HTTP. `extra` are brand-specific checks. */
export async function negativeChecks({ gatewayUrl, key, fetchImpl = fetch, extra = [] }) {
  const base = gatewayUrl.replace(/\/+$/, '');
  const call = async (path, { method = 'GET', auth, body } = {}) => {
    try {
      const res = await fetchImpl(`${base}${path}`, { method, headers: { ...(auth ? { Authorization: auth } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body });
      return { status: res.status, text: await res.text(), headers: res.headers };
    } catch (err) { return { status: 0, text: String(err?.message || err) }; }
  };
  const checks = [
    ['no key is refused', () => call('/balance'), (r) => r.status === 401],
    ['malformed key is refused', () => call('/balance', { auth: 'Bearer not-a-real-key' }), (r) => r.status === 401],
    ['oversized body is refused', () => call('/generate', { method: 'POST', auth: `Bearer ${key}`, body: JSON.stringify({ endpoint: 'x', payload: { p: 'a'.repeat(1_100_000) } }) }), (r) => r.status === 413],
    ['unsafe endpoint is refused', () => call('/generate', { method: 'POST', auth: `Bearer ${key}`, body: JSON.stringify({ endpoint: '../account/balance', payload: {} }) }), (r) => r.status === 400],
    ['private upload source is refused', () => call('/upload', { method: 'POST', auth: `Bearer ${key}`, body: JSON.stringify({ source_url: 'https://169.254.169.254/latest/meta-data' }) }), (r) => r.status === 400],
    ...extra.map((c) => [c.name, () => call(c.path, { method: c.method || 'POST', auth: `Bearer ${key}`, body: c.body ? JSON.stringify(c.body) : undefined }), (r) => c.expect.includes(r.status)]),
  ];
  const out = [];
  for (const [name, run, ok] of checks) {
    const r = await run();
    out.push({ id: `neg:${name}`, status: ok(r) ? 'pass' : 'fail', error: ok(r) ? undefined : scrub(`unexpected HTTP ${r.status}: ${r.text}`, key) });
  }
  out.push({ id: 'neg:revoked key is refused', status: 'skipped', reason: 'needs a signed-in session to create and revoke a key; check by hand (see DEPLOY.md)' });
  return out;
}

/** Which verb the upstream status route accepts, read from the gateway's X-Poll-Method header after one real job. */
export async function pollVerbProbe({ gatewayUrl, key, requestId, fetchImpl = fetch }) {
  const res = await fetchImpl(`${gatewayUrl.replace(/\/+$/, '')}/result/${encodeURIComponent(requestId)}`, { headers: { Authorization: `Bearer ${key}` } });
  const verb = res.headers?.get?.('x-poll-method') || null;
  return { status: res.status, verb };
}

/** Offline stand-in for the gateway: balance, estimate, generate, result, upload and studio routes. */
export function createFakeGateway({ costs = {}, failEndpoints = [], studios = ['zackd', 'agent-audio', 'brand-scrape', 'cinegen', 'personalization', 'design-agent', 'go-ai-viral', 'brand', 'campaigns', 'thumbnail', 'demo'] } = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '').replace(/^\/api\/mcp-gateway/, '');
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ path, method: init.method || 'GET', auth: init.headers?.Authorization, body });
    const reply = (status, data, headers = {}) => ({ ok: status < 400, status, statusText: '', headers: { get: (k) => headers[k.toLowerCase()] ?? null }, text: async () => JSON.stringify(data) });
    if (!String(init.headers?.Authorization || '').startsWith('Bearer sv_live_')) return reply(401, { error: { message: 'Missing, invalid or revoked key' } });
    if (path === '/balance') return reply(200, { balance: 10 });
    if (path === '/estimate') return reply(200, { cost: costs[body.endpoint.replace(/^\//, '')] ?? 0.05 });
    if (path === '/generate') return String(init.body).length > 1_000_000 ? reply(413, { error: { message: 'too large' } }) : /\.\./.test(body.endpoint) ? reply(400, { error: { message: 'Invalid endpoint.' } }) : failEndpoints.includes(body.endpoint.replace(/^\//, '')) ? reply(502, { error: { message: 'provider said no' } }) : reply(200, { request_id: 'req_' + calls.length });
    if (path.startsWith('/result/')) return reply(200, { status: 'completed', outputs: ['https://cdn.example.com/out.png'], text: 'ok' }, { 'x-poll-method': 'GET' });
    if (path === '/upload') return reply(400, { error: { message: 'Provide a public https URL.' } });
    if (path.startsWith('/studio/')) return !studios.includes(path.slice('/studio/'.length)) ? reply(404, { error: { message: 'Unknown studio.' } }) : reply(200, { ok: true, status: 'done', url: 'https://cdn.example.com/s.png', requestId: 'studio_req' });
    if (path === '/raw') {
      const ok = (body.method === 'GET' && /^\/(workflow\/get-|agents\/)/.test(body.path)) || (body.method === 'POST' && /^\/agents\/by-slug\/[\w-]+\/chat$/.test(body.path));
      return ok ? reply(200, { is_complete: true, messages: [], workflows: [], agents: [] }) : reply(400, { error: { message: 'That request is not available through MCP.' } });
    }
    return reply(404, { error: { message: 'Unknown route.' } });
  };
  return { fetchImpl, calls };
}

export { createCatalog, createGatewayClient, createBrandedServer, connectInMemory };
