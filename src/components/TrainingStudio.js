import { muapi } from '../lib/muapi.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { trainingModels } from '../lib/models.js';
import { AuthModal } from './AuthModal.js';
import { createUploadPicker } from './UploadPicker.js';
import { createHeroSection, getCustomThumbnailFromCache, saveCustomThumbnailToCache, clearCustomThumbnailCache } from '../lib/thumbnails.js';
import { createInlineInstructions } from './InlineInstructions.js';
import { TemplateThumbnailModal, mountThumbnailModal } from './modals/TemplateThumbnailModal.jsx';
import { requireEntitlement } from '../lib/clerkEntitlements.js';
import { getModelLogoHtml, PROVIDER_LOGOS, invertLogos, getProviderStyle, getAvailableProviders, filterModels, renderProviderSidebar, renderSearchBar, renderModelList } from '../lib/modelSelectorUI.js';
import { openPromptGallery } from '../lib/promptGalleryIntegration.js';
import { openRecipeModal } from '../lib/recipeIntegration.js';
import { openMonetizationHub } from '../lib/monetizationIntegration.js';

export function TrainingStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col items-center bg-app-bg overflow-y-auto p-6 md:p-10 relative';
  mountStudioChrome(container, { currentRoute: 'training' });

  let selectedModel = trainingModels[0];
  let loraName = '';
  let triggerWord = '';
  let epochs = '10';
  let uploadedImages = [];
  let customThumbnailUrl = getCustomThumbnailFromCache('training-studio');

  // Header with hero banner
  const header = document.createElement('div');
  header.className = 'mb-8 animate-fade-in-up text-center w-full';
  const trainingBanner = createHeroSection('training', 'h-32 md:h-44 mb-4');
  if (trainingBanner) {
    const bannerText = document.createElement('div');
    bannerText.className = 'absolute bottom-0 left-0 right-0 p-5 z-10';
    bannerText.innerHTML = '<h1 class="text-2xl md:text-4xl font-black text-white tracking-tight mb-2">Training Studio</h1><p class="text-white/60 text-sm">Train custom LoRA models from your images</p>';
    trainingBanner.appendChild(bannerText);
    header.appendChild(trainingBanner);
  }
  container.appendChild(header);

  // Model selector
  const modelWrapper = document.createElement('div');
  modelWrapper.className = 'mb-6 flex flex-col items-center gap-2 animate-fade-in-up';
  modelWrapper.style.animationDelay = '0.1s';

