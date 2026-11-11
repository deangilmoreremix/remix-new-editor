/**
 * Demo category taxonomy for the Personalization modal's Demos tab.
 *
 * Extracted from AI Viral Studio's REAL category system so the Demos tab can
 * reuse the same organization instead of inventing a second one. This module
 * is deliberately CONTENT-FREE: it carries ids, labels, short descriptions,
 * icon keys and sub-category structure only. No demo videos, no poster paths,
 * no premium template records, no URLs.
 *
 * Provenance (see `docs/AI_VIRAL_GALLERY_PATTERNS.md` for the full audit):
 *  - Business-niche ids / labels / copy ....... `src/data/nicheContent.ts:12`
 *  - Niche keyword table (12 niches) .......... `src/lib/nicheClassifier.ts:25`
 *  - Sub-niche keyword table (11 groups) ...... `src/lib/nicheClassifier.ts:117`
 *  - Style categories (AI Viral gallery filter)  `src/data/types.ts:10`
 *  - Sidebar category nav + counts ............ `src/apps/go-ai-viral/GoAiViralStudio.tsx:1433`
 *
 * The AI Viral Studio component is NOT modified or moved: this module only
 * *reads* the shared keyword tables that both surfaces now use.
 *
 * Relationship to `src/shared/personalization/businessNiches.ts`
 * ------------------------------------------------------------------
 * That module is the **Find Local Business** niche list (Step 1 of the
 * wizard). It carries the OSM/discovery labels and is locked to
 * `NICHE_MAPPINGS` by a sync test. This module is the **demo gallery**
 * taxonomy, so it uses the *demo-facing* labels from the AI Viral Studio
 * landing pages (`src/data/nicheContent.ts`). The two lists share 13 ids and
 * differ deliberately in two places:
 *   - `viral-trending` exists only in the demo/landing taxonomy.
 *   - `healthcare-medical` exists only in the business-discovery taxonomy
 *     (it has no landing content and no demo library group).
 * `__tests__/demoCategories.test.ts` asserts the shared ids stay aligned.
 */

import { NICHE_KEYWORDS, SUB_NICHE_KEYWORDS } from '@ohb/lib/nicheClassifier'
import { DEMO_CATEGORIES as DEMO_STYLE_CATEGORY_IDS } from '@ohb/data/types'
import type { VideoDemo } from '@ohb/data/types'

/** Id of the catch-all category. Every eligible demo belongs to it. */
export const ALL_DEMOS_CATEGORY_ID = 'all'

/** A sub-category of a business niche (e.g. `ecommerce` → `tech-products`). */
export interface DemoSubcategory {
  id: string
  label: string
}

/** One entry of the demo category taxonomy. */
export interface DemoCategory {
  /** Stable machine id. `all` for the catch-all; niche ids otherwise. */
  id: string
  /** Human label shown in the tab bar. */
  label: string
  /** One-line description of what the category covers. */
  description?: string
  /** Lucide icon key. Resolved to a component by the gallery primitives. */
  icon?: string
  /** Sub-categories, mirroring the real AI Viral sub-niche structure. */
  subcategories?: DemoSubcategory[]
}

/**
 * The ordered category taxonomy.
 *
 * Order mirrors the AI Viral Studio landing order (`src/data/nicheContent.ts`)
 * with the catch-all first, so the Demos tab reads exactly like the studio's
 * own navigation. Labels and descriptions are the real user-facing strings.
 */
