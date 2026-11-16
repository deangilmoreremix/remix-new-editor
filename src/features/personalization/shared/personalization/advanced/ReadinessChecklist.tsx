'use client'

/**
 * "What's left" for Advanced Editing: the project's missing requirements
 * (from validateProjectRequirements) as a short list, each with a Fix button
 * that opens the tab and section where it is fixed and focuses the control.
 */

import { useState } from 'react'
import type { AIMissingRequirement } from '../ai/types'
import type { AdvancedEditingTab } from '../types'
import { C } from '../guided/tokens'

/** Suggestions shown before "+ N more suggestions". */
const SUGGESTIONS_SHOWN = 2

export type RequirementLocation = { tab: AdvancedEditingTab; section: string; focus?: string }

/** Where each requirement is fixed (tab, pill, and the control to focus). */
export function requirementLocation(field: string): RequirementLocation | null {
  if (field === 'client.businessName') return { tab: 'client', section: 'profile', focus: 'businessName' }
  if (field === 'mode') return { tab: 'create', section: 'output', focus: 'mode' }
  if (field === 'consent') return { tab: 'create', section: 'output', focus: 'consent' }
  if (field === 'prompt') return { tab: 'create', section: 'prompt', focus: 'prompt' }
  if (field === 'assets.identities') return { tab: 'assets', section: 'yours', focus: 'presenter' }
  if (field === 'uploads' || field.startsWith('assets.')) return { tab: 'assets', section: 'yours' }
  return null
}

/** Focus (and scroll to) the control marked data-pz-focus="<name>" once it is shown. */
export function focusRequirementControl(name?: string) {
  if (!name || typeof document === 'undefined') return
  // The tab and pill switch render first; then the control is visible.
  window.setTimeout(() => {
    // The page (or a test environment) may be gone by the time this fires.
    if (typeof document === 'undefined') return
    const target = document.querySelector<HTMLElement>(`[data-pz-focus="${name}"]`)
    if (!target) return
    target.scrollIntoView?.({ block: 'center' })
    const control = target.matches('input, textarea, button, select')
      ? target
      : target.querySelector<HTMLElement>('input, textarea, button, select')
    control?.focus?.({ preventScroll: true })
  }, 60)
}

/** The first blocking requirement on each tab (for the step bar). */
export function blockingByTab(requirements: AIMissingRequirement[]): Partial<Record<AdvancedEditingTab, string>> {
  const result: Partial<Record<AdvancedEditingTab, string>> = {}
  for (const requirement of requirements) {
    if (requirement.severity !== 'error') continue
    const location = requirementLocation(requirement.field)
    if (location && !result[location.tab]) result[location.tab] = requirement.label
  }
  return result
}

export function ReadinessChecklist({
  requirements,
  onFix,
}: {
  requirements: AIMissingRequirement[]
  onFix: (field: string) => void
}) {
  const [showAllSuggestions, setShowAllSuggestions] = useState(false)
  const placed = requirements.filter((r) => requirementLocation(r.field))
  const blocking = placed.filter((r) => r.severity === 'error')
  const suggestions = placed.filter((r) => r.severity !== 'error')
  const ready = blocking.length === 0
  // Must-do items first; suggestions after, a couple at a time.
  const hiddenSuggestions = showAllSuggestions ? 0 : Math.max(0, suggestions.length - SUGGESTIONS_SHOWN)
  const visible = [...blocking, ...suggestions.slice(0, suggestions.length - hiddenSuggestions)]

  return (
    <div
      data-testid="pz-readiness"
      role="status"
      style={{
        borderRadius: 14,
        border: `1px solid ${ready ? 'rgba(74,222,128,.35)' : 'rgba(251,191,36,.4)'}`,
        background: ready ? 'rgba(74,222,128,.06)' : 'rgba(251,191,36,.06)',
        padding: '10px 12px',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, color: ready ? '#86efac' : '#fcd34d' }}>
        {ready
          ? '✓ Ready to create'
          : `${blocking.length} thing${blocking.length === 1 ? '' : 's'} to finish before you create`}
      </div>
      {visible.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'grid', gap: 6 }}>
          {visible.map((requirement, index) => {
            const isError = requirement.severity === 'error'
            return (
              <li
                key={`${requirement.field}-${index}`}
                data-testid={`pz-readiness-item-${requirement.field}`}
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: C.text }}
              >
                <span
                  aria-hidden
                  style={{ width: 7, height: 7, borderRadius: 999, flexShrink: 0, background: isError ? '#f87171' : '#fbbf24' }}
                />
                <span style={{ flex: 1, minWidth: 0 }}>
                  {!isError && <span style={{ color: C.muted2, fontWeight: 700 }}>Recommended · </span>}
                  {requirement.message}
                </span>
                <button
                  type="button"
                  onClick={() => onFix(requirement.field)}
                  style={{
                    flexShrink: 0,
                    padding: '3px 9px',
                    borderRadius: 999,
                    border: `1px solid ${C.cyanBorder}`,
                    background: C.cyanSoft,
                    color: C.cyan,
                    fontSize: 10,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Fix →
                </button>
              </li>
            )
          })}
          {hiddenSuggestions > 0 && (
            <li>
              <button
                type="button"
                data-testid="pz-readiness-more"
                onClick={() => setShowAllSuggestions(true)}
                style={{ background: 'transparent', border: 0, padding: 0, color: C.cyan, fontSize: 10, fontWeight: 800, cursor: 'pointer' }}
              >
                + {hiddenSuggestions} more suggestion{hiddenSuggestions === 1 ? '' : 's'}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
