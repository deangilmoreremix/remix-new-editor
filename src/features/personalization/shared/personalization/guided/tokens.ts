/**
 * Design tokens + shared style helpers for the guided Simple Mode wizard and the
 * Advanced Editing overlay editor.
 *
 * `PersonalizationModal.tsx` imports `C` from here, so the modal and the
 * guided surfaces share one palette (remix-new-editor's dark + neon-yellow
 * scheme).
 */

import type { CSSProperties } from 'react'

export const C = {
  // remix-new-editor palette (src/styles/variables.css + @theme in
  // src/styles/global.css). The `cyan*` keys keep OpenHiggsBolt's names so
  // the ported inline styles stay untouched; they now carry remix's neon
  // yellow primary (`--color-primary`).
  bg: '#050505',
  modal: '#0a0a0a',
  panel: '#141414',
  panelSoft: '#101010',
  field: '#0d0d0d',
  border: 'rgba(255,255,255,.10)',
  borderStrong: '#27272a',
  text: '#ffffff',
  muted: '#a1a1aa',
  muted2: '#71717a',
  cyan: '#d9ff00',
  cyanSoft: 'rgba(217,255,0,.12)',
  cyanBorder: 'rgba(217,255,0,.45)',
  accent: '#d9ff00',
  accentHover: '#c4e600',
  onAccent: '#000000',
  green: '#22c55e',
  danger: '#ef4444',
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
  color: '#000000',
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
  background: active ? 'rgba(217,255,0,.07)' : C.panelSoft,
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
    tone === 'cyan' ? C.cyanBorder : tone === 'green' ? 'rgba(34,197,94,.45)' : C.border
  }`,
  background:
    tone === 'cyan' ? C.cyanSoft : tone === 'green' ? 'rgba(34,197,94,.12)' : 'rgba(255,255,255,.04)',
  color: tone === 'cyan' ? C.cyan : tone === 'green' ? C.green : C.muted,
})

/** Range input tuned to the dark surfaces. */
export const rangeStyle: CSSProperties = {
  width: '100%',
  accentColor: C.cyan,
}
