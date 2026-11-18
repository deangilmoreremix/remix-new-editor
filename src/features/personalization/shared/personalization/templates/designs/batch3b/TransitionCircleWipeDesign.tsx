/**
 * Adapter for the upstream `transition-circle-wipe` template.
 *
 * Upstream: `src/components/transition-circle-wipe/TransitionCircleWipe.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * Scene 01 holds under a slow push, then an accent-edged iris opens from the
 * centre and reveals Scene 02 through it. All phases are FRACTIONS of
 * `useVideoConfig().durationInFrames`, so the adapter pins that value with a
 * `<Timebox>` (Remotion uses the smaller of it and the layer's own length).
 *
 * INTRO-REVEAL ADAPTATION: Scene 01 is a brand-primary card with the business
 * name. The upstream's Scene 02 is an opaque gradient derived from the
 * background colour, so it cannot be made transparent through props; instead
 * the adapter masks the canvas with a CSS radial gradient that is transparent
 * INSIDE the iris (up to the inner edge of the accent ring) using the
 * upstream's own iris maths. The iris therefore opens onto the customer's
 * video, and the accent ring still rides the iris front. Scene 02 is never
 * visible and its label is left empty.
 */

import React from 'react'
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { TransitionCircleWipe } from '../../_upstream/transition-circle-wipe/TransitionCircleWipe'
import { DesignStage, pickColor, slotText, type DesignAdapterProps } from '../shared'
import { Timebox, charsPerLine, fitWords } from './shared'

/**
 * The design's length. The upstream default is 90; the layer's own length
 * caps the Timebox anyway (Remotion takes the minimum), so the Timebox and the
 * catalog `endFrame` are the same 60 frames and the timing never depends on
 * whether an `endFrame` is set. The iris opens over frames ~9-39; the
 * remaining frames are fully transparent.
 */
export const CIRCLE_WIPE_DURATION = 60
export const CIRCLE_WIPE_END_FRAME = CIRCLE_WIPE_DURATION

/** Upstream phase constants (IRIS_START / IRIS_END). */
const IRIS_START = 0.16
const IRIS_END = 0.66

/**
 * The radius (composition px) inside which the upstream canvas is hidden:
 * the iris radius minus the accent edge width, exactly as the upstream
 * computes them.
 */
export function circleWipeHoleRadius(
  frame: number,
  width: number,
  height: number,
  durationInFrames: number,
): number {
  const scale = Math.min(width, height)
  const last = Math.max(1, durationInFrames - 1)
  const maxRadius = Math.sqrt(width * width + height * height) / 2
  const iris = interpolate(frame, [IRIS_START * last, IRIS_END * last], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  })
  const irisRadius = iris * maxRadius * 1.04
  const edgeWidth = interpolate(iris, [0, 1], [scale * 0.05, scale * 0.014], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  return Math.max(0, irisRadius - edgeWidth)
}

/** Lives inside the Timebox so it reads the same duration as the upstream. */
const IrisMask: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame()
  const { width, height, durationInFrames } = useVideoConfig()
  const hole = circleWipeHoleRadius(frame, width, height, durationInFrames)
  const mask =
    hole > 0
      ? `radial-gradient(circle at 50% 50%, transparent ${hole.toFixed(1)}px, #000 ${(hole + 1).toFixed(1)}px)`
      : undefined
  return (
    <div
      data-batch3b-iris-hole={hole.toFixed(1)}
      style={{ position: 'absolute', inset: 0, maskImage: mask, WebkitMaskImage: mask }}
    >
      {children}
    </div>
  )
}

export const TransitionCircleWipeDesign: React.FC<DesignAdapterProps> = (props) => {
  const minSide = Math.min(props.width, props.height)
  const perLine = charsPerLine(props.width, minSide * 0.075, { letterSpacing: minSide * 0.004 })
  const label = fitWords(slotText(props, 'businessName', ['headline']), perLine, 2)

  return (
    <DesignStage designId="transition-circle-wipe" props={props}>
      <Timebox durationInFrames={CIRCLE_WIPE_DURATION}>
        <IrisMask>
          <TransitionCircleWipe
            backgroundColor={pickColor([props.colors?.primary], '#0b0f1a')}
            accentColor={pickColor([props.colors?.accent, props.colors?.primary], '#6366f1')}
            textColor={pickColor([props.color, props.colors?.text], '#eef2ff')}
            fromLabel={label}
            toLabel=""
          />
        </IrisMask>
      </Timebox>
    </DesignStage>
  )
}

export default TransitionCircleWipeDesign
