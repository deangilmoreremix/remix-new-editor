// AUTO-GENERATED FILE — do not edit by hand.
//
// Regenerate with:
//   node scripts/generate-seedance-manifest.mjs
//
// Canonical prompt source:
//   https://github.com/Anil-matcha/awesome-seedance-2.5-api-prompts
//
// Prompt text upstream is CC-BY-4.0 ("Anil-matcha Seedance 2.5 Prompt Lab").
// Gallery media is third-party and is NOT relicensed by the upstream repo.
//
// This module is the single source of truth for every Seedance 2.5 landing section.
// Do not duplicate demo metadata inside components.

export type SeedanceCategory =
  | "Animation"
  | "Cinematic"
  | "Commercial"
  | "Cultural"
  | "Fashion"
  | "Nature"
  | "Product"
  | "Sci-Fi"
  | "VFX";

export type SeedanceDemo = {
  id: number;
  slug: string;
  title: string;
  category: SeedanceCategory;
  useCase: string;
  duration?: number;
  aspectRatio?: string;
  videoSrc: string;
  posterSrc: string;
  tags?: string[];
  workflow?: string;
  sourceAuthor?: string;
  sourceUrl?: string;
};

export const SEEDANCE_MODEL = 'Seedance 2.5 (ByteDance)';

