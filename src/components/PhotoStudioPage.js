// src/components/PhotoStudioPage.js
// AI Photo Studio — 6 categories × 5 styles = 30 product-photography presets.
// Follows the exact pattern of existing studios (vanilla DOM + mountStudioChrome).

import { mountStudioChrome } from '../lib/studioChrome.js';
import { listBrands, savePhotoshoot } from '../lib/brandStore.js';
import { PHOTO_CATEGORIES, PHOTO_STYLES } from '../lib/photoStudio.js';
import { createUploadPicker } from './UploadPicker.js';
import { createSafeImage } from '../lib/security.js';
import { showToast, createLoadingOverlay } from '../lib/loading.js';
import { apiCall } from '../lib/brandApi.js';
import { muapi } from '../lib/muapi.js';
import { saveGeneration } from '../lib/generationHistory.js';
import { i2iModels, v2vModels } from '../lib/models.js';

const CONCURRENCY = 2;
const RESOLUTIONS = ['1k', '2k', '4k'];

export function PhotoStudioPage() {
  const container = document.createElement('div');
  container.className = 'w-full h-full overflow-y-auto bg-app-bg custom-scrollbar';
  mountStudioChrome(container, { currentRoute: 'photo-studio', title: 'Photo Studio' });

  const brands = listBrands();
  const selectedBrand = brands[0] || null;

  // ---- State ----
  const state = {
    productImageUrl: null,
    logoUrl: selectedBrand?.logoUrl || null,
    selectedCategories: [],
    selectedStyles: [],
    resolution: '2k',
    direction: '',
    negativePrompt: '',
    seed: undefined,
    steps: undefined,
    guidanceScale: undefined,
    denoiseStrength: undefined,
    cfgScale: undefined,
    promptExtend: false,
    style: '',
    strength: undefined,
    thumbnailUrl: null,
    loading: false,
    results: [],
    errors: [],
    muapiMode: false,
    selectedMuapiModel: null,
  };

  const root = document.createElement('div');
  root.className = 'w-full max-w-3xl mx-auto px-4 py-8 animate-fade-in-up';

  // ---- Header ----
  const header = document.createElement('div');
  header.className = 'mb-6';
  header.innerHTML = `
    <h1 class="text-2xl md:text-3xl font-black text-white tracking-tight mb-1">Photo Studio</h1>
    <p class="text-secondary text-sm">AI product photography with brand-aware styling.</p>
  `;
  root.appendChild(header);

  // ---- Upload + Brand Selector ----
  const uploadRow = document.createElement('div');
  uploadRow.className = 'flex flex-wrap items-center gap-3 mb-6';

  const picker = createUploadPicker({
    anchorContainer: container,
    acceptVideo: false,
    onSelect: ({ url }) => {
      state.productImageUrl = url;
      render();
    },
    onClear: () => {
      state.productImageUrl = null;
      render();
    },
  });
  uploadRow.appendChild(picker.trigger);
  uploadRow.appendChild(picker.panel);

  if (brands.length > 0) {
    const brandSelect = document.createElement('select');
    brandSelect.className = 'bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none appearance-none cursor-pointer';
    brandSelect.innerHTML = `
      <option value="">No brand logo</option>
      ${brands.map(b => `<option value="${b.id}" ${b.id === selectedBrand?.id ? 'selected' : ''}>${b.brandName}</option>`).join('')}
    `;
    brandSelect.onchange = () => {
      const b = brands.find(x => x.id === brandSelect.value);
      state.logoUrl = b?.logoUrl || null;
    };
    uploadRow.appendChild(brandSelect);
  }

  root.appendChild(uploadRow);

  // ---- User Direction ----
  const directionRow = document.createElement('div');
  directionRow.className = 'mb-6';
  const directionLabel = document.createElement('label');
  directionLabel.className = 'text-xs font-bold text-secondary uppercase tracking-wider block mb-2';
  directionLabel.textContent = 'Direction (optional)';
  directionRow.appendChild(directionLabel);
  const directionInput = document.createElement('textarea');
  directionInput.placeholder = 'Describe the look, mood, or specific details...';
  directionInput.value = state.direction;
  directionInput.rows = 2;
  directionInput.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors resize-none';
  directionInput.oninput = () => { state.direction = directionInput.value; };
  directionRow.appendChild(directionInput);
  root.appendChild(directionRow);

  // ---- Resolution ----
  const resolutionRow = document.createElement('div');
  resolutionRow.className = 'mb-6';
  const resolutionLabel = document.createElement('label');
  resolutionLabel.className = 'text-xs font-bold text-secondary uppercase tracking-wider block mb-2';
  resolutionLabel.textContent = 'Resolution';
  resolutionRow.appendChild(resolutionLabel);
  const resolutionSelect = document.createElement('select');
  resolutionSelect.className = 'bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none appearance-none cursor-pointer';
  RESOLUTIONS.map(r => `<option value="${r}" ${r === '2k' ? 'selected' : ''}>${r}</option>`).join('');
  resolutionSelect.innerHTML = RESOLUTIONS.map(r => `<option value="${r}" ${r === '2k' ? 'selected' : ''}>${r}</option>`).join('');
  resolutionSelect.onchange = () => { state.resolution = resolutionSelect.value; };
  resolutionRow.appendChild(resolutionSelect);
  root.appendChild(resolutionRow);

  // ---- MuAPI Mode + Model Selector ----
  const muapiRow = document.createElement('div');
  muapiRow.className = 'mb-6';

  const muapiModeRow = document.createElement('div');
  muapiModeRow.className = 'flex items-center gap-3 mb-3';
  const muapiLabel = document.createElement('label');
  muapiLabel.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
  muapiLabel.textContent = 'Generation Mode';
  muapiModeRow.appendChild(muapiLabel);

  const modeToggle = document.createElement('button');
  modeToggle.type = 'button';
  modeToggle.className = `px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${state.muapiMode ? 'bg-primary text-black border-primary' : 'bg-white/5 text-white border-white/10 hover:bg-white/10'}`;
  modeToggle.textContent = state.muapiMode ? 'Direct MuAPI' : 'Brand API';
  modeToggle.onclick = () => {
    state.muapiMode = !state.muapiMode;
    if (!state.muapiMode) state.selectedMuapiModel = null;
    modeToggle.className = `px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${state.muapiMode ? 'bg-primary text-black border-primary' : 'bg-white/5 text-white border-white/10 hover:bg-white/10'}`;
    modeToggle.textContent = state.muapiMode ? 'Direct MuAPI' : 'Brand API';
    renderMuapiModelSelector();
  };
  muapiModeRow.appendChild(modeToggle);
  muapiRow.appendChild(muapiModeRow);

  const muapiModelWrapper = document.createElement('div');
  muapiModelWrapper.className = 'hidden';
  muapiRow.appendChild(muapiModelWrapper);

  root.appendChild(muapiRow);

  // ---- Advanced MuAPI Controls ----
  const advancedMuapiRow = document.createElement('div');
  advancedMuapiRow.className = 'mb-6 hidden';
  advancedMuapiRow.id = 'photo-advanced-muapi';
  muapiRow.appendChild(advancedMuapiRow);

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
    addField('Style', 'text', state.style, (v) => { state.style = v; }, 'e.g. photorealistic');
    addField('Strength', 'number', state.strength, (v) => { state.strength = v; }, '0.6');

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

  // Update advanced controls visibility when mode changes
  const origModeToggleOnClick = modeToggle.onclick;
  modeToggle.onclick = () => {
    state.muapiMode = !state.muapiMode;
    if (!state.muapiMode) state.selectedMuapiModel = null;
    modeToggle.className = `px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${state.muapiMode ? 'bg-primary text-black border-primary' : 'bg-white/5 text-white border-white/10 hover:bg-white/10'}`;
    modeToggle.textContent = state.muapiMode ? 'Direct MuAPI' : 'Brand API';
    renderMuapiModelSelector();
    renderAdvancedMuapiControls();
  };

  root.appendChild(muapiRow);

  function renderMuapiModelSelector() {
    muapiModelWrapper.innerHTML = '';
    if (!state.muapiMode) {
      muapiModelWrapper.className = 'hidden';
      return;
    }
    muapiModelWrapper.className = 'mb-4';

    const lbl = document.createElement('label');
    lbl.className = 'text-xs font-bold text-secondary uppercase tracking-wider block mb-2';
    lbl.textContent = 'MuAPI Model (I2I)';
    muapiModelWrapper.appendChild(lbl);

    const select = document.createElement('select');
    select.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none appearance-none cursor-pointer';
    const seen = new Set();
    const editModels = [...i2iModels, ...v2vModels].filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return m.imageField === 'images_list' && m.hasPrompt;
    });
    select.innerHTML = '<option value="">Select a model...</option>' +
      editModels
        .map(m => `<option value="${m.id}" ${m.id === state.selectedMuapiModel ? 'selected' : ''}>${m.name}</option>`)
        .join('');
    select.onchange = () => { state.selectedMuapiModel = select.value || null; };
    muapiModelWrapper.appendChild(select);
  }

  // ---- Category + Style Selectors (multi-select) ----
  const selectorRow = document.createElement('div');
  selectorRow.className = 'grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6';

  const createMultiSelector = (label, options, selected, onChange) => {
    const wrapper = document.createElement('div');
    const lbl = document.createElement('label');
    lbl.className = 'text-xs font-bold text-secondary uppercase tracking-wider block mb-2';
    lbl.textContent = label;
    wrapper.appendChild(lbl);

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 gap-2';
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const isSelected = selected.includes(opt.id);
      btn.className = `px-3 py-2 rounded-xl text-xs font-bold transition-all border ${isSelected ? 'bg-primary text-black border-primary' : 'bg-white/5 text-white border-white/10 hover:bg-white/10'}`;
      btn.textContent = opt.label;
      btn.onclick = () => {
        const idx = selected.indexOf(opt.id);
        if (idx >= 0) {
          selected.splice(idx, 1);
        } else {
          selected.push(opt.id);
        }
        onChange(selected);
        renderSelectors();
      };
      grid.appendChild(btn);
    });
    wrapper.appendChild(grid);
    return wrapper;
  };

  const categorySelector = createMultiSelector('Category', PHOTO_CATEGORIES, state.selectedCategories, (v) => { state.selectedCategories = v; });
  const styleSelector = createMultiSelector('Style', PHOTO_STYLES, state.selectedStyles, (v) => { state.selectedStyles = v; });

  selectorRow.appendChild(categorySelector);
  selectorRow.appendChild(styleSelector);
  root.appendChild(selectorRow);

  // ---- Generate Button ----
  const generateBtn = document.createElement('button');
  generateBtn.className = 'btn-primary-modern w-full mb-6';
  generateBtn.textContent = 'Generate Product Photos';
  generateBtn.onclick = async () => {
    if (!state.productImageUrl) {
      showToast('Please upload a product image first', 'error');
      return;
    }
    if (state.selectedCategories.length === 0 || state.selectedStyles.length === 0) {
      showToast('Please select at least one category and style', 'error');
      return;
    }

    state.loading = true;
    state.error = null;
    state.results = [];
    state.errors = [];
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating…';

    const overlay = createLoadingOverlay('Generating product photos...');
    container.appendChild(overlay);

    const selectedPairs = [];
    state.selectedCategories.forEach(cat => {
      state.selectedStyles.forEach(style => {
        selectedPairs.push({ category: cat, style });
      });
    });

    try {
      const queue = [...selectedPairs];
      while (queue.length > 0) {
        const batch = queue.splice(0, CONCURRENCY);
        const batchResults = await Promise.allSettled(
          batch.map(async ({ category, style }) => {
            const categoryMeta = PHOTO_CATEGORIES.find(c => c.id === category) || PHOTO_CATEGORIES[0];
            const styleMeta = PHOTO_STYLES.find(s => s.id === style) || PHOTO_STYLES[0];

            if (state.muapiMode && state.selectedMuapiModel) {
              const result = await muapi.generateI2I({
                model: state.selectedMuapiModel,
                image_url: state.productImageUrl,
                prompt: state.direction || undefined,
                negative_prompt: state.negativePrompt || undefined,
                seed: state.seed !== undefined ? state.seed : undefined,
                steps: state.steps !== undefined ? state.steps : undefined,
                guidance_scale: state.guidanceScale !== undefined ? state.guidanceScale : undefined,
                denoise_strength: state.denoiseStrength !== undefined ? state.denoiseStrength : undefined,
                cfg_scale: state.cfgScale !== undefined ? state.cfgScale : undefined,
                prompt_extend: state.promptExtend || undefined,
                style: state.style || undefined,
                strength: state.strength !== undefined ? state.strength : undefined,
                resolution: state.resolution,
                thumbnail_url: state.thumbnailUrl || undefined,
                studioType: 'image',
              });

              return {
                ...result,
                imageUrl: result.url,
                styleLabel: styleMeta.label,
                category: categoryMeta.label,
                styleId: style,
                categoryId: category,
                direction: state.direction,
                resolution: state.resolution,
                aspect: '1:1',
                format: 'png',
              };
            }

            const result = await apiCall('/api/photo-studio/generate', {
              productImageUrl: state.productImageUrl,
              category,
              styleId: style,
              prompt: state.direction || null,
              brandId: selectedBrand?.id || null,
              resolution: state.resolution,
            });

            if (state.direction) {
              result.direction = state.direction;
            }
            result.styleLabel = result.styleLabel || styleMeta.label;
            result.category = result.category || categoryMeta.label;

            return result;
          })
        );

        for (const r of batchResults) {
          if (r.status === 'fulfilled') {
            const result = r.value;
            state.results.push(result);
            if (selectedBrand && result.imageUrl) {
              savePhotoshoot({
                ...result,
                brandId: selectedBrand.id,
              });
            }
            if (result.imageUrl) {
              saveGeneration({
                studio: 'image',
                type: 'image',
                url: result.imageUrl,
                prompt: state.direction || result.direction || '',
                model: state.muapiMode ? state.selectedMuapiModel : 'brandApi/photo-studio',
                parameters: {
                  category: result.category,
                  styleId: result.styleId,
                  resolution: state.resolution,
                  muapiMode: state.muapiMode,
                },
              });
            }
          } else {
            state.errors.push(String(r.reason));
          }
        }
      }

      renderResults();
      if (state.results.length > 0) {
        showToast(`Generated ${state.results.length} photos`, 'success');
      }
      if (state.errors.length > 0) {
        showToast(`${state.errors.length} photo(s) failed`, 'error');
      }
    } catch (err) {
      state.error = String(err);
      showToast(state.error, 'error');
    } finally {
      state.loading = false;
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate Product Photos';
      overlay.remove();
    }
  };
  root.appendChild(generateBtn);

  // ---- Results ----
  const resultSection = document.createElement('div');
  resultSection.className = 'mb-8';
  resultSection.id = 'photo-result';
  root.appendChild(resultSection);

  container.appendChild(root);

  function renderSelectors() {
    selectorRow.innerHTML = '';
    selectorRow.appendChild(createMultiSelector('Category', PHOTO_CATEGORIES, state.selectedCategories, (v) => { state.selectedCategories = v; }));
    selectorRow.appendChild(createMultiSelector('Style', PHOTO_STYLES, state.selectedStyles, (v) => { state.selectedStyles = v; }));
  }

  function renderResults() {
    resultSection.innerHTML = '';

    state.results.forEach((result, idx) => {
      const card = document.createElement('div');
      card.className = 'bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden mb-4';

      if (result.imageUrl) {
        const img = createSafeImage(result.imageUrl, 'Generated product photo', 'w-full h-64 md:h-80 object-cover');
        card.appendChild(img);
      }

      const meta = document.createElement('div');
      meta.className = 'p-4 flex items-center justify-between';
      meta.innerHTML = `
        <div>
          <div class="text-xs font-bold text-white">${result.styleLabel || result.styleId} · ${result.category}</div>
          <div class="text-[10px] text-muted uppercase tracking-wider">${result.aspect} · ${result.resolution || state.resolution}</div>
        </div>
        <div class="flex gap-2">
          <a href="${result.imageUrl}" download class="btn-secondary-modern text-xs">Download</a>
          <a href="/animate?sourceType=photoshoot&sourceId=${result.id}" class="btn-primary-modern text-xs">Animate →</a>
        </div>
      `;
      card.appendChild(meta);
      resultSection.appendChild(card);
    });

    state.errors.forEach((err, idx) => {
      const errorCard = document.createElement('div');
      errorCard.className = 'bg-red-900/20 border border-red-500/30 rounded-xl p-4 mb-4';
      errorCard.innerHTML = `
        <div class="text-xs font-bold text-red-400 mb-1">Error generating photo ${idx + 1}</div>
        <div class="text-xs text-red-300">${escapeHtml(err)}</div>
      `;
      resultSection.appendChild(errorCard);
    });
  }

  function render() {
    // No-op for now; state changes trigger direct updates
  }

  return container;
}

function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
