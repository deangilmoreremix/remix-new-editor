#!/usr/bin/env node
/**
 * generate-font-data-uri.mjs — build the static font payload module.
 *
 * WHY THIS EXISTS
 * ---------------
 * The personalization design typography must render with ZERO network
 * requests (contract rule C11, Phase 3 decision D1): a branded render may
 * not fetch a typeface, not even a same-origin one, because the web renderer
 * blocks on the font load inside `delayRender` and a remote/same-origin
 * fetch is invisible to the no-network test.
 *
 * The tempting implementation is `readFileSync()` at module scope inside
 * `templates/typography.ts`. That BREAKS THE APP BUILD: `typography.ts` is
 * imported by every design adapter -> the Remotion composition -> the
 * BROWSER bundle, and webpack 5 does not polyfill `fs`/`path` for the client
 * ("Module not found: Can't resolve 'fs'"). The Phase 3 audit caught exactly
 * that in a half-finished implementation.
 *
 * So the bytes are inlined ONCE into a static TypeScript module
 * (`personalizationSansDataUri.ts`) that is committed to the repo. This
 * generator produces that module; it runs on a developer machine or in CI and
 * is NEVER imported by runtime code.
 *
 * USAGE
 *   node src/features/personalization/shared/personalization/templates/fonts/generate-font-data-uri.mjs
 *   node src/features/personalization/shared/personalization/templates/fonts/generate-font-data-uri.mjs --check
 *
 *   --check  verify the committed module matches the font file; exit 1 if it
 *            is stale (use it as a CI guard).
 *
 * The font binary ALSO ships at `public/fonts/personalization-sans-latin.woff2`
 * together with its licence at `public/fonts/OFL.txt`: the SIL OFL 1.1
 * requires the copyright notice and the licence to accompany every copy of
 * the font, so the file must keep shipping even though the render path does
 * not reference it.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..', '..', '..', '..', '..')

const FONT_FILE = join(REPO_ROOT, 'public', 'fonts', 'personalization-sans-latin.woff2')
const OUT_FILE = join(HERE, 'personalizationSansDataUri.ts')

/** The woff2 magic: 'wOF2'. */
const WOFF2_MAGIC = Buffer.from([0x77, 0x4f, 0x46, 0x32])

if (!existsSync(FONT_FILE)) {
  console.error(`generate-font-data-uri: font not found at ${FONT_FILE}`)
  process.exit(1)
}

const bytes = readFileSync(FONT_FILE)

if (!bytes.subarray(0, 4).equals(WOFF2_MAGIC)) {
  console.error(
    'generate-font-data-uri: the font file does not start with the woff2 magic (wOF2) — ' +
      'refusing to inline a non-woff2 payload.',
  )
  process.exit(1)
}

const dataUri = `data:font/woff2;base64,${bytes.toString('base64')}`

const moduleSource = `/**
 * personalizationSansDataUri.ts — GENERATED FILE, DO NOT EDIT BY HAND.
 *
 * Regenerate with:
 *   node src/features/personalization/shared/personalization/templates/fonts/generate-font-data-uri.mjs
 *
 * The bundled personalization typeface ("Personalization Sans") inlined as a
 * base64 data URI.
 *
 * WHY A GENERATED MODULE AND NOT A RUNTIME READ
 * ---------------------------------------------
 * \`templates/typography.ts\` is imported by every Remotion design adapter and
 * therefore by the BROWSER bundle. A module-scope \`readFileSync()\` there would
 * break \`npm run build\` (webpack 5 does not polyfill \`fs\` for the client), and
 * a \`url("/fonts/…")\` reference would make the branded render issue a
 * same-origin font request inside the zero-network window.
 *
 * The payload is therefore inlined here, once, at authoring time. A branded
 * render issues ZERO font requests.
 *
 * The binary still ships at \`public/fonts/personalization-sans-latin.woff2\`
 * with its licence at \`public/fonts/OFL.txt\` — the SIL OFL 1.1 requires the
 * copyright notice and the licence to accompany every copy of the font.
 *
 * Source: \`public/fonts/personalization-sans-latin.woff2\`
 * Bytes:   ${bytes.length}
 * Licence: SIL Open Font License 1.1 — Copyright 2016 The Inter Project Authors
 */

/** The bundled typeface, inlined as a base64 woff2 data URI. */
export const PERSONALIZATION_SANS_DATA_URI =
  '${dataUri}'

/** The byte length of the inlined font, for integrity assertions. */
export const PERSONALIZATION_SANS_FONT_BYTES = ${bytes.length}
`

if (process.argv.includes('--check')) {
  if (!existsSync(OUT_FILE)) {
    console.error('generate-font-data-uri --check: the generated module is missing')
    process.exit(1)
  }
  const current = readFileSync(OUT_FILE, 'utf8')
  if (!current.includes(dataUri)) {
    console.error(
      'generate-font-data-uri --check: the committed module is STALE — it does not match ' +
        'public/fonts/personalization-sans-latin.woff2. Re-run the generator.',
    )
    process.exit(1)
  }
  console.log(
    `generate-font-data-uri --check: OK (${bytes.length} bytes, ${dataUri.length} chars inlined)`,
  )
  process.exit(0)
}

writeFileSync(OUT_FILE, moduleSource, 'utf8')
console.log(
  `generate-font-data-uri: wrote ${OUT_FILE} (${bytes.length} bytes -> ${dataUri.length} base64 chars)`,
)
