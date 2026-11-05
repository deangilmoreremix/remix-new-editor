// Ad-video mode for Commercial Studio, ported from upstream Open-Generative-AI's
// MarketingStudio.jsx: product + avatar + reference images and a video-format
// preset go to Seedance 2 omni-reference to make a UGC-style ad.
//
// This module owns the mode's controls and state; CommercialStudio owns the
// composer, the results grid and the generate handler.

import { muapi } from '../../lib/muapi.js';
import { showToast } from '../../lib/loading.js';
import { createPill, openComposerPopover, closeComposerPopover } from '../studio/promptComposer.js';
import { createMediaSlot } from '../studio/mediaSlot.js';

const CDN = 'https://d3adwkbyhxyrtq.cloudfront.net/web-app';
export const AVATARS = ['Priya', 'Elena', 'Kai', 'Sora', 'Minji', 'Margot', 'Niko', 'Jin'].map((name) => ({ name, url: `${CDN}/${name}.webp` }));
export const AD_FORMATS = [
  { name: 'UGC', url: `${CDN}/ugc.mp4` },
  { name: 'Tutorial', url: `${CDN}/ugc_how_to.mp4` },
  { name: 'Unboxing', url: `${CDN}/ugc_unboxing.mp4` },
  { name: 'Hyper Motion', url: `${CDN}/hyper-motion-mini.mp4` },
  { name: 'Product Review', url: `${CDN}/product_review.mp4` },
  { name: 'TV Spot', url: `${CDN}/tv-spot-mini.mp4` },
];
export const AD_RATIOS = ['9:16', '3:4', '4:3', '16:9', '1:1'];
export const AD_RESOLUTIONS = ['720p', '1080p'];
export const AD_DURATIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

const ICON_AVATAR = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
const ICON_REFS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';

/** Validation shared with the handler (messages are upstream's). */
export function validateAd({ script, productUrl }) {
  if (!script?.trim()) return 'Please enter an ad script.';
  if (!productUrl) return 'Please upload a product image.';
  return null;
}

/** The generateMarketingStudioAd payload for the current state. */
export function buildAdParams(state, { script, productUrl }) {
  return {
    prompt: script,
    aspect_ratio: state.ratio,
    duration: state.duration,
    resolution: state.res,
    images_list: [productUrl, state.avatarUrl, ...state.refs].filter(Boolean),
    video_files: state.format?.url ? [state.format.url] : [],
  };
}

