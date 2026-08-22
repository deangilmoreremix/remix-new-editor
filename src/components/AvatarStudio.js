import { muapi } from '../lib/muapi.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { avatarModels } from '../lib/models.js';
import { AuthModal } from './AuthModal.js';
import { createUploadPicker } from './UploadPicker.js';
import { uploadMediaFile } from '../lib/editor/upload.js';
import { createHeroSection, getCustomThumbnailFromCache, saveCustomThumbnailToCache, clearCustomThumbnailCache } from '../lib/thumbnails.js';
import { mountPersonalizeTrigger, replaceTokensInPrompt } from './personalize/personalizePopover.js';
import { createInlineInstructions } from './InlineInstructions.js';
import { TemplateThumbnailModal, mountThumbnailModal } from './modals/TemplateThumbnailModal.jsx';
import { requireEntitlement } from '../lib/clerkEntitlements.js';
import { openSocialPublish } from '../lib/socialPublishHelpers.js';
import { mountModelSelector, getModelLogoHtml, PROVIDER_LOGOS, invertLogos, getProviderStyle } from '../lib/modelSelectorUI.js';
import { createAdvancedControls } from '../lib/studioControls.js';
import { getExtendedModel } from '../lib/modelInputExtensions.js';
import { getModelById } from '../lib/models.js';
import { getAssetsForStudio } from '../data/exampleGalleryAssets.js';
import ExampleGallery from './studios/ExampleGallery.js';

export function AvatarStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col items-center bg-app-bg overflow-y-auto p-6 md:p-10 relative';
  mountStudioChrome(container, { currentRoute: 'avatar' });

  let selectedModel = avatarModels[0];
  let nativeAudio = false;
  let uploadedVideoUrl = null;
  let uploadedAudioUrl = null;
  let prompt = '';
  let customThumbnailUrl = getCustomThumbnailFromCache('avatar-studio');
  let dynamicControls = null;
  let dynamicControlsContainer = null;

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
      mountModelSelector(dropdown, {
        models: avatarModels,
        selectedModelId: selectedModel.id,
        showProviderName: true,
        onSelectModel: (modelId) => {
          selectedModel = avatarModels.find(x => x.id === modelId) || { id: modelId };
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
      uploadedAudioUrl = await uploadMediaFile(file);
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
      exclude: new Set(['video_url', 'audio_url', 'prompt']),
    });
  }
  buildDynamicControls();

  // Generate button
  const genBtn = document.createElement('button');
  genBtn.type = 'button';
  genBtn.className = 'btn-primary-modern w-full px-[14px] py-2 min-h-[40px] text-[13px] font-bold rounded-2xl inline-flex items-center justify-center gap-1.5 transition-all';
  genBtn.textContent = 'Generate Avatar Video';
  genBtn.setAttribute('aria-label', 'Generate avatar video');

  // Thumbnail studio button — next to creation controls, GTM Boost styling
  const thumbBtn = document.createElement('button');
  thumbBtn.type = 'button';
  thumbBtn.textContent = '🖼 Thumbnail';
  thumbBtn.title = 'Generate a custom thumbnail';
  thumbBtn.className = 'btn-ghost-modern w-full';
  thumbBtn.addEventListener('click', () => {
    const modal = new TemplateThumbnailModal({
      appTheme: 'avatar-studio',
      layout: 'panel',
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
    mountThumbnailModal(modal);
    modal.open();
  });
   formCard.appendChild(thumbBtn);
   formCard.appendChild(genBtn);

   // Native audio toggle
   const nativeAudioRow = document.createElement('div');
   nativeAudioRow.className = 'flex items-center justify-between px-2';
   nativeAudioRow.innerHTML = `
     <label class="text-xs font-bold text-secondary uppercase tracking-wider">Native Audio</label>
     <button id="avatar-native-audio-btn" class="relative h-7 w-12 rounded-full transition bg-white/10 border border-white/10" data-native-audio="false">
       <span class="absolute top-1 h-5 w-5 rounded-full bg-white transition left-1" id="avatar-native-audio-knob"></span>
     </button>
   `;
   const nativeAudioBtn = nativeAudioRow.querySelector('#avatar-native-audio-btn');
   const nativeAudioKnob = nativeAudioRow.querySelector('#avatar-native-audio-knob');
   if (nativeAudioBtn && nativeAudioKnob) {
     nativeAudioBtn.onclick = () => {
       nativeAudio = !nativeAudio;
       nativeAudioBtn.setAttribute('data-native-audio', String(nativeAudio));
       nativeAudioBtn.style.background = nativeAudio ? 'var(--cyan)' : '';
       nativeAudioBtn.style.borderColor = nativeAudio ? 'var(--cyan)' : '';
       nativeAudioKnob.style.left = nativeAudio ? 'calc(100% - 22px)' : '4px';
     };
   }
   formCard.appendChild(nativeAudioRow);
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


    // Prompt Gallery button
    const promptGalleryBtn = document.createElement('button');
    promptGalleryBtn.type = 'button';
    promptGalleryBtn.textContent = '📚 Prompts';
    promptGalleryBtn.title = 'Browse prompt gallery';
    promptGalleryBtn.setAttribute('aria-label', 'Open prompt gallery');
    promptGalleryBtn.className = 'btn-ghost-modern shrink-0';
    promptGalleryBtn.addEventListener('click', () => {
      openPromptGallery({
        appTheme: 'avatar-studio',
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
    recipeBtn.className = 'btn-ghost-modern shrink-0';
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
    monetizationBtn.className = 'btn-ghost-modern shrink-0';
    monetizationBtn.addEventListener('click', () => {
      openMonetizationHub().catch((err) => console.error('[Monetization] open failed:', err));
    });
    promptGroup.appendChild(recipeBtn);
    promptGroup.appendChild(monetizationBtn);

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

    // Show/hide native audio toggle based on model
    const supportsNativeAudio = selectedModel.inputs?.native_audio;
    nativeAudioRow.classList.toggle('hidden', !supportsNativeAudio);
    if (!supportsNativeAudio) nativeAudio = false;
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
       if (dynamicControls) {
         Object.assign(params, dynamicControls.getPayload({}));
       }
       
       const result = await muapi.generateAvatar(params);
       if (result?.url) {
         resultArea.classList.remove('hidden');
         resultArea.innerHTML = `
           <div class="bg-[#111]/80 border border-white/10 rounded-2xl p-4">
             <video controls class="w-full rounded-xl mb-3" src="${result.url}"></video>
             <a href="${result.url}" download class="block w-full btn-secondary-modern py-2.5 rounded-xl font-bold text-sm text-center hover:shadow-glow transition-all">Download Video</a>
             <button type="button" class="publish-social-btn block w-full mt-2 bg-gradient-to-r from-[#6d5efc] to-[#a855f7] text-white py-2.5 rounded-xl font-bold text-sm text-center hover:shadow-glow transition-all">Publish to Social</button>
           </div>
         `;
         const publishBtn = resultArea.querySelector('.publish-social-btn');
         if (publishBtn) publishBtn.onclick = () => openSocialPublish({ mediaUrl: result.url, mediaType: 'video' });
       }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      genBtn.disabled = false;
      genBtn.textContent = 'Generate Avatar Video';
    }
  };

  updateFormVisibility();
    const galleryAssets = getAssetsForStudio('avatar');
    if (galleryAssets.length > 0) {
      const gallery = ExampleGallery({ studioId: 'avatar', assets: galleryAssets, maxCards: 20 });
      container.appendChild(gallery);
    }

    return container;
}
