/**
 * Deterministic typography for the Remotion design layer.
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * Every one of the five frozen upstream templates hardcodes a *system* font
 * stack as a module-level constant:
 *
 *     const FONT = '-apple-system, "Segoe UI", Roboto, sans-serif';
 *
 * That makes the rendered result machine-dependent. The same exported video
 * picks SF Pro on macOS, Segoe UI on Windows and whatever `sans-serif`
 * resolves to on a Linux box without Roboto — and the on-screen preview
 * (Remotion Player, real DOM) and the exported file (in-browser web
 * renderer, canvas) can disagree as well. The upstream files are frozen, so
 * the fix cannot live inside them; it lives here, in a module every adapter
 * can reach.
 *
 * THE FONT
 * --------
 * `public/fonts/personalization-sans-latin.woff2`
 *   Inter 4.001, variable (`wght` 100..900), Latin subset (230 codepoints),
 *   48 432 bytes, sha256
 *   c940764593d0fe5d596be327ca7558855e018039fb78509aa21921fd3644c3e4.
 *
 * Licence: SIL Open Font License 1.1.
 * Copyright 2016 The Inter Project Authors. The full licence text ships next
 * to the binary as `public/fonts/OFL.txt`; the attribution obligation is
 * spelled out in `docs/phase2/handoffs/A10.md` and is surfaced to the product
 * through `DESIGN_FONT_ATTRIBUTION` below (Phase 3 decision D2).
 *
 "PERSONALIZATION SANS" IS A LOCAL ALIAS FOR INTER, NOT A DIFFERENT FONT
 * ---------------------------------------------------------------------
 * The bundled binary IS Inter: its own `name` table reads family "Inter",
 * full name "Inter Regular", version "Version 4.001;git-66647c0bb" and
 * copyright "Copyright 2016 The Inter Project Authors" (followed by the
 * rsms/inter project URL). It was Latin-subset (230 codepoints)
 * and is otherwise unmodified; the font's internal names were not changed.
 *
 * "Personalization Sans" exists only as the CSS `font-family` name in the
 * `@font-face` rule below (`DESIGN_FONT_FAMILY`). It is deliberately not
 * "Inter": the app's own `next/font/google` Inter (`app/layout.js`) already
 * registers a family called "Inter", and a stylesheet that lands later in the
 * cascade would win over ours. The alias cannot collide with anything, so the
 * bundled file is always the face that is actually used.
 *
 * Because the face is Inter, every credit names Inter
 * (`DESIGN_FONT_ATTRIBUTION`) and the licence notice is Inter's. Inter's OFL
 * declares no Reserved Font Name, so neither the subset nor the local alias
 * conflicts with OFL clause 3. `typography.test.ts` reads the binary's
 * `name` table and fails if the attribution and the bundled font disagree.
 *
 * NO NETWORK
 * ----------
 * Phase 3 decision D1 (the strict reading of contract rule C11): the
 * typeface is INLINED as a base64 data URI, so the `@font-face` rule carries
 * the whole font inside the stylesheet itself. A branded render therefore
 * issues ZERO font requests — not even a same-origin one — and can never
 * change its glyphs halfway through an export.
 *
 * The binary still ships as a file under `public/fonts/` so that the OFL
 * licence travels with it and so the asset can be audited; the data URI
 * below is the very same bytes, which the typography test verifies.
 */

import { useEffect, useState } from 'react'
import { useDelayRender } from 'remotion'
import {
  PERSONALIZATION_SANS_DATA_URI,
  PERSONALIZATION_SANS_FONT_BYTES,
} from './fonts/personalizationSansDataUri'

/**
 * The local CSS family alias the bundled Inter face is registered under.
 * Never "Inter" — see the module note. This is NOT the font's name: credits
 * and licence notices use `DESIGN_FONT_UPSTREAM_FAMILY`.
 */
export const DESIGN_FONT_FAMILY = 'Personalization Sans'