export function createMarketingAdMode() {
  const state = { ratio: '9:16', res: '1080p', duration: 5, format: AD_FORMATS[0], avatarUrl: null, refs: [] };
  const controls = document.createElement('div');
  controls.className = 'hidden items-center gap-2 flex-wrap';
  controls.dataset.adControls = '';

  async function upload(files, slot, apply) {
    slot.setProgress(1);
    try {
      const urls = [];
      for (const file of files) {
        const url = await muapi.uploadFile(file, { onProgress: (p) => slot.setProgress(Math.min(99, p)) });
        if (url) urls.push(url);
      }
      apply(urls);
    } catch (err) {
      showToast(`Upload failed: ${err.message || 'try again'}`, 'error', 5000);
    } finally {
      slot.setProgress(100);
    }
  }

  const avatarSlot = createMediaSlot({
    icon: ICON_AVATAR,
    title: 'Avatar (optional) — shows up as @image2',
    onFiles: (files) => upload(files, avatarSlot, ([url]) => { state.avatarUrl = url; avatarSlot.setPreview(url); avatarPill.setLabel('Custom avatar'); }),
    onClear: () => { state.avatarUrl = null; avatarPill.setLabel('Select Avatar'); },
  });
  const refsSlot = createMediaSlot({
    icon: ICON_REFS,
    title: 'References (optional)',
    multiple: true,
    onFiles: (files) => upload(files, refsSlot, (urls) => { state.refs = [...state.refs, ...urls]; refsSlot.setPreview(state.refs); }),
    onClear: () => { state.refs = []; },
  });

  const formatPill = createPill({ label: state.format.name, title: 'Video format presets' });
  formatPill.addEventListener('click', () => openComposerPopover(formatPill, {
    title: 'Video Format Presets',
    items: AD_FORMATS.map((f) => ({ label: f.name, selected: f.name === state.format.name, onSelect: () => { state.format = f; formatPill.setLabel(f.name); } })),
  }));

  const avatarPill = createPill({ label: 'Select Avatar', title: 'Avatar presets' });
  avatarPill.addEventListener('click', () => {
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-3 gap-3 w-[300px]';
    AVATARS.forEach((a, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `flex flex-col items-center gap-1 p-1 rounded-xl hover:bg-primary/10 ${state.avatarUrl === a.url ? 'ring-1 ring-primary' : ''}`;
      b.innerHTML = '<img class="w-16 h-16 rounded-full object-cover" alt=""><span class="text-[10px] font-semibold text-white/70"></span>';
      b.querySelector('img').src = a.url;
      b.querySelector('img').alt = a.name;
      b.querySelector('span').textContent = a.name;
      b.addEventListener('click', () => { closeComposerPopover(); openAvatarPreview(i); });
      grid.appendChild(b);
    });
    openComposerPopover(avatarPill, { title: 'Avatar Presets', content: grid });
  });

  function openAvatarPreview(startIndex) {
    let index = startIndex;
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[150] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="relative flex items-center gap-4">
        <button type="button" data-prev aria-label="Previous Avatar" class="w-11 h-11 rounded-full bg-white/10 text-white text-xl hover:bg-white/20">‹</button>
        <div class="flex flex-col items-center gap-4">
          <img data-img class="max-h-[60vh] max-w-[80vw] rounded-2xl object-cover shadow-2xl" alt="">
          <div class="text-white font-bold" data-name></div>
          <button type="button" data-select class="px-8 py-3 rounded-full bg-primary text-black font-bold text-sm">Select Avatar</button>
        </div>
        <button type="button" data-next aria-label="Next Avatar" class="w-11 h-11 rounded-full bg-white/10 text-white text-xl hover:bg-white/20">›</button>
        <button type="button" data-close aria-label="Close" class="absolute -top-2 -right-2 w-9 h-9 rounded-full bg-white/10 text-white hover:bg-white/20">×</button>
      </div>`;
    const draw = () => {
      const a = AVATARS[index];
      overlay.querySelector('[data-img]').src = a.url;
      overlay.querySelector('[data-img]').alt = a.name;
      overlay.querySelector('[data-name]').textContent = a.name;
    };
    const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
    const step = (d) => { index = (index + d + AVATARS.length) % AVATARS.length; draw(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'ArrowRight') step(1); };
    overlay.querySelector('[data-prev]').onclick = () => step(-1);
    overlay.querySelector('[data-next]').onclick = () => step(1);
    overlay.querySelector('[data-close]').onclick = close;
    overlay.querySelector('[data-select]').onclick = () => {
      const a = AVATARS[index];
      state.avatarUrl = a.url;
      avatarSlot.setPreview(a.url);
      avatarPill.setLabel(a.name);
      close();
    };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey);
    draw();
    document.body.appendChild(overlay);
  }

  const mk = (label, icon, title, key, options, fmt = (v) => String(v)) => {
    const pill = createPill({ label: fmt(state[key]), icon, title });
    pill.addEventListener('click', () => openComposerPopover(pill, {
      title,
      items: options.map((o) => ({ label: fmt(o), selected: o === state[key], onSelect: () => { state[key] = o; pill.setLabel(fmt(o)); } })),
    }));
    return pill;
  };
  const ratioPill = mk('ratio', 'aspect', 'Aspect Ratio', 'ratio', AD_RATIOS);
  const resPill = mk('res', 'quality', 'Resolution', 'res', AD_RESOLUTIONS);
  const durPill = mk('duration', 'duration', 'Duration', 'duration', AD_DURATIONS, (d) => `${d}s`);

  controls.append(avatarSlot.el, refsSlot.el, formatPill, avatarPill, ratioPill, resPill, durPill);

  return {
    el: controls,
    state,
    setActive(on) { controls.classList.toggle('hidden', !on); controls.classList.toggle('flex', on); },
    reset() { state.avatarUrl = null; state.refs = []; avatarSlot.setPreview(null); refsSlot.setPreview(null); avatarPill.setLabel('Select Avatar'); },
  };
}
