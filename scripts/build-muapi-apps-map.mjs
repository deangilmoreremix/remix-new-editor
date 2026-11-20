#!/usr/bin/env node
// Builds src/data/muapiStudioAppsMap.json: what each tool on muapi's Studio "Apps" tab
// actually calls. The catalog is read from muapi's public Studio JavaScript (the Apps
// tab is a lazy-loaded chunk holding one config object per app), then every endpoint
// is validated against muapi's public OpenAPI spec.
//
//   node scripts/build-muapi-apps-map.mjs [--cache <dir>] [--out <file>]
//
// Only structure is kept (endpoint, model, inputs, cost). muapi's prompt templates,
// presets and slider text are deliberately NOT copied: they are muapi's own content.
// Files are fetched with curl (honours the agent proxy); delete the cache dir to refresh.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const cache = arg('--cache', join(tmpdir(), 'muapi-cache'));
const out = arg('--out', join(root, 'src/data/muapiStudioAppsMap.json'));
const API = 'https://api.muapi.ai';
const SITE = 'https://muapi.ai';
mkdirSync(join(cache, 'chunks'), { recursive: true });

const fetchCached = (url, file) => {
  const dest = join(cache, file);
  if (!existsSync(dest)) execFileSync('curl', ['-fsSL', '-o', dest, url]);
  return readFileSync(dest, 'utf8');
};
const errors = new Set();

// --- muapi public API data -----------------------------------------------------------------
const spec = JSON.parse(fetchCached(`${API}/openapi.json`, 'openapi.json'));
const models = new Map(JSON.parse(fetchCached(`${API}/api/v1/models`, 'models.json')).models.map((m) => [m.name, m]));
const workflows = new Map(JSON.parse(fetchCached(`${API}/api/v1/get-template-workflows`, 'template-workflows.json')).map((w) => [w.slug, w]));