/** The bundled font's real family name, as its own `name` table records it. */
export const DESIGN_FONT_UPSTREAM_FAMILY = 'Inter'

/** The bundled font's version, as its own `name` table records it. */
export const DESIGN_FONT_UPSTREAM_VERSION = '4.001'

/** The licence the bundled font is distributed under. */
export const DESIGN_FONT_LICENSE = 'SIL OFL 1.1'

/** The copyright holder named by the font (`name` ID 0) and by `OFL.txt`. */
export const DESIGN_FONT_COPYRIGHT_HOLDER = 'The Inter Project Authors'

/** The font's copyright year (`name` ID 0) and `OFL.txt`'s first line. */
export const DESIGN_FONT_COPYRIGHT_YEAR = '2016'

/** The bundled font file, served from the app's own origin. */
export const DESIGN_FONT_FILE = '/fonts/personalization-sans-latin.woff2'

/**
 * The licence text that travels with the bundled typeface.
 *
 * OFL 1.1 clause 2 requires every copy of the font software to contain the
 * copyright notice and the licence. The file ships at this path next to the
 * binary, so it is present in every deployment.
 */
export const DESIGN_FONT_LICENSE_FILE = '/fonts/OFL.txt'

/**
 * The bundled typeface, INLINED as a base64 data URI (Phase 3 decision D1).
 *
 * The strict reading of contract rule C11: the `@font-face` rule must carry
 * the font itself, so that rendering a branded video issues no font request
 * at all — not even a same-origin one. `public/fonts/` still ships the same
 * bytes as a file (the OFL licence has to travel with the font, and the file
 * is the auditable artefact), but nothing in the render path points at it.
 *
 * The payload is a STATIC module, not a runtime read: this file is imported by
 * every design adapter and therefore by the BROWSER bundle, where a
 * module-scope `readFileSync()` would break `npm run build` (webpack 5 does
 * not polyfill `fs` for the client). It is generated once by
 * `templates/fonts/generate-font-data-uri.mjs`.
 *
 * `templates/__tests__/typography.test.ts` asserts that the data URI really
 * embeds the woff2 file (the decoded bytes match) and that no `http(s)://`
 * font reference survives.
 */
export const DESIGN_FONT_DATA_URI = PERSONALIZATION_SANS_DATA_URI

/** The byte length of the inlined font, for the integrity assertions. */
export const DESIGN_FONT_DATA_URI_BYTES = PERSONALIZATION_SANS_FONT_BYTES

/**
 * Every font file this module depends on.
 *
 * The typography test asserts that each of these exists under
 * `public/fonts/`, so a renamed or deleted asset fails CI instead of
 * silently degrading the export to a system font.
 */
export const DESIGN_FONT_FILES: readonly string[] = [DESIGN_FONT_FILE]

/**
 * The bundled typeface's copyright notice and licence, in the form the
 * product's credits surface shows it (Phase 3 decision D2).
 *
 * The OFL itself does NOT require a visible credit line in the rendered
 * output — the obligation is that the notice and the licence accompany every
 * copy of the font, which `public/fonts/OFL.txt` satisfies. Showing it
 * anyway is a product decision: the designs are rendered with this typeface,
 * so the credit travels with the rendered artefact too.
 */
export const DESIGN_FONT_ATTRIBUTION =
  `Typeface: ${DESIGN_FONT_UPSTREAM_FAMILY} (${DESIGN_FONT_LICENSE}) © ${DESIGN_FONT_COPYRIGHT_YEAR} ${DESIGN_FONT_COPYRIGHT_HOLDER}`

/**
 * One sentence that explains the local family alias, for licence/credits
 * surfaces that show the full notice (not the in-video credit line).
 */
export const DESIGN_FONT_ALIAS_NOTE =
  `"${DESIGN_FONT_FAMILY}" is the local CSS family name under which the bundled ` +
  `${DESIGN_FONT_UPSTREAM_FAMILY} ${DESIGN_FONT_UPSTREAM_VERSION} Latin subset is loaded; ` +
  `it is not a different typeface.`

