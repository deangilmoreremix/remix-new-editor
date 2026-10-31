// Round upload slot used in the studio composers (upstream's UploadSlot): a
// 40px circle you can click or drop files on, with a progress percentage while
// uploading, a thumbnail once set, and a small × to clear it.

import { mediaButtonClassName } from './promptComposer.js';

/**
 * @param {object} opts
 * @param {string}   opts.icon      — SVG markup for the empty state
 * @param {string}   opts.title     — tooltip / aria label
 * @param {boolean} [opts.multiple] — allow several files (shows a count badge)
 * @param {string}  [opts.accept]   — input accept (default images)
 * @param {(files: File[]) => void} opts.onFiles — called with chosen/dropped files
 * @param {() => void} [opts.onClear]
 */
export function createMediaSlot({ icon, title, multiple = false, accept = 'image/*', onFiles, onClear }) {
  const wrap = document.createElement('div');
  wrap.className = 'relative group/slot flex items-center';
  wrap.dataset.mediaSlot = '';

  const btn = document.createElement('div');
  btn.setAttribute('role', 'button');
  btn.tabIndex = 0;
  btn.title = title;
  btn.setAttribute('aria-label', title);
  btn.className = `${mediaButtonClassName()} cursor-pointer`;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.multiple = multiple;
  input.className = 'hidden';
  input.addEventListener('change', () => {
    const files = Array.from(input.files || []);
    input.value = '';
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  });

  const iconEl = document.createElement('div');
  iconEl.className = 'text-white/40 group-hover/slot:text-primary transition-colors';
  iconEl.innerHTML = icon;

  const preview = document.createElement('img');
  preview.className = 'hidden w-full h-full object-cover rounded-full';
  preview.alt = title;

  const progressEl = document.createElement('div');
  progressEl.className = 'hidden absolute inset-0 bg-black/60 rounded-full items-center justify-center z-10';
  progressEl.innerHTML = '<span class="text-[8px] font-black text-primary" data-progress></span>';

  btn.append(input, iconEl, preview, progressEl);

  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'hidden absolute -top-1 -right-1 w-4 h-4 rounded-full bg-black border border-white/20 text-white/70 hover:text-white text-[10px] leading-none items-center justify-center z-20';
  clear.setAttribute('aria-label', `Clear ${title}`);
  clear.textContent = '×';
  clear.addEventListener('click', (e) => { e.stopPropagation(); api.setPreview(null); onClear?.(); });

  const count = document.createElement('span');
  count.className = 'hidden absolute -bottom-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-primary text-black text-[9px] font-black items-center justify-center z-20';

  wrap.append(btn, clear, count);

  btn.addEventListener('click', () => input.click());
  btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });

  let depth = 0;
  const setDragging = (on) => btn.classList.toggle('ring-2', on) || btn.classList.toggle('ring-primary', on);
  btn.addEventListener('dragenter', (e) => { e.preventDefault(); e.stopPropagation(); depth += 1; setDragging(true); });
  btn.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
  btn.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); depth = Math.max(0, depth - 1); if (!depth) setDragging(false); });
  btn.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    depth = 0;
    setDragging(false);
    const files = Array.from(e.dataTransfer?.files || []).filter((f) => !accept.startsWith('image') || f.type.startsWith('image/'));
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  });

  const api = {
    el: wrap,
    /** url string, array of urls (multiple), or null to reset. */
    setPreview(value) {
      const urls = Array.isArray(value) ? value : value ? [value] : [];
      const first = urls[0];
      preview.classList.toggle('hidden', !first);
      if (first) preview.src = first;
      iconEl.classList.toggle('hidden', !!first);
      btn.className = `${mediaButtonClassName({ active: !!first })} cursor-pointer`;
      clear.classList.toggle('hidden', !first);
      clear.classList.toggle('flex', !!first);
      const showCount = multiple && urls.length > 1;
      count.classList.toggle('hidden', !showCount);
      count.classList.toggle('flex', showCount);
      count.textContent = String(urls.length);
    },
    /** 0–100 while uploading; anything else hides the overlay. */
    setProgress(percent) {
      const active = percent > 0 && percent < 100;
      progressEl.classList.toggle('hidden', !active);
      progressEl.classList.toggle('flex', active);
      progressEl.querySelector('[data-progress]').textContent = active ? `${Math.round(percent)}%` : '';
    },
  };
  return api;
}
