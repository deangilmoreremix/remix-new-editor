import { muapi } from '../lib/muapi.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import { requireEntitlement } from '../lib/clerkEntitlements.js';
import { createSafeImage } from '../lib/security.js';
import {
    t2iModels, getAspectRatiosForModel, getResolutionsForModel, getQualityFieldForModel,
    i2iModels, getAspectRatiosForI2IModel, getResolutionsForI2IModel, getQualityFieldForI2IModel,
    getMaxImagesForI2IModel, getModelById
} from '../lib/models.js';
import { ENHANCE_TAGS, QUICK_PROMPTS } from '../lib/promptUtils.js';
import { AuthModal } from './AuthModal.js';
import { createUploadPicker } from './UploadPicker.js';
import { createInlineInstructions } from './InlineInstructions.js';
import { createHeroSection, getCustomThumbnailFromCache, saveCustomThumbnailToCache, clearCustomThumbnailCache } from '../lib/thumbnails.js';
import { mountPersonalizePopover, replaceTokensInPrompt } from './personalize/personalizePopover.js';
import { TemplateThumbnailModal, mountThumbnailModal } from './modals/TemplateThumbnailModal.jsx';
import { subscribeToGtmThumbnails } from '../lib/gtmThumbnailBridge.js';
import { getGtmContext } from '../lib/gtmContextStore.js';
import { openSocialPublish } from '../lib/socialPublishHelpers.js';
import { mountModelSelector, PROVIDER_LOGOS, invertLogos, getProviderStyle } from '../lib/modelSelectorUI.js';
import { createAdvancedControls } from '../lib/studioControls.js';
import { getExtendedModel } from '../lib/modelInputExtensions.js';
import { getAssetsForStudio } from '../data/exampleGalleryAssets.js';
import ExampleGallery from './studios/ExampleGallery.js';
import { resolveTemplate, loadTemplatePrompt } from '../lib/showcaseTemplateResolver.js';
import { getAcademyCreateTarget } from '../data/academyStudioAdapters.js';

