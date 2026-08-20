import { muapi } from '../lib/muapi.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { AuthModal } from './AuthModal.js';
import { createUploadPicker } from './UploadPicker.js';
import { createInlineInstructions } from './InlineInstructions.js';
import { createHeroSection, getCustomThumbnailFromCache, saveCustomThumbnailToCache, clearCustomThumbnailCache } from '../lib/thumbnails.js';
import { TemplateThumbnailModal, mountThumbnailModal } from './modals/TemplateThumbnailModal.jsx';
import { requireEntitlement } from '../lib/clerkEntitlements.js';
import { mountModelSelector, getModelLogoHtml, PROVIDER_LOGOS, invertLogos, getProviderStyle } from '../lib/modelSelectorUI.js';
import { createAdvancedControls } from '../lib/studioControls.js';
import { getExtendedModel } from '../lib/modelInputExtensions.js';
import { getModelById } from '../lib/models.js';
import { getAssetsForStudio } from '../data/exampleGalleryAssets.js';
import ExampleGallery from './studios/ExampleGallery.js';

const SCENE_PRESETS = [
  'Studio white background', 'Luxury marble surface', 'Outdoor natural light',
  'Lifestyle kitchen counter', 'Neon tech showroom', 'Wooden table cozy',
  'Minimalist gradient', 'Beach sand and waves', 'Office desk setup',
];

const FORMAT_PRESETS = [
  { name: 'Ad Banner', ar: '16:9' },
  { name: 'Social Post', ar: '1:1' },
  { name: 'Story', ar: '9:16' },
  { name: 'Billboard', ar: '21:9' },
];