/**
 * The canonical font stack used by every design.
 *
 * The bundled family is first, so it is the face that is picked on every
 * machine. `Inter` is a courtesy second chance for hosts that also load the
 * app's own `next/font` copy; `ui-sans-serif` and `system-ui` are last-resort
 * system faces; `sans-serif` is the CSS generic family the chain ends in, so
 * text still renders if the bundled file cannot be loaded at all.
 */
export const DESIGN_FONT_STACK = `"${DESIGN_FONT_FAMILY}", Inter, ui-sans-serif, system-ui, sans-serif`

/**
 * The CSS generic families a stack may end in.
 *
 * Used by the typography test to prove that no role can end up without a
 * last-resort family.
 */
export const GENERIC_FONT_FAMILIES: readonly string[] = [
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
  'emoji',
  'fangsong',
]

/**
 * A named design type role.
 *
 * The roles are the vocabulary the design layer uses to talk about
 * typography. They are deliberately few: the five upstreams only ever draw
 * a hero headline, a card title, a wordmark, a button label, a subtitle, a
 * caption and the licence credit line.
 */
export type DesignTypeRole =
  | 'display'
  | 'headline'
  | 'title'
  | 'wordmark'
  | 'label'
  | 'body'
  | 'caption'
  | 'credit'

/** The concrete CSS values behind one type role. */
export interface DesignTypeStyle {
  /** The CSS `font-family` value for the role. */
  fontFamily: string
  /** Font size in px, measured on a 1080 px tall composition. */
  fontSize: number
  /** CSS `font-weight` (numeric). */
  fontWeight: number
  /** Unitless CSS `line-height`. */
  lineHeight: number
  /** CSS `letter-spacing` in px. */
  letterSpacing: number
}

/**
 * The role → style map.
 *
 * The sizes are the upstream's own sizes, normalised onto a 1080 px tall
 * composition so the numbers are comparable across the five designs:
 *
 *   display  130px  BounceInHeadline's headline
 *   headline  81px  EndCard's title (height * 0.075)
 *   title     63px  LowerThirdGlassCard's name (height * 0.058)
 *   wordmark  54px  LogoStrokeDraw's brand text (height * 0.05)
 *   label     37px  EndCard's CTA button (height * 0.034)
 *   body      32px  EndCard's subtitle (height * 0.03)
 *   caption   28px  LowerThirdGlassCard's title line (height * 0.026)
 *   credit    10px  the MIT credit line in `designs/shared.tsx`
 *
 * The frozen upstreams keep their own pixel sizes — the roles document the
 * design system's intent, and only the family is enforced at render time.
 */
export const DESIGN_TYPE_ROLES: Record<DesignTypeRole, DesignTypeStyle> = {
  display: {
    fontFamily: DESIGN_FONT_STACK,
    fontSize: 130,
    fontWeight: 900,
    lineHeight: 1.05,
    letterSpacing: 6,
  },
  headline: {
    fontFamily: DESIGN_FONT_STACK,
    fontSize: 81,
    fontWeight: 900,
    lineHeight: 1.3,
    letterSpacing: 2,
  },
  title: {
    fontFamily: DESIGN_FONT_STACK,
    fontSize: 63,
    fontWeight: 800,
    lineHeight: 1.15,
    letterSpacing: 0.6,
  },
  wordmark: {
    fontFamily: DESIGN_FONT_STACK,
    fontSize: 54,
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: 11.9,
  },
  label: {
    fontFamily: DESIGN_FONT_STACK,
    fontSize: 37,
    fontWeight: 700,
    lineHeight: 1,
    letterSpacing: 1,
  },
  body: {
    fontFamily: DESIGN_FONT_STACK,
    fontSize: 32,
    fontWeight: 400,
    lineHeight: 1.35,
    letterSpacing: 4,
  },
  caption: {
    fontFamily: DESIGN_FONT_STACK,
    fontSize: 28,
    fontWeight: 500,
    lineHeight: 1.3,
    letterSpacing: 1.4,
  },
  credit: {
    fontFamily: DESIGN_FONT_STACK,
    fontSize: 10,
    fontWeight: 500,
    lineHeight: 1.2,
    letterSpacing: 0.2,
  },
}

