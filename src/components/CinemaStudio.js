
import { muapi } from '../lib/muapi.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { createSafeImage } from '../lib/security.js';
import { CameraControls } from './CameraControls.js';
import { buildNanoBananaPrompt, CAMERA_MAP, LENS_MAP, FOCAL_PERSPECTIVE, APERTURE_EFFECT } from '../lib/promptUtils.js';
import { AuthModal } from './AuthModal.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import { getVideoModelById, getI2VModelById, t2vModels, i2vModels, getDurationsForModel, getDurationsForI2VModel, getResolutionsForVideoModel, getResolutionsForI2VModel, getModelById } from '../lib/models.js';
import { PROVIDER_LOGOS, invertLogos, getProviderStyle, getAvailableProviders, filterModels, renderProviderSidebar, renderSearchBar, renderModelList } from '../lib/modelSelectorUI.js';
import { createInlineInstructions } from './InlineInstructions.js';
import { createHeroSection, getCustomThumbnailFromCache, saveCustomThumbnailToCache, clearCustomThumbnailCache } from '../lib/thumbnails.js';
import { createUploadPicker } from './UploadPicker.js';
import { mountPersonalizeTrigger, replaceTokensInPrompt } from './personalize/personalizePopover.js';
import { StudioThumbnailModal, mountStudioThumbnailModal } from './modals/StudioThumbnailPanel.jsx';
import { requireEntitlement } from '../lib/clerkEntitlements.js';
import { subscribeToGtmThumbnails } from '../lib/gtmThumbnailBridge.js';
import { createAdvancedControls } from '../lib/studioControls.js';
import { getExtendedModel } from '../lib/modelInputExtensions.js';

// Camera movements promised by the Cinema Studio intro copy
// ("Select camera movement … dolly, crane, orbit, FPV drone").
const CAMERA_MOVEMENTS = {
  'Static': 'static locked-off shot',
  'Dolly In': 'slow dolly in toward the subject',
  'Dolly Out': 'slow dolly out revealing the scene',
  'Crane Up': 'cinematic crane shot moving upward',
  'Orbit': 'smooth 360 orbit around the subject',
  'FPV Drone': 'immersive FPV drone fly-through',
  'Handheld': 'subtle handheld camera movement',
  'Pan': 'slow horizontal pan',
  'Tilt': 'vertical tilt movement',
  'Dolly Zom': 'Hitchcock dolly zoom (vertigo effect)',
};

// Film looks promised by the intro copy ("Choose … film look to set the
// cinematic mood").
const FILM_LOOKS = {
  'Natural': 'natural color science',
  'Anamorphic': 'anamorphic widescreen movie look with horizontal flares',
  'Teal & Orange': 'teal and orange blockbuster grade',
  'Moody Noir': 'moody film-noir contrast with deep shadows',
  'Vintage': 'warm vintage film grain and faded tones',
  'Neon Nights': 'neon-lit cyberpunk night grade',
  'Documentary': 'clean neutral documentary look',
  'Golden Hour': 'warm golden-hour glow',
};

