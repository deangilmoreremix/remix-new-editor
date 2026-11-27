// Always-available "Video Pages" button for the app header (so every studio has it).
// Click: opens the landing page picker + editor (src/lib/landingPages/pickerModal.js), which has the
// personalization (pick customers, personal links, brand). The most recent finished video or picture
// (this session, else your newest in the generation history) is loaded into it automatically.
// Only someone who has never made anything sees the picker's upload chooser.
import { WORKBENCH_GENERATION_EVENT } from '../lib/workbench.js';

const ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 8h18"/><path d="M10 12.5l4 2.5-4 2.5z" fill="currentColor"/></svg>';

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

/** Opens the landing page picker with `latest` (a video/picture) loaded, else your newest creation in the history. Used by the header button and each studio's own button. */
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

export function createVideoPagesButton({ target = window } = {}) {
  let latest = null;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.dataset.videoPagesButton = '';
  btn.className = 'relative inline-flex items-center gap-2 rounded-full border border-primary/70 bg-transparent px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 hover:border-primary transition-colors whitespace-nowrap';
  btn.innerHTML = `${ICON}<span class="hidden md:inline">Video Pages</span><span data-latest-dot class="hidden absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary"></span>`;
  const dot = btn.querySelector('[data-latest-dot]');
  const sync = () => {
    dot.classList.toggle('hidden', !latest);
    const base = 'Put a video or picture on a landing page (with personalization)';
    btn.title = latest ? `${base}. Your latest creation is loaded.` : base;
    btn.setAttribute('aria-label', btn.title);
  };
  sync();

  target.addEventListener(WORKBENCH_GENERATION_EVENT, (e) => {
    const next = latestFromSaved(e.detail?.entry);
    if (next) { latest = next; sync(); }
  });

  btn.addEventListener('click', () => openVideoPages(latest));
  return btn;
}
