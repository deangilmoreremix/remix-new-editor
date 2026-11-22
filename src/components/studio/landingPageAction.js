// "Create landing page" on a finished result: opens the landing page picker + editor
// (src/lib/landingPages/pickerModal.js, with personalization) with this video or picture loaded.
// Shared by the studios' result rows, the results gallery cards and the media preview window.

/** Pure: whether a result can go on a page (an https video or picture). */
export function canMakeLandingPage(item) {
  if (!item || typeof item !== 'object') return false;
  if (!/^https:\/\//i.test(String(item.url || ''))) return false;
  return item.type === 'video' || item.type === 'image';
}

/** Open the picker + editor for one result: { url, type: 'video'|'image', prompt?, studio? }. */
export async function openLandingPageFor(item, { toast } = {}) {
  const { openLandingPagePicker, toPickerVideo } = await import('../../lib/landingPages/pickerModal.js');
  if (!canMakeLandingPage(item) || !toPickerVideo(item)) {
    toast?.('This result has no shareable link yet.');
    return false;
  }
  openLandingPagePicker({ video: item });
  return true;
}

/**
 * A button for a studio's result row. Pass `like` (the studio's own Download button or link) and the new button copies its
 * classes, so it has the same shape, size and hover as everything else in that studio. Without it, a neutral default.
 * Set `btn.onclick` where the result is shown, or pass `getItem` (read when it is clicked).
 */
export function createLandingPageButton({ getItem, className, like } = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.dataset.action = 'create-landing-page';
  btn.className = (like && like.className) || className || 'bg-white/10 hover:bg-white/20 px-6 py-2.5 rounded-2xl text-xs font-bold transition-all border border-white/5 text-white';
  btn.textContent = 'Create landing page';
  btn.title = 'Put this on a landing page';
  if (getItem) btn.onclick = () => { void openLandingPageFor(getItem()); };
  return btn;
}