export function ImageStudio() {
    const container = document.createElement('div');
    container.className = 'w-full h-full flex flex-col items-center justify-start bg-app-bg relative p-4 md:p-6 overflow-y-auto custom-scrollbar overflow-x-hidden';
  mountStudioChrome(container, { currentRoute: 'image' });

    // --- State ---
    const defaultModel = t2iModels[0];
    let selectedModel = defaultModel.id;
    let selectedModelName = defaultModel.name;
    let selectedAr = defaultModel.inputs?.aspect_ratio?.default || '1:1';
    let dropdownOpen = null;
    let selectedProvider = 'all';
    let uploadedImageUrls = []; // array of uploaded image URLs (multi-image support)
    let imageMode = false; // false = t2i models, true = i2i models
    let customThumbnailUrl = getCustomThumbnailFromCache('image-studio');

    // Restore the last GTM context the user picked in the prompt modal,
    // if any. The modal persists selections to localStorage on apply; we
    // log them here so downstream features (defaults, preselects) can
    // pick them up later. The `void` keeps the variable from being
    // flagged as unused until something consumes it.
    try {
      const restoredGtmContext = getGtmContext('image-studio');
      if (restoredGtmContext && typeof console !== 'undefined' && console.info) {
        console.info('[ImageStudio] Restored GTM context', restoredGtmContext);
      }
      void restoredGtmContext;
    } catch { /* ignore */ }
    
    // Advanced parameters state
    let negativePrompt = '';
    let guidanceScale = 7.5;
    let steps = 25;
    let seed = -1;
    let showAdvanced = false;
    let selectedStyle = 'None';
    let batchCount = 1;
    
    // New advanced controls
    let customWidth = 0;  // 0 means use default (aspect ratio based)
    let customHeight = 0;
    let referenceStrength = 50;  // 0-100, for style reference models
    let selectedLora = '';  // LoRA model ID from Civitai
    let loraWeight = 1.0;
    
    // Quick tools panel state
    let showToolsPanel = false;

    // Read gallery / deep-link params and apply them as studio defaults.
    (async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const templateParam = urlParams.get('template');
        const academyParam = urlParams.get('academy-template');
        const promptParam = urlParams.get('prompt');
        const styleParam = urlParams.get('style');
        const arParam = urlParams.get('aspect_ratio');

        if (templateParam) {
          const tpl = resolveTemplate(templateParam);
          if (tpl) {
            // If the template's model is not an image model, redirect to
            // TemplateStudio instead of rendering a blank ImageStudio.
            const imageModelIds = new Set([...t2iModels, ...i2iModels].map(m => m.id));
            if (tpl.model && !imageModelIds.has(tpl.model)) {
              window.location.assign(`/?template=${encodeURIComponent(templateParam)}#/template/${encodeURIComponent(templateParam)}`);
              return;
            }
            if (tpl.model) selectedModel = tpl.model;
            if (tpl.aspectRatio) selectedAr = tpl.aspectRatio;
            if (tpl.basePrompt) {
              const textarea = document.getElementById('prompt-textarea');
              if (textarea) textarea.value = tpl.basePrompt;
            } else if (tpl.slug) {
              loadTemplatePrompt(templateParam)
                .then((prompt) => {
                  if (prompt) {
                    const textarea = document.getElementById('prompt-textarea');
                    if (textarea) textarea.value = prompt;
                  }
                })
                .catch(() => {});
            }
          }
        }

        if (academyParam || promptParam) {
          const target = academyParam ? getAcademyCreateTarget(academyParam) : null;
          const params = target?.params || {};
          if (params.prompt) {
            const textarea = document.getElementById('prompt-textarea');
            if (textarea) textarea.value = params.prompt;
          }
          if (params.style) selectedStyle = params.style;
          if (params.aspect_ratio) selectedAr = params.aspect_ratio;
        }
      } catch { /* ignore */ }
    })();

    const getCurrentModels = () => imageMode ? i2iModels : t2iModels;
    const getCurrentAspectRatios = (id) => imageMode ? getAspectRatiosForI2IModel(id) : getAspectRatiosForModel(id);
    const getCurrentResolutions = (id) => imageMode ? getResolutionsForI2IModel(id) : getResolutionsForModel(id);
    const getCurrentQualityField = (id) => imageMode ? getQualityFieldForI2IModel(id) : getQualityFieldForModel(id);

    // ==========================================
    // 1. HERO SECTION
    // ==========================================
    const hero = document.createElement('div');
    hero.className = 'flex flex-col items-center mb-2 md:mb-4 animate-fade-in-up transition-all duration-700 w-full';
    const heroBanner = createHeroSection('image', 'h-32 md:h-44 mb-3');
    if (heroBanner) {
        const heroContent = document.createElement('div');
        heroContent.className = 'absolute bottom-0 left-0 right-0 p-6 z-10';
        heroContent.innerHTML = `
            <h1 class="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-1">Image Studio</h1>
            <p class="text-white/60 text-sm font-medium">Transform images with AI — upscale, stylize, animate and more</p>
        `;
        heroBanner.appendChild(heroContent);
        hero.appendChild(heroBanner);
    }

    container.appendChild(hero);

    // ==========================================
    // 2. PROMPT BAR (Tailwind Refactor)
    // ==========================================
    const promptWrapper = document.createElement('div');
    promptWrapper.className = 'w-full relative z-40 animate-fade-in-up';
    promptWrapper.style.animationDelay = '0.2s';

    const bar = document.createElement('div');
    bar.className = 'w-full bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-[1.5rem] md:rounded-[2.5rem] p-3 md:p-5 flex flex-col gap-3 md:gap-5 shadow-3xl';

    // Top Row: Input
    const topRow = document.createElement('div');
    topRow.className = 'flex items-start gap-5 px-2';

    // --- Image Upload Picker (Image-to-Image) ---
    const picker = createUploadPicker({
        anchorContainer: container,
        onSelect: ({ url, urls }) => {
            uploadedImageUrls = urls || [url];
            if (!imageMode) {
                imageMode = true;
                selectedModel = i2iModels[0].id;
                selectedModelName = i2iModels[0].name;
                selectedAr = getAspectRatiosForI2IModel(selectedModel)[0];
                document.getElementById('model-btn-label').textContent = selectedModelName;
                document.getElementById('ar-btn-label').textContent = selectedAr;
                updateModelBtnIcon();
                const validResolutions = getResolutionsForI2IModel(selectedModel);
                qualityBtn.style.display = validResolutions.length > 0 ? 'flex' : 'none';
                if (validResolutions.length > 0) document.getElementById('quality-btn-label').textContent = validResolutions[0];
                picker.setMaxImages(getMaxImagesForI2IModel(selectedModel));
            }
            textarea.placeholder = uploadedImageUrls.length > 1
                ? `${uploadedImageUrls.length} images selected — describe the transformation (optional)`
                : 'Describe how to transform this image (optional)';
        },
        onClear: () => {
            uploadedImageUrls = [];
            imageMode = false;
            selectedModel = t2iModels[0].id;
            selectedModelName = t2iModels[0].name;
            selectedAr = getAspectRatiosForModel(selectedModel)[0];
            document.getElementById('model-btn-label').textContent = selectedModelName;
            document.getElementById('ar-btn-label').textContent = selectedAr;
            updateModelBtnIcon();
            const t2iResolutions = getResolutionsForModel(selectedModel);
            qualityBtn.style.display = t2iResolutions.length > 0 ? 'flex' : 'none';
            if (t2iResolutions.length > 0) document.getElementById('quality-btn-label').textContent = t2iResolutions[0];
            picker.setMaxImages(1);
            textarea.placeholder = 'Describe the image you want to create';
        }
    });
    topRow.appendChild(picker.trigger);

    // Pexels browse button — opens stock media browser for reference images
    const pexelsBtn = document.createElement('button');
    pexelsBtn.type = 'button';
    pexelsBtn.className = 'w-10 h-10 shrink-0 rounded-xl border transition-all flex items-center justify-center bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40 group relative overflow-hidden';
    pexelsBtn.title = 'Browse stock photos from Pexels';
    pexelsBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-secondary group-hover:text-primary"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>';
    pexelsBtn.onclick = async () => {
      const { browsePexelsImages } = await import('../lib/studioPexels.js');
      browsePexelsImages({
        title: 'Select Reference Photo',
        studioName: 'Image Studio',
        onSelect: (asset) => {
          uploadedImageUrls = [asset.src?.large || asset.url || asset.original];
          if (!imageMode) {
            imageMode = true;
            selectedModel = i2iModels[0]?.id || selectedModel;
            selectedModelName = i2iModels[0]?.name || selectedModelName;
            selectedAr = getAspectRatiosForI2IModel(selectedModel)?.[0] || selectedAr;
            const modelLabel = document.getElementById('model-btn-label');
            const arLabel = document.getElementById('ar-btn-label');
            if (modelLabel) modelLabel.textContent = selectedModelName;
            if (arLabel) arLabel.textContent = selectedAr;
            updateModelBtnIcon();
            const validResolutions = getResolutionsForI2IModel(selectedModel);
            qualityBtn.style.display = validResolutions.length > 0 ? 'flex' : 'none';
            if (validResolutions.length > 0) {
              const qLabel = document.getElementById('quality-btn-label');
              if (qLabel) qLabel.textContent = validResolutions[0];
            }
            picker.setMaxImages(getMaxImagesForI2IModel(selectedModel));
          }
          textarea.placeholder = 'Describe how to transform this image (optional)';
          const attrContainer = document.getElementById('pexels-image-attribution');
          if (attrContainer) {
            attrContainer.innerHTML = '';
            import('../lib/attributionChip.js').then(mod => mod.renderAttributionChip(asset, attrContainer));
          }
        }
      });
    };
    topRow.appendChild(pexelsBtn);

    // Attribution container for Pexels images
    const pexelsImageAttr = document.createElement('div');
    pexelsImageAttr.id = 'pexels-image-attribution';
    pexelsImageAttr.className = 'mt-1';
    topRow.appendChild(pexelsImageAttr);

    container.appendChild(picker.panel);

    const textarea = document.createElement('textarea');
    textarea.id = 'i-prompt-textarea';
    // Prompt Gallery button
    const promptGalleryBtn = document.createElement('button');
    promptGalleryBtn.type = 'button';
    promptGalleryBtn.textContent = '📚 Prompts';
    promptGalleryBtn.title = 'Browse prompt gallery';
    promptGalleryBtn.setAttribute('aria-label', 'Open prompt gallery');
    promptGalleryBtn.className = 'gtm-boost-btn shrink-0';
    promptGalleryBtn.addEventListener('click', () => {
      openPromptGallery({
        appTheme: 'image-studio',
        onSelect: (prompt) => {
          const ta = document.getElementById('i-prompt-textarea') || document.querySelector('textarea');
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
    promptWrapper.appendChild(recipeBtn);
    promptWrapper.appendChild(monetizationBtn);
    promptWrapper.appendChild(promptGalleryBtn);


    textarea.placeholder = 'Describe the image you want to create';
    textarea.className = 'flex-1 bg-transparent border-none text-white text-base md:text-xl placeholder:text-muted focus:outline-none resize-none pt-2.5 leading-relaxed min-h-[40px] max-h-[150px] md:max-h-[250px] overflow-y-auto custom-scrollbar';
    textarea.rows = 1;
    textarea.setAttribute('aria-label', 'Image prompt');
    textarea.oninput = () => {
        textarea.style.height = 'auto';
        const maxHeight = window.innerWidth < 768 ? 150 : 250;
        textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px';
    };

    const prefill = localStorage.getItem('prefill_prompt');
    if (prefill) {
        textarea.value = prefill;
        localStorage.removeItem('prefill_prompt');
        requestAnimationFrame(() => {
            textarea.style.height = 'auto';
            const maxHeight = window.innerWidth < 768 ? 150 : 250;
            textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px';
        });
    }

    topRow.appendChild(textarea);

    // Premium GTM Boost entry point — opens the cinematic prompt enhancer
    // themed for image creation and loads the result straight into this prompt.
    const gtmBtn = document.createElement('button');
    gtmBtn.type = 'button';
    gtmBtn.textContent = '🎯 GTM Boost';
    gtmBtn.title = 'Enhance your prompt with GTM conversion frameworks';
    gtmBtn.setAttribute('aria-label', 'GTM Boost prompt enhancer');
    gtmBtn.className = 'gtm-boost-btn shrink-0';
    gtmBtn.addEventListener('click', () => {
      import('../lib/uiIntegration.js').then(({ openGTMPromptModal }) => {
        openGTMPromptModal('image-studio', (prompt) => {
          textarea.value = prompt;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.focus();
          textarea.style.height = 'auto';
          textarea.style.height = Math.min(textarea.scrollHeight, 250) + 'px';
        });
      }).catch((err) => console.error('[ImageStudio] GTM Boost failed:', err));
    });
    topRow.appendChild(gtmBtn);

    bar.appendChild(topRow);

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
        <div id="model-btn-icon" class="w-5 h-5 rounded-md flex items-center justify-center overflow-hidden bg-white/5"></div>
    `, selectedModelName, 'model-btn', 'Select AI generation model');

    const updateModelBtnIcon = () => {
        const iconEl = document.getElementById('model-btn-icon');
        if (!iconEl) return;
        const currentModels = imageMode ? i2iModels : t2iModels;
        const current = currentModels.find(m => m.id === selectedModel);
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
    `, selectedAr, 'ar-btn', 'Change aspect ratio');

    const qualityBtn = createControlBtn(`
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-60 text-secondary"><path d="M6 2L3 6v15a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6z"/></svg>
    `, '720p', 'quality-btn', 'Set output quality');

    controlsLeft.appendChild(modelBtn);
    controlsLeft.appendChild(arBtn);
    controlsLeft.appendChild(qualityBtn);

    // Thumbnail studio button — next to creation controls, GTM Boost styling
    const thumbBtn = document.createElement('button');
    thumbBtn.type = 'button';
    thumbBtn.textContent = '🖼 Thumbnail';
    thumbBtn.title = 'Generate a custom thumbnail';
    thumbBtn.className = 'gtm-boost-btn shrink-0';
    thumbBtn.addEventListener('click', () => {
    const modal = new TemplateThumbnailModal({
      appTheme: 'image-studio',
      layout: 'panel',
        studioId: 'image-studio',
        studioName: 'Image Studio',
        aspectRatio: selectedAr || '1:1',
        outputType: 'image',
        onApply: ({ imageUrl }) => {
          customThumbnailUrl = imageUrl;
          saveCustomThumbnailToCache('image-studio', imageUrl);
        },
        onClear: () => {
          customThumbnailUrl = null;
          clearCustomThumbnailCache('image-studio');
        },
      });
      mountThumbnailModal(modal);
      modal.open();
    });
    controlsLeft.appendChild(thumbBtn);

    subscribeToGtmThumbnails(({ imageUrl }) => {
      customThumbnailUrl = imageUrl;
      saveCustomThumbnailToCache('image-studio', imageUrl);
    });

    // Advanced options toggle button
    const advancedBtn = createControlBtn(`
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-60 text-secondary"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 001.82-.33 1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-1.82.33A1.65 1.65 0 0019.4 9a1.65 1.65 0 00-1.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
    `, 'Advanced', 'advanced-btn', 'Show advanced options');
    controlsLeft.appendChild(advancedBtn);
  // Model Picker button
  const modelPickerBtn = document.createElement('button');
  modelPickerBtn.type = 'button';
  modelPickerBtn.textContent = 'AI Pick';
  modelPickerBtn.title = 'Open intelligent model picker';
  modelPickerBtn.setAttribute('aria-label', 'Open model picker');
  modelPickerBtn.className = 'text-[11px] font-bold text-cyan-400 border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1.5 rounded-lg hover:bg-cyan-400/20 transition-colors ml-2 whitespace-nowrap';
  modelPickerBtn.addEventListener('click', () => {
    openModelPicker({
      currentModelId: selectedModel,
      onSelectModel: (id) => {
        selectedModel = id;
        const m = getCurrentModels().find(x => x.id === id);
        selectedModelName = m ? m.name : id;
        document.getElementById('model-btn-label').textContent = selectedModelName;
        const availableArs = getCurrentAspectRatios(selectedModel);
        selectedAr = availableArs[0];
        document.getElementById('ar-btn-label').textContent = selectedAr;
        const validResolutions = getCurrentResolutions(selectedModel);
        qualityBtn.style.display = validResolutions.length > 0 ? 'flex' : 'none';
        if (validResolutions.length > 0) document.getElementById('quality-btn-label').textContent = validResolutions[0];
      }
    }).catch((err) => console.error('[ModelPicker] open failed:', err));
  });
  controlsLeft.appendChild(modelPickerBtn);

    
    // Quick Tools toggle button
    const toolsBtn = createControlBtn(`
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-60 text-secondary"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
    `, 'Tools', 'tools-btn', 'Quick starters & prompt enhancer');
    controlsLeft.appendChild(toolsBtn);

    // Personalize button + inline popover (shared module)
    const personalizeHandle = mountPersonalizePopover({
      controlsContainer: controlsLeft,
      label: 'Personalize',
      tooltip: 'Personalize with a discovered contact',
      appId: 'ai-image-studio',
      getTextarea: () => document.getElementById('i-prompt-textarea'),
    });
    // Show quality button if the default model has quality/resolution options
    const _initResolutions = getResolutionsForModel(defaultModel.id);
    qualityBtn.style.display = _initResolutions.length > 0 ? 'flex' : 'none';
    if (_initResolutions.length > 0) {
        const qlabel = qualityBtn.querySelector('#quality-btn-label');
        if (qlabel) qlabel.textContent = _initResolutions[0];
    }

    const generateBtn = document.createElement('button');
generateBtn.type = 'button';
    generateBtn.className = 'bg-primary text-black px-6 md:px-8 py-3 md:py-3.5 rounded-xl md:rounded-[1.5rem] font-black text-sm md:text-base hover:shadow-glow hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2.5 w-full sm:w-auto shadow-lg';
    generateBtn.setAttribute('data-tooltip', 'Generate AI image from prompt');
    generateBtn.setAttribute('aria-label', 'Generate image');
    generateBtn.innerHTML = `Generate ✨`;

    bottomRow.appendChild(controlsLeft);
    bottomRow.appendChild(generateBtn);
    bar.appendChild(bottomRow);
    promptWrapper.appendChild(bar);
    container.appendChild(promptWrapper);

    const inlineInstructions = createInlineInstructions('image');
    inlineInstructions.classList.add('mt-8');
    container.appendChild(inlineInstructions);

    // ==========================================
    // 3. QUICK TOOLS PANEL (Prompt Enhancer + Quick Starters)
    // ==========================================
    const toolsPanel = document.createElement('div');
    toolsPanel.className = 'w-full mt-6 animate-fade-in-up hidden';
    toolsPanel.id = 'tools-panel';
    
    // Build tools panel HTML
    toolsPanel.innerHTML = `
        <div class="bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
            <div class="flex items-center justify-between pb-3 border-b border-white/5">
                <h3 class="text-sm font-bold text-white">Quick Tools</h3>
                <button id="close-tools-btn" class="text-white/40 hover:text-white transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            </div>
            
            <div class="flex flex-col lg:flex-row gap-6">
                <!-- Quick Starters Section -->
                <div class="flex-1">
                    <h4 class="text-xs font-bold text-secondary uppercase tracking-wider mb-3">Quick Starters</h4>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        ${QUICK_PROMPTS.map(q => `
                            <button class="quick-starter-btn px-3 py-2 rounded-lg text-xs font-bold bg-white/5 text-secondary hover:bg-white/10 hover:text-primary transition-all text-left border border-white/5 hover:border-primary/30" data-prompt="${q.prompt}">
                                ${q.label}
                            </button>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Prompt Enhancer Section -->
                <div class="flex-1">
                    <h4 class="text-xs font-bold text-secondary uppercase tracking-wider mb-3">Prompt Enhancer</h4>
                    <div class="flex flex-col gap-3">
                        <input type="text" id="base-prompt-input" 
                            placeholder="Enter base prompt..."
                            class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors">
                        
                        <div>
                            <label class="text-[10px] font-bold text-muted uppercase tracking-wider mb-2 block">Enhancement Tags</label>
                            <div id="enhance-tags-area" class="flex flex-wrap gap-1.5">
                                ${Object.entries(ENHANCE_TAGS).map(([category, tags]) => 
                                    tags.map(tag => `<button class="enhance-tag-btn px-2 py-1 rounded-full text-[10px] font-bold bg-white/5 text-secondary hover:bg-white/10 transition-all" data-tag="${tag}">${tag}</button>`).join('')
                                ).join('')}
                            </div>
                        </div>
                        
                        <div class="flex flex-col gap-2">
                            <label class="text-[10px] font-bold text-muted uppercase tracking-wider">Enhanced Prompt</label>
                            <div id="enhanced-prompt-display" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-xs min-h-[40px]"></div>
                            <div class="flex gap-2">
                                <button id="copy-enhanced-btn" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 text-secondary hover:bg-white/10 transition-all">
                                    Copy
                                </button>
                                <button id="use-enhanced-btn" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-black hover:shadow-glow transition-all">
                                    Use in Generator
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    container.appendChild(toolsPanel);

    // ==========================================
    // 4. ADVANCED OPTIONS PANEL
    // ==========================================
    const STYLE_PRESETS = ['None', 'Photorealistic', 'Anime', 'Cinematic', 'Oil Painting', 'Watercolor', 'Digital Art', 'Concept Art', 'Cyberpunk'];
    
    const advancedPanel = document.createElement('div');
    advancedPanel.className = 'w-full mt-6 animate-fade-in-up hidden';
    advancedPanel.id = 'advanced-panel';
    const advancedCard = document.createElement('div');
    advancedCard.className = 'bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex flex-col gap-4';
    advancedPanel.appendChild(advancedCard);

    const advHeader = document.createElement('div');
    advHeader.className = 'flex items-center justify-between pb-3 border-b border-white/5';
    advHeader.innerHTML = `
        <h3 class="text-sm font-bold text-white">Advanced Options</h3>
        <button id="close-adv-btn" class="text-white/40 hover:text-white transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
    `;
    advancedPanel.appendChild(advHeader);

    const advancedControlsContainer = document.createElement('div');
    advancedControlsContainer.className = 'flex flex-col gap-4';
    advancedCard.appendChild(advancedControlsContainer);

    const dynamicControls = createAdvancedControls({
      model: getExtendedModel(getModelById(selectedModel)),
      state: { imageMode },
      container: advancedControlsContainer,
      exclude: new Set(['style', 'batch_count']),
      extraInputs: {
        style: { type: 'enum', title: 'Style Preset', options: STYLE_PRESETS, default: 'None', group: 'basic' },
        batch_count: { type: 'integer', title: 'Batch Count', default: 1, minValue: 1, maxValue: 4, step: 1, group: 'advanced', visibleWhen: 'imageMode == false' },
        reference_strength: { type: 'slider', title: 'Reference Strength', default: 50, minValue: 0, maxValue: 100, step: 5, group: 'advanced', visibleWhen: 'imageMode == true' },
      },
      onChange: (key, value) => {
        if (key === 'style') selectedStyle = value;
        if (key === 'batch_count') batchCount = value;
        if (key === 'reference_strength') referenceStrength = value;
        if (key === 'negative_prompt') negativePrompt = value;
        if (key === 'guidance_scale') guidanceScale = value;
        if (key === 'steps') steps = value;
        if (key === 'seed') seed = value;
        if (key === 'width') customWidth = value;
        if (key === 'height') customHeight = value;
        if (key === 'lora') selectedLora = value;
        if (key === 'lora_weight') loraWeight = value;
      }
    });
    container.appendChild(advancedPanel);

    // Advanced panel toggle logic
    const toggleAdvanced = () => {
        showAdvanced = !showAdvanced;
        advancedPanel.classList.toggle('hidden', !showAdvanced);
        document.getElementById('advanced-btn-label').textContent = showAdvanced ? 'Less' : 'Advanced';
    };
    
    // Add tools panel and advanced panel to container first before accessing their elements
    container.appendChild(toolsPanel);
    container.appendChild(advancedPanel);
    
    // Now set up event handlers after elements are in DOM
    advancedBtn.onclick = toggleAdvanced;
    const closeAdvBtn = advancedPanel.querySelector('#close-adv-btn');
    if (closeAdvBtn) closeAdvBtn.onclick = toggleAdvanced;
    
    // Quick Tools Panel toggle
    const toggleTools = () => {
        showToolsPanel = !showToolsPanel;
        toolsPanel.classList.toggle('hidden', !showToolsPanel);
        if (showToolsPanel) {
            // Close advanced panel when opening tools
            if (!showAdvanced) {
                showAdvanced = true;
                advancedPanel.classList.remove('hidden');
            }
        }
        document.getElementById('tools-btn-label').textContent = showToolsPanel ? 'Tools' : 'Tools';
    };
    
    toolsBtn.onclick = toggleTools;
    const closeToolsBtn = toolsPanel.querySelector('#close-tools-btn');
    if (closeToolsBtn) closeToolsBtn.onclick = toggleTools;
    
    // Quick Starter buttons
    const quickStarterBtns = toolsPanel.querySelectorAll('.quick-starter-btn');
    quickStarterBtns.forEach(btn => {
        btn.onclick = () => {
            const prompt = btn.dataset.prompt;
            textarea.value = prompt;
            textarea.style.height = 'auto';
            const maxHeight = window.innerWidth < 768 ? 150 : 250;
            textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px';
            // Close tools panel after selection
            showToolsPanel = false;
            toolsPanel.classList.add('hidden');
        };
    });
    
    // Prompt Enhancer - selected tags state
    const enhanceSelectedTags = new Set();
    const basePromptInput = toolsPanel.querySelector('#base-prompt-input');
    const enhancedPromptDisplay = toolsPanel.querySelector('#enhanced-prompt-display');
    
    // Update enhanced prompt display
    const updateEnhancedPrompt = () => {
        const base = basePromptInput?.value?.trim() || '';
        const tags = Array.from(enhanceSelectedTags).join(', ');
        const enhanced = [base, tags].filter(p => p).join(', ');
        if (enhancedPromptDisplay) {
            enhancedPromptDisplay.textContent = enhanced || 'Your enhanced prompt will appear here...';
            enhancedPromptDisplay.classList.toggle('text-muted', !enhanced);
        }
    };
    
    // Base prompt input handler
    if (basePromptInput) {
        basePromptInput.oninput = updateEnhancedPrompt;
    }
    
    // Enhance tag buttons
    const enhanceTagBtns = toolsPanel.querySelectorAll('.enhance-tag-btn');
    enhanceTagBtns.forEach(btn => {
        btn.onclick = () => {
            const tag = btn.dataset.tag;
            if (enhanceSelectedTags.has(tag)) {
                enhanceSelectedTags.delete(tag);
                btn.classList.remove('bg-primary', 'text-black');
                btn.classList.add('bg-white/5', 'text-secondary');
            } else {
                enhanceSelectedTags.add(tag);
                btn.classList.remove('bg-white/5', 'text-secondary');
                btn.classList.add('bg-primary', 'text-black');
            }
            updateEnhancedPrompt();
        };
    });
    
    // Copy enhanced button
    const copyEnhancedBtn = toolsPanel.querySelector('#copy-enhanced-btn');
    if (copyEnhancedBtn) {
        copyEnhancedBtn.onclick = () => {
            const text = enhancedPromptDisplay?.textContent || '';
            if (text && text !== 'Your enhanced prompt will appear here...') {
                navigator.clipboard.writeText(text);
                copyEnhancedBtn.textContent = 'Copied!';
                setTimeout(() => { copyEnhancedBtn.textContent = 'Copy'; }, 1500);
            }
        };
    }
    
    // Use enhanced button
    const useEnhancedBtn = toolsPanel.querySelector('#use-enhanced-btn');
    if (useEnhancedBtn) {
        useEnhancedBtn.onclick = () => {
            const text = enhancedPromptDisplay?.textContent || '';
            if (text && text !== 'Your enhanced prompt will appear here...') {
                textarea.value = text;
                textarea.style.height = 'auto';
                const maxHeight = window.innerWidth < 768 ? 150 : 250;
                textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px';
                // Close tools panel after use
                showToolsPanel = false;
                toolsPanel.classList.add('hidden');
            }
        };
    }
    
    // Dynamic advanced controls are rendered by createAdvancedControls.
    // Studio-specific values are synced via the onChange callback above.
    // Old static event handlers removed; dynamicControls manages all advanced inputs.

    // ==========================================
    // 3. DROPDOWNS (Professional implementation)
    // ==========================================
    const dropdown = document.createElement('div');
    dropdown.className = 'absolute bottom-[102%] left-2 z-50 transition-all opacity-0 pointer-events-none scale-95 origin-bottom-left glass rounded-3xl p-3 translate-y-2 w-[calc(100vw-3rem)] max-w-xs shadow-4xl border border-white/10 flex flex-col';

    const showDropdown = (type, anchorBtn) => {
        dropdown.innerHTML = '';
        dropdown.classList.remove('opacity-0', 'pointer-events-none');
        dropdown.classList.add('opacity-100', 'pointer-events-auto');

        if (type === 'model') {
            dropdown.classList.add('w-[calc(100vw-2rem)]', 'md:w-[480px]', 'max-w-md');
            dropdown.classList.remove('max-w-xs', 'max-w-[240px]', 'max-w-[200px]');
            const currentModels = imageMode ? i2iModels : t2iModels;
            mountModelSelector(dropdown, {
              models: currentModels,
              selectedModelId: selectedModel,
              showProviderName: true,
              onSelectModel: (modelId) => {
                selectedModel = modelId;
                selectedModelName = currentModels.find(m => m.id === modelId)?.name || modelId;
                const availableArs = getCurrentAspectRatios(selectedModel);
                selectedAr = availableArs[0];
                document.getElementById('model-btn-label').textContent = selectedModelName;
                document.getElementById('ar-btn-label').textContent = selectedAr;
                const validResolutions = getCurrentResolutions(selectedModel);
                qualityBtn.style.display = validResolutions.length > 0 ? 'flex' : 'none';
                if (validResolutions.length > 0) {
                  document.getElementById('quality-btn-label').textContent = validResolutions[0];
                }
                if (imageMode) {
                  picker.setMaxImages(getMaxImagesForI2IModel(selectedModel));
                }
                updateModelBtnIcon();
                if (dynamicControls) {
                  const resolved = getModelById(selectedModel)
                    || getI2IModelById(selectedModel)
                    || getI2VModelById(selectedModel)
                    || getV2VModelById(selectedModel)
                    || { id: selectedModel, inputs: {} };
                  dynamicControls.update(getExtendedModel(resolved));
                }
                closeDropdown();
              },
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
                    document.getElementById('ar-btn-label').textContent = r;
                    closeDropdown();
                };
                list.appendChild(item);
            });
            dropdown.appendChild(list);
        } else if (type === 'quality') {
            dropdown.classList.add('max-w-[200px]');
            dropdown.innerHTML = `<div class="text-[10px] font-bold text-secondary uppercase tracking-widest px-3 py-2 border-b border-white/5 mb-2">Resolution</div>`;
            const list = document.createElement('div');
            list.className = 'flex flex-col gap-1';

            const options = getCurrentResolutions(selectedModel);

            options.forEach(opt => {
                const item = document.createElement('div');
                item.className = 'flex items-center justify-between p-3.5 hover:bg-white/5 rounded-2xl cursor-pointer transition-all group';
                item.innerHTML = `
                    <span class="text-xs font-bold text-white opacity-80 group-hover:opacity-100">${opt}</span>
                     ${document.getElementById('quality-btn-label').textContent === opt ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d9ff00" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
                `;
                item.onclick = (e) => {
                    e.stopPropagation();
                    document.getElementById('quality-btn-label').textContent = opt;
                    closeDropdown();
                };
                list.appendChild(item);
            });
            dropdown.appendChild(list);
        }

        // Position dropdown
        const btnRect = anchorBtn.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        // Horizontal position
        if (window.innerWidth < 768) {
            // Center on mobile
            dropdown.style.left = '50%';
            dropdown.style.transform = 'translateX(-50%) translate(0, 8px)';
        } else {
            // Align with button on desktop
            dropdown.style.left = `${btnRect.left - containerRect.left}px`;
            dropdown.style.transform = 'translate(0, 8px)';
        }

        // Vertical position (always above button)
        dropdown.style.bottom = `${containerRect.bottom - btnRect.top + 8}px`;
    };

    const closeDropdown = () => {
        dropdown.classList.add('opacity-0', 'pointer-events-none');
        dropdown.classList.remove('opacity-100', 'pointer-events-auto');
        dropdownOpen = null;
        selectedProvider = 'all';
    };

    modelBtn.onclick = (e) => {
        e.stopPropagation();
        if (dropdownOpen === 'model') closeDropdown();
        else {
            dropdownOpen = 'model';
            selectedProvider = 'all';
            showDropdown('model', modelBtn);
        }
    };

    arBtn.onclick = (e) => {
        e.stopPropagation();
        if (dropdownOpen === 'ar') closeDropdown();
        else {
            dropdownOpen = 'ar';
            showDropdown('ar', arBtn);
        }
    };

    qualityBtn.onclick = (e) => {
        e.stopPropagation();
        if (dropdownOpen === 'quality') closeDropdown();
        else {
            dropdownOpen = 'quality';
            showDropdown('quality', qualityBtn);
        }
    };

    window.onclick = () => closeDropdown();
    container.appendChild(dropdown);

    // ==========================================
    // 4. CANVAS AREA + HISTORY
    // ==========================================
    const generationHistory = [];

    // History sidebar
    const historySidebar = document.createElement('div');
    historySidebar.className = 'fixed right-0 top-0 h-full w-20 md:w-24 bg-black/60 backdrop-blur-xl border-l border-white/5 z-50 flex flex-col items-center py-4 gap-3 overflow-y-auto transition-all duration-500 translate-x-full opacity-0';
    historySidebar.id = 'history-sidebar';

    const historyLabel = document.createElement('div');
    historyLabel.className = 'text-[9px] font-bold text-muted uppercase tracking-widest mb-2 rotate-0';
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

    const imageContainer = document.createElement('div');
    imageContainer.className = 'relative group';

    const resultImg = document.createElement('img');
    resultImg.className = 'max-h-[60vh] max-w-[80vw] rounded-3xl shadow-3xl border border-white/10 interactive-glow object-contain';
    imageContainer.appendChild(resultImg);

    // Canvas Controls
    const canvasControls = document.createElement('div');
    canvasControls.className = 'mt-6 flex gap-3 opacity-0 transition-opacity delay-500 duration-500 justify-center';

    const regenerateBtn = document.createElement('button');
    regenerateBtn.className = 'bg-white/10 hover:bg-white/20 px-6 py-2.5 rounded-2xl text-xs font-bold transition-all border border-white/5 backdrop-blur-lg text-white';
    regenerateBtn.textContent = '↻ Regenerate';

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'bg-primary text-black px-6 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-glow active:scale-95';
    downloadBtn.textContent = '↓ Download';

    const newPromptBtn = document.createElement('button');
    newPromptBtn.className = 'bg-white/10 hover:bg-white/20 px-6 py-2.5 rounded-2xl text-xs font-bold transition-all border border-white/5 backdrop-blur-lg text-white';
    newPromptBtn.textContent = '+ New';

    canvasControls.appendChild(regenerateBtn);
    canvasControls.appendChild(downloadBtn);
    canvasControls.appendChild(newPromptBtn);

    const publishBtn = document.createElement('button');
    publishBtn.type = 'button';
    publishBtn.className = 'bg-gradient-to-r from-[#6d5efc] to-[#a855f7] text-white px-6 py-2.5 rounded-2xl text-xs font-bold transition-all hover:shadow-glow';
    publishBtn.textContent = 'Publish to Social';

    canvasControls.appendChild(publishBtn);

    canvas.appendChild(imageContainer);
    canvas.appendChild(canvasControls);
    container.appendChild(canvas);

    // --- Helper: Show image in canvas ---
    const showImageInCanvas = (imageUrl) => {
        // Fully hide hero and prompt
        hero.classList.add('hidden');
        promptWrapper.classList.add('hidden');

        resultImg.src = imageUrl;
        resultImg.onload = () => {
            canvas.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-10', 'scale-95');
            canvas.classList.add('opacity-100', 'translate-y-0', 'scale-100');
            canvasControls.classList.remove('opacity-0');
            canvasControls.classList.add('opacity-100');
        };
        publishBtn.onclick = () => openSocialPublish({ mediaUrl: imageUrl, mediaType: 'image' });
    };

    // --- Helper: Add to history ---
    const addToHistory = (entry) => {
        generationHistory.unshift(entry);

        try {
            // Save to localStorage
            localStorage.setItem('muapi_history', JSON.stringify(generationHistory.slice(0, 50)));
        } catch (e) {
            // Ignore storage errors (private mode, quota exceeded, etc.)
        }

        // Show sidebar
        historySidebar.classList.remove('translate-x-full', 'opacity-0');
        historySidebar.classList.add('translate-x-0', 'opacity-100');

        renderHistory();
    };

    const renderHistory = () => {
        historyList.innerHTML = '';
        generationHistory.forEach((entry, idx) => {
            const thumb = document.createElement('div');
            thumb.className = `relative group/thumb cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-300 ${idx === 0 ? 'border-primary shadow-glow' : 'border-white/10 hover:border-white/30'}`;

            // Safe image creation - prevents XSS from user-provided URLs
            const img = createSafeImage(entry.url, entry.prompt?.substring(0, 30) || 'Generated', 'w-full aspect-square object-cover');
            thumb.appendChild(img);

            // Create overlay with download button
            const overlay = document.createElement('div');
            overlay.className = 'absolute inset-0 bg-black/60 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center gap-1';
            
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'hist-download p-1.5 bg-primary rounded-lg text-black hover:scale-110 transition-transform';
            downloadBtn.title = 'Download';
            downloadBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>';
            overlay.appendChild(downloadBtn);
            thumb.appendChild(overlay);

            thumb.onclick = (e) => {
                if (e.target.closest('.hist-download')) {
                    downloadImage(entry.url, `muapi-${entry.id || idx}.jpg`);
                    return;
                }
                showImageInCanvas(entry.url);
                // Update active border
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

    // --- Helper: Download image ---
    const downloadImage = async (url, filename) => {
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
            // Fallback: open in new tab
            window.open(url, '_blank');
        }
    };

    // --- Load history from localStorage ---
    try {
        const saved = JSON.parse(localStorage.getItem('muapi_history') || '[]');
        if (saved.length > 0) {
            saved.forEach(e => generationHistory.push(e));
            historySidebar.classList.remove('translate-x-full', 'opacity-0');
            historySidebar.classList.add('translate-x-0', 'opacity-100');
            renderHistory();
        }
    } catch (e) { /* ignore */ }

    // --- Button Handlers ---
    downloadBtn.onclick = () => {
        const current = resultImg.src;
        if (current) {
            const entry = generationHistory.find(e => e.url === current);
            downloadImage(current, `muapi-${entry?.id || 'image'}.jpg`);
        }
    };

    regenerateBtn.onclick = () => {
        generateBtn.click();
    };

    newPromptBtn.onclick = () => {
        // Reset to prompt view
        canvas.classList.add('opacity-0', 'pointer-events-none', 'translate-y-10', 'scale-95');
        canvas.classList.remove('opacity-100', 'translate-y-0', 'scale-100');
        canvasControls.classList.add('opacity-0');
        canvasControls.classList.remove('opacity-100');
        // Restore hero and prompt
        hero.classList.remove('hidden', 'opacity-0', 'scale-95', '-translate-y-10', 'pointer-events-none');
        promptWrapper.classList.remove('hidden', 'opacity-40');
        textarea.value = '';
        picker.reset();
        uploadedImageUrls = [];
        picker.setMaxImages(1);
        // Reset to t2i mode
        imageMode = false;
        selectedModel = t2iModels[0].id;
        selectedModelName = t2iModels[0].name;
        selectedAr = getAspectRatiosForModel(selectedModel)[0];
        document.getElementById('model-btn-label').textContent = selectedModelName;
        document.getElementById('ar-btn-label').textContent = selectedAr;
        updateModelBtnIcon();
        const resetResolutions = getResolutionsForModel(selectedModel);
        qualityBtn.style.display = resetResolutions.length > 0 ? 'flex' : 'none';
        if (resetResolutions.length > 0) document.getElementById('quality-btn-label').textContent = resetResolutions[0];
        textarea.placeholder = 'Describe the image you want to create';
        textarea.focus();
    };

    // ==========================================
    // 5. GENERATION LOGIC
    // ==========================================
    generateBtn.onclick = async () => {
        if (!(await requireEntitlement())) return;
        let prompt = textarea.value.trim();

        // Replace any {{token}} placeholders the user inserted via the
        // personalize popover. Tokens resolve to the active contact's
        // variables (firstName, company, painPoint, etc.) at generation time.
        try {
          const selectedId = localStorage.getItem('remix_selected_contact_id');
          if (selectedId && prompt) {
            const profiles = JSON.parse(localStorage.getItem('remix_contact_profiles') || '[]');
            const profile = profiles.find(p => p.id === selectedId);
            if (profile) {
              prompt = replaceTokensInPrompt(prompt, profile);
            }
          }
        } catch {}

        if (imageMode) {
            if (uploadedImageUrls.length === 0) {
                alert('Please upload a reference image first.');
                return;
            }
        } else {
            if (!prompt) {
                alert('Please enter a prompt to generate an image.');
                return;
            }
        }

        const apiKey = apiKeyManager.getKey();
        if (!apiKey) {
            AuthModal(() => generateBtn.click());
            return;
        }

        hero.classList.add('opacity-0', 'scale-95', '-translate-y-10', 'pointer-events-none');
        generateBtn.disabled = true;
        generateBtn.innerHTML = `<span class="animate-spin inline-block mr-2 text-black">◌</span> Generating...`;

        try {
            let res;
            const qualityLabel = document.getElementById('quality-btn-label')?.textContent;
            // Collect dynamic control values. Studio-specific fields (style, batch_count)
            // are excluded from the payload and handled manually below.
            const dynamicPayload = dynamicControls.getPayload({});

            if (imageMode) {
                const genParams = {
                    model: selectedModel,
                    images_list: uploadedImageUrls,
                    image_url: uploadedImageUrls[0], // backward compat for single-image models
                    aspect_ratio: selectedAr,
                    ...dynamicPayload
                };
                if (customThumbnailUrl) genParams.thumbnail_url = customThumbnailUrl;
                if (prompt) genParams.prompt = prompt;
                const qualityField = getCurrentQualityField(selectedModel);
                if (qualityField && qualityLabel) genParams[qualityField] = qualityLabel;
                res = await muapi.generateI2I(genParams);
            } else {
                let finalPrompt = prompt;
                // Add style to prompt if selected
                if (selectedStyle && selectedStyle !== 'None') {
                    finalPrompt = `${prompt}, ${selectedStyle.toLowerCase()} style`;
                }
                const genParams = {
                    model: selectedModel,
                    prompt: finalPrompt,
                    aspect_ratio: selectedAr,
                    ...dynamicPayload
                };
                if (customThumbnailUrl) genParams.thumbnail_url = customThumbnailUrl;
                const qualityField = getCurrentQualityField(selectedModel);
                if (qualityField && qualityLabel) genParams[qualityField] = qualityLabel;
                res = await muapi.generateImage(genParams);
            }

            if (res && res.url) {
                // Add to history
                addToHistory({
                    id: res.id || Date.now().toString(),
                    url: res.url,
                    prompt: prompt,
                    model: selectedModel,
                    aspect_ratio: selectedAr,
                    timestamp: new Date().toISOString()
                });

                // Show image
                showImageInCanvas(res.url);
            } else {
                console.error('[ImageStudio] No image URL in response:', res);
                throw new Error('No image URL returned by API');
            }
        } catch (e) {
            generateBtn.innerHTML = `Error: ${e.message.slice(0, 40)}`;
            setTimeout(() => {
                generateBtn.innerHTML = `Generate ✨`;
                generateBtn.disabled = false;
            }, 3000);
            return;
        }
        generateBtn.disabled = false;
        generateBtn.innerHTML = `Generate ✨`;
    };

    const galleryAssets = getAssetsForStudio('image');
    if (galleryAssets.length > 0) {
      const gallery = ExampleGallery({ studioId: 'image', assets: galleryAssets, maxCards: 20 });
      container.appendChild(gallery);
    }

    return container;
}
