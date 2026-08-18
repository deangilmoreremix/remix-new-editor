import { muapi } from '../lib/muapi.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import { processFileUpload } from '../lib/editor/uploadPipeline.js';
import { createSafeVideo } from '../lib/security.js';
import { createAdvancedControls } from '../lib/studioControls.js';
import { getExtendedModel } from '../lib/modelInputExtensions.js';
import { t2vModels, getAspectRatiosForVideoModel, getDurationsForModel, getResolutionsForVideoModel, i2vModels, getAspectRatiosForI2VModel, getDurationsForI2VModel, getResolutionsForI2VModel, v2vModels, getModelById } from '../lib/models.js';
import { AuthModal } from './AuthModal.js';
import { createUploadPicker } from './UploadPicker.js';
import { createInlineInstructions } from './InlineInstructions.js';
import { createHeroSection, getCustomThumbnailFromCache, saveCustomThumbnailToCache, clearCustomThumbnailCache } from '../lib/thumbnails.js';
import { mountPersonalizePopover, replaceTokensInPrompt } from './personalize/personalizePopover.js';
import { navigate } from '../lib/router.js';
import { consumeStudioPrefill } from '../lib/studioPrefill.js';
import { saveGeneratedAsset } from '../lib/assets/assetActions.js';
import { StudioThumbnailModal, mountStudioThumbnailModal } from './modals/StudioThumbnailPanel.jsx';
import { requireEntitlement } from '../lib/clerkEntitlements.js';
import { subscribeToGtmThumbnails } from '../lib/gtmThumbnailBridge.js';
import { getGtmContext } from '../lib/gtmContextStore.js';
import { PROVIDER_LOGOS, invertLogos, getProviderStyle, getAvailableProviders, filterModels, renderProviderSidebar, renderSearchBar, renderModelList } from '../lib/modelSelectorUI.js';

