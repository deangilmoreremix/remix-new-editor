#!/usr/bin/env node
/**
 * Regenerates the MiniMax H3 demo manifest from the upstream gallery.json.
 *
 *   node scripts/generate-minimax-h3-manifest.mjs /path/to/awesome-minimax-h3-prompts
 *
 * Upstream source of truth:
 *   https://github.com/Anil-matcha/awesome-minimax-h3-prompts  ->  prompts/gallery.json
 *
 * Writes:
 *   src/data/minimaxH3Demos.ts    normalized metadata (small, imported by every section)
 *   src/data/minimaxH3Prompts.ts  full prompt text (large, lazy-imported by the prompt modal only)
 *
 * Why a generator instead of importing gallery.json directly:
 *  - upstream `category` values are coarse (9 values) and in several cases plainly wrong
 *    (a K-pop music video is tagged "gameplay", a wuxia short is tagged "product commercial"),
 *  - upstream has no per-demo use-case copy, no CTA routing intent and no numeric duration,
 *  - we must not bundle 69KB of prompt text into the landing critical path.
 *
 * The curated overrides below are intentionally explicit and reviewable.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const upstreamRoot =
  process.argv[2] || process.env.MINIMAX_H3_REPO || resolve(REPO_ROOT, '../awesome-minimax-h3-prompts');

const galleryPath = join(upstreamRoot, 'prompts', 'gallery.json');

/**
 * Curated per-slug normalization.
 *  category — one of the 12 display categories used by the landing filters
 *  useCase  — short marketing use-case line shown on cards
 *  tags     — extra filter/search keywords
 */
