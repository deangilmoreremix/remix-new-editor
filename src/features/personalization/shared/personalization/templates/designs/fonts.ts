/**
 * The font stacks the design adapters use.
 *
 * The five upstream templates hardcode a *system* stack
 * (`-apple-system, "Segoe UI", Roboto, sans-serif`) as a module-level
 * constant, so the rendered result used to depend on the operating system
 * the export ran on. `../typography` replaces that with a typeface that is
 * bundled with the app, and this module is the single place the design
 * layer reaches for it.
 *
 * An adapter that draws its own text (anything outside the frozen upstream)
 * only needs one import:
 *
 *     import { DESIGN_FONT_STACK } from './fonts'
 *     ...
 *     style={{ fontFamily: DESIGN_FONT_STACK }}
 *
 * An adapter that renders a frozen upstream needs nothing at all for the
 * family: the stylesheet that `../typography` injects overrides the
 * upstream's inline `font-family` inside the design stage. It only needs
 * `useDesignFonts()` (re-exported below) so the render waits for the
 * typeface to be ready — see `docs/phase2/handoffs/A10.md`.
 */

import { DESIGN_FONT_STACK, DESIGN_TYPE_ROLES, type DesignTypeRole } from '../typography'

/**
 * The per-role font stacks.
 *
 * Every role resolves to the same family stack today — the bundle ships one
 * typeface — but the map is the contract: a future second family (a display
 * serif, say) is added here and every role that should use it changes in
 * one place.
 */
export const DESIGN_FONT_STACKS: Record<DesignTypeRole, string> = Object.fromEntries(
  (Object.keys(DESIGN_TYPE_ROLES) as DesignTypeRole[]).map((role) => [
    role,
    DESIGN_TYPE_ROLES[role].fontFamily,
  ]),
) as Record<DesignTypeRole, string>

/** The stack used by a design's body copy. */
export const DESIGN_BODY_FONT_STACK = DESIGN_FONT_STACK

/** The stack used by a design's hero headline. */
export const DESIGN_DISPLAY_FONT_STACK = DESIGN_FONT_STACK

/**
 * The stack used by the licence credit line in `designs/shared.tsx`.
 *
 * The credit line is drawn outside the upstream's own text elements, so it
 * carries its own declaration; the injected stylesheet covers it too, but
 * the value is spelled out here so the line is correct even if the
 * stylesheet is not applied.
 */
export const DESIGN_CREDIT_FONT_STACK = DESIGN_FONT_STACK

export {
  DESIGN_FONT_FAMILY,
  DESIGN_FONT_FILE,
  DESIGN_FONT_FILES,
  DESIGN_FONT_FACE_CSS,
  DESIGN_FONT_OVERRIDE_CSS,
  DESIGN_FONT_STACK,
  DESIGN_TYPE_ROLES,
  DESIGN_TYPE_ROLE_IDS,
  designTypographyCss,
  ensureDesignTypographyCss,
  fontFamilyForRole,
  isDesignTypeRole,
  loadDesignFonts,
  typeStyleForRole,
  useDesignFonts,
} from '../typography'

export type {
  DesignFontLoadResult,
  DesignTypeRole,
  DesignTypeStyle,
} from '../typography'
