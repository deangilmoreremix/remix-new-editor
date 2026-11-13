/**
 * Typeface attribution ⇄ bundled font ⇄ licence (Phase 3 final review,
 * finding 3).
 *
 * The designs load the bundled face under the local CSS family alias
 * "Personalization Sans" while every credit names "Inter". These tests read
 * the font binary's own `name` table and the shipped `OFL.txt`, and fail if
 * the exported attribution stops describing the font that actually ships:
 *
 *  - the binary is Inter (family, version, copyright from the font itself);
 *  - `DESIGN_FONT_FAMILY` is only an alias and is never used as the credited
 *    typeface name;
 *  - the attribution, the OFL copyright line and the font's copyright agree;
 *  - the licence is OFL 1.1 with no Reserved Font Name that the alias or the
 *    subset could infringe;
 *  - every credit surface carries the attribution and the full notice
 *    carries the licence path and the alias explanation.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { brotliDecompressSync } from 'node:zlib'
import {
  DESIGN_FONT_ALIAS_NOTE,
  DESIGN_FONT_ATTRIBUTION,
  DESIGN_FONT_COPYRIGHT_HOLDER,
  DESIGN_FONT_COPYRIGHT_YEAR,
  DESIGN_FONT_DATA_URI,
  DESIGN_FONT_FAMILY,
  DESIGN_FONT_FILE,
  DESIGN_FONT_LICENSE,
  DESIGN_FONT_LICENSE_FILE,
  DESIGN_FONT_UPSTREAM_FAMILY,
  DESIGN_FONT_UPSTREAM_VERSION,
} from '../typography'
import { getRemotionDesignAttributionLine, getRemotionDesignLicenseNotice } from '../catalog'

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..', '..', '..')
const FONT_BYTES = readFileSync(join(REPO_ROOT, 'public', DESIGN_FONT_FILE))
const OFL_TEXT = readFileSync(join(REPO_ROOT, 'public', DESIGN_FONT_LICENSE_FILE), 'utf8')

/* ----------------------------- WOFF2 name table ---------------------------- */

/** WOFF2 UIntBase128 (WOFF2 spec §4.1). */
function readBase128(buf: Buffer, at: { pos: number }): number {
  let value = 0
  for (let i = 0; i < 5; i++) {
    const byte = buf[at.pos++]
    value = value * 128 + (byte & 0x7f)
    if ((byte & 0x80) === 0) return value
  }
  throw new Error('bad UIntBase128')
}

const NAME_TAG_INDEX = 5 // known-tag index of `name` (WOFF2 spec table 5.1)
const GLYF_TAG_INDEX = 10
const LOCA_TAG_INDEX = 11

/** Returns the platform-3 (Windows, UTF-16BE) name records by name ID. */
function readWoff2Names(woff2: Buffer): Map<number, string> {
  expect(woff2.subarray(0, 4).toString('binary')).toBe('wOF2')
  const numTables = woff2.readUInt16BE(12)
  const totalCompressedSize = woff2.readUInt32BE(20)
  const at = { pos: 48 }
  let offset = 0
  let name: { offset: number; length: number } | null = null
  for (let i = 0; i < numTables; i++) {
    const flags = woff2[at.pos++]
    const tagIndex = flags & 0x3f
    if (tagIndex === 63) at.pos += 4
    const transformVersion = (flags >> 6) & 0x03
    const origLength = readBase128(woff2, at)
    const isGlyfOrLoca = tagIndex === GLYF_TAG_INDEX || tagIndex === LOCA_TAG_INDEX
    const transformed = isGlyfOrLoca ? transformVersion !== 3 : transformVersion !== 0
    const length = transformed ? readBase128(woff2, at) : origLength
    if (tagIndex === NAME_TAG_INDEX) {
      expect(transformed).toBe(false)
      name = { offset, length }
    }
    offset += length
  }
  expect(name).not.toBeNull()
  const tables = brotliDecompressSync(woff2.subarray(at.pos, at.pos + totalCompressedSize))
  const table = tables.subarray(name!.offset, name!.offset + name!.length)

  const count = table.readUInt16BE(2)
  const stringOffset = table.readUInt16BE(4)
  const names = new Map<number, string>()
  for (let i = 0; i < count; i++) {
    const rec = 6 + i * 12
    const platformId = table.readUInt16BE(rec)
    if (platformId !== 3) continue
    const nameId = table.readUInt16BE(rec + 6)
    const len = table.readUInt16BE(rec + 8)
    const off = table.readUInt16BE(rec + 10)
    const raw = Buffer.from(table.subarray(stringOffset + off, stringOffset + off + len))
    names.set(nameId, raw.swap16().toString('utf16le'))
  }
  return names
}

