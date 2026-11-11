// @vitest-environment node
/**
 * Regression coverage: repo-1 `_upstream` files are frozen and never edited
 * (contract rule). The Phase 3 F2 star-thickness fix was moved out of
 * `Starfield.tsx` into the `StarfieldWarpDesign` adapter, so this file must
 * remain verbatim upstream.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const REPO_ROOT = process.cwd()
const STARFIELD_PATH = join(
  REPO_ROOT,
  'src/features/personalization/shared/personalization/templates/_upstream/starfield-warp/Starfield.tsx',
)

describe('frozen upstream integrity — starfield-warp', () => {
  it('Starfield.tsx is verbatim upstream (frozen, never edited)', () => {
    const source = readFileSync(STARFIELD_PATH, 'utf-8')
    // Header declares verbatim reproduction
    expect(source).toContain(
      'Upstream code is reproduced verbatim apart from this header comment.',
    )
    // The upstream star-core formula is unchanged: 1 + seededRandom(...) * 2.5
    expect(source).toContain(
      'sizeBase: 1 + seededRandom(i * 7 + 3) * 2.5',
    )
    // No Phase 3 F2 deviation lives here
    expect(source).not.toContain('F2')
    expect(source).not.toContain('3 + seededRandom')
  })
})
