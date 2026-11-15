'use client'

import { useState } from 'react'
import { Captions as CaptionsIcon, Copy, Download } from 'lucide-react'
import { clockLabel, cuesToSrt, cuesToText, cuesToVtt } from '../captions/captionCues'
import { useCaptions } from '../captions/useCaptions'
import { LocalAINotice } from './LocalAINotice'
import { C, hintStyle, labelStyle, secondaryButtonStyle } from './tokens'

function saveText(text: string, fileName: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url; a.download = fileName
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * "Write captions": free speech-to-text on this device. v1 gives the person the caption text and standard caption
 * files (SRT/VTT) to upload with the video on YouTube, Facebook, LinkedIn and most other platforms. The captions are
 * not drawn into the rendered video itself.
 */
export function CaptionsPanel({ videoUrl, disabled }: { videoUrl: string | null; disabled?: boolean }): React.JSX.Element | null {
  const captions = useCaptions(videoUrl)
  const [copied, setCopied] = useState<'copied' | 'failed' | null>(null)
  if (!videoUrl) return null
  const busy = captions.ai.phase !== 'idle'
  const copy = async () => {
    try { await navigator.clipboard.writeText(cuesToText(captions.cues ?? [])); setCopied('copied') } catch { setCopied('failed') }
  }
  return (
    <div data-testid="captions-panel" style={{ marginTop: 12 }}>
      <div style={{ ...labelStyle, marginBottom: 6 }}>Captions</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" data-testid="captions-generate" disabled={disabled || busy} onClick={() => void captions.generate()} style={{ ...secondaryButtonStyle, minHeight: 30, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6, opacity: disabled || busy ? 0.5 : 1 }}>
          <CaptionsIcon size={12} /> {captions.cues ? 'Write them again' : 'Write captions from the video’s sound'}
        </button>
        <span style={{ ...hintStyle, margin: 0 }}>Free, on this device.</span>
      </div>
      <LocalAINotice ai={captions.ai} doing="turns the video’s own speech into caption text" />
      {captions.note && <p data-testid="captions-note" style={{ ...hintStyle, margin: '6px 0 0' }}>{captions.note}</p>}
      {captions.cues && (
        <div data-testid="captions-result" style={{ marginTop: 8 }}>
          <ol data-testid="captions-list" style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 180, overflow: 'auto', display: 'grid', gap: 4 }}>
            {captions.cues.map((c, i) => (
              <li key={`${c.startMs}-${i}`} style={{ display: 'flex', gap: 8, fontSize: 11, color: C.text }}>
                <span style={{ color: C.muted, minWidth: 34 }}>{clockLabel(c.startMs)}</span><span>{c.text}</span>
              </li>
            ))}
          </ol>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            <button type="button" data-testid="captions-srt" onClick={() => saveText(cuesToSrt(captions.cues ?? []), 'captions.srt', 'application/x-subrip')} style={{ ...secondaryButtonStyle, minHeight: 28, fontSize: 10, padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Download size={11} /> Download .srt</button>
            <button type="button" data-testid="captions-vtt" onClick={() => saveText(cuesToVtt(captions.cues ?? []), 'captions.vtt', 'text/vtt')} style={{ ...secondaryButtonStyle, minHeight: 28, fontSize: 10, padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Download size={11} /> Download .vtt</button>
            <button type="button" data-testid="captions-copy" onClick={() => void copy()} style={{ ...secondaryButtonStyle, minHeight: 28, fontSize: 10, padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Copy size={11} /> Copy text</button>
            {copied && <span data-testid="captions-copy-note" style={{ ...hintStyle, margin: 0, alignSelf: 'center' }}>{copied === 'copied' ? 'Copied.' : 'Your browser would not copy it. Select the text above instead.'}</span>}
          </div>
          <p style={{ ...hintStyle, margin: '6px 0 0' }}>Written automatically, so read it through before you publish. Upload the file next to your video; the captions are not drawn into the video itself.</p>
        </div>
      )}
    </div>
  )
}