const NAMES = readWoff2Names(FONT_BYTES)

/* ---------------------------------- tests ---------------------------------- */

describe('the bundled typeface is Inter, loaded under a local alias', () => {
  it('the font binary names itself Inter at the declared version', () => {
    expect(NAMES.get(1)).toBe(DESIGN_FONT_UPSTREAM_FAMILY) // family
    expect(NAMES.get(4)).toBe(`${DESIGN_FONT_UPSTREAM_FAMILY} Regular`) // full name
    expect(NAMES.get(5)).toMatch(new RegExp(`^Version ${DESIGN_FONT_UPSTREAM_VERSION.replace('.', '\\.')}\\b`))
  })

  it('"Personalization Sans" is only the CSS alias, never the font\'s own name', () => {
    expect(DESIGN_FONT_FAMILY).toBe('Personalization Sans')
    for (const value of NAMES.values()) expect(value).not.toContain(DESIGN_FONT_FAMILY)
    expect(DESIGN_FONT_ALIAS_NOTE).toContain(DESIGN_FONT_FAMILY)
    expect(DESIGN_FONT_ALIAS_NOTE).toContain(`${DESIGN_FONT_UPSTREAM_FAMILY} ${DESIGN_FONT_UPSTREAM_VERSION}`)
  })

  it('the inlined data URI is the same binary', () => {
    const base64 = DESIGN_FONT_DATA_URI.replace(/^data:font\/woff2;base64,/, '')
    expect(Buffer.from(base64, 'base64').equals(FONT_BYTES)).toBe(true)
  })
})

describe('attribution matches the font and its licence', () => {
  it('the exported attribution is exactly the Inter OFL credit', () => {
    expect(DESIGN_FONT_ATTRIBUTION).toBe(
      'Typeface: Inter (SIL OFL 1.1) © 2016 The Inter Project Authors',
    )
    expect(DESIGN_FONT_ATTRIBUTION).not.toContain(DESIGN_FONT_FAMILY)
  })

  it("the font's copyright, OFL.txt's copyright and the attribution agree", () => {
    const copyright = `Copyright ${DESIGN_FONT_COPYRIGHT_YEAR} ${DESIGN_FONT_COPYRIGHT_HOLDER}`
    expect(NAMES.get(0)).toMatch(new RegExp(`^${copyright}\\b`))
    expect(OFL_TEXT.split('\n')[0]).toMatch(new RegExp(`^${copyright}\\b`))
    expect(DESIGN_FONT_ATTRIBUTION).toContain(`© ${DESIGN_FONT_COPYRIGHT_YEAR} ${DESIGN_FONT_COPYRIGHT_HOLDER}`)
  })

  it('the licence is SIL OFL 1.1 with no Reserved Font Name', () => {
    expect(DESIGN_FONT_LICENSE).toBe('SIL OFL 1.1')
    expect(OFL_TEXT).toContain('This Font Software is licensed under the SIL Open Font License, Version 1.1.')
    expect(OFL_TEXT).toContain('SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007')
    expect(NAMES.get(14)).toBe('https://openfontlicense.org') // licence URL in the font
    // A Reserved Font Name is declared on the copyright line ("with Reserved
    // Font Name ..."). Inter declares none, so the subset and the local alias
    // are both permitted under OFL clause 3.
    const copyrightBlock = OFL_TEXT.split('This Font Software is licensed')[0]
    expect(copyrightBlock).not.toMatch(/Reserved Font Name/i)
  })

  it('the credits text carries the attribution; the full notice carries the licence and the alias note', () => {
    expect(getRemotionDesignAttributionLine()).toContain(DESIGN_FONT_ATTRIBUTION)
    const notice = getRemotionDesignLicenseNotice()
    expect(notice).toContain('SIL Open Font License 1.1')
    expect(notice).toContain('Copyright 2016 The Inter Project Authors')
    expect(notice).toContain(DESIGN_FONT_LICENSE_FILE)
    expect(notice).toContain(DESIGN_FONT_ALIAS_NOTE)
  })
})
