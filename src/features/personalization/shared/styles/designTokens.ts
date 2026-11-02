/**
 * SmartVideo GO Design Tokens
 * Single source of truth for all app styling.
 * All apps must import from here — no hardcoded colors anywhere.
 */

// ── CSS variable references ───────────────────────────────────────────────────
// These map to the variables defined in app/globals.css
export const colors = {
  primary:      'var(--color-primary)',        // #22d3ee cyan
  bgApp:        'var(--bg-app)',               // #030303
  bgPanel:      'var(--bg-panel)',             // #0a0a0a
  bgCard:       'var(--bg-card)',              // #111111
  border:       'var(--border-color)',         // rgba(255,255,255,0.05)
  glassBg:      'var(--glass-bg)',             // rgba(255,255,255,0.03)
  glassBorder:  'var(--glass-border)',         // rgba(255,255,255,0.08)
} as const

// ── Semantic color helpers ────────────────────────────────────────────────────
export const semantic = {
  textPrimary:   'rgba(255,255,255,1)',
  textSecondary: 'rgba(255,255,255,0.5)',
  textMuted:     'rgba(255,255,255,0.3)',
  textDisabled:  'rgba(255,255,255,0.2)',
  textLabel:     'rgba(255,255,255,0.4)',
  activeAccent:  'rgba(34,211,238,0.15)',      // primary with opacity for selected bg
  activeBorder:  'var(--color-primary)',
  error:         '#f87171',
  errorBg:       'rgba(239,68,68,0.1)',
  errorBorder:   'rgba(239,68,68,0.2)',
  success:       '#4ade80',
  successBg:     'rgba(74,222,128,0.1)',
} as const

// ── Reusable inline style objects ─────────────────────────────────────────────
export const panels = {
  // Main glass panel — use for content sections
  glass: {
    background: 'var(--glass-bg)',
    border: '1px solid var(--glass-border)',
  },
  // Card background — use for inputs, list items
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
  },
  // Sub-header bar (matches shell header style)
  subHeader: {
    borderBottom: '1px solid var(--border-color)',
    background: 'rgba(0,0,0,0.2)',
    backdropFilter: 'blur(12px)',
  },
} as const

// ── Button styles ─────────────────────────────────────────────────────────────
export const buttons = {
  // Primary CTA — cyan background
  primary: {
    background: 'var(--color-primary)',
    color: 'black',
  },
  // Ghost — for secondary actions
  ghost: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border-color)',
    color: 'rgba(255,255,255,0.5)',
  },
  // Active pill — for selected tab/option
  activePill: {
    background: 'rgba(34,211,238,0.15)',
    border: '1px solid var(--color-primary)',
    color: 'var(--color-primary)',
  },
  // Inactive pill
  inactivePill: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    color: 'rgba(255,255,255,0.4)',
  },
  // Danger
  danger: {
    color: '#f87171',
  },
  // Icon button overlay (on hover over images etc)
  iconOverlay: {
    background: 'rgba(0,0,0,0.7)',
    color: 'white',
    border: '1px solid var(--border-color)',
  },
} as const

// ── Input styles ──────────────────────────────────────────────────────────────
export const inputs = {
  base: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    color: 'white',
  },
} as const

// ── Tab switcher helper ───────────────────────────────────────────────────────
// Returns style for a tab button based on whether it's active
export function tabStyle(isActive: boolean) {
  return {
    background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
    color: isActive ? 'white' : 'rgba(255,255,255,0.4)',
  }
}

// ── Option picker helper ──────────────────────────────────────────────────────
// Returns style for a selectable option (style/model/ratio picker)
export function optionStyle(isSelected: boolean) {
  return isSelected ? buttons.activePill : buttons.inactivePill
}

// ── Sub-header icon badge ─────────────────────────────────────────────────────
export const iconBadge = {
  background: 'var(--color-primary)',
  color: 'black',
} as const

// ── App wrapper ───────────────────────────────────────────────────────────────
export const appWrapper = {
  background: 'var(--bg-app)',
  color: 'white',
} as const
