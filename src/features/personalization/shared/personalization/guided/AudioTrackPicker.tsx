'use client'

import { useRef, useState } from 'react'
import { Music, Trash2, Upload } from 'lucide-react'
import { C, badgeStyle, hintStyle, labelStyle, panelStyle, softPanelStyle } from './tokens'
import {
  AUDIO_ACCEPT_ATTRIBUTE,
  AUDIO_MAX_UPLOAD_BYTES,
  formatAudioSize,
  validateAudioFile,
} from './audioTrack'
import type { PreviewAudioSelection } from '../preview/types'

export interface AudioTrackPickerProps {
  /** The applied audio selection, or null when none is applied. */
  audio: PreviewAudioSelection | null
  /** Upload problem for the applied track, if any. */
  error?: string | null
  /** Apply a file: uploads it through the durable asset path. */
  onApply: (file: File) => void | Promise<void>
  /** Remove the applied track. */
  onRemove: () => void
}

/**
 * Optional customer audio track for the personalized video.
 *
 * Three plain states, no editor: pick a file → hear it back before applying →
 * hear the applied track and remove it. Selection never blocks the wizard, and
 * nothing here generates audio — it is the customer's own file.
 */
export function AudioTrackPicker({
  audio,
  error,
  onApply,
  onRemove,
}: AudioTrackPickerProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ file: File; url: string } | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleFile = (file: File | undefined) => {
    if (!file) return
    const message = validateAudioFile(file)
    if (message) {
      setPending(null)
      setValidationError(message)
      return
    }
    setValidationError(null)
    setPending({ file, url: URL.createObjectURL(file) })
  }

  const clearPending = () => {
    if (pending) URL.revokeObjectURL(pending.url)
    setPending(null)
  }

  const applyPending = () => {
    if (!pending) return
    const file = pending.file
    setPending(null)
    void onApply(file)
  }

  const shownError = validationError || error || null
  const saving = Boolean(audio && audio.url.startsWith('blob:'))

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <Music size={15} color={C.cyan} />
        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: C.text }}>
          Your audio (optional)
        </h3>
        {audio && <span style={{ ...badgeStyle('green'), marginLeft: 'auto' }}>{saving ? 'Saving…' : 'Added'}</span>}
      </div>
      <p style={{ ...hintStyle, marginTop: 0, marginBottom: 10 }}>
        Bring your own voiceover, jingle or background music and it is baked into your video. MP3, M4A,
        WAV, OGG or AAC, up to {formatAudioSize(AUDIO_MAX_UPLOAD_BYTES)}. Leave it empty to keep the
        video&apos;s own sound.
      </p>

      <label style={labelStyle} htmlFor="guided-audio-upload">Audio file</label>
      <input
        id="guided-audio-upload"
        ref={inputRef}
        type="file"
        accept={AUDIO_ACCEPT_ATTRIBUTE}
        onChange={(event) => handleFile(event.target.files?.[0])}
        style={{ ...softPanelStyle, width: '100%', color: C.text, fontSize: 12 }}
      />
      {shownError && (
        <p style={{ ...hintStyle, color: C.danger }} data-testid="audio-error">
          {shownError}
        </p>
      )}

      {/* Preview playback BEFORE the track is applied, with the basic controls
          browsers already provide (play/pause, volume, mute). */}
      {pending && (
        <div style={{ ...softPanelStyle, marginTop: 12 }} data-testid="audio-pending">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>{pending.file.name}</span>
            <span style={{ marginLeft: 'auto', color: C.muted2, fontSize: 10 }}>
              {formatAudioSize(pending.file.size)}
            </span>
          </div>
          <audio
            controls
            src={pending.url}
            data-testid="audio-preview-player"
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={applyPending} style={{ ...softPanelStyle, color: C.cyan, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
              <Upload size={13} style={{ verticalAlign: '-2px', marginRight: 6 }} />
              Use this audio
            </button>
            <button type="button" onClick={clearPending} style={{ ...softPanelStyle, color: C.muted, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
              Discard
            </button>
          </div>
        </div>
      )}

      {audio && (
        <div style={{ ...softPanelStyle, marginTop: 12 }} data-testid="audio-applied">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>{audio.name}</span>
            <button
              type="button"
              onClick={onRemove}
              style={{ ...softPanelStyle, marginLeft: 'auto', color: C.danger, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
            >
              <Trash2 size={12} style={{ verticalAlign: '-2px', marginRight: 5 }} />
              Remove
            </button>
          </div>
          <audio
            controls
            src={audio.url}
            data-testid="audio-applied-player"
            style={{ width: '100%' }}
          />
          <p style={hintStyle}>
            {saving
              ? 'Saving your audio so it is ready when you come back…'
              : 'Saved with your project — it plays in the preview and is included in the rendered video.'}
          </p>
        </div>
      )}
    </div>
  )
}
