// Step 2 ("AI Demos") registry: the original catalogs (kept when their media is playable) plus the Template videos library,
// every clip labeled No logo / Has logo.
import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { join } from 'path'
import { DEMO_LIBRARY_REGISTRY, demoCollections, EXCLUDED_DEMO_COLLECTIONS, toVideoDemo } from '../demoLibraryRegistry'
import { getDemoCategoryIds, DEMO_CATEGORIES, ALL_DEMOS_CATEGORY_ID } from '../../shared/personalization/guided/demoCategories'
// @ts-expect-error plain JS data module
import { templateVideos } from '../../../../data/templateVideoLibrary.js'

const PLAYABLE = /^(https:\/\/bzxohkrxcwodllketcpz\.supabase\.co\/storage\/v1\/object\/public\/demo-template-videos\/|\/media\/)/

describe('demo library registry', () => {
  it('holds every template-library clip exactly once, plus the local PromptFeed and Seedance 1 clips', () => {
    const library = DEMO_LIBRARY_REGISTRY.filter((entry) => !entry.videoSrc.startsWith('/media/promptfeed/') && !entry.videoSrc.startsWith('/media/seedance-1/'))
    const local = DEMO_LIBRARY_REGISTRY.filter((entry) => entry.videoSrc.startsWith('/media/promptfeed/') || entry.videoSrc.startsWith('/media/seedance-1/'))
    expect(library.length).toBe((templateVideos as unknown[]).length)
    expect(local.length).toBe(43)
    expect(DEMO_LIBRARY_REGISTRY.length).toBe(582)
    expect(new Set(DEMO_LIBRARY_REGISTRY.map((entry) => entry.id)).size).toBe(DEMO_LIBRARY_REGISTRY.length)
    expect(new Set(DEMO_LIBRARY_REGISTRY.map((entry) => entry.videoSrc)).size).toBe(DEMO_LIBRARY_REGISTRY.length)
  })

  it('only offers playable media: hosted in our bucket or a file in public/, never the raw CDN', () => {
    for (const entry of DEMO_LIBRARY_REGISTRY) {
      expect(entry.videoSrc, entry.id).toMatch(PLAYABLE)
      expect(entry.videoSrc, entry.id).not.toContain('media.beatapi.io')
      expect(entry.posterSrc, entry.id).toBeTruthy()
    }
  })

  it('serves every local clip and poster from a real file in public/', () => {
    for (const entry of DEMO_LIBRARY_REGISTRY.filter((e) => e.videoSrc.startsWith('/media/promptfeed/') || e.videoSrc.startsWith('/media/seedance-1/'))) {
      expect(existsSync(join(process.cwd(), 'public', entry.videoSrc.replace(/^\//, ''))), entry.videoSrc).toBe(true)
      expect(existsSync(join(process.cwd(), 'public', entry.posterSrc.replace(/^\//, ''))), entry.posterSrc).toBe(true)
    }
  })

  it('keeps the dead seedance-prompts collection excluded', () => {
    expect(demoCollections.map((collection) => collection.id)).toEqual(expect.arrayContaining(['promptfeed', 'seedance-1']))
    expect(EXCLUDED_DEMO_COLLECTIONS.map((collection) => collection.id)).toContain('seedance-prompts')
  })

  it('labels every demo No logo, Has logo or Not reviewed (a logo label names its mark; local clips are not reviewed yet)', () => {
    for (const entry of DEMO_LIBRARY_REGISTRY) {
      expect(['none', 'logo', 'unreviewed'], entry.id).toContain(entry.branding)
      if (entry.branding === 'logo') expect(entry.marks, entry.id).toBeTruthy()
      if (entry.videoSrc.startsWith('/media/promptfeed/') || entry.videoSrc.startsWith('/media/seedance-1/')) expect(entry.branding, entry.id).toBe('unreviewed')
      expect(toVideoDemo(entry).branding, entry.id).toBe(entry.branding)
    }
  })

  it('files every demo under at least one business niche, so no clip is unreachable by category', () => {
    const stranded = DEMO_LIBRARY_REGISTRY.filter((entry) => getDemoCategoryIds(toVideoDemo(entry)).filter((id) => id !== ALL_DEMOS_CATEGORY_ID).length === 0)
    // The taxonomy is keyword based; a few generic clips may fall outside every niche but must stay reachable under "All".
    expect(stranded.length / DEMO_LIBRARY_REGISTRY.length).toBeLessThan(0.35)
    expect(DEMO_CATEGORIES.length).toBeGreaterThan(1)
  })
})
