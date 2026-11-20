#!/usr/bin/env node
// Builds src/data/muapiStudioAppsMap.json: for each tool on muapi's Studio "Apps"
// tab, the closest public muapi API endpoint / template workflow, or a suggested
// way to rebuild it. Validates every reference against muapi's live public spec.
//
//   node scripts/build-muapi-apps-map.mjs [--cache <dir>] [--out <file>]
//
// Spec files are downloaded with curl (honours the agent proxy and any API key it
// injects) into the cache dir; delete the dir to refresh. No keys are written.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const cache = arg('--cache', join(tmpdir(), 'muapi-cache'));
const out = arg('--out', join(root, 'src/data/muapiStudioAppsMap.json'));
const BASE = 'https://api.muapi.ai';

const SOURCES = {
  'openapi.json': '/openapi.json',
  'models.json': '/api/v1/models',
  'template-workflows.json': '/api/v1/get-template-workflows',
};
mkdirSync(cache, { recursive: true });
for (const [file, path] of Object.entries(SOURCES)) {
  const dest = join(cache, file);
  if (!existsSync(dest)) execFileSync('curl', ['-fsS', '-o', dest, BASE + path]);
}
const load = (f) => JSON.parse(readFileSync(join(cache, f), 'utf8'));
const spec = load('openapi.json');
const models = new Map(load('models.json').models.map((m) => [m.name, m]));
const workflows = new Map(load('template-workflows.json').map((w) => [w.slug, w]));

// --- App catalog (transcribed from screenshots of muapi.ai/studio?tab=apps) ---------------
// [name, mediaType, description]
const TABS = {
  'Professional': [
    ['Angles', 'image', 'Generate new camera angles from a single photo'],
    ["What's Next", 'image', 'Explore what happens next in your scene'],
    ['Shots', 'image', 'Transform one photo into unique cinematic shots'],
    ['Zooms', 'image', 'Create dynamic zoom variations'],
    ['Behind the Scenes', 'video', 'Turn any photo into a behind-the-scenes film set reveal'],
    ['Transitions', 'video', 'Create seamless transitions between two images'],
    ['Expand Image', 'image', 'Expand any image beyond its edges'],
    ['Color Grading', 'image', 'Apply professional cinematic color grading'],
  ],
  'Enhance & Style': [
    ['AI Stylist', 'image', 'AI fitting room: try on outfits, change poses'],
    ['Relight', 'image', 'Adjust lighting position, color temperature and brightness'],
    ['Skin Enhancer', 'image', 'Smooth skin and remove blur from portraits'],
    ['Outfit Swap', 'image', 'Try on any outfit with a single photo'],
    ['Style Snap', 'image', 'Transform your look with instant style variations'],
    ['Outfit Vending', 'image', 'Outfit breakdown in an illuminated vending machine'],
    ['Glitter Sticker', 'image', 'Portrait as a sparkling holographic sticker'],
    ['Outfit Shot', 'video', 'Transform outfits into a professional AI avatar photoshoot'],
  ],
  'Face & Identity': [
    ['Recast', 'video', 'Character swap for any video'],
    ['Character Swap', 'image', 'Place a new character into any scene'],
    ['Face Swap', 'image', 'Instant AI face swap for photos'],
    ['Commercial Faces', 'image', 'Ad-ready spokesperson imagery'],
    ['Video Face Swap', 'video', 'Face swapping for any video, frame by frame'],
    ['Headshot Generator', 'image', 'Studio-quality professional headshots'],
  ],
  'Video Editing': [
    ['ClipCut', 'video', 'Turn one selfie into an instant outfit reel'],
    ['Urban Cuts', 'video', 'Beat-synced AI outfit videos'],
    ['Sticker Match Cut', 'video', 'Turn any clip into a sparkling sticker animation'],
    ['Breakdown', 'video', 'Split any image into its individual components'],
    ['Japanese Show', 'video', 'Photo into a retro 2000s Japanese variety show scene'],
    ['Video Background Remover', 'video', 'Strip the background from any video'],
  ],
  'Ads & Products': [
    ['Click to Ad', 'video', 'Character interacts with your product in a video ad'],
    ['ASMR Add-On', 'video', 'Character whispers about your product in an ASMR video'],
    ['ASMR Classic', 'video', 'Classic ASMR product video'],
    ['Poster', 'image', 'Professional marketing poster for your product'],
    ['Bullet Time Scene', 'video', 'Freeze-frame bullet-time with character and product'],
    ['Chameleon', 'video', "Character transforms to match your product's brand"],
    ['ASMR Host', 'video', 'Hosted ASMR product presentation'],
    ['Packshot', 'video', 'Product showcase with smooth rotation and studio lighting'],
    ['Macro Scene', 'video', 'Extreme close-up revealing product details'],
    ['Magic Button', 'video', 'Product appears magically with a burst of light'],
    ['Truck Ad', 'video', 'Your product on a moving truck through the city'],
    ['Giant Product', 'video', 'Surreal scene with a building-sized product'],
    ['Bullet Time White', 'video', 'Bullet-time 360 rotation on a white background'],
    ['Kick Ad', 'video', 'Character kicks product into frame'],
    ['Billboard Ad', 'video', 'Your product on a glowing billboard at night'],
    ['Graffiti Ad', 'image', 'Your product as street-art graffiti'],
    ['Bullet Time Splash', 'video', 'Bullet-time rotation with liquid splash effects'],
    ['Fridge Ad', 'video', 'Product revealed inside an opening fridge'],
    ['Volcano Ad', 'video', 'Product emerging from a volcanic eruption'],
    ['Macroshot Product', 'image', 'Professional macro photography with shallow depth of field'],
  ],
  'Games & Characters': [
    ['Game Dump', 'image', 'Transform yourself into iconic video game styles'],
    ['Nano Strike', 'image', 'AI tactical shooter character'],
    ['Nano Theft', 'image', 'Realistic open-world crime game style'],
    ['Simlife', 'image', 'Stylized life-simulation character'],
    ['Plushies', 'image', 'Photo into an adorable plushie-style character'],
    ['3D Render', 'image', 'Photo into a 3D rendered object'],
    ['3D Figure', 'image', 'Photo into a detailed 3D collectible figure'],
    ['Pixel Game', 'image', 'Photo into retro 8-bit / 16-bit pixel game graphics'],
    ['Brick Cube', 'image', 'Photo into a brick-cube toy'],
    ['Sketch to Real', 'video', 'Sketch into a realistic video scene'],
  ],
  'Trending Templates': [
    'Yes Kiss', 'Latex', 'J-Magazine', 'Roller Coaster', '60s Cafe', 'Victory Card', 'Sand Worm',
    'Skibidi', 'J-Poster', 'Mascot', 'Storm Creature', 'Burning Sunset', 'On Fire', 'Comic Book',
    'Cloud Surf', 'Mukbang', 'Melting Doodle', 'Giallo Horror', 'Renaissance', 'Rap God',
  ].map((n) => [n, 'video', 'Viral trend: turn your photo into this video']),
};

