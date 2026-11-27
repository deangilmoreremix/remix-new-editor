import { useState } from 'react'
import { Captions, Copy, Download, Trash2 } from 'lucide-react'
import { downloadBlob } from '../preview/capite/subtitleExport'
import { useDemoPersonalize } from '../DemoPersonalizeProvider'
import { C, hintStyle, labelStyle, secondaryButtonStyle } from './tokens'
import { DEFAULT_CAPTION_STYLE, MAX_CUES, captionPreset, cuesToSrt, cuesToVtt, type CaptionSettings } from '../preview/captions'
import { captionsToStudioInput, studioToCaptionSettings } from '../preview/captionsFromStudio'
import { cleanStudioCaptions, withPositionY } from '../captions/studioCaptions'
import { transcriptText } from '../captions/textTools'
import { captionAvoid, clearOf, coveredNow } from './captionAvoid'
import { captionsToAss } from '../preview/captionAss'
import type { PreviewInputProps } from '../preview/types'

/**
 * Captions (Step 4): the free on-device Caption Studio is the one place to make and edit them (Whisper runs in the browser, every word is
 * timed; look, font, weight, height, line edits, find and replace all live there). This panel opens it, shows what was made, warns when the
 * captions cover other text, and downloads the lines. Drawn live and in the exported video by the same code.
 */
const smallButton = { ...secondaryButtonStyle, minHeight: 28, fontSize: 10, padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 5 } as const

