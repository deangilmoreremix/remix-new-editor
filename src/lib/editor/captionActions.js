import { openCaptionStudio } from '../captionStudio/modal.js';
import { openaiConfig } from '../config/openaiConfig.js';

/**
 * Open the free Caption Studio (host adapter for remix-new-editor; the studio itself lives in src/lib/captionStudio and is shared
 * with OpenHiggsBolt). On-device Whisper transcription, editable lines, 32 caption looks with custom colours, SRT/VTT export, and
 * captions rendered into the video in the browser. No credits are used and nothing is uploaded.
 *
 * @param {object} opts
 * @param {string} [opts.videoUrl] - Pre-loaded video (blob: or https:). The user can also upload one in the modal.
 * @param {string} [opts.language='auto'] - Spoken language code ('en', 'es', …) or 'auto'.
 * @param {string} [opts.appTheme='timeline-editor'] - Studio theme: picks the modal's accent colour.
 * @param {function} [opts.onComplete] - Called with the captioned video's blob: URL when the user picks "Use this video".
 * @param {function} [opts.onApply] - Called with { captions, captionStyle, srt, vtt } (the Timeline editor adds a captions clip).
 * @param {function} [opts.onError] - Called with the error on failure.
 */
export function addCaptionButton(opts = {}) {
  const { videoUrl, language = 'auto', appTheme = 'timeline-editor', onComplete, onApply, onError, captions, style } = opts;
  // Older call sites passed a full language name ("English") for the paid service; Whisper takes a code or 'auto'.
  const lang = /^[a-z]{2}$/.test(language) || language === 'auto' ? language : 'auto';
  return openCaptionStudio({
    videoUrl, language: lang, captions, style,
    accentColor: openaiConfig.getStudioColorScheme(appTheme)?.primary,
    onComplete: typeof onComplete === 'function' ? (url) => onComplete(url) : undefined,
    onApply: typeof onApply === 'function' ? (payload) => onApply(payload) : undefined,
    onError: (err) => { if (typeof onError === 'function') onError(err); },
  });
}