// --- Hand-chosen matches (verified against the spec below) -------------------------------
// status: endpoint | endpoint-probable | workflow-similar. Everything else is "unmatched".
const MATCH = {
  'Video Face Swap': { status: 'endpoint', model: 'ai-video-face-swap' },
  'Face Swap': { status: 'endpoint', model: 'ai-image-face-swap' },
  'Skin Enhancer': { status: 'endpoint', model: 'ai-skin-enhancer' },
  'Video Background Remover': { status: 'endpoint', model: 'video-background-remover' },
  'AI Stylist': { status: 'endpoint-probable', model: 'portrait-stylist', notes: 'Requires a `name` style value; see the spec.' },
  'Transitions': { status: 'endpoint-probable', model: 'pixverse-v6-transition' },
  'Expand Image': { status: 'endpoint-probable', model: 'ai-image-extension' },
  'Outfit Swap': { status: 'endpoint-probable', model: 'ai-dress-change', workflow: 'virtual-try-on-seedream-flux-kling-o1' },
  'Pixel Game': { status: 'endpoint-probable', model: 'nano-banana-effects', effectName: '16bit Game Character' },
  'Angles': { status: 'workflow-similar', workflow: 'multi-angle-photo-reshoot-nano-banana-2' },
  'Giant Product': { status: 'workflow-similar', workflow: 'giant-product-vfx-ad-nano-banana-2' },
  'Headshot Generator': { status: 'workflow-similar', workflow: 'professional-fashion-headshots-flux-2-pro' },
  '3D Figure': { status: 'workflow-similar', workflow: 'ai-action-figure-generator-nano-banana-2', effectName: '3D Figurine', effectModel: 'nano-banana-effects' },
  'Outfit Shot': { status: 'workflow-similar', workflow: 'fashion-video-generator-qwen-image-seedance-v1-5' },
  'Click to Ad': { status: 'workflow-similar', workflow: 'ugc-ads-workflow-seedance-2-omni' },
  'Packshot': { status: 'workflow-similar', workflow: 'product-360-video-flux-2-flex-wan2-5' },
  'Bullet Time White': { status: 'workflow-similar', workflow: 'product-360-video-flux-2-flex-wan2-5', notes: 'Only the 360 rotation is similar; not bullet-time.' },
  'Poster': { status: 'workflow-similar', workflow: 'product-advertisement-wan2-6-image-edit' },
};
// Rebuild routes for unmatched apps (generic models that take a prompt + image).
const REBUILD = { image: 'flux-kontext-effects', video: 'ai-video-effects' };

