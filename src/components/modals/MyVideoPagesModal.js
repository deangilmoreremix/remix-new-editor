// "My Video Pages" as a modal: the list of your saved landing pages with edit, publish, share and analytics.
// Video Pages has no studio page of its own: new pages are made from any studio's "Create landing page" button,
// the header's Video Pages button, or "+ New page" here (all open the same picker + editor, src/lib/landingPages/pickerModal.js).
import { LandingPagesStudio } from '../LandingPagesStudio.js';
import { lockScroll, unlockScroll } from '../../lib/landingPages/scrollLock.js';

let openOverlay = null;

// Stacking: this window 2000 (the picker's own default); the picker opened from here 2200; this window opened from the picker
// goes 100 above that picker (its zIndex + 100).
export function openMyVideoPages({ zIndex = 2000 } = {}) {
  if (openOverlay?.isConnected) { openOverlay.style.zIndex = String(zIndex); return openOverlay; }   // already open: just bring it to the requested level
  lockScroll();
  const overlay = document.createElement('div');
  overlay.dataset.myVideoPages = '';
  overlay.className = 'fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-xl p-2 md:p-6';
  overlay.style.zIndex = String(zIndex);
  const dialog = document.createElement('div');
  dialog.className = 'w-full max-w-7xl h-full max-h-[94vh] flex flex-col rounded-2xl border border-white/10 bg-panel-bg overflow-hidden text-white';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'My Video Pages');
  dialog.tabIndex = -1;
  const head = document.createElement('div');
  head.className = 'flex items-center gap-3 px-4 md:px-6 py-3 border-b border-white/5';
  const title = document.createElement('h2');
  title.className = 'text-sm font-black uppercase tracking-widest flex-1';
  title.textContent = 'My Video Pages';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '✕';
  closeBtn.className = 'rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-white hover:border-primary/60 transition-colors';
  head.append(title, closeBtn);
  const body = document.createElement('div');
  body.className = 'flex-1 min-h-0';
  body.appendChild(LandingPagesStudio({ embedded: true }));
  dialog.append(head, body);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  const close = () => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    unlockScroll();   // the page stays locked while the picker is still open
    openOverlay = null;
  };
  // Escape closes this window only when no other window (the picker) is on top of it
  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    const picker = document.querySelector('[data-landing-picker]');
    if (!picker || Number(overlay.style.zIndex) > Number(picker.style.zIndex || 0)) close();
  };
  document.addEventListener('keydown', onKey);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  openOverlay = overlay;
  dialog.focus();
  return overlay;
}
