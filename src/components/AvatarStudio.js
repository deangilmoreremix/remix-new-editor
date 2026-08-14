import { muapi } from '../lib/muapi.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { avatarModels } from '../lib/models.js';
import { AuthModal } from './AuthModal.js';
import { createUploadPicker } from './UploadPicker.js';
import { processFileUpload } from '../lib/editor/uploadPipeline.js';
import { showToast } from '../lib/loading.js';
import { createHeroSection, getCustomThumbnailFromCache, saveCustomThumbnailToCache, clearCustomThumbnailCache } from '../lib/thumbnails.js';
import { mountPersonalizeTrigger, replaceTokensInPrompt } from './personalize/personalizePopover.js';
import { createInlineInstructions } from './InlineInstructions.js';
import { StudioThumbnailModal, mountStudioThumbnailModal } from './modals/StudioThumbnailPanel.jsx';
import { requireEntitlement } from '../lib/clerkEntitlements.js';
import { getModelLogoHtml, PROVIDER_LOGOS, invertLogos, getProviderStyle, getAvailableProviders, filterModels, renderProviderSidebar, renderSearchBar, renderModelList } from '../lib/modelSelectorUI.js';

export function AvatarStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col items-center bg-app-bg overflow-y-auto p-6 md:p-10 relative';
  mountStudioChrome(container, { currentRoute: 'avatar' });

  let selectedModel = avatarModels[0];
  let uploadedVideoUrl = null;
  let uploadedAudioUrl = null;
  let prompt = '';
  let customThumbnailUrl = getCustomThumbnailFromCache('avatar-studio');

  // Header with hero banner
  const header = document.createElement('div');
  header.className = 'mb-8 animate-fade-in-up text-center w-full max-w-xl';
  const avatarBanner = createHeroSection('avatar', 'h-32 md:h-44 mb-4');
  if (avatarBanner) {
    const bannerText = document.createElement('div');
    bannerText.className = 'absolute bottom-0 left-0 right-0 p-5 z-10';
    bannerText.innerHTML = '<h1 class="text-2xl md:text-4xl font-black text-white tracking-tight mb-2">Avatar Studio</h1><p class="text-white/60 text-sm">Create talking avatars and lip sync videos</p>';
    avatarBanner.appendChild(bannerText);
    header.appendChild(avatarBanner);
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
      const availableProviders = getAvailableProviders(avatarModels);
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
        const filtered = filterModels(avatarModels, searchInput ? searchInput.value : '', selectedProvider);
        const showProviderName = selectedProvider === 'all';
        modelListEl.innerHTML = renderModelList(filtered, selectedModel.id, showProviderName, (m) => {
          selectedModel = avatarModels.find(x => x.id === m.id) || m;
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
  formCard.className = 'w-full max-w-md bg-[#111]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col gap-5 animate-fade-in-up';
  formCard.style.animationDelay = '0.2s';

  // Video/Image upload (for lip sync models)
  const videoUploadGroup = document.createElement('div');
  videoUploadGroup.className = 'flex flex-col gap-2';
  const videoLabel = document.createElement('label');
  videoLabel.className = 'text-sm font-bold text-secondary';
  videoLabel.textContent = 'Source Video/Image';
  videoUploadGroup.appendChild(videoLabel);

  const videoPicker = createUploadPicker({
    anchorContainer: container,
    acceptVideo: true,
    onSelect: ({ url, type }) => { 
      uploadedVideoUrl = url; 
    },
    onClear: () => { uploadedVideoUrl = null; },
  });
  videoUploadGroup.appendChild(videoPicker.trigger);
  formCard.appendChild(videoUploadGroup);
  container.appendChild(videoPicker.panel);

  // Audio upload (for lip sync models)
  const audioUploadGroup = document.createElement('div');
  audioUploadGroup.className = 'flex flex-col gap-2 hidden';
  const audioLabel = document.createElement('label');
  audioLabel.className = 'text-sm font-bold text-secondary';
  audioLabel.textContent = 'Audio (for lip sync)';
  audioUploadGroup.appendChild(audioLabel);

  const audioTrigger = document.createElement('button');
  audioTrigger.type = 'button';
  audioTrigger.title = 'Upload audio';
  audioTrigger.className = 'w-10 h-10 shrink-0 rounded-xl border transition-all flex items-center justify-center relative overflow-hidden mt-1.5 bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40 group';
  const audioIconState = document.createElement('div');
  audioIconState.className = 'flex items-center justify-center w-full h-full';
  audioIconState.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-muted group-hover:text-primary transition-colors"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;
  audioTrigger.appendChild(audioIconState);

  const audioInput = document.createElement('input');
  audioInput.type = 'file';
  audioInput.accept = 'audio/*';
  audioInput.className = 'hidden';
  audioTrigger.appendChild(audioInput);

  audioTrigger.onclick = (e) => {
    e.stopPropagation();
    audioInput.click();
  };

  audioInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const apiKey = apiKeyManager.getMuapiKey();
    if (!apiKey) {
      AuthModal(() => audioInput.click());
      return;
    }

    try {
      const minState = {
        tracks: [],
        assets: [],
        mediaLibrary: [],
        undoStack: [],
        redoStack: [],
        selectedClipId: null
      };
      const result = await processFileUpload(file, { state: minState, showToast });
      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }
      uploadedAudioUrl = result.asset.url;
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      audioInput.value = '';
    }
  };

  audioUploadGroup.appendChild(audioTrigger);
  formCard.appendChild(audioUploadGroup);

  // Prompt input (for some avatar models)
  const promptGroup = document.createElement('div');
  promptGroup.className = 'flex flex-col gap-2 hidden';
  const promptLabel = document.createElement('label');
  promptLabel.className = 'text-sm font-bold text-secondary';
  promptLabel.textContent = 'Prompt (optional)';
  promptGroup.appendChild(promptLabel);
  const promptInput = document.createElement('textarea');
  promptInput.className = 'w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white placeholder-white/30 focus:border-primary focus:outline-none resize-none';
  promptInput.rows = 2;
  promptInput.placeholder = 'Describe the animation you want...';
  promptInput.setAttribute('aria-label', 'Avatar prompt');
  promptInput.oninput = (e) => { prompt = e.target.value; };
  promptGroup.appendChild(promptInput);
    // GTM Boost entry point — opens the prompt enhancer themed for avatar
    // animation and loads the result straight into this prompt.
    const gtmBtn = document.createElement('button');
    gtmBtn.type = 'button';
    gtmBtn.textContent = '🎯 GTM Boost';
    gtmBtn.title = 'Enhance your prompt with GTM conversion frameworks';
    gtmBtn.setAttribute('aria-label', 'GTM Boost prompt enhancer');
    gtmBtn.className = 'gtm-boost-btn shrink-0';
    gtmBtn.addEventListener('click', () => {
      import('../lib/uiIntegration.js').then(({ openGTMPromptModal }) => {
        openGTMPromptModal('avatar-studio', (prompt) => {
          promptInput.value = prompt;
          promptInput.dispatchEvent(new Event('input', { bubbles: true }));
          promptInput.focus();
        });
      }).catch((err) => console.error('[AvatarStudio] GTM Boost failed:', err));
    });
    promptGroup.appendChild(gtmBtn);
  formCard.appendChild(promptGroup);
  mountPersonalizeTrigger({ controlsContainer: formCard, getTextarea: () => promptInput, appId: 'avatar-studio' });

  // Generate button
  const genBtn = document.createElement('button');
  genBtn.type = 'button';
  genBtn.className = 'w-full bg-primary text-black py-3.5 rounded-xl font-black text-sm hover:shadow-glow transition-all';
  genBtn.textContent = 'Generate Avatar Video';
  genBtn.setAttribute('aria-label', 'Generate avatar video');

  // Thumbnail studio button — next to creation controls, GTM Boost styling
  const thumbBtn = document.createElement('button');
  thumbBtn.type = 'button';
  thumbBtn.textContent = '🖼 Thumbnail';
  thumbBtn.title = 'Generate a custom thumbnail';
  thumbBtn.className = 'gtm-boost-btn w-full';
  thumbBtn.addEventListener('click', () => {
    const modal = new StudioThumbnailModal({
      appTheme: 'avatar-studio',
      studioId: 'avatar-studio',
      studioName: 'Avatar Studio',
      aspectRatio: '16:9',
      outputType: 'video',
      onApply: ({ imageUrl }) => {
        customThumbnailUrl = imageUrl;
        saveCustomThumbnailToCache('avatar-studio', imageUrl);
      },
      onClear: () => {
        customThumbnailUrl = null;
        clearCustomThumbnailCache('avatar-studio');
      },
    });
    mountStudioThumbnailModal(modal);
    modal.open();
  });
  formCard.appendChild(thumbBtn);
  formCard.appendChild(genBtn);
  container.appendChild(formCard);

  // Instructions
  const inlineInstructions = createInlineInstructions('avatar');
  inlineInstructions.classList.add('max-w-md', 'mt-6');
  container.appendChild(inlineInstructions);

  // Result area
  const resultArea = document.createElement('div');
  resultArea.className = 'w-full max-w-md mt-6 hidden';
  resultArea.setAttribute('role', 'status');
  resultArea.setAttribute('aria-live', 'polite');
  container.appendChild(resultArea);

  // Helper functions

  function updateFormVisibility() {
    // Show/hide video upload
    const needsVideo = selectedModel.hasVideo;
    videoUploadGroup.classList.toggle('hidden', !needsVideo);

    // Show/hide audio upload
    const needsAudio = selectedModel.hasAudio;
    audioUploadGroup.classList.toggle('hidden', !needsAudio);

    // Show/hide prompt
    const needsPrompt = selectedModel.hasPrompt;
    promptGroup.classList.toggle('hidden', !needsPrompt);
  }

  // Generate button handler
  genBtn.onclick = async () => {
    if (!(await requireEntitlement())) return;
    if (!uploadedVideoUrl && selectedModel.hasVideo) {
      alert('Upload a source video or image first');
      return;
    }
    if (selectedModel.hasPrompt && (!prompt || !prompt.trim())) {
      alert('Please enter a prompt for this avatar model.');
      return;
    }
    const apiKey = apiKeyManager.getMuapiKey();
    if (!apiKey) { 
      AuthModal(() => genBtn.click()); 
      return; 
    }

    genBtn.disabled = true;
    genBtn.innerHTML = '<span class="animate-spin inline-block mr-2">&#9711;</span> Generating...';

    try {
      const activeProfile = (() => { try { return JSON.parse(localStorage.getItem('remix_contact_profiles') || '[]').find((p) => p.id === localStorage.getItem('remix_selected_contact_id')) || null; } catch { return null; } })();
       const params = {
         model: selectedModel.id,
         video_url: uploadedVideoUrl,
         customThumbnailUrl: customThumbnailUrl || undefined,
       };

      if (uploadedAudioUrl) params.audio_url = uploadedAudioUrl;
      if (prompt) params.prompt = replaceTokensInPrompt(prompt, activeProfile);
      
      const result = await muapi.generateAvatar(params);
      if (result?.url) {
        resultArea.classList.remove('hidden');
        resultArea.innerHTML = `
          <div class="bg-[#111]/80 border border-white/10 rounded-2xl p-4">
            <video controls class="w-full rounded-xl mb-3" src="${result.url}"></video>
            <a href="${result.url}" download class="block w-full bg-primary text-black py-2.5 rounded-xl font-bold text-sm text-center hover:shadow-glow transition-all">Download Video</a>
          </div>
        `;
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      genBtn.disabled = false;
      genBtn.textContent = 'Generate Avatar Video';
    }
  };

  updateFormVisibility();
  return container;
}
