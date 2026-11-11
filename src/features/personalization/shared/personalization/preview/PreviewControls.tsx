import { createRef } from 'react'
import type { PlayerRef } from '@remotion/player'

/**
 * Shared Player handle for the personalization preview: the transport bar and
 * any external scrubber seek through this ref. Mirrors the motion studio's
 * transport pattern (seek / toggle play / pause).
 */
export const previewPlayerRef = createRef<PlayerRef>()

export const seekPreviewTo = (frame: number) => {
  previewPlayerRef.current?.seekTo(Math.max(0, Math.round(frame)))
}

export const togglePreviewPlay = () => {
  const p = previewPlayerRef.current
  if (!p) return
  if (p.isPlaying()) p.pause()
  else p.play()
}

export const pausePreview = () => {
  previewPlayerRef.current?.pause()
}
