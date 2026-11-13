'use client'

import { useEffect, useRef } from 'react'
import { Player } from '@remotion/player'
import type { PlayerRef } from '@remotion/player'
import { PersonalizationComposition } from '../preview/PersonalizationComposition'
import { getRemotionDesignTemplate } from '../templates'
import type { PreviewInputProps, PreviewLayer } from '../preview/types'
import { C } from './tokens'

/**
 * The overlay editor's stage draws a design layer with the REAL composition: the same
 * `PersonalizationComposition` the preview and the export render, restricted to this one layer (no footage,
 * no other layers), so what you select here is the animation that ends up in the video. Interaction stays
 * with the editor's own selection box on top (this player ignores the pointer).
 */
export function DesignLayerPlayer({
  layer,
  inputProps,
  fallbackLabel,
}: {
  layer: PreviewLayer
  inputProps: PreviewInputProps
  fallbackLabel: string
}): React.JSX.Element {
  const playerRef = useRef<PlayerRef>(null)
  const settings = inputProps.settings
  const durationInFrames = Math.max(1, Math.round(settings.durationInFrames))
  const design = layer.designId ? getRemotionDesignTemplate(layer.designId) : undefined

  // Rest on a frame where the design is visible (never the closing frames, where the end card plays).
  let rest = Math.round(settings.fps * 1.5)
  const end = design?.placement?.endFrame
  if (typeof end === 'number' && end > 0) rest = Math.round(end * 0.55)
  else if (design?.animation) rest = Math.round((design.animation.delayInFrames + design.animation.durationInFrames) * 0.7)
  rest = Math.max(0, Math.min(Math.round(durationInFrames * 0.6), rest))

  useEffect(() => {
    try { playerRef.current?.play() } catch { /* autoplay can be refused: the rest frame stays */ }
  }, [])

  const only: PreviewInputProps = {
    ...inputProps,
    videoUrl: null,
    posterUrl: null,
    audioUrl: null,
    settings: { ...settings, showEndCard: false, layers: [{ ...layer, visible: true, startFrame: 0, endFrame: undefined }] },
  }
  const Composition = PersonalizationComposition as unknown as React.ComponentType<Record<string, unknown>>

  return (
    <div
      data-testid="design-layer-player"
      aria-label={fallbackLabel}
      style={{ width: '100%', height: '100%', pointerEvents: 'none', borderRadius: 6, overflow: 'hidden', outline: `1px dashed ${C.cyanBorder}`, outlineOffset: -1 }}
    >
      <Player
        ref={playerRef}
        component={Composition}
        inputProps={only as unknown as Record<string, unknown>}
        durationInFrames={durationInFrames}
        compositionWidth={settings.width}
        compositionHeight={settings.height}
        fps={settings.fps}
        initialFrame={rest}
        loop
        controls={false}
        clickToPlay={false}
        initiallyMuted
        autoPlay
        acknowledgeRemotionLicense
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