export const DEMO_CATEGORIES: readonly DemoCategory[] = [
  {
    id: ALL_DEMOS_CATEGORY_ID,
    label: 'All Demos',
    description: 'Every eligible GO AI demo video, unfiltered.',
    icon: 'layout-grid',
  },
  {
    id: 'ecommerce',
    label: 'Ecommerce & Products',
    description: 'Turn One Product Into an Entire Video Campaign',
    icon: 'shopping-bag',
  },
  {
    id: 'restaurants-food',
    label: 'Restaurants & Food',
    description: 'Create Food Videos That Stop the Scroll',
    icon: 'utensils',
  },
  {
    id: 'real-estate',
    label: 'Real Estate',
    description: 'Turn Properties Into Videos Buyers Want to Explore',
    icon: 'home',
  },
  {
    id: 'beauty',
    label: 'Beauty, Skincare & Fashion',
    description: 'Create Beauty Content That Looks Ready for a Campaign',
    icon: 'sparkles',
  },
  {
    id: 'wellness-fitness',
    label: 'Fitness, Wellness & Coaching',
    description: 'Turn Your Ideas Into Fitness Content People Want to Follow',
    icon: 'heart-pulse',
  },
  {
    id: 'education',
    label: 'Education & Training',
    description: 'Turn What You Know Into Videos People Actually Want to Watch',
    icon: 'graduation-cap',
  },
  {
    id: 'technology',
    label: 'Technology, SaaS & Apps',
    description: 'Show People What Your Product Does — Without a Complicated Production',
    icon: 'cpu',
  },
  {
    id: 'finance',
    label: 'Finance & Professional Services',
    description: 'Turn Expertise Into Professional Video Content',
    icon: 'line-chart',
  },
  {
    id: 'entertainment-media',
    label: 'Entertainment, Media & Creators',
    description: 'Create the Kind of Video People Stop to Watch',
    icon: 'clapperboard',
  },
  {
    id: 'automotive',
    label: 'Automotive',
    description: 'Turn Any Vehicle Into a Scroll-Stopping Showcase',
    icon: 'car',
  },
  {
    id: 'travel-hospitality',
    label: 'Travel, Hotels & Hospitality',
    description: 'Turn Destinations Into Videos That Make People Want to Go',
    icon: 'plane',
  },
  {
    id: 'sports-outdoors',
    label: 'Sports & Outdoors',
    description: 'Turn the Energy of the Moment Into Video',
    icon: 'trophy',
  },
  {
    id: 'general-business',
    label: 'Business & More',
    description: 'See an Idea. Make It Yours. Create the Video.',
    icon: 'briefcase',
  },
  {
    id: 'viral-trending',
    label: 'Viral & Trending',
    description: 'See What’s Possible. Remix the Style. Make It Yours.',
    icon: 'trending-up',
  },
] as const

/**
 * The real AI Viral *style* categories — the seven canonical landing-page
 * buckets every `VideoDemo` carries in its `category` field
 * (`src/data/types.ts:10`). AI Viral Studio's own gallery filters on exactly
 * these (`components/landing/AIVideoGallery.tsx:37`), so the Demos tab can
 * offer them as a secondary "Style" filter.
 */
export const DEMO_STYLE_CATEGORIES: readonly DemoCategory[] = DEMO_STYLE_CATEGORY_IDS.map((id) => ({
  id: id.toLowerCase(),
  label: id,
  description: `${id} style demos.`,
}))

/**
 * Sub-category structure, derived from the real sub-niche keyword table.
 * `nicheClassifier.ts` owns the keywords; this module only exposes the
 * human-readable structure.
 */
export const DEMO_SUBCATEGORIES: Readonly<Record<string, readonly DemoSubcategory[]>> = Object.fromEntries(
  Object.entries(SUB_NICHE_KEYWORDS).map(([niche, subMap]) => [
    niche,
    Object.keys(subMap).map((id) => ({ id, label: humanizeTaxonomyId(id) })),
  ]),
)

/**
 * Humanise a machine id exactly the way the AI Viral Studio API does
 * (`app/api/go-ai-viral/prompts/route.ts:183`): hyphens become spaces and
 * every word is capitalised.
 */
