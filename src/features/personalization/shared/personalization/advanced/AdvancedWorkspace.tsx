'use client'

/**
 * Layout shell for the personalization modal's Advanced Editing view.
 *
 * On wide screens Advanced Editing is a fixed frame: a step bar (4 tabs), a
 * row of section pills for the active tab, then two panes that scroll on their
 * own — the active section on the left, the live preview on the right. Nothing
 * is sticky, so nothing can hide anything else, and each section fits roughly
 * one screen. On narrow screens it falls back to one normal scroll.
 *
 * Every existing section is kept: tabs and pills only regroup them. All
 * panels stay mounted (inactive ones are hidden), so switching never loses
 * typed input or editor selection, and every section id stays in the DOM.
 */

import type { ReactNode } from 'react'
import type { AdvancedEditingSections, AdvancedEditingTab } from '../types'
import { C } from '../guided/tokens'

export const ADVANCED_TABS: ReadonlyArray<{ id: AdvancedEditingTab; label: string; hint: string }> = [
  { id: 'client', label: 'Client', hint: 'Who is this for?' },
  { id: 'assets', label: 'Assets', hint: 'Logo, people, products' },
  { id: 'recast', label: 'Full Body Recast', hint: 'Put a person in a video' },
  { id: 'create', label: 'Overlays & Create', hint: 'Prompt, output, engine' },
]

/** The sections (pills) of each tab, in order. A tab with one section shows no pills. */
export const ADVANCED_SECTIONS: Record<AdvancedEditingTab, ReadonlyArray<{ id: string; label: string }>> = {
  client: [
    { id: 'find', label: 'Find business' },
    { id: 'profile', label: 'Profile' },
  ],
  assets: [
    { id: 'yours', label: 'Your assets' },
    { id: 'found', label: 'Found on website' },
    { id: 'content', label: 'Business content' },
  ],
  recast: [{ id: 'recast', label: 'Full Body Recast' }],
  create: [
    { id: 'overlays', label: 'Overlays' },
    { id: 'prompt', label: 'Prompt' },
    { id: 'output', label: 'Output & engine' },
  ],
}

/** Where each Advanced Editing section lives (for links, jumps and tests). */
export const SECTION_LOCATION: Record<string, { tab: AdvancedEditingTab; section: string }> = {
  'pz-overview': { tab: 'client', section: 'find' },
  'pz-find-business': { tab: 'client', section: 'find' },
  'pz-client-profile': { tab: 'client', section: 'profile' },
  'pz-client-assets': { tab: 'assets', section: 'yours' },
  'pz-saved-assets': { tab: 'assets', section: 'yours' },
  'pz-discovered': { tab: 'assets', section: 'found' },
  'pz-content': { tab: 'assets', section: 'content' },
  'pz-recast': { tab: 'recast', section: 'recast' },
  'pz-onvideo-overlays': { tab: 'create', section: 'overlays' },
  'pz-prompt': { tab: 'create', section: 'prompt' },
  'pz-output': { tab: 'create', section: 'output' },
  'pz-mode': { tab: 'create', section: 'output' },
  'pz-engine': { tab: 'create', section: 'output' },
}

/** Which tab holds each section id. */
export const SECTION_TAB: Record<string, AdvancedEditingTab> = Object.fromEntries(
  Object.entries(SECTION_LOCATION).map(([id, location]) => [id, location.tab]),
) as Record<string, AdvancedEditingTab>

