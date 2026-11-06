// AI VFX Studio — native port of SamurAIGPT/AI-VFX (https://github.com/SamurAIGPT/AI-VFX).
//
// Upstream is a Next.js app: a gallery of effects split into "AI Effects",
// "Motion Controls" and "VFX", a bottom input bar (image, prompt, aspect ratio,
// duration, size, quality) and a MuAPI `generate_wan_ai_effects` call that is
// polled until a video comes back. We used to embed it in an iframe pointing
// at a separately-run Next.js server (http://localhost:3000 by default), which
// left the studio blank anywhere that server wasn't running.
//
// This page rebuilds the same flow inside the app: same three categories, same
// controls and defaults (9:16, 5s, 480p, medium), generation through the
// shared MuAPI client (key handling, upload, polling, history). Effect names
// come from the live API enum so every card is one the API accepts — several
// of upstream's hard-coded "AI Effects" names are not valid for this endpoint.

import { mountStudioChrome } from '../lib/studioChrome.js';
import { createStudioHeader } from '../lib/thumbnails.js';
import { i2vModels } from '../lib/models.js';
import { muapi } from '../lib/muapi.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import { saveGeneration } from '../lib/generationHistory.js';
import { showToast } from '../lib/loading.js';
import { AuthModal } from './AuthModal.js';

const CATEGORIES = [
  { id: 'ai-video-effects', label: 'AI Effects', icon: '⭐', thumbDir: 'ai-video', numbered: true },
  { id: 'motion-controls', label: 'Motion Controls', icon: '🎬', thumbDir: 'motion-controls' },
  { id: 'vfx', label: 'VFX', icon: '💥', thumbDir: 'vfx' },
];

// Upstream's option sets and defaults (components/BottomInputBar.js).
const OPTIONS = {
  aspect_ratio: [['9:16', '9:16 Portrait'], ['16:9', '16:9 Landscape'], ['1:1', '1:1 Square']],
  duration: [['5', '5s'], ['10', '10s']],
  resolution: [['480p', '480p'], ['720p', '720p']],
  quality: [['medium', 'Medium'], ['high', 'High']],
};

const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

export function getVfxEffects() {
  return CATEGORIES.map((cat) => {
    const model = i2vModels.find((m) => m.id === cat.id);
    const names = model?.inputs?.name?.enum || [];
    return { ...cat, effects: names.map((name, i) => ({ name, category: cat.id, thumbs: thumbCandidates(cat, name, i) })) };
  });
}

function thumbCandidates(cat, name, index) {
  const slug = slugify(name);
  const num = String(index + 1).padStart(2, '0');
  const base = `/thumbnails/effects/${cat.thumbDir}`;
  const list = cat.numbered
    ? [`${base}/${num}-${slug}.webp.png`, `${base}/${num}-${slug}.svg`]
    : [`${base}/${slug}.webp.png`, `${base}/${slug.replace('time-lapse', 'timelapse')}.webp.png`, `${base}/${num}-${slug}.svg`];
  return [...new Set(list)];
}

function thumbImg(candidates, alt) {
  const img = document.createElement('img');
  img.alt = alt;
  img.loading = 'lazy';
  img.className = 'absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105';
  let i = 0;
  img.src = candidates[0];
  img.onerror = () => {
    i += 1;
    if (i < candidates.length) img.src = candidates[i];
    else img.style.visibility = 'hidden';
  };
  return img;
}

function selectControl(key, label, value, onChange) {
  const wrap = document.createElement('label');
  wrap.className = 'flex flex-col gap-1 min-w-[96px]';
  wrap.innerHTML = `<span class="text-[10px] font-bold uppercase tracking-wider text-white/40">${label}</span>`;
  const sel = document.createElement('select');
  sel.className = 'bg-[#0d0d10] border border-white/10 rounded-xl px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-primary/60';
  sel.dataset.vfxControl = key;
  OPTIONS[key].forEach(([v, l]) => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = l;
    if (v === value) o.selected = true;
    sel.appendChild(o);
  });
  sel.onchange = () => onChange(sel.value);
  wrap.appendChild(sel);
  return wrap;
}

