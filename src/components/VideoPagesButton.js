// Always-available "Video Pages" button for the app header (so every studio has it).
// Click: opens the landing page picker + editor (src/lib/landingPages/pickerModal.js), which has the
// personalization (pick customers, personal links, brand). The most recent finished video or picture
// from any studio is loaded into it; with none yet, the picker starts on its own chooser
// (upload, pick one you made, or paste a link).
import { WORKBENCH_GENERATION_EVENT } from '../lib/workbench.js';

const ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 8h18"/><path d="M10 12.5l4 2.5-4 2.5z" fill="currentColor"/></svg>';

/** Pure: the entry as a picker video, or null when it is not a shareable video/picture. */
export function latestFromSaved(entry) {
  if (!entry || (entry.type !== 'video' && entry.type !== 'image')) return null;
  if (!/^https:\/\//i.test(String(entry.url || ''))) return null;
  return { url: entry.url, type: entry.type, prompt: entry.prompt || '', studio: entry.studio || '', thumbnail_url: entry.thumbnail_url || '' };
}

export function createVideoPagesButton({ target = window } = {}) {
  let latest = null;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.dataset.videoPagesButton = '';
  btn.className = 'relative inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white hover:border-primary/60 hover:text-primary transition-colors whitespace-nowrap';
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

  btn.addEventListener('click', async () => {
    const { openLandingPagePicker, toPickerVideo } = await import('../lib/landingPages/pickerModal.js');
    openLandingPagePicker({ video: latest && toPickerVideo(latest) ? latest : null });
  });
  return btn;
}
