import React from 'react'
import {
  lookFilterCss, lookIsActive, motionAt, motionIsActive, temperatureOverlayColor, vignetteBackground, type FootageEffects,
} from './videoEffects'

/**
 * Wraps the source footage (the full-frame video, or the presenter's picture) with the customer's colour look and camera
 * motion. A pure function of the settings and the frame, so the Player, the stage and the export draw the same pixels.
 *
 *   <isolated group>
 *     <footage, with CSS filters and the camera transform>
 *     <temperature overlay: multiply>      only where the group is opaque
 *     <vignette overlay>                   only where the group is opaque
 *
 * `opaque = false` (a presenter with a removed background has transparent areas) drops the two overlays: a multiply
 * overlay over transparent pixels would paint a coloured box. The filter-based adjustments still apply.
 */
export const FootageFrame: React.FC<{
  effects: FootageEffects | undefined
  frame: number
  totalFrames: number
  compW: number
  compH: number
  opaque?: boolean
  children?: React.ReactNode
}> = ({ effects, frame, totalFrames, compW, compH, opaque = true, children }) => {
  const look = effects?.look
  const motion = effects?.motion
  const lookOn = lookIsActive(look)
  const motionOn = motionIsActive(motion)
  if (!lookOn && !motionOn) return <>{children}</>
  const filter = lookOn ? lookFilterCss(look, compW) : undefined
  const m = motionOn ? motionAt(frame, motion, totalFrames, compW, compH) : null
  const transform = m ? `translate(${Math.round(m.tx * 100) / 100}px, ${Math.round(m.ty * 100) / 100}px) scale(${Math.round(m.scale * 10000) / 10000})` : undefined
  const tint = lookOn && opaque ? temperatureOverlayColor(look.temperature) : undefined
  const vignette = lookOn && opaque ? vignetteBackground(look.vignette) : undefined
  return (
    <div data-footage-frame="" style={{ position: 'absolute', inset: 0, isolation: 'isolate', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, filter, transform, transformOrigin: '50% 50%' }}>{children}</div>
      {tint ? <div data-footage-tint="" style={{ position: 'absolute', inset: 0, background: tint, mixBlendMode: 'multiply', pointerEvents: 'none' }} /> : null}
      {vignette ? <div data-footage-vignette="" style={{ position: 'absolute', inset: 0, background: vignette, pointerEvents: 'none' }} /> : null}
    </div>
  )
}
