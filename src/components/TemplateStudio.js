import { getTemplateById } from '../lib/templates.js';
import { resolveTemplate } from '../lib/showcaseTemplateResolver.js';
import { getTemplateThumbnailCandidates, saveCustomThumbnailToCache, clearCustomThumbnailCache, getCustomThumbnailFromCache } from '../lib/thumbnails.js';
import { getTemplateSpecs, hasEnhancedSpecs } from '../lib/templateSpecs.js';
import { muapi } from '../lib/muapi.js';
import { getNicheTerms, enrichPromptString, deriveEngineInputFromTemplate, composeNegativePrompt } from '../lib/templateEngine.js';
import { NICHE_ENRICHMENT, FILM_FAMILIES } from '../lib/templateMatrix.js';
import { t2iModels, i2iModels, i2vModels, t2vModels, v2vModels, getV2VModelById } from '../lib/models.js';
import { getEnrichedModels } from '../lib/modelCatalog.js';
import { mountModelSelector, PROVIDER_LOGOS, invertLogos, getProviderStyle } from '../lib/modelSelectorUI.js';
import { AuthModal } from './AuthModal.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import { createUploadPicker } from './UploadPicker.js';
import { navigate } from '../lib/router.js';
import { mountStudioDrawer, createStudioMenuButton } from '../lib/studioChrome.js';
import { sanitizeUrl } from '../lib/security.js';
import { TemplateThumbnailModal, mountThumbnailModal } from './modals/TemplateThumbnailModal.jsx';
import { mountPersonalizeTrigger } from './personalize/personalizePopover.js';
import { getGtmContext } from '../lib/gtmContextStore.js';
import { openSocialPublish } from '../lib/socialPublishHelpers.js';
import { addCaptionButton } from '../lib/editor/captionActions.js';