const CURATED = {
  'modern-warfare-fps-gameplay': {
    category: 'Action',
    useCase: 'Game trailers and FPS-style action promos',
    tags: ['gameplay', 'fps', 'trailer'],
  },
  'luxury-perfume-commercial': {
    category: 'Commercial',
    useCase: 'Premium product launch films for fragrance and luxury goods',
    tags: ['product', 'luxury', 'perfume'],
  },
  '1980s-open-source-family-comedy': {
    category: 'Social',
    useCase: 'Retro-styled brand skits and comedic ad spots',
    tags: ['comedy', 'retro', 'skit'],
  },
  'radio-operator-evacuation-bridge': {
    category: 'Cinema',
    useCase: 'Narrative short films and dramatic period scenes',
    tags: ['story', 'drama', 'period'],
  },
  'giant-koi-park-incident': {
    category: 'VFX',
    useCase: 'Viral creature VFX and scroll-stopping social moments',
    tags: ['viral', 'creature', 'scale'],
  },
  'greenhouse-tea-isekai-anime': {
    category: 'Animation',
    useCase: 'Anime-styled brand worlds and animated storytelling',
    tags: ['anime', 'isekai', 'stylized'],
  },
  'low-angle-fashion-tracking-film': {
    category: 'Fashion',
    useCase: 'Runway-grade fashion films and lookbook motion',
    tags: ['fashion', 'tracking', 'editorial'],
  },
  'storm-lit-pirate-galleon-battle': {
    category: 'Action',
    useCase: 'Epic action set pieces and trailer beats',
    tags: ['action', 'battle', 'storm'],
  },
  'stormy-claymation-whale-breach': {
    category: 'Animation',
    useCase: 'Stop-motion and claymation styled brand stories',
    tags: ['claymation', 'stop-motion', 'texture'],
  },
  'blue-haired-hero-and-spirit-fox-escape': {
    category: 'Characters',
    useCase: 'Consistent hero characters across a story sequence',
    tags: ['character', 'fantasy', 'duo'],
  },
  'kintsugi-sword-seamless-loop': {
    category: 'VFX',
    useCase: 'Seamless product loops and hero object reveals',
    tags: ['loop', 'kintsugi', 'macro'],
  },
  'ramen-bowl-ugc-taste-test': {
    category: 'UGC',
    useCase: 'Restaurant and food UGC taste-test ads',
    tags: ['ugc', 'food', 'restaurant', 'taste-test'],
  },
  'gourmet-burger-ugc-taste-test': {
    category: 'UGC',
    useCase: 'Local business food promos in creator style',
    tags: ['ugc', 'food', 'local-business', 'taste-test'],
  },
  'luxury-skincare-storyboard-commercial': {
    category: 'Beauty',
    useCase: 'Multi-shot skincare commercials from a storyboard',
    tags: ['beauty', 'skincare', 'storyboard'],
  },
  'surreal-blue-studio-dance-with-a-horse': {
    category: 'Fashion',
    useCase: 'Surreal editorial campaigns and art-directed motion',
    tags: ['fashion', 'surreal', 'dance'],
  },
  'nighttime-motorcycle-chase-synced-to-music': {
    category: 'Cinema',
    useCase: 'Music-synced cinematic chase sequences',
    tags: ['chase', 'music-sync', 'night'],
  },
  'y2k-k-pop-candy-typography-music-video': {
    category: 'Social',
    useCase: 'Music videos and kinetic typography social content',
    tags: ['music-video', 'y2k', 'typography'],
  },
  'yellow-sunglasses-in-a-black-studio': {
    category: 'Commercial',
    useCase: 'Studio product hero shots for ecommerce and ads',
    tags: ['product', 'studio', 'eyewear'],
  },
  'theme-park-memory-montage': {
    category: 'Social',
    useCase: 'Emotional brand montages and memory-style recaps',
    tags: ['montage', 'nostalgia', 'lifestyle'],
  },
  'cyber-warrior-vs-primordial-fighter': {
    category: 'Characters',
    useCase: 'Character duels and franchise-style hero matchups',
    tags: ['character', 'fight', 'cyber'],
  },
  'strawberry-drink-transformation-commercial': {
    category: 'Commercial',
    useCase: 'Transformation-style beverage and CPG ads',
    tags: ['product', 'beverage', 'transformation'],
  },
  'ice-gunslinger-interactive-web-loop': {
    category: 'Web / UI',
    useCase: 'Interactive web hero loops and UI motion states',
    tags: ['web', 'ui', 'loop', 'interactive'],
  },
  'porto-francesinha-comedy-recipe': {
    category: 'Food',
    useCase: 'Recipe and food content with comedic hosting',
    tags: ['food', 'recipe', 'comedy'],
  },
  'macaw-scream-in-extreme-slow-motion': {
    category: 'VFX',
    useCase: 'Extreme slow-motion detail and nature spectacle',
    tags: ['slow-motion', 'nature', 'macro'],
  },
  'blackberry-vanilla-soda-ugc-vlog': {
    category: 'UGC',
    useCase: 'Beverage UGC vlogs and creator-style reviews',
    tags: ['ugc', 'beverage', 'vlog'],
  },
  'bamboo-forest-wuxia-mystery': {
    category: 'Cinema',
    useCase: 'Wuxia and atmospheric cinematic sequences',
    tags: ['wuxia', 'atmosphere', 'mystery'],
  },
  'golden-guardian-web-hero-loop': {
    category: 'Web / UI',
    useCase: 'Cinematic website hero background loops',
    tags: ['web', 'hero', 'loop', 'cinematic'],
  },
  'emerald-bio-serum-product-film': {
    category: 'Beauty',
    useCase: 'Vertical product films for serums and skincare',
    tags: ['beauty', 'serum', 'vertical'],
  },
  'black-and-gold-perfume-commercial': {
    category: 'Commercial',
    useCase: 'High-contrast luxury fragrance commercials',
    tags: ['product', 'luxury', 'perfume'],
  },
  'morning-lip-oil-ugc-testimonial': {
    category: 'UGC',
    useCase: 'Beauty UGC testimonials and routine ads',
    tags: ['ugc', 'beauty', 'testimonial'],
  },
};

