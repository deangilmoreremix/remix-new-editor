/**
 * Design tokens + shared style helpers for the guided Simple Mode wizard and the
 * Advanced Editing overlay editor.
 *
 * The token values are duplicated verbatim from `PersonalizationModal.tsx` so
 * the guided surfaces stay pixel-consistent with the existing modal without the
 * modal having to export its private constant.
 */

import type { CSSProperties } from 'react'

export const C = {
  bg: '#080b0f',
  modal: '#101419',
  panel: '#151a20',
  panelSoft: '#12171c',
  field: '#0d1116',
  border: 'rgba(255,255,255,.10)',
  borderStrong: 'rgba(255,255,255,.16)',
  text: '#f7f9fb',
  muted: 'rgba(255,255,255,.58)',
  muted2: 'rgba(255,255,255,.36)',
  cyan: '#29d3f2',
  cyanSoft: 'rgba(41,211,242,.12)',
  cyanBorder: 'rgba(41,211,242,.45)',
  green: '#28c98b',
  danger: '#ef5b67',
} as const

export type GuidedTokens = typeof C

// ── Shared style helpers ─────────────────────────────────────────────────────

/** Standard raised panel used for every card in the guided surfaces. */
export const panelStyle: CSSProperties = {
  background: C.panel,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  padding: 18,
}

/** Inset panel (nested inside a panel) — slight background drop. */
export const softPanelStyle: CSSProperties = {
  background: C.panelSoft,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  padding: 14,
}

/** Section heading used above each wizard step / editor block. */
export const headingStyle: CSSProperties = {
  margin: '0 0 6px',
  fontSize: 13,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.04em',
  color: C.text,
}

/** Small uppercase label above inputs and rows. */
export const labelStyle: CSSProperties = {
  display: 'block',
  marginBottom: 4,
  color: C.muted,
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.04em',
}

export const hintStyle: CSSProperties = {
  margin: '4px 0 0',
  color: C.muted,
  fontSize: 10,
  lineHeight: 1.5,
}

/** Text input / select surface (same metrics as the modal's `Field`). */
export const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 40,
  padding: '0 11px',
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  background: C.field,
  color: C.text,
  fontSize: 12,
  outline: 'none',
}

export const chipStyle = (active: boolean): CSSProperties => ({
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 999,
  border: `1px solid ${active ? C.cyanBorder : C.border}`,
  background: active ? C.cyanSoft : 'transparent',
  color: active ? C.cyan : C.muted,
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
})

export const primaryButtonStyle: CSSProperties = {
  minHeight: 44,
  padding: '0 20px',
  border: `1px solid ${C.cyan}`,
  borderRadius: 10,
  background: C.cyan,
  color: '#041014',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.04em',
  cursor: 'pointer',
}

export const secondaryButtonStyle: CSSProperties = {
  minHeight: 44,
  padding: '0 18px',
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  background: C.panel,
  color: C.text,
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.04em',
  cursor: 'pointer',
}

/** Tile used for selectable cards (video picks, layouts, layers...). */
export const tileStyle = (active: boolean): CSSProperties => ({
  padding: 12,
  border: `1px solid ${active ? C.cyanBorder : C.border}`,
  borderRadius: 12,
  background: active ? 'rgba(41,211,242,.07)' : C.panelSoft,
  color: C.text,
  textAlign: 'left',
  cursor: 'pointer',
  width: '100%',
})

export const badgeStyle = (tone: 'cyan' | 'green' | 'muted' = 'cyan'): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '3px 9px',
  borderRadius: 999,
  fontSize: 9,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.04em',
  border: `1px solid ${
    tone === 'cyan' ? C.cyanBorder : tone === 'green' ? 'rgba(40,201,139,.45)' : C.border
  }`,
  background:
    tone === 'cyan' ? C.cyanSoft : tone === 'green' ? 'rgba(40,201,139,.12)' : 'rgba(255,255,255,.04)',
  color: tone === 'cyan' ? C.cyan : tone === 'green' ? C.green : C.muted,
})

/** Range input tuned to the dark surfaces. */
export const rangeStyle: CSSProperties = {
  width: '100%',
  accentColor: C.cyan,
}