const triggerBtn = document.createElement('button');
  triggerBtn.type = 'button';
  triggerBtn.className = 'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border bg-white/5 text-secondary border-white/10 hover:bg-white/10';
  const updateTrigger = () => {
    const provider = selectedModel.provider || 'muapi';
    const logoUrl = PROVIDER_LOGOS[provider];
    if (logoUrl) {
      triggerBtn.innerHTML = `<div class="w-4 h-4 rounded flex items-center justify-center overflow-hidden bg-white/5 shrink-0"><img src="${logoUrl}" alt="" class="w-full h-full object-contain ${invertLogos.includes(provider) ? 'invert' : ''}" /></div><span class="truncate">${selectedModel.name}</span><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-muted shrink-0"><polyline points="6 9 12 15 18 9"/></svg>`;
    } else {
      const style = getProviderStyle(provider);
      triggerBtn.innerHTML = `<div class="w-4 h-4 bg-primary rounded flex items-center justify-center shadow-lg shadow-primary/20 shrink-0"><span class="text-[8px] font-black text-black">${style.text}</span></div><span class="truncate">${selectedModel.name}</span><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-muted shrink-0"><polyline points="6 9 12 15 18 9"/></svg>`;
    }
  };
  updateTrigger();

  const dropdown = document.createElement('div');
  dropdown.className = 'fixed z-[200] bg-[#111] border border-white/10 rounded-2xl shadow-3xl p-2 opacity-0 pointer-events-none transition-all duration-200 scale-95 origin-bottom';
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
      const availableProviders = getAvailableProviders(trainingModels);
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
        const filtered = filterModels(trainingModels, searchInput ? searchInput.value : '', selectedProvider);
        const showProviderName = selectedProvider === 'all';
        modelListEl.innerHTML = renderModelList(filtered, selectedModel.id, showProviderName, (m) => {
          selectedModel = trainingModels.find(x => x.id === m.id) || m;
          updateTrigger();
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

  modelWrapper.appendChild(triggerBtn);
  modelWrapper.appendChild(dropdown);
  container.appendChild(modelWrapper);

  setTimeout(() => {
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && e.target !== triggerBtn) {
        closeDropdown();
      }
    });
  }, 0);

  // Form card
  const formCard = document.createElement('div');
  formCard.className = 'w-full max-w-md bg-[#111]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col gap-5 animate-fade-in-up';
  formCard.style.animationDelay = '0.2s';

  // LoRA Name
  const nameGroup = document.createElement('div');
  nameGroup.className = 'flex flex-col gap-2';
  const nameLabel = document.createElement('label');
  nameLabel.className = 'text-sm font-bold text-secondary';
  nameLabel.textContent = 'LoRA Name';
  nameGroup.appendChild(nameLabel);
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white placeholder-white/30 focus:border-primary focus:outline-none';
  nameInput.placeholder = 'MyCustomLoRA';
  nameInput.oninput = (e) => { loraName = e.target.value; };
  nameGroup.appendChild(nameInput);
  formCard.appendChild(nameGroup);

  // Trigger Word
  const triggerGroup = document.createElement('div');
  triggerGroup.className = 'flex flex-col gap-2';
  const triggerLabel = document.createElement('label');
  triggerLabel.className = 'text-sm font-bold text-secondary';
  triggerLabel.textContent = 'Trigger Word (optional)';
  triggerGroup.appendChild(triggerLabel);
  const triggerInput = document.createElement('input');
  triggerInput.type = 'text';
  triggerInput.className = 'w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white placeholder-white/30 focus:border-primary focus:outline-none';
  triggerInput.placeholder = 'mytriggerword';
  triggerInput.oninput = (e) => { triggerWord = e.target.value; };
  triggerGroup.appendChild(triggerInput);
  formCard.appendChild(triggerGroup);

  // Epochs selector
  const epochsGroup = document.createElement('div');
  epochsGroup.className = 'flex flex-col gap-2';
  const epochsLabel = document.createElement('label');
  epochsLabel.className = 'text-sm font-bold text-secondary';
  epochsLabel.textContent = 'Training Epochs';
  epochsGroup.appendChild(epochsLabel);
  const epochsRow = document.createElement('div');
  epochsRow.className = 'flex gap-2';
  ['5', '10', '20', '30'].forEach(e => {
    const btn = document.createElement('button');
    btn.className = e === epochs 
      ? 'px-4 py-2 rounded-lg text-xs font-bold btn-secondary-modern' 
      : 'px-4 py-2 rounded-lg text-xs font-bold bg-white/5 text-secondary hover:bg-white/10';
    btn.textContent = e;
    btn.onclick = () => {
      epochs = e;
      updateEpochsBtns();
    };
    epochsRow.appendChild(btn);
  });
  epochsGroup.appendChild(epochsRow);
  formCard.appendChild(epochsGroup);

  // Image upload
  const imageUploadGroup = document.createElement('div');
  imageUploadGroup.className = 'flex flex-col gap-2';
  const imageLabel = document.createElement('label');
  imageLabel.className = 'text-sm font-bold text-secondary';
  imageLabel.textContent = 'Training Images (10-20 recommended)';
  imageUploadGroup.appendChild(imageLabel);

  const imagePicker = createUploadPicker({
    anchorContainer: container,
    acceptVideo: false,
    maxImages: 20,
    onSelect: ({ urls }) => { 
      uploadedImages = urls; 
      updateImageCount();
    },
    onClear: () => { uploadedImages = []; },
  });
  imageUploadGroup.appendChild(imagePicker.trigger);
  
  const imageCount = document.createElement('span');
  imageCount.className = 'text-sm text-muted';
  imageCount.textContent = uploadedImages.length > 0 ? `${uploadedImages.length} images selected` : '';
  imageUploadGroup.appendChild(imageCount);
  
  formCard.appendChild(imageUploadGroup);
  container.appendChild(imagePicker.panel);

  // Thumbnail studio button — next to creation controls, GTM Boost styling
  const thumbBtn = document.createElement('button');
  thumbBtn.type = 'button';
  thumbBtn.textContent = '🖼 Thumbnail';
  thumbBtn.title = 'Generate a custom thumbnail';
  thumbBtn.className = 'btn-ghost-modern w-full';
  thumbBtn.addEventListener('click', () => {
    const modal = new TemplateThumbnailModal({
      appTheme: 'training-studio',
      layout: 'panel',
      studioId: 'training-studio',
      studioName: 'Training Studio',
      aspectRatio: '1:1',
      outputType: 'image',
      onApply: ({ imageUrl }) => {
        customThumbnailUrl = imageUrl;
        saveCustomThumbnailToCache('training-studio', imageUrl);
      },
      onClear: () => {
        customThumbnailUrl = null;
        clearCustomThumbnailCache('training-studio');
      },
    });
    mountThumbnailModal(modal);
    modal.open();
  });
  formCard.appendChild(thumbBtn);

  // Train button
  const trainBtn = document.createElement('button');
