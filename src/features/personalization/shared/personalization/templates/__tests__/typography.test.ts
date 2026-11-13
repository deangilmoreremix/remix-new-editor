// @vitest-environment jsdom
/**
 * Certification: the design typography is deterministic and self-contained.
 *
 * The five frozen upstream templates hardcode a *system* font stack, which
 * makes an exported video look different on macOS, Windows and Linux and
 * lets the on-screen preview disagree with the export. These tests pin the
 * replacement: a typeface that is bundled with the app, referenced by a
 * stable family name, with a fallback chain that ends in a CSS generic
 * family, and with no remote URL anywhere in the module.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import {
  DESIGN_FONT_ALIAS_NOTE,
  DESIGN_FONT_ATTRIBUTION,
  DESIGN_FONT_DATA_URI,
  DESIGN_FONT_FACE_CSS,
  DESIGN_FONT_FAMILY,
  DESIGN_FONT_FILE,
  DESIGN_FONT_FILES,
  DESIGN_FONT_LICENSE_FILE,
  DESIGN_FONT_OVERRIDE_CSS,
  DESIGN_FONT_STACK,
  DESIGN_TYPE_ROLE_IDS,
  DESIGN_TYPE_ROLES,
  GENERIC_FONT_FAMILIES,
  designTypographyCss,
  fontFamilyForRole,
  isDesignTypeRole,
  typeStyleForRole,
} from '../typography'
import {
  DESIGN_BODY_FONT_STACK,
  DESIGN_DISPLAY_FONT_STACK,
  DESIGN_FONT_STACKS,
} from '../designs/fonts'

const REPO_ROOT = process.cwd()
const TYPOGRAPHY_SOURCE_PATH = join(
  REPO_ROOT,
  'src/features/personalization/shared/personalization/templates/typography.ts',
)
const DESIGN_FONTS_SOURCE_PATH = join(
  REPO_ROOT,
  'src/features/personalization/shared/personalization/templates/designs/fonts.ts',
)

/** Splits a CSS font stack into its individual families. */
function stackFamilies(stack: string): string[] {
  return stack
    .split(',')
    .map((entry) => entry.trim().replace(/^["']|["']$/g, ''))
    .filter((entry) => entry.length > 0)
}

describe('design typography is deterministic', () => {
  it('resolves every type role to a non-empty CSS font-family string', () => {
    expect(DESIGN_TYPE_ROLE_IDS.length).toBeGreaterThan(0)

    for (const role of DESIGN_TYPE_ROLE_IDS) {
      const family = fontFamilyForRole(role)
      expect(typeof family).toBe('string')
      expect(family.trim().length).toBeGreaterThan(0)
      expect(family).toBe(DESIGN_TYPE_ROLES[role].fontFamily)

      const style = typeStyleForRole(role)
      expect(style.fontFamily).toBe(family)
      expect(style.fontSize).toBeGreaterThan(0)
      expect(style.fontWeight).toBeGreaterThan(0)
      expect(style.lineHeight).toBeGreaterThan(0)
    }
  })

  it('ends every role stack in a generic fallback family', () => {
    for (const role of DESIGN_TYPE_ROLE_IDS) {
      const families = stackFamilies(fontFamilyForRole(role))
      expect(families.length).toBeGreaterThan(1)

      const last = families[families.length - 1]
      expect(GENERIC_FONT_FAMILIES.map((generic) => generic.toLowerCase())).toContain(
        last.toLowerCase(),
      )
      // The chain must end on the generic family, not merely contain one.
      expect(last.toLowerCase()).toBe('sans-serif')
    }
  })

  it('puts the bundled family first so it is the face that is actually used', () => {
    for (const role of DESIGN_TYPE_ROLE_IDS) {
      const families = stackFamilies(fontFamilyForRole(role))
      expect(families[0]).toBe(DESIGN_FONT_FAMILY)
    }
    expect(stackFamilies(DESIGN_FONT_STACK)[0]).toBe(DESIGN_FONT_FAMILY)
  })

  it('never names the family "Inter", which the app already registers', () => {
    // `app/layout.js` loads Inter through `next/font/local`, which declares
    // a family called "Inter". A stylesheet that lands later in the cascade
    // would win over ours, so the bundled copy needs its own name.
    expect(DESIGN_FONT_FAMILY.toLowerCase()).not.toBe('inter')
  })
})

describe('the role map is total', () => {
  it('gives every declared role a value', () => {
    for (const role of DESIGN_TYPE_ROLE_IDS) {
      expect(DESIGN_TYPE_ROLES[role]).toBeDefined()
      expect(DESIGN_TYPE_ROLES[role].fontFamily.trim().length).toBeGreaterThan(0)
    }
  })

  it('declares no role that the map does not answer', () => {
    const declared = Object.keys(DESIGN_TYPE_ROLES).sort()
    const listed = [...DESIGN_TYPE_ROLE_IDS].sort()
    expect(listed).toEqual(declared)
  })

  it('rejects an unknown role instead of returning an empty stack', () => {
    expect(isDesignTypeRole('display')).toBe(true)
    expect(isDesignTypeRole('nope')).toBe(false)
    expect(() => fontFamilyForRole('nope' as never)).toThrow()
    expect(() => typeStyleForRole('nope' as never)).toThrow()
  })
})

describe('the typography modules reference no remote font', () => {
  const sources = [
    { label: 'templates/typography.ts', path: TYPOGRAPHY_SOURCE_PATH },
    { label: 'templates/designs/fonts.ts', path: DESIGN_FONTS_SOURCE_PATH },
  ]

  it('contains no http:// or https:// reference at all', () => {
    for (const source of sources) {
      const code = readFileSync(source.path, 'utf-8')
      expect(code, source.label).not.toMatch(/https?:\/\//)
    }
  })

  it('does not name a font CDN', () => {
    for (const source of sources) {
      const code = readFileSync(source.path, 'utf-8')
      expect(code, source.label).not.toMatch(/fonts\.googleapis\.com/i)
      expect(code, source.label).not.toMatch(/fonts\.gstatic\.com/i)
      expect(code, source.label).not.toMatch(/cdn\./i)
    }
  })

  it('emits a stylesheet whose font source is the inline data URI, not a path', () => {
    const css = designTypographyCss()
    expect(css).not.toMatch(/https?:\/\//)
    // Phase 3 decision D1 (the strict reading of contract rule C11): the
    // stylesheet must CARRY the font, so a branded render issues no font
    // request at all — not even a same-origin one.
    expect(css).toContain('data:font/woff2;base64,')
    // The old same-origin path must not survive as a fallback source.
    expect(css).not.toContain(`url("${DESIGN_FONT_FILE}")`)
  })
})

describe('the bundled font asset', () => {
  it('references only same-origin files under public/fonts/', () => {
    expect(DESIGN_FONT_FILES.length).toBeGreaterThan(0)
    for (const file of DESIGN_FONT_FILES) {
      expect(file.startsWith('/')).toBe(true)
      expect(file).not.toMatch(/https?:\/\//)
      expect(file).not.toMatch(/\.\./)
    }
  })

  it('ships every referenced file under public/fonts/', () => {
    for (const file of DESIGN_FONT_FILES) {
      const relative = file.replace(/^\/+/, '')
      const absolute = join(REPO_ROOT, 'public', relative)
      expect(existsSync(absolute), `missing font asset: ${relative}`).toBe(true)
      expect(statSync(absolute).size).toBeGreaterThan(0)
    }
  })

  it('ships the licence next to the font', () => {
    expect(existsSync(join(REPO_ROOT, 'public/fonts/OFL.txt'))).toBe(true)
  })

  it('is the file the stylesheet points at', () => {
    // Phase 3 decision D1 changed what this means: the stylesheet no longer
    // points at the file, it CARRIES the font. The file still ships (the OFL
    // notice must accompany every copy of the font), but the render path does
    // not reference it.
    expect(DESIGN_FONT_FACE_CSS).toContain(`font-family: "${DESIGN_FONT_FAMILY}"`)
    expect(DESIGN_FONT_FACE_CSS).toContain('data:font/woff2;base64,')
    expect(DESIGN_FONT_FACE_CSS).not.toContain(DESIGN_FONT_FILE)
  })
})

describe('the inlined font payload (Phase 3 decision D1)', () => {
  const GENERATED_MODULE_PATH = join(
    REPO_ROOT,
    'src/features/personalization/shared/personalization/templates/fonts/personalizationSansDataUri.ts',
  )
  const GENERATOR_PATH = join(
    REPO_ROOT,
    'src/features/personalization/shared/personalization/templates/fonts/generate-font-data-uri.mjs',
  )
  const FONT_PATH = join(REPO_ROOT, 'public/fonts/personalization-sans-latin.woff2')

  it('is a static module, so the browser bundle never imports a node builtin', () => {
    // The build breaker: `typography.ts` is imported by every design adapter
    // and therefore by the browser bundle. A module-scope `readFileSync()`
    // there fails `npm run build` with "Can't resolve 'fs'". Only actual
    // import/require statements matter — a doc-comment MENTION of the word
    // (this module explains its own history) is not a dependency.
    const typographySource = readFileSync(TYPOGRAPHY_SOURCE_PATH, 'utf-8')
    expect(typographySource).not.toMatch(/from\s+['"](fs|path|node:fs|node:path)['"]/)
    expect(typographySource).not.toMatch(/require\(\s*['"](fs|path)['"]\s*\)/)
  })

  it('imports the generated payload instead of reading the file at runtime', () => {
    const typographySource = readFileSync(TYPOGRAPHY_SOURCE_PATH, 'utf-8')
    expect(typographySource).toContain("./fonts/personalizationSansDataUri")
  })

  it('never imports the generator from runtime code', () => {
    expect(existsSync(GENERATOR_PATH)).toBe(true)
    const typographySource = readFileSync(TYPOGRAPHY_SOURCE_PATH, 'utf-8')
    // The generator runs on a developer machine only; a doc-comment mention of
    // its name is fine, an import statement is not. Line-bounded so the match
    // cannot bridge a real import statement into a later comment line.
    expect(typographySource).not.toMatch(/import[^\n]*generate-font-data-uri/)
    expect(typographySource).not.toMatch(/require\([^)\n]*generate-font-data-uri/)
  })

  it('decodes to exactly the bytes of the shipped font file', () => {
    const fontBytes = readFileSync(FONT_PATH)
    const base64 = DESIGN_FONT_DATA_URI.replace(/^data:font\/woff2;base64,/, '')
    const decoded = Buffer.from(base64, 'base64')
    expect(decoded.length).toBe(fontBytes.length)
    expect(decoded.equals(fontBytes)).toBe(true)
    // The woff2 magic.
    expect(decoded.subarray(0, 4).toString('binary')).toBe('wOF2')
  })

  it('is in sync with the committed generated module', () => {
    // The generated module is committed; if the font file changes without
    // regenerating it, the payload would be stale.
    const generated = readFileSync(GENERATED_MODULE_PATH, 'utf-8')
    expect(generated).toContain(DESIGN_FONT_DATA_URI)
  })

  it('exposes the licence attribution the credit line must carry (D2)', () => {
    expect(DESIGN_FONT_ATTRIBUTION).toContain('SIL OFL 1.1')
    expect(DESIGN_FONT_ATTRIBUTION).toContain('The Inter Project Authors')
    // The credit names the real typeface (Inter); the local alias is explained
    // on the full licence notice (see fontAttribution.test.ts).
    expect(DESIGN_FONT_ATTRIBUTION).toContain('Typeface: Inter')
    expect(DESIGN_FONT_ALIAS_NOTE).toContain('Personalization Sans')
    expect(DESIGN_FONT_ALIAS_NOTE).toContain('Inter 4.001')
    expect(DESIGN_FONT_LICENSE_FILE).toBe('/fonts/OFL.txt')
  })
})

describe('the stylesheet overrides the frozen upstreams', () => {
  it('overrides the font-family with !important, because the upstreams set it inline', () => {
    // The upstream templates set `fontFamily` as an inline style on their own
    // text elements. Only a declaration with `!important` can beat an inline
    // style from outside, so this must not be "optimised" away.
    expect(DESIGN_FONT_OVERRIDE_CSS).toContain('!important')
    expect(DESIGN_FONT_OVERRIDE_CSS).toContain('[data-remotion-design]')
    expect(DESIGN_FONT_OVERRIDE_CSS).toContain(DESIGN_FONT_STACK)
  })

  it('declares the face with a variable weight range and a blocking display', () => {
    expect(DESIGN_FONT_FACE_CSS).toContain('font-weight: 100 900')
    expect(DESIGN_FONT_FACE_CSS).toContain('font-display: block')
    expect(DESIGN_FONT_FACE_CSS).toContain('format("woff2")')
  })
})

describe('the design layer exposes the same stacks', () => {
  it('re-exports the canonical stack', () => {
    expect(DESIGN_BODY_FONT_STACK).toBe(DESIGN_FONT_STACK)
    expect(DESIGN_DISPLAY_FONT_STACK).toBe(DESIGN_FONT_STACK)
  })

  it('gives every role a stack', () => {
    for (const role of DESIGN_TYPE_ROLE_IDS) {
      expect(DESIGN_FONT_STACKS[role]).toBe(DESIGN_TYPE_ROLES[role].fontFamily)
      expect(stackFamilies(DESIGN_FONT_STACKS[role]).slice(-1)[0].toLowerCase()).toBe(
        'sans-serif',
      )
    }
  })
})
