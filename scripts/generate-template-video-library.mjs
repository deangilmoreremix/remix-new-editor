// Generates src/data/templateVideoLibrary.js — the clip library behind the timeline editor's
// "Template videos" modal. Read-only on every existing demo data file.
//
//   node scripts/generate-template-video-library.mjs
//
// scripts/template-video-allowlist.json lists the {set, slug} pairs that were reviewed and found to
// carry no logo / watermark / caption overlay. Remote clips (https://media.beatapi.io/...) are rewritten
// to the same-origin /cdn/beatapi/... path only in --local mode (the CDN sends no CORS headers and the editor loads media with
// crossOrigin="anonymous"); by default everything is hosted in the demo-template-videos bucket (public, CORS *).
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SETS = {
  mmx25: { file: 'src/data/beatapiMinimaxH3Demos.js', label: 'MiniMax H3' },
  sd25: { file: 'src/data/beatapiSeedance25Demos.js', label: 'Seedance 2.5' },
  zerolu: { file: 'src/data/zeroLuDemos.js', label: 'Seedance 2.0' },
  mmxLegacy: { file: 'src/data/minimaxH3Demos.js', label: 'MiniMax H3' },
  sdLegacy: { file: 'src/data/seedanceDemos.js', label: 'Seedance' },
};
// Hosting: clips and posters are served from the Supabase Storage bucket `demo-template-videos` (a public bucket dedicated to this
// library inside a project shared by many apps; layout clips/<set>/<slug>.<ext>, posters/<set>/<slug>.<ext>, see
// scripts/upload-template-videos.mjs). Override with --base-url=<url> / TEMPLATE_VIDEO_BASE_URL, or pass --local to point at the repo's
// /media files and the same-origin /cdn/beatapi proxy instead (development fallback).
const DEFAULT_BASE_URL = 'https://bzxohkrxcwodllketcpz.supabase.co/storage/v1/object/public/demo-template-videos';
const baseUrl = process.argv.includes('--local') ? '' : (process.argv.find((a) => a.startsWith('--base-url='))?.slice(11) ?? process.env.TEMPLATE_VIDEO_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
const extOf = (u) => (u.match(/\.[a-z0-9]+$/i) || [''])[0];
const CDN = 'https://media.beatapi.io/';
const PROXY = '/cdn/beatapi/';
const same = (u) => (typeof u === 'string' && u.startsWith(CDN) ? PROXY + u.slice(CDN.length) : u);

const allow = JSON.parse(readFileSync(resolve(root, 'scripts/template-video-allowlist.json'), 'utf8'));
const bySet = {};
for (const s of Object.keys(SETS)) {
  const m = await import(pathToFileURL(resolve(root, SETS[s].file)).href);
  const arr = Object.values(m).find((v) => Array.isArray(v) && v[0]?.slug);
  bySet[s] = new Map(arr.map((d) => [d.slug, d]));
}

// Real durations measured in a browser (the data files carry rounded nominal ones: 15 for a 15.18s clip, 15 for a 10.1s clip).
const measured = JSON.parse(readFileSync(resolve(root, 'scripts/template-video-measured-durations.json'), 'utf8'));
// The upstream ZeroLu poster files are 8-byte stubs; real posters for the clips we use live in public/media/template-videos/posters.
const posterOverride = (set, slug) => (set === 'zerolu' && existsSync(resolve(root, `public/media/template-videos/posters/${slug}.webp`)) ? `/media/template-videos/posters/${slug}.webp` : null);

// Per-clip logo / watermark verdicts (scripts/template-video-branding.json): none = reviewed, no visible logo, watermark or credit;
// logo = has a visible mark; exclude = not usable footage (placeholder graphics). Every clip in the library carries one of the first two.
const brandingFile = JSON.parse(readFileSync(resolve(root, 'scripts/template-video-branding.json'), 'utf8')).entries;

// Curated commercial-style names + subcategories (scripts/template-video-labels.json, keyed by clip id) exist for the first, hand-reviewed
// 184 clips. Every other clip gets an AUTO label (cleaned source title + keyword subcategory) and is flagged `autoLabeled` so it can be
// curated later by adding it to the labels file.
const labels = JSON.parse(readFileSync(resolve(root, 'scripts/template-video-labels.json'), 'utf8'));

const MAIN = ['Action', 'Animation', 'Cinema', 'Commercial', 'Fashion', 'Social', 'VFX'];
const CAT_FIX = { UGC: 'Social', Characters: 'Animation', Beauty: 'Commercial', Food: 'Commercial', 'Web / UI': 'VFX' };
const SUB_RULES = {
  Commercial: [[/perfume|fragrance|serum|lipstick|lip gloss|lip oil|skincare|cosmetic|makeup|beauty/, 'Beauty & Fragrance'], [/burger|food|sushi|coffee|drink|beverage|snack|recipe|chef|cook|pizza|cola|whisk|tea\b|cocktail/, 'Food & Beverage'], [/\bcar\b|truck|motorcycle|bike|automotive|supercar|ferrari|\brace|vehicle/, 'Automotive & Mobility'], [/phone|earbud|laptop|gadget|tech|\bapp\b|\bui\b|landing page|website|software|ecommerce|watch/, 'Tech & Gadgets'], [/handbag|jewel|luxury|diamond|couture|premium/, 'Luxury Goods'], [/product|reveal|showcase|unbox|bottle/, 'Product Reveals']],
  Action: [[/fight|martial|kung|sword|duel|brawl|boxing/, 'Fights & Martial Arts'], [/chase|race|\bcar\b|motorcycle|stunt|parkour|kickflip|skate|escape/, 'Chases & Stunts'], [/battle|war\b|explosion|disaster|soldier|combat|siege|army/, 'Battles & Disaster'], [/fpv|drone|aerial|flyover|wingsuit|flyby|flight|jet\b|sky/, 'Aerial & FPV']],
  Animation: [[/title|credits|sequence|opening/, 'Title Sequences'], [/3d|pixar|cgi|render/, '3D Animated'], [/cute|kids|children|cartoon|pet\b|puppy|kitten|baby/, 'Cute & Kids']],
  Cinema: [[/sci-?fi|space|alien|cyberpunk|robot|future|\bmars\b|astronaut|android/, 'Sci-Fi'], [/period|historical|ancient|medieval|viking|roman|wwii|1940|1890|samurai|egypt|western|noir/, 'Period & Historical'], [/fantasy|dragon|magic|surreal|dream|myth|spirit|wizard/, 'Fantasy & Surreal'], [/travel|documentary|village|market|nature|landscape|city|street|aerial|river/, 'Travel & Documentary'], [/comedy|funny|sitcom|sketch|office/, 'Comedy']],
  Social: [[/music|dance|\bmv\b|k-?pop|rap\b|hip-?hop|song|lip-?sync|concert|idol/, 'Music & Dance'], [/\bcat\b|\bdog\b|pet\b|funny|meme|comedy|prank/, 'Comedy & Pets'], [/fitness|sport|workout|gym|football|runner|training|yoga/, 'Fitness & Sports'], [/vlog|ugc|selfie|iphone|testimonial|day in|smartphone|handheld/, 'Vlogs & UGC']],
  Fashion: [[/runway|lookbook|catwalk/, 'Runway & Lookbook'], [/street/, 'Streetwear']],
  VFX: [[/title|text|typograph|kinetic/, 'Title Sequences'], [/loop|background|abstract|hero/, 'Loops & Hero Backgrounds']],
};
const SUB_DEFAULT = { Commercial: 'Brand Films', Action: 'Creatures & Heroes', Animation: 'Illustrated & Craft', Cinema: 'Drama & Thriller', Social: 'Lifestyle & Food', Fashion: 'Editorial', VFX: 'Effects & Motion Graphics' };
const MODEL_RE = /\b(mini\s?max|hailuo\w*|h3|seedance(?:\s?\d(?:\.\d)?)?|seedream|kling(?:\s?\d(?:\.\d)?)?|sora|veo\s?\d?|grok(?:\s?imagine)?(?:\s?[\d.]+)?|gpt[- ]?image\s?\d?|flux\s?\d?|wan\s?\d(?:\.\d)?|pixverse|dreamina|capcut|higgsfield|magnific|pollo|runway|luma|midjourney|created|made|generated|using|with|prompt|reference|study|duration|seconds?|video|ai|image|exact|opening|frame|uploaded)\b/gi;
const STOP = new Set(['the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'and', 'or', 'for', 'is', 'it', 'this', 'that', 'by', 'as', 'from', 'my', 'your', 'i', 'its']);
const ACRONYMS = /\b(ugc|mv|fpv|pov|dv|ui|ux|3d|2d|ai|vhs|ceo|fps|tv|k-pop|diy)\b/gi;
const titleCase = (s) => s.toLowerCase().replace(/\b[a-z]/g, (m) => m.toUpperCase()).replace(/\b(Of|In|On|At|To|And|Or|For|A|An|The|Vs)\b(?!$)/g, (m, w, o) => (o === 0 ? m : m.toLowerCase())).replace(/\bVs\b/g, 'vs').replace(ACRONYMS, (m) => (m.toLowerCase() === 'k-pop' ? 'K-Pop' : m.toUpperCase()));
function cleanTitle(raw) {
  let s = String(raw ?? '').replace(/https?:\/\/\S+|@\w+|#\w+|\[[^\]]*\]|\([^)]*\)|["“”'’`*_]/g, ' ').replace(MODEL_RE, ' ').replace(/[^\p{L}\p{N}\s&-]/gu, ' ').replace(/\b\d+\b/g, ' ').replace(/\s+/g, ' ').trim();
  const words = s.split(' ').filter(Boolean);
  const meaningful = words.filter((w) => !STOP.has(w.toLowerCase()) && /^[A-Za-z][A-Za-z&-]*$/.test(w));
  if (meaningful.length < 2 || words.length > 9 || /[^ -~]/.test(s)) return null;
  let out = words.slice(0, 6).join(' ');
  while (out.length > 36 && out.includes(' ')) out = out.slice(0, out.lastIndexOf(' '));
  return titleCase(out);
}
function autoLabel(set, slug, d) {
  const rawCat = CAT_FIX[d.category] ?? d.category;
  const category = MAIN.includes(rawCat) ? rawCat : 'Cinema';
  const hay = `${d.title} ${slug.replace(/-\d+$/, '').replace(/-/g, ' ')} ${(d.tags ?? []).join(' ')} ${d.useCase ?? ''}`.toLowerCase();
  const subcategory = (SUB_RULES[category] ?? []).find(([re]) => re.test(hay))?.[1] ?? SUB_DEFAULT[category];
  return { title: cleanTitle(d.title) ?? `${subcategory} Scene`, category, subcategory };
}

// Descriptive metadata for search and other apps. `tags` from the upstream data are generation labels (text-to-video, text-prompt...), so
// `topics` is derived from what the clip is: category, subcategory and the words of its title.
const GENERATION_TAG = /^(text|image|video|reference|multi|first|last|frame|to|prompt|t2v|i2v|r2v|camera|direction|typography|workflow|audio|lip|sync|native|multimodal)([- ].*)?$/i;
const TITLE_STOP = new Set([...STOP, 'vs', 'scene', 'clip']);
const words = (str) => String(str).toLowerCase().replace(/[^a-z0-9&\s-]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !TITLE_STOP.has(w));
const topicsFor = (category, subcategory, title, tags) => [...new Set([category.toLowerCase(), ...words(subcategory.replace(/&/g, ' ')), ...words(title), ...(tags ?? []).filter((t) => !GENERATION_TAG.test(t)).map((t) => t.toLowerCase())])];
const orientationOf = (ar) => { const [w, h] = String(ar).split(':').map(Number); const r = w > 0 && h > 0 ? w / h : 16 / 9; return Math.abs(r - 1) < 0.12 ? 'square' : r > 1 ? 'landscape' : 'portrait'; };

// Flat browse groups (one wrapping row of chips in the modal, like the Animations tab): granular, named by what the clip shows. Groups with
// fewer than MIN_GROUP clips fold into "More". `category` stays the broad type (Action, Cinema, ...) used by the Type filter.
const MIN_GROUP = 8;
const GROUP_OF = {
  'Commercial/Food & Beverage': 'Food & Drink', 'Social/Lifestyle & Food': 'Lifestyle & Food',
  'Commercial/Beauty & Fragrance': 'Beauty & Fragrance', 'Commercial/Automotive & Mobility': 'Cars & Vehicles',
  'Commercial/Product Reveals': 'Products & Brands', 'Commercial/Luxury Goods': 'Products & Brands', 'Commercial/Tech & Gadgets': 'Products & Brands', 'Commercial/Brand Films': 'Products & Brands',
  'Fashion/Editorial': 'Fashion & Editorial', 'Fashion/Streetwear': 'Fashion & Editorial', 'Fashion/Runway & Lookbook': 'Fashion & Editorial',
  'Action/Chases & Stunts': 'Chases & Stunts', 'Action/Fights & Martial Arts': 'Fights & Battles', 'Action/Battles & Disaster': 'Fights & Battles',
  'Action/Aerial & FPV': 'Aerial & FPV', 'Action/Creatures & Heroes': 'Creatures & Heroes',
  'Cinema/Drama & Thriller': 'Drama & Thriller', 'Cinema/Fantasy & Surreal': 'Fantasy & Surreal', 'Cinema/Sci-Fi': 'Sci-Fi',
  'Cinema/Period & Historical': 'Period & Historical', 'Cinema/Travel & Documentary': 'Travel & Documentary', 'Cinema/Comedy': 'Comedy & Pets', 'Social/Comedy & Pets': 'Comedy & Pets',
  'Social/Vlogs & UGC': 'Vlogs & UGC', 'Social/Music & Dance': 'Music & Dance', 'Social/Fitness & Sports': 'Fitness & Sports',
  'Animation/Illustrated & Craft': 'Illustrated & Anime', 'Animation/Cute & Kids': 'Cute & Kids', 'Animation/3D Animated': '3D Animated',
  'Animation/Title Sequences': 'Titles & Typography', 'VFX/Title Sequences': 'Titles & Typography',
  'VFX/Effects & Motion Graphics': 'Effects & Motion Graphics', 'VFX/Loops & Hero Backgrounds': 'Effects & Motion Graphics',
};
const groupOf = (category, subcategory) => GROUP_OF[`${category}/${subcategory}`] ?? 'More';

// Hosting: the 184 hand-reviewed clips (and every CDN clip) are in the bucket; clips already in this repo under /media keep their local path.
const isCdn = (u) => typeof u === 'string' && u.startsWith(CDN);
const usableLocalPoster = (p) => typeof p === 'string' && p.startsWith('/media/') && existsSync(resolve(root, 'public' + p)) && statSync(resolve(root, 'public' + p)).size > 500;

const allowIds = allow.map(({ set, slug }) => `${set}:${slug}`);
const order = [...allowIds, ...Object.keys(brandingFile).filter((id) => !allowIds.includes(id) && brandingFile[id].branding !== 'exclude').sort()];
const used = new Map();
const seenFiles = new Set();
const skippedDuplicates = [];
const rows = [];
const sources = {};
const credits = {};
const missing = [];
for (const id of order) {
  const [set, ...rest] = id.split(':');
  const slug = rest.join(':');
  const d = bySet[set]?.get(slug);
  const b = brandingFile[id];
  if (!d || !d.videoSrc || !b) { missing.push(id); continue; }
  // The same file can be listed by two source sets (a few MiniMax slugs exist in both); keep the first.
  if (seenFiles.has(d.videoSrc)) { skippedDuplicates.push(id); continue; }
  seenFiles.add(d.videoSrc);
  const curated = labels[id];
  const label = curated ?? autoLabel(set, slug, d);
  // unique titles: "Name", then "Name 2", "Name 3"
  const n = (used.get(label.title) ?? 0) + 1;
  used.set(label.title, n);
  let base = label.title;
  const suffix = n > 1 ? ` ${n}` : '';
  while (base.length + suffix.length > 36 && base.includes(' ')) base = base.slice(0, base.lastIndexOf(' '));
  const title = base + suffix;
  const hosted = allowIds.includes(id) || isCdn(d.videoSrc);
  const poster = posterOverride(set, slug) ?? (hosted ? same(d.posterSrc) : (usableLocalPoster(d.posterSrc) ? d.posterSrc : null)) ?? null;
  rows.push({
    id,
    slug,
    title,
    sourceTitle: d.title,
    category: label.category,
    subcategory: label.subcategory,
    duration: measured[id] ?? d.duration ?? null,
    aspectRatio: d.aspectRatio ?? '16:9',
    videoSrc: hosted ? (baseUrl ? `${baseUrl}/clips/${set}/${slug}${extOf(d.videoSrc)}` : same(d.videoSrc)) : d.videoSrc,
    posterSrc: poster && hosted && baseUrl ? `${baseUrl}/posters/${set}/${slug}${extOf(poster)}` : poster,
    tags: d.tags ?? [],
    group: groupOf(label.category, label.subcategory),
    topics: topicsFor(label.category, label.subcategory, title, d.tags),
    orientation: orientationOf(d.aspectRatio ?? '16:9'),
    source: SETS[set].label,
    branding: b.branding,
    ...(b.marks ? { marks: b.marks } : {}),
    ...(curated ? {} : { autoLabeled: true }),
  });
  credits[id] = { author: d.sourceAuthor ?? null, url: d.sourceUrl ?? null };
  // Where each hosted clip/poster comes from before upload (read by scripts/upload-template-videos.mjs).
  if (hosted) sources[id] = { video: same(d.videoSrc), poster: posterOverride(set, slug) ?? same(d.posterSrc) ?? null };
}
if (missing.length) { console.error('Missing from data files:', missing); process.exit(1); }
writeFileSync(resolve(root, 'scripts/template-video-sources.json'), JSON.stringify(sources, null, 1));

// Fold tiny groups into More, then order groups by size (largest first), More last.
const groupCounts = rows.reduce((m, r) => ((m[r.group] = (m[r.group] ?? 0) + 1), m), {});
for (const r of rows) if (r.group !== 'More' && groupCounts[r.group] < MIN_GROUP) r.group = 'More';
const GROUP_COUNTS = rows.reduce((m, r) => ((m[r.group] = (m[r.group] ?? 0) + 1), m), {});
const GROUP_ORDER = Object.keys(GROUP_COUNTS).filter((g) => g !== 'More').sort((a, b) => GROUP_COUNTS[b] - GROUP_COUNTS[a] || a.localeCompare(b)).concat(GROUP_COUNTS.More ? ['More'] : []);

const PREFERRED = MAIN;
const present = new Set(rows.map((r) => r.category));
const CATEGORY_ORDER = [...PREFERRED.filter((c) => present.has(c)), ...[...present].filter((c) => !PREFERRED.includes(c)).sort()];
// Subcategories per category, largest first (the second row of chips in the modal).
const SUBCATEGORIES = Object.fromEntries(CATEGORY_ORDER.map((c) => {
  const k = new Map();
  rows.filter((r) => r.category === c).forEach((r) => k.set(r.subcategory, (k.get(r.subcategory) ?? 0) + 1));
  return [c, [...k.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([x]) => x)];
}));

const out = `// AUTO-GENERATED FILE — do not edit by hand.
// Regenerate with: node scripts/generate-template-video-library.mjs
// ${rows.length} clips. Each carries a \`branding\` verdict: "none" = reviewed, no visible logo / watermark / credit; "logo" = has one
// (see scripts/template-video-branding.json). \`autoLabeled\` clips use a generated title/subcategory until curated in the labels file.

/** @typedef {{ id: string, slug: string, title: string, sourceTitle: string, category: string, subcategory: string, duration: number | null, aspectRatio: string, videoSrc: string, posterSrc: string | null, tags: string[], source: string, topics: string[], orientation: 'landscape' | 'portrait' | 'square', group: string, branding: 'none' | 'logo', marks?: string, autoLabeled?: boolean }} TemplateVideo */

/** @type {TemplateVideo[]} */
export const templateVideos = ${JSON.stringify(rows, null, 1)};

/** Category tabs in display order (only categories that actually hold clips). */
export const TEMPLATE_VIDEO_CATEGORIES = ${JSON.stringify(CATEGORY_ORDER)};

/** Flat browse groups in display order (the chip row of the modal), More last. */
export const TEMPLATE_VIDEO_GROUPS = ${JSON.stringify(GROUP_ORDER)};

/** Subcategory chips per category, largest first. */
export const TEMPLATE_VIDEO_SUBCATEGORIES = ${JSON.stringify(SUBCATEGORIES, null, 1)};
`;
writeFileSync(resolve(root, 'src/data/templateVideoLibrary.js'), out);
const bc = rows.reduce((m, r) => ((m[r.branding] = (m[r.branding] ?? 0) + 1), m), {});
if (skippedDuplicates.length) console.log('skipped duplicate files:', skippedDuplicates.join(', '));
console.log(`wrote ${rows.length} clips (${JSON.stringify(bc)}), ${rows.filter((r) => r.autoLabeled).length} auto-labeled, ${Object.keys(sources).length} to host`);

// catalog.json: the machine-readable index of the hosted library, uploaded to the bucket root (scripts/upload-template-videos.mjs) so
// another app, or a Claude without this repo, can discover the templates by name, category and branding from one public URL. Only written
// for the hosted form (not --local) and without a timestamp, so regenerating does not create noise.
if (baseUrl) {
  const catalog = {
    name: 'Demo template videos',
    description: 'Ready-made AI video templates (cinematic, commercial, social, action, animation, fashion, VFX) with names, categories, subcategories and a branding label. branding "none" = reviewed, no visible logo/watermark/credit; "logo" = has a visible mark.',
    bucket: 'demo-template-videos',
    baseUrl,
    catalogUrl: `${baseUrl}/catalog.json`,
    usage: 'Filter by category/subcategory and branding. For clean footage use branding "none". videoUrl and posterUrl send Access-Control-Allow-Origin: * and support range requests. Hosted layout: clips/<set>/<slug>.<ext>, posters/<set>/<slug>.<ext>. Clips whose URL starts with "/" live in the app repo (public/media) instead.',
    rights: 'Third-party media (originally shared on X and public prompt galleries). The owner confirmed commercial-use permission; credit holds the upstream author and post where known.',
    maintainedBy: 'remix-new-editor repo: scripts/generate-template-video-library.mjs, scripts/upload-template-videos.mjs, docs/template-videos.md',
    count: rows.length,
    brandingCounts: bc,
    categories: SUBCATEGORIES,
    groups: GROUP_ORDER,
    clips: rows.map((r) => ({
      id: r.id, title: r.title, originalTitle: r.sourceTitle, category: r.category, subcategory: r.subcategory, branding: r.branding, group: r.group, orientation: r.orientation, topics: r.topics,
      ...(r.marks ? { marks: r.marks } : {}),
      duration: r.duration, aspectRatio: r.aspectRatio, videoUrl: r.videoSrc, posterUrl: r.posterSrc, source: r.source,
      credit: credits[r.id],
    })),
  };
  writeFileSync(resolve(root, 'scripts/template-video-catalog.json'), JSON.stringify(catalog, null, 1) + '\n');
  console.log(`wrote scripts/template-video-catalog.json (${rows.length} clips)`);
}
