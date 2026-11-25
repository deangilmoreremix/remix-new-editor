// "Create landing page" on a finished result: opens the landing page picker + editor
// (src/lib/landingPages/pickerModal.js, with personalization) with this video or picture loaded.
// Shared by the studios' result rows, the results gallery cards and the media preview window.

/** Pure: whether a result can go on a page (an https video or picture). */
export function canMakeLandingPage(item) {
  if (!item || typeof item !== 'object') return false;
  if (!/^https:\/\//i.test(String(item.url || ''))) return false;
  return item.type === 'video' || item.type === 'image';
}

/**
 * The user's most recent pictures and videos (from the generation history), other than `exclude`, to ride along in the
 * landing page's content tray. Never slows the hand-off down (a slow history is skipped) and never throws.
 */
export async function recentItems({ exclude = [], n = 5, load, timeoutMs = 2500 } = {}) {
  try {
    const loader = load || (await import('../../lib/generationHistory.js')).loadGenerationHistory;
    const list = await Promise.race([loader(), new Promise((r) => setTimeout(() => r([]), timeoutMs))]);
    const skip = new Set(exclude.filter(Boolean));
    const out = [];
    for (const h of Array.isArray(list) ? list : []) {
      const type = h?.type === 'video' ? 'video' : h?.type === 'image' ? 'image' : '';
      const it = { url: h?.url, type, prompt: h?.prompt || '', studio: h?.studio || '', thumbnail_url: h?.thumbnail_url || '' };
      if (!type || !canMakeLandingPage(it) || skip.has(it.url)) continue;
      skip.add(it.url);
      out.push(it);
      if (out.length >= n) break;
    }
    return out;
  } catch { return []; }
}

/** Open the picker + editor for one result: { url, type: 'video'|'image', prompt?, studio? }. Recent results come along as the tray. */
export async function openLandingPageFor(item, { toast, recent = true } = {}) {
  const { openLandingPagePicker, toPickerVideo } = await import('../../lib/landingPages/pickerModal.js');
  if (!canMakeLandingPage(item) || !toPickerVideo(item)) {
    toast?.('This result has no shareable link yet.');
    return false;
  }
  const items = recent ? await recentItems({ exclude: [item.url] }) : [];
  openLandingPagePicker({ video: item, items });
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