trainBtn.type = 'button';
  trainBtn.className = 'btn-primary-modern w-full px-[14px] py-2 min-h-[40px] text-[13px] font-bold rounded-2xl inline-flex items-center justify-center gap-1.5 transition-all';
  trainBtn.textContent = 'Train LoRA';
  trainBtn.setAttribute('aria-label', 'Train LoRA');
  formCard.appendChild(trainBtn);

  // Recipe Engine button
  const recipeBtn = document.createElement('button');
  recipeBtn.type = 'button';
  recipeBtn.textContent = '📋 Recipes';
  recipeBtn.title = 'Browse AI recipes';
  recipeBtn.setAttribute('aria-label', 'Open recipe engine');
  recipeBtn.className = 'btn-ghost-modern';
  recipeBtn.addEventListener('click', () => {
    openRecipeModal({
      onRunRecipe: (url) => {
      }
    }).catch((err) => console.error('[Recipe] open failed:', err));
  });
  formCard.appendChild(recipeBtn);

  // Monetization Hub button
  const monetizationBtn = document.createElement('button');
  monetizationBtn.type = 'button';
  monetizationBtn.textContent = '💼 Monetize';
  monetizationBtn.title = "Open Smart Video AI Monetization Hub";
  monetizationBtn.setAttribute('aria-label', 'Open Smart Video AI Monetization Hub');
  monetizationBtn.className = 'btn-ghost-modern';
  monetizationBtn.addEventListener('click', () => {
    openMonetizationHub().catch((err) => console.error('[Monetization] open failed:', err));
  });
  formCard.appendChild(monetizationBtn);

  // Prompt Gallery button
  const promptGalleryBtn = document.createElement('button');
  promptGalleryBtn.type = 'button';
  promptGalleryBtn.textContent = '📚 Prompts';
  promptGalleryBtn.title = 'Browse prompt gallery';
  promptGalleryBtn.setAttribute('aria-label', 'Open prompt gallery');
  promptGalleryBtn.className = 'btn-ghost-modern';
  promptGalleryBtn.addEventListener('click', () => {
    openPromptGallery({
      appTheme: 'training-studio',
      onSelect: (prompt) => {
        const ta = document.querySelector('textarea');
        if (ta) {
          ta.value = prompt;
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          ta.focus();
        }
      }
    }).catch((err) => console.error('[PromptGallery] open failed:', err));
  });
  formCard.appendChild(promptGalleryBtn);

  container.appendChild(formCard);

  // Instructions
  const inlineInstructions = createInlineInstructions('training');
  inlineInstructions.classList.add('max-w-md', 'mt-6');
  container.appendChild(inlineInstructions);

  // Result area
  const resultArea = document.createElement('div');
  resultArea.className = 'w-full max-w-md mt-6 hidden';
  resultArea.setAttribute('role', 'status');
  resultArea.setAttribute('aria-live', 'polite');
  container.appendChild(resultArea);

  // Helper functions

  function updateEpochsBtns() {
    const epochsRow = epochsGroup.querySelector('.flex.gap-2');
    Array.from(epochsRow.children).forEach((btn, i) => {
      const e = ['5', '10', '20', '30'][i];
      btn.className = e === epochs 
        ? 'px-4 py-2 rounded-lg text-xs font-bold btn-secondary-modern' 
        : 'px-4 py-2 rounded-lg text-xs font-bold bg-white/5 text-secondary hover:bg-white/10';
    });
  }

  function updateImageCount() {
    imageCount.textContent = uploadedImages.length > 0 ? `${uploadedImages.length} images selected` : '';
  }

  // Train button handler
  trainBtn.onclick = async () => {
    if (!(await requireEntitlement())) return;
    if (!loraName) {
      alert('Enter a LoRA name');
      return;
    }
    if (uploadedImages.length < 5) {
      alert('Upload at least 5 training images (10-20 recommended)');
      return;
    }
    const apiKey = apiKeyManager.getMuapiKey();
    if (!apiKey) { 
      AuthModal(() => trainBtn.click()); 
      return; 
    }

    trainBtn.disabled = true;
    trainBtn.innerHTML = '<span class="animate-spin inline-block mr-2">&#9711;</span> Training...';

    try {
      const params = { 
        model: selectedModel.id,
        name: loraName,
        images: uploadedImages,
        epochs: parseInt(epochs),
      };
      
      if (triggerWord) params.trigger_word = triggerWord;
      
      const result = await muapi.trainLora(params);
      if (result?.lora_url) {
        resultArea.classList.remove('hidden');
        resultArea.innerHTML = `
          <div class="bg-[#111]/80 border border-white/10 rounded-2xl p-4">
            <div class="text-green-400 font-bold mb-3">Training Complete!</div>
            <p class="text-white/60 text-sm mb-3">Your LoRA model has been trained successfully.</p>
            <a href="${result.lora_url}" download class="block w-full btn-secondary-modern py-2.5 rounded-xl font-bold text-sm text-center hover:shadow-glow transition-all">Download LoRA</a>
          </div>
        `;
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      trainBtn.disabled = false;
      trainBtn.textContent = 'Train LoRA';
    }
  };

  return container;
}
