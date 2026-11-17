'use client'

import { useState } from 'react'
import { Captions as CaptionsIcon, Copy, Download, Trash2 } from 'lucide-react'
import { clockLabel, cuesToSrt, cuesToText, cuesToVtt } from '../captions/captionCues'
import { CAPITE_CAPTION_STYLES, CAPITE_CATEGORIES, capiteStyleById } from '../captions/capiteStyles'
import { CAPTION_POSITIONS, CAPTION_STYLES } from '../captions/captionStyle'
import { useCaptions } from '../captions/useCaptions'
import { useDemoPersonalize } from '../DemoPersonalizeProvider'
import { LocalAINotice } from './LocalAINotice'
import { C, chipStyle, hintStyle, inputStyle, labelStyle, secondaryButtonStyle } from './tokens'

function saveText(text: string, fileName: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url; a.download = fileName
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const smallButton = { ...secondaryButtonStyle, minHeight: 28, fontSize: 10, padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 5 } as const

/**
 * Captions, free and on this device. The video's own speech becomes caption text that is DRAWN INTO the video (live in
 * the preview and in every export, including the extra shapes), and can also be downloaded as SRT/VTT files for
 * platforms that take a separate caption file. Lines can be corrected; the speech recogniser is not perfect.
 */
export function CaptionsPanel({ videoUrl, disabled }: { videoUrl: string | null; disabled?: boolean }): React.JSX.Element | null {
  const c = useCaptions(videoUrl)
  const { previewSettings } = useDemoPersonalize()
  const [copied, setCopied] = useState<'copied' | 'failed' | null>(null)
  const [confirmRedo, setConfirmRedo] = useState(false)
  if (!videoUrl) return null
  const busy = c.ai.phase !== 'idle'
  const cues = c.captions?.cues ?? []
  const copy = async () => {
    try { await navigator.clipboard.writeText(cuesToText(cues)); setCopied('copied') } catch { setCopied('failed') }
  }
  const generate = () => { setConfirmRedo(false); void c.generate() }
  return (
    <div data-testid="captions-panel" style={{ marginTop: 12 }}>
      <div style={{ ...labelStyle, marginBottom: 6 }}>Captions</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button" data-testid="captions-generate" disabled={disabled || busy}
          onClick={() => (c.captions ? setConfirmRedo(true) : generate())}
          style={{ ...secondaryButtonStyle, minHeight: 30, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6, opacity: disabled || busy ? 0.5 : 1 }}
        >
          <CaptionsIcon size={12} /> {c.captions ? 'Write them again' : 'Write captions from the video’s sound'}
        </button>
        <span style={{ ...hintStyle, margin: 0 }}>Free, on this device.</span>
      </div>
      {confirmRedo && (
        <div data-testid="captions-redo-confirm" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
          <span style={{ ...hintStyle, margin: 0, color: C.text }}>This replaces the captions you have now, including any corrections.</span>
          <button type="button" data-testid="captions-redo-yes" onClick={generate} style={smallButton}>Replace them</button>
          <button type="button" data-testid="captions-redo-no" onClick={() => setConfirmRedo(false)} style={smallButton}>Keep them</button>
        </div>
      )}
      <LocalAINotice ai={c.ai} doing="turns the video’s own speech into caption text" />
      {c.note && <p data-testid="captions-note" style={{ ...hintStyle, margin: '6px 0 0' }}>{c.note}</p>}

      {c.captions && (
        <div data-testid="captions-result" style={{ marginTop: 8, display: 'grid', gap: 8 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.text, fontWeight: 700 }}>
            <input type="checkbox" data-testid="captions-enabled" checked={c.captions.enabled} onChange={(e) => c.setEnabled(e.target.checked)} />
            Show captions in the video
          </label>
          <div role="group" aria-label="Caption style" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ ...hintStyle, margin: 0 }}>Look:</span>
            {CAPTION_STYLES.map((s) => (
              <button key={s.id} type="button" data-testid={`captions-style-${s.id}`} aria-pressed={c.captions!.style === s.id} title={s.hint} onClick={() => c.setStyle(s.id)} style={chipStyle(c.captions!.style === s.id)}>{s.label}</button>
            ))}
            <span style={{ ...hintStyle, margin: '0 0 0 6px' }}>Place:</span>
            {CAPTION_POSITIONS.map((p) => (
              <button key={p.id} type="button" data-testid={`captions-position-${p.id}`} aria-pressed={c.captions!.position === p.id} onClick={() => c.setPosition(p.id)} style={chipStyle(c.captions!.position === p.id)}>{p.label}</button>
            ))}
          </div>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, color: C.text }}>
            <span style={{ ...hintStyle, margin: 0 }}>More looks:</span>
            <select data-testid="captions-capite-select" aria-label="More caption looks" value={capiteStyleById(c.captions!.style) ? c.captions!.style : ''} onChange={(e) => { if (e.target.value) c.setStyle(e.target.value) }} style={{ ...inputStyle, width: 'auto', minHeight: 30, fontSize: 11 }}>
              <option value="">Choose one of {CAPITE_CAPTION_STYLES.length}…</option>
              {CAPITE_CATEGORIES.map((cat) => (
                <optgroup key={cat.id} label={cat.label}>
                  {CAPITE_CAPTION_STYLES.filter((s) => s.category === cat.id).map((s) => <option key={s.id} value={s.id}>{s.name} · {s.bestFor.split(',')[0]}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          {capiteStyleById(c.captions!.style) && <p data-testid="captions-capite-hint" style={{ ...hintStyle, margin: 0 }}>{capiteStyleById(c.captions!.style)!.description}. Fonts that are not on this device fall back to the studio font.</p>}

          <p data-testid="captions-look-hint" style={{ ...hintStyle, margin: 0 }}>Bold stands out most; Bar is the safest on very busy footage; Clean is the plainest.</p>

          <ol data-testid="captions-list" style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 220, overflow: 'auto', display: 'grid', gap: 4 }}>
            {cues.map((cue, i) => (
              <li key={`${cue.startMs}-${i}-${cue.text}`} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, color: C.text }}>
                <span style={{ color: C.muted, minWidth: 34 }}>{clockLabel(cue.startMs)}</span>
                <input
                  data-testid={`captions-edit-${i}`} aria-label={`Caption at ${clockLabel(cue.startMs)}`} defaultValue={cue.text}
                  onBlur={(e) => { if (e.target.value !== cue.text) c.editCue(i, e.target.value) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  style={{ ...inputStyle, minHeight: 28, height: 28, fontSize: 11, padding: '0 8px', flex: 1 }}
                />
              </li>
            ))}
          </ol>
          <p style={{ ...hintStyle, margin: 0 }}>Written automatically, so read it through and fix any mistakes. Clear a line to delete it.</p>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" data-testid="captions-srt" onClick={() => saveText(cuesToSrt(cues), 'captions.srt', 'application/x-subrip')} style={smallButton}><Download size={11} /> Download .srt</button>
            <button type="button" data-testid="captions-vtt" onClick={() => saveText(cuesToVtt(cues), 'captions.vtt', 'text/vtt')} style={smallButton}><Download size={11} /> Download .vtt</button>
            <button type="button" data-testid="captions-copy" onClick={() => void copy()} style={smallButton}><Copy size={11} /> Copy text</button>
            <button type="button" data-testid="captions-remove" onClick={c.remove} style={smallButton}><Trash2 size={11} /> Remove captions</button>
            {copied && <span data-testid="captions-copy-note" style={{ ...hintStyle, margin: 0, alignSelf: 'center' }}>{copied === 'copied' ? 'Copied.' : 'Your browser would not copy it. Select the text above instead.'}</span>}
          </div>
          <p data-testid="captions-notes" style={{ ...hintStyle, margin: 0 }}>
            Captions are drawn into the preview and into every file you export, and follow the video&apos;s own speech.
            {previewSettings.audio ? ' You chose a different sound track, so check that the captions still match what people will hear.' : ''}
            {' '}They are hidden while the end card shows.
          </p>
        </div>
      )}
    </div>
  )
}
