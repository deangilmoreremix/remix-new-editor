// Live smoke run for the MCP. See mcp/DEPLOY.md.
//   node scripts/mcp-smoke.mjs --dry-run                                  (offline, fake gateway)
//   SMARTVID_API_KEY=sv_live_... node scripts/mcp-smoke.mjs --sample-image URL [--sample-video URL] --confirm-spend 2 --yes
// Without --confirm-spend and --yes it prints the plan (balance + estimates only, no spend) and exits with code 2.
import { writeFileSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { smoke, createCatalog, createGatewayClient, createBrandedServer } from '../packages/studio-mcp-core/src/index.js';
import { brand, endpointFixes } from '../mcp/brand.js';
import { customTools } from '../mcp/tools.js';
import { cases, extraNegatives } from '../mcp/smoke-cases.js';

const { values: a } = parseArgs({ options: {
  'dry-run': { type: 'boolean' }, yes: { type: 'boolean' }, 'confirm-spend': { type: 'string' }, url: { type: 'string' },
  'sample-image': { type: 'string' }, 'sample-video': { type: 'string' }, 'sample-audio': { type: 'string' }, 'sample-url': { type: 'string' }, 'agent-slug': { type: 'string' },
  candidates: { type: 'string' }, only: { type: 'string' }, 'allow-unknown-cost': { type: 'boolean' }, out: { type: 'string' },
} });

const dry = !!a['dry-run'];
const key = dry ? 'sv_live_dryrundryrundryrundryrundryrundryrun' : process.env[brand.envVar];
const gatewayUrl = a.url || process.env[brand.gatewayEnvVar] || brand.gatewayUrl;
if (!key) { console.error(`Set ${brand.envVar} to your ${brand.name} MCP key (or use --dry-run).`); process.exit(2); }
if (!dry && !/^https:\/\//.test(gatewayUrl)) { console.error(`Gateway URL must be https (got ${gatewayUrl}).`); process.exit(2); }

const fake = dry ? smoke.createFakeGateway() : null;
const fetchImpl = fake ? fake.fetchImpl : fetch;
const entries = JSON.parse(readFileSync(new URL('../mcp/catalog.json', import.meta.url), 'utf8'));
const catalog = createCatalog(entries, { endpointFixes });
const client = createGatewayClient({ gatewayUrl, apiKey: key, brandName: brand.name, fetchImpl, pollIntervalMs: dry ? 1 : 2000 });
const samples = { image: a['sample-image'], video: a['sample-video'], audio: a['sample-audio'], url: a['sample-url'], agentSlug: a['agent-slug'] };
if (dry) Object.assign(samples, { image: 'https://cdn.example.com/in.png', video: 'https://cdn.example.com/in.mp4', audio: 'https://cdn.example.com/in.mp3', url: 'https://example.com', agentSlug: 'helper' });

// 1. Preflight, no spend.
const host = (() => { try { return new URL(gatewayUrl).host; } catch { return gatewayUrl; } })();
console.log(`${brand.name} MCP smoke run against ${dry ? 'a fake gateway (dry run)' : host}`);
try { const bal = await client.balance(); console.log(`Preflight ok. Balance: ${JSON.stringify(bal).slice(0, 120)}`); }
catch (err) { console.error(`Preflight failed: ${err.message}`); process.exit(1); }

// 2. Plan (estimates only, no spend).
const plan = await smoke.buildPlan({
  catalog, client, samples, candidates: Number(a.candidates) || 8, only: a.only?.split(','), cases, allowUnknownCost: !!a['allow-unknown-cost'], brandTools: [],
});
console.log('\n' + smoke.renderPlan(plan) + '\n');

const cap = a['confirm-spend'] !== undefined ? Number(a['confirm-spend']) : undefined;
const refusal = smoke.spendGuard({ dry, yes: !!a.yes, cap });
if (refusal) { console.error(refusal); process.exit(2); }
if (!dry && plan.total > cap) console.log('Note: the estimated total is above your cap; later items will be skipped once the cap would be exceeded.');

// 3. Run through the real MCP server (same tool layer Claude uses).
const server = createBrandedServer({ brand: { ...brand, customTools }, catalog, client });
const mcp = await smoke.connectInMemory(server);
const { results, spent } = await smoke.runPlan(plan, { mcp, prefix: brand.prefix, cap: dry ? undefined : cap, key, log: (m) => console.log(`  ${m}`) });

// 4. Poll-verb probe and no-spend negative checks.
const firstJob = results.find((r) => r.status === 'pass' && r.requestId);
let probe = null;
if (firstJob) probe = await smoke.pollVerbProbe({ gatewayUrl, key, requestId: firstJob.requestId, fetchImpl });
const negatives = await smoke.negativeChecks({ gatewayUrl, key, fetchImpl, extra: extraNegatives });

const report = {
  generatedAt: new Date().toISOString(), dryRun: dry, gateway: dry ? 'fake' : host, spentEstimateUsd: Number(spent.toFixed(4)), pollProbe: probe,
  results: [...results, ...plan.skipped.map((s) => ({ id: s.id, status: 'skipped', reason: s.reason })), ...negatives],
};
const outPath = a.out || new URL(dry ? '../mcp/smoke-results.dry-run.json' : '../mcp/smoke-results.json', import.meta.url);
writeFileSync(outPath, JSON.stringify(report, null, 2));

const tally = report.results.reduce((t, r) => ({ ...t, [r.status]: (t[r.status] || 0) + 1 }), {});
console.log(`\nResults: ${JSON.stringify(tally)}. Estimated spend ~$${report.spentEstimateUsd}.`);
if (probe) console.log(`Status route verb accepted upstream: ${probe.verb ?? 'unknown (no X-Poll-Method header)'}`);
for (const r of report.results.filter((x) => x.status === 'fail')) console.log(`  FAIL ${r.id}: ${r.error}`);
console.log(`Wrote ${outPath instanceof URL ? outPath.pathname : outPath}${dry ? ' (dry run: do not treat as live results)' : '. Run: npm run mcp:coverage'}`);
process.exit(report.results.some((r) => r.status === 'fail') ? 1 : 0);
