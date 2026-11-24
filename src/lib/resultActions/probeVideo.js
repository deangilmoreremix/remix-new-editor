/**
 * Reads a video's length and size from its metadata only (nothing is downloaded beyond the header).
 * Resolves to { duration, width, height } or null when the browser cannot read it in time.
 */
export function probeVideo(url, { timeoutMs = 8000, doc = globalThis.document } = {}) {
  return new Promise((resolve) => {
    if (!doc || !url) { resolve(null); return; }
    const v = doc.createElement('video');
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      v.removeAttribute('src');
      try { v.load(); } catch { /* nothing to release */ }
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    v.preload = 'metadata';
    v.muted = true;
    v.onloadedmetadata = () => finish(Number.isFinite(v.duration) && v.duration > 0 ? { duration: v.duration, width: v.videoWidth || 0, height: v.videoHeight || 0 } : null);
    v.onerror = () => finish(null);
    v.src = url;
  });
}
