/**
 * Regression guard for the React key collision in the HiggsBolt demo grid
 * (StepChooseVideo). GUIDED_DEMO_VIDEOS concatenates two source libraries —
 * MINIMAX_H3_DEMOS (numeric ids 1-30) and SEEDANCE_25_DEMOS (numeric ids 1-50)
 * — and each demo's numeric `id` is only unique WITHIN its own library. Keying
 * the grid on `demo.id` alone therefore collides the moment the two lists are
 * merged. The dev overlay reported duplicate key `29`: MiniMax's
 * "black-and-gold-perfume-commercial" (id 29) and Seedance's
 * "product-commercial-study-309837" (id 29). Slugs ARE globally unique, so the
 * grid keys on the composite `${demo.id}-${demo.slug}` instead.
 */

import { describe, it, expect } from 'vitest'
import { GUIDED_DEMO_VIDEOS } from '../curatedDemos'
import { MINIMAX_H3_DEMOS } from '@ohb/data/minimaxH3Demos'
import { SEEDANCE_25_DEMOS } from '@ohb/data/seedance25Demos'

describe('GUIDED_DEMO_VIDEOS', () => {
  it('exposes a non-empty catalog with a non-empty slug on every entry', () => {
    expect(GUIDED_DEMO_VIDEOS.length).toBeGreaterThan(0)
    for (const demo of GUIDED_DEMO_VIDEOS) {
      expect(typeof demo.slug).toBe('string')
      expect(demo.slug.trim().length).toBeGreaterThan(0)
    }
  })

  it('produces globally-unique composite keys (id + slug) across all entries', () => {
    // This mirrors the grid key `${demo.id}-${demo.slug}` in StepChooseVideo.
    // It is the regression guard for the duplicate-key bug: if a future edit
    // breaks slug/id uniqueness the dev overlay collision comes back.
    const keys = GUIDED_DEMO_VIDEOS.map((demo) => `${demo.id}-${demo.slug}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('collides on numeric demo.id alone, which is why the grid key is composite', () => {
    // The two source libraries reuse the same small numeric ids, so once
    // concatenated demo.id is no longer unique in the rendered list. This keeps
    // the concrete collision visible so reverting the grid key to `demo.id`
    // regresses the exact bug this file exists to prevent.
    const ids = GUIDED_DEMO_VIDEOS.map((demo) => demo.id)
    expect(new Set(ids).size).toBeLessThan(ids.length)
  })
})

describe('source demo libraries share numeric ids', () => {
  it('documents the root cause: minimax and seedance reuse the same numeric ids', () => {
    // Both libraries number their demos from 1, so their id ranges overlap.
    // A key built from demo.id alone is therefore not globally unique once the
    // libraries are concatenated into GUIDED_DEMO_VIDEOS.
    const minimaxIds = new Set(MINIMAX_H3_DEMOS.map((demo) => demo.id))
    const sharedSeedanceIds = SEEDANCE_25_DEMOS.map((demo) => demo.id).filter((id) => minimaxIds.has(id))
    expect(sharedSeedanceIds.length).toBeGreaterThan(0)
  })
})