export function humanizeTaxonomyId(id: string): string {
  return id
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Keyword sets for the two landing-page categories the AI Viral classifier
 * does not keyword-match itself.
 *
 * `general-business` is the classifier's documented fallback niche
 * (`src/lib/nicheClassifier.ts:253`) and also has its own curated demo group
 * in `src/data/nicheDemos.ts`. `viral-trending` exists only in the landing
 * taxonomy (`src/data/nicheContent.ts:170`) and in the demo assignment list.
 * Both term lists are derived from those real sources.
 */
const EXTRA_CATEGORY_KEYWORDS: Record<string, string[]> = {
  'general-business': [
    'business',
    'promo',
    'promotional',
    'promotion',
    'company',
    'corporate',
    'brand',
    'service',
    'client',
    'agency',
    'consulting',
    'office',
    'spokesperson',
    'testimonial',
    'advertisement',
    'campaign',
    'workflow',
  ],
  'viral-trending': [
    'viral',
    'trending',
    'trend',
    'pov',
    'vlog',
    'transformation',
    'mrbeast',
    'reels',
    'tiktok',
    'shorts',
    'seamless',
    'montage',
    'meme',
  ],
}

/** Build a word-boundary regex for a keyword phrase (mirrors `nicheRegex`). */
function keywordRegex(keyword: string): RegExp {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}\\b`, 'i')
}

const NICHE_REGEXES: Record<string, RegExp[]> = Object.fromEntries(
  Object.entries(NICHE_KEYWORDS).map(([niche, keywords]) => [
    niche,
    keywords.map(keywordRegex),
  ]),
)

const EXTRA_CATEGORY_REGEXES: Record<string, RegExp[]> = Object.fromEntries(
  Object.entries(EXTRA_CATEGORY_KEYWORDS).map(([niche, keywords]) => [
    niche,
    keywords.map(keywordRegex),
  ]),
)

const SUB_NICHE_REGEXES: Record<string, Record<string, RegExp[]>> = Object.fromEntries(
  Object.entries(SUB_NICHE_KEYWORDS).map(([niche, subMap]) => [
    niche,
    Object.fromEntries(
      Object.entries(subMap).map(([subNiche, keywords]) => [subNiche, keywords.map(keywordRegex)]),
    ),
  ]),
)

/**
 * The text a demo is classified on.
 *
 * The AI Viral classifier reads a record's title, prompt, tags and categories
 * (`src/lib/nicheClassifier.ts:226`). A `VideoDemo` carries the equivalent
 * descriptive fields: `title`, `useCase` (the short pitch), `tags` and
 * `rawCategory` (the upstream source category). The long generation `prompt`
 * is deliberately excluded — it is instruction text, not metadata, and
 * matching on it would dominate the signal.
 *
 * `demo.category` is NOT part of the text: it is the *style* bucket
 * ("Cinema", "Social", …), a different taxonomy layer. Feeding it into the
 * business-niche classifier would leak style labels into niches (every
 * "Cinema" demo would land in Entertainment).
 */
function demoClassificationText(demo: VideoDemo): string {
  return [demo.title, demo.useCase, demo.rawCategory, ...(demo.tags || [])]
    .filter(Boolean)
    .join(' ')
}

/** Score a text against one niche's keyword regexes (longer match = higher). */
function scoreNiche(text: string, regexes: RegExp[] | undefined): number {
  if (!regexes) return 0
  let score = 0
  for (const regex of regexes) {
    const match = text.match(regex)
    if (match) score += match[0].length
  }
  return score
}

/**
 * The business-niche ids a demo belongs to.
 *
 * Mirrors the AI Viral classifier: every niche with a positive keyword score
 * is a match (the classifier's `businessNiches`), and a demo that matches
 * nothing falls back to `general-business` (the classifier's `primaryNiche`
 * fallback). A demo can therefore appear under more than one category, which
 * is exactly how the AI Viral sidebar counts work.
 */
export function getDemoCategoryIds(demo: VideoDemo): string[] {
  const text = demoClassificationText(demo)
  const scored: Array<{ id: string; score: number }> = []

  for (const [niche, regexes] of Object.entries(NICHE_REGEXES)) {
    const score = scoreNiche(text, regexes)
    if (score > 0) scored.push({ id: niche, score })
  }
  for (const [niche, regexes] of Object.entries(EXTRA_CATEGORY_REGEXES)) {
    const score = scoreNiche(text, regexes)
    if (score > 0) scored.push({ id: niche, score })
  }

  if (scored.length === 0) return ['general-business']

  return scored.sort((a, b) => b.score - a.score).map((entry) => entry.id)
}

/**
 * The sub-category ids a demo belongs to.
 *
 * By default the sub-categories of the demo's strongest (highest scoring)
 * business niche are returned — the same niche the AI Viral classifier treats
 * as `primaryNiche`. Pass `nicheId` to read a specific niche's sub-categories
 * instead.
 */
export function getDemoSubcategoryIds(demo: VideoDemo, nicheId?: string): string[] {
  const primary = nicheId ?? getDemoCategoryIds(demo)[0]
  const subMap = SUB_NICHE_REGEXES[primary]
  if (!subMap) return []

  const text = demoClassificationText(demo)
  const matched: Array<{ id: string; score: number }> = []
  for (const [subNiche, regexes] of Object.entries(subMap)) {
    const score = scoreNiche(text, regexes)
    if (score > 0) matched.push({ id: subNiche, score })
  }
  return matched.sort((a, b) => b.score - a.score).map((entry) => entry.id)
}

/**
 * The id used to address a sub-category.
 *
 * Sub-niche ids are NOT globally unique — `fashion` is both a style category
 * and a sub-category of `ecommerce`, and `gaming` is a sub-category of two
 * different niches. Sub-categories are therefore addressed as
 * `"<niche>/<sub>"` (e.g. `ecommerce/fashion`).
 */
export function getQualifiedSubcategoryId(nicheId: string, subcategoryId: string): string {
  return `${nicheId}/${subcategoryId}`
}

/** True when `categoryId` names one of the seven canonical style categories. */
export function isStyleCategoryId(categoryId: string): boolean {
  const id = categoryId.trim().toLowerCase()
  return DEMO_STYLE_CATEGORY_IDS.some((style) => style.toLowerCase() === id)
}

/**
 * Whether a demo belongs to a category.
 *
 * Supports every id the taxonomy knows:
 *  - `all` — always true.
 *  - a style id (`action`, `animation`, `cinema`, `commercial`, `fashion`,
 *    `social`, `ugc`) — matches the demo's own `category` field exactly.
 *  - a business-niche id — matches the AI Viral keyword classification.
 *  - a qualified sub-category id (`"<niche>/<sub>"`, e.g.
 *    `ecommerce/fashion`) — matches the demo's sub-niche classification.
 */
export function isCategoryActiveForDemo(categoryId: string, demo: VideoDemo): boolean {
  const raw = categoryId.trim()
  if (!raw) return false
  const id = raw.toLowerCase()
  if (id === ALL_DEMOS_CATEGORY_ID) return true

  // Qualified sub-category: "<niche>/<sub>" (e.g. "ecommerce/fashion").
  if (raw.includes('/')) {
    const [niche, sub] = raw.split('/', 2)
    const subcategories = DEMO_SUBCATEGORIES[niche]
    if (!subcategories) return false
    if (!subcategories.some((entry) => entry.id === sub)) return false
    return (
      getDemoCategoryIds(demo).includes(niche) &&
      getDemoSubcategoryIds(demo, niche).includes(sub)
    )
  }

  if (isStyleCategoryId(id)) {
    return (demo.category || '').trim().toLowerCase() === id
  }

  return getDemoCategoryIds(demo).includes(id)
}

/**
 * Count the demos in every known category.
 *
 * Mirrors the AI Viral sidebar, where each category shows the number of
 * records in it (`GoAiViralStudio.tsx:1447`). Counts are not a partition: a
 * demo that matches two niches is counted in both.
 *
 * Keys are category ids. Sub-categories use their qualified id
 * (`"ecommerce/fashion"`) so they never collide with a style category that
 * shares the same bare word.
 */
export function countDemosByCategory(demos: readonly VideoDemo[]): Record<string, number> {
  const counts: Record<string, number> = { [ALL_DEMOS_CATEGORY_ID]: demos.length }
  for (const category of DEMO_CATEGORIES) {
    if (category.id === ALL_DEMOS_CATEGORY_ID) continue
    counts[category.id] = 0
  }
  for (const category of DEMO_STYLE_CATEGORIES) {
    counts[category.id] = 0
  }
  for (const [niche, subcategories] of Object.entries(DEMO_SUBCATEGORIES)) {
    for (const sub of subcategories) {
      counts[getQualifiedSubcategoryId(niche, sub.id)] = 0
    }
  }
  for (const demo of demos) {
    for (const id of getDemoCategoryIds(demo)) {
      if (id in counts) counts[id] += 1
    }
    for (const [niche, subcategories] of Object.entries(DEMO_SUBCATEGORIES)) {
      for (const sub of getDemoSubcategoryIds(demo, niche)) {
        const key = getQualifiedSubcategoryId(niche, sub)
        if (key in counts) counts[key] += 1
      }
    }
    const styleId = (demo.category || '').trim().toLowerCase()
    if (styleId in counts) counts[styleId] += 1
  }
  return counts
}

/** Filter demos down to one category, preserving the input order. */
export function filterDemosByCategory(
  demos: readonly VideoDemo[],
  categoryId: string,
): VideoDemo[] {
  if (!categoryId || categoryId === ALL_DEMOS_CATEGORY_ID) return [...demos]
  return demos.filter((demo) => isCategoryActiveForDemo(categoryId, demo))
}

/**
 * Free-text search over a demo, mirroring the AI Viral feed's search
 * behaviour (`app/api/go-ai-viral/prompts/route.ts:222`): title, prompt text
 * and tags are matched, case-insensitively.
 */
export function matchesDemoQuery(demo: VideoDemo, query: string): boolean {
  const term = query.trim().toLowerCase()
  if (!term) return true
  return (
    (demo.title || '').toLowerCase().includes(term) ||
    (demo.useCase || '').toLowerCase().includes(term) ||
    (demo.prompt || '').toLowerCase().includes(term) ||
    (demo.tags || []).some((tag) => tag.toLowerCase().includes(term))
  )
}

/** Look a category up by id. */
export function getDemoCategory(categoryId: string): DemoCategory | undefined {
  const id = categoryId.trim().toLowerCase()
  return (
    DEMO_CATEGORIES.find((category) => category.id === id) ??
    DEMO_STYLE_CATEGORIES.find((category) => category.id === id)
  )
}