export function CinemaStudio() {
    const container = document.createElement('div');
    container.className = 'w-full h-full flex flex-col items-center justify-start bg-black relative overflow-hidden';
  mountStudioChrome(container, { currentRoute: 'cinema' });

    // --- State ---
    const currentSettings = {
        prompt: '',
        aspect_ratio: '16:9',
        camera: Object.keys(CAMERA_MAP)[0],
        lens: Object.keys(LENS_MAP)[0],
        focal: 35,
        aperture: "f/1.4",
        movement: 'Static',
        look: 'Natural',
        referenceUrl: null,
        // Selected generation model. Cinema Studio exposes the same catalog
        // picker as Video Studio; defaults to the first text-to-video model.
        model: (t2vModels[0] && t2vModels[0].id) || 'kling-v2.6-pro-t2v',
    };
    let selectedProvider = 'all';
    
    // Camera builder panel state
    let showCameraBuilder = false;
    let showAdvanced = false;
    let customThumbnailUrl = getCustomThumbnailFromCache('cinema-studio');

    // ==========================================
    // 1. HERO SECTION (Empty State)
    // ==========================================
    const heroSection = document.createElement('div');
    heroSection.className = 'flex flex-col items-center text-center px-4 animate-fade-in-up w-full mb-2 md:mb-4';
    const cinemaBanner = createHeroSection('cinema', 'h-32 md:h-44 mb-3');
    if (cinemaBanner) {
        const bannerContent = document.createElement('div');
        bannerContent.className = 'absolute bottom-0 left-0 right-0 p-6 z-10 text-left';
        bannerContent.innerHTML = `
            <div class="mb-2 text-xs font-bold text-white/40 tracking-[0.2em] uppercase">Cinema Studio 2.0</div>
            <h1 class="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
                What would you shoot<br>with infinite budget?
            </h1>
        `;
        cinemaBanner.appendChild(bannerContent);
        heroSection.appendChild(cinemaBanner);
    }

    container.appendChild(heroSection);

    const inlineInstructions = createInlineInstructions('cinema');
    inlineInstructions.classList.add('mt-8', 'px-4');
    container.appendChild(inlineInstructions);

    // ==========================================
    // 1.5. CINEMA PROMPT BUILDER
    // ==========================================
    function createSelect(label, options) {
        const wrapper = document.createElement('div');
        const lbl = document.createElement('label');
        lbl.className = 'text-xs font-bold text-secondary uppercase tracking-wider block mb-1';
        lbl.textContent = label;
        wrapper.appendChild(lbl);
        const select = document.createElement('select');
        select.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none appearance-none cursor-pointer';
        options.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o;
            opt.textContent = o;
            opt.style.background = '#111';
            select.appendChild(opt);
        });
        wrapper.appendChild(select);
        return { wrapper, select };
    }

    const cineBuilderWrapper = document.createElement('div');
    cineBuilderWrapper.className = 'w-full mt-6 px-4 animate-fade-in-up';
    cineBuilderWrapper.style.animationDelay = '0.15s';

    const cineBuilderToggle = document.createElement('button');
    cineBuilderToggle.className = 'w-full flex items-center justify-between bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-2xl px-5 py-3.5 text-left hover:bg-white/[0.04] transition-all';
    cineBuilderToggle.innerHTML = `
        <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d9ff00" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/><line x1="17" y1="17" x2="22" y2="17"/></svg>
            </div>
            <div>
                <div class="text-sm font-bold text-white">Cinema Prompt Builder</div>
                <div class="text-[10px] text-muted">Build cinematic prompts with camera & lens metadata</div>
            </div>
        </div>
        <svg class="cine-chevron w-4 h-4 text-muted transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
    `;

    const cineBuilderPanel = document.createElement('div');
    cineBuilderPanel.className = 'hidden bg-[#111]/90 backdrop-blur-xl border border-white/10 border-t-0 rounded-b-2xl px-5 pb-5 pt-3';

    const cinePrompt = document.createElement('input');
    cinePrompt.type = 'text';
    cinePrompt.placeholder = 'Base scene description...';
    cinePrompt.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors mb-4';
    cineBuilderPanel.appendChild(cinePrompt);

    const cineSelects = document.createElement('div');
    cineSelects.className = 'grid grid-cols-2 gap-3 mb-4';
    const cameraSelect = createSelect('Camera', Object.keys(CAMERA_MAP));
    const lensSelect = createSelect('Lens', Object.keys(LENS_MAP));
    cineSelects.appendChild(cameraSelect.wrapper);
    cineSelects.appendChild(lensSelect.wrapper);
    cineBuilderPanel.appendChild(cineSelects);

    const cineOutput = document.createElement('div');
    cineOutput.className = 'bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm min-h-[60px] mb-4';
    cineOutput.textContent = 'Cinematic prompt will appear here...';
    cineBuilderPanel.appendChild(cineOutput);

    function updateCine() {
        const base = cinePrompt.value.trim();
        if (!base) { cineOutput.textContent = 'Cinematic prompt will appear here...'; return; }
        cineOutput.textContent = buildNanoBananaPrompt(base, cameraSelect.select.value, lensSelect.select.value, 35, 'f/1.4');
    }
    cinePrompt.oninput = updateCine;
    cameraSelect.select.onchange = updateCine;
    lensSelect.select.onchange = updateCine;

    const cineUseBtn = document.createElement('button');
    cineUseBtn.className = 'px-5 py-2.5 bg-primary text-black rounded-xl text-xs font-bold hover:shadow-glow transition-all';
    cineUseBtn.textContent = 'Use in Prompt';
    cineUseBtn.onclick = () => {
        const prompt = cineOutput.textContent;
        if (prompt && prompt !== 'Cinematic prompt will appear here...') {
            textarea.value = prompt;
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 250) + 'px';
            // Collapse builder after use
            cineBuilderPanel.classList.add('hidden');
            cineBuilderToggle.querySelector('.cine-chevron').style.transform = '';
        }
    };
    cineBuilderPanel.appendChild(cineUseBtn);

    let cineBuilderOpen = false;
    cineBuilderToggle.onclick = () => {
        cineBuilderOpen = !cineBuilderOpen;
        cineBuilderPanel.classList.toggle('hidden', !cineBuilderOpen);
        cineBuilderToggle.querySelector('.cine-chevron').style.transform = cineBuilderOpen ? 'rotate(180deg)' : '';
    };

    cineBuilderWrapper.appendChild(cineBuilderToggle);
    cineBuilderWrapper.appendChild(cineBuilderPanel);
    container.appendChild(cineBuilderWrapper);

    // ==========================================
    // 2. CAMERA CONTROLS OVERLAY
    // ==========================================
    const overlayBackdrop = document.createElement('div');
    overlayBackdrop.className = 'fixed inset-0 bg-black/80 backdrop-blur-md z-40 opacity-0 pointer-events-none transition-opacity duration-300 flex items-center justify-center';

    const overlayContent = document.createElement('div');
    // Reduced padding for mobile (p-4) and added max-height/overflow handling
    overlayContent.className = 'w-full bg-[#141414] border border-white/10 rounded-3xl p-4 md:p-8 shadow-2xl transform scale-95 transition-transform duration-300 flex flex-col max-h-[90vh]';
    overlayBackdrop.appendChild(overlayContent);

    // Header for Overlay
    const overlayHeader = document.createElement('div');
    overlayHeader.className = 'flex items-center justify-between mb-8';
    overlayHeader.innerHTML = `
        <div class="flex gap-4">
            <button class="px-4 py-2 bg-white text-black text-xs font-bold rounded-full">All</button>
        </div>
        <button id="close-overlay-btn" class="text-white/50 hover:text-white transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
    `;
    overlayContent.appendChild(overlayHeader);

    // Controls Component
    const cameraControls = CameraControls((state) => {
        currentSettings.camera = state.camera;
        currentSettings.lens = state.lens;
        currentSettings.focal = state.focal;
        currentSettings.aperture = state.aperture;
        updateSummaryCard();
    });
    overlayContent.appendChild(cameraControls);

    container.appendChild(overlayBackdrop);

    // Overlay Logic
    const openOverlay = () => {
        overlayBackdrop.classList.remove('opacity-0', 'pointer-events-none');
        overlayContent.classList.remove('scale-95');
        overlayContent.classList.add('scale-100');
    };
    const closeOverlay = () => {
        overlayBackdrop.classList.add('opacity-0', 'pointer-events-none');
        overlayContent.classList.add('scale-95');
        overlayContent.classList.remove('scale-100');
    };
    overlayContent.querySelector('#close-overlay-btn').onclick = closeOverlay;
    overlayBackdrop.onclick = (e) => { if (e.target === overlayBackdrop) closeOverlay(); };


    // ==========================================
    // 3. PROMPT BAR (main controls) — kept in normal document flow ABOVE the
    // inline-instruction tips so the controls aren't pinned to the bottom.
    // ==========================================
    const promptBarWrapper = document.createElement('div');
    promptBarWrapper.className = 'relative w-full max-w-3xl mx-auto px-4 mt-6 z-30';

    const promptBar = document.createElement('div');
    promptBar.className = 'bg-[#1a1a1a] border border-white/10 rounded-[2rem] p-4 flex justify-between shadow-3xl items-end relative';

    // --- LEFT COLUMN (Input + Settings) ---
    const leftColumn = document.createElement('div');
    leftColumn.className = 'flex-1 flex flex-col gap-3 min-h-[80px] justify-between py-1 px-1';

    // 1. Input Area
    const inputRow = document.createElement('div');
    inputRow.className = 'flex items-start gap-3 w-full';



    // Textarea
    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Describe your scene - use @ to add characters & props';
    textarea.className = 'flex-1 bg-transparent border-none text-white text-lg font-medium placeholder:text-white/20 focus:outline-none resize-none h-[28px] leading-relaxed overflow-hidden';
    textarea.style.height = 'auto'; // Auto-grow check
    textarea.rows = 1;
    textarea.setAttribute('aria-label', 'Cinema prompt');
    textarea.oninput = function () {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    };
    const cinemaPrefill = localStorage.getItem('prefill_prompt');
    if (cinemaPrefill) {
        textarea.value = cinemaPrefill;
        localStorage.removeItem('prefill_prompt');
        requestAnimationFrame(() => {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        });
    }

    inputRow.appendChild(textarea);

    // GTM Boost entry point — opens the cinematic prompt enhancer themed for
    // cinema creation and loads the result straight into this prompt.
    const gtmBtn = document.createElement('button');
    gtmBtn.type = 'button';
    gtmBtn.textContent = '🎯 GTM Boost';
    gtmBtn.title = 'Enhance your prompt with GTM conversion frameworks';
    gtmBtn.setAttribute('aria-label', 'GTM Boost prompt enhancer');
    gtmBtn.className = 'gtm-boost-btn shrink-0';
    gtmBtn.addEventListener('click', () => {
      import('../lib/uiIntegration.js').then(({ openGTMPromptModal }) => {
        openGTMPromptModal('cinema-studio', (prompt) => {
          textarea.value = prompt;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.focus();
        });
      }).catch((err) => console.error('[CinemaStudio] GTM Boost failed:', err));
    });
    inputRow.appendChild(gtmBtn);

    // Thumbnail studio button — next to GTM Boost, same design system
    const thumbBtn = document.createElement('button');
    thumbBtn.type = 'button';
    thumbBtn.textContent = '🖼 Thumbnail';
    thumbBtn.title = 'Generate a custom thumbnail';
    thumbBtn.className = 'gtm-boost-btn shrink-0';
    thumbBtn.addEventListener('click', () => {
      const modal = new StudioThumbnailModal({
        appTheme: 'cinema-studio',
        studioId: 'cinema-studio',
        studioName: 'Cinema Studio',
        aspectRatio: currentSettings?.aspect_ratio || '16:9',
        outputType: 'video',
        onApply: ({ imageUrl }) => {
          customThumbnailUrl = imageUrl;
          saveCustomThumbnailToCache('cinema-studio', imageUrl);
        },
        onClear: () => {
          customThumbnailUrl = null;
          clearCustomThumbnailCache('cinema-studio');
        },
      });
      mountStudioThumbnailModal(modal);
      modal.open();
    });
    inputRow.appendChild(thumbBtn);

    subscribeToGtmThumbnails(({ imageUrl }) => {
      customThumbnailUrl = imageUrl;
      saveCustomThumbnailToCache('cinema-studio', imageUrl);
    });

    // --- Reference image upload (the "Upload your scene" step) ---
    // Real upload control that posts the still to the backend and stores the
    // returned URL on currentSettings.referenceUrl so generation can use it
    // as the image-to-video seed.
    const uploadRow = document.createElement('div');
    uploadRow.className = 'w-full';
    const uploadPicker = createUploadPicker({
      anchorContainer: container,
      acceptVideo: false,
      onSelect: ({ url }) => {
        currentSettings.referenceUrl = url;
        showReferenceThumb(url);
        // Switch the model picker to image-to-video models and refresh the
        // label/controls so the selection stays valid for the new mode.
        if (!i2vModels.some(m => m.id === currentSettings.model)) {
          currentSettings.model = (i2vModels[0] && i2vModels[0].id) || currentSettings.model;
        }
        updateModelBtn();
        updateControlsForModel();
      },
      onClear: () => {
        currentSettings.referenceUrl = null;
        showReferenceThumb(null);
        if (!t2vModels.some(m => m.id === currentSettings.model)) {
          currentSettings.model = (t2vModels[0] && t2vModels[0].id) || currentSettings.model;
        }
        updateModelBtn();
        updateControlsForModel();
      },
    });
    uploadRow.appendChild(uploadPicker.trigger);
    uploadPicker.panel.classList.add('mb-2');
    uploadRow.appendChild(uploadPicker.panel);

    function showReferenceThumb(url) {
      const thumb = container.querySelector('#reference-thumb');
      if (!thumb) return;
      if (url) {
        thumb.src = url;
        thumb.classList.remove('hidden');
      } else {
        thumb.classList.add('hidden');
      }
    }

    leftColumn.appendChild(inputRow);
    leftColumn.appendChild(uploadRow);

    // Small reference preview pill (hidden until an image is uploaded)
    const referencePill = document.createElement('div');
    referencePill.className = 'flex items-center gap-2 mt-1';
    referencePill.innerHTML = `
      <img id="reference-thumb" class="hidden w-10 h-10 rounded-lg border border-white/10 object-cover" alt="reference" />
      <span class="text-[10px] text-secondary">Reference scene loaded — used as the seed for your cinematic shot.</span>
    `;
    leftColumn.appendChild(referencePill);

    // 2. Settings Toolbar (Bottom Left)
    const settingsToolbar = document.createElement('div');
    settingsToolbar.className = 'flex items-center gap-3'; // Removed pl-11 to align left

    // Helper: Create Dropdown
    const createDropdown = (items, selected, onSelect, trigger) => {
        const existing = document.querySelectorAll('.custom-dropdown');
        existing.forEach(el => el.remove());

        const rect = trigger.getBoundingClientRect();
        const menu = document.createElement('div');
        menu.className = 'custom-dropdown fixed bg-[#1a1a1a] border border-white/10 rounded-xl py-1 shadow-2xl z-50 flex flex-col min-w-[100px] animate-fade-in';
        menu.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
        menu.style.left = rect.left + 'px';

        items.forEach(item => {
            const btn = document.createElement('button');
            btn.className = `px-3 py-2 text-xs font-bold text-left hover:bg-white/10 transition-colors ${item === selected ? 'text-primary' : 'text-white'}`;
            btn.textContent = item;
            btn.onclick = (e) => {
                e.stopPropagation();
                onSelect(item);
                menu.remove();
            };
            menu.appendChild(btn);
        });

        const closeHandler = (e) => {
            if (!menu.contains(e.target) && e.target !== trigger) {
                menu.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 0);
        document.body.appendChild(menu);
    };

    // Model picker — same catalog-driven dropdown used by Video Studio.
    const modelBtn = document.createElement('button');
    modelBtn.className = 'flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-white/50 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-lg border border-white/5';
    const updateModelBtn = () => {
        const m = (currentSettings.referenceUrl ? i2vModels : t2vModels).find(x => x.id === currentSettings.model)
            || t2vModels.find(x => x.id === currentSettings.model)
            || t2vModels[0];
        const provider = m?.provider || 'muapi';
        const logoUrl = PROVIDER_LOGOS[provider];
        if (logoUrl) {
            modelBtn.innerHTML = `<div class="w-4 h-4 rounded overflow-hidden flex items-center justify-center bg-white/5 shrink-0"><img src="${logoUrl}" alt="" class="w-full h-full object-contain ${invertLogos.includes(provider) ? 'invert' : ''}" /></div> <span class="truncate">${m ? m.name : currentSettings.model}</span>`;
        } else {
            const style = getProviderStyle(provider);
            modelBtn.innerHTML = `<div class="w-4 h-4 bg-primary rounded flex items-center justify-center shadow-lg shadow-primary/20"><span class="text-[8px] font-black text-black">${style.text}</span></div> <span class="truncate">${m ? m.name : currentSettings.model}</span>`;
        }
    };
    updateModelBtn();
    modelBtn.onclick = (e) => { e.stopPropagation(); showModelDropdown(); };
    settingsToolbar.appendChild(modelBtn);

    // Shared model dropdown (glass panel) — lists T2V models, or I2V models
    // when a reference image is loaded, with live search + per-model metadata.
    const modelDropdown = document.createElement('div');
    modelDropdown.className = 'absolute bottom-[102%] left-2 z-50 transition-all opacity-0 pointer-events-none scale-95 origin-bottom-left glass rounded-3xl p-3 translate-y-2 w-[calc(100vw-3rem)] max-w-xs shadow-4xl border border-white/10 flex flex-col';
    settingsToolbar.appendChild(modelDropdown);

    const closeModelDropdown = () => {
        modelDropdown.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
        modelDropdown.classList.remove('opacity-100', 'pointer-events-auto', 'scale-100');
        selectedProvider = 'all';
    };

    function showModelDropdown() {
        const isI2V = !!currentSettings.referenceUrl;
        const models = isI2V ? i2vModels : t2vModels;
        const allModels = [...t2vModels, ...i2vModels];
        const availableProviders = getAvailableProviders(allModels);
        
        modelDropdown.innerHTML = `
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
        
        const sidebarEl = modelDropdown.querySelector('[data-provider-sidebar]');
        const modelListEl = modelDropdown.querySelector('[data-model-list]');
        const providerBadge = modelDropdown.querySelector('[data-provider-badge]');
        const searchInput = modelDropdown.querySelector('[data-provider-search]');

        const refresh = () => {
            sidebarEl.innerHTML = renderProviderSidebar(availableProviders, selectedProvider, (provider) => {
                selectedProvider = provider;
                refresh();
            });
            const query = searchInput ? searchInput.value : '';
            const filtered = filterModels(models, query, selectedProvider);
            const showProviderName = selectedProvider === 'all';
            modelListEl.innerHTML = renderModelList(filtered, currentSettings.model, showProviderName, (m) => {
                currentSettings.model = m.id;
                updateModelBtn();
                updateControlsForModel();
                if (dynamicControls) {
                  dynamicControls.update(getExtendedModel(getModelById(currentSettings.model)));
                }
                closeModelDropdown();
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

        modelDropdown.classList.remove('opacity-0', 'pointer-events-none', 'scale-95');
        modelDropdown.classList.add('opacity-100', 'pointer-events-auto', 'scale-100');
        searchInput.focus();
    }

    // Close the model dropdown when clicking elsewhere.
    document.addEventListener('click', (e) => {
        if (!modelDropdown.contains(e.target) && e.target !== modelBtn) closeModelDropdown();
    });

    // Sync controls (duration/resolution availability) to the selected model.
    function updateControlsForModel() {
        const isI2V = !!currentSettings.referenceUrl;
        const model = (isI2V ? i2vModels : t2vModels).find(m => m.id === currentSettings.model)
            || (isI2V ? getI2VModelById(currentSettings.model) : getVideoModelById(currentSettings.model));
        if (!model) return;
        const durations = isI2V ? getDurationsForI2VModel(model.id) : getDurationsForModel(model.id);
        const resolutions = isI2V ? getResolutionsForI2VModel(model.id) : getResolutionsForVideoModel(model.id);
        if (resolutions && resolutions.length > 0 && !resBtn.dataset.touched) {
            updateResBtn(resolutions[0]);
        }
        if (durations && durations.length > 0) {
            currentSettings.duration = durations[0];
        }
        if (dynamicControls) {
          dynamicControls.update(getExtendedModel(getModelById(currentSettings.model)));
          dynamicControls.setValue('aspect_ratio', currentSettings.aspect_ratio);
        }
    }

    // Aspect Ratio
    const arBtn = document.createElement('button');
    arBtn.className = 'flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-white/50 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-lg border border-white/5';
    const updateArBtn = () => {
        arBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="10" rx="2" ry="2"/></svg> ${currentSettings.aspect_ratio}`;
    };
    updateArBtn();
    arBtn.onclick = () => {
        createDropdown(['16:9', '21:9', '9:16', '1:1', '4:5'], currentSettings.aspect_ratio, (val) => {
            currentSettings.aspect_ratio = val;
            updateArBtn();
            if (dynamicControls) dynamicControls.setValue('aspect_ratio', val);
        }, arBtn);
    };
    settingsToolbar.appendChild(arBtn);

    // Resolution
    const resBtn = document.createElement('button');
    resBtn.className = 'flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-white/50 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-lg border border-white/5';
    const updateResBtn = (val) => {
        resBtn.dataset.value = val || '2K';
        resBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> ${resBtn.dataset.value}`;
    };
    updateResBtn('2K');
    resBtn.onclick = () => {
        createDropdown(['1K', '2K', '4K'], resBtn.dataset.value, (val) => { updateResBtn(val); resBtn.dataset.touched = '1'; }, resBtn);
    };
    settingsToolbar.appendChild(resBtn);
    
    // Camera Builder Toggle Button
    const cameraBuilderBtn = document.createElement('button');
    cameraBuilderBtn.className = 'flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-white/50 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-lg border border-white/5';
    cameraBuilderBtn.setAttribute('data-tooltip', 'Quick camera builder');
    cameraBuilderBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg> Builder`;
    settingsToolbar.appendChild(cameraBuilderBtn);

    // Personalize trigger (opens PersonalizeModal as a pop-up)
    mountPersonalizeTrigger({
        controlsContainer: settingsToolbar,
        getTextarea: () => textarea,
        appId: 'cinema-studio',
    });

    leftColumn.appendChild(settingsToolbar);
    promptBar.appendChild(leftColumn);


    // --- RIGHT GROUP (Summary + Generate) ---
    const rightGroup = document.createElement('div');
    rightGroup.className = 'flex items-center gap-2 h-full self-end mb-1';

    // Summary Card (Triggers Overlay)
    const summaryCard = document.createElement('button');
    // Removed 'hidden' class, added 'flex' and refined width constraints for mobile
    summaryCard.className = 'flex flex-col items-start justify-center px-4 py-2 bg-[#2a2a2a] rounded-xl border border-white/5 hover:border-white/20 transition-colors text-left flex-1 min-w-[100px] md:min-w-[140px] max-w-[240px] h-[56px] relative group overflow-hidden';
    summaryCard.setAttribute('data-tooltip', 'Open camera settings');

    // Dot indicator
    const dot = document.createElement('div');
    dot.className = 'absolute top-2 right-2 w-2 h-2 bg-primary rounded-full shadow-glow-sm';
    summaryCard.appendChild(dot);

    const summaryTitle = document.createElement('span');
    summaryTitle.className = 'text-[10px] font-bold text-white uppercase truncate w-full tracking-wide';
    summaryTitle.textContent = currentSettings.camera;

    const summaryValue = document.createElement('span');
    summaryValue.className = 'text-[10px] font-medium text-white/60 truncate w-full';
    summaryValue.textContent = formatSummaryValue();

    summaryCard.appendChild(summaryTitle);
    summaryCard.appendChild(summaryValue);

    summaryCard.onclick = openOverlay;

    function formatSummaryValue() {
        return `${currentSettings.lens}, ${currentSettings.focal}mm, ${currentSettings.aperture}`;
    }

    function updateSummaryCard() {
        summaryTitle.textContent = currentSettings.camera;
        summaryValue.textContent = `${currentSettings.movement} • ${currentSettings.look}`;
    }

    // Generate Button
    const generateBtn = document.createElement('button');
    generateBtn.type = 'button';
    generateBtn.className = 'h-[56px] px-8 bg-[#d9ff00] text-black rounded-xl font-black text-xs uppercase hover:bg-white transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed';
    generateBtn.setAttribute('data-tooltip', 'Generate cinema shot');
    generateBtn.setAttribute('aria-label', 'Generate cinema shot');
    generateBtn.innerHTML = `GENERATE ✨`;

    rightGroup.appendChild(summaryCard);
    rightGroup.appendChild(generateBtn);
    promptBar.appendChild(rightGroup);

    promptBarWrapper.appendChild(promptBar);
    // Place the controls ABOVE the inline-instruction tips (which are appended
    // earlier as `inlineInstructions`), instead of pinning them to the bottom.
    container.insertBefore(promptBarWrapper, inlineInstructions);

    // ==========================================
    // 3B. CAMERA BUILDER PANEL (Collapsible)
    // ==========================================
    const cameraBuilderPanel = document.createElement('div');
    cameraBuilderPanel.className = 'absolute bottom-8 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-full z-20';
    cameraBuilderPanel.style.display = 'none'; // Hidden by default
    
    const builderCard = document.createElement('div');
    builderCard.className = 'bg-[#1a1a1a] border border-white/10 rounded-2xl p-4 shadow-3xl';
    
    builderCard.innerHTML = `
        <div class="flex items-center justify-between mb-4">
            <h4 class="text-xs font-bold text-white">Camera Builder</h4>
            <button id="close-builder-btn" class="text-white/40 hover:text-white transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
        </div>
        
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div class="flex flex-col gap-1.5">
                <label class="text-[10px] font-bold text-muted uppercase">Camera</label>
                <select id="builder-camera" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50">
                    ${Object.keys(CAMERA_MAP).map(c => `<option value="${c}" ${c === currentSettings.camera ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
            </div>
            <div class="flex flex-col gap-1.5">
                <label class="text-[10px] font-bold text-muted uppercase">Lens</label>
                <select id="builder-lens" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50">
                    ${Object.keys(LENS_MAP).map(l => `<option value="${l}" ${l === currentSettings.lens ? 'selected' : ''}>${l}</option>`).join('')}
                </select>
            </div>
            <div class="flex flex-col gap-1.5">
                <label class="text-[10px] font-bold text-muted uppercase">Focal</label>
                <select id="builder-focal" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50">
                    ${Object.keys(FOCAL_PERSPECTIVE).map(f => `<option value="${f}" ${f === currentSettings.focal ? 'selected' : ''}>${f}mm</option>`).join('')}
                </select>
            </div>
            <div class="flex flex-col gap-1.5">
                <label class="text-[10px] font-bold text-muted uppercase">Aperture</label>
                <select id="builder-aperture" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50">
                    ${Object.keys(APERTURE_EFFECT).map(a => `<option value="${a}" ${a === currentSettings.aperture ? 'selected' : ''}>${a}</option>`).join('')}
                </select>
            </div>
            <div class="flex flex-col gap-1.5">
                <label class="text-[10px] font-bold text-muted uppercase">Movement</label>
                <select id="builder-movement" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50">
                    ${Object.keys(CAMERA_MOVEMENTS).map(m => `<option value="${m}" ${m === currentSettings.movement ? 'selected' : ''}>${m}</option>`).join('')}
                </select>
            </div>
            <div class="flex flex-col gap-1.5">
                <label class="text-[10px] font-bold text-muted uppercase">Film Look</label>
                <select id="builder-look" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50">
                    ${Object.keys(FILM_LOOKS).map(l => `<option value="${l}" ${l === currentSettings.look ? 'selected' : ''}>${l}</option>`).join('')}
                </select>
            </div>
            ${currentSettings.referenceUrl ? `
            <div class="flex flex-col gap-1.5 col-span-2 md:col-span-2">
                <label class="text-[10px] font-bold text-muted uppercase">Reference Scene</label>
                <div class="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                    <img src="${currentSettings.referenceUrl}" class="w-8 h-8 rounded object-cover" alt="reference" />
                    <span class="text-xs text-white/70 truncate">Loaded — will seed the cinematic shot.</span>
                </div>
            </div>
            ` : ''}
        </div>
        
        <div class="flex flex-col gap-2">
            <label class="text-[10px] font-bold text-muted uppercase">Preview</label>
            <div id="builder-preview" class="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-xs min-h-[40px]"></div>
            <button id="apply-builder-btn" class="px-4 py-2 bg-primary text-black rounded-lg text-xs font-bold hover:shadow-glow transition-all">
                Use This Setup
            </button>
        </div>
    `;
    
    cameraBuilderPanel.appendChild(builderCard);
    container.appendChild(cameraBuilderPanel);
    
    // Camera Builder toggle logic
    cameraBuilderBtn.onclick = () => {
        showCameraBuilder = !showCameraBuilder;
        cameraBuilderPanel.style.display = showCameraBuilder ? 'block' : 'none';
        if (showCameraBuilder) updateBuilderPreview();
    };
    
    const closeBuilderBtn = cameraBuilderPanel.querySelector('#close-builder-btn');
    if (closeBuilderBtn) closeBuilderBtn.onclick = () => {
        showCameraBuilder = false;
        cameraBuilderPanel.style.display = 'none';
    };
    
    // Update builder preview
    const updateBuilderPreview = () => {
        const camera = builderCard.querySelector('#builder-camera')?.value || currentSettings.camera;
        const lens = builderCard.querySelector('#builder-lens')?.value || currentSettings.lens;
        const focal = parseInt(builderCard.querySelector('#builder-focal')?.value || currentSettings.focal);
        const aperture = builderCard.querySelector('#builder-aperture')?.value || currentSettings.aperture;
        const movement = builderCard.querySelector('#builder-movement')?.value || currentSettings.movement;
        const look = builderCard.querySelector('#builder-look')?.value || currentSettings.look;

        const preview = buildNanoBananaPrompt('', camera, lens, focal, aperture) +
            `, ${CAMERA_MOVEMENTS[movement] || ''}, ${FILM_LOOKS[look] || ''}`;
        const previewEl = builderCard.querySelector('#builder-preview');
        if (previewEl) {
            previewEl.textContent = preview || 'Select camera settings to see preview...';
        }
    };

    // Builder event listeners
    const builderCamera = builderCard.querySelector('#builder-camera');
    const builderLens = builderCard.querySelector('#builder-lens');
    const builderFocal = builderCard.querySelector('#builder-focal');
    const builderAperture = builderCard.querySelector('#builder-aperture');
    const builderMovement = builderCard.querySelector('#builder-movement');
    const builderLook = builderCard.querySelector('#builder-look');

    if (builderCamera) builderCamera.onchange = updateBuilderPreview;
    if (builderLens) builderLens.onchange = updateBuilderPreview;
    if (builderFocal) builderFocal.onchange = updateBuilderPreview;
    if (builderAperture) builderAperture.onchange = updateBuilderPreview;
    if (builderMovement) builderMovement.onchange = updateBuilderPreview;
    if (builderLook) builderLook.onchange = updateBuilderPreview;

    const applyBuilderBtn = builderCard.querySelector('#apply-builder-btn');
    if (applyBuilderBtn) {
        applyBuilderBtn.onclick = () => {
            currentSettings.camera = builderCamera?.value || currentSettings.camera;
            currentSettings.lens = builderLens?.value || currentSettings.lens;
            currentSettings.focal = parseInt(builderFocal?.value || currentSettings.focal);
            currentSettings.aperture = builderAperture?.value || currentSettings.aperture;
            currentSettings.movement = builderMovement?.value || currentSettings.movement;
            currentSettings.look = builderLook?.value || currentSettings.look;
            updateSummaryCard();
            showCameraBuilder = false;
            cameraBuilderPanel.style.display = 'none';
        };
    }


    // ==========================================
    // 3. HISTORY SIDEBAR
    // ==========================================
    const generationHistory = [];

    // Tracks the currently displayed result so the Download button can grab
    // the right URL/extension (video vs still) regardless of which media
    // element showCanvas() rendered last.
    let currentResultUrl = null;

    // History Sidebar - VISIBLE BY DEFAULT (removed translate-x-full opacity-0)
    const historySidebar = document.createElement('div');
    historySidebar.className = 'fixed right-0 top-0 h-full w-20 md:w-24 bg-black/60 backdrop-blur-xl border-l border-white/5 z-50 flex flex-col items-center py-4 gap-3 overflow-y-auto transition-all duration-500';

    const historyLabel = document.createElement('div');
    historyLabel.className = 'text-[9px] font-bold text-white/40 uppercase tracking-widest mb-2';
    historyLabel.textContent = 'History';
    historySidebar.appendChild(historyLabel);

    const historyList = document.createElement('div');
    historyList.className = 'flex flex-col gap-2 w-full px-2';
    historySidebar.appendChild(historyList);

    container.appendChild(historySidebar);

    // ==========================================
    // 4. ADVANCED OPTIONS PANEL (control engine)
    // ==========================================
    const advancedPanel = document.createElement('div');
    advancedPanel.className = 'w-full max-w-3xl mx-auto px-4 mt-6 animate-fade-in-up hidden';
    advancedPanel.id = 'cinema-advanced-panel';
    const advancedCard = document.createElement('div');
    advancedCard.className = 'bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex flex-col gap-4';
    advancedPanel.appendChild(advancedCard);

    const advHeader = document.createElement('div');
    advHeader.className = 'flex items-center justify-between pb-3 border-b border-white/5';
    advHeader.innerHTML = `
        <h3 class="text-sm font-bold text-white">Advanced Options</h3>
        <button id="close-cinema-adv-btn" class="text-white/40 hover:text-white transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
    `;
    advancedPanel.appendChild(advHeader);

    const advancedControlsContainer = document.createElement('div');
    advancedControlsContainer.className = 'flex flex-col gap-4';
    advancedCard.appendChild(advancedControlsContainer);

    const dynamicControls = createAdvancedControls({
      model: getExtendedModel(getModelById(currentSettings.model)),
      state: {},
      container: advancedControlsContainer,
      exclude: new Set(['style', 'batch_count', 'prompt']),
      extraInputs: {
        duration: { type: 'integer', title: 'Duration (s)', default: 5, minValue: 1, maxValue: 60, step: 1, group: 'basic' },
        resolution: { type: 'enum', title: 'Resolution', options: ['1K', '2K', '4K'], default: '2K', group: 'basic' },
      },
      onChange: (key, value) => {
        if (key === 'duration') currentSettings.duration = value;
        if (key === 'resolution') { resBtn.dataset.value = value; updateResBtn(value); }
        if (key === 'negative_prompt') currentSettings.negativePrompt = value;
        if (key === 'seed') currentSettings.seed = value;
      }
    });
    container.appendChild(advancedPanel);

    const toggleAdvanced = () => {
      showAdvanced = !showAdvanced;
      advancedPanel.classList.toggle('hidden', !showAdvanced);
      document.getElementById('advanced-btn-label').textContent = showAdvanced ? 'Less' : 'Advanced';
    };

    // ==========================================
    // 4. CANVAS AREA (Result View)
    // ==========================================
    const canvas = document.createElement('div');
    canvas.className = 'absolute inset-0 flex flex-col items-center justify-center p-4 min-[800px]:p-16 z-30 opacity-0 pointer-events-none transition-all duration-1000 translate-y-10 scale-95 bg-black/90 backdrop-blur-3xl';
    canvas.setAttribute('role', 'status');
    canvas.setAttribute('aria-live', 'polite');

    const imageContainer = document.createElement('div');
    imageContainer.className = 'relative group max-w-full max-h-[70vh] flex items-center justify-center';

    const resultImg = document.createElement('img');
    resultImg.className = 'max-h-[60vh] max-w-[90vw] rounded-2xl shadow-2xl border border-white/10 object-contain';
    imageContainer.appendChild(resultImg);
    canvas.appendChild(imageContainer);

    // Canvas Controls
    const canvasControls = document.createElement('div');
    canvasControls.className = 'mt-8 flex gap-3 opacity-0 transition-opacity delay-500 duration-500 justify-center';

    const createActionBtn = (label, primary = false) => {
        const btn = document.createElement('button');
        btn.className = primary
            ? 'bg-[#d9ff00] text-black px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide hover:bg-white transition-colors shadow-glow-sm hover:scale-105 active:scale-95'
            : 'bg-white/10 hover:bg-white/20 px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all border border-white/5 backdrop-blur-lg text-white hover:border-white/20';
        btn.textContent = label;
        return btn;
    };

    const regenerateBtn = createActionBtn('↻ Regenerate');
    const downloadBtn = createActionBtn('↓ Download', true);
    const newPromptBtn = createActionBtn('+ New Shot');

    canvasControls.appendChild(regenerateBtn);
    canvasControls.appendChild(downloadBtn);
    canvasControls.appendChild(newPromptBtn);
    canvas.appendChild(canvasControls);

    container.appendChild(canvas);

    // --- History Logic ---
    const renderHistory = () => {
        historyList.innerHTML = '';
        generationHistory.forEach((entry, idx) => {
            const thumb = document.createElement('div');
            thumb.className = `relative group/thumb cursor-pointer rounded-lg overflow-hidden border-2 transition-all duration-300 aspect-square ${idx === 0 ? 'border-[#d9ff00] shadow-glow-sm' : 'border-white/10 hover:border-white/30'}`;

            // Safe media creation - prevents XSS from user-provided URLs.
            // Render a <video> for cinematic video results, <img> for stills.
            const isVideo = /\.(mp4|webm|mov|m4v)(\?|$)|video\//i.test(entry.url);
            let media;
            if (isVideo) {
                const vid = document.createElement('video');
                vid.src = entry.url;
                vid.muted = true;
                vid.loop = true;
                vid.playsInline = true;
                vid.className = 'w-full h-full object-cover opacity-80 group-hover/thumb:opacity-100 transition-opacity';
                media = vid;
            } else {
                media = createSafeImage(entry.url, 'Generated image', 'w-full h-full object-cover opacity-80 group-hover/thumb:opacity-100 transition-opacity');
            }
            thumb.appendChild(media);

            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'absolute inset-0 bg-black/50 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center';
            
            const loadText = document.createElement('span');
            loadText.className = 'text-[8px] font-bold text-white uppercase';
            loadText.textContent = 'Load';
            overlay.appendChild(loadText);
            thumb.appendChild(overlay);

            thumb.onclick = () => loadHistoryItem(entry, thumb);
            historyList.appendChild(thumb);
        });
    };

    const addToHistory = (entry) => {
        generationHistory.unshift(entry);
        try {
            localStorage.setItem('cinema_history', JSON.stringify(generationHistory.slice(0, 50)));
        } catch (e) {
            // Ignore storage errors (private mode, quota exceeded, etc.)
        }
        renderHistory();
    };

    const loadHistoryItem = (entry, thumbElement) => {
        // Restore Settings
        if (entry.settings) {
            currentSettings.camera = entry.settings.camera;
            currentSettings.lens = entry.settings.lens;
            currentSettings.focal = entry.settings.focal;
            currentSettings.aperture = entry.settings.aperture;
            currentSettings.movement = entry.settings.movement || 'Static';
            currentSettings.look = entry.settings.look || 'Natural';
            currentSettings.aspect_ratio = entry.settings.aspect_ratio;

            // Update UI elements
            textarea.value = entry.settings.prompt || '';
            updateSummaryCard();
            updateArBtn();
            updateResBtn(entry.settings.resolution || '2K');
        }

        showCanvas(entry.url);

        // Highlight active history item
        if (thumbElement) {
            historyList.querySelectorAll('div').forEach(t => {
                t.classList.remove('border-[#d9ff00]', 'shadow-glow-sm');
                t.classList.add('border-white/10');
            });
            thumbElement.classList.remove('border-white/10');
            thumbElement.classList.add('border-[#d9ff00]', 'shadow-glow-sm');
        }
    };

    const showCanvas = (url) => {
        currentResultUrl = url;
        // Render a <video> for cinematic video results, <img> for stills.
        const isVideo = /\.(mp4|webm|mov|m4v)(\?|$)|video\//i.test(url);
        imageContainer.innerHTML = '';
        if (isVideo) {
            const vid = document.createElement('video');
            vid.src = url;
            vid.controls = true;
            vid.autoplay = true;
            vid.loop = true;
            vid.className = 'max-h-[60vh] max-w-[90vw] rounded-2xl shadow-2xl border border-white/10 object-contain';
            imageContainer.appendChild(vid);
        } else {
            const img = document.createElement('img');
            img.src = url;
            img.className = 'max-h-[60vh] max-w-[90vw] rounded-2xl shadow-2xl border border-white/10 object-contain';
            imageContainer.appendChild(img);
        }

        // Hide Input UI
        heroSection.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
        promptBarWrapper.classList.add('opacity-0', 'pointer-events-none', 'translate-y-20');

        // Show Canvas
        canvas.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-10', 'scale-95');
        canvas.classList.add('opacity-100', 'translate-y-0', 'scale-100');
        canvasControls.classList.remove('opacity-0');
        canvasControls.classList.add('opacity-100');
    };

    const resetToPrompt = () => {
        // Hide Canvas
        canvas.classList.add('opacity-0', 'pointer-events-none', 'translate-y-10', 'scale-95');
        canvas.classList.remove('opacity-100', 'translate-y-0', 'scale-100');

        // Show Input UI
        heroSection.classList.remove('opacity-0', 'pointer-events-none', 'scale-95');
        promptBarWrapper.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-20');

        // Clear prompt for new shot?
        textarea.value = '';
        textarea.focus();
    };

    // Load saved history
    try {
        const saved = JSON.parse(localStorage.getItem('cinema_history') || '[]');
        if (saved.length > 0) {
            saved.forEach(e => generationHistory.push(e));
            renderHistory();
        }
    } catch (e) { }

    // Actions
    newPromptBtn.onclick = resetToPrompt;

    regenerateBtn.onclick = () => {
        // Re-run generation on the current prompt/settings without clearing
        // the textarea (resetToPrompt would wipe it and produce an empty shot).
        generateBtn.click();
    };

    downloadBtn.onclick = async () => {
        if (!(await requireEntitlement())) return;
        const url = currentResultUrl;
        if (!url) return;
        const isVideo = /\.(mp4|webm|mov|m4v)(\?|$)|video\//i.test(url);
        const ext = isVideo ? 'mp4' : 'jpg';
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `cinema-shot-${Date.now()}.${ext}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        } catch (err) {
            window.open(url, '_blank');
        }
    };

    // ==========================================
    // 5. GENERATION LOGIC UPDATE
    // ==========================================
    generateBtn.onclick = async () => {
        if (!(await requireEntitlement())) return;
        const activeProfile = (() => { try { return JSON.parse(localStorage.getItem('remix_contact_profiles') || '[]').find((p) => p.id === localStorage.getItem('remix_selected_contact_id')) || null; } catch { return null; } })();
        const basePrompt = replaceTokensInPrompt(textarea.value.trim(), activeProfile);
        if (!basePrompt) return;

        const apiKey = apiKeyManager.getKey();
        if (!apiKey) {
            AuthModal(() => generateBtn.click());
            return;
        }

        generateBtn.disabled = true;
        generateBtn.innerHTML = "SHOOTING...";

        // Compile Prompt — include camera movement + film look so the
        // "Render the shot" step produces a real cinematic video.
        const cameraDesc = `${CAMERA_MAP[currentSettings.camera] || currentSettings.camera}`;
        const lensDesc = `${LENS_MAP[currentSettings.lens] || currentSettings.lens}`;
        const perspective = FOCAL_PERSPECTIVE[currentSettings.focal] || '';
        const depthEffect = APERTURE_EFFECT[currentSettings.aperture] || '';
        const movementDesc = CAMERA_MOVEMENTS[currentSettings.movement] || '';
        const lookDesc = FILM_LOOKS[currentSettings.look] || '';

        const finalPrompt = [
            basePrompt,
            `shot on a ${cameraDesc}`,
            `using a ${lensDesc} at ${currentSettings.focal}mm${perspective ? ` (${perspective})` : ''}`,
            `aperture ${currentSettings.aperture}`,
            depthEffect,
            movementDesc,
            lookDesc,
            'cinematic lighting',
            'natural color science',
            'high dynamic range',
            'professional cinematography',
            '8K resolution'
        ].filter(Boolean).join(', ');

        try {
            const dynamicPayload = dynamicControls.getPayload({});
            const resolution = (dynamicPayload.resolution || resBtn.dataset.value || '2k').toLowerCase();
            const isRef = !!currentSettings.referenceUrl;

            const catalogModel = isRef ? getI2VModelById(currentSettings.model) : getVideoModelById(currentSettings.model);
            const resolvedModel = (catalogModel && catalogModel.id) || currentSettings.model
                || (isRef ? 'kling-v2.6-pro-i2v' : 'kling-v2.6-pro-t2v');

            const durations = isRef ? getDurationsForI2VModel(resolvedModel) : getDurationsForModel(resolvedModel);
            const duration = dynamicPayload.duration || ((durations && durations.length > 0) ? durations[0] : (currentSettings.duration || 5));

            let res;
            if (isRef) {
                const i2vParams = {
                    model: resolvedModel,
                    image_url: currentSettings.referenceUrl,
                    prompt: finalPrompt,
                    ...dynamicPayload,
                    duration,
                    resolution,
                };
                if (customThumbnailUrl) i2vParams.thumbnail_url = customThumbnailUrl;
                res = await muapi.generateI2V(i2vParams);
            } else {
                const t2vParams = {
                    model: resolvedModel,
                    prompt: finalPrompt,
                    ...dynamicPayload,
                    duration,
                    resolution,
                };
                if (customThumbnailUrl) t2vParams.thumbnail_url = customThumbnailUrl;
                res = await muapi.generateVideo(t2vParams);
            }

            if (res && res.url) {
                addToHistory({
                    url: res.url,
                    timestamp: Date.now(),
                    settings: {
                        prompt: basePrompt,
                        ...currentSettings,
                        resolution: dynamicPayload.resolution || resBtn.dataset.value
                    }
                });

                showCanvas(res.url);
            } else {
                throw new Error('No Data');
            }

        } catch (e) {
            console.error(e);
            alert('Generation Failed: ' + e.message);
        } finally {
            generateBtn.disabled = false;
            generateBtn.innerHTML = `GENERATE ✨`;
        }
    };

    return container;
}
