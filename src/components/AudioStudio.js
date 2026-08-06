import { muapi } from '../lib/muapi.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { audioModels } from '../lib/models.js';
import { AuthModal } from './AuthModal.js';
import { createHeroSection, getCustomThumbnailFromCache, saveCustomThumbnailToCache, clearCustomThumbnailCache } from '../lib/thumbnails.js';
import { mountPersonalizeTrigger, replaceTokensInPrompt } from './personalize/personalizePopover.js';
import { createInlineInstructions } from './InlineInstructions.js';
import { StudioThumbnailModal, mountStudioThumbnailModal } from './modals/StudioThumbnailPanel.jsx';
import { requireEntitlement } from '../lib/clerkEntitlements.js';
import { getModelLogoHtml, PROVIDER_LOGOS, invertLogos, getProviderStyle, getAvailableProviders, filterModels, renderProviderSidebar, renderSearchBar, renderModelList } from '../lib/modelSelectorUI.js';

export function AudioStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col items-center bg-app-bg overflow-y-auto p-6 md:p-10 relative';
  mountStudioChrome(container, { currentRoute: 'audio' });

  let selectedModel = audioModels[0];
  let prompt = '';
  let style = '';
  let duration = '30';
  let selectedVoice = 'female-1';
  let customThumbnailUrl = getCustomThumbnailFromCache('audio-studio');

  // Header with hero banner
  const header = document.createElement('div');
  header.className = 'mb-8 animate-fade-in-up text-center w-full';
  const audioBanner = createHeroSection('audio', 'h-32 md:h-44 mb-4');
  if (audioBanner) {
    const bannerText = document.createElement('div');
    bannerText.className = 'absolute bottom-0 left-0 right-0 p-5 z-10';
    bannerText.innerHTML = '<h1 class="text-2xl md:text-4xl font-black text-white tracking-tight mb-2">Audio Studio</h1><p class="text-white/60 text-sm">Generate music and speech with AI</p>';
    audioBanner.appendChild(bannerText);
    header.appendChild(audioBanner);
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
      const availableProviders = getAvailableProviders(audioModels);
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
        const filtered = filterModels(audioModels, searchInput ? searchInput.value : '', selectedProvider);
        const showProviderName = selectedProvider === 'all';
        modelListEl.innerHTML = renderModelList(filtered, selectedModel.id, showProviderName, (m) => {
          selectedModel = audioModels.find(x => x.id === m.id) || m;
          updateTrigger();
          updateFormVisibility();
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
  formCard.className = 'w-full bg-[#111]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col gap-5 animate-fade-in-up';
  formCard.style.animationDelay = '0.2s';

  // Prompt input (for music generation)
  const promptGroup = document.createElement('div');
  promptGroup.className = 'flex flex-col gap-2';
  const promptLabel = document.createElement('label');
  promptLabel.className = 'text-sm font-bold text-secondary';
  promptLabel.textContent = 'Prompt';
  promptGroup.appendChild(promptLabel);
  const promptInput = document.createElement('textarea');
  promptInput.className = 'w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white placeholder-white/30 focus:border-primary focus:outline-none resize-none';
  promptInput.rows = 3;
  promptInput.placeholder = 'Describe the music you want to generate...';
  promptInput.setAttribute('aria-label', 'Audio prompt');
  promptInput.oninput = (e) => { prompt = e.target.value; };
  promptGroup.appendChild(promptInput);
    // GTM Boost entry point — opens the prompt enhancer themed for audio
    // generation and loads the result straight into this prompt.
    const gtmBtn = document.createElement('button');
    gtmBtn.type = 'button';
    gtmBtn.textContent = '🎯 GTM Boost';
    gtmBtn.title = 'Enhance your prompt with GTM conversion frameworks';
    gtmBtn.setAttribute('aria-label', 'GTM Boost prompt enhancer');
    gtmBtn.className = 'gtm-boost-btn shrink-0';
    gtmBtn.addEventListener('click', () => {
      import('../lib/uiIntegration.js').then(({ openGTMPromptModal }) => {
        openGTMPromptModal('audio-studio', (prompt) => {
          promptInput.value = prompt;
          promptInput.dispatchEvent(new Event('input', { bubbles: true }));
          promptInput.focus();
        });
      }).catch((err) => console.error('[AudioStudio] GTM Boost failed:', err));
    });
    promptGroup.appendChild(gtmBtn);
  mountPersonalizeTrigger({ controlsContainer: formCard, getTextarea: () => promptInput, appId: 'audio-studio' });
  formCard.appendChild(promptGroup);

  // Style selector (for music models)
  const styleGroup = document.createElement('div');
  styleGroup.className = 'flex flex-col gap-2 hidden';
  const styleLabel = document.createElement('label');
  styleLabel.className = 'text-sm font-bold text-secondary';
  styleLabel.textContent = 'Style';
  styleGroup.appendChild(styleLabel);
  const styleSelect = document.createElement('select');
  styleSelect.className = 'w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:border-primary focus:outline-none';
  styleSelect.innerHTML = `
    <option value="">Select a style</option>
    <option value="pop">Pop</option>
    <option value="rock">Rock</option>
    <option value="electronic">Electronic</option>
    <option value="classical">Classical</option>
    <option value="jazz">Jazz</option>
    <option value="hip-hop">Hip Hop</option>
    <option value="ambient">Ambient</option>
  `;
  styleSelect.onchange = (e) => { style = e.target.value; };
  styleGroup.appendChild(styleSelect);
  formCard.appendChild(styleGroup);

  // Duration selector
  const durationGroup = document.createElement('div');
  durationGroup.className = 'flex flex-col gap-2';
  const durationLabel = document.createElement('label');
  durationLabel.className = 'text-sm font-bold text-secondary';
  durationLabel.textContent = 'Duration';
  durationGroup.appendChild(durationLabel);
  const durationRow = document.createElement('div');
  durationRow.className = 'flex gap-2';
  ['15', '30', '60', '120'].forEach(d => {
    const btn = document.createElement('button');
    btn.className = d === duration 
      ? 'px-4 py-2 rounded-lg text-xs font-bold bg-primary text-black' 
      : 'px-4 py-2 rounded-lg text-xs font-bold bg-white/5 text-secondary hover:bg-white/10';
    btn.textContent = `${d}s`;
    btn.onclick = () => {
      duration = d;
      updateDurationBtns();
    };
    durationRow.appendChild(btn);
  });
  durationGroup.appendChild(durationRow);
  formCard.appendChild(durationGroup);

  // Voice selector (for TTS models)
  const voiceGroup = document.createElement('div');
  voiceGroup.className = 'flex flex-col gap-2 hidden';
  const voiceLabel = document.createElement('label');
  voiceLabel.className = 'text-sm font-bold text-secondary';
  voiceLabel.textContent = 'Voice';
  voiceGroup.appendChild(voiceLabel);
  const voiceSelect = document.createElement('select');
  voiceSelect.className = 'w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:border-primary focus:outline-none';
  voiceSelect.innerHTML = `
    <option value="female-1">Female 1</option>
    <option value="male-qn-qingse">Male Qingse</option>
  `;
  voiceSelect.onchange = (e) => { selectedVoice = e.target.value; };
  voiceGroup.appendChild(voiceSelect);
  formCard.appendChild(voiceGroup);

  // Generate button
  const genBtn = document.createElement('button');
  genBtn.type = 'button';
  genBtn.className = 'w-full bg-primary text-black py-3.5 rounded-xl font-black text-sm hover:shadow-glow transition-all';
  genBtn.textContent = 'Generate Audio';
  genBtn.setAttribute('aria-label', 'Generate audio');

  // Thumbnail studio button — next to creation controls, GTM Boost styling
  const thumbBtn = document.createElement('button');
  thumbBtn.type = 'button';
  thumbBtn.textContent = '🖼 Thumbnail';
  thumbBtn.title = 'Generate a custom thumbnail';
  thumbBtn.className = 'gtm-boost-btn w-full';
  thumbBtn.addEventListener('click', () => {
    const modal = new StudioThumbnailModal({
      appTheme: 'audio-studio',
      studioId: 'audio-studio',
      studioName: 'Audio Studio',
      aspectRatio: '16:9',
      outputType: 'image',
      onApply: ({ imageUrl }) => {
        customThumbnailUrl = imageUrl;
        saveCustomThumbnailToCache('audio-studio', imageUrl);
      },
      onClear: () => {
        customThumbnailUrl = null;
        clearCustomThumbnailCache('audio-studio');
      },
    });
    mountStudioThumbnailModal(modal);
    modal.open();
  });
  formCard.appendChild(thumbBtn);
  formCard.appendChild(genBtn);
  container.appendChild(formCard);

  // Instructions
  const inlineInstructions = createInlineInstructions('audio');
  inlineInstructions.classList.add('max-w-md', 'mt-6');
  container.appendChild(inlineInstructions);

  // Result area
  const resultArea = document.createElement('div');
  resultArea.className = 'w-full max-w-md mt-6 hidden';
  resultArea.setAttribute('role', 'status');
  resultArea.setAttribute('aria-live', 'polite');
  container.appendChild(resultArea);

  // Helper functions
  function updateModelBtns() {
    Object.entries(modelBtns).forEach(([id, btn]) => {
      if (id === selectedModel.id) {
        btn.className = 'px-5 py-3 rounded-xl text-sm font-bold transition-all border bg-primary text-black border-primary';
      } else {
        btn.className = 'px-5 py-3 rounded-xl text-sm font-bold transition-all border bg-white/5 text-secondary border-white/10 hover:bg-white/10';
      }
    });
  }

  function updateDurationBtns() {
    const durationRow = durationGroup.querySelector('.flex.gap-2');
    Array.from(durationRow.children).forEach((btn, i) => {
      const d = ['15', '30', '60', '120'][i];
      btn.className = d === duration 
        ? 'px-4 py-2 rounded-lg text-xs font-bold bg-primary text-black' 
        : 'px-4 py-2 rounded-lg text-xs font-bold bg-white/5 text-secondary hover:bg-white/10';
    });
  }

  function updateFormVisibility() {
    // Show/hide prompt based on model
    const supportsPrompt = selectedModel.hasPrompt;
    promptGroup.classList.toggle('hidden', !supportsPrompt);
    
    // Show/hide style selector for music models
    const supportsStyles = selectedModel.supportsStyles;
    styleGroup.classList.toggle('hidden', !supportsStyles);

    // Show/hide voice selector for TTS models
    const supportsVoice = selectedModel.type === 'tts';
    voiceGroup.classList.toggle('hidden', !supportsVoice);
  }

  // Generate button handler
  genBtn.onclick = async () => {
    if (!(await requireEntitlement())) return;
    if (selectedModel.hasPrompt) {
      const activeProfile = (() => { try { return JSON.parse(localStorage.getItem('remix_contact_profiles') || '[]').find((p) => p.id === localStorage.getItem('remix_selected_contact_id')) || null; } catch { return null; } })();
      prompt = replaceTokensInPrompt(prompt, activeProfile);
      if (!prompt) { alert('Enter a prompt'); return; }
    }
    const apiKey = apiKeyManager.getMuapiKey();
    if (!apiKey) { 
      AuthModal(() => genBtn.click()); 
      return; 
    }

    genBtn.disabled = true;
    genBtn.innerHTML = '<span class="animate-spin inline-block mr-2">&#9711;</span> Generating...';

    try {
      let result;
      if (selectedModel.type === 'music') {
        result = await muapi.generateMusic({
          model: selectedModel.id,
          prompt: prompt,
          style: style || undefined,
          duration: parseInt(duration)
        });
      } else if (selectedModel.type === 'tts') {
        result = await muapi.generateAudio({
          model: selectedModel.id,
          text: prompt,
          speed: parseInt(duration),
          voice: selectedVoice
        });
      } else {
        const params = {
          model: selectedModel.id,
          prompt: prompt,
          duration: parseInt(duration)
        };
        if (style) params.style = style;
        result = await muapi.generateAudio(params);
      }
      if (result?.url) {
        resultArea.classList.remove('hidden');
        resultArea.innerHTML = `
          <div class="bg-[#111]/80 border border-white/10 rounded-2xl p-4">
            <audio controls class="w-full mb-3">
              <source src="${result.url}" type="audio/mpeg">
              Your browser does not support the audio element.
            </audio>
            <a href="${result.url}" download class="block w-full bg-primary text-black py-2.5 rounded-xl font-bold text-sm text-center hover:shadow-glow transition-all">Download Audio</a>
          </div>
        `;
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      genBtn.disabled = false;
      genBtn.textContent = 'Generate Audio';
    }
  };

  updateModelBtns();
  updateFormVisibility();
  return container;
}
