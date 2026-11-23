'use client';

/**
 * The app-root Free Captions trigger for a studio in OpenHiggsBolt (copied to components/CaptionStudioAction.js by
 * scripts/sync-caption-studio.mjs).
 *
 * Same shape as components/PersonalizeVideoAction.js: `packages/studio` is published standalone and must not import the app's
 * `@/shared/...` modules, so studios take a `renderCaptionAction` render prop and the app root injects this component:
 *
 *   <VideoStudio renderCaptionAction={(p) => <CaptionStudioAction {...p} />} />
 *   // inside the studio, next to Download / Publish:
 *   {renderCaptionAction?.({ videoUrl, onComplete: (url) => setVideoUrl(url) })}
 *
 * The studio code (Whisper worker, mediabunny, Web Speech) is loaded on click only, so it adds nothing to the page bundle and never
 * runs during SSR.
 */
import { useCallback } from 'react';

/**
 * @param {object} props
 * @param {string} [props.videoUrl]  The finished video. Without one the modal opens with an upload box.
 * @param {(url: string) => void} [props.onComplete]  Called with the captioned video's blob: URL ("Use this video").
 * @param {(payload: { captions: object[], captionStyle: object, srt: string, vtt: string }) => void} [props.onApply]
 * @param {(err: Error) => void} [props.onError]
 * @param {string} [props.language]  Spoken language code ('en', 'es', …) or 'auto' (default).
 * @param {string} [props.accentColor]  Hex colour for the modal's accents.
 * @param {string} [props.className]
 * @param {React.ReactNode} [props.children]  Button label. Defaults to "Free Captions".
 */
export default function CaptionStudioAction({ videoUrl, onComplete, onApply, onError, language = 'auto', accentColor = '#22d3ee', className, children }) {
  const open = useCallback(async () => {
    try {
      const { openCaptionStudio } = await import('@/shared/captionStudio/modal');
      openCaptionStudio({ videoUrl, onComplete, onApply, onError, language, accentColor, lookImage: (key) => `/caption-looks/${key}.webp` });
    } catch (err) {
      onError?.(err);
    }
  }, [videoUrl, onComplete, onApply, onError, language, accentColor]);

  return (
    <button
      type="button"
      onClick={open}
      title="Add captions on your device — free, no credits"
      className={className || 'flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg text-sm font-medium transition-all border border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08] hover:border-[#22d3ee]/40'}
    >
      {children ?? '💬 Free Captions'}
    </button>
  );
}