// --- Studio catalog from the site's JavaScript ---------------------------------------------
function loadStudioCatalog() {
  const html = fetchCached(`${SITE}/studio?tab=apps`, 'studio.html');
  const chunkUrls = [...new Set(html.match(/\/_next\/static\/chunks\/[^"']+\.js/g) ?? [])];
  const runtimeUrl = chunkUrls.find((u) => /\/webpack-/.test(u));
  if (!runtimeUrl) throw new Error('webpack runtime chunk not found on /studio');
  const runtime = fetchCached(SITE + runtimeUrl, 'chunks/runtime.js');
  const direct = Object.fromEntries([...runtime.matchAll(/(\d+)===e\?"(static\/chunks\/[^"]+\.js)"/g)].map((m) => [m[1], m[2]]));
  const hashed = Object.fromEntries([...runtime.matchAll(/(\d+):"([a-f0-9]{16})"/g)].map((m) => [m[1], m[2]]));
  const chunkPath = (id) => direct[id] ?? (hashed[id] ? `static/chunks/${id}.${hashed[id]}.js` : null);

  // The Studio shell lazy-loads the Apps tab ("Loading Studio apps…"); find its chunk ids.
  let ids = null;
  for (const u of chunkUrls) {
    const src = fetchCached(SITE + u, `chunks/${u.split('/').pop()}`);
    const at = src.indexOf('Loading Studio apps');
    if (at < 0) continue;
    const before = src.slice(Math.max(0, at - 600), at);
    const all = [...before.matchAll(/Promise\.all\(\[([^\]]+)\]\)/g)].pop();
    ids = all ? [...all[1].matchAll(/\.e\((\d+)\)/g)].map((m) => m[1]) : null;
    if (ids) break;
  }
  if (!ids) throw new Error('could not locate the Studio apps chunk ids');

  for (const id of ids) {
    const p = chunkPath(id);
    if (!p) continue;
    const src = fetchCached(`${SITE}/_next/${p}`, `chunks/${id}.js`);
    const start = src.indexOf("JSON.parse('");
    if (start < 0 || !src.includes('"slug":"')) continue;
    let i = start + 12, j;
    for (;;) { j = src.indexOf("')", i); if (src[j - 1] !== '\\') break; i = j + 1; }
    // The literal is a JS string with JS escapes (\xd7, \uD83C...), so evaluate it as JS.
    const text = vm.runInNewContext(src.slice(start + 11, j + 1));
    return JSON.parse(text);
  }
  throw new Error('Studio apps catalog literal not found in chunks ' + ids.join(','));
}
const catalog = loadStudioCatalog();

// --- Hand-picked related template workflows (secondary info only) ---------------------------
const SIMILAR_WORKFLOW = {
  angles: 'multi-angle-photo-reshoot-nano-banana-2',
  'giant-product': 'giant-product-vfx-ad-nano-banana-2',
  'headshot-generator': 'professional-fashion-headshots-flux-2-pro',
  '3d-figure': 'ai-action-figure-generator-nano-banana-2',
  'outfit-shot': 'fashion-video-generator-qwen-image-seedance-v1-5',
  'click-to-ad': 'ugc-ads-workflow-seedance-2-omni',
  packshot: 'product-360-video-flux-2-flex-wan2-5',
  'bullet-time-white': 'product-360-video-flux-2-flex-wan2-5',
  poster: 'product-advertisement-wan2-6-image-edit',
};

// Endpoints that are dedicated tools (the app is a thin wrapper); all others are generic
// models driven by a muapi-written prompt template.
const DEDICATED = new Set(['ai-skin-enhancer', 'ai-image-face-swap', 'ai-video-face-swap', 'video-background-remover']);

const apps = [];
for (const [categoryKey, list] of Object.entries(catalog)) {
  for (const a of list) {
    const model = a.endpoint.replace(/^\//, '');
    const path = `/api/v1/${model}`;
    if (!spec.paths[path]) errors.add(`endpoint not in openapi: ${path} (${a.slug})`);
    const m = models.get(model);
    const entry = {
      id: a.slug,
      name: a.name,
      studioTab: a.categoryName,
      studioCategoryKey: categoryKey,
      mediaType: a.defaultOutputMode,
      description: a.desc,
      status: DEDICATED.has(model) ? 'endpoint' : 'preset',
      endpoint: { method: 'POST', path, model, targetModel: a.targetModel, requiredFields: m?.required_fields ?? null },
      studio: {
        defaultCostUsd: a.defaultCost,
        imageField: a.imageField,
        requiresPrompt: a.requiresPrompt,
        mediaInputs: (a.mediaInputs ?? []).map(({ key, label, type, required }) => ({ key, label, type, required })),
        defaultParams: a.defaultParams,
        hasPromptTemplate: Boolean(a.promptTemplate),
      },
    };
    if (entry.status === 'preset') {
      entry.notes = "Studio app = muapi's prompt template over a generic model. The prompt text is not copied here; write your own for this endpoint.";
    }
    const wfSlug = SIMILAR_WORKFLOW[a.slug];
    if (wfSlug) {
      const w = workflows.get(wfSlug);
      if (!w) errors.add(`workflow not in template list: ${wfSlug}`);
      else entry.similarWorkflow = { slug: w.slug, id: w.id, run: `POST /workflow/${w.id}/api-execute` };
    }
    apps.push(entry);
  }
}

if (errors.size) { console.error('VALIDATION FAILED:\n- ' + [...errors].join('\n- ')); process.exit(1); }

const byStatus = apps.reduce((a, x) => ((a[x.status] = (a[x.status] || 0) + 1), a), {});
const byEndpoint = apps.reduce((a, x) => ((a[x.endpoint.path] = (a[x.endpoint.path] || 0) + 1), a), {});
const result = {
  meta: {
    description: "What each tool on muapi's Studio 'Apps' tab calls, read from the Studio's public JavaScript and validated against the OpenAPI spec.",
    source: `${SITE}/studio?tab=apps (lazy-loaded Apps chunk); spec: ${API}/openapi.json`,
    apiBase: API,
    auth: 'x-api-key header',
    generatedBy: 'scripts/build-muapi-apps-map.mjs',
    statuses: {
      endpoint: 'A dedicated muapi tool endpoint; call it directly.',
      preset: "A generic muapi model driven by a muapi-written prompt template (not copied here). The endpoint is public and callable; you supply the prompt.",
    },
    checked: [
      'Studio page and its lazy-loaded Apps chunk (the full 78-app catalog)',
      'Public OpenAPI spec, /api/v1/models, /api/v1/get-template-workflows',
      'Docs pages incl. introduction, specialized-apps, white-label, embedding, cli, mcp, workflows, agents, design-agent-api',
    ],
    notChecked: ['The logged-in dashboard pages', 'Live network calls from a signed-in Studio session (cost, extra inputs)'],
    caveats: [
      "Prompt templates, presets and sliders are muapi's content; they were read for analysis but not stored. Check muapi's terms before reusing them.",
      'Some presets/sliders add inputs beyond mediaInputs; verify by running an app.',
      'similarWorkflow is a name-based guess, not the app itself.',
    ],
    counts: { total: apps.length, ...byStatus },
    endpoints: byEndpoint,
  },
  apps,
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log(`wrote ${out}\n`, result.meta.counts, result.meta.endpoints);
