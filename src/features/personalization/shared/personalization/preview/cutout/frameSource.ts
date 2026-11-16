/**
 * Reads frames from a video by seeking, which is the same deterministic path the live preview and the
 * browser export use (they must see identical pixels). Wrapped in a tiny interface so tests can use a fake.
 */
export interface FrameSource {
  duration: number
  width: number
  height: number
  /** Draws the frame at `timeSec` into the rect (dx, dy, dw, dh) of the context. */
  draw(ctx: CanvasRenderingContext2D, timeSec: number, dx: number, dy: number, dw: number, dh: number): Promise<void>
  dispose(): void
}

function seek(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const target = Math.min(Math.max(0, t), Math.max(0, (video.duration || 0) - 1e-3))
    if (Math.abs(video.currentTime - target) < 1e-4 && video.readyState >= 2) return resolve()
    const done = () => { cleanup(); resolve() }
    const fail = () => { cleanup(); reject(new Error('The video could not be read.')) }
    const cleanup = () => { video.removeEventListener('seeked', done); video.removeEventListener('error', fail) }
    video.addEventListener('seeked', done)
    video.addEventListener('error', fail)
    video.currentTime = target
  })
}

export function loadVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.crossOrigin = 'anonymous'
    video.onloadeddata = () => resolve(video)
    video.onerror = () => reject(new Error('The video could not be loaded.'))
    video.src = src
  })
}

export async function openVideoFrameSource(src: string): Promise<FrameSource> {
  const video = await loadVideo(src)
  return {
    duration: video.duration,
    width: video.videoWidth,
    height: video.videoHeight,
    async draw(ctx, timeSec, dx, dy, dw, dh) {
      await seek(video, timeSec)
      ctx.drawImage(video, dx, dy, dw, dh)
    },
    dispose() {
      video.removeAttribute('src')
      video.load()
    },
  }
}

/** One shared decoder per URL for painting frames (preview and export), so a scrub does not reload the file. */
const POOL = new Map<string, Promise<FrameSource>>()

export function sharedFrameSource(src: string): Promise<FrameSource> {
  let entry = POOL.get(src)
  if (!entry) {
    entry = openVideoFrameSource(src)
    entry.catch(() => POOL.delete(src))
    POOL.set(src, entry)
  }
  return entry
}

export function releaseSharedFrameSources(): void {
  for (const entry of POOL.values()) entry.then((s) => s.dispose()).catch(() => undefined)
  POOL.clear()
}
