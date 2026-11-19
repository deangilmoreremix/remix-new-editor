/**
 * remix-new-editor's side of the Caption Studio hand-off: opens the one Caption Studio for the personalization editor and returns what it
 * made as pages + a plain style (see shared/personalization/captions/captionStudioBridge.ts). Registered in mount.jsx.
 */
export function openCaptionStudioForPersonalization({ videoUrl, words, style, fonts, onApply, onError } = {}) {
  return Promise.all([import('../../lib/captionStudio/modal.js'), import('../../lib/captionStudio/studioData.js')])
    .then(([{ openCaptionStudio }, { studioPayload }]) => openCaptionStudio({
      videoUrl,
      // Remotion's convention: every word but the first starts with a space.
      captions: (words || []).map((w, i) => ({ text: (i ? ' ' : '') + w.text, startMs: w.startMs, endMs: w.endMs })),
      style, fonts,
      applyLabel: 'Use these captions in the video',
      onApply: ({ captions, captionStyle }) => onApply?.(studioPayload(captions, captionStyle)),
      onError,
    }))
    .catch((err) => { onError?.(err); });
}