export const seedanceDemos: SeedanceDemo[] = [
  {
    id: 1,
    slug: "steampunk-clockwork-odyssey",
    title: "Steampunk Clockwork Odyssey",
    category: "Cinematic",
    useCase: "Epic fantasy adventures and premium brand storytelling",
    duration: 30,
    aspectRatio: "16:9",
    videoSrc: "/media/seedance-2.5/videos/steampunk-clockwork-odyssey.webm",
    posterSrc: "/media/seedance-2.5/previews/steampunk-clockwork-odyssey.webp",
    tags: ["steampunk", "cinematic", "fantasy", "3d-motion-graphics"],
    workflow: "t2v",
    sourceAuthor: "Anil-matcha",
    sourceUrl: "https://github.com/Anil-matcha/awesome-seedance-2.5-api-prompts",
  },
  {
    id: 2,
    slug: "crystal-ball-match-cut-brand-film",
    title: "Crystal Ball Match-Cut Brand Film",
    category: "Commercial",
    useCase: "High-energy brand films and music-synced product reveals",
    duration: 30,
    aspectRatio: "16:9",
    videoSrc: "/media/seedance-2.5/videos/crystal-ball-match-cut-brand-film.webm",
    posterSrc: "/media/seedance-2.5/previews/crystal-ball-match-cut-brand-film.webp",
    tags: ["brand-film", "commercial", "match-cut", "music-sync"],
    workflow: "t2v",
    sourceAuthor: "Anil-matcha",
    sourceUrl: "https://github.com/Anil-matcha/awesome-seedance-2.5-api-prompts",
  },
  {
    id: 3,
    slug: "window-to-eye-concept-film",
    title: "Window-to-Eye Concept Film",
    category: "Cinematic",
    useCase: "Cinematic brand concepts with multi-reference image sequences",
    duration: 30,
    aspectRatio: "16:9",
    videoSrc: "/media/seedance-2.5/videos/window-to-eye-concept-film.webm",
    posterSrc: "/media/seedance-2.5/previews/window-to-eye-concept-film.webp",
    tags: ["concept-film", "cinematic", "multi-reference", "brand"],
    workflow: "i2v",
    sourceAuthor: "Anil-matcha",
    sourceUrl: "https://github.com/Anil-matcha/awesome-seedance-2.5-api-prompts",
  },
  {
    id: 4,
    slug: "multilingual-creative-typography-loop",
    title: "Multilingual Creative Typography Loop",
    category: "VFX",
    useCase: "Seamless looping typography animations and kinetic text content",
    duration: 15,
    aspectRatio: "16:9",
    videoSrc: "/media/seedance-2.5/videos/multilingual-creative-typography-loop.webm",
    posterSrc: "/media/seedance-2.5/previews/multilingual-creative-typography-loop.webp",
    tags: ["typography", "loop", "kinetic", "vfx", "multi-language"],
    workflow: "t2v",
    sourceAuthor: "Anil-matcha",
    sourceUrl: "https://github.com/Anil-matcha/awesome-seedance-2.5-api-prompts",
  },
  {
    id: 5,
    slug: "haute-couture-dream-bokeh-film",
    title: "Haute Couture Dream Bokeh Film",
    category: "Fashion",
    useCase: "Runway-grade fashion films and luxury brand motion",
    duration: 30,
    aspectRatio: "3:4",
    videoSrc: "/media/seedance-2.5/videos/haute-couture-dream-bokeh-film.webm",
    posterSrc: "/media/seedance-2.5/previews/haute-couture-dream-bokeh-film.webp",
    tags: ["fashion", "couture", "bokeh", "luxury", "runway"],
    workflow: "t2v",
    sourceAuthor: "Anil-matcha",
    sourceUrl: "https://github.com/Anil-matcha/awesome-seedance-2.5-api-prompts",
  },
  {
    id: 6,
    slug: "retro-suede-boots-brand-concept-film",
    title: "Retro Suede Boots Brand Concept Film",
    category: "Fashion",
    useCase: "Premium product films and high-fashion brand concepts",
    duration: 30,
    aspectRatio: "16:9",
    videoSrc: "/media/seedance-2.5/videos/retro-suede-boots-brand-concept-film.webm",
    posterSrc: "/media/seedance-2.5/previews/retro-suede-boots-brand-concept-film.webp",
    tags: ["fashion", "product", "brand", "commercial"],
    workflow: "t2v",
    sourceAuthor: "Anil-matcha",
    sourceUrl: "https://github.com/Anil-matcha/awesome-seedance-2.5-api-prompts",
  },
  {
    id: 7,
    slug: "deep-sea-coral-reef-jellyfish-scene",
    title: "Deep-Sea Coral Reef Jellyfish Scene",
    category: "Nature",
    useCase: "Nature documentaries and immersive underwater content",
    duration: 15,
    aspectRatio: "1:1",
    videoSrc: "/media/seedance-2.5/videos/deep-sea-coral-reef-jellyfish-scene.webm",
    posterSrc: "/media/seedance-2.5/previews/deep-sea-coral-reef-jellyfish-scene.webp",
    tags: ["nature", "underwater", "documentary", "jellyfish"],
    workflow: "t2v",
    sourceAuthor: "Anil-matcha",
    sourceUrl: "https://github.com/Anil-matcha/awesome-seedance-2.5-api-prompts",
  },
  {
    id: 8,
    slug: "floating-desert-museum-cinematic-film",
    title: "Floating Desert Museum Cinematic Film",
    category: "Cinematic",
    useCase: "Architectural showcases and surreal brand films",
    duration: 30,
    aspectRatio: "1:1",
    videoSrc: "/media/seedance-2.5/videos/floating-desert-museum-cinematic-film.webm",
    posterSrc: "/media/seedance-2.5/previews/floating-desert-museum-cinematic-film.webp",
    tags: ["architecture", "desert", "cinematic", "museum"],
    workflow: "t2v",
    sourceAuthor: "Anil-matcha",
    sourceUrl: "https://github.com/Anil-matcha/awesome-seedance-2.5-api-prompts",
  },
  {
    id: 9,
    slug: "peking-opera-heritage-short-film",
    title: "Peking Opera Heritage Short Film",
    category: "Cultural",
    useCase: "Cultural heritage stories and Eastern aesthetic narratives",
    duration: 30,
    aspectRatio: "3:4",
    videoSrc: "/media/seedance-2.5/videos/peking-opera-heritage-short-film.webm",
    posterSrc: "/media/seedance-2.5/previews/peking-opera-heritage-short-film.webp",
    tags: ["cultural", "heritage", "peking-opera", "eastern-aesthetics"],
    workflow: "t2v",
    sourceAuthor: "Anil-matcha",
    sourceUrl: "https://github.com/Anil-matcha/awesome-seedance-2.5-api-prompts",
  },
  {
    id: 10,
    slug: "silk-road-pomegranate-folk-animation",
    title: "Silk Road Pomegranate Folk Animation",
    category: "Animation",
    useCase: "Brand animations and culturally-inspired motion graphics",
    duration: 30,
    aspectRatio: "3:4",
    videoSrc: "/media/seedance-2.5/videos/silk-road-pomegranate-folk-animation.webm",
    posterSrc: "/media/seedance-2.5/previews/silk-road-pomegranate-folk-animation.webp",
    tags: ["animation", "folk", "silk-road", "flat-design", "cultural"],
    workflow: "t2v",
    sourceAuthor: "Anil-matcha",
    sourceUrl: "https://github.com/Anil-matcha/awesome-seedance-2.5-api-prompts",
  },
  {
    id: 11,
    slug: "oceanic-civilization-epic-sci-fi-film",
    title: "Oceanic Civilization Epic Sci-Fi Film",
    category: "Sci-Fi",
    useCase: "Sci-fi epics and concept films with cinematic scale",
    duration: 30,
    aspectRatio: "16:9",
    videoSrc: "/media/seedance-2.5/videos/oceanic-civilization-epic-sci-fi-film.webm",
    posterSrc: "/media/seedance-2.5/previews/oceanic-civilization-epic-sci-fi-film.webp",
    tags: ["sci-fi", "epic", "ocean", "concept-film", "cinematic"],
    workflow: "t2v",
    sourceAuthor: "Anil-matcha",
    sourceUrl: "https://github.com/Anil-matcha/awesome-seedance-2.5-api-prompts",
  },
  {
    id: 12,
    slug: "mechanical-flower-bloom-brand-film",
    title: "Mechanical Flower Bloom Brand Film",
    category: "Commercial",
    useCase: "Tech brand reveals and product demonstration films",
    duration: 30,
    aspectRatio: "1:1",
    videoSrc: "/media/seedance-2.5/videos/mechanical-flower-bloom-brand-film.webm",
    posterSrc: "/media/seedance-2.5/previews/mechanical-flower-bloom-brand-film.webp",
    tags: ["tech", "brand", "product", "mechanical", "macro"],
    workflow: "t2v",
    sourceAuthor: "Anil-matcha",
    sourceUrl: "https://github.com/Anil-matcha/awesome-seedance-2.5-api-prompts",
  },
  {
    id: 13,
    slug: "one-shot-rooms-with-shifting-worlds",
    title: "One-Shot Rooms With Shifting Worlds",
    category: "Cinematic",
    useCase: "Multi-reference narrative sequences and character-driven stories",
    duration: 30,
    aspectRatio: "16:9",
    videoSrc: "/media/seedance-2.5/videos/one-shot-rooms-with-shifting-worlds.webm",
    posterSrc: "/media/seedance-2.5/previews/one-shot-rooms-with-shifting-worlds.webp",
    tags: ["multi-reference", "narrative", "one-shot", "character"],
    workflow: "i2v",
    sourceAuthor: "Anil-matcha",
    sourceUrl: "https://github.com/Anil-matcha/awesome-seedance-2.5-api-prompts",
  },
  {
    id: 14,
    slug: "fruit-cookie-commercial",
    title: "Fruit Cookie Commercial",
    category: "Product",
    useCase: "CPG product ads and multi-flavor food commercials",
    duration: 30,
    aspectRatio: "16:9",
    videoSrc: "/media/seedance-2.5/videos/fruit-cookie-commercial.webm",
    posterSrc: "/media/seedance-2.5/previews/fruit-cookie-commercial.webp",
    tags: ["product", "food", "commercial", "multi-reference"],
    workflow: "i2v",
    sourceAuthor: "Anil-matcha",
    sourceUrl: "https://github.com/Anil-matcha/awesome-seedance-2.5-api-prompts",
  },
  {
    id: 15,
    slug: "desert-horned-lizard-grapefruit-ad",
    title: "Desert Horned Lizard Grapefruit Ad",
    category: "Product",
    useCase: "Playful product ads and character-driven food commercials",
    duration: 20,
    aspectRatio: "16:9",
    videoSrc: "/media/seedance-2.5/videos/desert-horned-lizard-grapefruit-ad.webm",
    posterSrc: "/media/seedance-2.5/previews/desert-horned-lizard-grapefruit-ad.webp",
    tags: ["product", "food", "character", "commercial", "3d-animation"],
    workflow: "i2v",
    sourceAuthor: "Anil-matcha",
    sourceUrl: "https://github.com/Anil-matcha/awesome-seedance-2.5-api-prompts",
  },
];

