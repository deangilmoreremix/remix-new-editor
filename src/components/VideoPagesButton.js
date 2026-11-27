// Opens the landing page picker + editor (src/lib/landingPages/pickerModal.js), which has the
// personalization (pick customers, personal links, brand). The most recent finished video or picture
// (this session, else your newest in the generation history) is loaded into it automatically.
// Only someone who has never made anything sees the picker's upload chooser.
// Each studio has its own inline Video Pages button (personalizePopover.js); the app header has none.

/** Pure: the entry as a picker video, or null when it is not a shareable video/picture. */
export function latestFromSaved(entry) {
  if (!entry || (entry.type !== 'video' && entry.type !== 'image')) return null;
  if (!/^https:\/\//i.test(String(entry.url || ''))) return null;
  return { url: entry.url, type: entry.type, prompt: entry.prompt || '', studio: entry.studio || '', thumbnail_url: entry.thumbnail_url || '' };
}

/** Pure: the newest shareable video or picture in a history list (newest first), or null. */
export function pickLatest(history) {
  for (const h of Array.isArray(history) ? history : []) {
    const v = latestFromSaved(h);
    if (v) return v;
  }
  return null;
}

const HISTORY_WAIT_MS = 1500;

/** Opens the landing page picker with `latest` (a video/picture) loaded, else your newest creation in the history. Used by each studio's own button. */
export async function openVideoPages(latest = null) {
  // The window opens whatever happens: a slow or failing history (cloud sync, sign-in) is waited for 1.5 seconds at most.
  let history = [];
  try {
    const { loadGenerationHistory } = await import('../lib/generationHistory.js');
    history = await Promise.race([loadGenerationHistory(), new Promise((resolve) => setTimeout(() => resolve([]), HISTORY_WAIT_MS))]);
  } catch { history = []; }
  try {
    // Your latest creation (this session, else your newest in the history) fills the viewer; nothing has to be uploaded.
    const video = latest || pickLatest(history);
    const { openLandingPagePicker, toPickerVideo } = await import('../lib/landingPages/pickerModal.js');
    const { recentItems } = await import('./studio/landingPageAction.js');
    const main = video && toPickerVideo(video) ? video : null;
    // the next five wait in the editor's content tray
    openLandingPagePicker({ video: main, items: await recentItems({ exclude: [main?.url], load: async () => history }) });
  } catch {
    const { openLandingPagePicker } = await import('../lib/landingPages/pickerModal.js');
    openLandingPagePicker({});
  }
}
