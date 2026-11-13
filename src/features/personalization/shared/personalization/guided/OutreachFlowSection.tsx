'use client'

/**
 * The outreach sequence planner, opened on demand. React Flow and its stylesheet are loaded only when the owner opens it, so
 * the editor's normal load does not pay for a diagram library most visits never use.
 */
import { lazy, Suspense, useState } from 'react'
import { C, chipStyle, hintStyle, labelStyle, softPanelStyle } from './tokens'

const OutreachFlowPanel = lazy(() => import('./OutreachFlowPanel').then((m) => ({ default: m.OutreachFlowPanel })))

export function OutreachFlowSection() {
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <div style={{ ...softPanelStyle, display: 'flex', flexDirection: 'column', gap: 6 }} data-testid="flow-section">
        <div style={labelStyle}>Outreach sequence</div>
        <p style={hintStyle}>Plan the emails, waits and follow-ups for a list as a diagram. It is a plan you follow; nothing is sent automatically.</p>
        <button type="button" style={{ ...chipStyle(false), minHeight: 28, fontSize: 10, alignSelf: 'flex-start' }} onClick={() => setOpen(true)}>Plan a sequence</button>
      </div>
    )
  }
  return <Suspense fallback={<div style={{ ...softPanelStyle, color: C.muted }} role="status">Loading the planner…</div>}><OutreachFlowPanel /></Suspense>
}
