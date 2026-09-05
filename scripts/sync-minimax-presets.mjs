// scripts/sync-minimax-presets.mjs
//
// Generates the curated StyleTemplate presets for Workstream C.
//
//   - public/media/minimax-h3/presets.json  (server / Supabase Edge read)
//   - src/data/minimax/presets.js            (frontend fallback + build validator)
//
// Both files are kept in sync from a single source of truth:
// src/data/minimaxH3Demos.js. The prompt text is derived per-category so the
// "Create This Style" flow is functional end-to-end; individual prompts can be
// hand-tuned later without changing any component code.
//
// Run: node scripts/sync-minimax-presets.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { minimaxH3Demos } from '../src/data/minimaxH3Demos.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// Mirrors CATEGORY_ROUTES / MODEL_FOR_TARGET in src/data/minimaxH3Demos.js so
// a preset's targetStudio + model agree with the landing-section routing.
const CATEGORY_ROUTES = {
  Commercial: 'commercial',
  UGC: 'influencer',
  Cinema: 'cinema',
  Action: 'cinema',
  Fashion: 'influencer',
  Animation: 'cinema',
  Characters: 'character',
  Food: 'influencer',
  Beauty: 'commercial',
  VFX: 'effects',
  Social: 'storyboard',
  'Web / UI': 'effects',
};
const DEFAULT_CREATE_ROUTE = 'video';
const MODEL_FOR_TARGET = {
  video: 'minimax-hailuo-2.3-standard-t2v',
  cinema: 'minimax-hailuo-2.3-standard-t2v',
  commercial: 'ai-product-shot',
  influencer: 'minimax-hailuo-2.3-standard-t2v',
  character: 'minimax-hailuo-2.3-standard-t2v',
  effects: 'minimax-hailuo-2.3-standard-t2v',
  storyboard: 'minimax-hailuo-2.3-standard-t2v',
  image: 'minimax-image-01',
  audio: 'minimax-music',
};

// Per-category prompt / motion scaffolding. The upstream prompt text is
// CC-BY-4.0 but the gallery media is third-party and NOT relicensed — we
// reconstruct a reproduction style only (never redistribute the clip).
const PROMPT_BY_CATEGORY = {
  Commercial: (d) => `A premium product commercial in the style of "${d.title}". ${d.useCase}. Clean studio lighting, shallow depth of field, macro hero shots, luxurious graded color, confident slow camera moves.`,
  UGC: (d) => `A relatable first-person UGC testimonial in the style of "${d.title}". ${d.useCase}. Handheld phone energy, authentic natural light, casual creator tone, real-life setting.`,
  Cinema: (d) => `A cinematic sequence in the style of "${d.title}". ${d.useCase}. Cinematic anamorphic framing, motivated practical and volumetric lighting, atmospheric depth, deliberate camera choreography.`,
  Action: (d) => `A high-energy action piece in the style of "${d.title}". ${d.useCase}. Dynamic handheld camera, fast kinetic motion, dust and particle detail, punchy contrast.`,
  Fashion: (d) => `A fashion film in the style of "${d.title}". ${d.useCase}. Low-angle tracking shots, editorial styling, strong silhouettes, refined muted palette, graceful motion.`,
  Animation: (d) => `A stylized animated scene in the style of "${d.title}". ${d.useCase}. Cohesive art-directed world, expressive character motion, rich textured shading.`,
  Characters: (d) => `A character-driven scene in the style of "${d.title}". ${d.useCase}. Consistent hero design, expressive performance, cinematic framing that favors the subject.`,
  Beauty: (d) => `A beauty product film in the style of "${d.title}". ${d.useCase}. Soft diffused light, flawless skin and material detail, elegant slow push-in, refined palette.`,
  VFX: (d) => `A VFX-rich shot in the style of "${d.title}". ${d.useCase}. Grounded realism with seamless CG integration, detailed simulation, controlled camera.`,
  Social: (d) => `A social-first piece in the style of "${d.title}". ${d.useCase}. Vertical-friendly composition, punchy pacing, on-trend editing rhythm.`,
  'Web / UI': (d) => `A seamless looping web motion element in the style of "${d.title}". ${d.useCase}. Perfect loop, clean composition, subtle continuous motion suitable for a UI hero.`,
};

