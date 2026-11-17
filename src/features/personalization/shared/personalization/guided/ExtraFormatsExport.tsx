'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, Loader2, X } from 'lucide-react'
import { EXPORT_FORMATS, exportFormats, formatFileSuffix } from '../preview/exportFormats'
import type { PreviewAspectRatio, PreviewInputProps } from '../preview/types'
import { C, chipStyle, hintStyle, labelStyle, secondaryButtonStyle } from './tokens'

/**
 * "Also export other shapes": renders the approved preview again in 9:16, 1:1, 4:5 or 16:9 and saves each file as
 * it finishes. Free: the same in-browser render as the main button, one shape at a time, nothing uploaded.
 */
export function ExtraFormatsExport({ inputProps, disabled, onRunningChange }: {
  inputProps: PreviewInputProps
  disabled?: boolean
  /** Lets the parent keep the main render from starting while a batch runs (they share one renderer). */
  onRunningChange?: (running: boolean) => void
}): React.JSX.Element {
  const current = inputProps.settings.aspectRatio
  const [picked, setPicked] = useState<PreviewAspectRatio[]>([])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [label, setLabel] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const onRunningChangeRef = useRef(onRunningChange)
  onRunningChangeRef.current = onRunningChange
  useEffect(() => { onRunningChangeRef.current?.(running) }, [running])
  // Leaving the step (or unmounting for any reason) must stop the batch, not leave it rendering unseen.
  useEffect(() => () => { abortRef.current?.abort(); onRunningChangeRef.current?.(false) }, [])

  const toggle = (id: PreviewAspectRatio) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const run = async () => {
    if (!picked.length || running) return
    const ac = new AbortController(); abortRef.current = ac
    setRunning(true); setProgress(0); setNote(null)
    try {
      const { downloadWebExportBlob } = await import('../webExport')
      const stamp = Date.now().toString(36)
      const results = await exportFormats({
        inputProps, aspects: picked, signal: ac.signal,
        onProgress: (p, aspect, i, total) => { setProgress(p); setLabel(`${aspect} (${i + 1} of ${total})`) },
        onFile: (aspect, r) => downloadWebExportBlob(r.blob, `personalized-${stamp}-${formatFileSuffix(aspect)}.${r.extension}`),
      })
      const ok = results.filter((r) => r.result.ok).length
      const failed = results.filter((r) => !r.result.ok && (r.result as { reason?: string }).reason !== 'cancelled')
      if (ac.signal.aborted) setNote(`Cancelled. ${ok} file${ok === 1 ? '' : 's'} saved.`)
      else if (failed.length) setNote(`${ok} saved. ${failed.map((f) => `${f.aspect}: ${(f.result as { error: string }).error}`).join(' ')}`)
      else setNote(`${ok} file${ok === 1 ? '' : 's'} saved to your downloads.`)
    } catch (error) {
      // A failed lazy import or a throw from the renderer must reach the person, not become an unhandled rejection.
      setNote(`Export failed: ${error instanceof Error && error.message ? error.message : 'something went wrong.'}`)
    } finally { setRunning(false); abortRef.current = null }
  }

  return (
    <div data-testid="extra-formats" style={{ marginTop: 12 }}>
      <div style={{ ...labelStyle, marginBottom: 6 }}>Also export other shapes</div>
      <div role="group" aria-label="Extra export shapes" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {EXPORT_FORMATS.filter((f) => f.id !== current).map((f) => (
          <button key={f.id} type="button" data-testid={`extra-format-${formatFileSuffix(f.id)}`} aria-pressed={picked.includes(f.id)} title={f.hint} disabled={running} onClick={() => toggle(f.id)} style={chipStyle(picked.includes(f.id))}>{f.label}</button>
        ))}
        <button type="button" data-testid="extra-formats-run" disabled={disabled || running || picked.length === 0} onClick={() => void run()} style={{ ...secondaryButtonStyle, minHeight: 30, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6, opacity: disabled || picked.length === 0 ? 0.5 : 1 }}>
          {running ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
          {running ? `Rendering ${label} · ${Math.round(progress * 100)}%` : `Download ${picked.length || ''} shape${picked.length === 1 ? '' : 's'}`.replace('  ', ' ')}
        </button>
        {running && (
          <button type="button" data-testid="extra-formats-cancel" onClick={() => abortRef.current?.abort()} style={{ ...secondaryButtonStyle, minHeight: 30, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 }}><X size={12} /> Cancel</button>
        )}
      </div>
      <p style={{ ...hintStyle, margin: '6px 0 0' }}>Each shape is rendered here in your browser, one after another. Layers you placed by hand keep their position as a fraction of the frame, so check each shape in the preview first.</p>
      {note && <p role="status" data-testid="extra-formats-note" style={{ ...hintStyle, margin: '6px 0 0', color: C.cyan }}>{note}</p>}
    </div>
  )
}
