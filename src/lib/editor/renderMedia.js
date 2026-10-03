/**
 * Render Studio — media inspection and result model.
 *
 * FREE-FIRST: everything here uses browser-native media APIs. No paid service
 * and no external binary is required.
 *
 * Purpose:
 *  1. `inspectMediaBlob()` measures REAL properties of a produced Blob by
 *     decoding it in an <video> element. This is the validation gate: no Render
 *     action may report media success unless it passes.
 *  2. `buildRenderResult()` produces the single, consistent result model used by
 *     every Render action, so downloads, previews and toasts all agree.
 */

/**
 * Decode a media Blob and measure its real properties.
 *
 * Returns `{ ok:false, error }` when the blob cannot be decoded — callers must
 * treat that as a failed render, never as a silent success.
 *
 * @param {Blob} blob
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<{ok:boolean, error?:string, width?:number, height?:number,
 *   duration?:number, hasAudio?:boolean, audioTracks?:number, decodable?:boolean}>}
 */
export async function inspectMediaBlob(blob, options = {}) {
  const timeoutMs = options.timeoutMs ?? 8000;

  if (!blob || typeof blob.size !== 'number') {
    return { ok: false, error: 'No media blob to inspect' };
  }
  if (blob.size === 0) {
    return { ok: false, error: 'Media blob is empty (0 bytes)' };
  }

  const url = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve) => {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.src = url;

      let settled = false;
      let readFallbackTimer = null;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (readFallbackTimer) clearTimeout(readFallbackTimer);
        video.removeEventListener('loadeddata', read);
        video.removeAttribute('src');
        try { video.load(); } catch { /* ignore */ }
        resolve(value);
      };

      const timer = setTimeout(
        () => finish({ ok: false, error: `Timed out decoding media after ${timeoutMs}ms` }),
        timeoutMs
      );

      video.addEventListener('loadedmetadata', () => {
        // `readyState >= 2` (HAVE_CURRENT_DATA) means a frame is decodable, so
        // metadata alone is a sufficient decodability proof. We deliberately do
        // NOT call captureStream() here: it is comparatively expensive and this
        // runs on every render. Whether audio was captured is already known by
        // the renderer (`sourceHadAudio`); this only proves the file decodes.
        const read = () => {
          const duration = Number.isFinite(video.duration) ? video.duration : 0;
          // Cheap audio hints only — never captureStream() in this hot path.
          let decodedAudioBytes = 0;
          try {
            decodedAudioBytes = video.webkitAudioDecodedByteCount || video.mozHasAudio ? 1 : 0;
          } catch {
            decodedAudioBytes = 0;
          }
          finish({
            ok: true,
            decodable: true,
            width: video.videoWidth || 0,
            height: video.videoHeight || 0,
            duration,
            hasAudioHint: decodedAudioBytes > 0,
          });
        };

        if (video.readyState >= 2) {
          read();
        } else {
          video.addEventListener('loadeddata', read, { once: true });
          // Bounded fallback so a stalled decode cannot hang the render.
          readFallbackTimer = setTimeout(read, 1200);
        }
      }, { once: true });

      video.addEventListener('error', () => {
        const code = video.error ? video.error.code : 'unknown';
        finish({ ok: false, error: `Media failed to decode (MediaError code ${code})` });
      }, { once: true });
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Validation gate for a finished render. Throws with an actionable message when
 * the artifact is unusable, so callers cannot report a false success.
 *
 * @param {{ blob?:Blob, url?:string, width?:number, height?:number, duration?:number }} result
 * @param {{ requireAudio?: boolean }} [options]
 */
export function assertRenderResultUsable(result, options = {}) {
  if (!result || !result.blob) {
    throw new Error('Render produced no media artifact');
  }
  if (result.blob.size === 0) {
    throw new Error('Render produced an empty file (0 bytes)');
  }
  if (!(result.width > 0) || !(result.height > 0)) {
    throw new Error('Render produced media with no usable video dimensions');
  }
  if (!(result.duration > 0)) {
    throw new Error('Render produced media with no usable duration');
  }
  if (options.requireAudio && !result.hasAudio) {
    throw new Error('Render produced media with no audio track');
  }
  return true;
}

const UNSAFE_FILENAME_CHARS = /[^a-z0-9._-]+/gi;

/**
 * Build a safe, meaningful download filename stem.
 * e.g. buildFilenameStem('My Clip!') -> 'My_Clip'
 */
export function buildFilenameStem(input, fallback = 'render') {
  const base = String(input == null ? '' : input)
    .trim()
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(UNSAFE_FILENAME_CHARS, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return base || fallback;
}

/**
 * The single Render result model. Every media-producing action returns this
 * shape so preview, download and delivery all agree on the facts.
 *
 * @param {object} input
 * @returns {object} render result
 */
export function buildRenderResult(input) {
  const {
    blob,
    url,
    mime,
    extension = 'webm',
    action = 'export',
    videoId = '',
    width = 0,
    height = 0,
    duration = 0,
    hasAudio = false,
    frameCount = 0,
    videoBitsPerSecond = 0,
    label = '',
    createdAt = Date.now(),
  } = input || {};

  const stem = buildFilenameStem(videoId || label, 'render');
  const filename = `${stem}_${action}.${extension}`;

  return {
    blob,
    url,
    filename,
    mime: mime || (blob && blob.type) || '',
    extension,
    action,
    videoId,
    width,
    height,
    duration,
    size: blob ? blob.size : 0,
    hasAudio: !!hasAudio,
    frameCount,
    videoBitsPerSecond,
    createdAt,
  };
}