/* --------------------------------------------------------------- lookup utils */

const bySlug = new Map(seedanceDemos.map((demo) => [demo.slug, demo]));

export function getDemoBySlug(slug: string): SeedanceDemo | undefined {
  return bySlug.get(slug);
}

export function requireDemo(slug: string): SeedanceDemo {
  const demo = bySlug.get(slug);
  if (!demo) throw new Error(`[seedanceDemos] unknown demo slug: ${slug}`);
  return demo;
}

export function getDemosBySlugs(slugs: string[]): SeedanceDemo[] {
  return slugs.map((slug) => requireDemo(slug));
}

export function getFeaturedDemos(): SeedanceDemo[] {
  return seedanceDemos.filter((demo) => demo.id <= 6);
}

export function getDemosByCategory(category: string): SeedanceDemo[] {
  if (!category || category === 'All') return seedanceDemos;
  return seedanceDemos.filter((demo) => demo.category === category);
}

export const SEEDANCE_CATEGORIES: string[] = [
  'All',
    "Animation",
  "Cinematic",
  "Commercial",
  "Cultural",
  "Fashion",
  "Nature",
  "Product",
  "Sci-Fi",
  "VFX",
];

export function getCategoryCounts(): Record<string, number> {
  return seedanceDemos.reduce<Record<string, number>>((acc, demo) => {
    acc[demo.category] = (acc[demo.category] || 0) + 1;
    return acc;
  }, {});
}