/** Every declared role, in declaration order. */
export const DESIGN_TYPE_ROLE_IDS = Object.keys(DESIGN_TYPE_ROLES) as DesignTypeRole[]

/** Type guard for a role name that came from outside the module. */
export function isDesignTypeRole(value: unknown): value is DesignTypeRole {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(DESIGN_TYPE_ROLES, value)
}

/** The CSS `font-family` value for one role. */
export function fontFamilyForRole(role: DesignTypeRole): string {
  const style = DESIGN_TYPE_ROLES[role]
  if (!style) {
    throw new Error(`[personalization] Unknown design type role "${String(role)}".`)
  }
  return style.fontFamily
}

/** The full style record for one role. */
export function typeStyleForRole(role: DesignTypeRole): DesignTypeStyle {
  const style = DESIGN_TYPE_ROLES[role]
  if (!style) {
    throw new Error(`[personalization] Unknown design type role "${String(role)}".`)
  }
  return style
}

/**
 * The `@font-face` rule for the bundled typeface.
 *
 * `font-display: block` is deliberate: while the face is still loading the
 * browser paints nothing rather than the fallback glyphs, so a frame can
 * never be captured with a mixture of two typefaces. The render is gated on
 * the load anyway (see `useDesignFonts`).
 *
 * The `unicode-range` is the exact coverage of the bundled subset (230
 * codepoints), copied from the file's own `cmap` table.
 */
export const DESIGN_FONT_FACE_CSS = `@font-face {
  font-family: "${DESIGN_FONT_FAMILY}";
  font-style: normal;
  font-weight: 100 900;
  font-display: block;
  src: url("${DESIGN_FONT_DATA_URI}") format("woff2");
  unicode-range: U+0000, U+0020-007E, U+00A0-00AC, U+00AE-00FF, U+0131,
    U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0300-0301,
    U+0303-0304, U+0308-0309, U+0323, U+2002, U+2009, U+200B, U+2013-2014,
    U+2018-201A, U+201C-201E, U+2022, U+2026, U+2032-2033, U+2039-203A,
    U+2044, U+20AC, U+2122, U+2191, U+2193, U+2212, U+FEFF;
}`

/**
 * The rule that makes the frozen upstreams use the bundled typeface.
 *
 * The upstreams set `font-family` as an *inline* style on their own text
 * elements, and as an SVG presentation attribute on the logo monogram. An
 * inline style can only be overridden from outside by a declaration with
 * `!important`, so that is what this rule uses. The selector is scoped to
 * the design stage (`data-remotion-design`), which `designs/shared.tsx`
 * puts around every upstream, so nothing outside a design is affected.
 */
export const DESIGN_FONT_OVERRIDE_CSS = `[data-remotion-design], [data-remotion-design] * {
  font-family: ${DESIGN_FONT_STACK} !important;
}`

/** The complete stylesheet the design layer needs. */
export function designTypographyCss(): string {
  return `${DESIGN_FONT_FACE_CSS}\n${DESIGN_FONT_OVERRIDE_CSS}`
}

/** The id of the injected `<style>` element, so the injection is idempotent. */
const DESIGN_TYPOGRAPHY_STYLE_ID = 'personalization-design-typography'

/**
 * Declares the bundled typeface and the design font override in the host
 * document.
 *
 * Idempotent: calling it twice does not add a second `<style>` element.
 * Returns false when there is no document (server-side rendering), where
 * there is nothing to inject into.
 */
