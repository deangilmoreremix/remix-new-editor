import { useCallback, useEffect, useState } from 'react'
import { C, hintStyle, secondaryButtonStyle, softPanelStyle } from '../tokens'

/**
 * A short, dismissible first-run guide for the video editor, plus a keyboard-shortcut cheat sheet.
 * It is an inline card (not a modal), so it never blocks the stage. Dismissal is remembered in
 * localStorage; every storage call is wrapped because storage can be blocked or unavailable.
 */
export const TOUR_STORAGE_KEY = 'personalization-editor-tour-dismissed'

export const TOUR_STEPS: { title: string; body: string }[] = [
  { title: 'Pick a layer', body: 'Click any text, logo or image on the video, or choose it in the Layers list. The selected layer shows handles.' },
  { title: 'Drag and resize', body: 'Drag the layer to move it (pink lines show what it snaps to). Drag a handle to resize, or the round handle above it to rotate.' },
  { title: 'Retime on the timeline', body: 'Under the video, every layer has a bar. Drag it to change when the layer appears, or drag its ends to trim it.' },
  { title: 'Check the layout', body: 'The Layout check under the video tells you if text is hard to read or covers something important, and can fix it in one click.' },
]

export const SHORTCUTS: { keys: string; does: string }[] = [
  { keys: '⌘Z / Ctrl+Z', does: 'Undo' },
  { keys: '⇧⌘Z / Ctrl+Shift+Z', does: 'Redo' },
  { keys: 'Arrow keys', does: 'Nudge the selected layer 1% (Shift: 5%)' },
  { keys: 'Alt while dragging', does: 'Turn snapping off for that drag' },
  { keys: 'Shift while rotating', does: 'Snap rotation to 15° steps' },
  { keys: 'Delete', does: 'Hide the selected layer' },
  { keys: 'Esc', does: 'Close a tooltip or popover' },
]

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(TOUR_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeDismissed() {
  try {
    window.localStorage.setItem(TOUR_STORAGE_KEY, '1')
  } catch {
    /* storage unavailable: the guide just shows again next time */
  }
}

export function EditorTour(): React.JSX.Element {
  // Start closed so server and first client render match; open on mount for first-time users.
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [showKeys, setShowKeys] = useState(false)

  useEffect(() => {
    if (!readDismissed()) setOpen(true)
  }, [])

  const close = useCallback(() => {
    writeDismissed()
    setOpen(false)
    setStep(0)
  }, [])

  const last = step === TOUR_STEPS.length - 1
  const current = TOUR_STEPS[step]

  return (
    <div data-testid="editor-tour-area">
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" data-testid="editor-tour-open" onClick={() => { setOpen(true); setStep(0) }} style={{ ...secondaryButtonStyle, minHeight: 28, fontSize: 10, padding: '0 10px' }}>
          Quick tour
        </button>
        <button type="button" data-testid="editor-shortcuts-toggle" aria-expanded={showKeys} onClick={() => setShowKeys((v) => !v)} style={{ ...secondaryButtonStyle, minHeight: 28, fontSize: 10, padding: '0 10px' }}>
          Shortcuts
        </button>
      </div>

      {open && (
        <section role="region" aria-label="Editor tour" data-testid="editor-tour" style={{ ...softPanelStyle, marginTop: 8, borderColor: C.cyan }}>
          <div style={{ color: C.muted, fontSize: 10 }}>Step {step + 1} of {TOUR_STEPS.length}</div>
          <div style={{ color: C.text, fontSize: 13, fontWeight: 800, marginTop: 2 }}>{current.title}</div>
          <p style={{ ...hintStyle, marginTop: 4 }}>{current.body}</p>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <button type="button" data-testid="editor-tour-back" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))} style={{ ...secondaryButtonStyle, minHeight: 28, fontSize: 11, padding: '0 10px', opacity: step === 0 ? 0.5 : 1 }}>Back</button>
            {last ? (
              <button type="button" data-testid="editor-tour-done" onClick={close} style={{ ...secondaryButtonStyle, minHeight: 28, fontSize: 11, padding: '0 10px', borderColor: C.cyan, color: C.cyan }}>Done</button>
            ) : (
              <button type="button" data-testid="editor-tour-next" onClick={() => setStep((s) => s + 1)} style={{ ...secondaryButtonStyle, minHeight: 28, fontSize: 11, padding: '0 10px', borderColor: C.cyan, color: C.cyan }}>Next</button>
            )}
            <button type="button" data-testid="editor-tour-skip" onClick={close} style={{ ...secondaryButtonStyle, minHeight: 28, fontSize: 11, padding: '0 10px', marginLeft: 'auto' }}>Skip tour</button>
          </div>
        </section>
      )}

      {showKeys && (
        <section role="region" aria-label="Keyboard shortcuts" data-testid="editor-shortcuts" style={{ ...softPanelStyle, marginTop: 8 }}>
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: 11 }}>
            {SHORTCUTS.map((s) => (
              <div key={s.keys} style={{ display: 'contents' }}>
                <dt style={{ color: C.text, fontWeight: 700 }}>{s.keys}</dt>
                <dd style={{ margin: 0, color: C.muted }}>{s.does}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  )
}
