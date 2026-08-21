import { muapi } from '../lib/muapi.js';
import { openSocialPublish } from '../lib/socialPublishHelpers.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { videoToolsModels } from '../lib/models.js';
import { AuthModal } from './AuthModal.js';
import { createUploadPicker } from './UploadPicker.js';
import { createHeroSection, getCustomThumbnailFromCache, saveCustomThumbnailToCache, clearCustomThumbnailCache } from '../lib/thumbnails.js';
import { createInlineInstructions } from './InlineInstructions.js';
import { mountPersonalizeTrigger, replaceTokensInPrompt } from './personalize/personalizePopover.js';
import { TemplateThumbnailModal, mountThumbnailModal } from './modals/TemplateThumbnailModal.jsx';
import { requireEntitlement } from '../lib/clerkEntitlements.js';
import { mountModelSelector, getModelLogoHtml, PROVIDER_LOGOS, invertLogos, getProviderStyle } from '../lib/modelSelectorUI.js';
import { createAdvancedControls } from '../lib/studioControls.js';
import { getExtendedModel } from '../lib/modelInputExtensions.js';
import { getModelById } from '../lib/models.js';

export function VideoToolsStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col items-center bg-app-bg overflow-y-auto p-6 md:p-10 relative';
  mountStudioChrome(container, { currentRoute: 'videotools' });

  let selectedModel = videoToolsModels[0];
  let nativeAudio = false;
  let uploadedVideoUrl = null;
  let lastOutputUrl = null;
  let prompt = '';
  let customThumbnailUrl = getCustomThumbnailFromCache('videotools-studio');
  let dynamicControls = null;
  let dynamicControlsContainer = null;

  // Header with hero banner
  const header = document.createElement('div');
  header.className = 'mb-8 animate-fade-in-up text-center w-full';
  const videoToolsBanner = createHeroSection('videotools', 'h-32 md:h-44 mb-4');
  if (videoToolsBanner) {
    const bannerText = document.createElement('div');
    bannerText.className = 'absolute bottom-0 left-0 right-0 p-5 z-10';
    bannerText.innerHTML = '<h1 class="text-2xl md:text-4xl font-black text-white tracking-tight mb-2">Video Tools Studio</h1><p class="text-white/60 text-sm">Enhance, edit, and transform your videos with AI</p>';
    videoToolsBanner.appendChild(bannerText);
    header.appendChild(videoToolsBanner);
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
      mountModelSelector(dropdown, {
        models: videoToolsModels,
        selectedModelId: selectedModel.id,
        showProviderName: true,
        onSelectModel: (modelId) => {
          selectedModel = videoToolsModels.find(x => x.id === modelId) || { id: modelId };
          updateTrigger();
          updateFormVisibility();
          buildDynamicControls();
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

  // Video upload
  const videoUploadGroup = document.createElement('div');
  videoUploadGroup.className = 'flex flex-col gap-2';
  const videoLabel = document.createElement('label');
  videoLabel.className = 'text-sm font-bold text-secondary';
  videoLabel.textContent = 'Source Video';
  videoUploadGroup.appendChild(videoLabel);

  const videoPicker = createUploadPicker({
    anchorContainer: container,
    acceptVideo: true,
    onSelect: ({ url }) => { 
      uploadedVideoUrl = url; 
    },
    onClear: () => { uploadedVideoUrl = null; },
  });
  videoUploadGroup.appendChild(videoPicker.trigger);

  const pexelsVideoBtn = document.createElement('button');
  pexelsVideoBtn.type = 'button';
  pexelsVideoBtn.className = 'w-10 h-10 shrink-0 rounded-xl border transition-all flex items-center justify-center bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40 group relative overflow-hidden';
  pexelsVideoBtn.title = 'Browse stock videos from Pexels';
  pexelsVideoBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-secondary group-hover:text-primary"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>';
  pexelsVideoBtn.onclick = async () => {
    const { browsePexelsVideos } = await import('../lib/studioPexels.js');
    browsePexelsVideos({
      title: 'Select Source Video',
      studioName: 'Video Tools Studio',
      onSelect: (asset) => {
        uploadedVideoUrl = asset.video_files?.[0]?.link || asset.url || asset.original;
        const attrContainer = document.getElementById('pexels-tools-attribution');
        if (attrContainer) {
          attrContainer.innerHTML = '';
          import('../lib/attributionChip.js').then(mod => mod.renderAttributionChip(asset, attrContainer));
        }
      }
    });
  };
  videoUploadGroup.appendChild(pexelsVideoBtn);

  formCard.appendChild(videoUploadGroup);

  const pexelsToolsAttr = document.createElement('div');
  pexelsToolsAttr.id = 'pexels-tools-attribution';
  pexelsToolsAttr.className = 'mt-1';
  formCard.appendChild(pexelsToolsAttr);

  container.appendChild(videoPicker.panel);

  // Prompt input (for models that support it)
  const promptGroup = document.createElement('div');
  promptGroup.className = 'flex flex-col gap-2 hidden';
  const promptLabel = document.createElement('label');
  promptLabel.className = 'text-sm font-bold text-secondary';
  promptLabel.textContent = 'Prompt (optional)';
  promptGroup.appendChild(promptLabel);
  const promptInput = document.createElement('textarea');
  promptInput.className = 'w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white placeholder-white/30 focus:border-primary focus:outline-none resize-none';
  promptInput.rows = 3;
  promptInput.placeholder = 'Describe the transformation you want...';
  promptInput.setAttribute('aria-label', 'Video processing prompt');
  promptInput.oninput = (e) => { prompt = e.target.value; };
   promptGroup.appendChild(promptInput);
    // GTM Boost entry point — opens the prompt enhancer themed for video tools
    // and loads the result straight into this prompt.
    const gtmBtn = document.createElement('button');
    gtmBtn.type = 'button';
    gtmBtn.textContent = '🎯 GTM Boost';
    gtmBtn.title = 'Enhance your prompt with GTM conversion frameworks';
    gtmBtn.setAttribute('aria-label', 'GTM Boost prompt enhancer');
    gtmBtn.className = 'gtm-boost-btn shrink-0';
    gtmBtn.addEventListener('click', () => {
      import('../lib/uiIntegration.js').then(({ openGTMPromptModal }) => {
        openGTMPromptModal('video-tools-studio', (prompt) => {
          promptInput.value = prompt;
          promptInput.dispatchEvent(new Event('input', { bubbles: true }));
          promptInput.focus();
        });
      }).catch((err) => console.error('[VideoToolsStudio] GTM Boost failed:', err));
    });
    promptGroup.appendChild(gtmBtn);
   formCard.appendChild(promptGroup);
  mountPersonalizeTrigger({ controlsContainer: formCard, getTextarea: () => promptInput, appId: 'video-tools' });

  // Dynamic model-specific advanced controls
  dynamicControlsContainer = document.createElement('div');
  dynamicControlsContainer.className = 'flex flex-col gap-3';
  formCard.appendChild(dynamicControlsContainer);

  function buildDynamicControls() {
    if (!dynamicControlsContainer) return;
    if (dynamicControls) dynamicControls.destroy();
    const model = getExtendedModel(selectedModel);
    if (!model || !model.inputs || Object.keys(model.inputs).length === 0) {
      dynamicControlsContainer.classList.add('hidden');
      return;
    }
    dynamicControlsContainer.classList.remove('hidden');
    dynamicControls = createAdvancedControls({
      model,
      container: dynamicControlsContainer,
      exclude: new Set(['video_url', 'prompt']),
    });
  }
  buildDynamicControls();

  // Thumbnail studio button — next to creation controls, GTM Boost styling
  const thumbBtn = document.createElement('button');
  thumbBtn.type = 'button';
  thumbBtn.textContent = '🖼 Thumbnail';
  thumbBtn.title = 'Generate a custom thumbnail';
  thumbBtn.className = 'gtm-boost-btn w-full';
  thumbBtn.addEventListener('click', () => {
    const modal = new TemplateThumbnailModal({
      appTheme: 'video-tools-studio',
      layout: 'panel',
      studioId: 'videotools-studio',
      studioName: 'Video Tools Studio',
      aspectRatio: '16:9',
      outputType: 'video',
      onApply: ({ imageUrl }) => {
        customThumbnailUrl = imageUrl;
        saveCustomThumbnailToCache('videotools-studio', imageUrl);
      },
      onClear: () => {
        customThumbnailUrl = null;
        clearCustomThumbnailCache('videotools-studio');
      },
    });
    mountThumbnailModal(modal);
    modal.open();
  });
  formCard.appendChild(thumbBtn);

  // Generate button
  const genBtn = document.createElement('button');
  genBtn.type = 'button';
  genBtn.className = 'w-full bg-primary text-black py-3.5 rounded-xl font-black text-sm hover:shadow-glow transition-all';
  genBtn.textContent = 'Process Video';
  genBtn.setAttribute('aria-label', 'Process video');
  formCard.appendChild(genBtn);
  container.appendChild(formCard);
    // Native audio toggle
    const vtNativeAudioBtn = nativeAudioRow.querySelector('#vt-native-audio-btn');
    const vtNativeAudioKnob = nativeAudioRow.querySelector('#vt-native-audio-knob');
    if (vtNativeAudioBtn && vtNativeAudioKnob) {
      vtNativeAudioBtn.onclick = () => {
        nativeAudio = !nativeAudio;
        vtNativeAudioBtn.setAttribute('data-native-audio', String(nativeAudio));
        vtNativeAudioBtn.style.background = nativeAudio ? 'var(--cyan)' : '';
        vtNativeAudioBtn.style.borderColor = nativeAudio ? 'var(--cyan)' : '';
        vtNativeAudioKnob.style.left = nativeAudio ? 'calc(100% - 22px)' : '4px';
      };
    }

  // Instructions
  const inlineInstructions = createInlineInstructions('videotools');
  inlineInstructions.classList.add('max-w-md', 'mt-6');
  container.appendChild(inlineInstructions);

  // Result area
  const resultArea = document.createElement('div');
  resultArea.className = 'w-full max-w-md mt-6 hidden';
  resultArea.setAttribute('role', 'status');
  resultArea.setAttribute('aria-live', 'polite');
  container.appendChild(resultArea);

  // Helper functions


    // Prompt Gallery button
    const promptGalleryBtn = document.createElement('button');
    promptGalleryBtn.type = 'button';
    promptGalleryBtn.textContent = '📚 Prompts';
    promptGalleryBtn.title = 'Browse prompt gallery';
    promptGalleryBtn.setAttribute('aria-label', 'Open prompt gallery');
    promptGalleryBtn.className = 'gtm-boost-btn shrink-0';
    promptGalleryBtn.addEventListener('click', () => {
      openPromptGallery({
        appTheme: 'video-tools',
        onSelect: (prompt) => {
          // Default: try to find a textarea in the studio
          const ta = document.querySelector('textarea') || document.querySelector('[data-prompt]');
          if (ta) {
            ta.value = prompt;
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            ta.focus();
          }
        }
      }).catch((err) => console.error('[PromptGallery] open failed:', err));
    });

    // Recipe Engine button
    const recipeBtn = document.createElement('button');
    recipeBtn.type = 'button';
    recipeBtn.textContent = '📋 Recipes';
    recipeBtn.title = 'Browse AI recipes';
    recipeBtn.setAttribute('aria-label', 'Open recipe engine');
    recipeBtn.className = 'gtm-boost-btn shrink-0';
    recipeBtn.addEventListener('click', () => {
      openRecipeModal({
        onRunRecipe: (url) => {
        }
      }).catch((err) => console.error('[Recipe] open failed:', err));
    });


    // Monetization Hub button
    const monetizationBtn = document.createElement('button');
    monetizationBtn.type = 'button';
    monetizationBtn.textContent = "💼 Smart Video AI Monetize";
    monetizationBtn.title = "Open Smart Video AI Monetization Hub";
    monetizationBtn.setAttribute('aria-label', 'Open Smart Video AI Monetization Hub');
    monetizationBtn.className = 'gtm-boost-btn shrink-0';
    monetizationBtn.addEventListener('click', () => {
      openMonetizationHub().catch((err) => console.error('[Monetization] open failed:', err));
    });
    promptGroup.appendChild(recipeBtn);
    promptGroup.appendChild(monetizationBtn);

  function updateFormVisibility() {
    // Show/hide prompt based on model
    const supportsPrompt = selectedModel.hasPrompt;
    promptGroup.classList.toggle('hidden', !supportsPrompt);

    // Show/hide native audio toggle based on model
    const supportsNativeAudio = selectedModel.inputs?.native_audio;
    nativeAudioRow.classList.toggle('hidden', !supportsNativeAudio);
    if (!supportsNativeAudio) nativeAudio = false;
  }

  // Generate button handler
  genBtn.onclick = async () => {
    if (!(await requireEntitlement())) return;
    if (!uploadedVideoUrl && selectedModel.videoField) {
      alert('Upload a source video first');
      return;
    }
    const apiKey = apiKeyManager.getMuapiKey();
    if (!apiKey) { 
      AuthModal(() => genBtn.click()); 
      return; 
    }

    genBtn.disabled = true;
    genBtn.innerHTML = '<span class="animate-spin inline-block mr-2">&#9711;</span> Processing...';

    try {
      const params = { 
        model: selectedModel.id,
        [selectedModel.videoField]: uploadedVideoUrl,
        customThumbnailUrl: customThumbnailUrl || undefined,
      };

      const activeProfile = (() => { try { return JSON.parse(localStorage.getItem('remix_contact_profiles') || '[]').find((p) => p.id === localStorage.getItem('remix_selected_contact_id')) || null; } catch { return null; } })();
      if (prompt && selectedModel.hasPrompt) {
        params.prompt = replaceTokensInPrompt(prompt, activeProfile);
      }
      if (dynamicControls) {
        Object.assign(params, dynamicControls.getPayload({}));
      }

       const result = await muapi.processVideoTool(params);
       if (result?.url) {
         lastOutputUrl = result.url;
         resultArea.classList.remove('hidden');
         resultArea.innerHTML = `
           <div class="bg-[#111]/80 border border-white/10 rounded-2xl p-4">
             <video controls class="w-full rounded-xl mb-3" src="${result.url}"></video>
             <a href="${result.url}" download class="block w-full bg-primary text-black py-2.5 rounded-xl font-bold text-sm text-center hover:shadow-glow transition-all">Download Video</a>
             <button type="button" class="publish-social-btn block w-full mt-2 bg-gradient-to-r from-[#6d5efc] to-[#a855f7] text-white py-2.5 rounded-xl font-bold text-sm text-center hover:shadow-glow transition-all">Publish to Social</button>
           </div>
         `;
         const publishBtn = resultArea.querySelector('.publish-social-btn');
         if (publishBtn) publishBtn.onclick = () => openSocialPublish({ mediaUrl: lastOutputUrl, mediaType: 'video' });
       }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      genBtn.disabled = false;
      genBtn.textContent = 'Process Video';
    }
  };

  updateFormVisibility();
  return container;
}