export function TemplateStudio(templateId) {
  let template = getTemplateById(templateId);

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
  let showAdvanced = false;
  let uploadedUrl = null;
  let isGenerating = false;
  let lastGeneratedUrl = '';
  let selectedModel = template.model || (template.modelType === 't2v' ? 'kling-v2.6-pro-t2v' : undefined);
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
  thumbAction.className = 'mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition';
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
  allInputs.forEach(input => {
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
          ${isPrimaryPrompt ? `<button class="gtm-boost-btn shrink-0" data-gtm-boost="primary" title="Enhance your prompt with GTM conversion frameworks" aria-label="GTM Boost prompt enhancer">🎯 GTM Boost</button>` : ''}
        </div>
      ` : ''}
    `;
    fieldWrapper.appendChild(label);

            if (input.type === 'image' || input.type === 'frame') {
                const isFrame = input.type === 'frame';
                const uploadArea = document.createElement('div');
                uploadArea.className = 'flex h-16 items-center gap-4 rounded-[20px] border border-white/10 bg-white/[0.03] px-4 text-zinc-400 cursor-pointer hover:border-emerald-400/30 transition';
                uploadArea.innerHTML = `
                    <div class="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-lg">↑</div>
                    <span class="text-sm">${isFrame ? 'Click to add start & end frames' : 'Click to upload an image'}</span>
                `;
                const setDone = (label) => {
                    uploadArea.innerHTML = `<div class="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/10 text-lg">✓</div><span class="text-sm text-emerald-200">${label}</span>`;
                };
                const setPexelsDone = (label) => {
                    uploadArea.innerHTML = `<div class="flex h-10 w-10 items-center justify-center rounded-full border border-[#d9ff00]/40 bg-[#d9ff00]/10 text-lg">📷</div><span class="text-sm text-[#d9ff00]">${label}</span>`;
                };
                uploadArea.onclick = () => {
                    const picker = createUploadPicker({
                        anchorContainer: container,
                        frameMode: isFrame,
                        acceptVideo: false,
                        onSelect: (sel) => {
                            if (isFrame) {
                                formState[input.name] = { startUrl: sel.startUrl, endUrl: sel.endUrl, urls: sel.urls };
                                setDone(sel.endUrl ? 'Start & end frames set' : 'Start frame set');
                            } else {
                                uploadedUrl = sel.url;
                                formState[input.name] = sel.url;
                                setDone('Image uploaded');
                            }
                        },
                        onClear: () => {
                            if (isFrame) {
                                formState[input.name] = null;
                            } else {
                                uploadedUrl = null;
                                formState[input.name] = null;
                            }
                            uploadArea.innerHTML = `
                                <div class="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-lg">↑</div>
                                <span class="text-sm">${isFrame ? 'Click to add start & end frames' : 'Click to upload an image'}</span>
                            `;
                        }
                    });
                    container.appendChild(picker.panel);
                };

                const pexelsBtn = document.createElement('button');
                pexelsBtn.type = 'button';
                pexelsBtn.title = 'Browse stock photos from Pexels';
                pexelsBtn.className = 'w-10 h-10 shrink-0 rounded-xl border transition-all flex items-center justify-center bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40 group relative overflow-hidden ml-2';
                pexelsBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-secondary group-hover:text-primary"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 7.76"/></svg>';
                pexelsBtn.onclick = async (e) => {
                    e.stopPropagation();
                    const { browsePexelsImages } = await import('../lib/studioPexels.js');
                    browsePexelsImages({
                        title: isFrame ? 'Select Reference Frames' : 'Select Image',
                        studioName: 'Template Studio',
                        onSelect: (asset) => {
                            const url = asset.src?.large || asset.src?.original || asset.url;
                            if (isFrame) {
                                formState[input.name] = { startUrl: url, endUrl: null, urls: [url] };
                                setPexelsDone('Start frame from Pexels');
                            } else {
                                uploadedUrl = url;
                                formState[input.name] = url;
                                setPexelsDone('Image from Pexels');
                            }
                        },
                    });
                };

                const row = document.createElement('div');
                row.className = 'flex items-center gap-2';
                row.appendChild(uploadArea);
                row.appendChild(pexelsBtn);
                fieldWrapper.appendChild(row);
            } else if (input.type === 'video') {
                const uploadArea = document.createElement('div');
                uploadArea.className = 'flex h-16 items-center gap-4 rounded-[20px] border border-white/10 bg-white/[0.03] px-4 text-zinc-400 cursor-pointer hover:border-emerald-400/30 transition';
                uploadArea.innerHTML = `
                    <div class="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-lg">↑</div>
                    <span class="text-sm">Click to upload a video</span>
                `;
                const setDone = (label) => {
                    uploadArea.innerHTML = `<div class="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/10 text-lg">✓</div><span class="text-sm text-emerald-200">${label}</span>`;
                };
                const setPexelsDone = (label) => {
                    uploadArea.innerHTML = `<div class="flex h-10 w-10 items-center justify-center rounded-full border border-[#d9ff00]/40 bg-[#d9ff00]/10 text-lg">🎬</div><span class="text-sm text-[#d9ff00]">${label}</span>`;
                };
                uploadArea.onclick = () => {
                    const picker = createUploadPicker({
                        anchorContainer: container,
                        acceptVideo: true,
                        onSelect: (sel) => {
                            uploadedUrl = sel.url;
                            formState[input.name] = sel.url;
                            setDone('Video uploaded');
                        },
                        onClear: () => {
                            uploadedUrl = null;
                            formState[input.name] = null;
                            uploadArea.innerHTML = `
                                <div class="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-lg">↑</div>
                                <span class="text-sm">Click to upload a video</span>
                            `;
                        }
                    });
                    container.appendChild(picker.panel);
                };

                const pexelsBtn = document.createElement('button');
                pexelsBtn.type = 'button';
                pexelsBtn.title = 'Browse stock videos from Pexels';
                pexelsBtn.className = 'w-10 h-10 shrink-0 rounded-xl border transition-all flex items-center justify-center bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40 group relative overflow-hidden ml-2';
                pexelsBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-secondary group-hover:text-primary"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 7.76"/></svg>';
                pexelsBtn.onclick = async (e) => {
                    e.stopPropagation();
                    const { browsePexelsVideos } = await import('../lib/studioPexels.js');
                    browsePexelsVideos({
                        title: 'Select Video',
                        studioName: 'Template Studio',
                        onSelect: (asset) => {
                            const url = (asset.video_files?.find(f => f.quality === 'hd') || asset.video_files?.[0])?.link || asset.url;
                            uploadedUrl = url;
                            formState[input.name] = url;
                            setPexelsDone('Video from Pexels');
                        },
                    });
                };

                const row = document.createElement('div');
                row.className = 'flex items-center gap-2';
                row.appendChild(uploadArea);
                row.appendChild(pexelsBtn);
                fieldWrapper.appendChild(row);
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

  // GTM Boost: wire the button on the primary prompt field to open the
  // modal, pre-fill template context, and write the generated prompt back
  // into the prompt field + formState. Available on EVERY template type
  // (video and image).
  const gtmBtn = leftPanel.querySelector('[data-gtm-boost="primary"]');
  if (gtmBtn && promptEl && promptFieldName) {
    gtmBtn.addEventListener('click', async () => {
      gtmBtn.disabled = true;
      const originalText = gtmBtn.textContent;
      gtmBtn.textContent = '🎯 Loading…';
      try {
        // Fetch template-aware defaults from the backend so the modal
        // opens with the right industry/tonality/methodology pre-selected.
        const ctx = await import('../lib/uiIntegration.js').then(async (m) => {
          const result = m.fetchGTMTemplateContext?.(template);
          if (result && typeof result.then === 'function') return await result;
          return result;
        }).catch(() => null);
        // Merge: any pre-existing user input wins over the backend defaults.
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
          // Write into the DOM element so the user sees it, then update
          // formState and dispatch input events so any other listeners
          // (e.g. the AI Enhancer / extra instructions) pick it up.
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
        gtmBtn.disabled = false;
        gtmBtn.textContent = originalText;
      }
    });
  }

  // Model selector (async - fetches enriched catalog with descriptions)
  const outputType = template.outputType || (template.modelType === 't2i' || template.modelType === 'i2i' ? 'image' : 'video');
  if (outputType === 'video' || ['i2i', 't2i', 'i2v', 't2v'].includes(template.modelType)) {
    const modelWrapper = document.createElement('div');
    modelWrapper.className = 'mt-6';
let fallbackList = [];
     if (template.modelType === 'i2v') fallbackList = i2vModels;
     else if (template.modelType === 'i2i') fallbackList = i2iModels;
     else if (template.modelType === 't2i') fallbackList = t2iModels;
     else if (template.modelType === 't2v') fallbackList = t2vModels;
     else if (template.modelType === 'v2v') fallbackList = v2vModels;

     loadedModels = fallbackList;
    const getModelName = (id) => {
      const m = loadedModels.find(x => x.id === id) || fallbackList.find(x => x.id === id);
      return m ? m.name : id;
    };
    const getModel = (id) => loadedModels.find(x => x.id === id) || fallbackList.find(x => x.id === id);

    const triggerBtn = document.createElement('button');
    triggerBtn.type = 'button';
    triggerBtn.id = 'template-model-trigger';
    triggerBtn.setAttribute('aria-haspopup', 'listbox');
    triggerBtn.setAttribute('aria-expanded', 'false');
    triggerBtn.setAttribute('aria-label', 'Select model');
    const updateTrigger = () => {
      const model = getModel(selectedModel);
      const provider = model?.provider || 'muapi';
      const logoUrl = PROVIDER_LOGOS[provider];
      const name = model ? model.name : getModelName(selectedModel);
      if (logoUrl) {
        triggerBtn.innerHTML = `<div class="w-5 h-5 rounded-md flex items-center justify-center overflow-hidden bg-white/5 shrink-0"><img src="${logoUrl}" alt="" class="w-full h-full object-contain ${invertLogos.includes(provider) ? 'invert' : ''}" /></div><span class="text-sm font-bold text-white truncate">${name}</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-muted shrink-0"><polyline points="6 9 12 15 18 9"/></svg>`;
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

    const openDropdown = () => {
      dropdown.classList.remove('opacity-0', 'pointer-events-none', 'scale-95');
      dropdown.classList.add('opacity-100', 'pointer-events-auto', 'scale-100');
      triggerBtn.setAttribute('aria-expanded', 'true');

      const triggerRect = triggerBtn.getBoundingClientRect();
      dropdown.style.top = `${triggerRect.bottom + 6}px`;
      dropdown.style.left = `${triggerRect.left}px`;

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
            onSelectModel: (modelId) => {
              selectedModel = modelId;
              updateTrigger();
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

        withTimeout(getEnrichedModels(template.modelType))
          .then(enriched => {
            const models = enriched && enriched.length > 0 ? enriched : fallbackList;
            loadedModels = models;
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

    triggerBtn.onclick = (e) => {
      e.stopPropagation();
      if (dropdown.classList.contains('opacity-100')) {
        closeDropdown();
      } else {
        openDropdown();
      }
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape' && dropdown.classList.contains('opacity-100')) {
        closeDropdown();
        triggerBtn.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    const modelLoadingStatus = document.createElement('span');
    modelLoadingStatus.id = 'model-loading-status';
    modelLoadingStatus.className = 'text-[10px] text-zinc-500';

    const headerRow = document.createElement('div');
    headerRow.className = 'mb-3 flex items-center justify-between gap-3';
    const label = document.createElement('div');
    label.className = 'text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500';
    label.textContent = 'Model';
    headerRow.appendChild(label);
    headerRow.appendChild(triggerBtn);
    headerRow.appendChild(modelLoadingStatus);
    modelWrapper.appendChild(headerRow);
    modelWrapper.appendChild(dropdown);
    leftPanel.appendChild(modelWrapper);

    // Video upload button — appears for video templates so v2v models
    // (video-to-video) can accept a video source alongside image uploads.
    if (outputType === 'video') {
      const videoUploadWrapper = document.createElement('div');
      videoUploadWrapper.className = 'mt-4';
      videoUploadWrapper.innerHTML = `
        <div class="flex items-center justify-between gap-3">
          <label class="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Video Source (V2V)</label>
          <button id="videoUploadBtn" type="button" class="text-[10px] font-semibold uppercase tracking-[0.18em] rounded-full border border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-white transition px-3 py-1">Upload video</button>
        </div>
      `;
      leftPanel.appendChild(videoUploadWrapper);

      const videoBtn = videoUploadWrapper.querySelector('#videoUploadBtn');
      const setVideoDone = (label) => {
        videoBtn.innerHTML = `<span class="text-emerald-200">✓ ${label}</span>`;
      };
      videoBtn.onclick = () => {
        const picker = createUploadPicker({
          anchorContainer: container,
          acceptVideo: true,
          onSelect: (sel) => {
            uploadedUrl = sel.url;
            formState['video_url'] = sel.url;
            setVideoDone('Video uploaded');
          },
          onClear: () => {
            uploadedUrl = null;
            formState['video_url'] = null;
            videoBtn.textContent = 'Upload video';
          }
        });
        container.appendChild(picker.panel);
      };
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
  const gtmBoostBtn = document.createElement('button');
  gtmBoostBtn.type = 'button';
  gtmBoostBtn.textContent = '🎯 GTM Boost';
  gtmBoostBtn.title = 'Enhance your prompt with GTM conversion frameworks';
  gtmBoostBtn.setAttribute('aria-label', 'GTM Boost prompt enhancer');
  gtmBoostBtn.className = 'gtm-boost-btn w-full mt-4';
  leftPanel.appendChild(gtmBoostBtn);

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

  advancedFields.forEach(field => {
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
    <textarea class="w-full rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400/50 resize-none" rows="4" placeholder="optional cinematic instructions" data-advanced-field="extraInstructions"></textarea>
  `;
  advancedControls.appendChild(extraWrapper);

  // Generate button
  const genBtn = document.createElement('button');
  genBtn.type = 'button';
  genBtn.className = 'mt-6 flex h-14 w-full items-center justify-center rounded-[20px] bg-white text-lg font-semibold text-black shadow-xl transition hover:opacity-90';
  genBtn.textContent = 'Generate';
  genBtn.setAttribute('aria-label', 'Generate template');
  leftPanel.appendChild(genBtn);
  mountPersonalizeTrigger({ controlsContainer: leftPanel, appId: 'template-studio', getTextarea: () => document.getElementById('outputTextarea') || null });

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
    <p class="mt-2 mb-5 text-sm text-zinc-400">These tiles show the cinematic structure, creative direction, and visual strategy this template will use to build your final video.</p>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div class="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-4 hover:border-blue-400/20 transition cursor-pointer">
        <div class="mb-3 text-3xl">🏷️</div>
        <h3 class="text-lg font-bold text-white mb-2">Auto-Detected Niche</h3>
        <textarea class="w-full rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-zinc-300 outline-none transition focus:border-emerald-400/50 resize-none" rows="3" data-tile="niche">${hasSpecs && specs.niche ? specs.niche : 'general-business'}</textarea>
      </div>
      <div class="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-4 hover:border-violet-400/20 transition cursor-pointer">
        <div class="mb-3 text-3xl">🎬</div>
        <h3 class="text-lg font-bold text-white mb-2">Scene Structure</h3>
        <textarea class="w-full rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-zinc-300 outline-none transition focus:border-emerald-400/50 resize-none" rows="3" data-tile="scene">${hasSpecs && specs.sceneBlueprint ? specs.sceneBlueprint.join(' → ') : 'Hook → Subject → Movement → Payoff → CTA'}</textarea>
      </div>
      <div class="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-4 hover:border-emerald-400/20 transition cursor-pointer">
        <div class="mb-3 text-3xl">🎥</div>
        <h3 class="text-lg font-bold text-white mb-2">Cinematic Enrichment</h3>
        <textarea class="w-full rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-zinc-300 outline-none transition focus:border-emerald-400/50 resize-none" rows="3" data-tile="cinematic">${hasSpecs && specs.cinematography ? specs.cinematography : 'Dynamic camera movement, shallow depth of field, professional lighting'}</textarea>
      </div>
      <div class="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-4 hover:border-amber-400/20 transition cursor-pointer">
        <div class="mb-3 text-3xl">⚙️</div>
        <h3 class="text-lg font-bold text-white mb-2">Visual Style</h3>
        <textarea class="w-full rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-zinc-300 outline-none transition focus:border-emerald-400/50 resize-none" rows="3" data-tile="style">${hasSpecs && specs.visualStyle ? specs.visualStyle : 'Polished, cinematic, high-contrast, premium aesthetic'}</textarea>
      </div>
      <div class="md:col-span-2 rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-4 hover:border-rose-400/20 transition cursor-pointer">
        <div class="mb-3 text-3xl">✨</div>
        <h3 class="text-lg font-bold text-white mb-2">Enhancer Keywords</h3>
        <textarea class="w-full rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-zinc-300 outline-none transition focus:border-emerald-400/50 resize-none" rows="4" data-tile="keywords">${hasSpecs && specs.enhancerKeywords ? specs.enhancerKeywords : 'cinematic, professional, 4K, high quality, premium'}</textarea>
      </div>
    </div>
  `;
  leftPanel.appendChild(intelligenceSection);

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
        lastBuiltPrompt = outputTextarea.value;
        if (primaryPromptField) {
          primaryPromptField.value = outputTextarea.value;
        }
        formState[promptFieldName] = outputTextarea.value;
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
        textarea.value = beats.join(' → ');
        break;
      }
      case 'Voiceover':
        textarea.value = saved || `Create a premium voiceover for a ${template.name}. Open with a fast hook, build emotional or commercial momentum, end with a clear call to action.`;
        break;
      case 'Negative Prompt':
        textarea.value = specs.negativePrompt || 'Low quality, blurry, amateur, poorly lit, generic stock look';
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
        const current = lastBuiltPrompt || textarea.value || '';
        const enhanced = `${current}, cinematic quality, professional lighting, high detail, 4K resolution`.trim();
        lastBuiltPrompt = enhanced;
        outputTabValues['Enhanced Prompt'] = enhanced;
        textarea.value = enhanced;
        if (primaryPromptField) {
          primaryPromptField.value = enhanced;
        }
        if (promptFieldName) {
          formState[promptFieldName] = enhanced;
        }
        textarea.classList.add('border-emerald-400/50');
        setTimeout(() => textarea.classList.remove('border-emerald-400/50'), 1000);
      };
    }

    // GTM Boost button (bottom) — unified to use openGTMPromptModal
    if (gtmBoostBtn) {
      gtmBoostBtn.onclick = async () => {
        try {
          const ctx = await import('../lib/uiIntegration.js').then(async (m) => {
            const result = m.fetchGTMTemplateContext?.(template);
            if (result && typeof result.then === 'function') return await result;
            return result;
          }).catch(() => null) || {};
          const basePrompt = (document.getElementById('outputTextarea')?.value) || template.description || '';
          const templateContext = {
            ...ctx,
            basePrompt,
            templateId: template.id,
            category: template.category,
            niche: template.niche,
            outputType: template.outputType,
          };
          const onPromptGenerated = (text) => {
            lastBuiltPrompt = text;
            outputTabValues['Enhanced Prompt'] = text;
            const ta = document.getElementById('outputTextarea');
            if (ta) {
              ta.value = text;
              ta.dispatchEvent(new Event('input', { bubbles: true }));
              ta.dispatchEvent(new Event('change', { bubbles: true }));
            }
            if (primaryPromptField) {
              primaryPromptField.value = text;
              primaryPromptField.dispatchEvent(new Event('input', { bubbles: true }));
              primaryPromptField.dispatchEvent(new Event('change', { bubbles: true }));
            }
            if (promptFieldName) {
              formState[promptFieldName] = text;
            }
          };
          import('../lib/uiIntegration.js').then(({ openGTMPromptModal }) => {
            openGTMPromptModal('template-studio', onPromptGenerated, {
              templateContext,
            });
          }).catch((e) => {
            console.warn('[TemplateStudio] GTM Boost modal load failed:', e);
            showInlineError(container, 'Failed to load GTM Boost. Please try again.');
          });
        } catch (e) {
          console.warn('[TemplateStudio] GTM Boost failed:', e);
          showInlineError(container, 'GTM Boost failed. Please try again.');
        }
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
      genBtn.insertAdjacentElement('afterend', errEl);
    }
    errEl.textContent = message;
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
    const userPrompt = lastBuiltPrompt || (primaryPromptField?.value || '').trim();
    if (!userPrompt && !template.basePrompt) {
      showInlineError(container, 'Please enter a prompt or description before generating.');
      return;
    }

    // Validate that the selected model matches the template's model type.
    const modelTypeMap = {
      i2i: i2iModels,
      t2i: t2iModels,
      i2v: i2vModels,
      t2v: t2vModels,
      v2v: v2vModels,
    };
    const allowedModels = modelTypeMap[template.modelType];
    if (allowedModels && !allowedModels.find(m => m.id === (selectedModel || template.model))) {
      const fallback = allowedModels[0]?.id || template.model;
      showInlineError(container, `Model "${selectedModel || template.model}" is not compatible with this template type. Falling back to ${fallback}.`);
      selectedModel = fallback;
    }

    // Build params for potential retry
    const params = { model: selectedModel || template.model, ...(template.defaultParams || {}) };
    
    // Normalize aspect ratio for standard and matrix templates
    const aspectRatio = template.aspectRatio || (template.aspectRatios ? template.aspectRatios[0] : null);
    if (aspectRatio) params.aspect_ratio = aspectRatio;

    // Normalize duration from template or defaultParams
    const duration = template.duration
      ? (typeof template.duration === 'object' ? template.duration.default : template.duration)
      : template.defaultParams?.duration;
    if (duration) params.duration = duration;

    allInputs.forEach(input => {
      if (formState[input.name]) {
        params[input.name] = formState[input.name];
      }
    });

    // Build prompt from all available template metadata and advanced options
    const promptForBuild = lastBuiltPrompt || params.prompt || '';
    params.prompt = buildEnrichedPrompt(template, specs, formState, promptForBuild);
    lastBuiltPrompt = params.prompt;

    const negNiche = (formState.niche && formState.niche !== 'auto-detect') ? formState.niche : (template.niche || '');
    const negativePrompt = formState['_customNegativePrompt'] || composeNegativePrompt(template.filmFamily || '', negNiche, formState.visualStyle || 'commercial') || specs.negativePrompt || '';
    if (negativePrompt) params.negative_prompt = negativePrompt;

    // Attach the user-generated custom thumbnail if one exists
    if (customThumbnailUrl) {
      params.thumbnail_url = customThumbnailUrl;
    }

    // Client-side validation before muapi call
    const EFFECT_MODELS = ['ai-video-effects', 'motion-controls', 'video-effects', 'vfx'];
    const needsImageUrl = template.modelType === 'i2v' || template.modelType === 'i2i';
    if (needsImageUrl && !params.image_url) {
      showInlineError(container, 'Please upload an image before generating.');
      return;
    }
     // V2V models need a video_url instead of image_url
     const selectedModelObj = loadedModels.find(m => m.id === selectedModel);
     const isV2V = v2vModels.includes(selectedModelObj) || (selectedModelObj && selectedModelObj.videoField === 'video_url');
     if (isV2V && !params.video_url) {
      showInlineError(container, 'Please upload a video before generating.');
      return;
    }
    if (EFFECT_MODELS.includes(params.model) && !params.name) {
      showInlineError(container, 'Please enter a name before generating.');
      return;
    }

    // Store params for retry and run generation
    lastGenerationParams = params;
    retryCount = 0;
    await runGeneration(params);
  };

  async function runGeneration(params) {
    if (isGenerating) return;

    isGenerating = true;
    genBtn.disabled = true;
    genBtn.innerHTML = '<span class="animate-spin inline-block mr-2">&#9711;</span> Generating...';

    try {
      // Merge template defaults with the params built by genBtn.onclick
      const mergedParams = { model: selectedModel || template.model, ...(template.defaultParams || {}), ...params };
      params = mergedParams;

      // Normalize aspect ratio for standard and matrix templates
      const aspectRatio = template.aspectRatio || (template.aspectRatios ? template.aspectRatios[0] : null);
      if (aspectRatio) params.aspect_ratio = aspectRatio;

      // Normalize duration from template or defaultParams
      const duration = template.duration
        ? (typeof template.duration === 'object' ? template.duration.default : template.duration)
        : template.defaultParams?.duration;
      if (duration) params.duration = duration;

      allInputs.forEach(input => {
        if (formState[input.name]) {
          params[input.name] = formState[input.name];
        }
      });

      // Build prompt from all available template metadata and advanced options
      params.prompt = buildEnrichedPrompt(template, specs, formState, params.prompt);
      lastBuiltPrompt = params.prompt;

      const negNiche = (formState.niche && formState.niche !== 'auto-detect') ? formState.niche : (template.niche || '');
      const negativePrompt = composeNegativePrompt(template.filmFamily || '', negNiche, formState.visualStyle || 'commercial') || specs.negativePrompt || '';
      if (negativePrompt) params.negative_prompt = negativePrompt;

       let result;
       if (template.modelType === 'i2v') {
         result = await muapi.generateI2V(params);
       } else if (template.modelType === 'i2i') {
         result = await muapi.generateI2I(params);
       } else if (template.modelType === 't2v') {
         const isV2V = getV2VModelById(selectedModel);
         if (isV2V) {
           result = await muapi.processV2V(params);
         } else {
           result = await muapi.generateVideo(params);
         }
       } else {
         result = await muapi.generateImage(params);
       }

      if (result && result.url) {
        showResult(result.url);
        saveToHistory(result.url, params.prompt || template.name);
        retryCount = 0; // Reset on success
        updateApiKeyIndicator();
      } else {
        throw new Error('No output URL returned');
      }
    } catch (err) {
      console.error('[TemplateStudio]', err);
      const message = err.message || 'Generation failed';
      const userMessage = message.length > 80 ? 'Generation failed. Please try again.' : message;
      const retryHtml = retryCount < MAX_RETRIES ? ' <button id="retry-btn" class="ml-2 underline text-emerald-200 hover:text-white">Retry</button>' : '';
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
      setTimeout(() => {
        genBtn.textContent = 'Generate';
        genBtn.disabled = false;
      }, 3000);
      return;
    }

    isGenerating = false;
    genBtn.disabled = false;
    genBtn.textContent = 'Generate';
  };

  function buildEnrichedPrompt(template, specs, formState, userPrompt) {
    const parts = [];

    // User prompt first as the core idea
    if (userPrompt) parts.push(userPrompt);

    // Subject
    const subject = formState['subject'];
    if (subject) parts.push(subject);

    // Base prompt substitution
    if (template.basePrompt) {
      const base = template.basePrompt.replace('{prompt}', userPrompt || '');
      if (base) parts.push(base);
    }

    // Scene blueprint: matrix template.storyBlueprint else specs.sceneBlueprint
    const sceneBlueprint = (template.storyBlueprint && template.storyBlueprint.length)
      ? template.storyBlueprint
      : (specs.sceneBlueprint || []);
    if (sceneBlueprint.length) {
      parts.push(`Scene structure: ${sceneBlueprint.join(' → ')}`);
    }

    // Cinematography
    if (specs.cinematography) {
      parts.push(specs.cinematography);
    }

    // Visual style: specs.visualStyle else formState.visualStyle
    const visualStyle = specs.visualStyle || formState['visualStyle'];
    if (visualStyle) {
      parts.push(`Visual style: ${visualStyle}`);
    }

    // Niche enrichment
    const niche = (formState.niche && formState.niche !== 'auto-detect') ? formState.niche : (template.niche || '');
    if (niche && NICHE_ENRICHMENT[niche]) {
      parts.push(NICHE_ENRICHMENT[niche].slice(0, 5).join(', '));
    } else if (niche) {
      const nicheTerms = getNicheTerms(niche);
      if (nicheTerms && nicheTerms.length) {
        parts.push(nicheTerms.slice(0, 5).join(', '));
      }
    }

    // filmFamily direction + promptDirection
    if (template.filmFamily && FILM_FAMILIES[template.filmFamily]) {
      parts.push(FILM_FAMILIES[template.filmFamily].direction);
    }
    if (template.promptDirection) {
      parts.push(template.promptDirection);
    }

    // CTA
    const cta = formState['cta'];
    if (cta) {
      parts.push(`Call to action: ${cta}`);
    }

    // Setting
    const setting = formState['setting'];
    if (setting) {
      parts.push(`Setting: ${setting}`);
    }

    // Audience
    const audience = formState['audience'];
    if (audience) {
      parts.push(`Target audience: ${audience}`);
    }

    // Extra instructions
    const extraInstructions = formState['extraInstructions'];
    if (extraInstructions) {
      parts.push(extraInstructions);
    }

    // Core use case
    if (specs.coreUseCase) {
      parts.push(specs.coreUseCase);
    }

    // AI ENHANCER: final polishing layer
    if (aiEnhancer && userPrompt) {
      if (typeof enrichPromptString === 'function') {
        const enriched = enrichPromptString(userPrompt, {
          niche,
          visualStyle: formState.visualStyle || 'commercial',
          platform: (template.aspectRatio && template.aspectRatio.includes('9:16')) ? 'TikTok Reel' : 'general',
          filmType: template.filmFamily || ''
        });
        if (enriched) {
          parts.push(enriched);
        }
      } else if (specs.enhancerKeywords) {
        parts.push(specs.enhancerKeywords);
      }
    }

    // Niche-aware negative prompt (engine special-cases all canonical niches)
    const negNiche = (formState.niche && formState.niche !== 'auto-detect') ? formState.niche : (template.niche || '');
    const negFilm = template.filmFamily || '';
    const negVisual = formState.visualStyle || 'commercial';
    const engineNegative = composeNegativePrompt(negFilm, negNiche, negVisual);
    const negativePrompt = engineNegative || specs.negativePrompt || 'Low quality, blurry, amateur, poorly lit, generic stock look';
    parts.push(`Negative prompt: ${negativePrompt}`);

    // Join, clean up duplicates and extra whitespace
    let prompt = parts.filter(Boolean).join('. ');
    prompt = prompt
      .replace(/\s*\.\s*/g, '. ')
      .replace(/\.{2,}/g, '.')
      .replace(/([^.]+)\.\s*(?=\1)/g, '')
      .trim();
    if (!prompt.endsWith('.')) prompt += '.';
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
          <a href="${url}" download="${template.id}-${Date.now()}" class="flex-1 bg-white text-black py-3 rounded-xl font-bold text-sm text-center hover:opacity-90 transition">Download</a>
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

  function saveToHistory(url, prompt) {
    try {
      const history = JSON.parse(localStorage.getItem('muapi_history') || '[]');
      history.unshift({
        id: Date.now().toString(),
        url,
        prompt,
        model: template.model,
        template: template.id,
        timestamp: new Date().toISOString(),
      });
      localStorage.setItem('muapi_history', JSON.stringify(history.slice(0, 100)));
    } catch (e) { /* ignore */ }
  }

  return container;
}
