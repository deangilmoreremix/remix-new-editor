import React, { useEffect, useState } from 'react'
import { AbsoluteFill, continueRender, delayRender } from 'remotion'
import { embeddedFont, fontStack, loadEmbeddedFont, resolveWeight } from '../captions/studioFonts'
import { activePageAt, layoutCaptionFrame } from '../captions/studioLayout'
import type { StudioCaptions } from '../captions/studioCaptions'

/** Shared scratch canvas: text is measured here so the layout is computed with the same font the DOM then draws with. */
let scratch: CanvasRenderingContext2D | null | undefined
function measurer(font: string): ((text: string) => number) | null {
  if (typeof document === 'undefined') return null // server render: the client draws the captions
  if (scratch === undefined) scratch = document.createElement('canvas').getContext('2d')
  if (!scratch) return null
  scratch.font = font
  const ctx = scratch
  return (text) => ctx.measureText(text).width
}

/** Hard 8-direction outline (no filters, so it rasterizes reliably in the browser exporter), plus the soft shadow. */
function textShadow(outlinePx: number, outlineColor: string | null, shadow: { color: string; blur: number; offsetY: number } | null): string | undefined {
  const parts: string[] = []
  if (outlinePx > 0 && outlineColor) {
    const d = outlinePx
    ;[[-d, -d], [0, -d], [d, -d], [-d, 0], [d, 0], [-d, d], [0, d], [d, d]].forEach(([x, y]) => parts.push(`${x}px ${y}px 0 ${outlineColor}`))
  }
  if (shadow) parts.push(`0 ${shadow.offsetY}px ${shadow.blur}px ${shadow.color}`)
  return parts.length ? parts.join(', ') : undefined
}

/**
 * Captions made in the Caption Studio, drawn as DOM. The same pure layout (captions/studioLayout.js) that the Studio draws on a canvas
 * decides where every word goes, so colours, font, outline, motion and the dragged height carry over to the preview and every export.
 * Plain absolutely-positioned boxes and text: no canvas, no clip-path, no network.
 */
export const StudioCaptionLine: React.FC<{ studio: StudioCaptions; ms: number; width: number; height: number; fallbackStack: string; zIndex: number }> = ({ studio, ms, width, height, fallbackStack, zIndex }) => {
  const st = studio.style
  const weight = resolveWeight(st)
  const italic = !!st.italic
  // An embedded font is registered on demand; the render (preview frame or export) waits for it, then lays the words out again with it.
  const [, setFontReady] = useState(0)
  useEffect(() => {
    if (!embeddedFont(st.fontFamily)) return undefined
    let handle: number | null = null
    try { handle = delayRender(`caption font ${st.fontFamily}`) } catch { handle = null }
    let done = false
    const finish = () => { if (done) return; done = true; setFontReady((n) => n + 1); if (handle !== null) continueRender(handle) }
    loadEmbeddedFont(st.fontFamily, { weight, italic }).then(finish, finish)
    return () => { if (!done) { done = true; if (handle !== null) continueRender(handle) } }
  }, [st.fontFamily, weight, italic])
  const page = activePageAt(studio.pages, ms)
  if (!page) return null
  const fontPx = (Math.max(1, st.fontSize) / 100) * height
  const stack = fontStack(st.fontFamily, fallbackStack)
  const measure = measurer(`${italic ? 'italic ' : ''}${weight} ${fontPx}px ${stack}`)
  if (!measure) return null
  const frame = layoutCaptionFrame({ page, style: st, ms, width, height, measure })
  if (!frame) return null
  const text: React.CSSProperties = {
    position: 'absolute', left: 0, top: 0, whiteSpace: 'nowrap', fontFamily: stack, fontSize: fontPx, fontWeight: weight, fontStyle: italic ? 'italic' : 'normal', lineHeight: `${frame.lineH}px`, height: frame.lineH,
  }
  return (
    <AbsoluteFill style={{ zIndex, pointerEvents: 'none' }}>
      <div data-testid="captions-layer" data-caption-source="studio" data-caption-text={frame.words.map((w) => w.text).join(' ')} style={{ position: 'absolute', inset: 0 }}>
        {frame.lineBoxes.map((b, i) => (
          <div key={`lb${i}`} style={{ position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h, borderRadius: b.r, background: b.color }} />
        ))}
        {frame.words.map((w, i) => {
          const shadow = textShadow(w.outlinePx, w.outlineColor, w.shadow)
          return (
            <div key={`w${i}`} style={{ position: 'absolute', left: w.cx, top: w.cy, width: w.width, height: frame.lineH, transform: `translate(-50%, -50%) scale(${w.scale})` }}>
              {w.box && <div style={{ position: 'absolute', left: w.width / 2 + w.box.x, top: frame.lineH / 2 + w.box.y, width: w.box.w, height: w.box.h, borderRadius: w.box.r, background: w.box.color }} />}
              <span style={{ ...text, color: w.color, textShadow: shadow }}>{w.text}</span>
              {w.wipe && (
                <div style={{ position: 'absolute', ...(w.rtl ? { right: 0 } : { left: 0 }), top: 0, width: w.width * w.wipe.fraction, height: frame.lineH, overflow: 'hidden' }}>
                  <span style={{ ...text, ...(w.rtl ? { left: 'auto', right: 0 } : {}), color: w.wipe.color, textShadow: shadow }}>{w.text}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}
