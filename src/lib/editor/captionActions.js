import { openAICaptionsModal } from '../components/modals/AICaptionsModal.jsx';

/**
 * Open the AI Captions modal.
 *
 * @param {object} opts
 * @param {string} opts.videoUrl - Optional pre-filled video URL.
 * @param {string} [opts.language='English'] - Transcription language (full name).
 * @param {string} [opts.theme='Hormozi_1'] - Caption theme.
 * @param {string} [opts.appTheme='timeline-editor'] - Studio theme for modal theming.
 * @param {function} [opts.onComplete] - Called with the captioned video URL on success.
 * @param {function} [opts.onError] - Called with the error on failure.
 */
export function addCaptionButton(opts = {}) {
  const {
    videoUrl,
    language = 'English',
    theme = 'Hormozi_1',
    appTheme = 'timeline-editor',
    onComplete,
    onError,
  } = opts;

  openAICaptionsModal({
    videoUrl,
    language,
    theme,
    appTheme,
    onComplete: (url) => {
      if (typeof onComplete === 'function') onComplete(url);
    },
    onError: (err) => {
      if (typeof onError === 'function') onError(err);
    },
  });
}
