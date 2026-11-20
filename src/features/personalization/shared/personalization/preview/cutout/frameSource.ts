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
    const target = Math.min(Math.max(0, t), Math.max(0, (video.duration || 0) - 1e-3));
    if (Math.abs(video.currentTime - target) < 1e-4 && video.readyState >= 2) return resolve();
    const done = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error('The video could not be read.')); };
    const cleanup = () => { video.removeEventListener('seeked', done); video.removeEventListener('error', fail); };
    video.addEventListener('seeked', done);
    video.addEventListener('error', fail);
    video.currentTime = target;
  });
}

export function loadVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';
    video.onloadeddata = () => resolve(video);
    video.onerror = () => reject(new Error('The video could not be loaded.'));
    video.src = src;
  });
}

/**
 * A FrameSource over one video element. The element has a single `currentTime`, so two draws that overlap (mask
 * measuring and the live preview both use the shared decoder) would replace each other's seek target and paint the
 * same frame twice. Each draw therefore runs as one complete seek-and-draw step, strictly one after another.
 */
export function frameSourceFromVideo(video: HTMLVideoElement): FrameSource {
  let queue: Promise<unknown> = Promise.resolve();
  return {
    duration: video.duration,
    width: video.videoWidth,
    height: video.videoHeight,
    draw(ctx, timeSec, dx, dy, dw, dh) {
      const step = queue.then(async () => {
        await seek(video, timeSec);
        ctx.drawImage(video, dx, dy, dw, dh);
      });
      // A failed draw must not block the ones queued behind it.
      queue = step.catch(() => undefined);
      return step;
    },
    dispose() {
      video.removeAttribute('src');
      video.load();
    },
  };
}

export async function openVideoFrameSource(src: string): Promise<FrameSource> {
  return frameSourceFromVideo(await loadVideo(src));
}

/** One shared decoder per URL for painting frames (preview and export), so a scrub does not reload the file. */
const POOL = new Map<string, Promise<FrameSource>>();

export function sharedFrameSource(src: string): Promise<FrameSource> {
  let entry = POOL.get(src);
  if (!entry) {
    entry = openVideoFrameSource(src);
    entry.catch(() => POOL.delete(src));
    POOL.set(src, entry);
  }
  return entry;
}

export function releaseSharedFrameSources(): void {
  for (const entry of POOL.values()) entry.then((s) => s.dispose()).catch(() => undefined);
  POOL.clear();
}
