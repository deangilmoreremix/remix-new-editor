// Results gallery shared by the studios that mirror upstream Open-Generative-AI:
// grid cards with media on top and a prompt/model footer, hover actions on
// desktop (copy prompt, copy image, download, delete), a 44px ⋯ menu on mobile
// (port of MobileGenerationActions.jsx), a fullscreen viewer, and a pending
// card while a generation runs.

import { confirmDeleteGeneration } from '../../lib/generationHistory.js';
import { showToast } from '../../lib/loading.js';

const VIDEO_RE = /\.(mp4|webm|mov|m4v)(\?|$)|video\//i;
const AUDIO_RE = /\.(mp3|wav|ogg|m4a|aac|flac)(\?|$)|audio\//i;

export const isVideoUrl = (url) => VIDEO_RE.test(url || '');
export const isAudioUrl = (url) => AUDIO_RE.test(url || '');

const ICON = {
  copyText: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>',
  copyMedia: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
  download: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>',
  delete: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
  check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
  more: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  close: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>',
};

const ROUND_BTN = 'p-2 bg-black/60 backdrop-blur-md rounded-full text-white hover:bg-primary hover:text-black transition-all border border-white/10';

export async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

/** Copies an image as PNG (the only image type browsers accept); videos and fallbacks copy the link. */
export async function copyMedia(url) {
  if (!isVideoUrl(url) && !isAudioUrl(url) && typeof window !== 'undefined' && window.ClipboardItem) {
    try {
      const blob = await fetch(url).then((r) => r.blob());
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext('2d').drawImage(bitmap, 0, 0);
      const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': png })]);
      return 'image';
    } catch { /* fall through to the link */ }
  }
  await navigator.clipboard.writeText(url);
  return 'link';
}

export async function downloadUrl(url, filename) {
  try {
    const blob = await fetch(url).then((r) => r.blob());
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}

function flashCheck(btn) {
  const original = btn.innerHTML;
  btn.innerHTML = ICON.check;
  btn.classList.add('text-primary');
  setTimeout(() => { btn.innerHTML = original; btn.classList.remove('text-primary'); }, 1600);
}

function openFullscreen(url) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[150] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in-up';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20';
  close.setAttribute('aria-label', 'Close');
  close.innerHTML = ICON.close;
  let media;
  if (isVideoUrl(url)) {
    media = document.createElement('video');
    media.controls = true;
    media.autoplay = true;
    media.loop = true;
  } else {
    media = document.createElement('img');
    media.alt = 'Generated result';
  }
  media.src = url;
  media.className = 'max-w-full max-h-full rounded-xl object-contain shadow-2xl';
  overlay.append(media, close);
  const dismiss = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') dismiss(); };
  close.onclick = dismiss;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) dismiss(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
}

/**
 * @param {object} opts
 * @param {'image'|'video'} opts.kind        — card aspect and hover-play behaviour
 * @param {string}  opts.historyType         — generationHistory type used for delete
 * @param {string}  opts.gridClass           — column classes (defaults per kind)
 * @param {(item)=>void} [opts.onDelete]     — after an item is removed
 * @param {(item)=>Array} [opts.extraActions] — studio-specific actions [{label, onSelect}]
 */
