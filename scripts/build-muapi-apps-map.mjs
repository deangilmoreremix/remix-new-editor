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

// Factual test notes (kept separate from status so they never silently change it).
const NOTES = {
  'skin-enhancer':
    'API test 2026-11-20: two calls to POST /api/v1/ai-skin-enhancer with {image_url} (the exact payload the Studio sends; WebP and PNG inputs) were accepted but the result failed with \'Application "retoucher" not found\' (request ids 296c7a99-26ab-47a5-a117-8af01665b84f, a7138132-4298-4462-9369-84d26c5686f8). No credits were charged. Re-test before relying on it.',
};

// Endpoints that are dedicated tools (the app is a thin wrapper); all others are generic
// models driven by a muapi-written prompt template.
const DEDICATED = new Set(['ai-skin-enhancer', 'ai-image-face-swap', 'ai-video-face-swap', 'video-background-remover']);

// Where an app (or something equivalent) already lives in our studios. Hand-curated from a name,
// id and endpoint search of remix-new-editor and OpenHiggsBolt (2026-11-23).
//   match: 'same-endpoint' (identical muapi endpoint) | 'same-function' (same job, other model) | 'similar' (related, not the same)
// Files are validated: remix-new-editor paths must exist here and contain `item`; OpenHiggsBolt
// paths are checked only when that repo sits next to this one.
const R = 'remix-new-editor', H = 'OpenHiggsBolt';
const EDIT = 'src/components/EditStudio.js', TPL = 'src/lib/templates.js', HEDIT = 'packages/studio/src/editTools.js', LAYERS = 'packages/studio/src/components/LayersStudio.jsx';
const e = (repo, file, item, match, note) => ({ repo, file, item, match, ...(note ? { note } : {}) });
const EXISTING = {
  'skin-enhancer': [e(R, EDIT, 'Enhance Skin', 'same-endpoint')],
  'face-swap': [e(R, EDIT, 'Face Swap', 'same-endpoint'), e(R, TPL, 'face-swap', 'same-endpoint'), e(H, HEDIT, 'Face Swap', 'same-endpoint')],
  'video-face-swap': [e(H, HEDIT, 'Face Swap', 'same-endpoint', 'OpenHiggsBolt Face Swap includes the video model; remix-new-editor only references it in personalize/modelCapabilityResolver.js')],
  'expand-image': [e(R, EDIT, 'Extend Image', 'same-endpoint')],
  'outfit-swap': [e(R, EDIT, 'Change Dress', 'similar', 'uses ai-dress-change, not the same preset')],
  angles: [e(H, LAYERS, 'angles', 'same-function'), e(R, EDIT, 'Change Angle', 'similar')],
  relight: [e(H, LAYERS, 'relight', 'same-function'), e(R, 'src/lib/personalization/imageEditRegistry.js', 'relight', 'same-function')],
  'color-grading': [e(H, LAYERS, 'Color Grading', 'same-function')],
  recast: [e(R, 'src/components/VideoToolsStudio.js', 'recast', 'same-function', 'Video Tools "Recast" tab'), e(H, 'packages/studio/src/components/RecastStudio.jsx', 'recast', 'same-function', 'shown as "Body Swap"')],
  'video-bg-remover': [e(R, 'src/lib/models.js', 'video-background-remover', 'similar', 'model is in the catalog; no dedicated screen found')],
  'bullet-time-scene': [e(R, TPL, 'bullet-time', 'same-function', 'template "Bullet Time Scene"'), e(R, TPL, 'matrix-shot', 'similar')],
  'bullet-time-white': [e(R, TPL, 'bullet-time', 'similar')],
  'bullet-time-splash': [e(R, TPL, 'bullet-time', 'similar')],
  'billboard-ad': [e(R, TPL, 'billboard-ad', 'similar', 'existing one is a design template, muapi\'s is a video')],
  'pixel-game': [e(R, TPL, 'pixel-art', 'similar')],
  'brick-cube': [e(R, TPL, 'lego-style', 'similar')],
  '3d-figure': [e(R, TPL, '3d-figurine', 'similar'), e(R, TPL, 'action-figure', 'similar')],
  'asmr-classic': [e(R, TPL, 'asmr-video', 'similar')],
  'asmr-add-on': [e(R, TPL, 'asmr-video', 'similar')],
  'asmr-host': [e(R, TPL, 'asmr-video', 'similar')],
  'comic-book': [e(R, TPL, 'comic-book', 'similar')],
  'nano-theft': [e(R, TPL, 'gta-loading-screen', 'similar')],
  'game-dump': [e(R, TPL, 'gta-loading-screen', 'similar')],
  poster: [e(R, TPL, 'movie-poster', 'similar', 'movie poster, not a product marketing poster')],
  'yes-kiss': [e(R, 'src/components/EffectsStudio.js', 'kiss cam', 'similar')],
  shots: [e(R, 'src/lib/cinematicTemplates.js', 'Shots', 'similar', 'Cinema Template Studio')],
  transitions: [e(R, 'src/lib/cinematicTemplates.js', 'Transitions', 'similar', 'Cinema Template Studio and the timeline editor')],
};
const overlapOf = (list) => (!list?.length ? 'new' : list.some((x) => x.match !== 'similar') ? 'duplicate' : 'similar');
{
  const sibling = resolve(root, '..', H);
  const exists = (x) => (x.repo === R ? resolve(root, x.file) : existsSync(sibling) ? resolve(sibling, x.file) : null);
  for (const [slug, list] of Object.entries(EXISTING)) {
    for (const x of list) {
      const p = exists(x);
      if (!p) continue; // other repo not checked out here
      if (!existsSync(p)) { errors.add(`existingIn file missing: ${x.repo}/${x.file} (${slug})`); continue; }
      if (!readFileSync(p, 'utf8').toLowerCase().includes(x.item.toLowerCase())) errors.add(`existingIn item not found: "${x.item}" in ${x.repo}/${x.file} (${slug})`);
    }
  }
}

