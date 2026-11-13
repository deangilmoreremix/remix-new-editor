import { describe, it, expect } from 'vitest'
import {
  aspectClass, compositionZones, familyFromSrc, fitSourceToComposition, mapZoneToComposition,
  namesThirdPartyBrand, profileForSource, rightsNeedConfirmation, THIRD_PARTY_BRAND_MARKERS,
  VERIFIED_SOURCE_PROFILES,
} from '../sourceProfile'

const PERFUME = '/media/minimax-h3/videos/luxury-perfume-commercial.webm'

describe('source profile', () => {
  it('derives the demo family from the media path', () => {
    expect(familyFromSrc(PERFUME)).toBe('minimax-h3')
    expect(familyFromSrc('/media/promptfeed/videos/x.mp4')).toBe('promptfeed')
    expect(familyFromSrc('/media/seedance-25/videos/x.webm')).toBe('seedance-25')
    expect(familyFromSrc('https://cdn.example.com/x.mp4')).toBe('unknown')
  })

  it('has verified subject and baked-in regions only for clips that were actually inspected', () => {
    const p = profileForSource({ videoSrc: PERFUME, width: 1280, height: 720 })
    expect(p.zonesVerified).toBe(true)
    expect(p.verifiedBy).toBe('manual-review')
    expect(p.baked.status).toBe('known')
    expect(p.baked.regions[0].label).toMatch(/Hailuo/)
    const other = profileForSource({ videoSrc: '/media/seedance-25/videos/anything.webm', width: 1280, height: 720 })
    expect(other.zonesVerified).toBe(false) // nothing is inferred
    expect(other.zones).toEqual([])
    expect(other.baked.status).toBe('unknown')
    expect(other.verifiedBy).toBeNull()
  })

  it('every verified table entry is a well-formed in-frame rectangle', () => {
    for (const [src, v] of Object.entries(VERIFIED_SOURCE_PROFILES)) {
      expect(familyFromSrc(src), src).not.toBe('unknown')
      for (const z of [...v.zones, ...v.baked]) {
        expect(z.w).toBeGreaterThan(0); expect(z.h).toBeGreaterThan(0)
        expect(z.x + z.w).toBeLessThanOrEqual(1.0001); expect(z.y + z.h).toBeLessThanOrEqual(1.0001)
      }
    }
  })

  it('registry demo clips are verified-owned (owner confirmation); everything else is never treated as authorized', () => {
    expect(profileForSource({ videoSrc: PERFUME }).rights).toBe('verified-owned')
    // even clips that mention a brand: the owner confirmed all 123 registry clips
    expect(profileForSource({ videoSrc: '/media/promptfeed/videos/2082_tresemm-luxury-haircare-commercial.mp4' }).rights).toBe('verified-owned')
    expect(profileForSource({ videoSrc: '/media/seedance-1/videos/muji-brand-promotional-video.mp4' }).rights).toBe('verified-owned')
    expect(profileForSource({ videoSrc: PERFUME }).rightsNote).toMatch(/owner/i)
    // anything outside the registry stays unverified; a third-party brand stays a reference clip
    expect(profileForSource({ videoSrc: 'blob:http://localhost/upload' }).rights).toBe('unverified')
    expect(profileForSource({ videoSrc: 'https://cdn.example.com/x.mp4' }).rights).toBe('unverified')
    expect(profileForSource({ videoSrc: 'https://cdn.example.com/kitkat-ad.mp4' }).rights).toBe('third-party-reference')
    expect(namesThirdPartyBrand('Muji Brand Promotional Video')).toBe(true)
    expect(rightsNeedConfirmation({ rights: 'unverified' })).toBe(true)
    expect(rightsNeedConfirmation({ rights: 'third-party-reference' })).toBe(true)
    expect(rightsNeedConfirmation({ rights: 'verified-owned' })).toBe(false)
    expect(rightsNeedConfirmation({ rights: 'licensed' })).toBe(false)
    expect(THIRD_PARTY_BRAND_MARKERS.length).toBeGreaterThan(0)
  })

  it('classifies real catalog sizes without assuming a standard ratio', () => {
    expect(aspectClass(1280, 720)).toBe('landscape-16:9')
    expect(aspectClass(720, 1280)).toBe('portrait-9:16')
    expect(aspectClass(1080, 1920)).toBe('portrait-9:16')
    expect(aspectClass(960, 720)).toBe('landscape-other')
    expect(aspectClass(1698, 720)).toBe('landscape-other')
    expect(aspectClass(834, 1112)).toBe('portrait-other')
    expect(aspectClass(720, 960)).toBe('portrait-other')
    expect(aspectClass(1080, 1080)).toBe('square')
    expect(aspectClass(null, null)).toBe('unknown')
  })

  it('fits a 16:9 source into portrait, square and 4:5 shapes by letterboxing (no stretching)', () => {
    const a = 1280 / 720
    const portrait = fitSourceToComposition(a, 1080, 1920)
    expect(portrait.letterboxed).toBe(true)
    expect(portrait.visible.w).toBe(1)
    expect(portrait.visible.h).toBeCloseTo((9 / 16) / (16 / 9), 4)
    expect(portrait.visible.y).toBeCloseTo((1 - portrait.visible.h) / 2, 6)
    const square = fitSourceToComposition(a, 1080, 1080)
    expect(square.visible.h).toBeCloseTo(9 / 16, 4)
    // the picture's own proportions are preserved: visible px aspect == source aspect
    const px = (f: ReturnType<typeof fitSourceToComposition>, w: number, h: number) => (f.visible.w * w) / (f.visible.h * h)
    expect(px(portrait, 1080, 1920)).toBeCloseTo(a, 3)
    expect(px(square, 1080, 1080)).toBeCloseTo(a, 3)
    expect(px(fitSourceToComposition(a, 1080, 1350), 1080, 1350)).toBeCloseTo(a, 3)
    // a vertical source in a landscape frame is pillarboxed
    const pillar = fitSourceToComposition(9 / 16, 1920, 1080)
    expect(pillar.visible.h).toBe(1)
    expect(pillar.visible.w).toBeCloseTo((9 / 16) / (16 / 9), 4)
    // same shape: no bars
    expect(fitSourceToComposition(a, 1920, 1080).letterboxed).toBe(false)
    // unknown size: full frame, never invented
    expect(fitSourceToComposition(null, 1080, 1920).visible).toEqual({ x: 0, y: 0, w: 1, h: 1 })
  })

  it('cover policy reports how much of the picture is cropped', () => {
    expect(fitSourceToComposition(16 / 9, 1080, 1920, 'cover').cropLoss).toBeGreaterThan(0.6)
    expect(fitSourceToComposition(16 / 9, 1920, 1080, 'cover').cropLoss).toBe(0)
  })

  it('maps source-frame zones into the letterboxed composition', () => {
    const p = profileForSource({ videoSrc: PERFUME, width: 1280, height: 720 })
    const z = compositionZones(p, 1080, 1920)
    const bottle = z.find((r) => r.id === 'perfume-bottle')!
    const fit = fitSourceToComposition(1280 / 720, 1080, 1920)
    // inside the visible picture area, not in the bars
    expect(bottle.y).toBeGreaterThanOrEqual(fit.visible.y - 1e-9)
    expect(bottle.y + bottle.h).toBeLessThanOrEqual(fit.visible.y + fit.visible.h + 1e-9)
    // identity when shapes match
    const same = compositionZones(p, 1920, 1080).find((r) => r.id === 'perfume-bottle')!
    expect(same.x).toBeCloseTo(0.36, 6)
    // baked-in regions are protected too (overlays must not sit on the watermark)
    expect(z.some((r) => r.id === 'minimax-hailuo-mark')).toBe(true)
    // unverified clip => no zones, never guessed
    expect(compositionZones(profileForSource({ videoSrc: '/media/seedance-25/videos/a.webm', width: 720, height: 1280 }), 1080, 1920)).toEqual([])
    expect(mapZoneToComposition({ id: 'a', label: 'a', source: 'user', x: 0.2, y: 0.2, w: 0.2, h: 0.2 }, fitSourceToComposition(null, 1, 1), null, 1).x).toBeCloseTo(0.2, 6)
  })
})
