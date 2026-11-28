import { useSyncExternalStore } from 'react'
import type { AudioReport } from './audioIntel'
import type { Scene } from './sceneDetect'

/** Result of the last "Check my video", kept in memory only (never saved with the project, never uploaded). */
export interface VideoAnalysis {
  url: string
  width: number
  height: number
  duration: number
  scenes: Scene[]
  /** Median sharpness across sampled frames (see `sharpnessScore`). */
  sharpness: number
  brightness: number
  audio: AudioReport | null
  framesSampled: number
}

let current: VideoAnalysis | null = null
const listeners = new Set<() => void>()
export const setVideoAnalysis = (a: VideoAnalysis | null) => { current = a; listeners.forEach((l) => l()) }
export const getVideoAnalysis = () => current
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
export const useVideoAnalysis = (url: string | null): VideoAnalysis | null => {
  const a = useSyncExternalStore(subscribe, getVideoAnalysis, getVideoAnalysis)
  return a && url && a.url === url ? a : null
}
