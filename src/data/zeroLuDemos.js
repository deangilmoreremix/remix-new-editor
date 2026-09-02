// AUTO-GENERATED FILE — do not edit by hand.
//
// Regenerate with:
//   node scripts/generate-zeroLu-seedance.mjs
//
// Source: https://github.com/ZeroLu/awesome-seedance/
//
// English-only: all prompts parsed from README.md (English sections only).
// The Chinese prompts/commercial-use-cases.md file is skipped.
// All 17 MP4 videos are downloaded locally.
//
// This module is the single source of truth for every ZeroLu Seedance 2.0
// landing showcase section.

/** Model used for every clip in this library. */
export const ZERO_LU_MODEL = "Seedance 2.0 (Bytedance)";

/** Unified 12-label category vocabulary. */
export const ZERO_LU_CATEGORIES = ["Animation", "Cinema", "Commercial", "Social", "UGC", "VFX"];

/** Category -> router route for the "Create This Style" CTA. */
export const CATEGORY_ROUTES = {
  "Action": "cinema",
  "Animation": "cinema",
  "Beauty": "influencer",
  "Characters": "character",
  "Cinema": "cinema",
  "Commercial": "commercial",
  "Fashion": "influencer",
  "Food": "commercial",
  "Social": "video",
  "UGC": "video",
  "VFX": "ai-vfx",
  "Web / UI": "video"
};

export const DEFAULT_CREATE_ROUTE = "video";
export const TEMPLATE_PREFIX = "seedance-2.0-";

export function getCreateTarget(demo) {
  const route = CATEGORY_ROUTES[demo.category] || DEFAULT_CREATE_ROUTE;
  const params = {
    template: TEMPLATE_PREFIX + demo.slug,
    ref: "seedance-2.0",
  };
  const query = new URLSearchParams(params).toString();
  return { route: route, params: params, href: "/?" + query + "#/" + route };
}

export function getCreateUrl(demo) {
  return getCreateTarget(demo).href;
}

