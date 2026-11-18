import React from 'react'
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { capiteStyleById, capiteTextCss, capiteWordCss } from '../captions/capiteStyles'
import { useCaptionFont } from '../captions/capiteFontLoader'
import { displayScale, scriptFor, withScriptFonts } from '../captions/scripts'
import { activeCueAt, activeWordIndex, captionLayout } from '../captions/captionStyle'
import { endCardFrames } from './endCard'
import { fontStackById } from './presets'
import type { PersonalizationPreviewSettings, PreviewCaptions } from './types'

/** Above every overlay layer, below the end card (zIndex 10000). */
export const CAPTIONS_Z_INDEX = 9000

/** Visible outline so captions stay readable on any footage (an 8-direction text shadow; no filters, so it exports reliably). */
function outline(px: number, color: string): string {
  const d = Math.max(1, Math.round(px))
  return [[-d, -d], [0, -d], [d, -d], [-d, 0], [d, 0], [-d, d], [0, d], [d, d]].map(([x, y]) => `${x}px ${y}px 0 ${color}`).join(', ')
}

/**
 * Burned-in captions: the line being spoken, drawn straight into the frame so it is in the preview and in every
 * exported file. Draws only for the video the captions were written for, only while switched on, and never over the
 * end card. No network and no fonts beyond the composition's own stack.
 */
export const CaptionsLayer: React.FC<{
  captions?: PreviewCaptions
  videoUrl: string | null
  settings: PersonalizationPreviewSettings
  width: number
  height: number
}> = ({ captions, videoUrl, settings, width, height }) => {
  const frame = useCurrentFrame()
  // A Capite look draws in its own embedded font: hold the preview and the export until it is ready.
  const look = capiteStyleById(captions?.style)
  useCaptionFont(look?.fontName, { weight: look?.bold ? 800 : 500, italic: look?.italic })
  if (!captions?.enabled || !captions.cues.length || !videoUrl || captions.forUrl !== videoUrl) return null
  const fps = settings.fps > 0 ? settings.fps : 30
  if (settings.showEndCard && frame >= endCardFrames(settings.durationInFrames).start) return null
  const ms = (frame / fps) * 1000
  const cue = activeCueAt(captions.cues, ms)
  if (!cue) return null

  const layout = captionLayout(captions.style, captions.position, width, height)
  // Other writing systems: its fonts after the look's own, a smaller size for wide letters, and right-to-left for Arabic and Hebrew.
  // The language is the saved one, or read from the letters when there is none.
  const script = scriptFor(captions.language, cue.text)
  const fs = Math.max(10, Math.round(layout.fontSizePx * displayScale(captions.language, cue.text)))
  const font = withScriptFonts(fontStackById(undefined), script)
  const capite = capiteStyleById(captions.style)
  const wordIdx = captions.style === 'bold' || capite ? activeWordIndex(cue, ms) : -1
  const justify = layout.anchor === 'bottom' ? 'flex-end' : layout.anchor === 'top' ? 'flex-start' : 'center'

  const text: React.CSSProperties = capite ? {
    ...(capiteTextCss(capite, fs, font) as React.CSSProperties),
    lineHeight: 1.18, maxWidth: layout.maxWidthPx, textAlign: 'center', ...(script.rtl ? { direction: 'rtl' as const } : {}),
  } : {
    fontFamily: font,
    fontSize: fs,
    lineHeight: 1.18,
    maxWidth: layout.maxWidthPx,
    textAlign: 'center',
    ...(script.rtl ? { direction: 'rtl' as const } : {}),
    color: '#ffffff',
    fontWeight: captions.style === 'bold' ? 900 : 700,
    ...(captions.style === 'bar'
      ? { background: 'rgba(0,0,0,0.68)', padding: `${Math.round(fs * 0.28)}px ${Math.round(fs * 0.55)}px`, borderRadius: Math.round(fs * 0.28) }
      : captions.style === 'bold'
        ? { textShadow: outline(fs * 0.07, '#000000'), letterSpacing: '0.01em' }
        // Plain look: white text with a THIN dark outline (about half Bold's) and a soft shadow. The shadow alone vanished on
        // light footage; the outline keeps it readable on any background while it still looks lighter than Bold.
        : { textShadow: `${outline(fs * 0.035, 'rgba(0,0,0,0.85)')}, 0 ${Math.round(fs * 0.06)}px ${Math.round(fs * 0.2)}px rgba(0,0,0,0.75)` }),
  }
  const accent = settings.brandColors.accent

  return (
    <AbsoluteFill
      style={{ zIndex: CAPTIONS_Z_INDEX, pointerEvents: 'none', display: 'flex', flexDirection: 'column', justifyContent: justify, alignItems: 'center', padding: `${layout.marginPx}px ${Math.round(width * 0.07)}px` }}
    >
      <div data-testid="captions-layer" data-caption-text={cue.text} style={text}>
        {wordIdx >= 0 && cue.words && capite
          ? cue.words.map((w, i) => (
              <span key={`${w.startMs}-${i}`} style={capiteWordCss(capite, i === wordIdx ? 'active' : i < wordIdx ? 'spoken' : 'idle', fs) as React.CSSProperties}>{i > 0 ? ' ' : ''}{w.text}</span>
            ))
          : wordIdx >= 0 && cue.words
          ? cue.words.map((w, i) => (
              <span key={`${w.startMs}-${i}`} style={{ color: i === wordIdx ? accent : '#ffffff' }}>{i > 0 ? ' ' : ''}{w.text}</span>
            ))
          : cue.text}
      </div>
    </AbsoluteFill>
  )
}