export function ratioToNumber(aspectRatio?: string, fallback = 16 / 9): number {
  if (!aspectRatio) return fallback;
  const [w, h] = aspectRatio.split(':').map(Number);
  if (!w || !h) return fallback;
  return w / h;
}

export function formatDuration(demo: SeedanceDemo): string {
  return demo.duration ? `${demo.duration}s` : '—';
}

/* --------------------------------------------------------- prompt (lazy load) */

export async function loadDemoPrompt(slug: string): Promise<string | undefined> {
  const { seedancePrompts } = await import('./seedancePrompts');
  return seedancePrompts[slug];
}

/* ------------------------------------------------- CTA routing */

export const CATEGORY_ROUTES: Record<string, string> = {
  Cinematic: 'cinema',
  Commercial: 'commercial',
  Fashion: 'influencer',
  Nature: 'cinema',
  Cultural: 'cinema',
  Animation: 'cinema',
  'Sci-Fi': 'cinema',
  VFX: 'ai-vfx',
  Product: 'commercial',
};

export const DEFAULT_CREATE_ROUTE = 'cinema';
export const TEMPLATE_PREFIX = 'seedance-2.5-';

export function getCreateTarget(demo: SeedanceDemo) {
  const route = CATEGORY_ROUTES[demo.category] || DEFAULT_CREATE_ROUTE;
  const params = {
    template: `${TEMPLATE_PREFIX}${demo.slug}`,
    ref: 'seedance-2.5',
  };
  const query = new URLSearchParams(params).toString();
  return { route, params, href: `/?${query}#/${route}` };
}

export function getCreateUrl(demo: SeedanceDemo): string {
  return getCreateTarget(demo).href;
}
