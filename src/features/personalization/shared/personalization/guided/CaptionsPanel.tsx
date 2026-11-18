'use client'

import { useEffect, useRef, useState } from 'react'
import { Captions as CaptionsIcon, Copy, Crosshair, Download, Trash2 } from 'lucide-react'
import { captionsToAss } from '../captions/captionAss'
import { clockLabel, cuesToSrt, cuesToText, cuesToVtt } from '../captions/captionCues'
import { LANGUAGES } from '../captions/scripts'
import { transcriptText, type Casing } from '../captions/textTools'
import { CAPITE_CAPTION_STYLES, CAPITE_CATEGORIES, capiteStyleById } from '../captions/capiteStyles'
import { CAPTION_POSITIONS, CAPTION_STYLES } from '../captions/captionStyle'
import { useCaptions } from '../captions/useCaptions'
import { useDemoPersonalize } from '../DemoPersonalizeProvider'
import { useLiveState } from '../preview/liveBridge'
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
  const [find, setFind] = useState('')
  const [replaceWith, setReplaceWith] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [editNotice, setEditNotice] = useState<string | null>(null)
  const listRef = useRef<HTMLOListElement | null>(null)
  const live = useLiveState()
  const fps = previewSettings.fps > 0 ? previewSettings.fps : 30
  // The line that is playing in the live preview: marked, and scrolled into view inside the list (never the page).
  const playingMs = live.frame === null ? null : (live.frame / fps) * 1000
  const playing = playingMs === null ? -1 : (c.captions?.cues ?? []).findIndex((x) => playingMs >= x.startMs && playingMs < x.endMs)
  useEffect(() => {
    const list = listRef.current
    if (playing < 0 || !list) return
    const row = list.querySelector<HTMLElement>(`[data-testid="captions-line-${playing}"]`)
    if (!row) return
    if (row.offsetTop < list.scrollTop) list.scrollTop = Math.max(0, row.offsetTop - 4)
    else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight + 4
  }, [playing])
  if (!videoUrl) return null
  const busy = c.ai.phase !== 'idle'
  const cues = c.captions?.cues ?? []
  const copy = async () => {
    try { await navigator.clipboard.writeText(cuesToText(cues)); setCopied('copied') } catch { setCopied('failed') }
  }
  const generate = () => { setConfirmRedo(false); void c.generate() }
  const replaceAll = () => {
    if (!find) return
    const n = c.replaceAll(find, replaceWith, { matchCase, wholeWord })
    setEditNotice(n ? `${n} replacement${n > 1 ? 's' : ''}.` : 'Nothing to replace.')
  }
  const seconds = (ms: number) => Math.round(ms / 10) / 100
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
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.text }}>
          <span style={{ ...hintStyle, margin: 0 }}>Language:</span>
          <select data-testid="captions-language" aria-label="Caption language" value={c.language} disabled={disabled || busy} onChange={(e) => c.setLanguage(e.target.value)} style={{ ...inputStyle, width: 'auto', minHeight: 30, fontSize: 11, padding: '0 8px' }}>
            <option value="auto">Detect automatically</option>
            {LANGUAGES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </label>
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

          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            <input data-testid="captions-find" aria-label="Find in captions" placeholder="Find" value={find} onChange={(e) => { setFind(e.target.value); setEditNotice(null) }} style={{ ...inputStyle, width: 110, minHeight: 28, height: 28, padding: '0 8px', fontSize: 11 }} />
            <input data-testid="captions-replace" aria-label="Replace with" placeholder="Replace with" value={replaceWith} onChange={(e) => setReplaceWith(e.target.value)} style={{ ...inputStyle, width: 110, minHeight: 28, height: 28, padding: '0 8px', fontSize: 11 }} />
            <button type="button" data-testid="captions-find-case" aria-pressed={matchCase} onClick={() => setMatchCase((v) => !v)} style={chipStyle(matchCase)}>Aa</button>
            <button type="button" data-testid="captions-find-word" aria-pressed={wholeWord} onClick={() => setWholeWord((v) => !v)} style={chipStyle(wholeWord)}>Whole word</button>
            <button type="button" data-testid="captions-replace-all" onClick={replaceAll} style={smallButton}>Replace all</button>
            <span style={{ width: 6 }} />
            {(['upper', 'title', 'lower'] as Casing[]).map((k) => (
              <button key={k} type="button" data-testid={`captions-case-${k}`} onClick={() => c.recase(k)} style={smallButton}>{k === 'upper' ? 'UPPER' : k === 'title' ? 'Title' : 'lower'}</button>
            ))}
          </div>
          {editNotice && <p role="status" data-testid="captions-edit-notice" style={{ ...hintStyle, margin: 0 }}>{editNotice}</p>}

          <ol ref={listRef} data-testid="captions-list" style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 320, overflow: 'auto', display: 'grid', gap: 6, position: 'relative' }}>
            {cues.map((cue, i) => (
              <li key={i} data-testid={`captions-line-${i}`} data-active={String(i === playing)} style={{ display: 'grid', gap: 4, fontSize: 11, color: C.text, border: `1px solid ${i === playing ? C.cyan : 'transparent'}`, borderRadius: 8, padding: 2 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {live.seek ? (
                    <button type="button" data-testid={`captions-seek-${i}`} aria-label={`Jump to the caption at ${clockLabel(cue.startMs)}`} onClick={() => live.seek?.(Math.round((cue.startMs / 1000) * fps))} style={{ ...smallButton, minHeight: 26, padding: '0 6px' }}><Crosshair size={11} /> {clockLabel(cue.startMs)}</button>
                  ) : (
                    <span style={{ color: C.muted, minWidth: 34 }}>{clockLabel(cue.startMs)}</span>
                  )}
                  <input
                    key={cue.text}
                    data-testid={`captions-edit-${i}`} aria-label={`Caption at ${clockLabel(cue.startMs)}`} defaultValue={cue.text}
                    onBlur={(e) => { if (e.target.value !== cue.text) c.editCue(i, e.target.value) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    style={{ ...inputStyle, minHeight: 28, height: 28, fontSize: 11, padding: '0 8px', flex: 1 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: C.muted, fontSize: 10 }}>Starts
                    <input type="number" data-testid={`captions-start-${i}`} aria-label={`Caption ${i + 1} starts (seconds)`} min={0} step={0.1} value={seconds(cue.startMs)} onChange={(e) => { if (e.target.value.trim() !== '') c.setCueTimes(i, Number(e.target.value) * 1000, cue.endMs) }} style={{ ...inputStyle, width: 64, minHeight: 24, height: 24, padding: '0 4px', fontSize: 10 }} />
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: C.muted, fontSize: 10 }}>Ends
                    <input type="number" data-testid={`captions-end-${i}`} aria-label={`Caption ${i + 1} ends (seconds)`} min={0} step={0.1} value={seconds(cue.endMs)} onChange={(e) => { if (e.target.value.trim() !== '') c.setCueTimes(i, cue.startMs, Number(e.target.value) * 1000) }} style={{ ...inputStyle, width: 64, minHeight: 24, height: 24, padding: '0 4px', fontSize: 10 }} />
                  </label>
                  {([['start', 'minus', -100, 0], ['start', 'plus', 100, 0], ['end', 'minus', 0, -100], ['end', 'plus', 0, 100]] as const).map(([edge, dir, dS, dE]) => (
                    <button key={`${edge}-${dir}`} type="button" data-testid={`captions-nudge-${i}-${edge}-${dir}`} aria-label={`${edge === 'start' ? 'Start' : 'End'} ${dir === 'minus' ? 'earlier' : 'later'} by 0.1 seconds, caption ${i + 1}`} onClick={() => c.nudgeCue(i, dS, dE)} style={{ ...smallButton, minHeight: 24, padding: '0 6px' }}>{edge === 'start' ? 'Start' : 'End'} {dir === 'minus' ? '−' : '+'}0.1</button>
                  ))}
                </div>
              </li>
            ))}
          </ol>
          <p style={{ ...hintStyle, margin: 0 }}>Written automatically, so read it through and fix any mistakes. Clear a line to delete it.</p>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" data-testid="captions-srt" onClick={() => saveText(cuesToSrt(cues), 'captions.srt', 'application/x-subrip')} style={smallButton}><Download size={11} /> Download .srt</button>
            <button type="button" data-testid="captions-vtt" onClick={() => saveText(cuesToVtt(cues), 'captions.vtt', 'text/vtt')} style={smallButton}><Download size={11} /> Download .vtt</button>
            <button type="button" data-testid="captions-txt" onClick={() => saveText(transcriptText(cues.map((x) => x.text)), 'captions.txt', 'text/plain')} style={smallButton}><Download size={11} /> Download .txt</button>
            <button type="button" data-testid="captions-ass" onClick={() => saveText(captionsToAss(c.captions!, { width: previewSettings.width || 1920, height: previewSettings.height || 1080, accent: previewSettings.brandColors?.accent ?? '#facc15' }), 'captions.ass', 'text/x-ssa')} style={smallButton}><Download size={11} /> Download .ass</button>
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