export function CaptionsPanel({ inputProps }: { inputProps: PreviewInputProps }): React.JSX.Element {
  const { previewSettings, updatePreviewComposition } = useDemoPersonalize()
  const [notice, setNotice] = useState<string | null>(null)
  const [copied, setCopied] = useState<'copied' | 'failed' | null>(null)
  const brand = previewSettings.brandColors
  const caps = previewSettings.captions
  const videoUrl = inputProps.videoUrl && !inputProps.isImageSource ? inputProps.videoUrl : null
  const set = (c: CaptionSettings | undefined) => updatePreviewComposition({ captions: c })

  // What the captions cover: other layers that are on screen while a caption is.
  const avoid = caps ? captionAvoid({ layers: previewSettings.layers, width: previewSettings.width, height: previewSettings.height, fps: previewSettings.fps, captions: caps }, inputProps.brand) : null
  const covered = avoid ? coveredNow(avoid) : 0
  const clear = avoid && covered > 0 ? clearOf(avoid) : null

  /** Opens the Caption Studio on this video; what it makes becomes the captions (its pages and style, plus lines with exact word times). */
  const openStudio = async () => {
    if (!videoUrl) { setNotice('Add a video first. The Caption Studio writes captions from its speech.'); return }
    try {
      const [{ openCaptionStudio }, { studioPayload }] = await Promise.all([import('../../../../../lib/captionStudio/modal.js'), import('../../../../../lib/captionStudio/studioData.js')])
      const start = caps?.studio
        ? { words: caps.studio.pages.flatMap((p) => p.tokens.map((t) => ({ text: t.text.trim(), startMs: t.fromMs, endMs: t.toMs }))), style: caps.studio.style as unknown as Record<string, unknown> }
        : caps ? captionsToStudioInput(caps) : { words: [], style: undefined }
      openCaptionStudio({
        videoUrl,
        // Remotion's convention: every word but the first starts with a space.
        captions: start.words.map((w, i) => ({ text: (i ? ' ' : '') + w.text, startMs: w.startMs, endMs: w.endMs })),
        style: start.style,
        accentColor: C.cyan,
        applyLabel: 'Use these captions in the video',
        onApply: ({ captions, captionStyle }: { captions: unknown[]; captionStyle: Record<string, unknown> }) => {
          const payload = studioPayload(captions, captionStyle)
          const { settings, truncated } = studioToCaptionSettings(payload, brand)
          const studio = cleanStudioCaptions(payload)
          if (settings.cues.length === 0 || !studio) { setNotice('No captions were made, so nothing was changed.'); return }
          set({ ...settings, studio, ...(caps?.language ? { language: caps.language } : {}) })
          setNotice(`${settings.cues.length} line${settings.cues.length > 1 ? 's' : ''} written from the video’s speech${truncated ? `. A project keeps at most ${MAX_CUES} lines, so the rest were left out` : ''}.`)
        },
        onError: (err: Error) => setNotice(err?.message || 'The Caption Studio could not open.'),
      })
    } catch (err) {
      setNotice((err as Error)?.message || 'The Caption Studio could not open.')
    }
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(transcriptText((caps?.cues ?? []).map((c) => c.text))); setCopied('copied') } catch { setCopied('failed') }
  }

  return (
    <div data-testid="captions-panel" style={{ marginTop: 12 }}>
      <div style={{ ...labelStyle, marginBottom: 6 }}>Captions</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button" data-testid="captions-open-studio" disabled={!videoUrl} onClick={() => void openStudio()}
          style={{ ...secondaryButtonStyle, minHeight: 30, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6, opacity: videoUrl ? 1 : 0.5 }}
        >
          <Captions size={12} /> {caps ? 'Edit in the Caption Studio' : 'Open Caption Studio'}
        </button>
        <span style={{ ...hintStyle, margin: 0 }}>Free, on this device. Transcribe, edit, restyle and recolour in one window.</span>
      </div>
      {notice && <p data-testid="captions-notice" style={{ ...hintStyle, margin: '6px 0 0' }}>{notice}</p>}

      {caps && (
        <div data-testid="captions-result" style={{ marginTop: 8, display: 'grid', gap: 8 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.text, fontWeight: 700 }}>
            <input type="checkbox" data-testid="captions-enabled" checked={caps.enabled} onChange={(e) => set({ ...caps, enabled: e.target.checked })} />
            Show captions in the video
          </label>
          <p data-testid="captions-summary" style={{ ...hintStyle, margin: 0 }}>
            {caps.cues.length} lines{caps.studio ? ' · drawn as designed in the Caption Studio (look, font, motion and height included)' : ' · open the Caption Studio to restyle or fix these'}.
          </p>
          {covered > 0 && (
            <p data-testid="captions-overlap" role="status" style={{ ...hintStyle, margin: 0, color: C.text }}>
              The captions cover {covered === 1 ? 'a text layer' : `${covered} text layers`} while they are on screen.
              {clear && !clear.cleared ? ' There is no clear spot on this frame: shorten the lines or move the other text.' : ' '}
              {clear?.cleared && caps.studio && <button type="button" data-testid="captions-clear-now" onClick={() => set({ ...caps, studio: withPositionY(caps.studio!, clear.positionY) })} style={smallButton}>Move them clear</button>}
            </p>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" data-testid="captions-srt" onClick={() => downloadBlob(cuesToSrt(caps.cues), 'captions.srt', 'application/x-subrip')} style={smallButton}><Download size={11} /> Download .srt</button>
            <button type="button" data-testid="captions-vtt" onClick={() => downloadBlob(cuesToVtt(caps.cues), 'captions.vtt', 'text/vtt')} style={smallButton}><Download size={11} /> Download .vtt</button>
            <button type="button" data-testid="captions-txt" onClick={() => downloadBlob(transcriptText(caps.cues.map((c) => c.text)), 'captions.txt', 'text/plain')} style={smallButton}><Download size={11} /> Download .txt</button>
            <button type="button" data-testid="captions-ass" onClick={() => downloadBlob(captionsToAss(caps, { width: previewSettings.width || 1920, height: previewSettings.height || 1080 }), 'captions.ass', 'text/x-ssa')} style={smallButton}><Download size={11} /> Download .ass</button>
            <button type="button" data-testid="captions-copy" onClick={() => void copy()} style={smallButton}><Copy size={11} /> Copy text</button>
            <button type="button" data-testid="captions-remove" onClick={() => set(undefined)} style={smallButton}><Trash2 size={11} /> Remove captions</button>
            {copied && <span data-testid="captions-copy-note" style={{ ...hintStyle, margin: 0, alignSelf: 'center' }}>{copied === 'copied' ? 'Copied.' : 'Your browser would not copy it. Select the text and copy it yourself.'}</span>}
          </div>
          <p style={{ ...hintStyle, margin: 0 }}>
            Captions are drawn into the preview and into every file you export, and follow the video&apos;s own speech.
            {previewSettings.audio ? ' You chose a different sound track, so check that the captions still match what people will hear.' : ''}
          </p>
        </div>
      )}
    </div>
  )
}
