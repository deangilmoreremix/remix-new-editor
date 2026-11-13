/**
 * Draws a captured website behind the video: the full-page screenshot fitted to the frame width, scrolled and zoomed,
 * with an animated cursor and click effects. Used by the shared Remotion composition, so the live preview and the
 * exported video are the same pixels. Every value comes from `websiteFrameState` (a pure function of the frame).
 */
import React from 'react'
import { AbsoluteFill, Img } from 'remotion'
import { displayedPageHeight, websiteFrameState, type CursorStyle, type WebsiteBackground } from './websiteBackground'

export interface WebsiteBackgroundLayerProps {
  background: WebsiteBackground
  frame: number
  compW: number
  compH: number
  /** Click ripple / pulse colour. */
  accent: string
}

function CursorGlyph({ style, size }: { style: CursorStyle; size: number }) {
  return style === 'hand' ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V11m0-.5a1.5 1.5 0 0 1 3 0v4.5c0 3-2 5-5 5h-1.5c-1.8 0-3-.8-4-2.2L4.6 14a1.5 1.5 0 0 1 2.3-1.9L9 14" fill="#fff" stroke="#111" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 2.5v17l4.6-4.1 3 6.6 2.7-1.2-3-6.5H18.5L4 2.5Z" fill="#fff" stroke="#111" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}

export const WebsiteBackgroundLayer: React.FC<WebsiteBackgroundLayerProps> = ({ background, frame, compW, compH, accent }) => {
  const state = websiteFrameState(frame, background, compW, compH)
  if (!state.visible) return null
  const pageH = displayedPageHeight(background, compW)
  const cursorSize = Math.round(compH * 0.045)
  return (
    <AbsoluteFill
      data-website-background="true"
      style={{
        overflow: 'hidden',
        background: '#05070a',
        opacity: state.opacity,
        transform: state.slideY ? `translateY(${Math.round(state.slideY * compH)}px)` : undefined,
        pointerEvents: 'none',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, transform: state.zoom !== 1 ? `scale(${state.zoom})` : undefined, transformOrigin: `${state.originX}px ${state.originY}px` }}>
        <Img
          src={background.page.url}
          style={{ position: 'absolute', left: 0, top: 0, width: compW, height: pageH, maxWidth: 'none', transform: `translateY(${-state.scrollPx}px)` }}
        />
      </div>
      {state.clicks.map((c, i) => {
        const base = Math.round(compH * 0.06)
        const scale = background.cursor.clickEffect === 'pulse' ? 1 + c.age * 0.5 : 0.25 + c.age * 1.6
        return (
          <div
            key={i}
            data-website-click="true"
            style={{
              position: 'absolute',
              left: c.x * compW - base / 2,
              top: c.y * compH - base / 2,
              width: base,
              height: base,
              borderRadius: '50%',
              border: `${Math.max(2, Math.round(compH * 0.004))}px solid ${accent}`,
              background: background.cursor.clickEffect === 'pulse' ? `${accent}55` : 'transparent',
              opacity: 0.85 * (1 - c.age),
              transform: `scale(${scale})`,
            }}
          />
        )
      })}
      {state.cursor.visible ? (
        <div data-website-cursor="true" style={{ position: 'absolute', left: state.cursor.x * compW - cursorSize * 0.17, top: state.cursor.y * compH - cursorSize * 0.1, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.45))' }}>
          <CursorGlyph style={background.cursor.style} size={cursorSize} />
        </div>
      ) : null}
    </AbsoluteFill>
  )
}
