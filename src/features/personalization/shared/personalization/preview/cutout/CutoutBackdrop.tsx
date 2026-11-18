import React, { useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig } from 'remotion'
import { sharedFrameSource, type FrameSource } from './frameSource'
import { getMaskAt, masksVersion, subscribeMasks } from './maskStore'
import { createScratch, paintCutout, prepareBackground, prepareFrame, type BackgroundAssets, type Scratch } from './composeCutout'
import type { CutoutSettings } from './cutoutSettings'
import { toPlayablePreviewMediaUrl } from '../remoteMedia'

const IMAGE_CACHE = new Map<string, Promise<HTMLImageElement | null>>()

function loadImage(url: string): Promise<HTMLImageElement | null> {
  let entry = IMAGE_CACHE.get(url)
  if (!entry) {
    entry = new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = toPlayablePreviewMediaUrl(url)
    })
    IMAGE_CACHE.set(url, entry)
  }
  return entry
}

async function loadAssets(cutout: CutoutSettings): Promise<BackgroundAssets> {
  const bg = cutout.background
  if (bg.kind === 'image') return { image: await loadImage(bg.url) }
  if (bg.kind === 'video') return { video: await sharedFrameSource(toPlayablePreviewMediaUrl(bg.url)).catch((): FrameSource | null => null) }
  return {}
}

/**
 * The video, drawn by us instead of by <Video>, so the presenter can be cut out and placed over another
 * background. The live preview, the editor and the browser export all run THIS component with the same seek
 * based drawing, so what is previewed is what is exported. Until the masks are measured it shows the
 * original footage unchanged.
 */
export const CutoutBackdrop: React.FC<{ videoUrl: string; cutout: CutoutSettings; width: number; height: number; /** CSS filter for the picture (the video look), set on the canvas itself because the exporter filters each element on its own. */ filter?: string }> = ({ videoUrl, cutout, width, height, filter }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const version = useSyncExternalStore(subscribeMasks, masksVersion, masksVersion)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scratchRef = useRef<Scratch | null>(null)
  const queueRef = useRef<Promise<void>>(Promise.resolve())
  const latestRef = useRef(0)

  useLayoutEffect(() => {
    const token = ++latestRef.current
    const handle = delayRender(`cutout frame ${frame}`)
    // Runs are serialized (they share scratch canvases) and a run that was overtaken skips its work.
    queueRef.current = queueRef.current.then(async () => {
      try {
        if (token !== latestRef.current) return
        const target = canvasRef.current
        if (!target) return
        scratchRef.current ??= createScratch()
        const scratch = scratchRef.current
        const source = await sharedFrameSource(toPlayablePreviewMediaUrl(videoUrl))
        const timeSec = frame / fps
        const found = getMaskAt(videoUrl, timeSec)
        await prepareFrame(scratch, source, timeSec, width, height, found ? 'contain' : 'cover')
        if (found) await prepareBackground(scratch, cutout, source, await loadAssets(cutout), timeSec, width, height)
        if (token !== latestRef.current) return
        paintCutout({ target, scratch, width, height, cutout, mask: found?.mask ?? null })
      } catch (error) {
        console.error('Cut-out frame failed', error)
      } finally {
        continueRender(handle)
      }
    })
  }, [frame, fps, version, videoUrl, cutout, width, height])

  return (
    <AbsoluteFill>
      <canvas ref={canvasRef} data-testid="cutout-canvas" width={width} height={height} style={{ width: "100%", height: "100%", filter }} />
    </AbsoluteFill>
  )
}
