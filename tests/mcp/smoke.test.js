// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { smoke, createCatalog, createGatewayClient, createBrandedServer, renderCoverage, liveStatus } from '../../packages/studio-mcp-core/src/index.js';
import { brand, endpointFixes } from '../../mcp/brand.js';
import { customTools } from '../../mcp/tools.js';
import { cases, extraNegatives } from '../../mcp/smoke-cases.js';

const root = process.cwd();
const entries = JSON.parse(readFileSync(path.resolve(root, 'mcp/catalog.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(path.resolve(root, 'mcp/studios.json'), 'utf8'));
const catalog = createCatalog(entries, { endpointFixes });
const KEY = 'sv_live_' + 'k'.repeat(43);
const SAMPLES = { image: 'https://cdn.example.com/in.png', video: 'https://cdn.example.com/in.mp4', audio: 'https://cdn.example.com/in.mp3', url: 'https://example.com' };

function setup(opts) {
  const fake = smoke.createFakeGateway(opts);
  const client = createGatewayClient({ gatewayUrl: 'https://gw.test/api/mcp-gateway', apiKey: KEY, brandName: brand.name, fetchImpl: fake.fetchImpl, pollIntervalMs: 1 });
  return { fake, client };
}

describe('sampleInputs / candidates', () => {
  it('fills required inputs, picks the shortest duration, and skips what it cannot satisfy', () => {
    const e = { kind: 't2v', hasPrompt: true, inputs: { prompt: { type: 'string', required: true }, duration: { type: 'integer', enum: [10, 5, 8] }, aspect_ratio: { type: 'string', enum: ['16:9'] } } };
    expect(smoke.sampleInputs(e)).toEqual({ inputs: { prompt: smoke.SAMPLE_PROMPT, duration: 5 } });
    const v = { kind: 'v2v', inputs: { video_url: { type: 'string', required: true } } };
    expect(smoke.sampleInputs(v).skip).toMatch(/sample video/);
    expect(smoke.sampleInputs(v, { video: SAMPLES.video })).toEqual({ inputs: { video_url: SAMPLES.video } });
    const list = { kind: 'i2i', inputs: { images_list: { type: 'array', required: true } } };
    expect(smoke.sampleInputs(list, SAMPLES).inputs.images_list).toEqual([SAMPLES.image]);
  });

  it('every sampled request for every catalog model is accepted by the catalog validator', () => {
    for (const e of entries.filter((x) => !x.fixedRoute)) {
      const s = smoke.sampleInputs(e, SAMPLES);
      if (s.skip) continue;
      expect(() => catalog.buildRequest(e.key, s.inputs), e.key).not.toThrow();
    }
  });
});

describe('plan', () => {
  it('picks the cheapest known-cost model per kind and never calls anything but estimate', async () => {
    const { fake, client } = setup({ costs: { 'flux-dev-image': 0.01 } });
    const plan = await smoke.buildPlan({ catalog, client, samples: SAMPLES, candidates: 40, cases });
    expect(plan.items.find((i) => i.id === 'kind:t2i').estUsd).toBeLessThanOrEqual(0.05);
    expect(new Set(fake.calls.map((c) => c.path))).toEqual(new Set(['/estimate']));
    expect(plan.items.filter((i) => i.id.startsWith('kind:')).length).toBeGreaterThanOrEqual(10);
    expect(plan.total).toBeGreaterThan(0);
    expect(smoke.renderPlan(plan)).toContain('Estimated total');
  });

  it('skips with a reason when a sample is missing or cost is unknown', async () => {
    const { client } = setup();
    const plan = await smoke.buildPlan({ catalog, client, samples: {}, cases });
    expect(plan.skipped.find((s) => s.id === 'tool:video_extend').reason).toMatch(/sample video/);
    const noCost = { estimate: async () => ({ nothing: true }) };
    const p2 = await smoke.buildPlan({ catalog, client: noCost, samples: SAMPLES, only: ['t2i'] });
    expect(p2.items).toEqual([]);
    expect(p2.skipped[0].reason).toMatch(/allow-unknown-cost/);
    const p3 = await smoke.buildPlan({ catalog, client: noCost, samples: SAMPLES, only: ['t2i'], allowUnknownCost: true });
    expect(p3.items).toHaveLength(1);
  });

  it('extractCost reads the shapes an estimate route may return', () => {
    expect(smoke.extractCost({ cost: 0.2 })).toBe(0.2);
    expect(smoke.extractCost({ estimated_cost: '0.5' })).toBe(0.5);
    expect(smoke.extractCost({ data: { price: 3 } })).toBe(3);
    expect(smoke.extractCost({ cost: 'n/a' })).toBeNull();
    expect(smoke.extractCost(null)).toBeNull();
  });
});

describe('run', () => {
  async function run({ cap, opts, only }) {
    const { client, fake } = setup(opts);
    const plan = await smoke.buildPlan({ catalog, client, samples: SAMPLES, cases, only });
    const server = createBrandedServer({ brand: { ...brand, customTools }, catalog, client });
    const mcp = await smoke.connectInMemory(server);
    return { ...(await smoke.runPlan(plan, { mcp, prefix: brand.prefix, cap, key: KEY })), plan, fake };
  }

  it('passes everything against a healthy gateway, through the real MCP tools', async () => {
    const { results, plan } = await run({});
    expect(results).toHaveLength(plan.items.length);
    expect(results.filter((r) => r.status !== 'pass')).toEqual([]);
  });

  it('stops spending before the cap would be exceeded', async () => {
    const { results, spent } = await run({ cap: 0.12 });
    expect(spent).toBeLessThanOrEqual(0.12);
    expect(results.some((r) => r.status === 'skipped' && /spend cap/.test(r.reason))).toBe(true);
    expect(results.some((r) => r.status === 'pass')).toBe(true);
  });

  it('records failures with the provider scrubbed and the key never present', async () => {
    const { results } = await run({ opts: { failEndpoints: ['flux-dev-image'] }, only: ['t2i'] });
    const f = results.find((r) => r.id === 'kind:t2i');
    if (f.status === 'fail') expect(f.error).not.toMatch(/mu-?api|sv_live_[A-Za-z0-9]{10}/i);
    expect(JSON.stringify(results)).not.toContain(KEY);
  });
});

describe('spend guard', () => {
  it('refuses a live run unless both --yes and a positive cap are given', () => {
    expect(smoke.spendGuard({ dry: false, yes: false, cap: 5 })).toMatch(/Not running/);
    expect(smoke.spendGuard({ dry: false, yes: true, cap: undefined })).toMatch(/Not running/);
    expect(smoke.spendGuard({ dry: false, yes: true, cap: 0 })).toMatch(/Not running/);
    expect(smoke.spendGuard({ dry: false, yes: true, cap: NaN })).toMatch(/Not running/);
    expect(smoke.spendGuard({ dry: false, yes: true, cap: -1 })).toMatch(/Not running/);
    expect(smoke.spendGuard({ dry: false, yes: true, cap: 2 })).toBeNull();
    expect(smoke.spendGuard({ dry: true })).toBeNull();
  });
});

describe('negative checks and probe', () => {
  it('all pass against a gateway that behaves, and the revoked-key check is honestly skipped', async () => {
    const { fake } = setup();
    const out = await smoke.negativeChecks({ gatewayUrl: 'https://gw.test/api/mcp-gateway', key: KEY, fetchImpl: fake.fetchImpl, extra: extraNegatives });
    expect(out.filter((r) => r.status === 'fail')).toEqual([]);
    expect(out.find((r) => r.id.includes('revoked')).status).toBe('skipped');
    expect(out.length).toBeGreaterThanOrEqual(7);
  });

  it('flags a gateway that accepts what it should refuse', async () => {
    const lax = async () => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => '{}' });
    const out = await smoke.negativeChecks({ gatewayUrl: 'https://gw.test', key: KEY, fetchImpl: lax });
    expect(out.filter((r) => r.status === 'fail').length).toBeGreaterThanOrEqual(4);
    expect(JSON.stringify(out)).not.toContain(KEY);
  });

  it('reads the poll verb from the gateway header', async () => {
    const { fake } = setup();
    expect(await smoke.pollVerbProbe({ gatewayUrl: 'https://gw.test/api/mcp-gateway', key: KEY, requestId: 'req_1', fetchImpl: fake.fetchImpl })).toEqual({ status: 200, verb: 'GET' });
  });
});

describe('COVERAGE rendering', () => {
  const names = new Set(customTools.map((t) => t.name));
  const report = (results, extra = {}) => ({ generatedAt: '2026-11-22T10:00:00Z', gateway: 'x.test', spentEstimateUsd: 1, dryRun: false, pollProbe: { verb: 'GET' }, results, ...extra });

  it('says "not run" with no report and ignores dry runs', () => {
    const md = renderCoverage({ manifest, report: null, customToolNames: names, brandName: 'SmartVid' });
    expect(md).toContain('No live run recorded yet');
    expect(md).not.toContain('✔');
    expect(renderCoverage({ manifest, report: report([{ id: 'kind:t2i', status: 'pass' }], { dryRun: true }), customToolNames: names })).not.toContain('✔');
  });

  it('marks a studio ✔ only when every kind and custom tool it uses passed', () => {
    const e = { tools: ['image_generate', 'image_edit'], kinds: ['t2i', 'i2i'] };
    expect(liveStatus(e, [{ id: 'kind:t2i', status: 'pass' }, { id: 'kind:i2i', status: 'pass' }], names, '2026-11-22')).toBe('✔ 2026-11-22');
    expect(liveStatus(e, [{ id: 'kind:t2i', status: 'pass' }], names, 'd')).toMatch(/^partial 1\/2/);
    expect(liveStatus(e, [{ id: 'kind:t2i', status: 'pass' }, { id: 'kind:i2i', status: 'fail', error: 'boom' }], names, 'd')).toMatch(/^✘ kind:i2i: boom/);
    expect(liveStatus(e, [], names, 'd')).toBe('not run');
    expect(liveStatus({ tools: ['skills_list'], kinds: [] }, [], new Set(), 'd')).toBe('no live check defined');
    const z = { tools: ['zackd_submit'], kinds: [] };
    expect(liveStatus(z, [{ id: 'tool:zackd_submit', status: 'pass' }], names, 'd')).toBe('✔ d');
  });

  it('renders the gateway checks and the verb', () => {
    const md = renderCoverage({ manifest, report: report([{ id: 'neg:no key is refused', status: 'pass' }, { id: 'neg:revoked key is refused', status: 'skipped', reason: 'by hand' }]), customToolNames: names });
    expect(md).toContain('Status route verb accepted upstream: GET');
    expect(md).toContain('| no key is refused | ✔ |');
    expect(md).toContain('skipped: by hand');
  });
});