/** Demos featured in the "Made With SmartVideo" commercial reel. */
const FEATURED = [
  'luxury-perfume-commercial',
  'luxury-skincare-storyboard-commercial',
  'yellow-sunglasses-in-a-black-studio',
  'strawberry-drink-transformation-commercial',
  'emerald-bio-serum-product-film',
  'black-and-gold-perfume-commercial',
];

/** Demos used as full-bleed hero / interactive backgrounds. */
const HERO = ['golden-guardian-web-hero-loop', 'ice-gunslinger-interactive-web-loop'];

function parseDuration(value) {
  if (typeof value !== 'string') return undefined;
  const match = value.match(/([\d.]+)/);
  return match ? Number(match[1]) : undefined;
}

function ts(value) {
  return JSON.stringify(value);
}

const gallery = JSON.parse(readFileSync(galleryPath, 'utf8'));

if (!Array.isArray(gallery)) {
  throw new Error('gallery.json did not contain an array');
}

const missing = gallery.filter((entry) => !CURATED[entry.slug]).map((entry) => entry.slug);
if (missing.length) {
  throw new Error(`Missing curated metadata for: ${missing.join(', ')}`);
}

const demos = gallery.map((entry, index) => {
  const curated = CURATED[entry.slug];
  const upstreamTags = String(entry.category || '')
    .split(/\s+/)
    .filter(Boolean);
  const tags = [...new Set([...(curated.tags || []), ...upstreamTags])];

  return {
    id: index + 1,
    slug: entry.slug,
    title: entry.title,
    category: curated.category,
    useCase: curated.useCase,
    duration: parseDuration(entry.duration),
    aspectRatio: entry.ratio,
    videoSrc: `/media/minimax-h3/videos/${entry.slug}.webm`,
    posterSrc: `/media/minimax-h3/previews/${entry.slug}.webp`,
    featured: FEATURED.includes(entry.slug) || undefined,
    hero: HERO.includes(entry.slug) || undefined,
    tags,
    upstreamCategory: entry.category,
    sourceAuthor: entry.source?.author,
    sourceUrl: entry.source?.url,
    prompt: entry.prompt,
  };
});

/* ------------------------------------------------------------------ manifest */

const header = `// AUTO-GENERATED FILE — do not edit by hand.
//
// Regenerate with:
//   node scripts/generate-minimax-h3-manifest.mjs /path/to/awesome-minimax-h3-prompts
//
// Canonical metadata source:
//   https://github.com/Anil-matcha/awesome-minimax-h3-prompts -> prompts/gallery.json
//
// Prompt text upstream is CC-BY-4.0 ("Anil-matcha MiniMax H3 Prompt Lab").
// Gallery media is third-party and is NOT relicensed by the upstream repo; it is
// mirrored locally under /media/minimax-h3/** so that the files can be swapped for
// SmartVideo-generated versions without touching a single component. Slugs and
// filenames are stable for exactly that reason.
//
// This module is the single source of truth for every MiniMax H3 landing section.
// Do not duplicate demo metadata inside components.
`;

