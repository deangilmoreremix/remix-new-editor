import { useSyncExternalStore } from 'react'

/**
 * The live preview's playhead, shared with panels that live outside the editor (the captions panel): the editor publishes the current frame and
 * a way to jump to a frame while its live player is on, and null while it is off. A tiny store, so only the readers re-render on each frame.
 */
export interface LiveState { frame: number | null; seek: ((frame: number) => void) | null }

let state: LiveState = { frame: null, seek: null }
const listeners = new Set<() => void>()

export const liveBridge = {
  publish(next: LiveState): void {
    if (next.frame === state.frame && next.seek === state.seek) return
    state = { frame: next.frame, seek: next.seek }
    listeners.forEach((l) => l())
  },
  subscribe(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener) } },
  get: (): LiveState => state,
}

export const useLiveState = (): LiveState => useSyncExternalStore(liveBridge.subscribe, liveBridge.get, liveBridge.get)
