// src/components/AnimatePage.js
// Animate — image-to-video, model dynamically selected from the catalog.
// Follows the exact pattern of existing studios (vanilla DOM + mountStudioChrome).

import { createStudioHeader } from '../lib/thumbnails.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { listBrands, getBrand, saveAnimation, listAnimations, listCampaigns, listAssets, resolveBrandId } from '../lib/brandStore.js';
import { createUploadPicker } from './UploadPicker.js';
import { showToast, createLoadingOverlay } from '../lib/loading.js';
import { DEFAULT_PROMPTS, SOURCE_PROMPTS } from '../lib/animate.js';
import { muapi } from '../lib/muapi.js';
import { saveGeneration } from '../lib/generationHistory.js';
import { i2vModels } from '../lib/models.js';


const RESOLUTIONS = ['480p', '720p', '1080p'];
const DURATIONS = ['3', '5', '10', '12'];
const SOURCE_TYPES = [
  { id: 'image', label: 'Upload image' },
  { id: 'photoshoot', label: 'From Photo Studio' },
  { id: 'asset', label: 'From campaign asset' },
];

export function AnimatePage() {
  const container = document.createElement('div');
  container.className = 'w-full h-full overflow-y-auto bg-app-bg custom-scrollbar';
  mountStudioChrome(container, { currentRoute: 'animate' });

  const brands = listBrands();
  // ?brandId= (from Brand DNA / an asset) or the last-used brand, not always the first one.
  const selectedBrand = getBrand(resolveBrandId()) || brands[0] || null;

  // ---- State ----
  const state = {
    sourceImageUrl: null,
    sourceType: 'image',
    sourceId: null,
    prompt: SOURCE_PROMPTS.image,
    promptIndex: 0,
    duration: 5,
    resolution: '720p',
    negativePrompt: '',
    seed: undefined,
    steps: undefined,
    guidanceScale: undefined,
    denoiseStrength: undefined,
    cfgScale: undefined,
    promptExtend: false,
    thumbnailUrl: null,
    loading: false,
    result: null,
    error: null,
    history: [],
    historyErrors: [],
    muapiMode: false,
    selectedMuapiModel: null,
  };

  // Hand-off from Storyboard Studio: a frame image plus its motion prompt.
  try {
    const raw = sessionStorage.getItem('storyboard_animate_frame');
    if (raw) {
      sessionStorage.removeItem('storyboard_animate_frame');
      const frame = JSON.parse(raw);
      if (frame?.imageUrl) {
        state.sourceImageUrl = frame.imageUrl;
        if (frame.sourceType === 'asset') {
          state.sourceType = 'asset';
          state.sourceId = frame.sourceId || null;
          state.prompt = SOURCE_PROMPTS.asset;
        }
        if (frame.prompt) state.prompt = frame.prompt;
        if (frame.duration) state.duration = Math.min(12, Math.max(3, Math.round(frame.duration)));
      }
    }
  } catch { /* storage unavailable or bad payload */ }

  const root = document.createElement('div');
  root.className = 'w-full max-w-4xl mx-auto px-4 pb-8 animate-fade-in-up';

  // ---- Header ----
  const header = document.createElement('div');
  header.className = 'mb-6';
  header.appendChild(createStudioHeader('animate', 'Animate Studio', 'Turn any image or product shot into a 3–12s video with AI motion'));
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
      // Keep a prompt the user wrote; swap only an untouched (empty or default) one for this source's default.
      if (!state.prompt || Object.values(SOURCE_PROMPTS).includes(state.prompt)) { state.prompt = SOURCE_PROMPTS[st.id] || ''; promptInput.value = state.prompt; }
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
    } else if (state.sourceType === 'asset') {
      const assets = selectedBrand ? listCampaigns(selectedBrand.id).flatMap((c) => listAssets(c.id)).filter((a) => a.imageUrl) : [];
      if (assets.length > 0) {
        const select = document.createElement('select');
        select.dataset.assetSource = '';
        select.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none appearance-none cursor-pointer mb-2';
        const blank = document.createElement('option');
        blank.value = '';
        blank.textContent = 'Select a campaign asset...';
        select.appendChild(blank);
        assets.forEach((a) => {
          const o = document.createElement('option');
          o.value = a.id;
          o.textContent = `${a.format || a.platform} · ${a.headline || 'Untitled'}`;
          select.appendChild(o);
        });
        select.value = state.sourceId && assets.some((a) => a.id === state.sourceId) ? state.sourceId : '';
        select.onchange = () => {
          const asset = assets.find((a) => a.id === select.value);
          if (asset) {
            state.sourceImageUrl = asset.imageUrl;
            state.sourceId = asset.id;
            renderResult();
          }
        };
        uploadSection.appendChild(select);
        if (state.sourceImageUrl) {
          const preview = document.createElement('img');
          preview.src = state.sourceImageUrl;
          preview.alt = 'Source image';
          preview.className = 'mt-2 h-24 rounded-lg border border-white/10 object-cover';
          uploadSection.appendChild(preview);
        }
      } else {
        const empty = document.createElement('div');
        empty.className = 'text-xs text-muted mb-2';
        empty.textContent = 'No campaign assets found. Generate a campaign first.';
        uploadSection.appendChild(empty);
      }
    } else {
      const picker = createUploadPicker({
        anchorContainer: container,
        acceptVideo: false,
        acceptDocuments: false,
        muapiStudio: true,
        studioId: 'animate',
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
      if (state.sourceImageUrl) {
        const preview = document.createElement('img');
        preview.src = state.sourceImageUrl;
        preview.alt = 'Source image';
        preview.className = 'mt-2 h-24 rounded-lg border border-white/10 object-cover';
        uploadSection.appendChild(preview);
      }
    }
  }

  // ---- Controls ----
  const controls = document.createElement('div');
  controls.className = 'flex flex-col gap-4 mb-6';

  // "Use My Brand" (OpenHiggsBolt Motion Studio): connect a business — name,
  // colors, logos and reference frames — through the personalization modal.
  const brandRow = document.createElement('div');
  brandRow.className = 'flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3';
  brandRow.innerHTML = '<div class="text-sm font-bold text-white">Use My Brand<div class="text-xs font-normal text-secondary">Connect your brand: business name, colors, logos and reference frames.</div></div>';
  const brandBtn = document.createElement('button');
  brandBtn.type = 'button';
  brandBtn.className = 'btn-secondary-modern text-xs shrink-0';
  brandBtn.textContent = 'Connect Personalization';
  brandBtn.setAttribute('aria-haspopup', 'dialog');
  brandBtn.addEventListener('click', async () => {
    const { openMotionBrandPersonalization } = await import('../features/personalization/mount.jsx');
    openMotionBrandPersonalization({ trigger: brandBtn });
  });
  brandRow.appendChild(brandBtn);
  controls.appendChild(brandRow);

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
    chip.textContent = p.length > 28 ? `${p.slice(0, 26)}…` : p;
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

  // ---- MuAPI Mode Toggle ----
  const muapiModeRow = document.createElement('div');
  muapiModeRow.className = 'flex items-center gap-3 mb-2';
  const muapiLabel = document.createElement('label');
  muapiLabel.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
  muapiLabel.textContent = 'Model';
  muapiModeRow.appendChild(muapiLabel);

  const modeToggle = document.createElement('button');
  modeToggle.type = 'button';
  modeToggle.className = `px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${state.muapiMode ? 'bg-primary text-black border-primary' : 'bg-white/5 text-white border-white/10 hover:bg-white/10'}`;
  modeToggle.textContent = state.muapiMode ? 'Choose a model' : 'Seedance Lite (default)';
  modeToggle.onclick = () => {
    state.muapiMode = !state.muapiMode;
    if (!state.muapiMode) state.selectedMuapiModel = null;
    modeToggle.className = `px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${state.muapiMode ? 'bg-primary text-black border-primary' : 'bg-white/5 text-white border-white/10 hover:bg-white/10'}`;
    modeToggle.textContent = state.muapiMode ? 'Choose a model' : 'Seedance Lite (default)';
    renderMuapiModelSelector();
    renderAdvancedMuapiControls();
  };
  muapiModeRow.appendChild(modeToggle);
  controls.appendChild(muapiModeRow);

  const muapiModelWrapper = document.createElement('div');
  muapiModelWrapper.className = 'hidden';
  controls.appendChild(muapiModelWrapper);

  // Advanced MuAPI controls
  const advancedMuapiRow = document.createElement('div');
  advancedMuapiRow.className = 'hidden';
  advancedMuapiRow.id = 'animate-advanced-muapi';
  controls.appendChild(advancedMuapiRow);

  function renderAdvancedMuapiControls() {
    advancedMuapiRow.innerHTML = '';
    if (!state.muapiMode) {
      advancedMuapiRow.classList.add('hidden');
      return;
    }
    advancedMuapiRow.classList.remove('hidden');
    const card = document.createElement('div');
    card.className = 'bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-xl p-4 flex flex-col gap-3';

    const addField = (label, type, value, onChange, placeholder) => {
      const row = document.createElement('div');
      row.className = 'flex flex-col gap-1';
      const lbl = document.createElement('label');
      lbl.className = 'text-[10px] font-bold text-secondary uppercase tracking-wider';
      lbl.textContent = label;
      row.appendChild(lbl);
      const input = document.createElement('input');
      input.type = type;
      input.value = value || '';
      input.placeholder = placeholder || '';
      input.className = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-primary/50';
      input.oninput = (e) => {
        const v = e.target.value;
        onChange(v === '' ? undefined : (type === 'number' ? parseFloat(v) : v));
      };
      row.appendChild(input);
      card.appendChild(row);
    };

    addField('Negative Prompt', 'text', state.negativePrompt, (v) => { state.negativePrompt = v; }, 'Things to avoid...');
    addField('Seed', 'number', state.seed, (v) => { state.seed = v; }, '-1 for random');
    addField('Steps', 'number', state.steps, (v) => { state.steps = v; }, '20');
    addField('Guidance Scale', 'number', state.guidanceScale, (v) => { state.guidanceScale = v; }, '7.5');
    addField('Denoise Strength', 'number', state.denoiseStrength, (v) => { state.denoiseStrength = v; }, '0.7');
    addField('CFG Scale', 'number', state.cfgScale, (v) => { state.cfgScale = v; }, '0.5');
    addField('Thumbnail URL', 'text', state.thumbnailUrl, (v) => { state.thumbnailUrl = v || null; }, 'https://...');

    const extendRow = document.createElement('div');
    extendRow.className = 'flex items-center gap-2';
    const extendLabel = document.createElement('label');
    extendLabel.className = 'text-[10px] font-bold text-secondary uppercase tracking-wider';
    extendLabel.textContent = 'Prompt Extend';
    const extendCheckbox = document.createElement('input');
    extendCheckbox.type = 'checkbox';
    extendCheckbox.checked = state.promptExtend;
    extendCheckbox.className = 'accent-primary';
    extendCheckbox.onchange = (e) => { state.promptExtend = e.target.checked; };
    extendRow.appendChild(extendLabel);
    extendRow.appendChild(extendCheckbox);
    card.appendChild(extendRow);

    advancedMuapiRow.appendChild(card);
  }

  function renderMuapiModelSelector() {
    muapiModelWrapper.innerHTML = '';
    if (!state.muapiMode) {
      muapiModelWrapper.className = 'hidden';
      return;
    }
    muapiModelWrapper.className = 'mb-3';

    const lbl = document.createElement('label');
    lbl.className = 'text-xs font-bold text-secondary uppercase tracking-wider block mb-2';
    lbl.textContent = 'MuAPI Model (I2V)';
    muapiModelWrapper.appendChild(lbl);

    const select = document.createElement('select');
    select.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none appearance-none cursor-pointer';
    select.innerHTML = '<option value="">Select a model...</option>' +
      i2vModels
        .filter(m => !m.family?.startsWith('effect'))
        .map(m => `<option value="${m.id}" ${m.id === state.selectedMuapiModel ? 'selected' : ''}>${m.name}</option>`)
        .join('');
    select.onchange = () => { state.selectedMuapiModel = select.value || null; };
    muapiModelWrapper.appendChild(select);
  }

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
      let data;
      if (state.muapiMode && state.selectedMuapiModel) {
        const result = await muapi.generateI2V({
          model: state.selectedMuapiModel,
          image_url: state.sourceImageUrl,
          prompt: state.prompt,
          negative_prompt: state.negativePrompt || undefined,
          seed: state.seed !== undefined ? state.seed : undefined,
          steps: state.steps !== undefined ? state.steps : undefined,
          guidance_scale: state.guidanceScale !== undefined ? state.guidanceScale : undefined,
          denoise_strength: state.denoiseStrength !== undefined ? state.denoiseStrength : undefined,
          cfg_scale: state.cfgScale !== undefined ? state.cfgScale : undefined,
          prompt_extend: state.promptExtend || undefined,
          duration: state.duration,
          resolution: state.resolution,
          thumbnail_url: state.thumbnailUrl || undefined,
          studioType: 'video',
        });
        data = { videoUrl: result.url, id: result.request_id || result.id };
      } else {
        // Open-Pomelli's animate flow (seedance-lite-i2v), client-side.
        const videoUrl = await muapi.videoI2V(state.prompt || DEFAULT_PROMPTS[0], state.sourceImageUrl, {
          duration: state.duration,
          resolution: state.resolution,
        });
        if (!videoUrl) throw new Error('Animation returned no video');
        data = { videoUrl };
      }
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
      saveGeneration({
        studio: 'video',
        type: 'video',
        url: data.videoUrl,
        prompt: state.prompt,
        model: state.muapiMode ? state.selectedMuapiModel : i2vModels.find(m => !m.family?.startsWith('effect'))?.id || i2vModels[0]?.id || '',
        parameters: { duration: state.duration, resolution: state.resolution, sourceType: state.sourceType },
        request_id: data.id,
      });
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
