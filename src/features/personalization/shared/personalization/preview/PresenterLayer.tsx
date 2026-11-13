import React from 'react'
import { Img } from 'remotion'
import { Video } from '@remotion/media'
import {
  presenterMediaRect,
  presenterVideoAspect,
  presenterRect,
  presenterRenderPlan,
  resolveBlurPx,
  type PresenterSettings,
} from './presenter'
import { resolveMatteUrl } from './presenterMatteRegistry'

/**
 * The presenter (Stage 3), drawn above the website layer. It is a pure function of the settings, the frame size
 * and the resolved processed-footage URL, so the editor stage, the Player and the export draw the same pixels.
 *
 * Layers inside the box, back to front:
 *   fill / fill image      (colour or picture behind the person)
 *   original video         (blurred when the mode is "blur")
 *   processed video        (the person on a transparent background)
 */
export const PresenterLayer: React.FC<{
  presenter: PresenterSettings
  videoUrl: string
  compW: number
  compH: number
}> = ({ presenter, videoUrl, compW, compH }) => {
  const matteUrl = resolveMatteUrl(presenter.matte)
  const plan = presenterRenderPlan(presenter, { url: matteUrl, sourceUrl: videoUrl })
  if (!plan.active) return null
  const rect = presenterRect(presenter, compW, compH)
  const m = presenterMediaRect(presenter, rect.width, rect.height, presenterVideoAspect(presenter))
  const blur = resolveBlurPx(plan, presenter, compW)
  const border = Math.round(presenter.borderWidth * rect.width * 100) / 100
  const shadow = presenter.shadow && presenter.layout !== 'full' && plan.effective !== 'remove'

  // @remotion/media's <Video> takes objectFit as a PROP (a CSS object-fit on its canvas is ignored). The media box
  // is already the exact cover-fit/zoom/pan rectangle, so the video simply fills it.
  const mediaBox: React.CSSProperties = {
    position: 'absolute', left: m.left, top: m.top, width: m.width, height: m.height,
    transform: presenter.mirror ? 'scaleX(-1)' : undefined,
  }

  return (
    <div
      data-presenter-layer=""
      data-presenter-mode={plan.effective}
      data-presenter-degraded={plan.degradedReason ?? undefined}
      style={{
        position: 'absolute',
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        borderRadius: rect.radiusPx,
        boxShadow: shadow ? '0 12px 40px rgba(0,0,0,0.45)' : undefined,
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, borderRadius: rect.radiusPx, overflow: 'hidden', background: plan.fill || undefined }}>
        {plan.fillImage ? <Img src={plan.fillImage} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
        {plan.original ? (
          // Scaled up a little so the blur samples picture, not emptiness, at the box edge (the box clips the excess).
          <div style={{ position: 'absolute', inset: 0, filter: blur > 0 ? `blur(${blur}px)` : undefined, transform: blur > 0 ? `scale(${1 + (4 * blur) / Math.max(1, Math.min(rect.width, rect.height))})` : undefined }}>
            <Video src={videoUrl} muted={plan.original.muted} objectFit="cover" style={mediaBox} />
          </div>
        ) : null}
        {plan.matte && matteUrl ? <Video src={matteUrl} muted={plan.matte.muted} objectFit="cover" style={mediaBox} /> : null}
      </div>
      {border > 0 ? (
        // A real border: the web renderer does not draw inset box-shadows (found when the exported ring was missing).
        <div style={{ position: 'absolute', inset: 0, borderRadius: rect.radiusPx, border: `${border}px solid ${presenter.borderColor}`, boxSizing: 'border-box' }} />
      ) : null}
    </div>
  )
}

