import { getTemplateById } from '../lib/templates.js';
import { normalizeTemplate } from '../lib/templateAdapter.js';
import { resolveTemplate } from '../lib/showcaseTemplateResolver.js';
import { getTemplateThumbnailCandidates, saveCustomThumbnailToCache, clearCustomThumbnailCache, getCustomThumbnailFromCache } from '../lib/thumbnails.js';
import { getTemplateSpecs, hasEnhancedSpecs } from '../lib/templateSpecs.js';
import { muapi } from '../lib/muapi.js';
import { saveGeneration } from '../lib/generationHistory.js';
import { resolveModel, normalizeAspectRatio, normalizeDuration, applyFormStateToParams, attachThumbnail, buildNegativePrompt, validateBeforeGenerate, formatGenerationError } from '../lib/templateGenerationOrchestrator.js';
import { t2iModels, i2iModels, i2vModels, t2vModels, v2vModels, getV2VModelById } from '../lib/models.js';
import { getEnrichedModels } from '../lib/modelCatalog.js';
import { mountModelSelector, PROVIDER_LOGOS, invertLogos, getProviderStyle, positionModelSelectorDropdown, renderProviderLogoImg } from '../lib/modelSelectorUI.js';
import { AuthModal } from './AuthModal.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import { createTemplateMediaField, extractTemplateMedia, routeTemplateGeneration, applyTemplateMediaToParams, templateMediaRoute, modelsForRoute, modelForRoute, TEMPLATE_ROUTE_LABELS, createVideoSettingsControls, snapAspectRatioForModel, openStudioModelPicker, findTemplateModel } from '../lib/templateMedia.js';
import { navigate } from '../lib/router.js';
import { mountStudioDrawer, createStudioMenuButton } from '../lib/studioChrome.js';
import { sanitizeUrl } from '../lib/security.js';
import { TemplateThumbnailModal, mountThumbnailModal } from './modals/TemplateThumbnailModal.jsx';
import { mountPersonalizeTrigger } from './personalize/personalizePopover.js';
import { getGtmContext } from '../lib/gtmContextStore.js';
import { openSocialPublish } from '../lib/socialPublishHelpers.js';
import { openPromptGallery } from '../lib/promptGalleryIntegration.js';
import { openRecipeModal } from '../lib/recipeIntegration.js';
import { openMonetizationHub } from '../lib/monetizationIntegration.js';
import { addCaptionButton } from '../lib/editor/captionActions.js';
import { composeTemplatePrompt, defaultCreativeTiles, detectTemplateNiche } from '../lib/templatePromptComposer.js';
import { getTemplateStudioAsset } from '../lib/personalizerAdapters.js';