export const zeroLuDemos = [
  {
    id: 1,
    slug: "adam",
    title: "Nezha and Ao Bing Ice-Fire Clash (Space-Time Folding)",
    category: "Animation",
    useCase: "Nezha and Ao Bing Ice-Fire Clash (Space-Time Folding)",
    duration: 15,
    aspectRatio: "16:9",
    videoSrc: "/media/awesome-seedance/videos/adam.mp4",
    posterSrc: "/media/awesome-seedance/previews/adam.webp",
    tags: ["reference", "seedance-2.0", "adam"],
    upstreamCategory: "Animation",
    workflow: "t2v",
    sourceAuthor: "@Adam38363368936",
    sourceUrl: "https://x.com/Adam38363368936",
  },
  {
    id: 2,
    slug: "bootoshi",
    title: "Luffy Coding on MacBook (Comedy Scene)",
    category: "Animation",
    useCase: "Luffy Coding on MacBook (Comedy Scene)",
    duration: 15,
    aspectRatio: "16:9",
    videoSrc: "/media/awesome-seedance/videos/bootoshi.mp4",
    posterSrc: "/media/awesome-seedance/previews/bootoshi.webp",
    tags: ["reference", "seedance-2.0", "bootoshi"],
    upstreamCategory: "Animation",
    workflow: "t2v",
    sourceAuthor: "@KingBootoshi",
    sourceUrl: "https://x.com/KingBootoshi",
  },
  {
    id: 3,
    slug: "guizang",
    title: "MUJI Brand Promotional Video",
    category: "Commercial",
    useCase: "MUJI Brand Promotional Video",
    duration: 15,
    aspectRatio: "16:9",
    videoSrc: "/media/awesome-seedance/videos/guizang.mp4",
    posterSrc: "/media/awesome-seedance/previews/guizang.webp",
    tags: ["reference", "seedance-2.0", "guizang"],
    upstreamCategory: "Commercial",
    workflow: "t2v",
    sourceAuthor: "@op7418",
    sourceUrl: "https://x.com/op7418",
  },
  {
    id: 4,
    slug: "john10",
    title: "Surrealism and Megalophobia Style",
    category: "VFX",
    useCase: "Surrealism and Megalophobia Style",
    duration: 15,
    aspectRatio: "16:9",
    videoSrc: "/media/awesome-seedance/videos/john10.mp4",
    posterSrc: "/media/awesome-seedance/previews/john10.webp",
    tags: ["reference", "seedance-2.0", "john10"],
    upstreamCategory: "VFX",
    workflow: "t2v",
    sourceAuthor: "@johnAGI168",
    sourceUrl: "https://x.com/johnAGI168",
  },
  {
    id: 5,
    slug: "john1",
    title: "Hollywood Professional Racing Movie Style",
    category: "Cinema",
    useCase: "Hollywood Professional Racing Movie Style",
    duration: 15,
    aspectRatio: "16:9",
    videoSrc: "/media/awesome-seedance/videos/john1.mp4",
    posterSrc: "/media/awesome-seedance/previews/john1.webp",
    tags: ["reference", "seedance-2.0", "john1"],
    upstreamCategory: "Cinema",
    workflow: "t2v",
    sourceAuthor: "@johnAGI168",
    sourceUrl: "https://x.com/johnAGI168",
  },
  {
    id: 6,
    slug: "john2",
    title: "Denis Villeneuve Style Epic Desert Scene",
    category: "Cinema",
    useCase: "Denis Villeneuve Style Epic Desert Scene",
    duration: 15,
    aspectRatio: "16:9",
    videoSrc: "/media/awesome-seedance/videos/john2.mp4",
    posterSrc: "/media/awesome-seedance/previews/john2.webp",
    tags: ["reference", "seedance-2.0", "john2"],
    upstreamCategory: "Cinema",
    workflow: "t2v",
    sourceAuthor: "@johnAGI168",
    sourceUrl: "https://x.com/johnAGI168",
  },
  {
    id: 7,
    slug: "john3",
    title: "Wong Kar-wai Film Style (Rainy Phone Booth Scene)",
    category: "Cinema",
    useCase: "Wong Kar-wai Film Style (Rainy Phone Booth Scene)",
    duration: 15,
    aspectRatio: "16:9",
    videoSrc: "/media/awesome-seedance/videos/john3.mp4",
    posterSrc: "/media/awesome-seedance/previews/john3.webp",
    tags: ["reference", "seedance-2.0", "john3"],
    upstreamCategory: "Cinema",
    workflow: "t2v",
    sourceAuthor: "@johnAGI168",
    sourceUrl: "https://x.com/johnAGI168",
  },
  {
    id: 8,
    slug: "john4",
    title: "Giant Orange Cat Meme Style",
    category: "Social",
    useCase: "Giant Orange Cat Meme Style",
    duration: 15,
    aspectRatio: "16:9",
    videoSrc: "/media/awesome-seedance/videos/john4.mp4",
    posterSrc: "/media/awesome-seedance/previews/john4.webp",
    tags: ["reference", "seedance-2.0", "john4"],
    upstreamCategory: "Social",
    workflow: "t2v",
    sourceAuthor: "@johnAGI168",
    sourceUrl: "https://x.com/johnAGI168",
  },
  {
    id: 9,
    slug: "john5",
    title: "Surrealistic Documentary Style",
    category: "UGC",
    useCase: "Surrealistic Documentary Style",
    duration: 15,
    aspectRatio: "16:9",
    videoSrc: "/media/awesome-seedance/videos/john5.mp4",
    posterSrc: "/media/awesome-seedance/previews/john5.webp",
    tags: ["reference", "seedance-2.0", "john5"],
    upstreamCategory: "UGC",
    workflow: "t2v",
    sourceAuthor: "@johnAGI168",
    sourceUrl: "https://x.com/johnAGI168",
  },
  {
    id: 10,
    slug: "john6",
    title: "Van Gogh Post-Impressionism Style Animation",
    category: "Animation",
    useCase: "Van Gogh Post-Impressionism Style Animation",
    duration: 15,
    aspectRatio: "16:9",
    videoSrc: "/media/awesome-seedance/videos/john6.mp4",
    posterSrc: "/media/awesome-seedance/previews/john6.webp",
    tags: ["reference", "seedance-2.0", "john6"],
    upstreamCategory: "Animation",
    workflow: "t2v",
    sourceAuthor: "@johnAGI168",
    sourceUrl: "https://x.com/johnAGI168",
  },
  {
    id: 11,
    slug: "john7",
    title: "Chinese New Year Gala Style: Zhen Huan & Hu Fei Show",
    category: "Cinema",
    useCase: "Chinese New Year Gala Style: Zhen Huan & Hu Fei Show",
    duration: 15,
    aspectRatio: "16:9",
    videoSrc: "/media/awesome-seedance/videos/john7.mp4",
    posterSrc: "/media/awesome-seedance/previews/john7.webp",
    tags: ["reference", "seedance-2.0", "john7"],
    upstreamCategory: "Cinema",
    workflow: "t2v",
    sourceAuthor: "@johnAGI168",
    sourceUrl: "https://x.com/johnAGI168",
  },
  {
    id: 12,
    slug: "john8",
    title: "Chinese Mini-Drama Style (Rainy Night Emotional Scene)",
    category: "Cinema",
    useCase: "Chinese Mini-Drama Style (Rainy Night Emotional Scene)",
    duration: 15,
    aspectRatio: "16:9",
    videoSrc: "/media/awesome-seedance/videos/john8.mp4",
    posterSrc: "/media/awesome-seedance/previews/john8.webp",
    tags: ["reference", "seedance-2.0", "john8"],
    upstreamCategory: "Cinema",
    workflow: "t2v",
    sourceAuthor: "@johnAGI168",
    sourceUrl: "https://x.com/johnAGI168",
  },
  {
    id: 13,
    slug: "john9",
    title: "Chinese Viral CEO Drama Style (Vertical Format)",
    category: "Cinema",
    useCase: "Chinese Viral CEO Drama Style (Vertical Format)",
    duration: 15,
    aspectRatio: "16:9",
    videoSrc: "/media/awesome-seedance/videos/john9.mp4",
    posterSrc: "/media/awesome-seedance/previews/john9.webp",
    tags: ["reference", "seedance-2.0", "john9"],
    upstreamCategory: "Cinema",
    workflow: "t2v",
    sourceAuthor: "@johnAGI168",
    sourceUrl: "https://x.com/johnAGI168",
  },
  {
    id: 14,
    slug: "lucy-love-ai",
    title: "Figure 1 vs Figure 2 Martial Arts Tournament",
    category: "Animation",
    useCase: "Figure 1 vs Figure 2 Martial Arts Tournament",
    duration: 15,
    aspectRatio: "16:9",
    videoSrc: "/media/awesome-seedance/videos/lucy-love-ai.mp4",
    posterSrc: "/media/awesome-seedance/previews/lucy-love-ai.webp",
    tags: ["reference", "seedance-2.0", "lucy_love_ai"],
    upstreamCategory: "Animation",
    workflow: "t2v",
    sourceAuthor: "@Lucy_love_AI",
    sourceUrl: "https://x.com/Lucy_love_AI",
  },
  {
    id: 15,
    slug: "mollick",
    title: "Otter Mecha Anime Battle (Mech vs. Octopus)",
    category: "Animation",
    useCase: "Otter Mecha Anime Battle (Mech vs. Octopus)",
    duration: 15,
    aspectRatio: "16:9",
    videoSrc: "/media/awesome-seedance/videos/mollick.mp4",
    posterSrc: "/media/awesome-seedance/previews/mollick.webp",
    tags: ["reference", "seedance-2.0", "mollick"],
    upstreamCategory: "Animation",
    workflow: "t2v",
    sourceAuthor: "@emollick",
    sourceUrl: "https://x.com/emollick",
  },
  {
    id: 16,
    slug: "nachos2d",
    title: "Tournament of Power with Famous Anime Characters",
    category: "Animation",
    useCase: "Tournament of Power with Famous Anime Characters",
    duration: 15,
    aspectRatio: "16:9",
    videoSrc: "/media/awesome-seedance/videos/nachos2d.mp4",
    posterSrc: "/media/awesome-seedance/previews/nachos2d.webp",
    tags: ["reference", "seedance-2.0", "nachos2d"],
    upstreamCategory: "Animation",
    workflow: "t2v",
    sourceAuthor: "@NACHOS2D_",
    sourceUrl: "https://x.com/NACHOS2D_",
  },
  {
    id: 17,
    slug: "vicky",
    title: "Perfume MG Animation Style",
    category: "Commercial",
    useCase: "Perfume MG Animation Style",
    duration: 15,
    aspectRatio: "16:9",
    videoSrc: "/media/awesome-seedance/videos/vicky.mp4",
    posterSrc: "/media/awesome-seedance/previews/vicky.webp",
    tags: ["reference", "seedance-2.0", "vicky"],
    upstreamCategory: "Commercial",
    workflow: "t2v",
    sourceAuthor: "@BFAVicky",
    sourceUrl: "https://x.com/BFAVicky",
  },
  {
    id: 18,
    slug: "x-bookmarks-pick-10-must-try-animation-styles",
    title: "X Bookmarks Pick: 10 Must-Try Animation Styles",
    category: "Animation",
    useCase: "X Bookmarks Pick: 10 Must-Try Animation Styles",
    duration: 15,
    aspectRatio: "16:9",
    tags: ["prompt", "seedance-2.0"],
    upstreamCategory: "Animation",
    workflow: "t2v",
    sourceAuthor: "@Framer_X",
    sourceUrl: "https://x.com/Framer_X",
  },
  {
    id: 19,
    slug: "motion-graphics",
    title: "Motion Graphics",
    category: "Animation",
    useCase: "Motion Graphics",
    duration: 15,
    aspectRatio: "16:9",
    tags: ["prompt", "seedance-2.0"],
    upstreamCategory: "Animation",
    workflow: "t2v",
    sourceAuthor: "@BFAVicky",
    sourceUrl: "https://x.com/BFAVicky",
  }
];

/* --------------------------------------------------------------- lookup utils */

const bySlug = new Map(zeroLuDemos.map((demo) => [demo.slug, demo]));

export function getDemoBySlug(slug) {
  return bySlug.get(slug);
}

export function requireDemo(slug) {
  const demo = bySlug.get(slug);
  if (!demo) throw new Error('[zeroLuDemos] unknown demo slug: ' + slug);
  return demo;
}

export function getDemosByCategory(category) {
  if (!category || category === 'All') return zeroLuDemos;
  return zeroLuDemos.filter((demo) => demo.category === category);
}

export function getCategoryCounts() {
  return zeroLuDemos.reduce((acc, demo) => {
    acc[demo.category] = (acc[demo.category] || 0) + 1;
    return acc;
  }, {});
}

export function ratioToNumber(aspectRatio, fallback = 16 / 9) {
  if (!aspectRatio) return fallback;
  const [w, h] = aspectRatio.split(':').map(Number);
  if (!w || !h) return fallback;
  return w / h;
}

export function formatDuration(demo) {
  return demo.duration ? demo.duration + 's' : '—';
}

export async function loadDemoPrompt(slug) {
  const { zeroLuPrompts } = await import('./zeroLuPrompts');
  return zeroLuPrompts[slug];
}
