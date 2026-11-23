/**
 * The smallest "timeline" that /watch/<id> can play: one video clip, full length.
 * Same shape the Video Outreach publisher uses (src/lib/outreach/draft.js: type, src, left, width), so the public
 * player (WatchPage -> timelineToComposition) needs nothing special. Pass the result to preparePublishProject().
 * Images and audio get a file link only (no page), so this is video-only.
 */

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/** 1080x1920 -> "9:16"; null for unusable sizes. Only used when the frame is not 16:9. */
export function aspectFromSize(width, height) {
  const w = Math.round(Number(width));
  const h = Math.round(Number(height));
  if (!(w > 0 && h > 0)) return null;
  const d = gcd(w, h);
  const [a, b] = [w / d, h / d];
  if (a > 9999 || b > 9999) {
    // Odd sizes reduce to huge ratios; round to a short ratio instead.
    const r = w / h;
    return r >= 1 ? `${Math.round(r * 100)}:100` : `100:${Math.round(100 / r)}`;
  }
  return `${a}:${b}`;
}

/**
 * @param {object} o { fileUrl, title, durationSec, width, height }
 * @returns {object} state for preparePublishProject()
 * @throws when the file has no https address (a blob: URL cannot be published)
 */
export function buildMinimalProject({ fileUrl, title = 'Untitled video', durationSec, width, height } = {}) {
  if (!/^https:\/\//i.test(String(fileUrl || ''))) throw Object.assign(new Error('The file needs a web address before it can be published.'), { code: 'bad_source' });
  const seconds = Math.max(1, Math.min(3600, Math.ceil(Number(durationSec) || 0) || 10));
  const aspect = aspectFromSize(width, height);
  const name = String(title || '').trim().slice(0, 120) || 'Untitled video';
  return {
    projectTitle: name,
    timelineSeconds: seconds,
    ...(aspect && aspect !== '16:9' ? { aspect } : {}),
    tracks: [{
      id: 'track-main', name: 'Video', type: 'video', muted: false, solo: false,
      items: [{ id: 'clip-1', name, type: 'video', src: fileUrl, left: 0, width: 100, trimIn: 0, volume: 1 }],
    }],
  };
}