const manifest = `${header}
export type MinimaxCategory =
${[...new Set(demos.map((d) => d.category))]
  .sort()
  .map((c) => `  | ${ts(c)}`)
  .join('\n')};

export type MinimaxDemo = {
  id: number;
  slug: string;
  title: string;
  category: MinimaxCategory;
  useCase: string;
  duration?: number;
  aspectRatio?: string;
  videoSrc: string;
  posterSrc: string;
  prompt?: string;
  featured?: boolean;
  hero?: boolean;
  tags?: string[];
  /** Raw upstream category, kept for traceability back to gallery.json. */
  upstreamCategory?: string;
  /** Original creator of the reference clip. */
  sourceAuthor?: string;
  sourceUrl?: string;
};

/** Model used for every clip in this library. */
export const MINIMAX_MODEL = 'MiniMax Hailuo 3 (H3)';

export const minimaxH3Demos: MinimaxDemo[] = [
${demos
  .map((d) => {
    const lines = [
      `    id: ${d.id}`,
      `    slug: ${ts(d.slug)}`,
      `    title: ${ts(d.title)}`,
      `    category: ${ts(d.category)}`,
      `    useCase: ${ts(d.useCase)}`,
      d.duration !== undefined ? `    duration: ${d.duration}` : null,
      d.aspectRatio ? `    aspectRatio: ${ts(d.aspectRatio)}` : null,
      `    videoSrc: ${ts(d.videoSrc)}`,
      `    posterSrc: ${ts(d.posterSrc)}`,
      d.featured ? `    featured: true` : null,
      d.hero ? `    hero: true` : null,
      `    tags: [${(d.tags || []).map(ts).join(', ')}]`,
      d.upstreamCategory ? `    upstreamCategory: ${ts(d.upstreamCategory)}` : null,
      d.sourceAuthor ? `    sourceAuthor: ${ts(d.sourceAuthor)}` : null,
      d.sourceUrl ? `    sourceUrl: ${ts(d.sourceUrl)}` : null,
    ].filter(Boolean);
    return `  {\n${lines.join(',\n')},\n  }`;
  })
  .join(',\n')},
];

/* --------------------------------------------------------------- lookup utils */

const bySlug = new Map(minimaxH3Demos.map((demo) => [demo.slug, demo]));

export function getDemoBySlug(slug: string): MinimaxDemo | undefined {
  return bySlug.get(slug);
}

/** Throws in development if a slug is misspelled inside a component. */
export function requireDemo(slug: string): MinimaxDemo {
  const demo = bySlug.get(slug);
  if (!demo) throw new Error(\`[minimaxH3Demos] unknown demo slug: \${slug}\`);
  return demo;
}

export function getDemosBySlugs(slugs: string[]): MinimaxDemo[] {
  return slugs.map((slug) => requireDemo(slug));
}

export function getFeaturedDemos(): MinimaxDemo[] {
  return minimaxH3Demos.filter((demo) => demo.featured);
}

export function getDemosByCategory(category: string): MinimaxDemo[] {
  if (!category || category === 'All') return minimaxH3Demos;
  return minimaxH3Demos.filter((demo) => demo.category === category);
}

/** Display order for the gallery filter bar. */
export const MINIMAX_CATEGORIES: string[] = [
  'All',
${[...new Set(demos.map((d) => d.category))]
  .sort()
  .map((c) => `  ${ts(c)},`)
  .join('\n')}
];

/** Category -> count, used to label / hide empty filters. */
export function getCategoryCounts(): Record<string, number> {
  return minimaxH3Demos.reduce<Record<string, number>>((acc, demo) => {
    acc[demo.category] = (acc[demo.category] || 0) + 1;
    return acc;
  }, {});
}

/* ------------------------------------------------------------------- ratios */

/**
 * Upstream ratios are not all clean 16:9 (e.g. "40:17", "92:39", "959:540").
 * Returns a numeric width/height ratio so frames can be sized without ever
 * distorting the source media.
 */
export function ratioToNumber(aspectRatio?: string, fallback = 16 / 9): number {
  if (!aspectRatio) return fallback;
  const [w, h] = aspectRatio.split(':').map(Number);
  if (!w || !h) return fallback;
  return w / h;
}

export function isVertical(demo: MinimaxDemo): boolean {
  return ratioToNumber(demo.aspectRatio) < 1;
}

export function formatDuration(demo: MinimaxDemo): string {
  return demo.duration ? \`\${demo.duration}s\` : '—';
}

/* --------------------------------------------------------- prompt (lazy load) */

/**
 * Full prompt text lives in a separate chunk (~69KB across 30 demos) so the
 * landing page never ships it on first paint. The prompt modal awaits this.
 */
export async function loadDemoPrompt(slug: string): Promise<string | undefined> {
  const { minimaxH3Prompts } = await import('./minimaxH3Prompts');
  return minimaxH3Prompts[slug];
}

/* ------------------------------------------------- CTA routing (single layer) */

/**
 * The ONE place that maps a demo category to an in-app studio route.
 * Components must never hardcode studio URLs.
 *
 * Every value below is a real route key from src/lib/router.js pageLoaders.
 */
export const CATEGORY_ROUTES: Record<string, string> = {
  Commercial: 'commercial',
  UGC: 'video',
  Cinema: 'cinema',
  Action: 'cinema',
  Fashion: 'influencer',
  Animation: 'cinema',
  Characters: 'character',
  Food: 'commercial',
  Beauty: 'commercial',
  VFX: 'ai-vfx',
  Social: 'video',
  'Web / UI': 'video',
};

/** Fallback studio when a category has no explicit mapping. */
export const DEFAULT_CREATE_ROUTE = 'video';

/** Prefix for the template id handed to the destination studio. */
export const TEMPLATE_PREFIX = 'minimax-h3-';

export type CreateTarget = {
  /** Router page key — pass to navigate(route, params). */
  route: string;
  /** Query params — the router serializes these into the URL. */
  params: Record<string, string>;
  /** Bookmarkable hash URL, for anchor href values. */
  href: string;
};

/**
 * Resolves the "Create This Style" destination for a demo.
 *
 * Returns router-native values instead of a bare string because this app is a
 * hash-routed SPA: a real \`/commercial\` href would 404 on the server.
 */
export function getCreateTarget(demo: MinimaxDemo): CreateTarget {
  const route = CATEGORY_ROUTES[demo.category] || DEFAULT_CREATE_ROUTE;
  const params = {
    template: \`\${TEMPLATE_PREFIX}\${demo.slug}\`,
    ref: 'minimax-h3',
  };
  const query = new URLSearchParams(params).toString();
  return { route, params, href: \`/?\${query}#/\${route}\` };
}

/** Convenience wrapper matching the requested helper name. */
export function getCreateUrl(demo: MinimaxDemo): string {
  return getCreateTarget(demo).href;
}
`;

