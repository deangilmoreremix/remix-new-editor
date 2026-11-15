'use client'

import { useState } from 'react'
import { Coins, Eraser, Loader2, Undo2 } from 'lucide-react'
import { C, hintStyle, primaryButtonStyle, secondaryButtonStyle } from './tokens'
import { Tip } from './editor/Tip'
import { REMOVE_BRANDING_CREDITS, describeCost, type RemovalDeps } from './brandingRemoval'
import { useBrandingRemoval } from './useBrandingRemoval'

/**
 * "Remove branding (AI)": a paid action, so it never runs from the button alone. The button opens a
 * confirmation that states the cost and balance, asks the person to confirm they may edit this video, and says
 * the original is kept. Only its "Remove branding" button starts the job.
 */
export function RemoveBrandingControl({
  apiKey,
  videoUrl,
  blocked,
  canRestore,
  onApply,
  onRestore,
  deps,
}: {
  apiKey: string
  videoUrl: string | null
  /** True while the clip's rights are unconfirmed (the same gate as the render). */
  blocked?: boolean
  /** A branding-removed video is showing, so "Use original video" is offered. */
  canRestore: boolean
  onApply: (cleanedUrl: string) => void
  onRestore: () => void
  /** Test seam. */
  deps?: RemovalDeps
}): React.JSX.Element {
  const removal = useBrandingRemoval({ apiKey, videoUrl, onDone: onApply, deps })
  const [mayEdit, setMayEdit] = useState(false)
  const { status, quote, afford, error } = removal
  const cost = describeCost(quote)
  const label = REMOVE_BRANDING_CREDITS != null ? `Remove branding (AI) · ${describeCost(null)}` : 'Remove branding (AI)'
  const busy = status === 'quoting' || status === 'running'

  return (
    <div data-testid="remove-branding" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Tip id="removeBranding" side="top">
          <button
            type="button"
            data-testid="remove-branding-open"
            disabled={!videoUrl || busy || blocked || status === 'confirm'}
            onClick={() => { setMayEdit(false); removal.open() }}
            style={{ ...secondaryButtonStyle, display: 'inline-flex', alignItems: 'center', gap: 8, opacity: !videoUrl || blocked ? 0.5 : 1 }}
          >
            {status === 'quoting' ? <Loader2 size={14} className="animate-spin" /> : <Eraser size={14} />}
            {label}
            <Coins size={13} aria-hidden color="#fcd34d" />
          </button>
        </Tip>
        {canRestore && (
          <button type="button" data-testid="remove-branding-restore" onClick={onRestore} style={{ ...secondaryButtonStyle, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Undo2 size={13} /> Use original video
          </button>
        )}
      </div>

      {status === 'confirm' && (
        <div role="dialog" aria-label="Confirm removing branding" data-testid="remove-branding-confirm"
          style={{ border: `1px solid ${C.borderStrong}`, borderRadius: 12, padding: 12, background: C.panelSoft, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ color: C.text, fontSize: 13, fontWeight: 800 }}>Remove branding with AI</div>
          <p style={{ ...hintStyle, margin: 0 }}>
            AI erases logos, watermarks and captions that are already part of this video. <strong style={{ color: '#fcd34d' }}>This is not free: it uses your account credits.</strong>
          </p>
          <div data-testid="remove-branding-cost" style={{ color: C.text, fontSize: 12 }}>
            Cost: <strong>{cost}</strong>
            {quote?.balance != null && <> · Your balance: <strong>{quote.balance}</strong></>}
          </div>
          <p style={{ ...hintStyle, margin: 0 }}>Your original video is kept: you can switch back to it afterwards. Results can take a few minutes.</p>
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: C.text, fontSize: 12 }}>
            <input type="checkbox" data-testid="remove-branding-rights" checked={mayEdit} onChange={(e) => setMayEdit(e.target.checked)} style={{ marginTop: 2 }} />
            I have the right to edit this video and remove its branding.
          </label>
          {!afford.ok && <div role="alert" data-testid="remove-branding-afford" style={{ color: C.danger, fontSize: 12 }}>{afford.message}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" data-testid="remove-branding-confirm-button" disabled={!mayEdit || !afford.ok} onClick={removal.confirm}
              style={{ ...primaryButtonStyle, opacity: !mayEdit || !afford.ok ? 0.5 : 1 }}>
              Remove branding
            </button>
            <button type="button" data-testid="remove-branding-cancel" onClick={removal.cancel} style={secondaryButtonStyle}>Cancel</button>
          </div>
        </div>
      )}

      {status === 'running' && (
        <div role="status" data-testid="remove-branding-running" style={{ display: 'flex', gap: 10, alignItems: 'center', color: C.text, fontSize: 12 }}>
          <Loader2 size={14} className="animate-spin" /> Removing branding… this can take a few minutes.
          <button type="button" data-testid="remove-branding-stop" onClick={removal.cancel} style={{ ...secondaryButtonStyle, minHeight: 28, fontSize: 11 }}>Stop waiting</button>
          <span style={{ ...hintStyle, margin: 0 }}>Stopping cannot recall the job; it may still use credits.</span>
        </div>
      )}

      {status === 'done' && (
        <div role="status" data-testid="remove-branding-done" style={{ color: C.green, fontSize: 12 }}>
          Done. Your video now shows the cleaned version. Your original is kept.
        </div>
      )}

      {status === 'error' && (
        <div role="alert" data-testid="remove-branding-error" style={{ color: C.danger, fontSize: 12 }}>
          {error} <button type="button" onClick={removal.reset} style={{ ...secondaryButtonStyle, minHeight: 26, fontSize: 11, marginLeft: 6 }}>Dismiss</button>
        </div>
      )}
    </div>
  )
}