const MOTION_BY_CATEGORY = {
  Commercial: { camera: ['slow dolly in', 'static framing'], motion: ['subtle'], strength: 35 },
  UGC: { camera: ['handheld', 'slight bob'], motion: ['natural', 'casual'], strength: 40 },
  Cinema: { camera: ['slow push-in', 'static framing'], motion: ['deliberate'], strength: 55 },
  Action: { camera: ['handheld', 'whip pan'], motion: ['fast', 'kinetic'], strength: 85 },
  Fashion: { camera: ['low-angle tracking', 'orbit'], motion: ['graceful'], strength: 45 },
  Animation: { camera: ['static framing'], motion: ['stylized'], strength: 60 },
  Characters: { camera: ['slow push-in'], motion: ['expressive'], strength: 50 },
  Beauty: { camera: ['macro push-in'], motion: ['soft'], strength: 30 },
  VFX: { camera: ['static framing'], motion: ['seamless'], strength: 65 },
  Social: { camera: ['static framing'], motion: ['punchy'], strength: 55 },
  'Web / UI': { camera: ['static framing'], motion: ['continuous loop'], strength: 25 },
};

function normalizeAspectRatio(ratio = '16:9') {
  const [w, h] = ratio.split(':').map(Number);
  if (!w || !h) return '16:9';
  if (w < h) return '9:16';
  if (Math.abs(w - h) / Math.max(w, h) < 0.1) return '1:1';
  return '16:9';
}

function buildPreset(demo) {
  const route = CATEGORY_ROUTES[demo.category] || DEFAULT_CREATE_ROUTE;
  const model = MODEL_FOR_TARGET[route] || MODEL_FOR_TARGET.video;
  const aspectRatio = normalizeAspectRatio(demo.aspectRatio);
  const motion = MOTION_BY_CATEGORY[demo.category] || { camera: ['static framing'], motion: ['natural'], strength: 50 };
  const promptFor = PROMPT_BY_CATEGORY[demo.category] || PROMPT_BY_CATEGORY.Cinema;
  const rightsNote =
    `Gallery media is third-party and NOT relicensed for redistribution; derive style only, do not redistribute the clip. ` +
    `Prompt text CC-BY-4.0. Credit: ${demo.sourceAuthor} (${demo.sourceUrl}).`;

  return {
    slug: demo.slug,
    title: demo.title,
    author: demo.sourceAuthor,
    sourceClipUrl: `/media/minimax-h3/videos/${demo.slug}.webm`,
    thumbnail: `/media/minimax-h3/previews/${demo.slug}.webp`,
    prompt: promptFor(demo),
    negativePrompt: 'blurry, low resolution, watermark, text, logo, deformed, extra limbs, jpeg artifacts',
    model,
    aspectRatio,
    durationMs: (demo.duration || 5) * 1000,
    motionProfile: {
      camera: motion.camera,
      motion: motion.motion,
      strength: motion.strength,
    },
    styleTags: demo.tags || [],
    palette: [],
    audioProfile: { music: '', sfx: '', voiceover: false },
    targetStudio: route,
    rightsNote,
  };
}

const presets = minimaxH3Demos.map(buildPreset);

// ---- public/media/minimax-h3/presets.json ----
const jsonPath = join(ROOT, 'public', 'media', 'minimax-h3', 'presets.json');
mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, JSON.stringify(presets, null, 2) + '\n', 'utf-8');

// ---- src/data/minimax/presets.js ----
const jsPath = join(ROOT, 'src', 'data', 'minimax', 'presets.js');
mkdirSync(dirname(jsPath), { recursive: true });
const js = `// AUTO-GENERATED by scripts/sync-minimax-presets.mjs — do not edit by hand.
// Mirrors public/media/minimax-h3/presets.json (server/Supabase read).
// Frontend fallback for "Create This Style" when the backend is unavailable.

export const minimaxPresets = ${JSON.stringify(presets, null, 2)};

/** Get a single StyleTemplate preset by slug (frontend fallback). */
export function getPreset(slug) {
  return minimaxPresets.find((p) => p.slug === slug) || null;
}

export default minimaxPresets;
`;
writeFileSync(jsPath, js, 'utf-8');

console.log(`[sync-minimax-presets] wrote ${presets.length} presets -> ${jsonPath} and ${jsPath}`);
