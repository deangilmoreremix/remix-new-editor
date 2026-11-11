/**
 * Guard for the shared demo category taxonomy.
 *
 * The taxonomy was extracted from AI Viral Studio so the Personalization
 * modal's Demos tab can reuse it. These tests lock down the two properties
 * that matter:
 *
 *  1. It is a well-formed taxonomy — unique ids, non-empty labels, a
 *     catch-all `all` category, and ids that really exist in AI Viral
 *     Studio (no invented categories sneaking in).
 *  2. It is DATA-FREE — ids, labels, descriptions and icon keys only. No
 *     video URLs, poster paths, demo slugs or premium template records may
 *     ever end up in this module, because it is imported by client code and
 *     is meant to describe categories rather than carry content.
 */

import { describe, it, expect } from 'vitest'
import {
  ALL_DEMOS_CATEGORY_ID,
  DEMO_CATEGORIES,
  DEMO_STYLE_CATEGORIES,
  DEMO_SUBCATEGORIES,
  countDemosByCategory,
  filterDemosByCategory,
  getDemoCategory,
  getDemoCategoryIds,
  getDemoSubcategoryIds,
  humanizeTaxonomyId,
  isCategoryActiveForDemo,
  isStyleCategoryId,
  matchesDemoQuery,
} from '../demoCategories'
import type { VideoDemo } from '@ohb/data/types'
import { BUSINESS_NICHES } from '@ohb/shared/personalization/businessNiches'

/** Synthetic demo. The media fields are inert placeholders, not real content. */
function makeDemo(overrides: Partial<VideoDemo> = {}): VideoDemo {
  return {
    id: 1,
    slug: 'fixture-demo',
    title: 'Fixture demo',
    category: 'Commercial',
    rawCategory: 'product commercial',
    useCase: 'A synthetic fixture used by the taxonomy unit tests.',
    duration: 15,
    durationLabel: '15s',
    aspectRatio: '16:9',
    videoSrc: 'about:fixture',
    posterSrc: 'about:fixture',
    prompt: 'A synthetic fixture prompt.',
    studioTab: 'video',
    tags: [],
    sourceRepo: 'fixture',
    ...overrides,
  }
}