/* ------------------------------------------------------------------- prompts */

// Store prompt text in a JSON file so that newlines and quoting are
// handled by JSON rather than raw TS string syntax (avoids Babel parse
// failures when a value contains escaped dialogue quotes).
const promptsJson = Object.fromEntries(
  demos.map((d) => [d.slug, d.prompt]),
);
const promptsJsonPath = join(outDir, 'minimaxH3Prompts.json');
writeFileSync(promptsJsonPath, JSON.stringify(promptsJson, null, 2) + '\n');

// Thin TS wrapper — re-export the JSON as a Record<string, string>.
const prompts = `// AUTO-GENERATED FILE — do not edit by hand.
//
// Regenerate with:
//   node scripts/generate-minimax-h3-manifest.mjs /path/to/awesome-minimax-h3-prompts
//
// Prompt text from https://github.com/Anil-matcha/awesome-minimax-h3-prompts
// licensed CC-BY-4.0. Attribution: "Anil-matcha MiniMax H3 Prompt Lab".
//
// Kept in a standalone module so the ~69KB of prompt text is code-split out of
// the landing page critical path. Loaded on demand via loadDemoPrompt().
//
// The actual prompt strings live in minimaxH3Prompts.json; this module
// simply re-exports them with a TypeScript type annotation.

import prompts from './minimaxH3Prompts.json';

export const minimaxH3Prompts: Record<string, string> = prompts;
`;

const outDir = join(REPO_ROOT, 'src', 'data');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'minimaxH3Demos.ts'), manifest);
writeFileSync(join(outDir, 'minimaxH3Prompts.ts'), prompts);

console.log(`Wrote src/data/minimaxH3Demos.ts        (${demos.length} demos)`);
console.log(`Wrote src/data/minimaxH3Prompts.json    (${(JSON.stringify(promptsJson).length / 1024).toFixed(1)}KB)`);
console.log(`Wrote src/data/minimaxH3Prompts.ts      (${(prompts.length / 1024).toFixed(1)}KB)`);

const counts = demos.reduce((acc, d) => {
  acc[d.category] = (acc[d.category] || 0) + 1;
  return acc;
}, {});
console.log('Categories:', counts);
