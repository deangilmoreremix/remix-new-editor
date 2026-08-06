import { muapi } from '../lib/muapi.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { AuthModal } from './AuthModal.js';
import { createUploadPicker } from './UploadPicker.js';
import { createInlineInstructions } from './InlineInstructions.js';
import { createHeroSection, getCustomThumbnailFromCache, saveCustomThumbnailToCache, clearCustomThumbnailCache } from '../lib/thumbnails.js';
import { StudioThumbnailModal, mountStudioThumbnailModal } from './modals/StudioThumbnailPanel.jsx';
import { requireEntitlement } from '../lib/clerkEntitlements.js';
import { getModelLogoHtml, PROVIDER_LOGOS, invertLogos, getProviderStyle, getAvailableProviders, filterModels, renderProviderSidebar, renderSearchBar, renderModelList } from '../lib/modelSelectorUI.js';

const UPSCALE_METHODS = [
  { id: 'ai-image-upscaler', name: 'AI Upscaler', description: 'General-purpose AI upscaling with 2x/4x factor', factors: ['2', '4'], provider: 'muapi', provider_name: 'MuAPI' },
  { id: 'topaz-image-upscale', name: 'Topaz Upscale', description: 'Premium Topaz-quality enhancement', factors: [], provider: 'topaz', provider_name: 'Topaz' },
  { id: 'seedvr2-image-upscale', name: 'Seed Upscale', description: 'SeedVR2 high-fidelity upscaling', factors: [], provider: 'bytedance', provider_name: 'ByteDance' },
];