describe('DEMO_CATEGORIES', () => {
  it('has unique ids', () => {
    const ids = DEMO_CATEGORIES.map((category) => category.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every category a non-empty label', () => {
    for (const category of DEMO_CATEGORIES) {
      expect(typeof category.label).toBe('string')
      expect(category.label.trim().length).toBeGreaterThan(0)
    }
  })

  it('has unique ids across the business and style taxonomies', () => {
    const business = DEMO_CATEGORIES.map((category) => category.id)
    const style = DEMO_STYLE_CATEGORIES.map((category) => category.id)
    expect(new Set([...business, ...style]).size).toBe(business.length + style.length)
  })

  it('exposes a catch-all "all" category first', () => {
    expect(DEMO_CATEGORIES[0].id).toBe(ALL_DEMOS_CATEGORY_ID)
    expect(ALL_DEMOS_CATEGORY_ID).toBe('all')
    expect(DEMO_CATEGORIES.some((category) => category.id === ALL_DEMOS_CATEGORY_ID)).toBe(true)
  })

  it('uses the real AI Viral Studio niche ids, not invented ones', () => {
    // The set below is the business-niche taxonomy that AI Viral Studio
    // actually ships: `src/data/nicheContent.ts` (labels), `src/data/nicheDemos.ts`
    // (demo assignment) and `src/lib/nicheClassifier.ts` (keywords).
    const realNicheIds = [
      'ecommerce',
      'restaurants-food',
      'real-estate',
      'beauty',
      'wellness-fitness',
      'education',
      'technology',
      'finance',
      'entertainment-media',
      'automotive',
      'travel-hospitality',
      'sports-outdoors',
      'general-business',
      'viral-trending',
    ]
    const ids = DEMO_CATEGORIES.map((category) => category.id).filter((id) => id !== ALL_DEMOS_CATEGORY_ID)
    expect(ids).toEqual(realNicheIds)
  })

  it('uses the real AI Viral Studio style categories', () => {
    // `src/data/types.ts` — the seven canonical landing-page buckets.
    expect(DEMO_STYLE_CATEGORIES.map((category) => category.id)).toEqual([
      'action',
      'animation',
      'cinema',
      'commercial',
      'fashion',
      'social',
      'ugc',
    ])
  })

  it('humanises ids the same way the AI Viral Studio API does', () => {
    expect(humanizeTaxonomyId('restaurants-food')).toBe('Restaurants Food')
    expect(humanizeTaxonomyId('fine-dining')).toBe('Fine Dining')
  })

  it('shares its niche ids with the Find Local Business niche list', () => {
    // `src/shared/personalization/businessNiches.ts` is the Step-1 business
    // search list, locked to the server's NICHE_MAPPINGS. The demo taxonomy
    // uses the same id space, so a typo here must fail loudly. The two
    // deliberate differences are documented in `demoCategories.ts`:
    // `viral-trending` is demo-only, `healthcare-medical` is business-only.
    const demoNicheIds = DEMO_CATEGORIES.map((category) => category.id).filter(
      (id) => id !== ALL_DEMOS_CATEGORY_ID,
    )
    const businessNicheIds = BUSINESS_NICHES.map((niche) => niche.key)

    for (const id of demoNicheIds) {
      if (id === 'viral-trending') continue
      expect(businessNicheIds).toContain(id)
    }
    expect(businessNicheIds).toContain('healthcare-medical')
    expect(demoNicheIds).not.toContain('healthcare-medical')
  })
})

describe('DEMO_SUBCATEGORIES', () => {
  it('mirrors the real sub-niche structure', () => {
    expect(Object.keys(DEMO_SUBCATEGORIES).sort()).toEqual(
      [
        'automotive',
        'beauty',
        'education',
        'entertainment-media',
        'ecommerce',
        'finance',
        'real-estate',
        'restaurants-food',
        'sports-outdoors',
        'technology',
        'travel-hospitality',
        'wellness-fitness',
      ].sort(),
    )
  })

  it('gives every sub-category a non-empty id and label', () => {
    for (const [niche, subcategories] of Object.entries(DEMO_SUBCATEGORIES)) {
      expect(subcategories.length).toBeGreaterThan(0)
      const ids = subcategories.map((sub) => sub.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const sub of subcategories) {
        expect(sub.id.trim().length).toBeGreaterThan(0)
        expect(sub.label.trim().length).toBeGreaterThan(0)
        expect(subcategories.some((entry) => entry.id === sub.id)).toBe(true)
      }
      expect(DEMO_CATEGORIES.some((category) => category.id === niche)).toBe(true)
    }
  })
})

describe('taxonomy is data-free', () => {
  const serialized = JSON.stringify({
    categories: DEMO_CATEGORIES,
    styleCategories: DEMO_STYLE_CATEGORIES,
    subcategories: DEMO_SUBCATEGORIES,
  })

  it('contains no URLs', () => {
    expect(serialized).not.toMatch(/https?:\/\//i)
    expect(serialized).not.toMatch(/www\./i)
  })

  it('contains no media file references or poster paths', () => {
    expect(serialized).not.toMatch(/\.(mp4|webm|mov|m4v|m3u8|svg|jpe?g|png|gif|webp)\b/i)
    expect(serialized).not.toMatch(/\/media\//i)
    expect(serialized).not.toMatch(/blob:/i)
  })

  it('contains no video-content fields', () => {
    for (const key of ['videoSrc', 'posterSrc', 'prompt', 'slug', 'sourceRepo', 'template']) {
      expect(serialized).not.toContain(key)
    }
  })

  it('only carries taxonomy fields', () => {
    for (const category of [...DEMO_CATEGORIES, ...DEMO_STYLE_CATEGORIES]) {
      for (const key of Object.keys(category)) {
        expect(['id', 'label', 'description', 'icon', 'subcategories']).toContain(key)
      }
    }
  })
})

describe('isCategoryActiveForDemo', () => {
  it('always matches the catch-all category', () => {
    expect(isCategoryActiveForDemo(ALL_DEMOS_CATEGORY_ID, makeDemo())).toBe(true)
  })

  it('matches a style category against the demo category field', () => {
    const demo = makeDemo({ category: 'Fashion' })
    expect(isCategoryActiveForDemo('fashion', demo)).toBe(true)
    expect(isCategoryActiveForDemo('animation', demo)).toBe(false)
    expect(isStyleCategoryId('fashion')).toBe(true)
    expect(isStyleCategoryId('ecommerce')).toBe(false)
  })

  it('matches a business niche from the demo metadata', () => {
    const demo = makeDemo({
      title: 'Online store product unboxing',
      useCase: 'Shopify product demo and checkout walkthrough',
      rawCategory: 'product demo',
      category: 'Commercial',
      tags: ['unboxing', 'shopify', 'product video'],
    })
    expect(getDemoCategoryIds(demo)).toContain('ecommerce')
    expect(isCategoryActiveForDemo('ecommerce', demo)).toBe(true)
    expect(isCategoryActiveForDemo('real-estate', demo)).toBe(false)
  })

  it('matches a food demo to the restaurants niche', () => {
    const demo = makeDemo({
      title: 'Gourmet ramen bowl UGC taste test',
      useCase: 'Gourmet ramen noodle tasting reaction',
      rawCategory: 'food',
      category: 'UGC',
      tags: ['food', 'ramen', 'recipe'],
    })
    expect(isCategoryActiveForDemo('restaurants-food', demo)).toBe(true)
  })

  it('falls back to the business category when nothing else matches', () => {
    const demo = makeDemo({
      title: 'Zzz',
      useCase: 'Zzz',
      rawCategory: 'zzz',
      category: 'Cinema',
      tags: ['zzz'],
    })
    expect(getDemoCategoryIds(demo)).toEqual(['general-business'])
    expect(isCategoryActiveForDemo('general-business', demo)).toBe(true)
  })

  it('matches sub-categories of a specific niche through their qualified id', () => {
    const demo = makeDemo({
      title: 'Sneaker product demo',
      useCase: 'Sneaker unboxing and showcase',
      rawCategory: 'product demo',
      category: 'Commercial',
      tags: ['product demo', 'bag', 'accessory', 'fashion'],
    })
    expect(getDemoCategoryIds(demo)[0]).toBe('ecommerce')
    expect(getDemoSubcategoryIds(demo, 'ecommerce')).toContain('fashion')
    expect(isCategoryActiveForDemo('ecommerce/fashion', demo)).toBe(true)
    // A bare "fashion" is the STYLE category, not the sub-category — the two
    // taxonomies share the word, so sub-categories must be qualified.
    expect(isCategoryActiveForDemo('fashion', demo)).toBe(false)
  })

  it('rejects an unknown category', () => {
    expect(isCategoryActiveForDemo('not-a-real-category', makeDemo())).toBe(false)
    expect(isCategoryActiveForDemo('', makeDemo())).toBe(false)
  })
})

describe('gallery helpers', () => {
  const demos = [
    makeDemo({ id: 1, slug: 'a', title: 'Perfume ad', tags: ['luxury', 'perfume'], category: 'Commercial' }),
    makeDemo({ id: 2, slug: 'b', title: 'Ramen vlog', tags: ['food', 'ramen'], category: 'UGC' }),
    makeDemo({ id: 3, slug: 'c', title: 'Car reveal', tags: ['car', 'vehicle'], category: 'Cinema' }),
  ]

  it('counts every category', () => {
    const counts = countDemosByCategory(demos)
    expect(counts[ALL_DEMOS_CATEGORY_ID]).toBe(3)
    expect(counts.commercial).toBe(1)
    expect(counts.ugc).toBe(1)
  })

  it('counts sub-categories under their qualified id', () => {
    const counts = countDemosByCategory([
      makeDemo({ title: 'Sneaker product demo', tags: ['product demo', 'bag', 'fashion'] }),
    ])
    expect(counts['ecommerce/fashion']).toBe(1)
  })

  it('filters demos by category', () => {
    expect(filterDemosByCategory(demos, ALL_DEMOS_CATEGORY_ID)).toHaveLength(3)
    expect(filterDemosByCategory(demos, 'automotive').map((demo) => demo.slug)).toEqual(['c'])
  })

  it('searches title, use case, prompt and tags', () => {
    expect(matchesDemoQuery(demos[0], 'perfume')).toBe(true)
    expect(matchesDemoQuery(demos[0], 'nothing-here')).toBe(false)
    expect(matchesDemoQuery(demos[0], '  ')).toBe(true)
  })

  it('looks a category up by id', () => {
    expect(getDemoCategory('ecommerce')?.label).toBe('Ecommerce & Products')
    expect(getDemoCategory('commercial')?.label).toBe('Commercial')
    expect(getDemoCategory('nope')).toBeUndefined()
  })
})
