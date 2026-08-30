// src/components/AnimatePage.js
// Animate — image-to-video via seedance-lite-i2v.
// Follows the exact pattern of existing studios (vanilla DOM + mountStudioChrome).

import { navigate } from '../lib/router.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { listBrands, saveAnimation, listAnimations } from '../lib/brandStore.js';
import { createUploadPicker } from './UploadPicker.js';
import { createSafeImage } from '../lib/security.js';
import { showToast, createLoadingOverlay, createProgressBar } from '../lib/loading.js';
import { DEFAULT_PROMPTS } from '../lib/animate.js';
import { apiCall } from '../lib/brandApi.js';

function getBackendBase() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.__BACKEND_URL__) {
    return window.__BACKEND_URL__.replace(/\/$/, '');
  }
  return '';
}

const RESOLUTIONS = ['480p', '720p', '1080p'];
const DURATIONS = ['3', '5', '10', '12'];
const SOURCE_TYPES = [
  { id: 'image', label: 'Image' },
  { id: 'photoshoot', label: 'Photoshoot' },
  { id: 'upload', label: 'Upload' },
];

export function AnimatePage() {
  const container = document.createElement('div');
  container.className = 'w-full h-full overflow-y-auto bg-app-bg custom-scrollbar';
  mountStudioChrome(container, { currentRoute: 'animate', title: 'Animate' });

  const brands = listBrands();
  const selectedBrand = brands[0] || null;

  // ---- State ----
  const state = {
    sourceImageUrl: null,
    sourceType: 'image',
    sourceId: null,
    prompt: '',
    promptIndex: 0,
    duration: 5,
    resolution: '480p',
    loading: false,
    result: null,
    error: null,
    history: [],
    historyErrors: [],
  };

  const root = document.createElement('div');
  root.className = 'w-full max-w-3xl mx-auto px-4 py-8 animate-fade-in-up';

  // ---- Header ----
  const header = document.createElement('div');
  header.className = 'mb-6';
  header.innerHTML = `
    <h1 class="text-2xl md:text-3xl font-black text-white tracking-tight mb-1">Animate</h1>
    <p class="text-secondary text-sm">Turn any image into a short video with AI motion.</p>
  `;
  root.appendChild(header);

  // ---- Source Type Tabs ----
  const sourceTabs = document.createElement('div');
  sourceTabs.className = 'flex gap-2 mb-4';
  SOURCE_TYPES.forEach(st => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = `px-4 py-2 rounded-xl text-xs font-bold transition-all border ${state.sourceType === st.id ? 'bg-primary text-black border-primary' : 'bg-white/5 text-white border-white/10 hover:bg-white/10'}`;
    tab.textContent = st.label;
    tab.onclick = () => {
      state.sourceType = st.id;
      state.sourceImageUrl = null;
      state.sourceId = null;
      state.result = null;
      state.error = null;
      renderSourceTabs();
      renderUpload();
      renderResult();
    };
    sourceTabs.appendChild(tab);
  });
  root.appendChild(sourceTabs);

  // ---- Upload / Source Selector ----
  const uploadSection = document.createElement('div');
  uploadSection.className = 'mb-6';
  root.appendChild(uploadSection);

  function renderSourceTabs() {
    sourceTabs.querySelectorAll('button').forEach((tab, idx) => {
      const st = SOURCE_TYPES[idx];
      if (state.sourceType === st.id) {
        tab.classList.add('bg-primary', 'text-black', 'border-primary');
        tab.classList.remove('bg-white/5', 'text-white', 'border-white/10');
      } else {
        tab.classList.remove('bg-primary', 'text-black', 'border-primary');
        tab.classList.add('bg-white/5', 'text-white', 'border-white/10');
      }
    });
  }

  function renderUpload() {
    uploadSection.innerHTML = '';

    if (state.sourceType === 'photoshoot') {
      const photoshoots = selectedBrand ? listPhotoshootsForBrand(selectedBrand.id) : [];
      if (photoshoots.length > 0) {
        const select = document.createElement('select');
        select.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none appearance-none cursor-pointer mb-2';
        select.innerHTML = '<option value="">Select a photoshoot...</option>' +
          photoshoots.map(p => `<option value="${p.id}">${p.category} · ${p.styleLabel || p.styleId}</option>`).join('');
        select.onchange = () => {
          const photoshoot = photoshoots.find(p => p.id === select.value);
          if (photoshoot) {
            state.sourceImageUrl = photoshoot.imageUrl;
            state.sourceId = photoshoot.id;
            renderResult();
          }
        };
        uploadSection.appendChild(select);
      } else {
        const empty = document.createElement('div');
        empty.className = 'text-xs text-muted mb-2';
        empty.textContent = 'No photoshoots found. Create one in Photo Studio first.';
        uploadSection.appendChild(empty);
      }
    } else if (state.sourceType === 'upload') {
      const uploadRow = document.createElement('div');
      uploadRow.className = 'mb-2';
      const picker = createUploadPicker({
        anchorContainer: container,
        acceptVideo: false,
        onSelect: ({ url }) => {
          state.sourceImageUrl = url;
          renderResult();
        },
        onClear: () => {
          state.sourceImageUrl = null;
          state.sourceId = null;
          renderResult();
        },
      });
      uploadRow.appendChild(picker.trigger);
      uploadRow.appendChild(picker.panel);
      uploadSection.appendChild(uploadRow);

      const fetchUploadRow = document.createElement('div');
      fetchUploadRow.className = 'mt-2';
      const fetchBtn = document.createElement('button');
      fetchBtn.type = 'button';
      fetchBtn.className = 'btn-secondary-modern text-xs';
      fetchBtn.textContent = 'Upload via API';
      fetchBtn.onclick = async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async () => {
          const file = input.files[0];
          if (!file) return;
          try {
            const formData = new FormData();
            formData.append('file', file);
            const backendBase = getBackendBase();
            const uploadUrl = backendBase ? `${backendBase}/api/animate/upload` : '/api/animate/upload';
            const res = await fetch(uploadUrl, { method: 'POST', body: formData });
            if (!res.ok) throw new Error('Upload failed');
            const data = await res.json();
            state.sourceImageUrl = data.url || data.path;
            state.sourceId = data.id;
            renderResult();
            showToast('Image uploaded', 'success');
          } catch (err) {
            showToast(String(err), 'error');
          }
        };
        input.click();
      };
      fetchUploadRow.appendChild(fetchBtn);
      uploadSection.appendChild(fetchUploadRow);
    } else {
      const picker = createUploadPicker({
        anchorContainer: container,
        acceptVideo: false,
        onSelect: ({ url }) => {
          state.sourceImageUrl = url;
          renderResult();
        },
        onClear: () => {
          state.sourceImageUrl = null;
          state.sourceId = null;
          renderResult();
        },
      });
      uploadSection.appendChild(picker.trigger);
      uploadSection.appendChild(picker.panel);
    }
  }

  // ---- Controls ----
  const controls = document.createElement('div');
  controls.className = 'flex flex-col gap-4 mb-6';

  const promptRow = document.createElement('div');
  const promptLabel = document.createElement('label');
  promptLabel.className = 'text-[10px] font-bold text-secondary uppercase tracking-wider block mb-1';
  promptLabel.textContent = 'Motion Prompt';
  promptRow.appendChild(promptLabel);

  const promptSuggestions = document.createElement('div');
  promptSuggestions.className = 'flex flex-wrap gap-1 mb-2';
  DEFAULT_PROMPTS.forEach((p, idx) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `px-2 py-1 rounded-lg text-[10px] font-bold transition-all border ${state.promptIndex === idx ? 'bg-primary text-black border-primary' : 'bg-white/5 text-white border-white/10 hover:bg-white/10'}`;
    chip.textContent = `Prompt ${idx + 1}`;
    chip.title = p;
    chip.onclick = () => {
      state.promptIndex = idx;
      state.prompt = p;
      renderPromptSuggestions();
      promptInput.value = p;
    };
    promptSuggestions.appendChild(chip);
  });
  promptRow.appendChild(promptSuggestions);

  const promptInput = document.createElement('textarea');
  promptInput.placeholder = 'Describe the motion or effect (optional)';
  promptInput.value = state.prompt;
  promptInput.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors resize-none';
  promptInput.rows = 2;
  promptInput.oninput = () => { state.prompt = promptInput.value; };
  promptRow.appendChild(promptInput);
  controls.appendChild(promptRow);

  function renderPromptSuggestions() {
    promptSuggestions.querySelectorAll('button').forEach((chip, idx) => {
      if (state.promptIndex === idx) {
        chip.classList.add('bg-primary', 'text-black', 'border-primary');
        chip.classList.remove('bg-white/5', 'text-white', 'border-white/10');
      } else {
        chip.classList.remove('bg-primary', 'text-black', 'border-primary');
        chip.classList.add('bg-white/5', 'text-white', 'border-white/10');
      }
    });
  }

  const optionRow = document.createElement('div');
  optionRow.className = 'grid grid-cols-2 gap-3';

  const createSelect = (label, value, options, onChange) => {
    const wrapper = document.createElement('div');
    const lbl = document.createElement('label');
    lbl.className = 'text-[10px] font-bold text-secondary uppercase tracking-wider block mb-1';
    lbl.textContent = label;
    wrapper.appendChild(lbl);
    const select = document.createElement('select');
    select.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none appearance-none cursor-pointer';
    options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt;
      option.textContent = opt;
      select.appendChild(option);
    });
    select.value = value;
    select.onchange = () => { onChange(select.value); };
    wrapper.appendChild(select);
    return wrapper;
  };

  optionRow.appendChild(createSelect('Duration', String(state.duration), DURATIONS, (v) => { state.duration = parseInt(v, 10); }));
  optionRow.appendChild(createSelect('Resolution', state.resolution, RESOLUTIONS, (v) => { state.resolution = v; }));
  controls.appendChild(optionRow);

  const generateBtn = document.createElement('button');
  generateBtn.className = 'btn-primary-modern w-full';
  generateBtn.textContent = 'Animate';
  generateBtn.onclick = async () => {
    if (!state.sourceImageUrl) {
      showToast('Please upload an image first', 'error');
      return;
    }
    state.loading = true;
    state.error = null;
    state.result = null;
    generateBtn.disabled = true;
    generateBtn.textContent = 'Animating…';

    const overlay = createLoadingOverlay('Animating image...');
    container.appendChild(overlay);

    try {
      const data = await apiCall('/api/animate/generate', {
        sourceImageUrl: state.sourceImageUrl,
        sourceType: state.sourceType,
        sourceId: state.sourceId,
        prompt: state.prompt,
        duration: state.duration,
        resolution: state.resolution,
        brandId: selectedBrand?.id || null,
      });
      state.result = { videoUrl: data.videoUrl };
      if (selectedBrand) {
        saveAnimation({
          id: data.id || `${selectedBrand.id}_${Date.now()}`,
          brandId: selectedBrand.id,
          sourceImageUrl: state.sourceImageUrl,
          sourceType: state.sourceType,
          sourceId: state.sourceId,
          prompt: state.prompt,
          videoUrl: data.videoUrl,
          duration: state.duration,
          resolution: state.resolution,
          createdAt: new Date().toISOString(),
        });
      }
      renderResult();
      renderHistory();
      showToast('Animation complete', 'success');
    } catch (err) {
      state.error = String(err);
      showToast(state.error, 'error');
    } finally {
      state.loading = false;
      generateBtn.disabled = false;
      generateBtn.textContent = 'Animate';
      overlay.remove();
    }
  };
  controls.appendChild(generateBtn);
  root.appendChild(controls);

  // ---- Result ----
  const resultSection = document.createElement('div');
  resultSection.className = 'mb-8';
  resultSection.id = 'animate-result';
  root.appendChild(resultSection);

  // ---- History ----
  const historySection = document.createElement('div');
  historySection.className = 'mb-8';
  const historyHeader = document.createElement('div');
  historyHeader.className = 'flex items-center justify-between mb-4';
  historyHeader.innerHTML = `
    <div>
      <h2 class="text-lg font-bold text-white">Animation History</h2>
      <p class="text-xs text-muted mt-1">Recent animations for your brand.</p>
    </div>
  `;
  historySection.appendChild(historyHeader);
  const historyGrid = document.createElement('div');
  historyGrid.className = 'grid grid-cols-1 sm:grid-cols-2 gap-3';
  historySection.appendChild(historyGrid);
  root.appendChild(historySection);

  container.appendChild(root);

  function renderResult() {
    resultSection.innerHTML = '';
    if (!state.result?.videoUrl) return;

    const card = document.createElement('div');
    card.className = 'bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden';

    const video = document.createElement('video');
    video.src = state.result.videoUrl;
    video.controls = true;
    video.autoplay = true;
    video.loop = true;
    video.className = 'w-full h-64 md:h-80 object-contain bg-black';
    card.appendChild(video);

    const meta = document.createElement('div');
    meta.className = 'p-4 flex items-center justify-between';
    meta.innerHTML = `
      <div>
        <div class="text-xs font-bold text-white">${state.duration}s · ${state.resolution}</div>
        <div class="text-[10px] text-muted uppercase tracking-wider">Image to Video</div>
      </div>
      <a href="${state.result.videoUrl}" download class="btn-secondary-modern text-xs">Download</a>
    `;
    card.appendChild(meta);
    resultSection.appendChild(card);
  }

  function renderHistory() {
    if (!selectedBrand) return;
    const animations = listAnimations(selectedBrand.id).slice(0, 8);
    state.history = animations;
    historyGrid.innerHTML = '';

    animations.forEach(anim => {
      const card = document.createElement('div');
      card.className = 'bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden';
      if (anim.videoUrl) {
        const video = document.createElement('video');
        video.src = anim.videoUrl;
        video.controls = true;
        video.className = 'w-full h-32 object-contain bg-black';
        card.appendChild(video);
      }
      const meta = document.createElement('div');
      meta.className = 'p-3';
      meta.innerHTML = `
        <div class="text-[10px] text-muted uppercase tracking-wider">${anim.sourceType || 'image'} · ${anim.resolution || ''} · ${anim.duration || ''}s</div>
        <div class="text-[10px] text-muted mt-1">${new Date(anim.createdAt).toLocaleDateString()}</div>
      `;
      card.appendChild(meta);
      historyGrid.appendChild(card);
    });

    state.historyErrors.forEach(err => {
      const errorCard = document.createElement('div');
      errorCard.className = 'bg-red-900/20 border border-red-500/30 rounded-xl p-3';
      errorCard.innerHTML = `
        <div class="text-[10px] font-bold text-red-400 mb-1">Animation Error</div>
        <div class="text-xs text-red-300">${escapeHtml(err)}</div>
      `;
      historyGrid.appendChild(errorCard);
    });
  }

  function listPhotoshootsForBrand(brandId) {
    try {
      return JSON.parse(localStorage.getItem('brand_photoshoots') || '[]').filter(p => p.brandId === brandId);
    } catch {
      return [];
    }
  }

  function render() {
    renderSourceTabs();
    renderUpload();
    renderPromptSuggestions();
    renderHistory();
  }

  render();

  return container;
}

function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
