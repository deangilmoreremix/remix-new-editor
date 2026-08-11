import { muapi } from '../lib/muapi.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { AuthModal } from './AuthModal.js';
import { createUploadPicker } from './UploadPicker.js';
import { createInlineInstructions } from './InlineInstructions.js';
import { createHeroSection, getCustomThumbnailFromCache, saveCustomThumbnailToCache, clearCustomThumbnailCache } from '../lib/thumbnails.js';
import { StudioThumbnailModal, mountStudioThumbnailModal } from './modals/StudioThumbnailPanel.jsx';
import { requireEntitlement } from '../lib/clerkEntitlements.js';
import { mountModelSelector } from '../lib/modelSelectorUI.js';
import { createBeforeAfterSlider } from '../lib/beforeAfterSlider.js';

const UPSCALE_METHODS = [
  { id: 'ai-image-upscaler', name: 'AI Upscaler', description: 'General-purpose AI upscaling with 2x/4x factor', factors: ['2', '4'] },
  { id: 'topaz-image-upscale', name: 'Topaz Upscale', description: 'Premium Topaz-quality enhancement', factors: [] },
  { id: 'seedvr2-image-upscale', name: 'Seed Upscale', description: 'SeedVR2 high-fidelity upscaling', factors: [] },
];

export function UpscaleStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col items-center bg-app-bg overflow-y-auto p-6 md:p-10 relative';
  mountStudioChrome(container, { currentRoute: 'upscale' });

  let selectedMethod = UPSCALE_METHODS[0];
  let selectedFactor = '2';
  let uploadedUrl = null;
  let originalUrl = null;
  let customThumbnailUrl = getCustomThumbnailFromCache('upscale-studio');
  let denoiseLevel = 0;
  let faceEnhance = false;

  const header = document.createElement('div');
  header.className = 'mb-8 animate-fade-in-up text-center w-full max-w-xl';
  const upscaleBanner = createHeroSection('upscale', 'h-32 md:h-44 mb-4');
  if (upscaleBanner) {
    const bannerText = document.createElement('div');
    bannerText.className = 'absolute bottom-0 left-0 right-0 p-5 z-10';
    bannerText.innerHTML = '<h1 class="text-2xl md:text-4xl font-black text-white tracking-tight mb-2">Upscale Suite</h1><p class="text-white/60 text-sm">Enhance and upscale images with 3 AI methods</p>';
    upscaleBanner.appendChild(bannerText);
    header.appendChild(upscaleBanner);
  }
  container.appendChild(header);

  const modelSelectorContainer = document.createElement('div');
  modelSelectorContainer.className = 'w-full mb-6';
  container.appendChild(modelSelectorContainer);

  mountModelSelector(modelSelectorContainer, {
    models: UPSCALE_METHODS,
    selectedModelId: selectedMethod.id,
    onSelectModel: (modelId) => {
      selectedMethod = UPSCALE_METHODS.find(m => m.id === modelId) || selectedMethod;
      selectedFactor = selectedMethod.factors[0] || '';
      updateFactorBtns();
    },
  });

  const factorRow = document.createElement('div');
  factorRow.className = 'flex gap-2 mb-6 justify-center';
  container.appendChild(factorRow);

  const controlsCard = document.createElement('div');
  controlsCard.className = 'w-full max-w-xl bg-[#111]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col gap-5 animate-fade-in-up';
  controlsCard.style.animationDelay = '0.2s';

  const uploadRow = document.createElement('div');
  uploadRow.className = 'flex items-center gap-4';
  const picker = createUploadPicker({
    anchorContainer: container,
    onSelect: ({ url }) => {
      uploadedUrl = url;
      originalUrl = url;
    },
    onClear: () => {
      uploadedUrl = null;
      originalUrl = null;
    },
  });
  uploadRow.appendChild(picker.trigger);
  const hint = document.createElement('span');
  hint.className = 'text-sm text-muted';
  hint.textContent = 'Upload image or video to upscale';
  uploadRow.appendChild(hint);
  controlsCard.appendChild(uploadRow);
  container.appendChild(picker.panel);

  const thumbBtn = document.createElement('button');
  thumbBtn.type = 'button';
  thumbBtn.textContent = '🖼 Thumbnail';
  thumbBtn.title = 'Generate a custom thumbnail';
  thumbBtn.className = 'gtm-boost-btn w-full';
  thumbBtn.addEventListener('click', () => {
    const modal = new StudioThumbnailModal({
      appTheme: 'upscale-studio',
      studioId: 'upscale-studio',
      studioName: 'Upscale Suite',
      aspectRatio: '1:1',
      outputType: 'image',
      onApply: ({ imageUrl }) => {
        customThumbnailUrl = imageUrl;
        saveCustomThumbnailToCache('upscale-studio', imageUrl);
      },
      onClear: () => {
        customThumbnailUrl = null;
        clearCustomThumbnailCache('upscale-studio');
      },
    });
    mountStudioThumbnailModal(modal);
    modal.open();
  });
  controlsCard.appendChild(thumbBtn);

  const denoiseRow = document.createElement('div');
  denoiseRow.className = 'flex flex-col gap-2';
  denoiseRow.innerHTML = `
    <div class="flex items-center justify-between">
      <label class="text-xs font-bold text-secondary uppercase tracking-wider">Denoise Level</label>
      <span id="denoise-val" class="text-xs font-bold text-primary">${denoiseLevel}</span>
    </div>
    <input type="range" id="denoise-slider" min="0" max="100" step="5" value="${denoiseLevel}"
      class="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary">
    <p class="text-[10px] text-muted">Higher values remove more noise but may soften details</p>
  `;
  controlsCard.appendChild(denoiseRow);

  const denoiseSlider = denoiseRow.querySelector('#denoise-slider');
  const denoiseVal = denoiseRow.querySelector('#denoise-val');
  if (denoiseSlider) {
    denoiseSlider.oninput = (e) => {
      denoiseLevel = parseInt(e.target.value);
      denoiseVal.textContent = denoiseLevel;
    };
  }

  const faceRow = document.createElement('div');
  faceRow.className = 'flex items-center justify-between bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3';
  faceRow.innerHTML = `
    <div class="flex items-center gap-3">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-secondary"><circle cx="12" cy="12" r="10"/><circle cx="9" cy="10" r="1.5" fill="currentColor"/><circle cx="15" cy="10" r="1.5" fill="currentColor"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/></svg>
      <div>
        <div class="text-xs font-bold text-white">Face Enhancement</div>
        <div class="text-[10px] text-muted">Improve facial features and sharpness</div>
      </div>
    </div>
    <button id="face-enhance-toggle" class="relative w-11 h-6 bg-white/10 rounded-full transition-colors" aria-label="Toggle face enhancement">
      <span class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform"></span>
    </button>
  `;
  controlsCard.appendChild(faceRow);

  const faceToggle = faceRow.querySelector('#face-enhance-toggle');
  if (faceToggle) {
    faceToggle.onclick = () => {
      faceEnhance = !faceEnhance;
      if (faceEnhance) {
        faceToggle.classList.remove('bg-white/10');
        faceToggle.classList.add('bg-primary');
        faceToggle.querySelector('span').classList.add('translate-x-5');
      } else {
        faceToggle.classList.add('bg-white/10');
        faceToggle.classList.remove('bg-primary');
        faceToggle.querySelector('span').classList.remove('translate-x-5');
      }
    };
  }

  const genBtn = document.createElement('button');
  genBtn.type = 'button';
  genBtn.className = 'w-full bg-primary text-black py-3.5 rounded-xl font-black text-sm hover:shadow-glow transition-all mt-2';
  genBtn.textContent = 'Upscale Image';
  genBtn.setAttribute('aria-label', 'Upscale image');
  controlsCard.appendChild(genBtn);
  container.appendChild(controlsCard);

  const inlineInstructions = createInlineInstructions('upscale');
  inlineInstructions.classList.add('max-w-xl', 'mt-6');
  container.appendChild(inlineInstructions);

  const resultArea = document.createElement('div');
  resultArea.className = 'w-full max-w-xl mt-6 hidden';
  resultArea.setAttribute('role', 'status');
  resultArea.setAttribute('aria-live', 'polite');
  container.appendChild(resultArea);

  function updateFactorBtns() {
    factorRow.innerHTML = '';
    if (selectedMethod.factors.length === 0) return;
    selectedMethod.factors.forEach(f => {
      const btn = document.createElement('button');
      btn.className = f === selectedFactor
        ? 'px-4 py-2 rounded-lg text-xs font-bold bg-primary text-black'
        : 'px-4 py-2 rounded-lg text-xs font-bold bg-white/5 text-secondary hover:bg-white/10';
      btn.textContent = `${f}x`;
      btn.onclick = () => { selectedFactor = f; updateFactorBtns(); };
      factorRow.appendChild(btn);
    });
  }

  function renderComparison(upscaledUrl) {
    if (!originalUrl || !upscaledUrl) return;
    resultArea.innerHTML = '';
    const slider = createBeforeAfterSlider(originalUrl, upscaledUrl, 'Before', 'After');
    resultArea.appendChild(slider);
  }

  genBtn.onclick = async () => {
    if (!(await requireEntitlement())) return;
    if (!uploadedUrl) { alert('Upload an image or video first'); return; }
    const apiKey = apiKeyManager.getMuapiKey();
    if (!apiKey) { AuthModal(() => genBtn.click()); return; }

    genBtn.disabled = true;
    genBtn.innerHTML = '<span class="animate-spin inline-block mr-2">&#9711;</span> Upscaling...';

    try {
      const params = {
        model: selectedMethod.id,
        image_url: uploadedUrl,
        denoise_level: denoiseLevel / 100,
        face_enhance: faceEnhance,
        customThumbnailUrl: customThumbnailUrl || undefined,
      };
      if (selectedFactor) params.upscale_factor = parseInt(selectedFactor);
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
        renderComparison(result.url);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      genBtn.disabled = false;
      genBtn.textContent = 'Upscale Image';
    }
  };

  updateFactorBtns();
  return container;
}
