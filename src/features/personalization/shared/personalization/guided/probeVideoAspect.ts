/**
 * Reads a video's width/height from its metadata (no decoding), so the presenter can frame it exactly.
 * Resolves undefined when the metadata cannot be read (blocked, unsupported, too slow); framing then falls back to a
 * plain centred cover-fit, which is still correct, just not pannable.
 */
export function probeVideoAspect(url: string, timeoutMs = 8000, create: () => HTMLVideoElement | null = () => (typeof document === 'undefined' ? null : document.createElement('video'))): Promise<number | undefined> {
  return new Promise((resolve) => {
    const el = create()
    if (!el) { resolve(undefined); return }
    let done = false
    const finish = (v: number | undefined) => {
      if (done) return
      done = true
      clearTimeout(timer)
      el.removeAttribute('src'); try { el.load() } catch { /* not loadable in this environment */ }
      resolve(v)
    }
    const timer = setTimeout(() => finish(undefined), timeoutMs)
    el.preload = 'metadata'
    el.muted = true
    el.onloadedmetadata = () => finish(el.videoWidth > 0 && el.videoHeight > 0 ? el.videoWidth / el.videoHeight : undefined)
    el.onerror = () => finish(undefined)
    el.src = url
  })
}