export function VideoStudio() {
    const container = document.createElement('div');
    container.className = 'w-full h-full flex flex-col items-center justify-start bg-app-bg relative p-4 md:p-6 overflow-y-auto custom-scrollbar overflow-x-hidden';
  mountStudioChrome(container, { currentRoute: 'video' });

    // --- State ---
    const defaultModel = t2vModels[0];
    let selectedModel = defaultModel.id;
    let selectedModelName = defaultModel.name;
    let selectedAr = defaultModel.inputs?.aspect_ratio?.default || '16:9';
    let selectedDuration = defaultModel.inputs?.duration?.default || 5;
    let selectedResolution = defaultModel.inputs?.resolution?.default || '';
    let selectedQuality = defaultModel.inputs?.quality?.default || '';
    let lastGenerationId = null;
    let lastGenerationModel = null;
    let dropdownOpen = null;
    let selectedProvider = 'all';
    let uploadedImageUrl = null;
    let imageMode = false; // false = t2v models, true = i2v models
    let v2vMode = false;   // true = video-to-video tools mode
    let uploadedVideoUrl = null;
    let customThumbnailUrl = getCustomThumbnailFromCache('video-studio');

    // Restore the last GTM context the user picked in the prompt modal,
    // if any. The modal persists selections to localStorage on apply; we
    // log them here so downstream features (defaults, preselects) can
    // pick them up later. The `void` keeps the variable from being
    // flagged as unused until something consumes it.
    try {
      const restoredGtmContext = getGtmContext('video-studio');
      if (restoredGtmContext && typeof console !== 'undefined' && console.info) {
        console.info('[VideoStudio] Restored GTM context', restoredGtmContext);
      }
      void restoredGtmContext;
    } catch { /* ignore */ }
    
    let showAdvanced = false;

    // Camera motion controls
    let cameraMovement = 'Static';
    let motionStrength = 50;
    let cameraSpeed = 5;

    // Style presets
    let selectedStyle = 'None';

    // Guidance scale / CFG
    let guidanceScale = 7.5;

    const getCurrentModels = () => v2vMode ? v2vModels : (imageMode ? i2vModels : t2vModels);
    const getCurrentAspectRatios = (id) => imageMode ? getAspectRatiosForI2VModel(id) : getAspectRatiosForVideoModel(id);
    const getCurrentDurations = (id) => imageMode ? getDurationsForI2VModel(id) : getDurationsForModel(id);
    const getCurrentResolutions = (id) => imageMode ? getResolutionsForI2VModel(id) : getResolutionsForVideoModel(id);
    const getCurrentModel = () => getCurrentModels().find(m => m.id === selectedModel);
    const getQualitiesForModel = (id) => {
        const model = getCurrentModels().find(m => m.id === id);
        return model?.inputs?.quality?.enum || [];
    };

    // ==========================================
    // 1. HERO SECTION
    // ==========================================
    const hero = document.createElement('div');
    hero.className = 'flex flex-col items-center mb-2 md:mb-4 animate-fade-in-up transition-all duration-700 w-full';
    const heroBanner = createHeroSection('video', 'h-32 md:h-44 mb-3');
    if (heroBanner) {
        const heroContent = document.createElement('div');
        heroContent.className = 'absolute bottom-0 left-0 right-0 p-6 z-10';
        heroContent.innerHTML = `
            <h1 class="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-1">Video Studio</h1>
            <p class="text-white/60 text-sm font-medium">Animate images into stunning AI videos with motion effects</p>
        `;
        heroBanner.appendChild(heroContent);
        hero.appendChild(heroBanner);
    }

    container.appendChild(hero);

    // ==========================================
    // 2. PROMPT BAR
    // ==========================================
    const promptWrapper = document.createElement('div');
    promptWrapper.className = 'w-full relative z-40 animate-fade-in-up';
    promptWrapper.style.animationDelay = '0.2s';

    const bar = document.createElement('div');
    bar.className = 'w-full bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-[1.5rem] md:rounded-[2.5rem] p-3 md:p-5 flex flex-col gap-3 md:gap-5 shadow-3xl';

    const topRow = document.createElement('div');
    topRow.className = 'flex items-start gap-5 px-2';

    // --- Image Upload Picker (Image-to-Video) ---
    const picker = createUploadPicker({
        anchorContainer: container,
        onSelect: ({ url }) => {
            uploadedImageUrl = url;
            // Clear video mode if active
            if (v2vMode) {
                uploadedVideoUrl = null;
                v2vMode = false;
                showVideoIcon();
            }
            if (!imageMode) {
                imageMode = true;
                selectedModel = i2vModels[0].id;
                selectedModelName = i2vModels[0].name;
                document.getElementById('v-model-btn-label').textContent = selectedModelName;
                updateModelBtnIcon();
                updateControlsForModel(selectedModel);
            }
            textarea.placeholder = 'Describe the motion or effect (optional)';
            textarea.disabled = false;
        },
        onClear: () => {
            uploadedImageUrl = null;
            imageMode = false;
        selectedModel = t2vModels[0].id;
        selectedModelName = t2vModels[0].name;
        document.getElementById('v-model-btn-label').textContent = selectedModelName;
        updateModelBtnIcon();
        updateControlsForModel(selectedModel);
            textarea.placeholder = 'Describe the video you want to create';
            textarea.disabled = false;
        }
    });
    topRow.appendChild(picker.trigger);

    // Pexels browse button for i2v reference image
    const pexelsImageBtn = document.createElement('button');
    pexelsImageBtn.type = 'button';
    pexelsImageBtn.title = 'Browse stock photos for i2v reference';
    pexelsImageBtn.className = 'w-10 h-10 shrink-0 rounded-xl border transition-all flex items-center justify-center bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40 group relative overflow-hidden';
    pexelsImageBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-secondary group-hover:text-primary"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>';
    pexelsImageBtn.onclick = async () => {
      const { browsePexelsImages } = await import('../lib/studioPexels.js');
      browsePexelsImages({
        title: 'Select Reference Image for Video',
        studioName: 'Video Studio',
        onSelect: (asset) => {
          uploadedImageUrl = asset.src?.large || asset.url || asset.original;
          if (v2vMode) {
            uploadedVideoUrl = null;
            v2vMode = false;
            showVideoIcon();
          }
          if (!imageMode) {
            imageMode = true;
            selectedModel = i2vModels[0]?.id || selectedModel;
            selectedModelName = i2vModels[0]?.name || selectedModelName;
            const modelLabel = document.getElementById('v-model-btn-label');
            if (modelLabel) modelLabel.textContent = selectedModelName;
            updateModelBtnIcon();
            updateControlsForModel(selectedModel);
          }
          textarea.placeholder = 'Describe the motion or effect (optional)';
          textarea.disabled = false;
          const attrContainer = document.getElementById('pexels-video-image-attribution');
          if (attrContainer) {
            attrContainer.innerHTML = '';
            import('../lib/attributionChip.js').then(mod => mod.renderAttributionChip(asset, attrContainer));
          }
        }
      });
    };
    topRow.appendChild(pexelsImageBtn);

    container.appendChild(picker.panel);

    // --- Last Frame extraction for I2V ---
    const lastFrameInput = document.createElement('input');
    lastFrameInput.type = 'file';
    lastFrameInput.accept = 'video/*';
    lastFrameInput.className = 'hidden';

    const lastFrameBtn = document.createElement('button');
    lastFrameBtn.type = 'button';
    lastFrameBtn.title = 'Use last frame of a video as I2V source';
    lastFrameBtn.className = 'w-10 h-10 shrink-0 rounded-xl border transition-all flex items-center justify-center relative overflow-hidden mt-1.5 bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40 group';
    lastFrameBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-muted group-hover:text-primary transition-colors"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><polyline points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/><text x="12" y="14" text-anchor="middle" font-size="7" fill="currentColor" stroke="none">⏱</text></svg>`;
    lastFrameBtn.appendChild(lastFrameInput);

    lastFrameBtn.onclick = (e) => {
        e.stopPropagation();
        lastFrameInput.click();
    };

    lastFrameInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const apiKey = apiKeyManager.getKey();
        if (!apiKey) { AuthModal(() => lastFrameInput.click()); return; }
        lastFrameBtn.disabled = true;
        lastFrameBtn.innerHTML = `<span class="animate-spin text-primary text-sm">◌</span>`;
        try {
            const frameUrl = await extractLastFrame(file);
            if (frameUrl) {
                uploadedImageUrl = frameUrl;
                picker.reset && picker.reset();
                if (!imageMode) {
                    imageMode = true;
                    selectedModel = i2vModels[0].id;
                    selectedModelName = i2vModels[0].name;
                    refreshVideoModelSelector();
                    updateControlsForModel(selectedModel);
                }
                textarea.placeholder = 'Describe the motion or effect (optional)';
                textarea.disabled = false;
                showToast('Last frame loaded for I2V', 'success');
            }
        } catch (err) {
            console.error('[VideoStudio] Last frame extraction failed:', err);
            showToast('Failed to extract last frame: ' + err.message, 'error');
        } finally {
            lastFrameBtn.disabled = false;
            lastFrameBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-muted group-hover:text-primary transition-colors"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><polyline points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/><text x="12" y="14" text-anchor="middle" font-size="7" fill="currentColor" stroke="none">⏱</text></svg>`;
            lastFrameInput.value = '';
        }
    };

    topRow.appendChild(lastFrameBtn);

    // --- Video Upload Picker (Video-to-Video) ---
    const videoFileInput = document.createElement('input');
    videoFileInput.type = 'file';
    videoFileInput.accept = 'video/*';
    videoFileInput.className = 'hidden';

    const videoPickerBtn = document.createElement('button');
    videoPickerBtn.type = 'button';
    videoPickerBtn.title = 'Upload video to remove watermark';
    videoPickerBtn.className = 'w-10 h-10 shrink-0 rounded-xl border transition-all flex items-center justify-center relative overflow-hidden mt-1.5 bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40 group';

    const videoIconEl = document.createElement('div');
    videoIconEl.className = 'flex items-center justify-center w-full h-full';
    videoIconEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-muted group-hover:text-primary transition-colors"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`;

    const videoSpinnerEl = document.createElement('div');
    videoSpinnerEl.className = 'hidden items-center justify-center w-full h-full';
    videoSpinnerEl.innerHTML = `<span class="animate-spin text-primary text-sm">◌</span>`;

    const videoReadyEl = document.createElement('div');
    videoReadyEl.className = 'hidden items-center justify-center w-full h-full';
    videoReadyEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-primary"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/><polyline points="7 10 10 13 15 8" stroke="#d9ff00" stroke-width="2.5"/></svg>`;

    videoPickerBtn.appendChild(videoFileInput);
    videoPickerBtn.appendChild(videoIconEl);
    videoPickerBtn.appendChild(videoSpinnerEl);
    videoPickerBtn.appendChild(videoReadyEl);

    const showVideoIcon = () => {
        videoIconEl.classList.replace('hidden', 'flex');
        videoSpinnerEl.classList.add('hidden'); videoSpinnerEl.classList.remove('flex');
        videoReadyEl.classList.add('hidden'); videoReadyEl.classList.remove('flex');
        videoPickerBtn.classList.remove('border-primary/60');
        videoPickerBtn.classList.add('border-white/10');
        videoPickerBtn.title = 'Upload video to remove watermark';
    };

    const showVideoSpinner = () => {
        videoIconEl.classList.add('hidden'); videoIconEl.classList.remove('flex');
        videoSpinnerEl.classList.replace('hidden', 'flex');
        videoReadyEl.classList.add('hidden'); videoReadyEl.classList.remove('flex');
    };

    const showVideoReady = (filename) => {
        videoIconEl.classList.add('hidden'); videoIconEl.classList.remove('flex');
        videoSpinnerEl.classList.add('hidden'); videoSpinnerEl.classList.remove('flex');
        videoReadyEl.classList.replace('hidden', 'flex');
        videoPickerBtn.classList.remove('border-white/10');
        videoPickerBtn.classList.add('border-primary/60');
        videoPickerBtn.title = `${filename} — click to clear`;
    };

    const clearVideoUpload = () => {
        uploadedVideoUrl = null;
        v2vMode = false;
        showVideoIcon();
        selectedModel = t2vModels[0].id;
        selectedModelName = t2vModels[0].name;
        refreshVideoModelSelector();
        updateControlsForModel(selectedModel);
        textarea.placeholder = 'Describe the video you want to create';
        textarea.disabled = false;
    };

    videoPickerBtn.onclick = (e) => {
        e.stopPropagation();
        if (uploadedVideoUrl) {
            clearVideoUpload();
        } else {
            videoFileInput.click();
        }
    };

    videoFileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const apiKey = apiKeyManager.getKey();
        if (!apiKey) {
            AuthModal(() => videoFileInput.click());
            return;
        }

        showVideoSpinner();
        try {
            const result = await processFileUpload(file);
            const url = result.url || result.urls?.[0];
            if (!url) throw new Error('Upload returned no URL');
            uploadedVideoUrl = url;
            showVideoReady(file.name);

            // Switch to v2v mode
            if (imageMode) {
                picker.reset();
                uploadedImageUrl = null;
                imageMode = false;
            }
            v2vMode = true;
            selectedModel = v2vModels[0].id;
            selectedModelName = v2vModels[0].name;
            document.getElementById('v-model-btn-label').textContent = selectedModelName;
            updateModelBtnIcon();
            updateControlsForModel(selectedModel);
            textarea.placeholder = 'Video ready — click Generate to remove watermark';
            textarea.disabled = true;
        } catch (err) {
            console.error('[VideoStudio] Video upload failed:', err);
            showVideoIcon();
            alert(`Video upload failed: ${err.message}`);
        }
        videoFileInput.value = '';
    };

    topRow.appendChild(videoPickerBtn);

    // Pexels browse button for v2v source video
    const pexelsVideoBtn = document.createElement('button');
    pexelsVideoBtn.type = 'button';
    pexelsVideoBtn.title = 'Browse stock videos for v2v input';
    pexelsVideoBtn.className = 'w-10 h-10 shrink-0 rounded-xl border transition-all flex items-center justify-center bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40 group relative overflow-hidden';
    pexelsVideoBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-secondary group-hover:text-primary"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>';
    pexelsVideoBtn.onclick = async () => {
      const { browsePexelsVideos } = await import('../lib/studioPexels.js');
      browsePexelsVideos({
        title: 'Select Source Video',
        studioName: 'Video Studio',
        onSelect: (asset) => {
          uploadedVideoUrl = asset.video_files?.[0]?.link || asset.url || asset.original;
          if (imageMode) {
            picker.reset();
            uploadedImageUrl = null;
            imageMode = false;
          }
          v2vMode = true;
          selectedModel = v2vModels[0]?.id || selectedModel;
          selectedModelName = v2vModels[0]?.name || selectedModelName;
          const modelLabel = document.getElementById('v-model-btn-label');
          if (modelLabel) modelLabel.textContent = selectedModelName;
          updateModelBtnIcon();
          updateControlsForModel(selectedModel);
          textarea.placeholder = 'Describe the video you want to create';
          textarea.disabled = false;
          const attrContainer = document.getElementById('pexels-video-video-attribution');
          if (attrContainer) {
            attrContainer.innerHTML = '';
            import('../lib/attributionChip.js').then(mod => mod.renderAttributionChip(asset, attrContainer));
          }
        }
      });
    };
    topRow.appendChild(pexelsVideoBtn);

    // Attribution containers
    const pexelsVideoImageAttr = document.createElement('div');
    pexelsVideoImageAttr.id = 'pexels-video-image-attribution';
    pexelsVideoImageAttr.className = 'mt-1';
    topRow.appendChild(pexelsVideoImageAttr);

    const pexelsVideoVideoAttr = document.createElement('div');
    pexelsVideoVideoAttr.id = 'pexels-video-video-attribution';
    pexelsVideoVideoAttr.className = 'mt-1';
    topRow.appendChild(pexelsVideoVideoAttr);

    const textarea = document.createElement('textarea');
    textarea.id = 'v-prompt-textarea';
    textarea.placeholder = 'Describe the video you want to create';
    textarea.className = 'flex-1 bg-transparent border-none text-white text-base md:text-xl placeholder:text-muted focus:outline-none resize-none pt-2.5 leading-relaxed min-h-[40px] max-h-[150px] md:max-h-[250px] overflow-y-auto custom-scrollbar';
    textarea.rows = 1;
    textarea.setAttribute('aria-label', 'Video prompt');
    textarea.oninput = () => {
        textarea.style.height = 'auto';
        const maxHeight = window.innerWidth < 768 ? 150 : 250;
        textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px';
    };

    let videoPrefill = '';
    try {
        const raw = localStorage.getItem('prefill_prompt');
        if (raw) {
            localStorage.removeItem('prefill_prompt');
            videoPrefill = raw;
        }
    } catch { /* ignore */ }
    if (!videoPrefill) {
        const staged = consumeStudioPrefill('video');
        if (staged) {
            if (staged.model) selectedModel = staged.model;
            videoPrefill = staged.prompt || '';
        }
    }
    if (videoPrefill) {
        textarea.value = videoPrefill;
        requestAnimationFrame(() => {
            textarea.style.height = 'auto';
            const maxHeight = window.innerWidth < 768 ? 150 : 250;
            textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px';
        });
    }

    topRow.appendChild(textarea);

    // Premium GTM Boost entry point — opens the cinematic prompt enhancer
    // themed for video creation and loads the result straight into this prompt.
    const gtmBtn = document.createElement('button');
    gtmBtn.type = 'button';
    gtmBtn.textContent = '🎯 GTM Boost';
    gtmBtn.title = 'Enhance your prompt with GTM conversion frameworks';
    gtmBtn.setAttribute('aria-label', 'GTM Boost prompt enhancer');
    gtmBtn.className = 'gtm-boost-btn shrink-0';
    gtmBtn.addEventListener('click', () => {
      import('../lib/uiIntegration.js').then(({ openGTMPromptModal }) => {
        openGTMPromptModal('video-studio', (prompt) => {
          textarea.value = prompt;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.focus();
          textarea.style.height = 'auto';
          textarea.style.height = Math.min(textarea.scrollHeight, 250) + 'px';
        });
      }).catch((err) => console.error('[VideoStudio] GTM Boost failed:', err));
    });
    topRow.appendChild(gtmBtn);

    bar.appendChild(topRow);

    // Personalized chip — shows when a contact is active
    const personalizedChip = document.createElement('div');
    personalizedChip.id = 'v-personalized-chip';
    personalizedChip.className = 'hidden items-center gap-2 px-3 py-2 mx-2 mt-2 bg-primary/10 border border-primary/20 rounded-xl text-xs text-primary';
    bar.appendChild(personalizedChip);

    function refreshPersonalizedChip() {
      const id = (() => { try { return localStorage.getItem('remix_selected_contact_id'); } catch { return null; } })();
      if (!id) {
        personalizedChip.classList.add('hidden');
        personalizedChip.classList.remove('flex');
        return;
      }
      try {
        const contacts = JSON.parse(localStorage.getItem('remix_contacts') || '[]');
        const contact = contacts.find(c => c.id === id);
        if (contact) {
          personalizedChip.classList.remove('hidden');
          personalizedChip.classList.add('flex');
          personalizedChip.innerHTML = `
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>Personalized for <strong>${escapeHtml(contact.name)}</strong>${contact.company ? ` at ${escapeHtml(contact.company)}` : ''}</span>
            <button id="v-clear-contact" class="ml-2 text-primary/60 hover:text-primary" title="Remove personalization">✕</button>
          `;
          const clearBtn = personalizedChip.querySelector('#v-clear-contact');
          if (clearBtn) {
            clearBtn.onclick = (e) => {
              e.stopPropagation();
              localStorage.removeItem('remix_selected_contact_id');
              refreshPersonalizedChip();
              refreshPopoverForSelectedContact();
            };
          }
        }
      } catch {}
    }
    refreshPersonalizedChip();

    // Extend mode banner (shown when extend model is active, not editable by user)
    const extendBanner = document.createElement('div');
    extendBanner.className = 'hidden items-center gap-2 px-4 py-2 mx-2 mt-2 bg-primary/10 border border-primary/20 rounded-xl text-xs text-primary';
    extendBanner.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        <span>Extending previous Seedance 2.0 generation — add an optional prompt to guide the continuation</span>
    `;
    bar.appendChild(extendBanner);

    // Bottom Row: Controls
    const bottomRow = document.createElement('div');
    bottomRow.className = 'flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 px-2 pt-4 border-t border-white/5';

    const controlsLeft = document.createElement('div');
    controlsLeft.className = 'flex items-center gap-1.5 md:gap-2.5 relative overflow-x-auto no-scrollbar pb-1 md:pb-0';

    const createControlBtn = (icon, label, id, tooltip) => {
        const btn = document.createElement('button');
        btn.id = id;
        btn.className = 'flex items-center gap-1.5 md:gap-2.5 px-3 md:px-4 py-2 md:py-2.5 bg-white/5 hover:bg-white/10 rounded-xl md:rounded-2xl transition-all border border-white/5 group whitespace-nowrap';
        if (tooltip) btn.setAttribute('data-tooltip', tooltip);
        btn.innerHTML = `
            ${icon}
            <span id="${id}-label" class="text-xs font-bold text-white group-hover:text-primary transition-colors">${label}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" class="opacity-20 group-hover:opacity-100 transition-opacity"><path d="M6 9l6 6 6-6"/></svg>
        `;
        return btn;
    };

    const modelBtn = createControlBtn(`
        <div id="v-model-btn-icon" class="w-5 h-5 rounded-md flex items-center justify-center overflow-hidden bg-white/5"></div>
    `, selectedModelName, 'v-model-btn', 'Select AI video model');

    const updateModelBtnIcon = () => {
        const iconEl = document.getElementById('v-model-btn-icon');
        if (!iconEl) return;
        const allCurrentModels = [...t2vModels, ...i2vModels, ...v2vModels];
        const current = allCurrentModels.find(m => m.id === selectedModel);
        const provider = current?.provider || 'muapi';
        const logoUrl = PROVIDER_LOGOS[provider];
        if (logoUrl) {
            iconEl.innerHTML = `<img src="${logoUrl}" alt="" class="w-full h-full object-contain ${invertLogos.includes(provider) ? 'invert' : ''}" />`;
        } else {
            const style = getProviderStyle(provider);
            iconEl.innerHTML = `<span class="text-[10px] font-black text-black">${style.text}</span>`;
            iconEl.className = 'w-5 h-5 bg-primary rounded-md flex items-center justify-center shadow-lg shadow-primary/20';
        }
    };
    updateModelBtnIcon();

    const arBtn = createControlBtn(`
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-60 text-secondary"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
    `, selectedAr, 'v-ar-btn', 'Change aspect ratio');

    const durationBtn = createControlBtn(`
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-60 text-secondary"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    `, `${selectedDuration}s`, 'v-duration-btn', 'Set video duration');

    const resolutionBtn = createControlBtn(`
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-60 text-secondary"><path d="M6 2L3 6v15a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6z"/></svg>
    `, selectedResolution || '720p', 'v-resolution-btn', 'Set output resolution');

    const qualityBtn = createControlBtn(`
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-60 text-secondary"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
    `, selectedQuality || 'basic', 'v-quality-btn', 'Set output quality');

    // Model selector (provider-aware split-pane)
    const videoModelSelectorContainer = document.createElement('div');
    videoModelSelectorContainer.className = 'w-full mb-4';
    bar.insertBefore(videoModelSelectorContainer, controlsLeft);

    let videoSelectedProvider = 'all';
    let videoSearchQuery = '';

    const refreshVideoModelSelector = () => {
      if (videoModelSelectorContainer) {
        videoModelSelectorContainer.innerHTML = '';
      }
      const models = getCurrentModels();
      mountModelSelector(videoModelSelectorContainer, {
        models,
        selectedModelId: selectedModel,
        selectedProvider: videoSelectedProvider,
        search: videoSearchQuery,
        onSelectModel: (modelId) => {
          selectedModel = modelId;
          selectedModelName = models.find(m => m.id === modelId)?.name || selectedModelName;
          updateControlsForModel(selectedModel);
          if (v2vMode) {
            textarea.placeholder = 'Upload a video using the 🎥 button, then click Generate';
            textarea.disabled = true;
          } else {
            textarea.placeholder = imageMode ? 'Describe the motion or effect (optional)' : 'Describe the video you want to create';
            textarea.disabled = false;
          }
        },
        onSelectProvider: (provider) => {
          videoSelectedProvider = provider;
          refreshVideoModelSelector();
        },
        onSearch: (query) => {
          videoSearchQuery = query;
          refreshVideoModelSelector();
        },
      });
    };
    refreshVideoModelSelector();

    controlsLeft.appendChild(arBtn);
    controlsLeft.appendChild(durationBtn);
    controlsLeft.appendChild(resolutionBtn);
    controlsLeft.appendChild(qualityBtn);
    
    // Advanced options toggle button
    const advancedBtn = createControlBtn(`
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-60 text-secondary"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2H5a2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 00-1.51-1H21a2 2 0 012 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
    `, 'Advanced', 'v-advanced-btn', 'Show advanced options');
    controlsLeft.appendChild(advancedBtn);

    // Motion & Style toggle button
    const motionStyleBtn = createControlBtn(`
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-60 text-secondary"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
    `, 'Motion & Style', 'v-motion-style-btn', 'Camera movement, motion strength & style presets');
    controlsLeft.appendChild(motionStyleBtn);

    // Personalize button + inline popover (shared module, reusable across AI apps)
    const personalizeHandle = mountPersonalizePopover({
      controlsContainer: controlsLeft,
      label: 'Personalize',
      tooltip: 'Personalize with a discovered contact',
      appId: 'ai-video-agency',
      getTextarea: () => document.getElementById('v-prompt-textarea'),
    });
    // Refresh the personalized chip when the active contact changes
    window.addEventListener('remix:contact-changed', () => {
      try { refreshPersonalizedChip(); } catch {}
    });


    // Initial visibility (t2v mode)
    const initDurations = getDurationsForModel(defaultModel.id);
    durationBtn.style.display = initDurations.length > 0 ? 'flex' : 'none';
    const initResolutions = getResolutionsForVideoModel(defaultModel.id);
    resolutionBtn.style.display = initResolutions.length > 0 ? 'flex' : 'none';
    qualityBtn.style.display = 'none';

    // Thumbnail studio button — next to creation controls, GTM Boost styling
    const thumbBtn = document.createElement('button');
    thumbBtn.type = 'button';
    thumbBtn.textContent = '🖼 Thumbnail';
    thumbBtn.title = 'Generate a custom thumbnail';
    thumbBtn.className = 'gtm-boost-btn shrink-0';
    thumbBtn.addEventListener('click', () => {
      const modal = new StudioThumbnailModal({
        appTheme: 'video-studio',
        studioId: 'video-studio',
        studioName: 'Video Studio',
        aspectRatio: selectedAr || '16:9',
        outputType: 'video',
        onApply: ({ imageUrl }) => {
          customThumbnailUrl = imageUrl;
          saveCustomThumbnailToCache('video-studio', imageUrl);
        },
        onClear: () => {
          customThumbnailUrl = null;
          clearCustomThumbnailCache('video-studio');
        },
      });
      mountStudioThumbnailModal(modal);
      modal.open();
    });
    controlsLeft.appendChild(thumbBtn);

    subscribeToGtmThumbnails(({ imageUrl }) => {
      customThumbnailUrl = imageUrl;
      saveCustomThumbnailToCache('video-studio', imageUrl);
    });

    const generateBtn = document.createElement('button');
    generateBtn.type = 'button';
    generateBtn.className = 'bg-primary text-black px-6 md:px-8 py-3 md:py-3.5 rounded-xl md:rounded-[1.5rem] font-black text-sm md:text-base hover:shadow-glow hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2.5 w-full sm:w-auto shadow-lg';
    generateBtn.setAttribute('data-tooltip', 'Generate AI video from prompt');
    generateBtn.setAttribute('aria-label', 'Generate video');
    generateBtn.innerHTML = `Generate ✨`;

    bottomRow.appendChild(controlsLeft);
    bottomRow.appendChild(generateBtn);
    bar.appendChild(bottomRow);
    promptWrapper.appendChild(bar);
    container.appendChild(promptWrapper);

    const inlineInstructions = createInlineInstructions('video');
    inlineInstructions.classList.add('mt-8');
    container.appendChild(inlineInstructions);

    // MiniMax H3 example styles — clickable footer rail. Each card opens a
    // detail modal (full player + extracted style params + tweakable prompt)
    // and "Create This Style" opens the mapped studio pre-filled.
    //
    // Note: the previous mount filtered on `__route === 'video'`, but every
    // demo category is mapped in CATEGORY_ROUTES, so 'video' (the fallback
    // route) matched nothing and the rail always rendered empty. It now shows
    // the first 12 demos with their resolved studio targets.
    import('./demos/DemoRail.jsx').then(({ createDemoRail }) => {
        return import('../data/minimax/presets.js').then(({ minimaxPresets }) => {
            const items = minimaxPresets.filter((p) => p.targetStudio === 'VideoStudio');
            if (!items.length) return;
            const rail = createDemoRail({
                items,
                source: 'minimax',
                variant: 'rail',
                title: 'MiniMax H3 Example Styles',
                subtitle: 'Click any clip for details, or create in this style',
                className: 'mt-10 max-w-6xl mx-auto',
            });
            container.appendChild(rail);
        });
    }).catch((e) => {
        console.error('[VideoStudio] demo rail failed', e);
    });

    // ==========================================
    // ADVANCED OPTIONS PANEL
    // ==========================================
    const advancedPanel = document.createElement('div');
    advancedPanel.className = 'w-full mt-6 animate-fade-in-up hidden';
    advancedPanel.id = 'v-advanced-panel';
    advancedPanel.innerHTML = `
        <div class="bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
            <div class="flex items-center justify-between pb-3 border-b border-white/5">
                <h3 class="text-sm font-bold text-white">Advanced Options</h3>
                <button id="v-close-adv-btn" class="text-white/40 hover:text-white transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            </div>
            <div id="v-advanced-controls-container" class="flex flex-col gap-4"></div>
        </div>
    `;
    container.appendChild(advancedPanel);

    let dynamicControls = null;

    const getAdvancedModel = () => {
      const base = getExtendedModel(getCurrentModel());
      if (!base) return null;
      const advancedInputs = {};
      for (const [key, schema] of Object.entries(base.inputs || {})) {
        if (key === 'negative_prompt' || key === 'seed') {
          advancedInputs[key] = schema;
        }
      }
      return { ...base, inputs: advancedInputs };
    };

    const initAdvancedControls = () => {
      if (dynamicControls) return;
      const advModel = getAdvancedModel();
      if (!advModel) return;
      const controlsContainer = advancedPanel.querySelector('#v-advanced-controls-container');
      dynamicControls = createAdvancedControls({
        model: advModel,
        state: { imageMode, v2vMode },
        container: controlsContainer,
        exclude: new Set(['aspect_ratio', 'duration', 'resolution', 'quality']),
      });
    };

    const toggleAdvanced = () => {
      showAdvanced = !showAdvanced;
      advancedPanel.classList.toggle('hidden', !showAdvanced);
      document.getElementById('v-advanced-btn-label').textContent = showAdvanced ? 'Less' : 'Advanced';
      if (showAdvanced && !dynamicControls) {
        initAdvancedControls();
      }
    };

    advancedBtn.onclick = toggleAdvanced;
    const vCloseAdvBtn = advancedPanel.querySelector('#v-close-adv-btn');
    if (vCloseAdvBtn) vCloseAdvBtn.onclick = toggleAdvanced;

    // ==========================================
    // 3.5. MOTION & STYLE PANEL
    // ==========================================
    const motionStylePanel = document.createElement('div');
    motionStylePanel.className = 'w-full mt-6 animate-fade-in-up hidden';
    motionStylePanel.id = 'v-motion-style-panel';
    motionStylePanel.innerHTML = `
        <div class="bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
            <div class="flex items-center justify-between pb-3 border-b border-white/5">
                <h3 class="text-sm font-bold text-white">Motion & Style</h3>
                <button id="v-close-motion-btn" class="text-white/40 hover:text-white transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            </div>
            
            <!-- Camera Movement -->
            <div class="flex flex-col gap-2">
                <label class="text-xs font-bold text-secondary uppercase tracking-wider">Camera Movement</label>
                <select id="v-camera-movement" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none appearance-none cursor-pointer">
                    <option value="Static">Static (Locked Shot)</option>
                    <option value="Pan">Pan (Horizontal)</option>
                    <option value="Tilt">Tilt (Vertical)</option>
                    <option value="Zoom In">Zoom In</option>
                    <option value="Zoom Out">Zoom Out</option>
                    <option value="Dolly In">Dolly In</option>
                    <option value="Dolly Out">Dolly Out</option>
                    <option value="Crane Up">Crane Up</option>
                    <option value="Orbit">Orbit (360°)</option>
                    <option value="FPV Drone">FPV Drone</option>
                    <option value="Handheld">Handheld</option>
                    <option value="Dolly Zoom">Dolly Zoom (Vertigo)</option>
                </select>
            </div>
            
            <!-- Motion Strength -->
            <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between">
                    <label class="text-xs font-bold text-secondary uppercase tracking-wider">Motion Strength</label>
                    <span id="v-motion-strength-value" class="text-xs font-bold text-primary">50%</span>
                </div>
                <input type="range" id="v-motion-strength" min="0" max="100" step="5" value="50" 
                    class="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary">
            </div>
            
            <!-- Camera Speed -->
            <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between">
                    <label class="text-xs font-bold text-secondary uppercase tracking-wider">Camera Speed</label>
                    <span id="v-camera-speed-value" class="text-xs font-bold text-primary">5</span>
                </div>
                <input type="range" id="v-camera-speed" min="1" max="10" step="1" value="5" 
                    class="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary">
            </div>
            
            <!-- Style Presets -->
            <div class="flex flex-col gap-2">
                <label class="text-xs font-bold text-secondary uppercase tracking-wider">Style Preset</label>
                <div class="flex gap-2 flex-wrap">
                    ${['None', 'Photorealistic', 'Anime', 'Cinematic', 'Oil Painting', 'Watercolor', 'Digital Art', 'Concept Art', 'Cyberpunk'].map(s => 
                        `<button class="v-style-preset-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 text-secondary hover:bg-white/10 transition-all border border-white/5" data-style="${s}">${s}</button>`
                    ).join('')}
                </div>
            </div>
            
            <!-- Guidance Scale (CFG) -->
            <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between">
                    <label class="text-xs font-bold text-secondary uppercase tracking-wider">Guidance Scale (CFG)</label>
                    <span id="v-guidance-value" class="text-xs font-bold text-primary">7.5</span>
                </div>
                <input type="range" id="v-guidance-slider" min="1" max="20" step="0.5" value="7.5" 
                    class="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary">
                <p class="text-[10px] text-muted">Lower = more creative freedom, Higher = stricter prompt adherence</p>
            </div>
        </div>
    `;
    container.appendChild(motionStylePanel);

    // ==========================================
    // 3.6. VIDEO QUICK STARTERS
    // ==========================================
    const quickStartersPanel = document.createElement('div');
    quickStartersPanel.className = 'w-full mt-6 animate-fade-in-up hidden';
    quickStartersPanel.id = 'v-quick-starters';
    quickStartersPanel.innerHTML = `
        <div class="bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
            <div class="flex items-center justify-between pb-3 border-b border-white/5">
                <h3 class="text-sm font-bold text-white">Quick Starters</h3>
                <button id="v-close-quick-btn" class="text-white/40 hover:text-white transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                ${VIDEO_QUICK_PROMPTS.map(q => `
                    <button class="v-quick-starter-btn px-3 py-2 rounded-lg text-xs font-bold bg-white/5 text-secondary hover:bg-white/10 hover:text-primary transition-all text-left border border-white/5 hover:border-primary/30" data-prompt="${q.prompt}">
                        ${q.label}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
    container.appendChild(quickStartersPanel);

    // Quick starters toggle
    const quickStartersBtn = createControlBtn(`
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-60 text-secondary"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
    `, 'Quick Starters', 'v-quick-starters-btn', 'Video quick prompt starters');
    controlsLeft.appendChild(quickStartersBtn);

    let showQuickStarters = false;
    const toggleQuickStarters = () => {
        showQuickStarters = !showQuickStarters;
        quickStartersPanel.classList.toggle('hidden', !showQuickStarters);
        document.getElementById('v-quick-starters-btn-label').textContent = showQuickStarters ? 'Starters' : 'Quick Starters';
    };
    quickStartersBtn.onclick = toggleQuickStarters;
    const vCloseQuickBtn = quickStartersPanel.querySelector('#v-close-quick-btn');
    if (vCloseQuickBtn) vCloseQuickBtn.onclick = toggleQuickStarters;

    const vQuickStarterBtns = quickStartersPanel.querySelectorAll('.v-quick-starter-btn');
    vQuickStarterBtns.forEach(btn => {
        btn.onclick = () => {
            textarea.value = btn.dataset.prompt;
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 250) + 'px';
            toggleQuickStarters();
        };
    });

    // Motion & Style panel toggle logic
    let showMotionStyle = false;
    const toggleMotionStyle = () => {
        showMotionStyle = !showMotionStyle;
        motionStylePanel.classList.toggle('hidden', !showMotionStyle);
        document.getElementById('v-motion-style-btn-label').textContent = showMotionStyle ? 'Motion' : 'Motion & Style';
    };
    motionStyleBtn.onclick = toggleMotionStyle;
    const vCloseMotionBtn = motionStylePanel.querySelector('#v-close-motion-btn');
    if (vCloseMotionBtn) vCloseMotionBtn.onclick = toggleMotionStyle;

    // Camera movement select
    const vCameraMovement = motionStylePanel.querySelector('#v-camera-movement');
    if (vCameraMovement) {
        vCameraMovement.onchange = (e) => { cameraMovement = e.target.value; };
    }

    // Motion strength slider
    const vMotionStrength = motionStylePanel.querySelector('#v-motion-strength');
    const vMotionStrengthVal = motionStylePanel.querySelector('#v-motion-strength-value');
    if (vMotionStrength && vMotionStrengthVal) {
        vMotionStrength.oninput = (e) => {
            motionStrength = parseInt(e.target.value);
            vMotionStrengthVal.textContent = motionStrength + '%';
        };
    }

    // Camera speed slider
    const vCameraSpeed = motionStylePanel.querySelector('#v-camera-speed');
    const vCameraSpeedVal = motionStylePanel.querySelector('#v-camera-speed-value');
    if (vCameraSpeed && vCameraSpeedVal) {
        vCameraSpeed.oninput = (e) => {
            cameraSpeed = parseInt(e.target.value);
            vCameraSpeedVal.textContent = cameraSpeed;
        };
    }

    // Guidance scale slider
    const vGuidanceSlider = motionStylePanel.querySelector('#v-guidance-slider');
    const vGuidanceValue = motionStylePanel.querySelector('#v-guidance-value');
    if (vGuidanceSlider && vGuidanceValue) {
        vGuidanceSlider.oninput = (e) => {
            guidanceScale = parseFloat(e.target.value);
            vGuidanceValue.textContent = guidanceScale;
        };
    }

    // Style preset buttons
    const vStylePresetBtns = motionStylePanel.querySelectorAll('.v-style-preset-btn');
    vStylePresetBtns.forEach(btn => {
        btn.onclick = () => {
            selectedStyle = btn.dataset.style;
            vStylePresetBtns.forEach(b => {
                b.classList.remove('bg-primary/20', 'text-primary', 'border-primary/30');
                b.classList.add('bg-white/5', 'text-secondary', 'border-white/5');
            });
            btn.classList.add('bg-primary/20', 'text-primary', 'border-primary/30');
            btn.classList.remove('bg-white/5', 'text-secondary', 'border-white/5');
        };
    });

    // ==========================================
    // 3. DROPDOWNS
    // ==========================================
    const dropdown = document.createElement('div');
    dropdown.className = 'absolute bottom-[102%] left-2 z-50 transition-all opacity-0 pointer-events-none scale-95 origin-bottom-left glass rounded-3xl p-3 translate-y-2 w-[calc(100vw-3rem)] max-w-xs shadow-4xl border border-white/10 flex flex-col';

    const updateControlsForModel = (modelId) => {
        const model = getCurrentModels().find(m => m.id === modelId);

        // In v2v mode, hide all parameter controls — no prompt/AR/duration/etc needed
        if (v2vMode) {
            arBtn.style.display = 'none';
            durationBtn.style.display = 'none';
            resolutionBtn.style.display = 'none';
            qualityBtn.style.display = 'none';
            extendBanner.classList.add('hidden');
            extendBanner.classList.remove('flex');
            return;
        }

        // Aspect ratio
        const availableArs = getCurrentAspectRatios(modelId);
        if (availableArs.length > 0) {
            selectedAr = availableArs[0];
            document.getElementById('v-ar-btn-label').textContent = selectedAr;
            arBtn.style.display = 'flex';
        } else {
            arBtn.style.display = 'none';
        }

        // Duration
        const durations = getCurrentDurations(modelId);
        if (durations.length > 0) {
            selectedDuration = durations[0];
            document.getElementById('v-duration-btn-label').textContent = `${selectedDuration}s`;
            durationBtn.style.display = 'flex';
        } else {
            durationBtn.style.display = 'none';
        }

        // Resolution
        const resolutions = getCurrentResolutions(modelId);
        if (resolutions.length > 0) {
            selectedResolution = resolutions[0];
            document.getElementById('v-resolution-btn-label').textContent = selectedResolution;
            resolutionBtn.style.display = 'flex';
        } else {
            resolutionBtn.style.display = 'none';
        }

        // Quality
        const qualities = getQualitiesForModel(modelId);
        if (qualities.length > 0) {
            selectedQuality = model?.inputs?.quality?.default || qualities[0];
            document.getElementById('v-quality-btn-label').textContent = selectedQuality;
            qualityBtn.style.display = 'flex';
        } else {
            selectedQuality = '';
            qualityBtn.style.display = 'none';
        }

        // Extend banner (extend model only)
        if (model?.requiresRequestId) {
            extendBanner.classList.remove('hidden');
            extendBanner.classList.add('flex');
        } else {
            extendBanner.classList.add('hidden');
            extendBanner.classList.remove('flex');
        }

        if (dynamicControls) {
          const advModel = getAdvancedModel();
          if (advModel) dynamicControls.update(advModel);
        }
    };

    const showDropdown = (type, anchorBtn) => {
        dropdown.innerHTML = '';
        dropdown.classList.remove('opacity-0', 'pointer-events-none');
        dropdown.classList.add('opacity-100', 'pointer-events-auto');

        if (type === 'model') {
            dropdown.classList.add('w-[calc(100vw-2rem)]', 'md:w-[480px]', 'max-w-md');
            dropdown.classList.remove('max-w-xs', 'max-w-[240px]', 'max-w-[200px]');
            selectedProvider = 'all';

            const generationModels = [...t2vModels, ...i2vModels];
            const allCurrentModels = [...generationModels, ...v2vModels];
            const availableProviders = getAvailableProviders(allCurrentModels);

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

            const refresh = () => {
                sidebarEl.innerHTML = renderProviderSidebar(availableProviders, selectedProvider, (provider) => {
                    selectedProvider = provider;
                    refresh();
                });
                const query = searchInput ? searchInput.value : '';
                const filteredMain = filterModels(generationModels, query, selectedProvider);
                const filteredV2V = filterModels(v2vModels, query, selectedProvider);
                const showProviderName = selectedProvider === 'all';

                let html = `<div class="flex flex-col gap-1.5 overflow-y-auto custom-scrollbar pr-1 pb-2 flex-1">`;
                if (filteredMain.length === 0 && filteredV2V.length === 0) {
                    html += `<div class="text-xs text-white/30 text-center py-6">No models found</div>`;
                } else {
                    for (const m of filteredMain) {
                        const isSelected = m.id === selectedModel;
                        const itemClasses = isSelected ? 'bg-white/5 border-white/5' : 'border border-transparent hover:border-white/5';
                        const logoUrl = PROVIDER_LOGOS[m.provider];
                        const hasLogo = Boolean(logoUrl);
                        const iconHtml = hasLogo
                            ? `<div class="w-8 h-8 rounded-full border border-white/5 overflow-hidden shrink-0 flex items-center justify-center bg-white/[0.02]"><img src="${logoUrl}" alt="${m.provider_name || ''}" class="w-full h-full object-contain p-1 ${invertLogos.includes(m.provider) ? 'invert' : ''}" /></div>`
                            : `<div class="w-8 h-8 rounded-full border border-white/5 flex items-center justify-center font-bold text-xs shadow-inner uppercase ${(m.family === 'kontext' ? 'bg-blue-500/10 text-blue-400 border-blue-500/10' : m.family === 'effects' ? 'bg-purple-500/10 text-purple-400 border-purple-500/10' : 'bg-primary/10 text-primary border-primary/10')}">${(m.name || m.id).charAt(0)}</div>`;
                        const providerLabel = showProviderName && m.provider_name ? `<span class="text-[9px] text-white/40">${m.provider_name}</span>` : '';
                        const checkSvg = isSelected ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d9ff00" stroke-width="4"><polyline points="20 6 9 17 4 12" /></svg>' : '';

                        html += `<div data-model-id="${m.id}" class="flex items-center justify-between p-3 hover:bg-white/5 rounded-2xl cursor-pointer transition-all ${itemClasses}">`;
                        html += `<div class="flex items-center gap-3">${iconHtml}<div class="flex flex-col gap-0.5 min-w-0"><span class="text-xs font-bold text-white tracking-tight truncate">${m.name}</span>${providerLabel}</div></div>`;
                        html += checkSvg;
                        html += `</div>`;
                    }

                    if (filteredV2V.length > 0) {
                        html += `<div class="text-[10px] font-bold text-orange-400/70 px-3 py-2 mt-1 border-t border-white/5">Video Tools</div>`;
                        for (const m of filteredV2V) {
                            const isSelected = m.id === selectedModel;
                            const itemClasses = isSelected ? 'bg-white/5 border-white/5' : 'border border-transparent hover:border-white/5';
                            const logoUrl = PROVIDER_LOGOS[m.provider];
                            const hasLogo = Boolean(logoUrl);
                            const iconHtml = hasLogo
                                ? `<div class="w-8 h-8 rounded-full border border-white/5 overflow-hidden shrink-0 flex items-center justify-center bg-white/[0.02]"><img src="${logoUrl}" alt="${m.provider_name || ''}" class="w-full h-full object-contain p-1 ${invertLogos.includes(m.provider) ? 'invert' : ''}" /></div>`
                                : `<div class="w-8 h-8 rounded-full border border-white/5 flex items-center justify-center font-bold text-xs shadow-inner uppercase bg-primary/10 text-primary border-primary/10">${(m.name || m.id).charAt(0)}</div>`;
                            const checkSvg = isSelected ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d9ff00" stroke-width="4"><polyline points="20 6 9 17 4 12" /></svg>' : '';
                            const helperText = m.imageField ? 'Upload a video and image' : 'Upload a video to use';
                            const providerLabel = showProviderName && m.provider_name ? `<span class="text-[9px] text-white/40">${m.provider_name}</span>` : '';

                            html += `<div data-model-id="${m.id}" data-is-v2v="true" class="flex items-center justify-between p-3 hover:bg-white/5 rounded-2xl cursor-pointer transition-all ${itemClasses}">`;
                            html += `<div class="flex items-center gap-3">${iconHtml}<div class="flex flex-col gap-0.5 min-w-0"><span class="text-xs font-bold text-white tracking-tight truncate">${m.name}</span><span class="text-[9px] text-orange-400/70">${helperText}</span>${providerLabel}</div></div>`;
                            html += checkSvg;
                            html += `</div>`;
                        }
                    }
                }
                html += `</div>`;
                modelListEl.innerHTML = html;

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

            modelListEl.addEventListener('click', (e) => {
                const item = e.target.closest('[data-model-id]');
                if (!item) return;
                e.stopPropagation();
                const modelId = item.getAttribute('data-model-id');
                const isV2V = item.getAttribute('data-is-v2v') === 'true';
                const model = allCurrentModels.find(m => m.id === modelId);
                if (!model) return;

                if (isV2V) {
                    v2vMode = true;
                    imageMode = false;
                    picker.reset();
                    uploadedImageUrl = null;
                    selectedModel = model.id;
                    selectedModelName = model.name;
                    document.getElementById('v-model-btn-label').textContent = selectedModelName;
                    updateControlsForModel(selectedModel);
                    textarea.placeholder = 'Upload a video using the 🎥 button, then click Generate';
                    textarea.disabled = true;
                } else {
                    if (v2vMode) {
                        v2vMode = false;
                        uploadedVideoUrl = null;
                        showVideoIcon();
                        textarea.disabled = false;
                    }
                    selectedModel = model.id;
                    selectedModelName = model.name;
                    document.getElementById('v-model-btn-label').textContent = selectedModelName;
                    updateControlsForModel(selectedModel);
                    textarea.placeholder = imageMode ? 'Describe the motion or effect (optional)' : 'Describe the video you want to create';
                }
                updateModelBtnIcon();
                closeDropdown();
            });

        } else if (type === 'ar') {
            dropdown.classList.add('max-w-[240px]');
            dropdown.innerHTML = `<div class="text-[10px] font-bold text-muted uppercase tracking-widest px-3 py-2 border-b border-white/5 mb-2">Aspect Ratio</div>`;
            const list = document.createElement('div');
            list.className = 'flex flex-col gap-1';
            const availableArs = getCurrentAspectRatios(selectedModel);
            availableArs.forEach(r => {
                const item = document.createElement('div');
                item.className = 'flex items-center justify-between p-3.5 hover:bg-white/5 rounded-2xl cursor-pointer transition-all group';
                item.innerHTML = `
                    <div class="flex items-center gap-4">
                        <div class="w-6 h-6 border-2 border-white/20 rounded-md shadow-inner flex items-center justify-center group-hover:border-primary/50 transition-colors">
                             <div class="w-3 h-3 bg-white/10 rounded-sm"></div>
                        </div>
                        <span class="text-xs font-bold text-white opacity-80 group-hover:opacity-100 transition-opacity">${r}</span>
                    </div>
                     ${selectedAr === r ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d9ff00" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
                `;
                item.onclick = (e) => {
                    e.stopPropagation();
                    selectedAr = r;
                    document.getElementById('v-ar-btn-label').textContent = r;
                    closeDropdown();
                };
                list.appendChild(item);
            });
            dropdown.appendChild(list);

        } else if (type === 'duration') {
            dropdown.classList.add('max-w-[200px]');
            dropdown.innerHTML = `<div class="text-[10px] font-bold text-secondary uppercase tracking-widest px-3 py-2 border-b border-white/5 mb-2">Duration</div>`;
            const list = document.createElement('div');
            list.className = 'flex flex-col gap-1';
            const durations = getCurrentDurations(selectedModel);
            durations.forEach(d => {
                const item = document.createElement('div');
                item.className = 'flex items-center justify-between p-3.5 hover:bg-white/5 rounded-2xl cursor-pointer transition-all group';
                item.innerHTML = `
                    <span class="text-xs font-bold text-white opacity-80 group-hover:opacity-100">${d}s</span>
                     ${selectedDuration === d ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d9ff00" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
                `;
                item.onclick = (e) => {
                    e.stopPropagation();
                    selectedDuration = d;
                    document.getElementById('v-duration-btn-label').textContent = `${d}s`;
                    closeDropdown();
                };
                list.appendChild(item);
            });
            dropdown.appendChild(list);

        } else if (type === 'quality') {
            dropdown.classList.add('max-w-[200px]');
            dropdown.innerHTML = `<div class="text-[10px] font-bold text-secondary uppercase tracking-widest px-3 py-2 border-b border-white/5 mb-2">Quality</div>`;
            const list = document.createElement('div');
            list.className = 'flex flex-col gap-1';
            getQualitiesForModel(selectedModel).forEach(q => {
                const item = document.createElement('div');
                item.className = 'flex items-center justify-between p-3.5 hover:bg-white/5 rounded-2xl cursor-pointer transition-all group';
                item.innerHTML = `
                    <span class="text-xs font-bold text-white opacity-80 group-hover:opacity-100 capitalize">${q}</span>
                    ${selectedQuality === q ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d9ff00" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
                `;
                item.onclick = (e) => {
                    e.stopPropagation();
                    selectedQuality = q;
                    document.getElementById('v-quality-btn-label').textContent = q;
                    closeDropdown();
                };
                list.appendChild(item);
            });
            dropdown.appendChild(list);

        } else if (type === 'resolution') {
            dropdown.classList.add('max-w-[200px]');
            dropdown.innerHTML = `<div class="text-[10px] font-bold text-secondary uppercase tracking-widest px-3 py-2 border-b border-white/5 mb-2">Resolution</div>`;
            const list = document.createElement('div');
            list.className = 'flex flex-col gap-1';
            const resolutions = getCurrentResolutions(selectedModel);
            resolutions.forEach(r => {
                const item = document.createElement('div');
                item.className = 'flex items-center justify-between p-3.5 hover:bg-white/5 rounded-2xl cursor-pointer transition-all group';
                item.innerHTML = `
                    <span class="text-xs font-bold text-white opacity-80 group-hover:opacity-100">${r}</span>
                     ${selectedResolution === r ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d9ff00" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
                `;
                item.onclick = (e) => {
                    e.stopPropagation();
                    selectedResolution = r;
                    document.getElementById('v-resolution-btn-label').textContent = r;
                    closeDropdown();
                };
                list.appendChild(item);
            });
            dropdown.appendChild(list);
        }

        // Position dropdown
        const btnRect = anchorBtn.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        if (window.innerWidth < 768) {
            dropdown.style.left = '50%';
            dropdown.style.transform = 'translateX(-50%) translate(0, 8px)';
        } else {
            dropdown.style.left = `${btnRect.left - containerRect.left}px`;
            dropdown.style.transform = 'translate(0, 8px)';
        }
        dropdown.style.bottom = `${containerRect.bottom - btnRect.top + 8}px`;
    };

    const closeDropdown = () => {
        dropdown.classList.add('opacity-0', 'pointer-events-none');
        dropdown.classList.remove('opacity-100', 'pointer-events-auto');
        dropdownOpen = null;
        selectedProvider = 'all';
    };

    const toggleDropdown = (type, btn) => (e) => {
        e.stopPropagation();
        if (dropdownOpen === type) closeDropdown();
        else {
            dropdownOpen = type;
            if (type === 'model') selectedProvider = 'all';
            showDropdown(type, btn);
        }
    };

    arBtn.onclick = toggleDropdown('ar', arBtn);
    durationBtn.onclick = toggleDropdown('duration', durationBtn);
    resolutionBtn.onclick = toggleDropdown('resolution', resolutionBtn);
    qualityBtn.onclick = toggleDropdown('quality', qualityBtn);

    window.addEventListener('click', closeDropdown);
    container.appendChild(dropdown);

    // ==========================================
    // 4. CANVAS AREA + HISTORY
    // ==========================================
    const generationHistory = [];

    const historySidebar = document.createElement('div');
    historySidebar.className = 'fixed right-0 top-0 h-full w-20 md:w-24 bg-black/60 backdrop-blur-xl border-l border-white/5 z-50 flex flex-col items-center py-4 gap-3 overflow-y-auto transition-all duration-500 translate-x-full opacity-0';
    historySidebar.id = 'video-history-sidebar';

    const historyLabel = document.createElement('div');
    historyLabel.className = 'text-[9px] font-bold text-muted uppercase tracking-widest mb-2';
    historyLabel.textContent = 'History';
    historySidebar.appendChild(historyLabel);

    const historyList = document.createElement('div');
    historyList.className = 'flex flex-col gap-2 w-full px-2';
    historySidebar.appendChild(historyList);
    container.appendChild(historySidebar);

    // Main canvas
    const canvas = document.createElement('div');
    canvas.className = 'absolute inset-0 flex flex-col items-center justify-center p-4 min-[800px]:p-16 z-10 opacity-0 pointer-events-none transition-all duration-1000 translate-y-10 scale-95';
    canvas.setAttribute('role', 'status');
    canvas.setAttribute('aria-live', 'polite');

    const videoContainer = document.createElement('div');
    videoContainer.className = 'relative group';

    const resultVideo = document.createElement('video');
    resultVideo.className = 'max-h-[60vh] max-w-[80vw] rounded-3xl shadow-3xl border border-white/10 interactive-glow object-contain';
    resultVideo.controls = true;
    resultVideo.loop = true;
    resultVideo.autoplay = true;
    resultVideo.muted = true;
    resultVideo.playsInline = true;
    videoContainer.appendChild(resultVideo);

    // Frame scrubber
    const scrubberRow = document.createElement('div');
    scrubberRow.className = 'w-full max-w-[80vw] mt-3 flex items-center gap-3';
    const scrubberLabel = document.createElement('span');
    scrubberLabel.className = 'text-[10px] font-bold text-secondary uppercase tracking-wider whitespace-nowrap';
    scrubberLabel.textContent = 'Frame';
    const scrubber = document.createElement('input');
    scrubber.type = 'range';
    scrubber.min = '0';
    scrubber.max = '100';
    scrubber.step = '0.1';
    scrubber.value = '0';
    scrubber.className = 'flex-1 accent-primary h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer';
    scrubber.setAttribute('aria-label', 'Video frame scrubber');
    const scrubberTime = document.createElement('span');
    scrubberTime.className = 'text-[10px] font-mono text-muted w-16 text-right';
    scrubberTime.textContent = '0:00';
    scrubberRow.appendChild(scrubberLabel);
    scrubberRow.appendChild(scrubber);
    scrubberRow.appendChild(scrubberTime);

    function updateScrubberFromVideo() {
        if (!resultVideo.duration) return;
        const pct = (resultVideo.currentTime / resultVideo.duration) * 100;
        scrubber.value = String(pct);
        const m = Math.floor(resultVideo.currentTime / 60);
        const s = Math.floor(resultVideo.currentTime % 60);
        scrubberTime.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    }

    resultVideo.addEventListener('timeupdate', updateScrubberFromVideo);
    resultVideo.addEventListener('loadedmetadata', () => {
        scrubber.max = '100';
        scrubber.value = '0';
        scrubberTime.textContent = '0:00';
    });

    scrubber.addEventListener('input', () => {
        if (!resultVideo.duration) return;
        const pct = parseFloat(scrubber.value);
        resultVideo.currentTime = (pct / 100) * resultVideo.duration;
    });

    videoContainer.appendChild(scrubberRow);

    // Canvas Controls
    const canvasControls = document.createElement('div');
    canvasControls.className = 'mt-6 flex gap-3 opacity-0 transition-opacity delay-500 duration-500 justify-center';

    const regenerateBtn = document.createElement('button');
    regenerateBtn.className = 'bg-white/10 hover:bg-white/20 px-6 py-2.5 rounded-2xl text-xs font-bold transition-all border border-white/5 backdrop-blur-lg text-white';
    regenerateBtn.textContent = '↻ Regenerate';

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'bg-primary text-black px-6 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-glow active:scale-95';
    downloadBtn.textContent = '↓ Download';

    const extendBtn = document.createElement('button');
    extendBtn.className = 'hidden bg-white/10 hover:bg-white/20 px-6 py-2.5 rounded-2xl text-xs font-bold transition-all border border-primary/30 text-primary backdrop-blur-lg';
    extendBtn.textContent = '↗ Extend';
    extendBtn.title = 'Extend this video using Seedance 2.0 Extend';

    const newPromptBtn = document.createElement('button');
    newPromptBtn.className = 'bg-white/10 hover:bg-white/20 px-6 py-2.5 rounded-2xl text-xs font-bold transition-all border border-white/5 backdrop-blur-lg text-white';
    newPromptBtn.textContent = '+ New';

    const renderBtn = document.createElement('button');
    renderBtn.className = 'bg-emerald-500 text-black px-6 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-glow active:scale-95';
    renderBtn.textContent = '🎬 Open in Render';

    canvasControls.appendChild(regenerateBtn);
    canvasControls.appendChild(extendBtn);
    canvasControls.appendChild(downloadBtn);
    canvasControls.appendChild(renderBtn);
    canvasControls.appendChild(newPromptBtn);

    canvas.appendChild(videoContainer);
    canvas.appendChild(canvasControls);
    container.appendChild(canvas);

    // --- Helper: Show video in canvas ---
    const showVideoInCanvas = (videoUrl, genModel) => {
        hero.classList.add('hidden');
        promptWrapper.classList.add('hidden');

        // Show extend button only for seedance-v2.0-t2v and i2v (not extend itself)
        const isSeedance2 = genModel && (genModel === 'seedance-v2.0-t2v' || genModel === 'seedance-v2.0-i2v');
        extendBtn.classList.toggle('hidden', !isSeedance2);

        resultVideo.src = videoUrl;
        resultVideo.onloadeddata = () => {
            canvas.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-10', 'scale-95');
            canvas.classList.add('opacity-100', 'translate-y-0', 'scale-100');
            canvasControls.classList.remove('opacity-0');
            canvasControls.classList.add('opacity-100');
        };
    };

    // --- Helper: Add to history ---
    const addToHistory = (entry) => {
        generationHistory.unshift(entry);
        try {
            localStorage.setItem('video_history', JSON.stringify(generationHistory.slice(0, 30)));
        } catch (e) {
            // Ignore storage errors (private mode, quota exceeded, etc.)
        }
        historySidebar.classList.remove('translate-x-full', 'opacity-0');
        historySidebar.classList.add('translate-x-0', 'opacity-100');
        renderHistory();
    };

    const renderHistory = () => {
        historyList.innerHTML = '';
        generationHistory.forEach((entry, idx) => {
            const thumb = document.createElement('div');
            thumb.className = `relative group/thumb cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-300 ${idx === 0 ? 'border-primary shadow-glow' : 'border-white/10 hover:border-white/30'}`;

            // Safe video creation - prevents XSS from user-provided URLs
            const video = createSafeVideo(entry.url, 'w-full aspect-square object-cover');
            video.preload = 'metadata';
            thumb.appendChild(video);

            // Create overlay with download button
            const overlay = document.createElement('div');
            overlay.className = 'absolute inset-0 bg-black/60 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center gap-1';
            
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'hist-download p-1.5 bg-primary rounded-lg text-black hover:scale-110 transition-transform';
            downloadBtn.title = 'Download';
            downloadBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>';
            overlay.appendChild(downloadBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'hist-delete p-1.5 bg-red-500/80 rounded-lg text-white hover:scale-110 transition-transform';
            deleteBtn.title = 'Delete';
            deleteBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>';
            deleteBtn.onclick = (e) => {
              e.stopPropagation();
              generationHistory.splice(idx, 1);
              try { localStorage.setItem('video_history', JSON.stringify(generationHistory.slice(0, 100))); } catch {}
              renderHistory();
            };
            overlay.appendChild(deleteBtn);
            thumb.appendChild(overlay);

            thumb.onclick = (e) => {
                if (e.target.closest('.hist-download')) {
                    downloadFile(entry.url, `video-${entry.id || idx}.mp4`);
                    return;
                }
                // Restore extend context when viewing a seedance-v2.0 generation
                if (entry.model === 'seedance-v2.0-t2v' || entry.model === 'seedance-v2.0-i2v') {
                    lastGenerationId = entry.id;
                    lastGenerationModel = entry.model;
                } else {
                    lastGenerationId = null;
                    lastGenerationModel = null;
                }
                showVideoInCanvas(entry.url, entry.model);
                historyList.querySelectorAll('div').forEach(t => {
                    t.classList.remove('border-primary', 'shadow-glow');
                    t.classList.add('border-white/10');
                });
                thumb.classList.remove('border-white/10');
                thumb.classList.add('border-primary', 'shadow-glow');
            };

            historyList.appendChild(thumb);
        });
    };

    // --- Helper: Download file ---
    const downloadFile = async (url, filename) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        } catch (err) {
            window.open(url, '_blank');
        }
    };

    // --- Load history from localStorage ---
    try {
        const saved = JSON.parse(localStorage.getItem('video_history') || '[]');
        if (saved.length > 0) {
            saved.forEach(e => generationHistory.push(e));
            historySidebar.classList.remove('translate-x-full', 'opacity-0');
            historySidebar.classList.add('translate-x-0', 'opacity-100');
            renderHistory();
        }
    } catch (e) { /* ignore */ }

    // --- Button Handlers ---
    downloadBtn.onclick = () => {
        const current = resultVideo.src;
        if (current) {
            const entry = generationHistory.find(e => e.url === current);
            downloadFile(current, `video-${entry?.id || 'clip'}.mp4`);
        }
    };

    regenerateBtn.onclick = () => generateBtn.click();

    // Open in Render: persist the current generation to the asset store
    // (async/IndexedDB-backed) and hand its id to the Render studio. No video
    // is ever silently dropped — if the save fails, we stay here and report it.
    let currentAssetId = null;
    renderBtn.onclick = async () => {
        if (!(await requireEntitlement())) return;
        const current = resultVideo.src;
        if (!current) return;
        const entry = generationHistory.find(e => e.url === current);
        renderBtn.disabled = true;
        renderBtn.textContent = '🎬 Saving…';
        try {
            const asset = await saveGeneratedAsset('video', {
                title: entry?.prompt ? entry.prompt.slice(0, 80) : 'Video Studio generation',
                media: { url: current, type: 'video' },
                metadata: { prompt: entry?.prompt || '', model: entry?.model || selectedModel, aspect_ratio: entry?.aspect_ratio, duration: entry?.duration },
                sourceApp: 'video-studio',
            }, 'video-studio');
            currentAssetId = asset && asset.id;
            navigate('render', { asset: currentAssetId });
        } catch (err) {
            console.error('[VideoStudio] Failed to save asset for Render:', err);
            alert(`Could not open in Render: ${err.message}`);
            renderBtn.disabled = false;
            renderBtn.textContent = '🎬 Open in Render';
        }
    };

    const resetToPromptBar = () => {
        canvas.classList.add('opacity-0', 'pointer-events-none', 'translate-y-10', 'scale-95');
        canvas.classList.remove('opacity-100', 'translate-y-0', 'scale-100');
        canvasControls.classList.add('opacity-0');
        canvasControls.classList.remove('opacity-100');
        hero.classList.remove('hidden', 'opacity-0', 'scale-95', '-translate-y-10', 'pointer-events-none');
        promptWrapper.classList.remove('hidden', 'opacity-40');
        generationError = null;
        hideInlineError(container);
    };

    newPromptBtn.onclick = () => {
        resetToPromptBar();
        textarea.value = '';
        picker.reset();
        uploadedImageUrl = null;
        imageMode = false;
        uploadedVideoUrl = null;
        v2vMode = false;
        showVideoIcon();
        selectedModel = t2vModels[0].id;
        selectedModelName = t2vModels[0].name;
        refreshVideoModelSelector();
        updateControlsForModel(selectedModel);
        textarea.placeholder = 'Describe the video you want to create';
        textarea.disabled = false;
        textarea.focus();
        generateBtn.disabled = false;
        generateBtn.innerHTML = `Generate ✨`;
        generateBtn.classList.remove('border-red-500/50');
    };

    extendBtn.onclick = () => {
        if (!lastGenerationId) return;
        resetToPromptBar();
        textarea.value = '';
        picker.reset();
        uploadedImageUrl = null;
        imageMode = false;
        selectedModel = 'seedance-v2.0-extend';
        selectedModelName = 'Seedance 2.0 Extend';
        document.getElementById('v-model-btn-label').textContent = selectedModelName;
        updateModelBtnIcon();
        updateControlsForModel(selectedModel);
        textarea.placeholder = 'Optional: describe how to continue the video...';
        textarea.focus();
    };

    // ==========================================
    // 5. GENERATION LOGIC
    // ==========================================
    generateBtn.onclick = async () => {
        if (!(await requireEntitlement())) return;

        // If generation is already loading, do nothing (cancel button handles abort)
        if (isLoading) return;

        // If there was a previous generation error, reset state before starting new generation
        if (generationError) {
            generationError = null;
            hideInlineError(container);
        }

        let prompt = textarea.value.trim();
        const model = getCurrentModel();
        const isExtendMode = model?.requiresRequestId;

        // Enrich prompt with contact intelligence if a contact is selected
        // (same contact logic as before)
        // Build cinematic prompt modifiers from motion/style controls
        const CAMERA_MOVEMENT_MAP = {
            'Static': 'static locked-off shot',
            'Pan': 'slow horizontal pan across the scene',
            'Tilt': 'vertical tilt movement',
            'Zoom In': 'slow zoom in toward the subject',
            'Zoom Out': 'slow zoom out revealing the scene',
            'Dolly In': 'cinematic dolly in toward the subject',
            'Dolly Out': 'cinematic dolly out revealing the scene',
            'Crane Up': 'cinematic crane shot moving upward',
            'Orbit': 'smooth 360 orbit around the subject',
            'FPV Drone': 'immersive FPV drone fly-through',
            'Handheld': 'subtle handheld camera movement',
            'Dolly Zoom': 'Hitchcock dolly zoom (vertigo effect)',
        };
        const motionModifiers = [];
        if (cameraMovement && cameraMovement !== 'Static') {
            const movementDesc = CAMERA_MOVEMENT_MAP[cameraMovement] || cameraMovement;
            motionModifiers.push(movementDesc);
        }
        if (motionStrength > 0) {
            const intensity = motionStrength <= 30 ? 'subtle' : motionStrength <= 70 ? 'moderate' : 'intense';
            motionModifiers.push(`${intensity} motion intensity (${motionStrength}%)`);
        }
        if (cameraSpeed > 0 && cameraMovement !== 'Static') {
            const speedDesc = cameraSpeed <= 3 ? 'slow' : cameraSpeed <= 7 ? 'medium' : 'fast';
            motionModifiers.push(`${speedDesc} camera speed (${cameraSpeed}/10)`);
        }
        if (selectedStyle && selectedStyle !== 'None') {
            motionModifiers.push(`${selectedStyle.toLowerCase()} style`);
        }

        let enrichedPrompt = prompt;
        if (motionModifiers.length > 0 && !isExtendMode && !v2vMode) {
            const motionPromptPart = motionModifiers.join(', ');
            if (prompt) {
                enrichedPrompt = `${prompt}, ${motionPromptPart}`;
            } else {
                enrichedPrompt = motionPromptPart;
            }
        }
        const selectedContactId = (() => {
            try { return localStorage.getItem('remix_selected_contact_id'); } catch { return null; }
        })();
        let activeProfile = null;
        if (selectedContactId && !v2vMode) {
            try {
                const profiles = JSON.parse(localStorage.getItem('remix_contact_profiles') || '[]');
                activeProfile = profiles.find((p) => p.id === selectedContactId) || null;

                // Step 1: Replace any {{token}} placeholders the user inserted via the
                // personalize popover. This gives the user fine-grained control over
                // what gets injected (firstName, company, painPoint, etc.) and where
                // in the prompt it lands.
                if (prompt && activeProfile) {
                    prompt = replaceTokensInPrompt(prompt, activeProfile);
                }

                if (activeProfile) {
                    const contact = activeProfile.contact || {};
                    const intel = activeProfile.intelligence || {};
                    const brand = activeProfile.brand || {};
                    const assets = activeProfile.assets || {};

                    // Step 2: If the user did NOT insert any tokens, fall back to a
                    // prepended context block that summarizes the discovered data.
                    // If they DID insert tokens, the resolved prompt is already
                    // personalized — don't double-inject the summary block.
                    const hadTokens = /\{\{[^}]+\}\}/.test(textarea.value);
                    if (!hadTokens) {
                        const contextParts = [];
                        if (contact.firstName) contextParts.push(`Personalized for ${contact.firstName}${contact.company ? ` at ${contact.company}` : ''}`);
                        if (intel.summary) contextParts.push(`Context: ${intel.summary}`);
                        if (intel.painPoints?.length) contextParts.push(`Pain points: ${intel.painPoints.join(', ')}`);
                        if (intel.products?.length) contextParts.push(`Products: ${intel.products.join(', ')}`);
                        if (intel.tone) contextParts.push(`Tone: ${intel.tone}`);
                        if (brand.colors?.primary) contextParts.push(`Brand color: ${brand.colors.primary}`);

                        if (contextParts.length > 0 && prompt) {
                            prompt = `[${contextParts.join('. ')}] ${prompt}`;
                        } else if (contextParts.length > 0) {
                            prompt = contextParts.join('. ');
                        }
                    }

                    // Offer reference image if available
                    if (!uploadedImageUrl && assets.avatar?.[0] && imageMode === false) {
                        // For t2v, we can't easily inject a reference image without switching mode,
                        // but we can note it in the prompt
                        if (!prompt.includes('avatar') && !prompt.includes('portrait')) {
                            prompt += `. Reference style: portrait of ${contact.firstName || 'the contact'}.`;
                        }
                    }

                    // Record this generation against the contact's history (server-side; local fallback)
                    try {
                        const history = activeProfile.history || { discoveries: [], generations: [], interactions: [] };
                        history.generations = history.generations || [];
                        history.generations.unshift({ prompt, model: selectedModel, timestamp: new Date().toISOString() });
                        history.generations = history.generations.slice(0, 20);
                        activeProfile.history = history;
                        activeProfile.updatedAt = new Date().toISOString();
                        const allProfiles = JSON.parse(localStorage.getItem('remix_contact_profiles') || '[]');
                        const idx = allProfiles.findIndex(p => p.id === selectedContactId);
                        if (idx >= 0) {
                            allProfiles[idx] = activeProfile;
                            localStorage.setItem('remix_contact_profiles', JSON.stringify(allProfiles));
                        }
                    } catch {}
                }
            } catch {}
        }

        if (v2vMode) {
            if (!uploadedVideoUrl) {
                showInlineError(container, 'Please upload a video first.');
                return;
            }
        } else if (isExtendMode) {
            if (!lastGenerationId) {
                showInlineError(container, 'No Seedance 2.0 generation found to extend. Generate a video first.');
                return;
            }
        } else if (imageMode) {
            if (!uploadedImageUrl) {
                showInlineError(container, 'Please upload a start frame image first.');
                return;
            }
        } else {
            if (!prompt) {
                showInlineError(container, 'Please enter a prompt to generate a video.');
                return;
            }
        }

        const apiKey = apiKeyManager.getKey();
        if (!apiKey) {
            AuthModal(() => generateBtn.click());
            return;
        }

        // --- Show loading overlay with progress + cancel button ---
        isLoading = true;
        hero.classList.add('opacity-0', 'scale-95', '-translate-y-10', 'pointer-events-none');

        abortController = new AbortController();
        const { controller, showCancel, reset: resetCancel } = createAbortAwareGenerate(generateBtn);
        abortController = controller;

        loadingOverlay = createLoadingOverlay('Generating video...');
        const progressBar = createProgressBar(0);
        loadingOverlay.appendChild(progressBar);
        container.appendChild(loadingOverlay);
        progressHandle = startGenerationProgress({
            parent: loadingOverlay,
            type: 'video',
            message: 'Generating video (this may take a few minutes)...'
        });
        showCancel();

        // Simulate indeterminate progress since API does not expose progress
        let simulatedProgress = 0;
        const progressInterval = setInterval(() => {
            if (abortController.signal.aborted) return;
            simulatedProgress = Math.min(simulatedProgress + Math.random() * 3, 90);
            if (progressBar.setProgress) progressBar.setProgress(simulatedProgress);
        }, 1500);

        try {
            if (v2vMode) {
                const v2vParams = { model: selectedModel, video_url: uploadedVideoUrl, signal: abortController.signal };
                if (customThumbnailUrl) v2vParams.thumbnail_url = customThumbnailUrl;
                const res = await muapi.processV2V(v2vParams);
                console.log('[VideoStudio] V2V response:', res);
                if (res && res.url) {
                    const genId = res.id || res.request_id || Date.now().toString();
                    lastGenerationId = null;
                    lastGenerationModel = null;
                    addToHistory({ id: genId, url: res.url, prompt: '', model: selectedModel, timestamp: new Date().toISOString() });
                    showVideoInCanvas(res.url, selectedModel);
                } else {
                    throw new Error('No video URL returned by API');
                }
            } else if (imageMode) {
                const i2vParams = {
                    model: selectedModel,
                    image_url: uploadedImageUrl,
                    signal: abortController.signal,
                };
                if (prompt) i2vParams.prompt = prompt;
                const isWanI2V = selectedModel === 'wan2.1-image-to-video' || selectedModel === 'wan2.5-image-to-video';
                if (!isWanI2V && customThumbnailUrl) i2vParams.thumbnail_url = customThumbnailUrl;
                const advancedPayload = dynamicControls ? dynamicControls.getPayload() : {};
                if (!isWanI2V && advancedPayload.negative_prompt) i2vParams.negative_prompt = advancedPayload.negative_prompt;
                if (!isWanI2V && advancedPayload.seed) i2vParams.seed = advancedPayload.seed;
                const durations = getCurrentDurations(selectedModel);
                if (durations.length > 0) i2vParams.duration = selectedDuration;
                const resolutions = getCurrentResolutions(selectedModel);
                if (resolutions.length > 0) i2vParams.resolution = selectedResolution;

                const res = await muapi.generateI2V(i2vParams);
                console.log('[VideoStudio] I2V response:', res);

                if (res && res.url) {
                    const genId = res.id || res.request_id || Date.now().toString();
                    if (selectedModel === 'seedance-v2.0-i2v') {
                        lastGenerationId = genId;
                        lastGenerationModel = selectedModel;
                    } else {
                        lastGenerationId = null;
                        lastGenerationModel = null;
                    }
                    addToHistory({ id: genId, url: res.url, prompt: enrichedPrompt, model: selectedModel, aspect_ratio: selectedAr, duration: selectedDuration, timestamp: new Date().toISOString() });
                    showVideoInCanvas(res.url, selectedModel);
                } else {
                    throw new Error('No video URL returned by API');
                }
                generateBtn.disabled = false;
                generateBtn.innerHTML = `Generate ✨`;
                return;
            }

            const params = { model: selectedModel };

            if (customThumbnailUrl) params.thumbnail_url = customThumbnailUrl;
            if (prompt) params.prompt = prompt;
            const advancedPayload = dynamicControls ? dynamicControls.getPayload() : {};
            if (advancedPayload.negative_prompt) params.negative_prompt = advancedPayload.negative_prompt;
            if (advancedPayload.seed) params.seed = advancedPayload.seed;

            // Extend mode: pass stored request_id, skip aspect_ratio
            if (isExtendMode) {
                params.request_id = lastGenerationId;
            } else {
                const params = { model: selectedModel, signal: abortController.signal };

                if (customThumbnailUrl) params.thumbnail_url = customThumbnailUrl;
                if (enrichedPrompt) params.prompt = enrichedPrompt;
                if (negativePrompt) params.negative_prompt = negativePrompt;
                if (seed && seed !== -1) params.seed = seed;
                if (guidanceScale && guidanceScale !== 7.5) params.guidance_scale = guidanceScale;

                // Extend mode: pass stored request_id, skip aspect_ratio
                if (isExtendMode) {
                    params.request_id = lastGenerationId;
                } else {
                    params.aspect_ratio = selectedAr;
                }

                const durations = getCurrentDurations(selectedModel);
                if (durations.length > 0) params.duration = selectedDuration;

                const resolutions = getCurrentResolutions(selectedModel);
                if (resolutions.length > 0) params.resolution = selectedResolution;

                if (selectedQuality) params.quality = selectedQuality;

                const res = await muapi.generateVideo(params);

                console.log('[VideoStudio] Full response:', res);

                if (res && res.url) {
                    const genId = res.id || res.request_id || Date.now().toString();
                    if (selectedModel === 'seedance-v2.0-t2v' || selectedModel === 'seedance-v2.0-i2v') {
                        lastGenerationId = genId;
                        lastGenerationModel = selectedModel;
                    } else {
                        lastGenerationId = null;
                        lastGenerationModel = null;
                    }

                    addToHistory({
                        id: genId,
                        url: res.url,
                        prompt: enrichedPrompt,
                        model: selectedModel,
                        aspect_ratio: selectedAr,
                        duration: selectedDuration,
                        timestamp: new Date().toISOString()
                    });
                    showVideoInCanvas(res.url, selectedModel);
                } else {
                    console.error('[VideoStudio] No video URL in response:', res);
                    throw new Error('No video URL returned by API');
                }
            }
        } catch (e) {
            const { message } = categorizeGenerationError(e);
            generationError = message;
            showInlineError(container, message, 0);
            resetCancel();
            generateBtn.disabled = false;
            generateBtn.innerHTML = `↻ Retry`;
            generateBtn.classList.add('border-red-500/50');
            return;
        } finally {
            clearInterval(progressInterval);
            if (progressHandle) { progressHandle.stop(); progressHandle = null; }
            if (loadingOverlay && loadingOverlay.parentNode) { loadingOverlay.remove(); loadingOverlay = null; }
            resetCancel();
            isLoading = false;
            abortController = null;
            if (!generationError) {
                generateBtn.disabled = false;
                generateBtn.innerHTML = `Generate ✨`;
            }
        }
    };

    return container;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function extractLastFrame(file) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.muted = true;
        video.crossOrigin = 'anonymous';
        video.preload = 'metadata';
        const url = URL.createObjectURL(file);
        video.src = url;

        video.onloadedmetadata = () => {
            video.currentTime = video.duration;
        };

        video.onseeked = () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 1280;
            canvas.height = video.videoHeight || 720;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const frameUrl = canvas.toDataURL('image/png');
            URL.revokeObjectURL(url);
            resolve(frameUrl);
        };

        video.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load video for frame extraction'));
        };

        setTimeout(() => {
            URL.revokeObjectURL(url);
            reject(new Error('Frame extraction timed out'));
        }, 30000);
    });
}

async function getSession() {
    try {
        const { createClient } = await import('../lib/supabase.js');
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        return data.session;
    } catch {
        return null;
    }
}
