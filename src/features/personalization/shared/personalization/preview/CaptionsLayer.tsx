import React from 'react'
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { capiteStyleById, capiteTextCss, capiteWordCss } from '../captions/capiteStyles'
import { CaptionFontGate } from '../captions/capiteFontLoader'
import { CAPTION_WEIGHTS, captionFontByName, captionFontStack } from '../captions/capiteFonts'
import { CUSTOM_BACKGROUND_OPACITY, resolveWeight, textTransformOf } from '../captions/captionCustom'
import { displayScale, scriptFor, withScriptFonts } from '../captions/scripts'
import { activeCueAt, activeWordIndex, captionLayout } from '../captions/captionStyle'
import { endCardFrames } from './endCard'
import { fontStackById } from './presets'
import type { PersonalizationPreviewSettings, PreviewCaptions } from './types'

/** Above every overlay layer, below the end card (zIndex 10000). */
export const CAPTIONS_Z_INDEX = 9000

/** Visible outline so captions stay readable on any footage (an 8-direction text shadow; no filters, so it exports reliably). */
const hexAlpha = (hex: string, a: number): string => { const h = hex.replace('#', ''); return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${a})` }

function outline(px: number, color: string): string {
  const d = Math.max(1, Math.round(px))
  return [[-d, -d], [0, -d], [d, -d], [-d, 0], [d, 0], [-d, d], [0, d], [d, d]].map(([x, y]) => `${x}px ${y}px 0 ${color}`).join(', ')
}

/**
 * Burned-in captions: the line being spoken, drawn straight into the frame so it is in the preview and in every
 * exported file. Draws only for the video the captions were written for, only while switched on, and never over the
 * end card. No network and no fonts beyond the composition's own stack.
 */
type LayerProps = {
  captions?: PreviewCaptions
  videoUrl: string | null
  settings: PersonalizationPreviewSettings
  width: number
  height: number
}

/** The layer, with a gate that holds the preview and the export until the caption's font (a Capite look's own, or a chosen one) is embedded and loaded. */
export const CaptionsLayer: React.FC<LayerProps> = (props) => {
  const look = capiteStyleById(props.captions?.style)
  const font = props.captions?.custom?.fontFamily ?? look?.fontName
  const gated = props.captions?.enabled && captionFontByName(font)
  return (
    <>
      {gated ? <CaptionFontGate name={font} weight={props.captions?.custom?.weight ? CAPTION_WEIGHTS[props.captions.custom.weight] : look?.bold ? 800 : 500} italic={look?.italic} /> : null}
      <CaptionsLayerLine {...props} />
    </>
  )
}

const CaptionsLayerLine: React.FC<LayerProps> = ({ captions, videoUrl, settings, width, height }) => {
  const frame = useCurrentFrame()
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
  const cu = captions.custom
  const font = withScriptFonts(fontStackById(undefined), script)
  const ocol = cu?.outlineColor
  const lookStyle = capiteStyleById(captions.style)
  // The chosen outline colour replaces the look's.
  const capite = lookStyle && cu?.outlineColor ? { ...lookStyle, outlineColor: cu.outlineColor } : lookStyle
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
        ? { textShadow: outline(fs * 0.07, ocol ?? '#000000'), letterSpacing: '0.01em' }
        // Plain look: white text with a THIN dark outline (about half Bold's) and a soft shadow. The shadow alone vanished on
        // light footage; the outline keeps it readable on any background while it still looks lighter than Bold.
        : { textShadow: `${outline(fs * 0.035, ocol ?? 'rgba(0,0,0,0.85)')}, 0 ${Math.round(fs * 0.06)}px ${Math.round(fs * 0.2)}px rgba(0,0,0,0.75)` }),
  }
  // The customizer, over the look: font, weight, italic, casing, a background behind the text, and a vertical offset.
  if (cu) {
    if (cu.fontFamily) text.fontFamily = captionFontStack(cu.fontFamily, font)
    if (cu.weight) text.fontWeight = resolveWeight(cu.weight, true)
    if (cu.italic !== undefined) text.fontStyle = cu.italic ? 'italic' : 'normal'
    if (cu.casing) text.textTransform = textTransformOf(cu.casing)
    if (cu.backgroundColor) Object.assign(text, { background: hexAlpha(cu.backgroundColor, CUSTOM_BACKGROUND_OPACITY), padding: `${Math.round(fs * 0.28)}px ${Math.round(fs * 0.55)}px`, borderRadius: Math.round(fs * 0.28) })
    if (cu.offsetY) text.transform = `translateY(${Math.round(-cu.offsetY * height * 100) / 100}px)`
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
