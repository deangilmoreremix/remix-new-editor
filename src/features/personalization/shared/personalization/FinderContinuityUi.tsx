'use client'

import React, { useState } from 'react'
import { FLAG_REASONS, type FlagReason, type SavedSearch } from './useFinderContinuity'

const MUTED = '#8b98a5', TEXT = '#e6edf3', CYAN = '#d9ff00', DANGER = '#ef4444', BORDER = 'rgba(255,255,255,.12)'
const linkBtn: React.CSSProperties = { background: 'transparent', border: 0, padding: 0, color: CYAN, cursor: 'pointer', fontSize: 10 }

export interface SavedSearchesPanelProps {
  /** The search currently in the form, or null when it is incomplete. */
  current: { niche: string; location: string; radiusMiles: number } | null
  defaultName: string
  searches: SavedSearch[]
  nicheLabel: (key: string) => string
  onSave: (name: string) => Promise<{ ok: true } | { ok: false; error: string }>
  onRun: (s: SavedSearch) => void
  onDelete: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>
  disabled?: boolean
}

/** Save the current search under a name, and run or delete earlier ones. Only rendered for signed-in users. */
export function SavedSearchesPanel({ current, defaultName, searches, nicheLabel, onSave, onRun, onDelete, disabled }: SavedSearchesPanelProps) {
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const n = name.trim()
    if (!n) { setMessage('Give the search a name.'); return }
    setBusy(true)
    const r = await onSave(n)
    setBusy(false)
    if (r.ok) { setNaming(false); setName(''); setMessage('Saved.') } else setMessage(r.error)
  }

  return (
    <div data-testid="saved-searches" style={{ marginTop: 10, fontSize: 10, color: MUTED }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {!naming && (
          <button type="button" data-testid="save-search-open" disabled={!current || disabled} style={{ ...linkBtn, opacity: current ? 1 : 0.5 }}
            onClick={() => { setNaming(true); setName(defaultName); setMessage(null) }}>
            Save this search
          </button>
        )}
        {naming && (
          <>
            <input data-testid="save-search-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-label="Name for this search"
              style={{ background: 'rgba(255,255,255,.04)', color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '3px 6px', fontSize: 11 }} />
            <button type="button" data-testid="save-search-confirm" disabled={busy} style={linkBtn} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
            <button type="button" style={{ ...linkBtn, color: MUTED }} onClick={() => { setNaming(false); setMessage(null) }}>Cancel</button>
          </>
        )}
        {message && <span data-testid="save-search-message" role="status" style={{ color: message === 'Saved.' ? CYAN : DANGER }}>{message}</span>}
      </div>
      {searches.length > 0 && (
        <ul data-testid="saved-search-list" style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {searches.map((s) => (
            <li key={s.id} data-testid="saved-search-item" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: TEXT, fontWeight: 700 }}>{s.name}</span>
              <span>{nicheLabel(s.niche)} · {s.location} · {s.radius_miles} mi</span>
              <button type="button" data-testid="saved-search-run" disabled={disabled} style={linkBtn} onClick={() => onRun(s)}>Run</button>
              <button type="button" data-testid="saved-search-delete" style={{ ...linkBtn, color: DANGER }} aria-label={`Delete saved search ${s.name}`}
                onClick={async () => { const r = await onDelete(s.id); if (!r.ok) setMessage(r.error) }}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export interface LooksWrongMenuProps {
  businessName: string
  flagged: boolean
  onFlag: (reason: FlagReason) => Promise<{ ok: true } | { ok: false; error: string }>
}

/** A small "Looks wrong" button on a result card that opens the fixed list of reasons. */
export function LooksWrongMenu({ businessName, flagged, onFlag }: LooksWrongMenuProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (flagged) return null
  return (
    <span data-testid="looks-wrong" style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" data-testid="looks-wrong-open" aria-haspopup="menu" aria-expanded={open} aria-label={`Report a problem with ${businessName}`}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); setError(null) }} style={{ ...linkBtn, color: MUTED }}>
        Looks wrong
      </button>
      {open && (
        <div role="menu" data-testid="looks-wrong-menu" onClick={(e) => e.stopPropagation()}
          style={{ position: 'absolute', zIndex: 30, top: '100%', left: 0, marginTop: 4, minWidth: 210, background: '#121212', border: `1px solid ${BORDER}`, borderRadius: 8, padding: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {FLAG_REASONS.map((r) => (
            <button key={r.key} type="button" role="menuitem" data-testid={`looks-wrong-${r.key}`}
              onClick={async () => { const res = await onFlag(r.key); if (res.ok) setOpen(false); else setError(res.error) }}
              style={{ background: 'transparent', border: 0, textAlign: 'left', color: TEXT, fontSize: 11, padding: '4px 6px', cursor: 'pointer', borderRadius: 4 }}>
              {r.label}
            </button>
          ))}
          {error && <div role="alert" style={{ color: DANGER, fontSize: 10, padding: '2px 6px' }}>{error}</div>}
        </div>
      )}
    </span>
  )
}

export interface HiddenBarProps {
  hiddenCount: number
  showing: boolean
  onToggle: () => void
  onUndoAll: () => void
}

/** "N hidden — show" with an undo, so a flagged business is never silently gone. */
export function HiddenBar({ hiddenCount, showing, onToggle, onUndoAll }: HiddenBarProps) {
  if (hiddenCount <= 0) return null
  return (
    <div data-testid="hidden-bar" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 10, color: MUTED, marginBottom: 8 }}>
      <span>{hiddenCount} hidden because you flagged {hiddenCount === 1 ? 'it' : 'them'}</span>
      <button type="button" data-testid="hidden-toggle" style={linkBtn} onClick={onToggle}>{showing ? 'Hide them again' : 'Show'}</button>
      <button type="button" data-testid="hidden-undo" style={linkBtn} onClick={onUndoAll}>Undo flags</button>
    </div>
  )
}