export function ensureDesignTypographyCss(): boolean {
  if (typeof document === 'undefined' || !document.head) return false
  if (document.getElementById(DESIGN_TYPOGRAPHY_STYLE_ID)) return true

  const style = document.createElement('style')
  style.id = DESIGN_TYPOGRAPHY_STYLE_ID
  style.setAttribute('data-remotion-design-typography', 'true')
  style.appendChild(document.createTextNode(designTypographyCss()))
  document.head.appendChild(style)
  return true
}

/** The weights the design roles use; the bundled face is variable, so one
 *  load covers all of them. */
const DESIGN_FONT_WEIGHTS: readonly number[] = [400, 500, 700, 800, 900]

/** The result of a font load attempt. */
export interface DesignFontLoadResult {
  /** True when the bundled face is available to the document. */
  loaded: boolean
  /** Why the load failed, or null when it succeeded. */
  error: string | null
}

/**
 * Loads the bundled typeface and waits until it is usable.
 *
 * This never touches the network at all. The `@font-face` rule carries the
 * font as a base64 data URI (Phase 3 decision D1), so the browser's font
 * loader resolves the face from the inline payload — there is no request to
 * make, not even a same-origin one. `fetch`, `XMLHttpRequest` and
 * `WebSocket` are never called, and `FontFace.load()` is never called with a
 * URL, so the "no network during a branded render" guarantee holds.
 *
 * A failure is reported, never thrown: the caller keeps rendering with the
 * fallback chain, so a missing file degrades the export instead of
 * producing an empty or half-drawn video.
 */
export async function loadDesignFonts(): Promise<DesignFontLoadResult> {
  ensureDesignTypographyCss()

  if (typeof document === 'undefined' || !document.fonts) {
    return { loaded: false, error: 'no-document-fonts' }
  }

  const family = `"${DESIGN_FONT_FAMILY}"`
  const sample = 'ABCabc123 0123456789'

  try {
    const results = await Promise.all(
      DESIGN_FONT_WEIGHTS.map((weight) =>
        document.fonts.load(`${weight} 16px ${family}`, sample),
      ),
    )
    const loaded = results.some((faces) => Array.isArray(faces) && faces.length > 0)
    if (!loaded) {
      return { loaded: false, error: 'font-face-not-matched' }
    }
    // `document.fonts.ready` settles once no font load is pending, so a
    // second face cannot still be swapping in when the frame is captured.
    await document.fonts.ready
    return { loaded: true, error: null }
  } catch (error) {
    return {
      loaded: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Gates a render on the bundled typeface being ready.
 *
 * Call this from a component that is part of the design (the design stage is
 * the natural place). It opens a Remotion delay handle, loads the bundled
 * face and closes the handle when the load settles. The in-browser web
 * renderer waits for every open handle before it captures a frame, so the
 * exported video can never contain fallback glyphs.
 *
 * If the font cannot be loaded the handle is still closed and the render
 * continues with the fallback chain — a degraded but complete export beats
 * a stalled one.
 */
export function useDesignFonts(): void {
  const { delayRender, continueRender } = useDelayRender()
  const [handle] = useState(() => delayRender('Loading the bundled design font'))

  useEffect(() => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      continueRender(handle)
    }

    loadDesignFonts()
      .then((result) => {
        if (result.loaded) return
        console.warn(
          `[personalization] The bundled design font "${DESIGN_FONT_FAMILY}" could not be loaded ` +
            `(${result.error ?? 'unknown error'}). The designs fall back to the next family in the ` +
            `stack, so the export may differ from the preview.`,
        )
      })
      .catch((error) => {
        console.warn(
          `[personalization] The bundled design font "${DESIGN_FONT_FAMILY}" could not be loaded: ${
            error instanceof Error ? error.message : String(error)
          }. The designs fall back to the next family in the stack.`,
        )
      })
      .then(finish, finish)

    return finish
  }, [handle, continueRender, delayRender])
}

// Declaring the typeface as soon as the module is loaded keeps the first
// painted frame from ever using a fallback face. It is a no-op on the
// server, where there is no document to inject into.
ensureDesignTypographyCss()