const slug = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const errors = new Set();
// The model list can disagree with the spec (e.g. ai-video-effects is served at
// /api/v1/generate_wan_ai_effects), so the spec is the source of truth: use the model's
// endpoint if it is a spec path, else the POST path whose summary names the model.
const pathOf = (model) => {
  const m = models.get(model);
  if (!m) { errors.add(`unknown model: ${model}`); return null; }
  let p = spec.paths[m.endpoint] ? m.endpoint : null;
  p ??= Object.keys(spec.paths).find((k) => spec.paths[k].post?.summary?.split(' ')[0] === model) ?? null;
  if (!p) { errors.add(`endpoint not in openapi: ${m.endpoint} (${model})`); return null; }
  return { ...m, endpoint: p };
};
const enumOf = (schemaName) => {
  const p = spec.components.schemas[schemaName]?.properties?.name;
  const ref = p?.$ref || p?.anyOf?.find((x) => x.$ref)?.$ref;
  return p?.enum || (ref && spec.components.schemas[ref.split('/').pop()]?.enum) || [];
};
const EFFECT_ENUM = { 'nano-banana-effects': enumOf('NanoBananaEffectsRequest') };

const wf = (s) => {
  const w = workflows.get(s);
  if (!w) { errors.add(`workflow not in template list: ${s}`); return null; }
  return { slug: w.slug, id: w.id, name: w.name, run: `POST /workflow/${w.id}/api-execute` };
};

const apps = [];
for (const [tab, list] of Object.entries(TABS)) {
  for (const [name, mediaType, description] of list) {
    const m = MATCH[name];
    const entry = { id: slug(name), name, studioTab: tab, mediaType, description, status: m?.status ?? 'unmatched' };
    if (m?.model) {
      const mm = pathOf(m.model);
      if (mm) entry.endpoint = { method: 'POST', path: mm.endpoint, model: mm.name, requiredFields: mm.required_fields };
    }
    if (m?.effectName) {
      const model = m.effectModel || m.model;
      if (!EFFECT_ENUM[model]?.includes(m.effectName)) errors.add(`effect name not in spec: ${model} / ${m.effectName}`);
      entry.effect = { model, name: m.effectName };
    }
    if (m?.workflow) entry.workflow = wf(m.workflow);
    if (m?.notes) entry.notes = m.notes;
    if (entry.status === 'unmatched') {
      const mm = pathOf(REBUILD[mediaType]);
      entry.rebuildAs = { model: mm?.name, path: mm?.endpoint, requiredFields: mm?.required_fields, prompt: '' };
      entry.notes = 'No public endpoint or workflow found. Rebuild as a prompt template on the generic route; prompt is left empty on purpose.';
    }
    apps.push(entry);
  }
}

if (errors.size) { console.error('VALIDATION FAILED:\n- ' + [...errors].join('\n- ')); process.exit(1); }

const counts = apps.reduce((a, x) => ((a[x.status] = (a[x.status] || 0) + 1), a), {});
const result = {
  meta: {
    description: "Maps muapi Studio 'Apps' tab tools to the closest public muapi API endpoint or template workflow.",
    source: 'https://muapi.ai/studio?tab=apps (transcribed from screenshots); spec: https://api.muapi.ai/openapi.json',
    apiBase: BASE,
    auth: 'x-api-key header',
    generatedBy: 'scripts/build-muapi-apps-map.mjs',
    caveats: [
      'The Studio apps themselves are closed source and are not published as named API endpoints.',
      'The app list is partial: it was transcribed from screenshots, and some cards (e.g. part of Ads & Products) were not visible.',
      'endpoint-probable and workflow-similar are name/purpose based guesses, not confirmed identical behaviour.',
    ],
    counts: { total: apps.length, ...counts },
  },
  apps,
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log(`wrote ${out}\n`, result.meta.counts);
