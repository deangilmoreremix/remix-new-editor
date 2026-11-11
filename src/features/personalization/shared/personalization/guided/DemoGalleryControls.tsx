'use client'

/**
 * Reusable, content-free gallery primitives for the Personalization modal's
 * Demos tab.
 *
 * These mirror the AI Viral Studio gallery patterns (see
 * `docs/AI_VIRAL_GALLERY_PATTERNS.md`) but are styled with the Personalization
 * modal's OWN design tokens (`./tokens`) so the Demos tab stays visually
 * consistent with Steps 1–3 of the wizard.
 *
 * Every piece of data arrives through props: no demo lists, no video URLs, no
 * premium template records live in this file.
 */

import { useId, type ComponentType } from 'react'
import {
  Search,
  LayoutGrid,
  ShoppingBag,
  Utensils,
  Home,
  Sparkles,
  HeartPulse,
  GraduationCap,
  Cpu,
  LineChart,
  Clapperboard,
  Car,
  Plane,
  Trophy,
  Briefcase,
  TrendingUp,
  Film,
} from 'lucide-react'
import { C, badgeStyle, chipStyle, inputStyle, labelStyle } from './tokens'

type IconComponent = ComponentType<{ size?: number; color?: string }>

/**
 * Lucide icon keys used by the taxonomy (`icon` on a `DemoCategory`). Kept as
 * a map so the taxonomy module stays free of React imports.
 */
const ICONS: Record<string, IconComponent> = {
  'layout-grid': LayoutGrid,
  'shopping-bag': ShoppingBag,
  utensils: Utensils,
  home: Home,
  sparkles: Sparkles,
  'heart-pulse': HeartPulse,
  'graduation-cap': GraduationCap,
  cpu: Cpu,
  'line-chart': LineChart,
  clapperboard: Clapperboard,
  car: Car,
  plane: Plane,
  trophy: Trophy,
  briefcase: Briefcase,
  'trending-up': TrendingUp,
  film: Film,
}

/** A single tab. `icon` is a Lucide icon key, resolved through `ICONS`. */
export interface DemoCategoryTabItem {
  id: string
  label: string
  icon?: string
}

export interface DemoCategoryTabsProps {
  /** Tabs to render, in order. */
  categories: readonly DemoCategoryTabItem[]
  /** Per-category counts, keyed by category id. Missing ids render no badge. */
  counts?: Readonly<Record<string, number>>
  /** Currently active category id. */
  activeId: string
  /** Called with the id of the clicked tab. */
  onChange: (categoryId: string) => void
  /** Accessible name for the tab list. */
  ariaLabel?: string
}

/**
 * Category tab navigation.
 *
 * Pattern taken from the AI Viral Studio gallery: a wrapping row of pill
 * buttons, the active one carrying the cyan accent, each showing the number
 * of items it holds. Native `<button>` elements keep Enter/Space activation
 * and the natural tab order — the same keyboard behaviour the AI Viral
 * sidebar has.
 */
export function DemoCategoryTabs({
  categories,
  counts,
  activeId,
  onChange,
  ariaLabel = 'Demo categories',
}: DemoCategoryTabsProps): React.JSX.Element {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}
    >
      {categories.map((category) => {
        const active = category.id === activeId
        const Icon = category.icon ? ICONS[category.icon] : undefined
        const count = counts?.[category.id]
        return (
          <button
            key={category.id}
            type="button"
            role="tab"
            aria-selected={active}
            data-testid={`demo-category-tab-${category.id}`}
            onClick={() => onChange(category.id)}
            style={chipStyle(active)}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {Icon ? <Icon size={12} color={active ? C.cyan : C.muted} /> : null}
              {category.label}
              {typeof count === 'number' && (
                <span style={{ ...badgeStyle(active ? 'cyan' : 'muted'), marginLeft: 2 }}>{count}</span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export interface DemoSearchInputProps {
  /** Current query. */
  value: string
  /** Called with the next query on every keystroke. */
  onChange: (value: string) => void
  /** Placeholder text. */
  placeholder?: string
  /** Accessible label. Defaults to "Search demos". */
  ariaLabel?: string
}

/**
 * Search input with an inline magnifier, matching the AI Viral Studio search
 * control and the Motion Studio search field in the same modal.
 */
export function DemoSearchInput({
  value,
  onChange,
  placeholder = 'Search demos…',
  ariaLabel = 'Search demos',
}: DemoSearchInputProps): React.JSX.Element {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} style={labelStyle}>
        Search
      </label>
      <div style={{ position: 'relative' }}>
        <Search
          size={14}
          color={C.muted}
          style={{ position: 'absolute', top: '50%', left: 11, transform: 'translateY(-50%)' }}
        />
        <input
          id={id}
          type="text"
          value={value}
          aria-label={ariaLabel}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          style={{ ...inputStyle, paddingLeft: 32 }}
        />
      </div>
    </div>
  )
}

export interface DemoFilterOption {
  value: string
  label: string
}

export interface DemoFilterSelectProps {
  /** Visible label above the control. */
  label: string
  /** Currently selected value. */
  value: string
  /** Options to choose from. */
  options: readonly DemoFilterOption[]
  /** Called with the next value. */
  onChange: (value: string) => void
}

/**
 * A single filter control (style, aspect ratio, source, …). Everything is
 * driven by props so the same control serves any filter dimension.
 */
export function DemoFilterSelect({
  label,
  value,
  options,
  onChange,
}: DemoFilterSelectProps): React.JSX.Element {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} style={labelStyle}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        style={{ ...inputStyle, cursor: 'pointer' }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} style={{ background: C.field, color: C.text }}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