export function AIVFXPage() {
  const container = document.createElement('div');
  container.className = 'w-full h-full overflow-y-auto custom-scrollbar bg-app-bg';
  mountStudioChrome(container, { currentRoute: 'ai-vfx' });

  const page = document.createElement('div');
  page.className = 'w-full max-w-7xl mx-auto px-4 md:px-8 pb-10 flex flex-col gap-5';
  container.appendChild(page);

  page.appendChild(createStudioHeader('ai-vfx', 'AI VFX Studio', 'Hollywood camera moves, explosive VFX and AI effects from a single image'));

  const groups = getVfxEffects();
  const state = {
    category: groups[0].id,
    effect: null,
    imageUrl: '',
    previewUrl: '',
    prompt: '',
    aspect_ratio: '9:16',
    duration: '5',
    resolution: '480p',
    quality: 'medium',
    busy: false,
  };

  // ── Input bar (upstream BottomInputBar) ─────────────────────────────────
  const bar = document.createElement('div');
  bar.className = 'sticky top-2 z-20 w-full bg-gradient-to-b from-[#18181c]/95 to-[#0c0c0e]/95 backdrop-blur-2xl rounded-[1.75rem] border border-white/[0.08] p-4 flex flex-col gap-3 shadow-[0_15px_50px_rgba(0,0,0,0.6)]';
  bar.dataset.vfxBar = '';
  page.appendChild(bar);

  const row = document.createElement('div');
  row.className = 'flex flex-col md:flex-row gap-3 items-stretch';
  bar.appendChild(row);

  // Image drop zone
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/jpeg,image/png,image/webp,image/gif';
  fileInput.hidden = true;
  const drop = document.createElement('button');
  drop.type = 'button';
  drop.dataset.vfxImage = '';
  drop.className = 'relative shrink-0 w-full md:w-28 h-28 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] hover:border-primary/60 hover:bg-white/[0.05] transition-colors overflow-hidden flex flex-col items-center justify-center gap-1 text-white/50 text-[11px] font-semibold';
  const dropIdle = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>Add image</span>';
  drop.innerHTML = dropIdle;
  drop.onclick = () => fileInput.click();
  row.append(drop, fileInput);

  const textCol = document.createElement('div');
  textCol.className = 'flex-1 flex flex-col gap-2 min-w-0';
  row.appendChild(textCol);

  const selectedLine = document.createElement('div');
  selectedLine.className = 'text-xs text-white/50';
  selectedLine.dataset.vfxSelected = '';
  textCol.appendChild(selectedLine);

  const promptEl = document.createElement('textarea');
  promptEl.rows = 2;
  promptEl.placeholder = 'Optional: describe the subject (e.g. "a red sports car")';
  promptEl.className = 'w-full flex-1 resize-none bg-transparent text-white text-sm md:text-base placeholder:text-white/30 focus:outline-none';
  promptEl.oninput = () => { state.prompt = promptEl.value; };
  textCol.appendChild(promptEl);

  const urlRow = document.createElement('div');
  urlRow.className = 'flex gap-2';
  const urlInput = document.createElement('input');
  urlInput.type = 'url';
  urlInput.placeholder = '…or paste an image URL (https://)';
  urlInput.className = 'flex-1 min-w-0 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50';
  urlInput.onchange = () => {
    const v = urlInput.value.trim();
    if (!v) return;
    if (!/^https?:\/\//i.test(v)) { showToast('Image URL must start with http(s)://', 'error'); return; }
    setImage(v, v);
  };
  urlRow.appendChild(urlInput);
  textCol.appendChild(urlRow);

  const footer = document.createElement('div');
  footer.className = 'flex flex-wrap items-end justify-between gap-3 pt-3 border-t border-white/[0.04]';
  bar.appendChild(footer);
  const controls = document.createElement('div');
  controls.className = 'flex flex-wrap gap-2';
  footer.appendChild(controls);
  controls.append(
    selectControl('aspect_ratio', 'Aspect', state.aspect_ratio, (v) => { state.aspect_ratio = v; }),
    selectControl('duration', 'Duration', state.duration, (v) => { state.duration = v; }),
    selectControl('resolution', 'Size', state.resolution, (v) => { state.resolution = v; }),
    selectControl('quality', 'Quality', state.quality, (v) => { state.quality = v; }),
  );

  const genBtn = document.createElement('button');
  genBtn.type = 'button';
  genBtn.dataset.vfxGenerate = '';
  genBtn.className = 'bg-primary/10 border border-primary/30 text-white px-7 py-3 rounded-full font-bold text-sm hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed';
  genBtn.textContent = 'Generate ✨';
  footer.appendChild(genBtn);

  // ── Results ─────────────────────────────────────────────────────────────
  const results = document.createElement('div');
  results.className = 'hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3';
  results.dataset.vfxResults = '';
  page.appendChild(results);

  // ── Category tabs + effect grid (upstream filters + sections) ───────────
  const tabs = document.createElement('div');
  tabs.className = 'flex gap-2 overflow-x-auto no-scrollbar';
  page.appendChild(tabs);
  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3';
  grid.dataset.vfxGrid = '';
  page.appendChild(grid);

  const tabButtons = {};
  groups.forEach((g) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.vfxTab = g.id;
    b.textContent = `${g.icon} ${g.label} · ${g.effects.length}`;
    b.onclick = () => { state.category = g.id; renderTabs(); renderGrid(); };
    tabButtons[g.id] = b;
    tabs.appendChild(b);
  });

  function renderTabs() {
    Object.entries(tabButtons).forEach(([id, b]) => {
      b.className = id === state.category
        ? 'px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap bg-primary/10 border border-primary/30 text-white'
        : 'px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap bg-white/5 text-white/60 hover:bg-white/10 hover:text-white';
    });
  }

  function renderSelected() {
    selectedLine.innerHTML = state.effect
      ? `Effect: <span class="text-primary font-bold">${state.effect.name}</span>`
      : 'Pick an effect below, add an image, then Generate.';
  }

  function renderGrid() {
    grid.innerHTML = '';
    const group = groups.find((g) => g.id === state.category);
    group.effects.forEach((fx) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.dataset.vfxEffect = fx.name;
      const active = state.effect?.name === fx.name;
      card.className = `group relative aspect-[3/4] rounded-2xl overflow-hidden border text-left transition-all ${active ? 'border-primary shadow-[0_0_20px_rgba(217,255,0,0.25)]' : 'border-white/10 hover:border-white/30'} bg-[#111]`;
      card.appendChild(thumbImg(fx.thumbs, fx.name));
      const shade = document.createElement('div');
      shade.className = 'absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent';
      card.appendChild(shade);
      const label = document.createElement('div');
      label.className = 'absolute bottom-0 inset-x-0 p-2.5 text-xs font-bold text-white leading-tight';
      label.textContent = fx.name;
      card.appendChild(label);
      card.onclick = () => {
        state.effect = fx;
        renderGrid();
        renderSelected();
      };
      grid.appendChild(card);
    });
  }

  function setImage(url, preview) {
    state.imageUrl = url;
    state.previewUrl = preview || url;
    drop.innerHTML = '';
    const img = document.createElement('img');
    img.src = state.previewUrl;
    img.alt = 'Source image';
    img.className = 'absolute inset-0 w-full h-full object-cover';
    drop.appendChild(img);
  }

  fileInput.onchange = async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    if (!apiKeyManager.getMuapiKey()) { AuthModal(() => fileInput.click()); return; }
    const local = URL.createObjectURL(file);
    setImage('', local);
    drop.insertAdjacentHTML('beforeend', '<div data-vfx-uploading class="absolute inset-0 bg-black/60 flex items-center justify-center text-[11px] text-white">Uploading…</div>');
    try {
      const url = await muapi.uploadFile(file);
      setImage(url, local);
    } catch (err) {
      drop.innerHTML = dropIdle;
      state.imageUrl = '';
      showToast(err?.message || 'Upload failed', 'error');
    }
  };

  function addResult(entry) {
    results.classList.remove('hidden');
    const card = document.createElement('div');
    card.className = 'rounded-2xl overflow-hidden border border-white/10 bg-[#111]';
    card.innerHTML = `
      <video src="${entry.url}" class="w-full aspect-video bg-black object-contain" controls playsinline loop></video>
      <div class="p-3 flex items-center justify-between gap-2">
        <span class="text-xs font-bold text-white truncate">${entry.effect}</span>
        <a href="${entry.url}" download target="_blank" rel="noopener" class="text-xs font-bold text-primary hover:underline">Download</a>
      </div>`;
    results.prepend(card);
  }

  genBtn.onclick = async () => {
    if (state.busy) return;
    if (!state.effect) { showToast('Select an effect first', 'error'); return; }
    if (!state.imageUrl) { showToast('Add an image (upload or https URL) first', 'error'); return; }
    if (!apiKeyManager.getMuapiKey()) { AuthModal(() => genBtn.click()); return; }
    state.busy = true;
    genBtn.disabled = true;
    genBtn.textContent = 'Generating…';
    const pending = document.createElement('div');
    pending.className = 'rounded-2xl border border-white/10 bg-[#111] aspect-video flex items-center justify-center text-xs text-white/60';
    pending.innerHTML = `<span class="animate-pulse">Rendering ${state.effect.name}…</span>`;
    results.classList.remove('hidden');
    results.prepend(pending);
    try {
      const result = await muapi.generateVideoEffect({
        model: state.effect.category,
        name: state.effect.name,
        image_url: state.imageUrl,
        prompt: state.prompt.trim() || undefined,
        aspect_ratio: state.aspect_ratio,
        duration: Number(state.duration),
        resolution: state.resolution,
        quality: state.quality,
        studioType: 'ai-vfx',
      });
      pending.remove();
      if (!result?.url) throw new Error('No video URL returned');
      addResult({ url: result.url, effect: state.effect.name });
      saveGeneration({
        studio: 'video',
        type: 'video',
        url: result.url,
        prompt: state.prompt,
        model: `${state.effect.category}:${state.effect.name}`,
        parameters: { effect: state.effect.name, aspect_ratio: state.aspect_ratio, duration: state.duration, resolution: state.resolution, quality: state.quality, source: 'ai-vfx' },
        request_id: result.request_id || result.id,
      });
      showToast('Video ready', 'success');
    } catch (err) {
      pending.remove();
      if (!results.children.length) results.classList.add('hidden');
      showToast(err?.message || 'Generation failed', 'error', 6000);
    } finally {
      state.busy = false;
      genBtn.disabled = false;
      genBtn.textContent = 'Generate ✨';
    }
  };

  renderTabs();
  renderGrid();
  renderSelected();
  return container;
}
