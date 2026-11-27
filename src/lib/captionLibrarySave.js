// Captioned renders live in the tab as blob: URLs, which are gone after a reload. The Caption Studio folder is
// portable and cannot import the host, so it only announces the video (remix:video-created). This host-side
// listener turns that announcement into a durable Library entry: it uploads the render and saves the URL.
import { registerGenerationBlob } from './generationHistory.js';

const VIDEO_CREATED_EVENT = 'remix:video-created';
const CAPTION_STUDIO = 'caption-studio';

let mounted = false;

/** Save every captioned render the Caption Studio announces. Safe to call more than once. */
export function mountCaptionLibrarySave(win = globalThis.window) {
  if (mounted || !win?.addEventListener) return;
  mounted = true;
  win.addEventListener(VIDEO_CREATED_EVENT, (e) => {
    const card = e?.detail?.card;
    if (!card || card.studio !== CAPTION_STUDIO || !/^blob:/.test(card.url || '')) return;
    fetch(card.url)
      .then((res) => res.blob())
      .then((blob) => registerGenerationBlob(CAPTION_STUDIO, 'video', blob, { prompt: card.title || '' }))
      .catch(() => {});
  });
}

export const resetCaptionLibrarySaveForTests = () => { mounted = false; };