const apps = [];
for (const [categoryKey, list] of Object.entries(catalog)) {
  for (const a of list) {
    const model = a.endpoint.replace(/^\//, '');
    const path = `/api/v1/${model}`;
    if (!spec.paths[path]) errors.add(`endpoint not in openapi: ${path} (${a.slug})`);
    const m = models.get(model) ?? models.get(a.targetModel);
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
        // Request fields the Studio sends besides prompt/media (values come from these controls).
        parameters: (a.parameters ?? []).map((p) => ({
          key: p.key, label: p.label, type: p.type, default: p.default,
          options: p.options?.map((o) => o.value),
        })),
        // Sliders append " <label>: <value><unit>." to the prompt when moved off default.
        sliders: (a.sliders ?? []).map(({ key, label, min, max, step, default: def, unit }) => ({ key, label, min, max, step, default: def, unit })),
        // Presets swap in a different prompt and/or preset values; only the labels are kept.
        presets: (a.presets ?? []).map((p) => ({ label: p.label, values: p.values })),
      },
    };
    if (entry.status === 'preset') {
      entry.notes = "Studio app = muapi's prompt template over a generic model. The prompt text is not copied here; write your own for this endpoint.";
    }
    if (NOTES[a.slug]) entry.notes = NOTES[a.slug];
    // Is it already in another studio? duplicate = same endpoint/function, similar = related, new = not found.
    entry.overlap = overlapOf(EXISTING[a.slug]);
    // Cover image (muapi's artwork, used with permission; see public/thumbnails/muapi-apps/NOTICE.md).
    // Fetch with scripts/fetch-muapi-app-thumbnails.mjs.
    const thumbFile = join(root, 'public/thumbnails/muapi-apps', `${a.slug}.webp`);
    if (existsSync(thumbFile)) entry.thumbnail = `/thumbnails/muapi-apps/${a.slug}.webp`;
    if (EXISTING[a.slug]) entry.existingIn = EXISTING[a.slug];
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
    howItWorks: {
      source: "Read from the Studio's JavaScript (Apps runner chunk) and confirmed by opening all 78 app screens in a browser.",
      steps: [
        '1. The user uploads the media in mediaInputs (image/video/audio); the Studio uploads it and keeps the returned URL.',
        '2. prompt = promptTemplate (or the chosen preset\'s prompt) + for each slider moved off its default: " <label>: <value><unit>." + the user\'s optional custom prompt. Apps with requiresPrompt=false send no prompt.',
        '3. payload = { prompt, ...each entry of parameters (aspect_ratio, resolution, duration, ...), mediaInputs }. A media input named images_list is sent as an array [url]; any other key is sent as a string URL.',
        '4. POST https://api.muapi.ai/api/v1<endpoint>  (the site proxies it as /api/api/v1<endpoint>; optional ?team_id=). Response carries request_id.',
        '5. Poll GET /api/v1/predictions/{request_id}/result until it completes.',
        '6. Cost shown on the button comes from POST /api/app/calculate_dynamic_cost {task_name: targetModel, payload}, falling back to defaultCostUsd.',
        'Generate requires sign-in; signed-out users are redirected to /login.',
      ],
    },
    checked: [
      'Studio page and its lazy-loaded Apps chunk (the full 78-app catalog)',
      'Public OpenAPI spec, /api/v1/models, /api/v1/get-template-workflows',
      'All 78 app screens opened in a headless browser (signed out); controls matched the catalog',
      'Docs pages incl. introduction, specialized-apps, white-label, embedding, cli, mcp, workflows, agents, design-agent-api',
    ],
    notChecked: ['The logged-in dashboard pages', 'A real signed-in generation (requires login and spends credits); the request shape comes from the Studio code, not from a captured call'],
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

// Human-readable overlap table (docs/muapi-apps-overlap.md), generated from the same data.
{
  const count = (k) => apps.filter((a) => a.overlap === k).length;
  const label = { new: 'NEW', duplicate: 'DUPLICATE', similar: 'SIMILAR' };
  const where = (a) => (a.existingIn?.length
    ? a.existingIn.map((x) => `**${x.repo}** — ${x.item} (\`${x.file}\`)${x.note ? ` — ${x.note}` : ''}`).join('<br>')
    : '—');
  const lines = [
    '# muapi Studio apps vs our existing studios',
    '',
    'Generated by `scripts/build-muapi-apps-map.mjs` — do not edit by hand.',
    '',
    `- **DUPLICATE** (${count('duplicate')}): the same endpoint or the same job already exists in one of our studios.`,
    `- **SIMILAR** (${count('similar')}): something related exists, but it is not the same tool.`,
    `- **NEW** (${count('new')}): nothing equivalent found in remix-new-editor or OpenHiggsBolt.`,
    '',
    'Found by a name, id and endpoint search of both repos (2026-11-23). A "not found" is not proof of absence: an effect can exist under a different name, or as a prompt inside a larger tool.',
  ];
  for (const tab of [...new Set(apps.map((a) => a.studioTab))]) {
    lines.push('', `## ${tab}`, '', '| App | Status | Already in |', '|---|---|---|');
    for (const a of apps.filter((x) => x.studioTab === tab)) lines.push(`| ${a.name} | ${label[a.overlap]} | ${where(a)} |`);
  }
  const docPath = join(root, 'docs/muapi-apps-overlap.md');
  mkdirSync(dirname(docPath), { recursive: true });
  writeFileSync(docPath, lines.join('\n') + '\n');
}
console.log(`wrote ${out}\n`, result.meta.counts, result.meta.endpoints);
