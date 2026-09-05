// CI gate: validates Minimax H3 style presets against the 30 .webm clips.
// Run: node scripts/validate-minimax-presets.js
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const VIDEOS_DIR = resolve(root, "public/media/minimax-h3/videos");
const PRESETS_JSON = resolve(root, "public/media/minimax-h3/presets.json");
const PRESETS_JS = resolve(root, "src/data/minimax/presets.js");

const STUDIOS = new Set([
  "TemplateStudio",
  "EditStudio",
  "CharacterStudio",
  "CinemaStudio",
  "ImageStudio",
  "AudioStudio",
  "AvatarStudio",
  "VideoStudio",
]);

const CANONICAL = {
  "luxury-perfume-commercial": "TemplateStudio",
  "luxury-skincare-storyboard-commercial": "TemplateStudio",
  "yellow-sunglasses-in-a-black-studio": "TemplateStudio",
  "strawberry-drink-transformation-commercial": "TemplateStudio",
  "ice-gunslinger-interactive-web-loop": "TemplateStudio",
  "golden-guardian-web-hero-loop": "TemplateStudio",
  "emerald-bio-serum-product-film": "TemplateStudio",
  "black-and-gold-perfume-commercial": "TemplateStudio",
  "kintsugi-sword-seamless-loop": "EditStudio",
  "theme-park-memory-montage": "EditStudio",
  "1980s-open-source-family-comedy": "CharacterStudio",
  "blue-haired-hero-and-spirit-fox-escape": "CharacterStudio",
  "cyber-warrior-vs-primordial-fighter": "CharacterStudio",
  "radio-operator-evacuation-bridge": "CinemaStudio",
  "greenhouse-tea-isekai-anime": "CinemaStudio",
  "storm-lit-pirate-galleon-battle": "CinemaStudio",
  "stormy-claymation-whale-breach": "CinemaStudio",
  "nighttime-motorcycle-chase-synced-to-music": "CinemaStudio",
  "bamboo-forest-wuxia-mystery": "CinemaStudio",
  "low-angle-fashion-tracking-film": "ImageStudio",
  "surreal-blue-studio-dance-with-a-horse": "ImageStudio",
  "y2k-k-pop-candy-typography-music-video": "AudioStudio",
  "porto-francesinha-comedy-recipe": "AudioStudio",
  "ramen-bowl-ugc-taste-test": "AvatarStudio",
  "gourmet-burger-ugc-taste-test": "AvatarStudio",
  "blackberry-vanilla-soda-ugc-vlog": "AvatarStudio",
  "morning-lip-oil-ugc-testimonial": "AvatarStudio",
  "modern-warfare-fps-gameplay": "VideoStudio",
  "giant-koi-park-incident": "VideoStudio",
  "macaw-scream-in-extreme-slow-motion": "VideoStudio",
};

const errors = [];
const notes = [];
const fail = (m) => errors.push(m);

// 1. List all .webm slugs
let webmSlugs = [];
try {
  webmSlugs = readdirSync(VIDEOS_DIR)
    .filter((f) => f.endsWith(".webm"))
    .map((f) => f.replace(/\.webm$/, ""))
    .sort();
} catch (e) {
  fail(`Cannot read videos dir ${VIDEOS_DIR}: ${e.message}`);
}

// 2. Load presets (prefer importing the .js module, fall back to .json)
let presets = null;
let source = "";
try {
  const mod = await import(PRESETS_JS);
  presets = mod.minimaxPresets || mod.default;
  source = "src/data/minimax/presets.js";
} catch (e) {
  notes.push(`JS import failed (${e.message}); falling back to presets.json`);
  presets = JSON.parse(readFileSync(PRESETS_JSON, "utf8"));
  source = "presets.json";
}
if (!Array.isArray(presets)) fail("Presets did not resolve to an array");

const presetSlugs = presets.map((p) => p.slug);

// 3. Coverage assertions
for (const slug of webmSlugs) {
  if (!presetSlugs.includes(slug)) fail(`webm has no preset: ${slug}.webm`);
}
for (const p of presets) {
  if (!webmSlugs.includes(p.slug)) fail(`preset has no matching .webm: ${p.slug}`);
}

// 4. Field-level assertions
const reqStr = (p, key) => {
  if (typeof p[key] !== "string" || p[key].trim() === "")
    fail(`${p.slug}: '${key}' must be a non-empty string`);
};
for (const p of presets) {
  reqStr(p, "slug");
  reqStr(p, "title");
  reqStr(p, "prompt");
  reqStr(p, "model");
  reqStr(p, "rightsNote");

  if (!STUDIOS.has(p.targetStudio))
    fail(`${p.slug}: targetStudio '${p.targetStudio}' not in 8-studio set`);

  if (!Array.isArray(p.palette) || p.palette.length < 2)
    fail(`${p.slug}: palette must have >= 2 entries (got ${Array.isArray(p.palette) ? p.palette.length : "n/a"})`);

  if (!Array.isArray(p.styleTags) || p.styleTags.length < 1)
    fail(`${p.slug}: styleTags must have >= 1 entry`);

  if (!["16:9", "9:16", "1:1"].includes(p.aspectRatio))
    fail(`${p.slug}: aspectRatio '${p.aspectRatio}' not in [16:9,9:16,1:1]`);

  if (
    !p.motionProfile ||
    typeof p.motionProfile.strength !== "number" ||
    p.motionProfile.strength < 0 ||
    p.motionProfile.strength > 100
  )
    fail(`${p.slug}: motionProfile.strength must be a number 0-100`);

  // 5. Canonical mapping
  if (CANONICAL[p.slug] && p.targetStudio !== CANONICAL[p.slug])
    fail(`${p.slug}: targetStudio '${p.targetStudio}' != canonical '${CANONICAL[p.slug]}'`);
}

// Summary
console.log(`\nSource: ${source}`);
console.log(`webm clips: ${webmSlugs.length}`);
console.log(`presets:    ${presets.length}`);
if (notes.length) notes.forEach((n) => console.log(`note: ${n}`));

if (errors.length === 0) {
  const counts = {};
  for (const p of presets) counts[p.targetStudio] = (counts[p.targetStudio] || 0) + 1;
  console.log("\nPer-studio counts:");
  for (const s of Object.keys(counts).sort()) console.log(`  ${s}: ${counts[s]}`);
  console.log("\nPASS: all presets valid.\n");
  process.exit(0);
} else {
  console.log(`\nFAIL: ${errors.length} issue(s):`);
  for (const e of errors) console.log("  - " + e);
  process.exit(1);
}
