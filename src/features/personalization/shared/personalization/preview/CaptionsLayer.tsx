import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'
import { activeCue, captionWords, cueEntrance, type CaptionSettings } from './captions'
import { TEXT_SHADOW } from './textStyle'
import { fontStackById } from './presets'
import { hexWithAlpha } from './effects'
import { ACTIVE_WORD, visibleWordRange } from './capite/activeWord'
import { displayScale, scriptFor, withScriptFonts } from '../captions/scripts'
import { captionFontByName, captionFontStack } from '../captions/capiteFonts'
import { StudioCaptionLine } from './StudioCaptionLine'
import { CaptionFontGate } from '../captions/capiteFontLoader'
import { resolveCasing, resolveWeight, textTransformOf } from '../captions/captionCustom'

/**
 * The caption line on screen at this frame, with the spoken word highlighted. Plain text, a rounded box and a text shadow, which
 * the browser exporter draws (a box radius of half the line height, not 999px, as the exporter does not clamp it). The live Player,
 * the editor and the export all draw it with this one component.
 */
type LayerProps = { captions: CaptionSettings | undefined; compH: number; fontFamily?: string }

/** The layer, with a gate that holds the preview and the export until a chosen font (or a Capite look's own) is embedded and loaded. */
export const CaptionsLayer: React.FC<LayerProps> = (props) => {
  const st = props.captions?.style
  const gated = props.captions?.enabled && captionFontByName(st?.fontFamily)
  return (
    <>
      {gated ? <CaptionFontGate name={st?.fontFamily} weight={resolveWeight(st?.weight, st?.bold ?? true)} italic={st?.italic} /> : null}
      <CaptionsLayerLine {...props} />
    </>
  )
}

const CaptionsLayerLine: React.FC<LayerProps> = ({ captions, compH, fontFamily }) => {
  const frame = useCurrentFrame()
  const { fps, width } = useVideoConfig()
  // Captions designed in the Caption Studio carry their own pages and style: drawn by the same layout the Studio uses.
  if (captions?.enabled && captions.studio) return <StudioCaptionLine studio={captions.studio} ms={(frame / fps) * 1000} width={width} height={compH} fallbackStack={fontStackById(fontFamily)} zIndex={900} />
  if (!captions?.enabled || captions.cues.length === 0) return null
  const cue = activeCue(captions.cues, frame, fps)
  if (!cue) return null
  const st = captions.style
  // Other writing systems: its fonts after the look's own, a smaller size for wide letters, and right-to-left for Arabic and Hebrew.
  // The language is the saved one, or read from the letters when there is none.
  const script = scriptFor(captions.language, cue.text)
  const fontSize = Math.max(10, Math.round(compH * st.size * displayScale(captions.language, cue.text)))
  const words = captionWords(cue, frame, fps, st.highlight)
  const activeIdx = words.findIndex((w) => w.active)
  const [from, to] = st.windowed ? visibleWordRange(words.length, activeIdx) : [0, words.length]
  const shown = words.map((w, i) => ({ w, i })).slice(from, to)
  const { opacity, rise } = cueEntrance(cue, frame, fps)
  const edge = Math.round(compH * 0.07)
  const place: React.CSSProperties =
    typeof st.positionY === 'number'
      ? { top: `${(st.positionY * 100).toFixed(2)}%`, transform: 'translateY(-50%)' } // a dragged height: the captions are centred on it
      : st.position === 'top' ? { top: edge } : st.position === 'middle' ? { top: '50%', marginTop: -fontSize } : { bottom: edge }
  return (
    <AbsoluteFill style={{ zIndex: 900, pointerEvents: 'none', opacity, transform: rise ? `translateY(${rise * compH}px)` : undefined }} data-testid="captions-layer">
      <div style={{ position: 'absolute', left: '5%', right: '5%', display: 'flex', justifyContent: 'center', ...place, ...(st.offsetY ? { transform: `translateY(${Math.round(-st.offsetY * compH * 100) / 100}px)` } : {}) }}>
        <div
          data-testid="caption-line"
          style={{
            maxWidth: '100%',
            textAlign: 'center',
            fontFamily: withScriptFonts(captionFontStack(st.fontFamily, fontStackById(fontFamily)), script),
            ...(script.rtl ? { direction: 'rtl' as const } : {}),
            fontSize,
            fontWeight: resolveWeight(st.weight, st.bold),
            lineHeight: 1.2,
            letterSpacing: st.letterSpacing !== undefined ? `${st.letterSpacing}em` : st.uppercase ? '0.02em' : '-0.005em',
            wordSpacing: st.wordSpacing ? `${st.wordSpacing}em` : undefined,
            fontStyle: st.italic ? 'italic' : undefined,
            color: st.color,
            ...(st.outline ? { WebkitTextStroke: `${(st.outline.size * 2).toFixed(3)}em ${st.outline.color}`, paintOrder: 'stroke fill' as React.CSSProperties['paintOrder'] } : {}),
            textShadow: st.box ? 'none' : st.shadow ? `0 ${st.shadow.depth}em ${(st.shadow.depth * 1.6).toFixed(3)}em ${hexWithAlpha(st.shadow.color, st.shadow.alpha)}` : TEXT_SHADOW,
            ...(st.box
              ? { background: hexWithAlpha(st.boxColor, st.boxOpacity), padding: '0.25em 0.6em', borderRadius: '0.6em' }
              : {}),
          }}
        >
          {shown.map(({ w, i }, n) => {
            const look = st.animation ? ACTIVE_WORD[st.animation] : null
            const ramp = w.active && look ? Math.min(1, (w.elapsed ?? 1) / 0.12) : 0
            const scale = look && w.active ? 1 + (look.scale - 1) * ramp : 1
            const rise = look && w.active ? look.rise * ramp : 0
            const boxed = w.active && look?.box
            const glow = w.active && look?.glow
            const karaoke = w.active && st.animation === 'karaoke'
            const pct = Math.round((w.progress ?? 0) * 100)
            return (
              <React.Fragment key={i}>
                {n > 0 ? ' ' : null}
                <span
                  data-testid="caption-word"
                  data-active={w.active ? '1' : '0'}
                  style={{
                    color: karaoke ? 'transparent' : boxed ? st.color : w.active ? st.highlightColor : st.color,
                    textTransform: textTransformOf(resolveCasing(st.casing, st.uppercase)),
                    ...(scale !== 1 || rise ? { display: 'inline-block', transform: `translateY(${(rise * fontSize).toFixed(2)}px) scale(${scale.toFixed(3)})` } : {}),
                    ...(glow ? { display: 'inline-block', filter: `drop-shadow(0 0 ${glow[0]}em ${st.highlightColor}) drop-shadow(0 0 ${glow[1]}em ${st.highlightColor})` } : {}),
                    ...(boxed && look?.box ? { display: 'inline-block', background: st.highlightColor, borderRadius: `${look.box.radius}em`, padding: `${look.box.padY}em ${look.box.padX}em`, WebkitTextStroke: undefined } : {}),
                    ...(karaoke ? { background: `linear-gradient(90deg, ${st.highlightColor} ${pct}%, ${st.color} ${pct}%)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' } : {}),
                  }}
                >
                  {w.text}
                </span>
              </React.Fragment>
            )
          })}
        </div>
      </div>
    </AbsoluteFill>
  )
}