export function UpscaleStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col items-center bg-app-bg overflow-y-auto p-6 md:p-10 relative';
  mountStudioChrome(container, { currentRoute: 'upscale' });

  let selectedMethod = UPSCALE_METHODS[0];
  let selectedFactor = '2';
  let uploadedUrl = null;
  let customThumbnailUrl = getCustomThumbnailFromCache('upscale-studio');

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

  const methodWrapper = document.createElement('div');
  methodWrapper.className = 'mb-6 flex flex-col items-center gap-2 animate-fade-in-up';
  methodWrapper.style.animationDelay = '0.1s';

  const triggerBtn = document.createElement('button');
  triggerBtn.type = 'button';
  triggerBtn.className = 'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border bg-white/5 text-secondary border-white/10 hover:bg-white/10';
  const updateTrigger = () => {
    const provider = selectedMethod.provider || 'muapi';
    const logoUrl = PROVIDER_LOGOS[provider];
    if (logoUrl) {
      triggerBtn.innerHTML = `<div class="w-4 h-4 rounded flex items-center justify-center overflow-hidden bg-white/5 shrink-0"><img src="${logoUrl}" alt="" class="w-full h-full object-contain ${invertLogos.includes(provider) ? 'invert' : ''}" /></div><span class="truncate">${selectedMethod.name}</span><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-muted shrink-0"><polyline points="6 9 12 15 18 9"/></svg>`;
    } else {
      const style = getProviderStyle(provider);
      triggerBtn.innerHTML = `<div class="w-4 h-4 bg-primary rounded flex items-center justify-center shadow-lg shadow-primary/20 shrink-0"><span class="text-[8px] font-black text-black">${style.text}</span></div><span class="truncate">${selectedMethod.name}</span><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-muted shrink-0"><polyline points="6 9 12 15 18 9"/></svg>`;
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
      const availableProviders = getAvailableProviders(UPSCALE_METHODS);
      dropdown.innerHTML = `
        <div class="flex gap-4 h-full max-h-[70vh] min-h-[350px] overflow-x-hidden">
          <div data-provider-sidebar></div>
          <div class="flex-1 flex flex-col gap-2 min-w-0">
            ${renderSearchBar()}
            <div class="text-xs font-semibold text-secondary py-1 shrink-0 flex items-center justify-between">
              <span>Available models</span>
              <span data-provider-badge class="text-[10px] bg-white/5 px-2 py-0.5 rounded text-white/60 hidden"></span>
            </div>
            <div data-model-list></div>
          </div>
        </div>
      `;
      const sidebarEl = dropdown.querySelector('[data-provider-sidebar]');
      const modelListEl = dropdown.querySelector('[data-model-list]');
      const providerBadge = dropdown.querySelector('[data-provider-badge]');
      const searchInput = dropdown.querySelector('[data-provider-search]');
      let selectedProvider = 'all';
      const refresh = () => {
        sidebarEl.innerHTML = renderProviderSidebar(availableProviders, selectedProvider, (provider) => {
          selectedProvider = provider;
          refresh();
        });
        const filtered = filterModels(UPSCALE_METHODS, searchInput ? searchInput.value : '', selectedProvider);
        const showProviderName = selectedProvider === 'all';
        modelListEl.innerHTML = renderModelList(filtered, selectedMethod.id, showProviderName, (m) => {
          selectedMethod = UPSCALE_METHODS.find(x => x.id === m.id) || m;
          selectedFactor = selectedMethod.factors[0] || '';
          updateTrigger();
          updateFactorBtns();
          closeDropdown();
        });
        if (selectedProvider !== 'all') {
          const pName = availableProviders.find(p => p.id === selectedProvider)?.name || selectedProvider;
          providerBadge.textContent = pName;
          providerBadge.classList.remove('hidden');
        } else {
          providerBadge.classList.add('hidden');
        }
      };
      refresh();
      sidebarEl.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-provider]');
        if (!btn) return;
        e.stopPropagation();
        const provider = btn.getAttribute('data-provider');
        if (provider) {
          selectedProvider = provider;
          refresh();
        }
      });
      searchInput.onclick = (e) => e.stopPropagation();
      searchInput.oninput = () => refresh();
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

  methodWrapper.appendChild(triggerBtn);
  methodWrapper.appendChild(dropdown);
  container.appendChild(methodWrapper);

  setTimeout(() => {
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && e.target !== triggerBtn) {
        closeDropdown();
      }
    });
  }, 0);

  const factorRow = document.createElement('div');
  factorRow.className = 'flex gap-2 mb-6 justify-center';
  container.appendChild(factorRow);

  const formCard = document.createElement('div');
  formCard.className = 'w-full max-w-md bg-[#111]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col gap-5 animate-fade-in-up';
  formCard.style.animationDelay = '0.2s';

  const uploadRow = document.createElement('div');
  uploadRow.className = 'flex items-center gap-4';
  const picker = createUploadPicker({
    anchorContainer: container,
    onSelect: ({ url }) => { uploadedUrl = url; },
    onClear: () => { uploadedUrl = null; },
  });
  uploadRow.appendChild(picker.trigger);
  const hint = document.createElement('span');
  hint.className = 'text-sm text-muted';
  hint.textContent = 'Upload image or video to upscale';
  uploadRow.appendChild(hint);
  formCard.appendChild(uploadRow);
  container.appendChild(picker.panel);

  // Thumbnail studio button — next to creation controls, GTM Boost styling
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
  formCard.appendChild(thumbBtn);

  const genBtn = document.createElement('button');
  genBtn.type = 'button';
  genBtn.className = 'w-full bg-primary text-black py-3.5 rounded-xl font-black text-sm hover:shadow-glow transition-all';
  genBtn.textContent = 'Upscale Image';
  genBtn.setAttribute('aria-label', 'Upscale image');
  formCard.appendChild(genBtn);
  container.appendChild(formCard);

  const inlineInstructions = createInlineInstructions('upscale');
  inlineInstructions.classList.add('max-w-md', 'mt-6');
  container.appendChild(inlineInstructions);

  const resultArea = document.createElement('div');
  resultArea.className = 'w-full max-w-md mt-6 hidden';
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

  genBtn.onclick = async () => {
    if (!(await requireEntitlement())) return;
    if (!uploadedUrl) { alert('Upload an image or video first'); return; }
    const apiKey = apiKeyManager.getMuapiKey();
    if (!apiKey) { AuthModal(() => genBtn.click()); return; }

    genBtn.disabled = true;
    genBtn.innerHTML = '<span class="animate-spin inline-block mr-2">&#9711;</span> Upscaling...';

    try {
      const params = { model: selectedMethod.id, image_url: uploadedUrl, customThumbnailUrl: customThumbnailUrl || undefined };
      if (selectedFactor) params.upscale_factor = parseInt(selectedFactor);
      const result = await muapi.generateI2I(params);
      if (result?.url) {
        resultArea.classList.remove('hidden');
        resultArea.innerHTML = `
          <div class="bg-[#111]/80 border border-white/10 rounded-2xl p-4">
            <img src="${result.url}" class="w-full rounded-xl mb-3">
            <a href="${result.url}" download class="block w-full bg-primary text-black py-2.5 rounded-xl font-bold text-sm text-center hover:shadow-glow transition-all">Download</a>
          </div>
        `;
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
