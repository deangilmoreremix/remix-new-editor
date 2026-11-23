// "My Video Pages" as a modal: the list of your saved landing pages with edit, publish, share and analytics.
// Video Pages has no studio page of its own: new pages are made from any studio's "Create landing page" button,
// the header's Video Pages button, or "+ New page" here (all open the same picker + editor, src/lib/landingPages/pickerModal.js).
import { LandingPagesStudio } from '../LandingPagesStudio.js';

let openOverlay = null;

export function openMyVideoPages({ zIndex = 1900 } = {}) {
  if (openOverlay?.isConnected) return openOverlay;
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
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
  const close = () => { document.removeEventListener('keydown', onKey); overlay.remove(); document.body.style.overflow = prevOverflow; openOverlay = null; };
  // Escape closes this window only when no other window (the picker) is on top of it
  const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('[data-landing-picker]')) close(); };
  document.addEventListener('keydown', onKey);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  openOverlay = overlay;
  dialog.focus();
  return overlay;
}