export function TemplateStudio(templateId) {
  let template = getTemplateById(templateId);
  if (template) {
    template = normalizeTemplate(template);
  }

  // Fallback: if the template isn't in the built-in templates.js registry,
  // try the unified showcase resolver (covers all 512 MiniMax H3 / Seedance 2.5 / ZeroLu demos).
  if (!template) {
    template = resolveTemplate(templateId);
  }

  if (!template) {
    const errorContainer = document.createElement('div');
    errorContainer.className = 'min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center';
    errorContainer.innerHTML = `<div class="text-zinc-400">Template not found</div>`;
    return errorContainer;
  }

  // Get enhanced specs if available
  const specs = getTemplateSpecs(templateId) || {};
  const hasSpecs = hasEnhancedSpecs(templateId);

  // Support both input structures
  const allInputs = [
    ...(template.inputs || []),
    ...(template.quickInputs || []),
    ...(template.advancedInputs || [])
  ];

  // State management
  const formState = {};
  let activeTab = 'Enhanced Prompt';
  const outputTabValues = {};
  let aiEnhancer = true;
  let lastBuiltPrompt = '';
  // True while the Enhanced Prompt shown is the user's own edit (wand or
  // typing); any change to the inputs rebuilds it from all of them.
  let promptManuallyEdited = false;
  let showAdvanced = false;
  let uploadedUrl = null;
  let isGenerating = false;
  let lastGeneratedUrl = '';
  let mediaRouteBadge = null;
  // Set by the model picker: switches its model list when the route changes.
  let syncModelPickerToRoute = null;
  // Mode of the variant picked in the Video / Image Studio model picker
  // (t2v / i2v / v2v / t2i / i2i); null until the user picks one.
  let pickedMode = null;
  // Duration / resolution / native-audio controls (video templates).
  let videoSettings = null;
  // Template duration / resolution selects are folded into videoSettings so
  // only values the selected model accepts are offered.
  const templateVideoPrefs = {};
  // Which MuAPI path Generate will take with the media currently attached.
  function currentMediaRoute() {
    const media = extractTemplateMedia(formState, allInputs);
    return { media, ...routeTemplateGeneration({ outputType: template.outputType, modelType: template.modelType, model: selectedModel, pickedMode, ...media }) };
  }
  function refreshMediaRoute() {
    const { route } = currentMediaRoute();
    if (mediaRouteBadge) mediaRouteBadge.textContent = TEMPLATE_ROUTE_LABELS[route] || route;
    // Like the Video Studio: attaching an image / video swaps the model
    // picker to models that accept it.
    if (syncModelPickerToRoute) syncModelPickerToRoute(route);
    if (videoSettings) videoSettings.refresh();
  }
  // Validate the template's default model against its modelType so video
  // generation always starts with a real, type-compatible model ID.
  // Effect models (ai-video-effects, motion-controls, video-effects, vfx, …)
  // ARE valid i2v IDs in models.js — keep them when they match the type.
  const modelListsByType = { i2i: i2iModels, t2i: t2iModels, i2v: i2vModels, t2v: t2vModels, v2v: v2vModels };
  const getFallbackList = (modelType) => modelListsByType[modelType] || [];
  const isValidModelForType = (modelId, modelType) => {
    if (!modelId || !modelType) return false;
    return !!getFallbackList(modelType).find(m => m && m.id === modelId);
  };
  const getValidModel = (tpl, preferred) => resolveModel(tpl, preferred, modelListsByType);
  let selectedModel = getValidModel(template);
  let loadedModels = [];
  let primaryPromptField = null;
  let customThumbnailUrl = getCustomThumbnailFromCache(template.id);

  // Restore the last GTM context the user picked in the prompt modal,
  // if any. The modal persists selections to localStorage on apply; we
  // log them here so downstream features (defaults, preselects) can
  // pick them up later. The `void` keeps the variable from being
  // flagged as unused until something consumes it.
  try {
    const restoredGtmContext = getGtmContext('template-studio');
    if (restoredGtmContext && typeof console !== 'undefined' && console.info) {
      console.info('[TemplateStudio] Restored GTM context', restoredGtmContext);
    }
    void restoredGtmContext;
  } catch { /* ignore */ }
  let lastGenerationParams = null; // Store params for retry
  let retryCount = 0;
  const MAX_RETRIES = 2;

  // Creative Intelligence cards: what the prompt composer uses (editable).
  const tileState = defaultCreativeTiles(template.outputType === 'image' ? 'image' : 'video', specs);
  if (!tileState.niche) tileState.niche = detectTemplateNiche({ template });
  const tileEdited = {};
  const escapeAttr = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Listeners on document / window, removed by container.cleanup() (called by
  // the router when leaving the page) so a closed studio is not kept alive.
  const globalCleanups = [];
  const addGlobalListener = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    globalCleanups.push(() => target.removeEventListener(type, handler, options));
  };

  // Create full-page wrapper
  const container = document.createElement('div');
  container.className = 'template-studio min-h-screen bg-[#0a0a0b] text-white';

  // Create app shell row
  const appShell = document.createElement('div');
  appShell.className = 'flex min-h-screen';

  // Left rail spacer
  const leftRail = document.createElement('aside');
  leftRail.className = 'hidden w-[68px] shrink-0 border-r border-white/5 bg-black/90 lg:block';
  appShell.appendChild(leftRail);

  // Main content area
  const main = document.createElement('main');
  main.className = 'flex-1';

  // Top nav row
  const navHeader = document.createElement('div');
  navHeader.className = 'border-b border-white/5 px-6 py-4';
  navHeader.innerHTML = `
    <div class="flex items-center gap-3">
      <div id="studio-menu-slot"></div>
      <div class="flex items-center gap-8 overflow-x-auto text-sm text-zinc-400">
        <button class="hover:text-white transition" data-nav="explore">Explore</button>
        <button class="hover:text-white transition" data-nav="image">Image</button>
        <button class="hover:text-white transition" data-nav="video">Video</button>
        <button class="hover:text-white transition" data-nav="tools">Storyboard</button>
        <button class="hover:text-white transition" data-nav="edit">Edit</button>
        <button class="hover:text-white transition" data-nav="character">Character</button>
        <button class="hover:text-white transition" data-nav="effects">Vibe Motion</button>
        <button class="hover:text-white transition" data-nav="cinema">Cinema Studio</button>
        <button class="hover:text-white transition" data-nav="influencer">AI Influencer</button>
        <button class="hover:text-white transition" data-nav="apps">Apps</button>
        <button class="text-white font-semibold" data-nav="templates">Templates</button>
        <button class="hover:text-white transition" data-nav="assist">Assist</button>
        <button class="hover:text-white transition" data-nav="community">Community</button>
      </div>
    </div>
  `;
  main.appendChild(navHeader);

  // All-studios side menu (drawer) — opened via the menu icon
  const drawer = mountStudioDrawer(document.body, { currentRoute: 'templates' });
  const menuSlot = navHeader.querySelector('#studio-menu-slot');
  if (menuSlot) menuSlot.appendChild(createStudioMenuButton(drawer.toggle));

  // Add nav click handlers
  navHeader.querySelectorAll('[data-nav]').forEach(btn => {
    btn.onclick = () => navigate(btn.dataset.nav);
  });

  // Content area with padding
  const contentArea = document.createElement('div');
  contentArea.className = 'px-8 py-10';

  // Back button
  const backBtn = document.createElement('button');
  backBtn.className = 'mb-10 text-sm text-zinc-400 transition hover:text-white';
  backBtn.innerHTML = '&larr; Back to Apps';
  backBtn.onclick = () => navigate('templates');
  contentArea.appendChild(backBtn);

  // Centered template container
  const centeredContainer = document.createElement('div');
  centeredContainer.className = 'mx-auto max-w-[980px]';

  // Hero section - centered
  const heroSection = document.createElement('div');
  heroSection.className = 'flex flex-col items-center text-center';

  // Thumbnail
  const thumbnailEl = document.createElement('div');
  thumbnailEl.className = 'mb-4 h-24 w-24 rounded-[28px] border border-emerald-400/20 shadow-[0_0_40px_rgba(16,185,129,0.10)] overflow-hidden flex items-center justify-center';
  
  const img = document.createElement('img');
  img.id = 'template-hero-thumb';
  img.alt = template.name;
  img.className = 'w-full h-full object-cover';
  // Try per-template paths first, then industry fallbacks, then category
  const candidates = getTemplateThumbnailCandidates(template);
  let candidateIndex = 0;
  img.src = candidates[0];
  img.onerror = () => {
    candidateIndex++;
    if (candidateIndex < candidates.length) {
      img.src = candidates[candidateIndex];
      return;
    }
    img.style.display = 'none';
    thumbnailEl.classList.add('thumb-fallback');
    thumbnailEl.textContent = template.icon || '🎬';
  };
  thumbnailEl.appendChild(img);
  heroSection.appendChild(thumbnailEl);

  // Thumbnail action button — matches .gtm-boost-btn styling so it is
  // discoverable alongside the GTM Boost control in the hero section.
  const thumbAction = document.createElement('button');
  thumbAction.className = 'mb-5 btn-action-secondary shrink-0';
  thumbAction.style.background = 'linear-gradient(135deg, #10b981, #34d399)';
  thumbAction.style.boxShadow = '0 4px 14px rgba(16,185,129,0.3)';
  thumbAction.style.color = '#022c22';
  thumbAction.textContent = '🖼 Thumbnail';
  thumbAction.onclick = () => {
    const modal = new TemplateThumbnailModal({
      appTheme: 'template-studio',
      template,
      layout: 'panel',
      onApply: ({ imageUrl, revisedPrompt }) => {
        img.src = imageUrl + '?v=' + Date.now();
        customThumbnailUrl = imageUrl;
        saveCustomThumbnailToCache(template.id, imageUrl);
        if (revisedPrompt && primaryPromptField) {
          primaryPromptField.value = revisedPrompt;
          primaryPromptField.dispatchEvent(new Event('input', { bubbles: true }));
          primaryPromptField.dispatchEvent(new Event('change', { bubbles: true }));
          if (promptFieldName) {
            formState[promptFieldName] = revisedPrompt;
          }
        }
      },
      onClear: () => {
        customThumbnailUrl = null;
        clearCustomThumbnailCache(template.id);
      },
    });
    mountThumbnailModal(modal);
    modal.open();
  };
  heroSection.appendChild(thumbAction);

  // Title
  const title = document.createElement('h1');
  title.className = 'text-5xl font-semibold tracking-tight';
  title.textContent = template.name;
  heroSection.appendChild(title);

  // Description
  const desc = document.createElement('p');
  desc.className = 'mt-3 text-lg text-zinc-400';
  desc.textContent = hasSpecs && specs.uiDescription ? specs.uiDescription : template.description;
  heroSection.appendChild(desc);

  // Pills
  const pills = document.createElement('div');
  pills.className = 'mt-5 flex flex-wrap gap-2 justify-center';
  pills.innerHTML = `
    <span class="inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/12 px-3 py-1 text-xs font-medium text-emerald-100">${template.outputType === 'video' ? 'Video' : 'Image'}</span>
    <span class="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-white/75">${template.category}</span>
    ${hasSpecs && specs.coreUseCase ? `<span class="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-white/75">${specs.coreUseCase}</span>` : ''}
  `;
  heroSection.appendChild(pills);
  centeredContainer.appendChild(heroSection);

  // Two-column grid
  const grid = document.createElement('div');
  grid.className = 'mt-10 grid gap-8 xl:grid-cols-[520px_1fr] xl:items-start';

  // Left panel - Form inputs
  const leftPanel = document.createElement('div');
  leftPanel.className = 'rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.02))] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

  // Identify the primary prompt field. Templates usually have one input
  // with name === 'prompt'; if not, fall back to the first text/textarea
  // input. We track its DOM element and formState key so the GTM Boost
  // callback can write the generated prompt back into it.
  const promptInput = allInputs.find(i => i && i.name === 'prompt' && (i.type === 'text' || i.type === 'textarea'))
    || allInputs.find(i => i && (i.type === 'text' || i.type === 'textarea'));
  const promptFieldName = promptInput ? promptInput.name : null;
  let promptEl = null; // assigned during the input loop below

  // Build form fields
  const isVideoTemplate = (template.outputType || (template.modelType === 't2i' || template.modelType === 'i2i' ? 'image' : 'video')) === 'video';
  allInputs.forEach(input => {
    if (isVideoTemplate && input && input.type === 'select' && (input.name === 'duration' || input.name === 'resolution')) {
      templateVideoPrefs[input.name] = (input.options || [])[0];
      return;
    }
    const fieldWrapper = document.createElement('div');
    fieldWrapper.className = 'mt-6 first:mt-0';

    const isPrimaryPrompt = input.name === promptFieldName;
    const showTextButtons = input.type === 'text' || input.type === 'textarea';
    const label = document.createElement('div');
    label.className = 'mb-3 flex items-center justify-between gap-3';
    label.innerHTML = `
      <div class="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">${input.label}</div>
      ${showTextButtons ? `
        <div class="flex items-center gap-2">
          <button class="enhancer-btn rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] transition border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-white" data-field="${input.name}">Enhance</button>
           ${isPrimaryPrompt ? '<div class="overflow-menu shrink-0" data-gtm-menu="primary"><button type="button" class="overflow-menu__trigger" data-tooltip="More tools" aria-label="More enhancement tools"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg></button><div class="overflow-menu__panel"><button type="button" class="overflow-menu__item" data-enhance="gtm">🎯 GTM Boost</button><button type="button" class="overflow-menu__item" data-enhance="recipe">📋 Recipes</button><button type="button" class="overflow-menu__item" data-enhance="monetize">💼 Monetize</button><button type="button" class="overflow-menu__item" data-enhance="prompts">📚 Prompts</button></div></div>' : ''}
        </div>
      ` : ''}
    `;
    fieldWrapper.appendChild(label);

            if (input.type === 'image' || input.type === 'frame' || input.type === 'video') {
                // Same upload picker + stock browser as the Video Studio.
                const mediaField = createTemplateMediaField({
                    kind: input.type,
                    required: input.type !== 'video' && (!!input.required || template.modelType === 'i2v' || template.modelType === 'i2i'),
                    anchorContainer: container,
                    studioName: 'Template Studio',
                    onChange: (value) => {
                        formState[input.name] = value;
                        uploadedUrl = typeof value === 'string' ? value : (value?.startUrl || null);
                        refreshMediaRoute();
                    },
                });
                fieldWrapper.appendChild(mediaField.element);
            } else if (input.type === 'text' || input.type === 'textarea') {
      const el = document.createElement(input.type === 'textarea' ? 'textarea' : 'input');
      el.className = 'h-11 w-full rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-4 text-sm text-white outline-none transition focus:border-emerald-400/50';
      if (input.type === 'textarea') {
        el.className = 'w-full rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400/50 resize-none';
        el.rows = 3;
      }
      el.placeholder = input.placeholder || '';
      el.oninput = () => { formState[input.name] = el.value; };
      if (isPrimaryPrompt) {
        promptEl = el;
        primaryPromptField = el;
      }
      fieldWrapper.appendChild(el);
    } else if (input.type === 'select') {
      const select = document.createElement('select');
      select.className = 'h-11 w-full rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-4 text-sm text-white outline-none transition focus:border-emerald-400/50 appearance-none cursor-pointer';
      (input.options || []).forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        option.className = 'bg-zinc-950 text-white';
        select.appendChild(option);
      });
      if (input.options && input.options.length > 0) {
        formState[input.name] = input.options[0];
      }
      select.onchange = () => { formState[input.name] = select.value; };
      fieldWrapper.appendChild(select);
    }

    leftPanel.appendChild(fieldWrapper);
  });

  // Enhancement tools overflow menu (GTM Boost, Recipes, Monetize, Prompts)
  const enhanceMenu = leftPanel.querySelector('.overflow-menu');
  if (enhanceMenu && promptEl && promptFieldName) {
    const enhanceTrigger = enhanceMenu.querySelector('.overflow-menu__trigger');
    const enhancePanel = enhanceMenu.querySelector('.overflow-menu__panel');
    const enhanceItems = enhanceMenu.querySelectorAll('[data-enhance]');

    function toggleEnhanceMenu() {
      const isOpen = enhanceMenu.classList.contains('is-open');
      enhanceMenu.classList.toggle('is-open', !isOpen);
    }

    enhanceTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleEnhanceMenu();
    });

    enhanceItems.forEach(item => {
      item.addEventListener('click', async () => {
        const action = item.dataset.enhance;
        if (action === 'gtm') {
          const originalText = enhanceTrigger.textContent;
          enhanceTrigger.textContent = '🎯 Loading…';
          try {
            let ctx = null;
            try {
              const m = await import('../lib/uiIntegration.js');
              const result = m.fetchGTMTemplateContext?.(template);
              ctx = result && typeof result.then === 'function' ? await result : result;
            } catch {
              ctx = null;
            }
            const basePrompt = promptEl.value || (ctx && ctx.basePrompt) || template.description || '';
            const templateContext = {
              ...(ctx || {}),
              basePrompt,
              templateId: template.id,
              category: template.category,
              niche: template.niche,
              outputType: template.outputType,
            };
            const onPromptGenerated = (generatedPrompt) => {
              promptEl.value = generatedPrompt;
              promptEl.dispatchEvent(new Event('input', { bubbles: true }));
              promptEl.dispatchEvent(new Event('change', { bubbles: true }));
              formState[promptFieldName] = generatedPrompt;
              promptEl.focus();
            };
            import('../lib/uiIntegration.js').then(({ openGTMPromptModal }) => {
              openGTMPromptModal('template-studio', onPromptGenerated, {
                templateContext,
              });
            }).catch((err) => {
              console.error('[TemplateStudio] GTM Boost failed:', err);
              showInlineError(leftPanel, 'GTM Boost failed to load. Please try again.');
            });
          } finally {
            enhanceTrigger.textContent = originalText;
          }
        } else if (action === 'recipe') {
          openRecipeModal({
            onRunRecipe: (url) => {
            }
          }).catch((err) => console.error('[Recipe] open failed:', err));
        } else if (action === 'monetize') {
          openMonetizationHub().catch((err) => console.error('[Monetization] open failed:', err));
        } else if (action === 'prompts') {
          openPromptGallery({
            appTheme: 'template-studio',
            onSelect: (prompt) => {
              if (promptEl) {
                promptEl.value = prompt;
                promptEl.dispatchEvent(new Event('input', { bubbles: true }));
                promptEl.focus();
              }
            }
          }).catch((err) => console.error('[PromptGallery] open failed:', err));
        }
        enhanceMenu.classList.remove('is-open');
      });
    });

    const closeEnhanceMenu = (e) => {
      if (!enhanceMenu.contains(e.target)) {
        enhanceMenu.classList.remove('is-open');
      }
    };
    addGlobalListener(window, 'click', closeEnhanceMenu);
  }

  // Model selector (async - fetches enriched catalog with descriptions)
  const outputType = template.outputType || (template.modelType === 't2i' || template.modelType === 'i2i' ? 'image' : 'video');
  if (outputType === 'video' || ['i2i', 't2i', 'i2v', 't2v', 'v2v'].includes(template.modelType)) {
    const modelWrapper = document.createElement('div');
    modelWrapper.className = 'mt-6';
    // The picker lists models for the current route (Text / Image / Video →
    // Video), starting from the template's own type.
    let pickerRoute = templateMediaRoute({ outputType, modelType: template.modelType });
    if (template.modelType && getFallbackList(template.modelType).length) pickerRoute = template.modelType;
    const routeModelPicks = {};
    let fallbackList = getFallbackList(pickerRoute);

    loadedModels = fallbackList;
    // Re-validate the initial selection against the resolved list so the
    // picker trigger never renders an unknown model name.
    selectedModel = getValidModel(template, selectedModel);
    const getModelName = (id) => {
      const m = loadedModels.find(x => x.id === id) || fallbackList.find(x => x.id === id) || findTemplateModel(id);
      return m ? m.name : id;
    };
    const getModel = (id) => loadedModels.find(x => x.id === id) || fallbackList.find(x => x.id === id) || findTemplateModel(id);

    const triggerBtn = document.createElement('button');
    triggerBtn.type = 'button';
    triggerBtn.id = 'templateModelTrigger';
    triggerBtn.setAttribute('aria-haspopup', 'listbox');
    triggerBtn.setAttribute('aria-expanded', 'false');
    triggerBtn.setAttribute('aria-label', 'Select model');
    const updateTrigger = () => {
      const model = getModel(selectedModel);
      const provider = model?.provider || 'muapi';
      const logoUrl = PROVIDER_LOGOS[provider];
      const name = model ? model.name : getModelName(selectedModel);
      if (logoUrl) {
        triggerBtn.innerHTML = `<div class="w-5 h-5 rounded-md flex items-center justify-center overflow-hidden bg-white/5 shrink-0">${renderProviderLogoImg(provider, '', 'w-full h-full object-contain', invertLogos.includes(provider) ? 'invert' : '')}</div><span class="text-sm font-bold text-white truncate">${name}</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-muted shrink-0"><polyline points="6 9 12 15 18 9"/></svg>`;
      } else {
        const style = getProviderStyle(provider);
        triggerBtn.innerHTML = `<div class="w-5 h-5 bg-primary rounded-md flex items-center justify-center shadow-lg shadow-primary/20 shrink-0"><span class="text-[10px] font-black text-black">${style.text}</span></div><span class="text-sm font-bold text-white truncate">${name}</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-muted shrink-0"><polyline points="6 9 12 15 18 9"/></svg>`;
      }
    };
    updateTrigger();

    const dropdown = document.createElement('div');
    dropdown.className = 'fixed z-[100] bg-[#111] border border-white/10 rounded-2xl shadow-3xl p-2 opacity-0 pointer-events-none transition-all duration-200 scale-95 origin-bottom-left';
    dropdown.setAttribute('role', 'listbox');
    dropdown.setAttribute('aria-label', 'Available models');
    dropdown.style.width = 'calc(100vw - 2rem)';
    dropdown.style.maxWidth = '480px';
    dropdown.style.maxHeight = '70vh';
    dropdown.style.minHeight = '350px';

    let _modelSelectorOutsideClickHandler = null;

    const closeDropdown = () => {
      dropdown.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
      dropdown.classList.remove('opacity-100', 'pointer-events-auto', 'scale-100');
      triggerBtn.setAttribute('aria-expanded', 'false');
      if (_modelSelectorOutsideClickHandler) {
        document.removeEventListener('click', _modelSelectorOutsideClickHandler);
        _modelSelectorOutsideClickHandler = null;
      }
    };

    const modelLoadingStatus = document.createElement('span');
    modelLoadingStatus.id = 'model-loading-status';
    modelLoadingStatus.className = 'text-[10px] text-zinc-500';

    const openDropdown = () => {
      dropdown.classList.remove('opacity-0', 'pointer-events-none', 'scale-95');
      dropdown.classList.add('opacity-100', 'pointer-events-auto', 'scale-100');
      triggerBtn.setAttribute('aria-expanded', 'true');

      positionModelSelectorDropdown(dropdown, triggerBtn, 6, container);

      if (_modelSelectorOutsideClickHandler) {
        document.removeEventListener('click', _modelSelectorOutsideClickHandler);
        _modelSelectorOutsideClickHandler = null;
      }

      _modelSelectorOutsideClickHandler = (e) => {
        if (!dropdown.contains(e.target) && e.target !== triggerBtn) {
          closeDropdown();
        }
      };
      document.addEventListener('click', _modelSelectorOutsideClickHandler);

      if (!dropdown.dataset.populated) {
        dropdown.dataset.populated = 'true';

        const renderModelPanel = (models) => {
          mountModelSelector(dropdown, {
            models,
            selectedModelId: selectedModel,
            showProviderName: true,
            loadingMessage: 'Loading models...',
            onSelectModel: (model) => {
              selectedModel = model.id;
              routeModelPicks[pickerRoute] = model.id;
              updateTrigger();
              if (videoSettings) videoSettings.refresh();
              closeDropdown();
            },
          });
        };

         // Show a loading state immediately, then populate once the catalog resolves.
        renderModelPanel([]);
        modelLoadingStatus.textContent = 'Loading...';
        modelLoadingStatus.className = 'text-[10px] text-zinc-400';

        // Timeout wrapper for model catalog fetch
        const withTimeout = (promise, ms = 5000) => {
          return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Model catalog load timed out')), ms))
          ]);
        };

        withTimeout(getEnrichedModels(pickerRoute))
          .then(enriched => {
            const models = enriched && enriched.length > 0 ? enriched : fallbackList;
            loadedModels = models;
            // Keep the selection valid even if the enriched catalog differs
            // from the fallback list (e.g. renamed or missing IDs).
            if (!models.find(m => m && m.id === selectedModel)) {
              selectedModel = pickerRoute === template.modelType ? getValidModel(template, selectedModel) : modelForRoute(pickerRoute, selectedModel);
              if (!models.find(m => m && m.id === selectedModel)) {
                selectedModel = models[0]?.id || selectedModel;
              }
              updateTrigger();
            }
            renderModelPanel(models);
            modelLoadingStatus.textContent = models.length + ' models';
            modelLoadingStatus.className = 'text-[10px] text-emerald-400/70';
          })
          .catch(err => {
            console.warn('[TemplateStudio] Failed to load enriched model catalog, using fallback:', err);
            loadedModels = fallbackList;
            renderModelPanel(fallbackList);
            modelLoadingStatus.textContent = fallbackList.length + ' models (fallback)';
            modelLoadingStatus.className = 'text-[10px] text-amber-400/70';
          });
      }
    };

    // The same model picker as the Video Studio (video templates) / Image
    // Studio (image templates): provider sidebar, families, T2V / I2V / V2V.
    let studioPickerController = null;
    const pickerKind = outputType === 'video' ? 'video' : 'image';
    triggerBtn.onclick = (e) => {
      e.stopPropagation();
      // Fallback list picker open (Video Studio picker failed to load): toggle it.
      if (dropdown.classList.contains('opacity-100')) {
        closeDropdown();
        return;
      }
      if (studioPickerController) {
        studioPickerController.close();
        studioPickerController = null;
        triggerBtn.setAttribute('aria-expanded', 'false');
        return;
      }
      triggerBtn.setAttribute('aria-expanded', 'true');
      openStudioModelPicker({
        kind: pickerKind,
        anchor: triggerBtn,
        selectedModelId: selectedModel,
        currentMode: pickerRoute,
        onPick: (modelId, mode) => {
          selectedModel = modelId;
          pickedMode = mode || null;
          if (pickedMode) routeModelPicks[pickedMode] = modelId;
          refreshMediaRoute();
          updateTrigger();
          if (videoSettings) videoSettings.refresh();
        },
        onClose: () => {
          studioPickerController = null;
          triggerBtn.setAttribute('aria-expanded', 'false');
        },
      }).then((c) => { studioPickerController = c; })
        .catch((err) => {
          console.warn('[TemplateStudio] Video Studio model picker unavailable, using list picker:', err);
          openDropdown();
        });
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape' && dropdown.classList.contains('opacity-100')) {
        closeDropdown();
        triggerBtn.focus();
      }
    };
    addGlobalListener(document, 'keydown', onKeyDown);
    globalCleanups.push(() => closeDropdown());

    syncModelPickerToRoute = (route) => {
      if (!route || route === pickerRoute) return;
      // Remember the old route's model (only if it belongs to that route).
      if (modelsForRoute(pickerRoute).some(m => m && m.id === selectedModel)) routeModelPicks[pickerRoute] = selectedModel;
      pickerRoute = route;
      fallbackList = modelsForRoute(route);
      loadedModels = fallbackList;
      selectedModel = routeModelPicks[route] || modelForRoute(route, selectedModel);
      delete dropdown.dataset.populated;
      closeDropdown();
      updateTrigger();
      label.textContent = `Model · ${TEMPLATE_ROUTE_LABELS[route] || route}`;
      if (videoSettings) videoSettings.refresh();
      modelLoadingStatus.textContent = `${fallbackList.length} models`;
      modelLoadingStatus.className = 'text-[10px] text-zinc-500';
    };

    const headerRow = document.createElement('div');
    headerRow.className = 'mb-3 flex items-center justify-between gap-3';
    const label = document.createElement('div');
    label.className = 'text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500';
    label.textContent = 'Model';
    headerRow.appendChild(label);
    headerRow.appendChild(triggerBtn);
    headerRow.appendChild(modelLoadingStatus);
    modelWrapper.appendChild(headerRow);
    if (outputType === 'video') {
      // Same per-model controls as the Video Studio prompt bar.
      videoSettings = createVideoSettingsControls({
        getTarget: () => {
          const { route, model } = currentMediaRoute();
          return { route, model };
        },
        preferred: {
          duration: templateVideoPrefs.duration ?? normalizeDuration(template),
          resolution: templateVideoPrefs.resolution,
          // Templates that ship an effect preset start on it.
          effect: template.defaultParams?.name,
        },
        // Templates with their own effect select keep using it.
        offerEffects: !allInputs.some(i => i && i.name === 'name'),
      });
      modelWrapper.appendChild(videoSettings.element);
      videoSettings.refresh();
    }
    modelWrapper.appendChild(dropdown);
    leftPanel.appendChild(modelWrapper);

    // Media sources for video templates — the same pickers the Video Studio
    // uses. A reference image (when the template has no image input of its
    // own) turns the run into image-to-video; a source video turns it into
    // video-to-video. The route badge shows which path Generate will take.
    if (outputType === 'video') {
      const mediaSection = document.createElement('div');
      mediaSection.className = 'mt-6';
      mediaSection.innerHTML = `
        <div class="mb-3 flex items-center justify-between gap-3">
          <div class="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Media Sources</div>
          <span data-media-route class="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400"></span>
        </div>
        <div data-media-fields class="flex flex-col gap-2"></div>
      `;
      const fieldsHost = mediaSection.querySelector('[data-media-fields]');
      mediaRouteBadge = mediaSection.querySelector('[data-media-route]');
      const hasOwnImageInput = allInputs.some(i => i && (i.type === 'image' || i.type === 'frame'));
      const hasOwnVideoInput = allInputs.some(i => i && i.type === 'video');
      if (!hasOwnImageInput) {
        const imageField = createTemplateMediaField({
          kind: 'frame',
          required: template.modelType === 'i2v',
          anchorContainer: container,
          studioName: 'Template Studio',
          onChange: (value) => { formState['image_url'] = value; refreshMediaRoute(); },
        });
        fieldsHost.appendChild(imageField.element);
      }
      if (!hasOwnVideoInput) {
        const videoField = createTemplateMediaField({
          kind: 'video',
          anchorContainer: container,
          studioName: 'Template Studio',
          onChange: (value) => {
            formState['video_url'] = value;
            uploadedUrl = value || uploadedUrl;
            refreshMediaRoute();
          },
        });
        fieldsHost.appendChild(videoField.element);
      }
      leftPanel.appendChild(mediaSection);
      refreshMediaRoute();
    }

    // Close on outside click is handled by openDropdown via
    // _modelSelectorOutsideClickHandler to avoid listener leaks.
  }

  // AI Enhancer section
  const enhancerSection = document.createElement('div');
  enhancerSection.className = 'mt-6 rounded-[24px] border border-emerald-400/15 bg-[linear-gradient(180deg,rgba(16,185,129,0.10),rgba(99,102,241,0.05))] p-4';
  enhancerSection.innerHTML = `
    <div class="flex items-center justify-between gap-4">
      <div>
        <div class="text-sm font-semibold text-white">AI Enhancer</div>
        <div class="mt-1 text-xs leading-6 text-zinc-400">
          Keeps the simple template flow, but auto-detects niche, applies cinematic prompt expansion, scene logic, and cleanup in the background.
        </div>
      </div>
      <button id="enhancerToggle" class="relative h-7 w-12 rounded-full transition bg-emerald-400">
        <span class="absolute top-1 h-5 w-5 rounded-full bg-black transition left-6" id="enhancerToggleKnob"></span>
      </button>
    </div>
    <button id="advancedToggle" class="mt-4 text-sm font-medium text-emerald-200 transition hover:text-emerald-100">
      Show Advanced Controls
    </button>
    <div id="advancedControls" class="mt-5 grid gap-4 md:grid-cols-2 hidden"></div>
  `;
  leftPanel.appendChild(enhancerSection);

  // GTM Boost affordance (opt-in enhancement via GTMPromptModal).
  // Uses the shared .gtm-boost-btn design (matches Image / Video studios);
  // the .template-studio ancestor class themes it emerald via gtm-prompt-modal.css.
  function renderGtmBoost(leftPanel) {
    // GTM Boost moved to overflow menu in primary prompt field
  }

  // Advanced controls content
  const advancedControls = enhancerSection.querySelector('#advancedControls');
  const advancedFields = [
    { name: 'templateType', label: 'Template Type', type: 'select', options: ['cinematic-short-film', 'dramatic-trailer', 'founder-story-film', 'testimonial-film', 'case-study-film', 'promo-film', 'cinematic-commercial', 'documentary-style-film'] },
    { name: 'niche', label: 'Niche', type: 'select', options: ['auto-detect', 'restaurant', 'med-spa', 'salon', 'barbershop', 'fitness', 'real-estate', 'dental', 'chiropractic', 'legal', 'automotive', 'fashion', 'event', 'luxury-brand', 'local-business', 'saas', 'agency', 'general-business'] },
    { name: 'businessType', label: 'Business Type', type: 'text', placeholder: 'optional' },
    { name: 'audience', label: 'Audience', type: 'text', placeholder: 'optional' },
    { name: 'subject', label: 'Subject', type: 'text', placeholder: 'optional' },
    { name: 'setting', label: 'Setting', type: 'text', placeholder: 'optional' },
    { name: 'visualStyle', label: 'Visual Style', type: 'select', options: ['luxury', 'dramatic', 'documentary', 'commercial'] },
    { name: 'cta', label: 'CTA', type: 'text', placeholder: 'optional' }
  ];

  const isImageTemplate = template.outputType === 'image';
  advancedFields.forEach(field => {
    // Film formats only apply to video templates.
    if (isImageTemplate && field.name === 'templateType') return;
    const wrapper = document.createElement('div');
    if (field.type === 'select') {
      wrapper.innerHTML = `
        <div class="mb-3 flex items-center justify-between gap-3">
          <div class="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">${field.label}</div>
        </div>
        <select class="h-11 w-full rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-4 text-sm text-white outline-none transition focus:border-emerald-400/50 appearance-none cursor-pointer" data-advanced-field="${field.name}">
          ${field.options.map(opt => `<option value="${opt}" class="bg-zinc-950 text-white">${opt}</option>`).join('')}
        </select>
      `;
    } else {
      wrapper.innerHTML = `
        <div class="mb-3 flex items-center justify-between gap-3">
          <div class="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">${field.label}</div>
          <button class="enhancer-btn rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] transition border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-white" data-field="${field.name}">Enhance</button>
        </div>
        <input type="text" class="h-11 w-full rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-4 text-sm text-white outline-none transition focus:border-emerald-400/50" placeholder="${field.placeholder}" data-advanced-field="${field.name}" />
      `;
    }
    advancedControls.appendChild(wrapper);
  });

  // Extra instructions textarea
  const extraWrapper = document.createElement('div');
  extraWrapper.className = 'md:col-span-2';
  extraWrapper.innerHTML = `
    <div class="mb-3 flex items-center justify-between gap-3">
      <div class="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Extra Instructions</div>
      <button class="enhancer-btn rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] transition border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-white" data-field="extraInstructions">Enhance</button>
    </div>
    <textarea class="w-full rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400/50 resize-none" rows="4" placeholder="${isImageTemplate ? 'optional instructions (text overlay, colors, layout…)' : 'optional cinematic instructions'}" data-advanced-field="extraInstructions"></textarea>
  `;
  advancedControls.appendChild(extraWrapper);

  // Every Advanced Control feeds the prompt: keep formState in sync (selects
  // start with their shown value).
  advancedControls.querySelectorAll('[data-advanced-field]').forEach((el) => {
    const name = el.dataset.advancedField;
    if (el.tagName === 'SELECT') formState[name] = el.value;
    const sync = () => { formState[name] = el.value; };
    el.addEventListener('input', sync);
    el.addEventListener('change', sync);
  });

  // Generate button
  const genBtn = document.createElement('button');
  genBtn.type = 'button';
  genBtn.className = 'mt-6 flex h-14 w-full items-center justify-center rounded-[20px] bg-white text-lg font-semibold text-black shadow-xl transition hover:opacity-90';
  genBtn.textContent = 'Generate';
  genBtn.setAttribute('aria-label', 'Generate template');
  const errorContainer = document.createElement('div');
  errorContainer.className = 'ts-error-container';
  leftPanel.appendChild(errorContainer);
  leftPanel.appendChild(genBtn);
  mountPersonalizeTrigger({
    controlsContainer: leftPanel,
    appId: 'template-studio',
    studioId: 'template',
    studioName: 'Template Studio',
    returnRoute: 'templates',
    getTextarea: () => document.getElementById('outputTextarea') || null,
    getAsset: () => {
      const outputTextarea = document.getElementById('outputTextarea');
      return getTemplateStudioAsset({
        outputTextarea: outputTextarea || undefined,
        template,
        selectedModel,
        lastGeneratedUrl,
        customThumbnailUrl,
      });
    },
    getProject: () => ({ id: template.id, title: template.name }),
    getPersonalizableFields: () => {
      const outputTextarea = document.getElementById('outputTextarea');
      return [
        { id: 'prompt', label: 'Prompt', type: 'text', value: outputTextarea?.value?.trim() || '', supportsPersonalization: true },
        { id: 'templateId', label: 'Template ID', type: 'text', value: template?.id || '', supportsPersonalization: false, readonly: true },
        { id: 'templateName', label: 'Template Name', type: 'text', value: template?.name || '', supportsPersonalization: false, readonly: true },
        { id: 'outputType', label: 'Output Type', type: 'text', value: template?.outputType || 'video', supportsPersonalization: false, readonly: true },
      ];
    },
    getPreview: () => customThumbnailUrl || lastGeneratedUrl || '',
  });

  // AI Captions button — always visible in the studio controls for video templates
  if (template.outputType === 'video') {
    const captionBtn = document.createElement('button');
    captionBtn.type = 'button';
    captionBtn.textContent = '💬 Add AI Captions';
    captionBtn.className = 'mt-3 flex w-full items-center justify-center rounded-[18px] bg-white/10 px-4 py-3 text-sm font-bold text-white border border-white/10 transition-all hover:bg-white/20';
    captionBtn.onclick = () => {
      const lastUrl = lastGeneratedUrl || '';
      addCaptionButton({
        videoUrl: lastUrl || undefined,
        appTheme: 'template-studio',
        onComplete: (captionedUrl) => {
          const vid = document.getElementById('previewArea')?.querySelector('video');
          if (vid) vid.src = captionedUrl;
          const resultVid = resultArea?.querySelector('video');
          if (resultVid) resultVid.src = captionedUrl;
        },
      });
    };
    leftPanel.appendChild(captionBtn);
  }

  // Creative Intelligence section
  const intelligenceSection = document.createElement('div');
  intelligenceSection.className = 'mt-6 rounded-[28px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.35)]';
  intelligenceSection.innerHTML = `
    <h2 class="text-xl font-bold text-white">Creative Intelligence</h2>
    <p class="mt-2 mb-5 text-sm text-zinc-400">These tiles show the structure, creative direction, and visual strategy this template will use to build your final ${template.outputType === 'image' ? 'image' : 'video'}. Edit any of them — Generate uses what you see here.</p>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div class="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-4 hover:border-blue-400/20 transition cursor-pointer">
        <div class="mb-3 text-3xl">🏷️</div>
        <h3 class="text-lg font-bold text-white mb-2">Auto-Detected Niche</h3>
        <textarea class="w-full rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-zinc-300 outline-none transition focus:border-emerald-400/50 resize-none" rows="3" data-tile="niche">${escapeAttr(tileState.niche)}</textarea>
      </div>
      <div class="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-4 hover:border-violet-400/20 transition cursor-pointer">
        <div class="mb-3 text-3xl">🎬</div>
        <h3 class="text-lg font-bold text-white mb-2">Scene Structure</h3>
        <textarea class="w-full rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-zinc-300 outline-none transition focus:border-emerald-400/50 resize-none" rows="3" data-tile="scene">${escapeAttr(tileState.scene)}</textarea>
      </div>
      <div class="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-4 hover:border-emerald-400/20 transition cursor-pointer">
        <div class="mb-3 text-3xl">🎥</div>
        <h3 class="text-lg font-bold text-white mb-2">Cinematic Enrichment</h3>
        <textarea class="w-full rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-zinc-300 outline-none transition focus:border-emerald-400/50 resize-none" rows="3" data-tile="cinematic">${escapeAttr(tileState.cinematic)}</textarea>
      </div>
      <div class="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-4 hover:border-amber-400/20 transition cursor-pointer">
        <div class="mb-3 text-3xl">⚙️</div>
        <h3 class="text-lg font-bold text-white mb-2">Visual Style</h3>
        <textarea class="w-full rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-zinc-300 outline-none transition focus:border-emerald-400/50 resize-none" rows="3" data-tile="style">${escapeAttr(tileState.style)}</textarea>
      </div>
      <div class="md:col-span-2 rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-4 hover:border-rose-400/20 transition cursor-pointer">
        <div class="mb-3 text-3xl">✨</div>
        <h3 class="text-lg font-bold text-white mb-2">Enhancer Keywords</h3>
        <textarea class="w-full rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-zinc-300 outline-none transition focus:border-emerald-400/50 resize-none" rows="4" data-tile="keywords">${escapeAttr(tileState.keywords)}</textarea>
      </div>
    </div>
  `;
  leftPanel.appendChild(intelligenceSection);
  intelligenceSection.querySelectorAll('[data-tile]').forEach((ta) => {
    ta.addEventListener('input', () => {
      tileState[ta.dataset.tile] = ta.value;
      tileEdited[ta.dataset.tile] = true;
    });
  });
  // Any change to the inputs makes Generate rebuild the prompt from them.
  ['input', 'change'].forEach((evt) => leftPanel.addEventListener(evt, () => { promptManuallyEdited = false; }));

  grid.appendChild(leftPanel);

  // Right panel - Preview and Output
  const rightPanel = document.createElement('div');
  rightPanel.className = 'space-y-5';

  // Preview section
  const previewSection = document.createElement('div');
  previewSection.className = 'rounded-[30px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.45)]';
  previewSection.innerHTML = `
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <span class="inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/12 px-3 py-1 text-xs font-medium text-emerald-100">${template.outputType === 'video' ? 'Video' : 'Image'}</span>
      <span class="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-white/75">${template.category}</span>
      <span class="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-white/75">${template.aspectRatio || '16:9'}</span>
    </div>
    <div class="rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_50%_35%,rgba(16,185,129,0.14),transparent_40%),radial-gradient(circle_at_70%_20%,rgba(99,102,241,0.12),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5">
      <div class="aspect-[16/10] rounded-[22px] border border-white/10 bg-black/50 p-4">
        <div class="flex h-full flex-col rounded-[18px] border border-white/10 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.10),transparent_55%),radial-gradient(circle_at_70%_20%,rgba(99,102,241,0.10),transparent_38%)] p-4">
          <div class="mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            <span>Preview / Output Panel</span>
            <span>Standby State</span>
          </div>
          <div id="previewArea" class="flex flex-1 items-center justify-center rounded-[16px] border border-dashed border-white/10 bg-white/[0.02] text-center text-sm leading-6 text-zinc-400">
            Upload an image and click Generate to see results
          </div>
        </div>
      </div>
    </div>
  `;
  rightPanel.appendChild(previewSection);

  // Output tabs section
  const outputTabs = ['Enhanced Prompt', 'Scene Beats', 'Voiceover', 'Negative Prompt'];
  const outputSection = document.createElement('div');
  outputSection.className = 'rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.018))] p-5';

  // Tab buttons
  const tabRow = document.createElement('div');
  tabRow.className = 'mb-4 flex flex-wrap gap-2';
  tabRow.id = 'outputTabs';
  outputTabs.forEach(tab => {
    const tabBtn = document.createElement('button');
    tabBtn.className = `rounded-full px-3 py-2 text-xs font-medium transition ${tab === activeTab ? 'border border-emerald-400/30 bg-emerald-500/12 text-emerald-100' : 'border border-white/10 bg-white/[0.04] text-zinc-100 hover:bg-white/[0.08]'}`;
    tabBtn.textContent = tab;
    tabBtn.onclick = () => {
      activeTab = tab;
      document.querySelectorAll('#outputTabs button').forEach(b => {
        b.className = `rounded-full px-3 py-2 text-xs font-medium transition ${b.textContent === activeTab ? 'border border-emerald-400/30 bg-emerald-500/12 text-emerald-100' : 'border border-white/10 bg-white/[0.04] text-zinc-100 hover:bg-white/[0.08]'}`;
      });
      updateOutputContent();
    };
    tabRow.appendChild(tabBtn);
  });
  outputSection.appendChild(tabRow);

  // Output content area with wand button
  const outputContent = document.createElement('div');
  outputContent.className = 'rounded-[22px] border border-white/10 bg-black/40 p-4';
  outputContent.innerHTML = `
    <div class="mb-3 flex items-center justify-between gap-3">
      <div class="text-xs uppercase tracking-[0.18em] text-zinc-500">Editable Output</div>
      <button id="wandBtn" class="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/12 text-emerald-200 transition hover:bg-emerald-500/18" title="Enhance with AI">✨</button>
    </div>
    <textarea id="outputTextarea" class="w-full rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-7 text-zinc-200 outline-none transition focus:border-emerald-400/50 resize-none" rows="12">${specs.enhancerKeywords || 'Click Generate to create an enhanced prompt...'}</textarea>
  `;

  const outputTextarea = outputContent.querySelector('#outputTextarea');
  if (outputTextarea) {
    outputTextarea.addEventListener('input', () => {
      outputTabValues[activeTab] = outputTextarea.value;
      if (activeTab === 'Enhanced Prompt') {
        // Sent as-is until an input changes (then rebuilt from all inputs).
        lastBuiltPrompt = outputTextarea.value;
        promptManuallyEdited = true;
      } else if (activeTab === 'Negative Prompt') {
        formState['_customNegativePrompt'] = outputTextarea.value;
      } else if (activeTab === 'Scene Beats') {
        formState['_customSceneBlueprint'] = outputTextarea.value;
      }
    });
  }
  outputSection.appendChild(outputContent);
  rightPanel.appendChild(outputSection);

  grid.appendChild(rightPanel);
  centeredContainer.appendChild(grid);
  contentArea.appendChild(centeredContainer);
  main.appendChild(contentArea);
  appShell.appendChild(main);
  container.appendChild(appShell);

  // Result area (hidden by default)
  const resultArea = document.createElement('div');
  resultArea.id = 'resultArea';
  resultArea.className = 'hidden mt-8';
  resultArea.setAttribute('role', 'status');
  resultArea.setAttribute('aria-live', 'polite');
  centeredContainer.appendChild(resultArea);

  // Update output content based on active tab
  function updateOutputContent() {
    const textarea = document.getElementById('outputTextarea');
    if (!textarea) return;

    const saved = outputTabValues[activeTab];
    switch (activeTab) {
      case 'Enhanced Prompt':
        textarea.value = lastBuiltPrompt || specs.enhancerKeywords || 'Click Generate to create an enhanced prompt...';
        break;
      case 'Scene Beats': {
        const beats = (template.storyBlueprint && template.storyBlueprint.length) ? template.storyBlueprint : (specs.sceneBlueprint || ['Hook','Subject','Movement','Payoff','CTA']);
        textarea.value = saved || beats.join(' → ');
        break;
      }
      case 'Voiceover':
        textarea.value = saved || `Create a premium voiceover for a ${template.name}. Open with a fast hook, build emotional or commercial momentum, end with a clear call to action.`;
        break;
      case 'Negative Prompt':
        textarea.value = saved || specs.negativePrompt || 'Low quality, blurry, amateur, poorly lit, generic stock look';
        break;
    }
  }

  // Add functionality after DOM is ready
  setTimeout(() => {
    // Enhancer toggle
    const toggleBtn = document.getElementById('enhancerToggle');
    const toggleKnob = document.getElementById('enhancerToggleKnob');
    if (toggleBtn) {
      toggleBtn.onclick = () => {
        aiEnhancer = !aiEnhancer;
        toggleBtn.className = `relative h-7 w-12 rounded-full transition ${aiEnhancer ? 'bg-emerald-400' : 'bg-white/10'}`;
        toggleKnob.className = `absolute top-1 h-5 w-5 rounded-full bg-black transition ${aiEnhancer ? 'left-6' : 'left-1'}`;
      };
    }

    // Advanced toggle
    const advancedBtn = document.getElementById('advancedToggle');
    const advControls = document.getElementById('advancedControls');
    if (advancedBtn && advControls) {
      advancedBtn.onclick = () => {
        showAdvanced = !showAdvanced;
        advancedBtn.textContent = showAdvanced ? 'Hide Advanced Controls' : 'Show Advanced Controls';
        advControls.className = showAdvanced ? 'mt-5 grid gap-4 md:grid-cols-2' : 'mt-5 grid gap-4 md:grid-cols-2 hidden';
      };
    }

    // Wand button
    const wandBtn = document.getElementById('wandBtn');
    if (wandBtn) {
      wandBtn.onclick = () => {
        const textarea = document.getElementById('outputTextarea');
        if (!textarea) return;
        const current = (promptManuallyEdited && lastBuiltPrompt) ? lastBuiltPrompt : composeFinalPrompt();
        const extra = template.outputType === 'image'
          ? 'professional lighting, high detail, sharp focus, 4K resolution'
          : 'cinematic quality, professional lighting, high detail, 4K resolution';
        const enhanced = current.toLowerCase().includes(extra.split(',')[0]) ? current : `${current.replace(/\.$/, '')}, ${extra}.`;
        lastBuiltPrompt = enhanced;
        promptManuallyEdited = true;
        outputTabValues['Enhanced Prompt'] = enhanced;
        if (activeTab === 'Enhanced Prompt') textarea.value = enhanced;
        textarea.classList.add('border-emerald-400/50');
        setTimeout(() => textarea.classList.remove('border-emerald-400/50'), 1000);
      };
    }

    // Enhancer buttons
    document.querySelectorAll('.enhancer-btn').forEach(btn => {
      btn.onclick = () => {
        const fieldName = btn.dataset.field;
        if (!fieldName) return;
        // Primary prompt field uses name="prompt", not data-advanced-field
        const input = document.querySelector(`[data-advanced-field="${fieldName}"], [name="${fieldName}"]`);
        if (input && input.value) {
          const enhancedValue = `${input.value}, cinematic style, professional quality, premium aesthetic`;
          input.value = enhancedValue;
          formState[fieldName] = enhancedValue;
          btn.classList.add('border-emerald-400/40', 'bg-emerald-500/15', 'text-emerald-200');
          btn.textContent = 'Enhanced ✓';
          setTimeout(() => {
            btn.classList.remove('border-emerald-400/40', 'bg-emerald-500/15', 'text-emerald-200');
            btn.textContent = 'Enhance';
          }, 2000);
        }
      };
    });

    // Update API key indicator on load
    updateApiKeyIndicator();
  }, 100);

  function showInlineError(container, message) {
    let errEl = container.querySelector('.ts-inline-error');
    if (!errEl) {
      errEl = document.createElement('div');
      errEl.className = 'ts-inline-error mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200';
      errorContainer.appendChild(errEl);
    }
    errEl.innerHTML = message;
    clearTimeout(errEl.__dismissTimer);
    errEl.__dismissTimer = setTimeout(() => { if (errEl && errEl.parentNode) errEl.remove(); }, 5000);
  }

  function updateApiKeyIndicator() {
    const indicator = document.querySelector('#api-key-indicator');
    if (!indicator) return;
    const dot = indicator.querySelector('.api-key-dot');
    const text = indicator.querySelector('.api-key-text');
    const hasKey = !!apiKeyManager.getMuapiKey();
    if (dot) {
      dot.className = `api-key-dot w-2 h-2 rounded-full ${hasKey ? 'bg-emerald-400' : 'bg-zinc-600'}`;
    }
    if (text) {
      text.textContent = hasKey ? 'API key set' : 'No API key';
      text.className = `api-key-text text-[10px] uppercase tracking-wider ${hasKey ? 'text-emerald-200' : 'text-zinc-500'}`;
    }
  }

  // Generate button handler
  genBtn.onclick = async () => {
    try {
      if (isGenerating) return;

    // SECURITY ISSUE: API keys stored in localStorage are accessible to XSS attacks
    // TODO: Replace with server-side session storage or httpOnly cookies
    const apiKey = apiKeyManager.getMuapiKey();
    if (!apiKey) {
      AuthModal(() => {
        genBtn.click();
        updateApiKeyIndicator();
      });
      return;
    }

    // Validate that there's some prompt content to work with
    const userPrompt = (primaryPromptField?.value || '').trim() || lastBuiltPrompt;
    if (!userPrompt && !template.basePrompt) {
      showInlineError(container, 'Please enter a prompt or description before generating.');
      return;
    }

    // Validate that the selected model matches the template's model type.
    // V2V models are an accepted exception: they are routed through the t2v
    // branch below, so a t2v template may use a v2v model.
    // The model must accept the attached media (route); fall back to the
    // route's first model otherwise.
    const { route: genRoute } = currentMediaRoute();
    const isV2VSelection = !!getV2VModelById(selectedModel || template.model);
    const routeModels = modelsForRoute(genRoute);
    if (routeModels.length > 0
      && !routeModels.find(m => m && m.id === (selectedModel || template.model))
      && !(isV2VSelection && genRoute === 't2v')
      && !(genRoute === template.modelType && isValidModelForType(selectedModel || template.model, template.modelType))) {
      const fallback = modelForRoute(genRoute, selectedModel);
      showInlineError(container, `Model "${selectedModel || template.model}" is not compatible with ${TEMPLATE_ROUTE_LABELS[genRoute] || genRoute}. Falling back to ${fallback}.`);
      selectedModel = fallback;
    }

    // Build params for potential retry
    const params = { ...(template.defaultParams || {}), model: selectedModel || getValidModel(template, selectedModel) };

    if (normalizeAspectRatio(template)) params.aspect_ratio = normalizeAspectRatio(template);
    if (normalizeDuration(template)) params.duration = normalizeDuration(template);
    applyFormStateToParams(params, formState, allInputs);

    // Prompt = every input combined (or the user's own edited prompt).
    params.prompt = composeFinalPrompt();

    const negativePrompt = formState['_customNegativePrompt'] || buildNegativePrompt(template, formState, specs);
    if (negativePrompt) params.negative_prompt = negativePrompt;

    attachThumbnail(params, customThumbnailUrl);

    // Route by attached media exactly like the Video Studio: a source video
    // goes to v2v, an image to i2v / i2i, otherwise text-to-video / image.
    const { media, route, model: routedModel } = currentMediaRoute();
    params.model = routedModel;
    applyTemplateMediaToParams(params, media, route);
    if (videoSettings) Object.assign(params, videoSettings.getSettings());
    params.aspect_ratio = snapAspectRatioForModel(route, params.model, params.aspect_ratio);
    if (!params.aspect_ratio) delete params.aspect_ratio;

    // Client-side validation before muapi call
    let validationError = null;
    if ((template.modelType === 'i2v' || template.modelType === 'i2i') && !media.imageUrl) {
      validationError = 'Please upload an image before generating.';
    } else if (route === 'v2v' && !media.videoUrl) {
      validationError = 'Please upload a video before generating.';
    } else {
      // Media checks are done above; this keeps the shared effect-model
      // ("name" required) check.
      validationError = validateBeforeGenerate(
        { ...template, modelType: route === 'v2v' ? 'v2v' : 't2v' },
        { ...params, video_url: media.videoUrl },
        allInputs,
        routedModel,
      );
    }
    if (validationError) {
      showInlineError(container, validationError);
      return;
    }

    // Store params for retry and run generation
    lastGenerationParams = { ...params };
    retryCount = 0;
    await runGeneration(params);
    } catch (err) {
      console.error('[TemplateStudio] genBtn.onclick', err);
      showInlineError(container, err.message || 'Generation failed');
    }
  };

  async function runGeneration(params) {
    if (isGenerating) return;

    isGenerating = true;
    genBtn.disabled = true;
    genBtn.innerHTML = '<span class="animate-spin inline-block mr-2">&#9711;</span> Generating...';

    try {
      // Merge template defaults with the params built by genBtn.onclick.
      // Always resolve to a validated model so a stale/invalid selection
      // can never reach the muapi call.
      // Resolve against the current route so a stale / invalid selection can
      // never reach the muapi call.
      const { route: runRoute } = currentMediaRoute();
      const validatedModel = runRoute === template.modelType
        ? getValidModel(template, selectedModel || params.model)
        : modelForRoute(runRoute, selectedModel || params.model);
      selectedModel = validatedModel;
      const mergedParams = { model: validatedModel, ...(template.defaultParams || {}), ...params };
      params = mergedParams;

      if (normalizeAspectRatio(template)) params.aspect_ratio = normalizeAspectRatio(template);
      if (normalizeDuration(template)) params.duration = normalizeDuration(template);
      applyFormStateToParams(params, formState, allInputs);

      // Re-route with the media attached now (retries pick up new uploads).
      const { media, route, model: routedModel } = currentMediaRoute();
      params.model = routedModel;
      applyTemplateMediaToParams(params, media, route);
      if (videoSettings) Object.assign(params, videoSettings.getSettings());
      params.aspect_ratio = snapAspectRatioForModel(route, params.model, params.aspect_ratio);
      if (!params.aspect_ratio) delete params.aspect_ratio;
      // Prompt = every input combined (or the user's own edited prompt).
      params.prompt = composeFinalPrompt();

      const negativePrompt = formState['_customNegativePrompt'] || buildNegativePrompt(template, formState, specs);
      if (negativePrompt) params.negative_prompt = negativePrompt;

      // Same MuAPI calls the Video Studio makes for each route.
      let result;
      if (route === 'v2v') {
        result = await muapi.processV2V(params);
      } else if (route === 'i2v') {
        result = await muapi.generateI2V(params);
      } else if (route === 't2v') {
        result = await muapi.generateVideo(params);
      } else if (route === 'i2i') {
        result = await muapi.generateI2I(params);
      } else {
        result = await muapi.generateImage(params);
      }

      if (result && result.url) {
        showResult(result.url);
        saveToHistory(result.url, params.prompt || template.name, params.model || selectedModel, template.outputType || 'video');
        retryCount = 0; // Reset on success
        updateApiKeyIndicator();
      } else {
        throw new Error('No output URL returned');
      }
    } catch (err) {
      const { userMessage, retryHtml } = formatGenerationError(err, retryCount, MAX_RETRIES);
      showInlineError(container, `${userMessage}${retryHtml}`);
      const retryBtn = container.querySelector('#retry-btn');
      if (retryBtn && lastGenerationParams) {
        retryBtn.onclick = () => {
          retryCount++;
          const errEl = container.querySelector('.ts-inline-error');
          if (errEl) errEl.remove();
          runGeneration(lastGenerationParams);
        };
      }
    } finally {
      isGenerating = false;
      genBtn.disabled = false;
      genBtn.textContent = 'Generate';
    }
  };

  /**
   * The prompt Generate sends: all inputs combined (main prompt, template
   * fields, Advanced Controls, Creative Intelligence cards, AI Enhancer),
   * unless the user edited the Enhanced Prompt since the last input change.
   * Shown in the Enhanced Prompt tab so the user sees exactly what is sent.
   */
  function composeFinalPrompt() {
    if (promptManuallyEdited && lastBuiltPrompt) return lastBuiltPrompt;
    const mainPrompt = (formState[promptFieldName] ?? primaryPromptField?.value ?? '').toString();
    const tiles = { ...tileState };
    if (!tileEdited.niche) tiles.niche = '';
    const { prompt, niche } = composeTemplatePrompt({
      template,
      specs,
      userPrompt: mainPrompt,
      templateInputs: allInputs,
      fields: formState,
      advanced: formState,
      tiles,
      aiEnhancer,
      sceneOverride: formState['_customSceneBlueprint'] || '',
    });
    // Show the niche actually used on the card (unless the user edited it).
    if (!tileEdited.niche) {
      tileState.niche = niche;
      const nicheTile = container.querySelector('[data-tile="niche"]');
      if (nicheTile) nicheTile.value = niche;
    }
    lastBuiltPrompt = prompt;
    outputTabValues['Enhanced Prompt'] = prompt;
    const out = document.getElementById('outputTextarea');
    if (out && activeTab === 'Enhanced Prompt') out.value = prompt;
    return prompt;
  }

  function showResult(url) {
    lastGeneratedUrl = url;
    const previewArea = document.getElementById('previewArea');
    if (previewArea) {
      const safeUrl = sanitizeUrl(url);
      if (template.outputType === 'video') {
        previewArea.innerHTML = `<video src="${safeUrl}" controls autoplay loop class="w-full h-full object-contain rounded-xl"></video>`;
      } else {
        previewArea.innerHTML = `<img src="${safeUrl}" alt="Generated result" class="w-full h-full object-contain rounded-xl" />`;
      }
    }

    resultArea.classList.remove('hidden');
    const safeUrl = sanitizeUrl(url);
    resultArea.innerHTML = `
      <div class="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
        <h3 class="text-lg font-bold text-white mb-4">Generated Result</h3>
        <div class="rounded-[20px] border border-white/10 bg-black/40 p-4">
          ${template.outputType === 'video'
            ? `<video src="${safeUrl}" controls autoplay loop class="w-full rounded-xl"></video>`
            : `<img src="${safeUrl}" alt="Generated result" class="w-full rounded-xl" />`
          }
        </div>
        <div class="flex gap-3 mt-4">
          <a href="${sanitizeUrl(url)}" download="${template.id}-${Date.now()}" class="flex-1 bg-white text-black py-3 rounded-xl font-bold text-sm text-center hover:opacity-90 transition">Download</a>
          <button type="button" class="publish-social-btn flex-1 bg-gradient-to-r from-[#6d5efc] to-[#a855f7] text-white py-3 rounded-xl font-bold text-sm text-center hover:shadow-glow transition-all">Publish to Social</button>
          <button id="generateAgainBtn" class="flex-1 border border-white/10 bg-white/[0.04] text-white py-3 rounded-xl font-bold text-sm hover:bg-white/[0.08] transition">Generate Again</button>
        </div>
      </div>
    `;

    setTimeout(() => {
      const againBtn = document.getElementById('generateAgainBtn');
      if (againBtn) {
        againBtn.onclick = () => genBtn.click();
      }
      const publishBtn = resultArea.querySelector('.publish-social-btn');
      if (publishBtn) {
        const mediaType = template.outputType === 'video' ? 'video' : 'image';
        publishBtn.onclick = () => openSocialPublish({ mediaUrl: url, mediaType });
      }
    }, 0);
  }

  function saveToHistory(url, prompt, model, type) {
    saveGeneration({
      studio: 'template',
      type: type || 'image',
      url,
      prompt,
      model: model || template.model,
      parameters: { template_id: template.id },
      timestamp: new Date().toISOString(),
    });
  }

  container.cleanup = () => {
    globalCleanups.splice(0).forEach((fn) => { try { fn(); } catch { /* ignore */ } });
  };

  return container;
}