export function CommercialStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col items-center bg-app-bg overflow-y-auto p-6 md:p-10 relative';
  mountStudioChrome(container, { currentRoute: 'commercial' });

  let uploadedUrl = null;
  let selectedScene = SCENE_PRESETS[0];
  let selectedFormat = FORMAT_PRESETS[0];
  let selectedModel = 'ai-product-shot';
  let dynamicControls = null;
  let dynamicControlsContainer = null;
  let customThumbnailUrl = getCustomThumbnailFromCache('commercial-studio');

  const header = document.createElement('div');
  header.className = 'mb-8 animate-fade-in-up text-center w-full';
  const commBanner = createHeroSection('commercial', 'h-32 md:h-44 mb-4');
  if (commBanner) {
    const bannerText = document.createElement('div');
    bannerText.className = 'absolute bottom-0 left-0 right-0 p-5 z-10';
    bannerText.innerHTML = '<h1 class="text-2xl md:text-4xl font-black text-white tracking-tight mb-2">Commercial Studio</h1><p class="text-white/60 text-sm max-w-md">AI product photography, ads, and commercial content</p>';
    commBanner.appendChild(bannerText);
    header.appendChild(commBanner);
  }
  container.appendChild(header);

  const formCard = document.createElement('div');
  formCard.className = 'w-full max-w-xl bg-[#111]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col gap-5 animate-fade-in-up';
  formCard.style.animationDelay = '0.15s';

  const modelLabel = document.createElement('label');
  modelLabel.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
  modelLabel.textContent = 'Model';
  formCard.appendChild(modelLabel);

  const COMMERCIAL_MODELS = [
    { id: 'ai-product-shot', name: 'Product Shot', provider: 'muapi', provider_name: 'MuAPI' },
    { id: 'ai-product-photography', name: 'Product Photography', provider: 'muapi', provider_name: 'MuAPI' },
  ];

  const modelWrapper = document.createElement('div');
  modelWrapper.className = 'flex flex-col items-center gap-2';

  const triggerBtn = document.createElement('button');
  triggerBtn.type = 'button';
  triggerBtn.className = 'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border bg-white/5 text-secondary border-white/10 hover:bg-white/10';
  const updateTrigger = () => {
    const model = COMMERCIAL_MODELS.find(m => m.id === selectedModel) || COMMERCIAL_MODELS[0];
    const provider = model.provider || 'muapi';
    const logoUrl = PROVIDER_LOGOS[provider];
    if (logoUrl) {
      triggerBtn.innerHTML = `<div class="w-4 h-4 rounded flex items-center justify-center overflow-hidden bg-white/5 shrink-0"><img src="${logoUrl}" alt="" class="w-full h-full object-contain ${invertLogos.includes(provider) ? 'invert' : ''}" /></div><span class="truncate">${model.name}</span><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-muted shrink-0"><polyline points="6 9 12 15 18 9"/></svg>`;
    } else {
      const style = getProviderStyle(provider);
      triggerBtn.innerHTML = `<div class="w-4 h-4 bg-primary rounded flex items-center justify-center shadow-lg shadow-primary/20 shrink-0"><span class="text-[8px] font-black text-black">${style.text}</span></div><span class="truncate">${model.name}</span><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-muted shrink-0"><polyline points="6 9 12 15 18 9"/></svg>`;
    }
  };
  updateTrigger();

  const dropdown = document.createElement('div');
  dropdown.className = 'fixed z-[100] bg-[#111] border border-white/10 rounded-2xl shadow-3xl p-2 opacity-0 pointer-events-none transition-all duration-200 scale-95 origin-bottom';
  dropdown.style.width = 'calc(100vw - 2rem)';
  dropdown.style.maxWidth = '480px';
  dropdown.style.maxHeight = '70vh';
  dropdown.style.minHeight = '350px';

  const closeDropdown = () => {
    dropdown.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
    dropdown.classList.remove('opacity-100', 'pointer-events-auto', 'scale-100');
  };

  const openDropdown = () => {
    dropdown.classList.remove('opacity-0', 'pointer-events-none', 'scale-95');
    dropdown.classList.add('opacity-100', 'pointer-events-auto', 'scale-100');
    if (!dropdown.dataset.populated) {
      dropdown.dataset.populated = 'true';
      mountModelSelector(dropdown, {
        models: COMMERCIAL_MODELS,
        selectedModelId: selectedModel,
        showProviderName: true,
        onSelectModel: (modelId) => {
          selectedModel = modelId;
          updateTrigger();
          closeDropdown();
        },
      });
    }
  };

  triggerBtn.onclick = (e) => {
    e.stopPropagation();
    if (dropdown.classList.contains('opacity-100')) {
      closeDropdown();
    } else {
      openDropdown();
    }
  };

  modelWrapper.appendChild(triggerBtn);
  modelWrapper.appendChild(dropdown);
  formCard.appendChild(modelWrapper);

  setTimeout(() => {
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && e.target !== triggerBtn) {
        closeDropdown();
      }
    });
  }, 0);

  const uploadLabel = document.createElement('label');
  uploadLabel.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
  uploadLabel.textContent = 'Product Media';
  formCard.appendChild(uploadLabel);

  const uploadRow = document.createElement('div');
  uploadRow.className = 'flex items-center gap-4';
  const picker = createUploadPicker({
    anchorContainer: container,
    onSelect: ({ url }) => { uploadedUrl = url; },
    onClear: () => { uploadedUrl = null; },
  });
  uploadRow.appendChild(picker.trigger);
  const uploadHint = document.createElement('span');
  uploadHint.className = 'text-sm text-muted';
  uploadHint.textContent = 'Upload product image or video';
  uploadRow.appendChild(uploadHint);
  formCard.appendChild(uploadRow);
  container.appendChild(picker.panel);

  const pexelsBtn = document.createElement('button');
  pexelsBtn.type = 'button';
  pexelsBtn.className = 'w-10 h-10 shrink-0 rounded-xl border transition-all flex items-center justify-center bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40 group relative overflow-hidden';
  pexelsBtn.title = 'Browse stock photos from Pexels';
  pexelsBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-secondary group-hover:text-primary"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>';
  pexelsBtn.onclick = async () => {
    const { browsePexelsImages } = await import('../lib/studioPexels.js');
    browsePexelsImages({
      title: 'Select Reference Photo',
      studioName: 'Commercial Studio',
      onSelect: (asset) => {
        uploadedUrl = asset.src?.large || asset.url || asset.original;
        const attrContainer = document.getElementById('pexels-commercial-attribution');
        if (attrContainer) {
          attrContainer.innerHTML = '';
          import('../lib/attributionChip.js').then(mod => mod.renderAttributionChip(asset, attrContainer));
        }
      }
    });
  };
  uploadRow.appendChild(pexelsBtn);
  const pexelsCommercialAttr = document.createElement('div');
  pexelsCommercialAttr.id = 'pexels-commercial-attribution';
  pexelsCommercialAttr.className = 'mt-1';
  uploadRow.appendChild(pexelsCommercialAttr);

  const sceneLabel = document.createElement('label');
  sceneLabel.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
  sceneLabel.textContent = 'Scene Preset';
  formCard.appendChild(sceneLabel);

  const sceneGrid = document.createElement('div');
  sceneGrid.className = 'flex flex-wrap gap-2';
  SCENE_PRESETS.forEach(s => {
    const chip = document.createElement('button');
    chip.className = s === selectedScene
      ? 'px-3 py-1.5 rounded-full text-xs font-bold bg-primary text-black transition-all'
      : 'px-3 py-1.5 rounded-full text-xs font-bold bg-white/5 text-secondary hover:bg-white/10 transition-all';
    chip.textContent = s;
    chip.onclick = () => {
      selectedScene = s;
      sceneGrid.querySelectorAll('button').forEach(b => {
        b.className = b.textContent === s
          ? 'px-3 py-1.5 rounded-full text-xs font-bold bg-primary text-black transition-all'
          : 'px-3 py-1.5 rounded-full text-xs font-bold bg-white/5 text-secondary hover:bg-white/10 transition-all';
      });
    };
    sceneGrid.appendChild(chip);
  });
  formCard.appendChild(sceneGrid);

  const formatLabel = document.createElement('label');
  formatLabel.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
  formatLabel.textContent = 'Output Format';
  formCard.appendChild(formatLabel);

  const formatRow = document.createElement('div');
  formatRow.className = 'flex gap-2 flex-wrap';
  FORMAT_PRESETS.forEach(f => {
    const btn = document.createElement('button');
    btn.className = f.name === selectedFormat.name
      ? 'px-4 py-2 rounded-xl text-xs font-bold bg-primary text-black transition-all'
      : 'px-4 py-2 rounded-xl text-xs font-bold bg-white/5 text-secondary hover:bg-white/10 border border-white/10 transition-all';
    btn.textContent = `${f.name} (${f.ar})`;
    btn.onclick = () => {
      selectedFormat = f;
      formatRow.querySelectorAll('button').forEach(b => {
        const isActive = b.textContent.includes(f.name);
        b.className = isActive
          ? 'px-4 py-2 rounded-xl text-xs font-bold bg-primary text-black transition-all'
          : 'px-4 py-2 rounded-xl text-xs font-bold bg-white/5 text-secondary hover:bg-white/10 border border-white/10 transition-all';
      });
    };
    formatRow.appendChild(btn);
  });
  formCard.appendChild(formatRow);

  // Dynamic model-specific advanced controls
  dynamicControlsContainer = document.createElement('div');
  dynamicControlsContainer.className = 'flex flex-col gap-3';
  formCard.appendChild(dynamicControlsContainer);

  function buildDynamicControls() {
    if (!dynamicControlsContainer) return;
    if (dynamicControls) dynamicControls.destroy();
    const model = getExtendedModel(COMMERCIAL_MODELS.find(m => m.id === selectedModel) || COMMERCIAL_MODELS[0]);
    if (!model || !model.inputs || Object.keys(model.inputs).length === 0) {
      dynamicControlsContainer.classList.add('hidden');
      return;
    }
    dynamicControlsContainer.classList.remove('hidden');
    dynamicControls = createAdvancedControls({
      model,
      container: dynamicControlsContainer,
      exclude: new Set(['image_url', 'prompt', 'aspect_ratio']),
    });
  }
  buildDynamicControls();

  // Thumbnail studio button — next to creation controls, GTM Boost styling
  const thumbBtn = document.createElement('button');
  thumbBtn.type = 'button';
  thumbBtn.textContent = '🖼 Thumbnail';
  thumbBtn.title = 'Generate a custom thumbnail';
  thumbBtn.className = 'gtm-boost-btn w-full mt-2';
  thumbBtn.addEventListener('click', () => {
    const modal = new TemplateThumbnailModal({
      appTheme: 'commercial-studio',
      layout: 'panel',
      studioId: 'commercial-studio',
      studioName: 'Commercial Studio',
      aspectRatio: selectedFormat.ar || '1:1',
      outputType: 'image',
      onApply: ({ imageUrl }) => {
        customThumbnailUrl = imageUrl;
        saveCustomThumbnailToCache('commercial-studio', imageUrl);
      },
      onClear: () => {
        customThumbnailUrl = null;
        clearCustomThumbnailCache('commercial-studio');
      },
    });
    mountThumbnailModal(modal);
    modal.open();
  });
  formCard.appendChild(thumbBtn);

  const genBtn = document.createElement('button');
  genBtn.type = 'button';
  genBtn.className = 'w-full bg-primary text-black py-3.5 rounded-xl font-black text-sm hover:shadow-glow transition-all mt-2';
  genBtn.textContent = 'Generate Product Shot';
  genBtn.setAttribute('aria-label', 'Generate product shot');
  formCard.appendChild(genBtn);
  container.appendChild(formCard);

  const inlineInstructions = createInlineInstructions('commercial');
  inlineInstructions.classList.add('max-w-xl', 'mt-6');
  container.appendChild(inlineInstructions);

  const resultArea = document.createElement('div');
  resultArea.className = 'w-full max-w-xl mt-6 hidden';
  resultArea.setAttribute('role', 'status');
  resultArea.setAttribute('aria-live', 'polite');
  container.appendChild(resultArea);

  genBtn.onclick = async () => {
    if (!(await requireEntitlement())) return;
    if (!uploadedUrl) { alert('Upload a product image or video first'); return; }
    const apiKey = apiKeyManager.getMuapiKey();
    if (!apiKey) { AuthModal(() => genBtn.click()); return; }

    genBtn.disabled = true;
    genBtn.innerHTML = '<span class="animate-spin inline-block mr-2">&#9711;</span> Generating...';

    try {
      const params = {
        model: selectedModel,
        image_url: uploadedUrl,
        customThumbnailUrl: customThumbnailUrl || undefined,
      };
      if (dynamicControls) {
        Object.assign(params, dynamicControls.getPayload({}));
      }
      if (selectedModel === 'ai-product-shot') {
        params.scene_description = `${selectedScene}, professional product photography, commercial quality`;
      } else {
        params.prompt = `${selectedScene}, professional product photography, commercial quality`;
        params.aspect_ratio = selectedFormat.ar;
      }
      const result = await muapi.generateI2I(params);
      if (result?.url) {
        resultArea.classList.remove('hidden');
        resultArea.innerHTML = `
          <div class="bg-[#111]/80 border border-white/10 rounded-2xl p-4 animate-fade-in-up">
            <img src="${result.url}" class="w-full rounded-xl mb-3">
            <div class="flex gap-3">
              <a href="${result.url}" download class="flex-1 bg-primary text-black py-2.5 rounded-xl font-bold text-sm text-center hover:shadow-glow transition-all">Download</a>
              <button class="flex-1 bg-white/10 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-white/20 transition-all regen-btn">Generate Again</button>
            </div>
          </div>
        `;
        resultArea.querySelector('.regen-btn').onclick = () => genBtn.click();
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      genBtn.disabled = false;
      genBtn.textContent = 'Generate Product Shot';
    }
  };

    const galleryAssets = getAssetsForStudio('commercial');
    if (galleryAssets.length > 0) {
      const gallery = ExampleGallery({ studioId: 'commercial', assets: galleryAssets, maxCards: 20 });
      container.appendChild(gallery);
    }

    return container;
}