export function createResultsGallery({ kind = 'image', historyType = kind, gridClass, onDelete, extraActions, filenamePrefix = 'smartvideo' } = {}) {
  const root = document.createElement('div');
  root.className = 'w-full max-w-7xl mx-auto px-2';
  root.dataset.resultsGallery = '';
  const grid = document.createElement('div');
  grid.className = gridClass || (kind === 'video'
    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full pt-4 animate-fade-in-up'
    : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full pt-4 animate-fade-in-up');
  root.appendChild(grid);

  let items = [];
  const listeners = new Set();
  const notify = () => listeners.forEach((fn) => fn(items));

  const removeItem = (item) => {
    if (!confirmDeleteGeneration(item.url, historyType)) return;
    items = items.filter((i) => i !== item);
    render();
    onDelete?.(item);
  };

  const actionsFor = (item, idx) => {
    const isVid = isVideoUrl(item.url);
    const ext = isVid ? 'mp4' : 'jpg';
    return [
      ...(item.prompt ? [{ kind: 'copyText', label: 'Copy prompt', run: (btn) => copyText(item.prompt).then(() => btn && flashCheck(btn)).catch(() => showToast('Could not copy the prompt', 'error')) }] : []),
      { kind: 'copyMedia', label: isVid ? 'Copy link' : 'Copy image', run: (btn) => copyMedia(item.url).then(() => btn && flashCheck(btn)).catch(() => showToast('Could not copy', 'error')) },
      { kind: 'download', label: 'Download', run: () => downloadUrl(item.url, `${filenamePrefix}-${item.id || idx}.${ext}`) },
      ...((extraActions?.(item) || []).map((a) => ({ kind: 'extra', label: a.label, run: a.onSelect }))),
      { kind: 'delete', label: 'Delete', danger: true, run: () => removeItem(item) },
    ];
  };

  const buildCard = (item, idx) => {
    const card = document.createElement('div');
    card.className = 'relative group rounded-lg overflow-hidden border border-white/10 bg-[#0a0a0a] shadow-xl hover:border-primary/50 transition-all duration-300 flex flex-col cursor-pointer';
    card.dataset.resultCard = '';

    let media;
    if (isVideoUrl(item.url)) {
      media = document.createElement('video');
      media.src = item.url;
      media.muted = true;
      media.loop = true;
      media.playsInline = true;
      media.preload = 'metadata';
      media.className = 'w-full aspect-video object-cover bg-black/40';
      // Play on hover, rewind when the pointer leaves (upstream VideoStudio).
      card.addEventListener('mouseenter', () => { media.play?.().catch(() => {}); });
      card.addEventListener('mouseleave', () => { media.pause?.(); media.currentTime = 0; });
    } else {
      media = document.createElement('img');
      media.src = item.url;
      media.alt = item.prompt?.slice(0, 30) || 'Generated image';
      media.loading = 'lazy';
      media.className = `w-full ${kind === 'video' ? 'aspect-video' : 'aspect-square'} object-cover bg-black/40 hover:opacity-80 transition-opacity`;
    }
    card.appendChild(media);

    const actions = actionsFor(item, idx);

    // Desktop hover actions
    const hover = document.createElement('div');
    hover.className = 'absolute top-2 right-2 hidden md:flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity';
    actions.forEach((a) => {
      if (a.kind === 'extra') return;
      const b = document.createElement('button');
      b.type = 'button';
      b.title = a.label;
      b.setAttribute('aria-label', a.label);
      b.dataset.action = a.kind;
      b.className = a.danger ? 'p-2 bg-black/60 backdrop-blur-md rounded-full text-red-400 hover:bg-red-500 hover:text-white transition-all border border-white/10' : ROUND_BTN;
      b.innerHTML = ICON[a.kind];
      b.addEventListener('click', (e) => { e.stopPropagation(); a.run(b); });
      hover.appendChild(b);
    });
    card.appendChild(hover);

    // Mobile ⋯ menu (44px target)
    const mobileBtn = document.createElement('button');
    mobileBtn.type = 'button';
    mobileBtn.className = 'md:hidden absolute top-2 right-2 w-11 h-11 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white flex items-center justify-center';
    mobileBtn.setAttribute('aria-label', 'More actions');
    mobileBtn.innerHTML = ICON.more;
    mobileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const existing = card.querySelector('[data-mobile-menu]');
      if (existing) { existing.remove(); return; }
      const menu = document.createElement('div');
      menu.dataset.mobileMenu = '';
      menu.className = 'absolute top-14 right-2 z-20 min-w-[178px] rounded-xl bg-[#151515]/95 backdrop-blur-xl border border-white/10 shadow-2xl p-1';
      actions.forEach((a) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = `w-full min-h-11 px-3 rounded-lg text-left text-sm font-semibold flex items-center gap-2 ${a.danger ? 'text-red-400 hover:bg-red-500/10' : 'text-white/80 hover:bg-white/5'}`;
        row.innerHTML = `${ICON[a.kind] || ''}<span></span>`;
        row.querySelector('span').textContent = a.label;
        row.addEventListener('click', (ev) => { ev.stopPropagation(); menu.remove(); a.run(null); });
        menu.appendChild(row);
      });
      card.appendChild(menu);
    });
    card.appendChild(mobileBtn);

    // Prompt & details footer
    const footer = document.createElement('div');
    footer.className = 'p-3 bg-black/80 backdrop-blur-sm border-t border-white/5 flex-1 flex flex-col justify-between gap-2';
    const prompt = document.createElement('p');
    prompt.className = 'text-white/70 text-xs line-clamp-3 leading-relaxed';
    prompt.textContent = item.prompt || 'No prompt';
    prompt.title = item.prompt || '';
    const meta = document.createElement('div');
    meta.className = 'flex items-center gap-2 mt-1 flex-wrap';
    if (item.model) {
      const chip = document.createElement('span');
      chip.className = 'text-[10px] font-bold text-primary px-2 py-0.5 bg-primary/10 rounded border border-primary/20 capitalize';
      chip.textContent = String(item.model).replace(/-/g, ' ');
      meta.appendChild(chip);
    }
    const detail = item.aspect_ratio || item.resolution || (item.duration ? `${item.duration}s` : '');
    if (detail) {
      const d = document.createElement('span');
      d.className = 'text-[10px] text-white/40';
      d.textContent = detail;
      meta.appendChild(d);
    }
    footer.append(prompt, meta);
    card.appendChild(footer);

    card.addEventListener('click', () => openFullscreen(item.url));
    return card;
  };

  const pendingCards = new Map();

  function render() {
    grid.innerHTML = '';
    pendingCards.forEach((el) => grid.appendChild(el));
    items.forEach((item, idx) => grid.appendChild(buildCard(item, idx)));
    root.classList.toggle('hidden', items.length === 0 && pendingCards.size === 0);
    notify();
  }

  render();

  return {
    root,
    get items() { return items; },
    setItems(list) { items = Array.isArray(list) ? [...list] : []; render(); },
    addItem(item) { items = [item, ...items]; render(); },
    isEmpty: () => items.length === 0 && pendingCards.size === 0,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /** A placeholder card while a generation runs; returns done()/remove(). */
    addPending(label = 'Generating…') {
      const id = Symbol('pending');
      const el = document.createElement('div');
      el.dataset.pendingCard = '';
      el.className = `relative rounded-lg overflow-hidden border border-primary/30 bg-[#0a0a0a] ${kind === 'video' ? 'aspect-video' : 'aspect-square'} flex flex-col items-center justify-center gap-3 animate-pulse`;
      el.innerHTML = '<span class="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin"></span><span class="text-xs font-semibold text-white/60" data-pending-label></span>';
      el.querySelector('[data-pending-label]').textContent = label;
      pendingCards.set(id, el);
      render();
      return {
        remove() { pendingCards.delete(id); render(); },
        setLabel(text) { el.querySelector('[data-pending-label]').textContent = text; },
      };
    },
  };
}
