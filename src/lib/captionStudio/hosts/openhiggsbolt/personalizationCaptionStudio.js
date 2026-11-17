'use client';

/**
 * OpenHiggsBolt's side of the Caption Studio hand-off for the Personalization editor (copied to components/personalizationCaptionStudio.js by
 * scripts/sync-caption-studio.mjs). Register it ONCE in a client component at the app root, next to the Personalization provider:
 *
 *   import { registerCaptionStudio } from '@/shared/personalization/captions/captionStudioBridge';
 *   import { openCaptionStudioForPersonalization } from '@/components/personalizationCaptionStudio';
 *   useEffect(() => { registerCaptionStudio(openCaptionStudioForPersonalization); return () => registerCaptionStudio(null); }, []);
 *
 * With it registered, the Personalization editor's Captions panel is one "Open Caption Studio" button, and the captions it gets back are drawn
 * with the Studio's own font, colours, outline, motion and height in the preview and in every export.
 */
export function openCaptionStudioForPersonalization({ videoUrl, words, style, fonts, onApply, onError } = {}) {
  return Promise.all([import('@/shared/captionStudio/modal'), import('@/shared/captionStudio/studioData')])
    .then(([{ openCaptionStudio }, { studioPayload }]) => openCaptionStudio({
      videoUrl,
      // Remotion's convention: every word but the first starts with a space.
      captions: (words || []).map((w, i) => ({ text: (i ? ' ' : '') + w.text, startMs: w.startMs, endMs: w.endMs })),
      style, fonts,
      accentColor: '#22d3ee',
      applyLabel: 'Use these captions in the video',
      onApply: ({ captions, captionStyle }) => onApply?.(studioPayload(captions, captionStyle)),
      onError,
    }))
    .catch((err) => { onError?.(err); });
}