export function AdvancedStepBar({
  active,
  onSelect,
  done,
  issues = {},
}: {
  active: AdvancedEditingTab
  onSelect: (tab: AdvancedEditingTab) => void
  done: Partial<Record<AdvancedEditingTab, boolean>>
  /** The first thing still needed on a tab ("Business Name"), shown as its hint. */
  issues?: Partial<Record<AdvancedEditingTab, string>>
}) {
  return (
    <div
      role="tablist"
      aria-label="Advanced Editing steps"
      className="pz-adv-steps grid grid-cols-2 md:grid-cols-4 flex-none"
      style={{ gap: 8, padding: '10px 0', background: C.modal }}
    >
      {ADVANCED_TABS.map((tab, index) => {
        const isActive = tab.id === active
        const issue = issues[tab.id]
        const complete = Boolean(done[tab.id]) && !isActive && !issue
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`pz-tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`pz-tabpanel-${tab.id}`}
            data-testid={`pz-tab-${tab.id}`}
            data-issue={issue ? 'true' : undefined}
            onClick={() => onSelect(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 12,
              border: `1px solid ${isActive ? C.cyanBorder : C.border}`,
              background: isActive ? C.cyanSoft : 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              minWidth: 0,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 800,
                background: issue ? '#fbbf24' : complete ? C.green : isActive ? C.cyan : 'rgba(255,255,255,.06)',
                color: issue || complete || isActive ? '#000000' : C.muted,
              }}
            >
              {issue ? '!' : complete ? '✓' : index + 1}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', color: isActive ? C.cyan : C.text, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {tab.label}
              </span>
              <span style={{ display: 'block', color: issue ? '#fcd34d' : C.muted2, fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {issue ? `${issue} needed` : tab.hint}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** The section pills of the active tab (nothing for a single-section tab). */
export function AdvancedSectionPills({
  tab,
  active,
  onSelect,
  badges = {},
}: {
  tab: AdvancedEditingTab
  active: string
  onSelect: (section: string) => void
  badges?: Record<string, number | undefined>
}) {
  const sections = ADVANCED_SECTIONS[tab]
  if (sections.length < 2) return null
  return (
    <div
      role="tablist"
      aria-label="Sections"
      data-testid="pz-section-pills"
      className="flex flex-wrap items-center flex-none"
      style={{ gap: 6, padding: '0 0 10px', borderBottom: `1px solid ${C.border}` }}
    >
      {sections.map((section) => {
        const isActive = section.id === active
        const badge = badges[section.id]
        return (
          <button
            key={section.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-testid={`pz-pill-${tab}-${section.id}`}
            onClick={() => onSelect(section.id)}
            style={{
              minHeight: 30,
              padding: '0 12px',
              borderRadius: 999,
              border: `1px solid ${isActive ? C.cyanBorder : C.border}`,
              background: isActive ? C.cyanSoft : 'transparent',
              color: isActive ? C.cyan : C.text,
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {section.label}
            {typeof badge === 'number' && badge > 0 && (
              <span style={{ minWidth: 18, padding: '1px 6px', borderRadius: 999, background: C.cyan, color: '#000000', fontSize: 9, fontWeight: 900 }}>
                {badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function AdvancedTabPanel({
  tab,
  active,
  children,
}: {
  tab: AdvancedEditingTab
  active: AdvancedEditingTab
  children: ReactNode
}) {
  return (
    <div
      role="tabpanel"
      id={`pz-tabpanel-${tab}`}
      aria-labelledby={`pz-tab-${tab}`}
      data-testid={`pz-tabpanel-${tab}`}
      hidden={tab !== active}
    >
      {children}
    </div>
  )
}

/** One section inside a tab; hidden unless it is the tab's active section. */
export function AdvancedSectionPanel({
  tab,
  section,
  sections,
  children,
}: {
  tab: AdvancedEditingTab
  section: string
  sections: AdvancedEditingSections
  children: ReactNode
}) {
  return (
    <div data-testid={`pz-section-${tab}-${section}`} hidden={sections[tab] !== section}>
      {children}
    </div>
  )
}

/** The next / previous stop: the next pill in this tab, else the next tab. */
export function adjacentStop(
  tab: AdvancedEditingTab,
  section: string,
  direction: 1 | -1,
): { tab: AdvancedEditingTab; section: string; label: string } | null {
  const stops = ADVANCED_TABS.flatMap((t) => ADVANCED_SECTIONS[t.id].map((s) => ({
    tab: t.id,
    section: s.id,
    label: ADVANCED_SECTIONS[t.id].length > 1 ? s.label : t.label,
  })))
  const index = stops.findIndex((stop) => stop.tab === tab && stop.section === section)
  const next = stops[(index < 0 ? 0 : index) + direction]
  return next || null
}

/** "← Back / Next →" at the bottom of each section. */
export function AdvancedTabFooter({
  tab,
  section,
  onGo,
}: {
  tab: AdvancedEditingTab
  section: string
  onGo: (tab: AdvancedEditingTab, section: string) => void
}) {
  const prev = adjacentStop(tab, section, -1)
  const next = adjacentStop(tab, section, 1)
  const linkStyle = {
    minHeight: 34,
    padding: '0 14px',
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    background: 'transparent',
    color: C.text,
    fontSize: 11,
    fontWeight: 800,
    cursor: 'pointer',
  } as const
  return (
    <div className="flex items-center justify-between" style={{ padding: '18px 0 6px', gap: 10 }}>
      {prev ? (
        <button type="button" style={linkStyle} onClick={() => onGo(prev.tab, prev.section)}>← {prev.label}</button>
      ) : <span />}
      {next && (
        <button
          type="button"
          style={{ ...linkStyle, border: `1px solid ${C.cyanBorder}`, background: C.cyanSoft, color: C.cyan }}
          onClick={() => onGo(next.tab, next.section)}
        >
          Next: {next.label} →
        </button>
      )}
    </div>
  )
}

/** The right-hand pane: live preview + what will be used. Scrolls on its own on wide screens. */
export function AdvancedPreviewColumn({ children }: { children: ReactNode }) {
  return (
    <aside
      aria-label="Live preview"
      data-testid="pz-preview-column"
      className="pz-adv-preview xl:h-full xl:overflow-y-auto xl:min-h-0"
      style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 2px 16px' }}
    >
      {children}
    </aside>
  )
}
