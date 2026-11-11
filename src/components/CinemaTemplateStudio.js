/**
 * CINEMA TEMPLATE STUDIO
 * UI Component for the Cinematic Template System
 */

import { showToast } from '../lib/loading.js';
import { escapeHtml } from '../lib/security.js';
import { resolveTemplate } from '../lib/showcaseTemplateResolver.js';
import { createActionRow, createAdvancedButton, setActionPillLabel, styleThumbnailButton, arrangeActionRow } from './studio/actionRow.js';
import { mountPersonalizeTrigger } from './personalize/personalizePopover.js';
import { muapi } from '../lib/muapi.js';
import { navigate } from '../lib/router.js';
import { StoryboardStudio } from './StoryboardStudio.js';
import { createTemplateMediaField, extractTemplateMedia, routeTemplateGeneration, applyTemplateMediaToParams, modelsForRoute, modelForRoute, TEMPLATE_ROUTE_LABELS, createVideoSettingsControls, snapAspectRatioForModel, openStudioModelPicker, findTemplateModel, promptlessV2VBlock, endFrameSupport, dropUndeclaredSettings } from '../lib/templateMedia.js';
import {
  getTemplateRegistry,
  SHOT_TYPES,
  CAMERA_MOVEMENTS,
  BRAND_VOICES,
  TARGET_AUDIENCES,
  TemplateInputBuilder,
  PromptAssemblyEngine,
  SceneBuilder,
  RenderHandoff,
  TemplateStorage
} from '../lib/cinematicTemplates.js';
import { getVideoIntent, setVideoIntent, subscribeVideoIntent, resetVideoIntent } from '../lib/videoIntentStore.js';
import { t2iModels, i2iModels, i2vModels, t2vModels, v2vModels, getV2VModelById } from '../lib/models.js';
import { CINEMATIC_THEME } from '../lib/cinematicTheme.js';

import { createStudioHeader, demoteBannerHeading, getTemplateThumbnailCandidates, saveCustomThumbnailToCache, getCustomThumbnailFromCache, clearCustomThumbnailCache } from '../lib/thumbnails.js';
import { TemplateThumbnailModal, mountThumbnailModal } from './modals/TemplateThumbnailModal.jsx';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import { AuthModal } from './AuthModal.js';
import { getGtmContext } from '../lib/gtmContextStore.js';
import { openSocialPublish } from '../lib/socialPublishHelpers.js';
import { openPromptGallery } from '../lib/promptGalleryIntegration.js';
import { openRecipeModal } from '../lib/recipeIntegration.js';
import { openMonetizationHub } from '../lib/monetizationIntegration.js';
import { addCaptionButton } from '../lib/editor/captionActions.js';
import { selectScenes } from '../lib/sceneSelector.js';
import { getEnrichedModels } from '../lib/modelCatalog.js';
import { renderProviderLogoImg, mountModelSelector, PROVIDER_LOGOS, invertLogos, getProviderStyle, positionModelSelectorDropdown } from '../lib/modelSelectorUI.js';
import { enrichPromptString } from '../lib/templateEngine.js';
import { resolveModel, normalizeAspectRatio, normalizeDuration, attachThumbnail, buildNegativePrompt, formatGenerationError } from '../lib/templateGenerationOrchestrator.js';
import { saveGeneration } from '../lib/generationHistory.js';
import { appendMissingInputs, templateInputEntries, detectTemplateNiche } from '../lib/templatePromptComposer.js';
import { createTemplateVideoTools } from '../lib/templateVideoTools.js';
import { createResultHistory, createResultActions, createFrameScrubber, buildExtendParams, canExtend, snapshotGenerationParams } from '../lib/templateResultTools.js';
import { createAbortAwareGenerateButton, startGenerationProgress } from '../lib/studioHelpers.js';
import { createPendingJobTracker, resumePendingJobs } from '../lib/pendingJobs.js';

/**
 * Resolve the `W:H` aspect ratio for a generation request.
 *
 * Precedence: the user's explicit choice (`inputs.aspectRatio`, written by the
 * aspect-ratio control and by the video-intent form) wins over the template
 * metadata. The template metadata is only the default for a user who has not
 * picked one, and `16:9` is the safe last resort for a template that carries no
 * aspect-ratio metadata at all.
 *
 * Every branch returns the same `W:H` string shape — the value `muapi.js`
 * forwards verbatim as `aspect_ratio` for BOTH `generateImage` and
 * `generateVideo` — so no per-endpoint translation is needed and the format the
 * API expects is preserved.
 *
 * @param {{ aspectRatio?: unknown }} [inputs] user-entered form state
 * @param {{ aspectRatio?: unknown, aspectRatios?: unknown[] }} [template] template metadata
 * @returns {string} e.g. '16:9', '9:16', '1:1'
 */
export function resolveGenerationAspectRatio(inputs, template) {
  const requested = typeof inputs?.aspectRatio === 'string' ? inputs.aspectRatio.trim() : '';
  return requested || normalizeAspectRatio(template || {}) || '16:9';
}

export function CinemaTemplateStudio() {
  const container = document.createElement('div');
  container.className = 'cinema-template-studio w-full h-full flex flex-col bg-black overflow-hidden';

  // State
  const registry = getTemplateRegistry();
  let currentTemplate = null;
  let currentMode = 'quick';
  let currentInputs = {};
  let sceneBuilder = null;
  let selectedScenes = [];
  let view = 'browse';
  let isGenerating = false;
  let lastGenerationParams = null;
  let retryCount = 0;
  const MAX_RETRIES = 2;
  let generationResult = null;

  let incomingStoryboard = null;
  let storyboardProjectId = null;
  let incomingCinemaTemplateId = null;

  let _modelSelectorOutsideClickHandler = null;

  let selectedModel = undefined;
  let mediaRouteBadge = null;
  const MEDIA_ROUTE_LABELS = TEMPLATE_ROUTE_LABELS;
  // Set by the model picker: switches its model list when the route changes.
  let syncModelPickerToRoute = null;
  // The model the user chose themselves (model picker or list), as opposed
  // to one switched in automatically when media changes the route.
  let explicitModelPick = null;
  // Pending (debounced) Video Intent save; Generate runs it first.
  let flushVideoIntentSync = null;
  // Mode of the variant picked in the Video Studio model picker; reset per template.
  let pickedMode = null;
  // Creative Intelligence cards as shown / edited (kept apart from the
  // Advanced Controls so the Niche card never overwrites the Niche select).
  let currentTiles = {};
  let tileEdited = {};
  // Fields the user actually typed / picked (template fields + Advanced
  // Controls) — the Video Intent panel never overwrites these.
  let userEditedFields = new Set();
  const VISUAL_STYLE_OPTIONS = ['luxury', 'dramatic', 'documentary', 'commercial'];
  // Duration / resolution / native-audio controls (video templates).
  let videoSettings = null;
  // Video Studio prompt-bar tools (ratio, Advanced, Motion & Style,
  // attachment toolbar) — rebuilt with the create view.
  let videoTools = null;
  // After-generation tools (Video Studio): history strip, Regenerate, Extend.
  let currentResultEntry = null;
  let lastRequestId = null;
  const resultHistory = createResultHistory({
    storageKey: 'cinema_template_history',
    onSelect: (entry) => {
      // History is shared across Cinema templates: restore the template that
      // made this result, so the preview and Regenerate use its output type
      // (e.g. a video picked while Movie Poster is open).
      if (entry.templateId && entry.templateId !== currentTemplate?.id) {
        const owner = registry.get(entry.templateId);
        if (owner) currentTemplate = owner;
      }
      generationResult = entry.url;
      currentResultEntry = entry;
      view = 'preview';
      render();
    },
  });
  // Media fields by kind (create view), for prompt-toolbar attachments.
  const mediaFields = { image: [], frame: [], video: [] };
  let lastModelType = null;
  let isAiEnhancer = true;
  let customThumbnailUrl = null;
  let lastBuiltPrompt = '';
  let outputTabValues = {};
  let activeTab = 'Enhanced Prompt';
  let showAdvanced = false;
  let promptManuallyEdited = false;
  let browseFilter = 'all'; // 'all' | 'favorites' | 'recent' | 'custom'
  let sceneTimelineDebounce = null;

  // Expose a callback for the embedded StoryboardStudio to hand off its
  // generated storyboard back into this template studio.
  window.useStoryboardInTemplate = function useStoryboardInTemplate(storyboard) {
    if (!storyboard) return;
    incomingStoryboard = storyboard;
    storyboardProjectId = storyboard.id || storyboard.projectId || null;
    if (incomingStoryboard?.frames?.length && sceneBuilder) {
      ingestStoryboardIntoBuilder(incomingStoryboard);
    }
    view = 'create';
    render();
    showToast('Storyboard applied to template', 'success');
  };

  // Restore GTM context
  try {
    const restoredGtmContext = getGtmContext('cinema-template-studio');
    if (restoredGtmContext && typeof console !== 'undefined' && console.info) {
      console.info('[CinemaTemplateStudio] Restored GTM context', restoredGtmContext);
    }
    void restoredGtmContext;
  } catch { /* ignore */ }

  // Recover generations that finished while the user was away.
  try {
    resumePendingJobs('cinema-template', {
      poll: (id, attempts, interval) => muapi.pollForResult(id, attempts, interval),
      onResult: (url, job) => {
        const meta = job?.historyMeta || {};
        const type = meta.outputType === 'image' ? 'image' : 'video';
        saveToHistory(url, meta.prompt || '', meta.model || '', meta.templateId || '', type);
        resultHistory.add({ id: job?.requestId || null, url, prompt: meta.prompt || '', model: meta.model || '', type, templateId: meta.templateId || '' });
        showToast('Recovered a generation that finished while you were away', 'success');
      },
    });
  } catch { /* storage unavailable */ }

  render();

  function render() {
    container.innerHTML = '';

    switch (view) {
      case 'browse':
        renderBrowseView();
        break;
      case 'create':
        renderCreateView();
        break;
      case 'storyboard':
        renderStoryboardView();
        break;
      case 'preview':
        renderPreviewView();
        break;
    }
  }

  function renderBrowseView() {
    const favCount = registry.getAll().filter(t => TemplateStorage.isFavorite(t.id)).length;
    const recentEntries = TemplateStorage.getRecent();
    const seenIds = new Set();
    const dedupedRecent = [];
    for (const entry of recentEntries) {
      if (!seenIds.has(entry.templateId)) {
        seenIds.add(entry.templateId);
        dedupedRecent.push(entry);
      }
    }
    const recentCount = dedupedRecent.length;
    const customCount = registry.getAll().filter(t => t.isCustom).length;

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between p-4 border-b border-white/10 bg-black/50';
    header.innerHTML = `
      <div class="flex items-center gap-4">
        <button id="back-btn" class="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
            <span class="text-xl">🎬</span>
          </div>
          <div>
            <h1 class="${CINEMATIC_THEME.text.title} text-white">CINEMATIC TEMPLATES</h1>
            <p class="text-xs text-secondary">${registry.getAll().length} Templates</p>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <button id="favorites-btn" data-filter="favorites" class="px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2 ${browseFilter === 'favorites' ? 'bg-primary text-black font-bold' : 'bg-white/5 hover:bg-white/10 text-secondary'}">
          <span>❤️</span> <span class="favorites-label">Favorites${favCount > 0 ? ` (${favCount})` : ''}</span>
        </button>
        <button id="recent-btn" data-filter="recent" class="px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2 ${browseFilter === 'recent' ? 'bg-primary text-black font-bold' : 'bg-white/5 hover:bg-white/10 text-secondary'}">
          <span>🕐</span> <span class="recent-label">Recent${recentCount > 0 ? ` (${recentCount})` : ''}</span>
        </button>
        <button id="custom-btn" data-filter="custom" class="px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2 ${browseFilter === 'custom' ? 'bg-primary text-black font-bold' : 'bg-white/5 hover:bg-white/10 text-secondary'}">
          <span>✨</span> <span class="custom-label">My Templates${customCount > 0 ? ` (${customCount})` : ''}</span>
        </button>
      </div>
    `;
    const bannerRow = document.createElement('div');
    bannerRow.className = 'px-4 pt-4 shrink-0';
    // the page below already has its own heading (CINEMATIC TEMPLATES)
    bannerRow.appendChild(demoteBannerHeading(createStudioHeader('cinema-template', 'Cinema Template Studio', 'Ready-made cinematic templates: pick one, add your media and generate')));
    container.appendChild(bannerRow);
    container.appendChild(header);
container.querySelector('#favorites-btn').onclick = () => { browseFilter = 'favorites'; render(); };
    container.querySelector('#recent-btn').onclick = () => { browseFilter = 'recent'; render(); };
    container.querySelector('#custom-btn').onclick = () => { browseFilter = 'custom'; render(); };

    let filteredTemplates;
    switch (browseFilter) {
      case 'favorites':
        filteredTemplates = registry.getAll().filter(t => TemplateStorage.isFavorite(t.id));
        break;
      case 'recent': {
        const recentMap = new Map();
        for (const entry of dedupedRecent) {
          const t = registry.get(entry.templateId);
          if (t) recentMap.set(t.id, t);
        }
        filteredTemplates = Array.from(recentMap.values());
        break;
      }
      case 'custom':
        filteredTemplates = registry.getAll().filter(t => t.isCustom);
        break;
      default:
        filteredTemplates = registry.getAll();
    }

    const grid = document.createElement('div');
    grid.className = 'flex-1 overflow-auto p-6';

    if (browseFilter !== 'all') {
      const filterHeader = document.createElement('div');
      filterHeader.className = 'flex items-center justify-between mb-4';
      const filterTitle = document.createElement('span');
      filterTitle.className = 'text-sm font-bold text-white uppercase tracking-wider';
      filterTitle.textContent = browseFilter === 'favorites' ? '❤️ Favorite Templates' : browseFilter === 'recent' ? '🕐 Recent Templates' : '✨ My Custom Templates';
      const clearBtn = document.createElement('button');
      clearBtn.className = 'px-3 py-1.5 bg-white/5 hover:bg-white/10 text-secondary text-xs rounded-lg transition-colors';
      clearBtn.textContent = '← Show All';
      clearBtn.onclick = () => { browseFilter = 'all'; render(); };
      filterHeader.appendChild(filterTitle);
      filterHeader.appendChild(clearBtn);
      grid.appendChild(filterHeader);
    }

    if (filteredTemplates.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'text-center py-16';
      const icon = browseFilter === 'favorites' ? '❤️' : browseFilter === 'recent' ? '🕐' : browseFilter === 'custom' ? '✨' : '🎬';
      const title = browseFilter === 'favorites' ? 'No favorites yet' : browseFilter === 'recent' ? 'No recent templates' : 'No custom templates yet';
      const message = browseFilter === 'favorites' ? 'Click the heart on any template to save it here.' : browseFilter === 'recent' ? 'Start creating to see your history.' : 'No custom templates yet.';
      emptyEl.innerHTML = `
        <div class="text-6xl mb-4">${icon}</div>
        <h3 class="text-xl font-bold text-white mb-2">${title}</h3>
        <p class="text-secondary mb-6">${message}</p>
        ${browseFilter !== 'all' ? '<button class="px-6 py-3 bg-primary text-black font-bold rounded-xl hover:scale-105 transition-transform show-all-empty-btn">Browse All Templates</button>' : ''}
      `;
      grid.appendChild(emptyEl);
      if (browseFilter !== 'all') {
        grid.querySelector('.show-all-empty-btn').onclick = () => { browseFilter = 'all'; render(); };
      }
    } else {
      const gridInner = document.createElement('div');
      gridInner.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4';
      filteredTemplates.forEach((template) => {
        gridInner.appendChild(renderTemplateCard(template));
      });
      grid.appendChild(gridInner);
    }
    container.appendChild(grid);
  }

  function renderTemplateCard(template) {
    const card = document.createElement('div');
    card.className = 'group bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 cursor-pointer transition-colors';

    const thumbnailEl = document.createElement('div');
    thumbnailEl.className = 'w-full aspect-video rounded-lg bg-black/40 overflow-hidden flex items-center justify-center mb-3 relative';

    const img = document.createElement('img');
    img.alt = template.name;
    img.className = 'w-full h-full object-cover';
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

    const thumbBtn = document.createElement('button');
    thumbBtn.className = 'absolute bottom-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white text-xs flex items-center justify-center hover:bg-black/80 transition opacity-0 group-hover:opacity-100';
    thumbBtn.textContent = '🖼';
    thumbBtn.title = 'Set custom thumbnail';
    thumbBtn.onclick = (e) => {
      e.stopPropagation();
      const modal = new TemplateThumbnailModal({
        appTheme: 'cinema-template-studio',
        template,
        layout: 'panel',
        onApply: ({ imageUrl }) => {
          img.src = (imageUrl.startsWith('data:') ? imageUrl : imageUrl + '?v=' + Date.now());
          customThumbnailUrl = imageUrl;
          saveCustomThumbnailToCache(template.id, imageUrl);
        },
        onClear: () => {
          customThumbnailUrl = null;
          clearCustomThumbnailCache(template.id);
        },
      });
      mountThumbnailModal(modal);
      modal.open();
    };

    const actionsEl = document.createElement('div');
    actionsEl.className = 'flex items-center justify-between mb-2';
    actionsEl.appendChild(thumbBtn);

    const favBtn = document.createElement('button');
    favBtn.className = 'favorite-btn text-secondary hover:text-red-400';
    favBtn.title = 'Toggle favorite';
    favBtn.innerHTML = `<span>${TemplateStorage.isFavorite(template.id) ? '❤️' : '🤍'}</span>`;
    actionsEl.appendChild(favBtn);

    card.innerHTML = '';
    card.appendChild(actionsEl);

    const titleEl = document.createElement('h3');
    titleEl.className = 'text-sm font-bold text-white mb-1';
    titleEl.textContent = template.name;

    const descEl = document.createElement('p');
    descEl.className = 'text-xs text-secondary';
    descEl.textContent = template.description || '';

    card.appendChild(thumbnailEl);
    card.appendChild(titleEl);
    card.appendChild(descEl);

    card.onclick = (e) => {
      if (e.target.closest('.favorite-btn')) {
        if (TemplateStorage.isFavorite(template.id)) {
          TemplateStorage.removeFavorite(template.id);
        } else {
          TemplateStorage.addFavorite(template.id);
        }
        render();
        return;
      }
      if (e.target.closest('[title="Set custom thumbnail"]')) return;
      selectTemplate(template);
    };

    return card;
  }

  function selectTemplate(template) {
    currentTemplate = template;
    pickedMode = null;
    currentTiles = {};
    tileEdited = {};
    userEditedFields = new Set();
    currentMode = 'quick';
    currentInputs = new TemplateInputBuilder(template, currentMode).getDefaults();
    // Select appropriate default model based on modelType
    const candidates = template.modelType === 'i2i' ? i2iModels
      : template.modelType === 't2i' ? t2iModels
      : template.modelType === 't2v' ? t2vModels
      : template.modelType === 'v2v' ? v2vModels
      : i2vModels;

    // Prefer template.model if valid, otherwise use first candidate
    if (lastModelType !== template.modelType || !candidates.find(m => m.id === selectedModel)) {
      selectedModel = resolveModel(template, selectedModel, { i2i: i2iModels, t2i: t2iModels, i2v: i2vModels, t2v: t2vModels, v2v: v2vModels });
      lastModelType = template.modelType;
    }
    outputTabValues = {};
    activeTab = 'Enhanced Prompt';
    showAdvanced = false;
    lastBuiltPrompt = '';
    promptManuallyEdited = false;
    sceneBuilder = new SceneBuilder(template);
    customThumbnailUrl = getCustomThumbnailFromCache(template.id);
    incomingStoryboard = null;
    storyboardProjectId = null;
    try {
      const params = new URLSearchParams(window.location.hash.split('?')[1] || window.location.search);
      const storyboardParam = params.get('storyboard');
      const cinemaTemplateParam = params.get('template');
      if (storyboardParam) {
        incomingStoryboard = JSON.parse(storyboardParam);
        storyboardProjectId = incomingStoryboard.id || incomingStoryboard.projectId || null;
      }
      if (cinemaTemplateParam) {
        incomingCinemaTemplateId = cinemaTemplateParam;
      }
    } catch (e) {
      console.warn('[CinemaTemplateStudio] Failed to parse incoming params:', e);
    }
    view = 'create';
    render();
    if (incomingStoryboard?.frames?.length) {
      ingestStoryboardIntoBuilder(incomingStoryboard);
    }
  }

  // ================================
  // CREATE VIEW
  // ================================
  function renderCreateView() {
    // Fresh media-field registry for this render.
    mediaFields.image.length = 0;
    mediaFields.frame.length = 0;
    mediaFields.video.length = 0;
    if (!currentTemplate) return;

    retryCount = 0;

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between p-4 border-b border-white/10 bg-black/50';
    header.innerHTML = `
      <div class="flex items-center gap-4">
        <button id="back-btn" class="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-xl">
            ${escapeHtml(currentTemplate.icon)}
          </div>
          <div>
            <h1 class="text-xl font-black text-white">${escapeHtml(currentTemplate.name)}</h1>
            <p class="text-xs text-secondary">Create your ${currentTemplate.category.toLowerCase()} video</p>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div id="api-key-indicator" class="ml-auto flex items-center gap-2">
          <span class="api-key-dot w-2 h-2 rounded-full bg-zinc-600"></span>
          <span class="api-key-text text-[10px] uppercase tracking-wider text-zinc-500">No API key</span>
        </div>
        <div class="flex bg-white/5 rounded-lg p-1">
          <button id="quick-mode-btn" class="px-4 py-1.5 ${currentMode === 'quick' ? 'bg-primary text-black' : 'text-white/70'} text-xs font-bold rounded-md transition-colors">
            Quick Mode
          </button>
          <button id="advanced-mode-btn" class="px-4 py-1.5 ${currentMode === 'advanced' ? 'bg-primary text-black' : 'text-white/70'} text-xs font-bold rounded-md transition-colors">
            Advanced
          </button>
        </div>
        <button id="save-btn" class="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-secondary text-sm rounded-lg transition-colors flex items-center gap-2">
          <span>💾</span> Save
        </button>
      </div>
    `;
    container.appendChild(header);

    // Layout mirrors TemplateStudio's editor view: a scrolling content area
    // holding a centered 980px column — centered hero on top, then a
    // two-column grid (form card left, preview/output right) that stacks on
    // narrower screens.
    const content = document.createElement('div');
    content.className = 'flex-1 overflow-auto px-8 py-10';

    const centeredContainer = document.createElement('div');
    centeredContainer.className = 'mx-auto max-w-[980px]';
    content.appendChild(centeredContainer);

    // Left: Form inputs
    const formPanel = document.createElement('div');
    // Any change to the inputs makes Generate rebuild the prompt from them.
    ['input', 'change'].forEach((evt) => formPanel.addEventListener(evt, (e) => {
      promptManuallyEdited = false;
      const t = e.target;
      const name = t?.dataset?.advancedField || t?.name;
      if (name) userEditedFields.add(name);
    }));
    formPanel.className = 'min-w-0 rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.02))] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

    // Hero thumbnail section (matches TemplateStudio editor view)
    const heroSection = document.createElement('div');
    heroSection.className = 'flex flex-col items-center text-center';

    const thumbnailEl = document.createElement('div');
    thumbnailEl.className = 'mb-4 h-24 w-24 rounded-[28px] border border-emerald-400/20 shadow-[0_0_40px_rgba(16,185,129,0.10)] overflow-hidden flex items-center justify-center';

    const img = document.createElement('img');
    img.id = 'template-hero-thumb';
    img.alt = currentTemplate.name;
    img.className = 'w-full h-full object-cover';
    const candidates = getTemplateThumbnailCandidates(currentTemplate);
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
      thumbnailEl.textContent = currentTemplate.icon || '🎬';
    };
    thumbnailEl.appendChild(img);
    heroSection.appendChild(thumbnailEl);

    // Thumbnail action button — matches TemplateStudio styling
    const thumbAction = styleThumbnailButton(document.createElement('button'));
    thumbAction.onclick = () => {
      const modal = new TemplateThumbnailModal({
        appTheme: 'cinema-template-studio',
        template: currentTemplate,
        layout: 'panel',
        onApply: ({ imageUrl }) => {
          img.src = (imageUrl.startsWith('data:') ? imageUrl : imageUrl + '?v=' + Date.now());
          customThumbnailUrl = imageUrl;
          saveCustomThumbnailToCache(currentTemplate.id, imageUrl);
        },
        onClear: () => {
          customThumbnailUrl = null;
          clearCustomThumbnailCache(currentTemplate.id);
        },
      });
      mountThumbnailModal(modal);
      modal.open();
    };

    // Title
    const title = document.createElement('h1');
    title.className = 'text-5xl font-semibold tracking-tight';
    title.textContent = currentTemplate.name;
    heroSection.appendChild(title);

    // Description
    const desc = document.createElement('p');
    desc.className = 'mt-3 text-lg text-zinc-400';
    desc.textContent = currentTemplate.description || '';
    heroSection.appendChild(desc);

    // Pills
    const pills = document.createElement('div');
    pills.className = 'mt-5 flex flex-wrap gap-2 justify-center';
    pills.innerHTML = `
      <span class="inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/12 px-3 py-1 text-xs font-medium text-emerald-100">${currentTemplate.outputType === 'video' ? 'Video' : 'Image'}</span>
      <span class="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-white/75">${currentTemplate.category}</span>
      ${currentTemplate.coreUseCase ? `<span class="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-white/75">${currentTemplate.coreUseCase}</span>` : ''}
    `;
    heroSection.appendChild(pills);

    centeredContainer.appendChild(heroSection);

    // Two-column grid — same breakpoints/widths as TemplateStudio
    const grid = document.createElement('div');
    grid.className = 'mt-10 grid grid-cols-1 gap-8 xl:grid-cols-[520px_1fr] xl:items-start';
    centeredContainer.appendChild(grid);

    // Inner content wrapper (form fields, etc.)
    const innerWrapper = document.createElement('div');
    innerWrapper.innerHTML = `
      <div id="video-intent-section" class="mb-6">
        <!-- Video Intent form rendered here -->
      </div>

      <div class="mb-6">
        <h2 class="${CINEMATIC_THEME.text.sectionTitle} text-white mb-2">Basic Information</h2>
        <p class="text-sm text-secondary">Enter the key details for your video</p>
      </div>

      <div id="inputs-form" class="space-y-4">
        <!-- Inputs will be rendered here -->
      </div>

      ${currentTemplate.includeBrandContext ? `
        <div class="mt-8 pt-8 border-t border-white/10">
          <h2 class="${CINEMATIC_THEME.text.sectionTitle} text-white mb-2">Brand Context</h2>
          <p class="text-sm text-secondary">Add your brand details for consistent messaging</p>
          <div id="brand-form" class="space-y-4 mt-4">
            <!-- Brand inputs -->
          </div>
        </div>
      ` : ''}

      ${currentTemplate.outputType === 'video' ? `
        <div class="mt-8 pt-8 border-t border-white/10">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="${CINEMATIC_THEME.text.sectionTitle} text-white">Scene Timeline</h2>
              <p class="text-sm text-secondary">Auto-selected scenes for your video</p>
            </div>
            <button id="refresh-scenes-btn" class="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-secondary text-xs font-bold rounded-lg transition-colors">
              🔄 Refresh
            </button>
          </div>
          <div id="scene-timeline" class="space-y-3">
            <!-- Scene timeline will be rendered here -->
          </div>
        </div>
      ` : ''}

      ${currentTemplate.sceneBuilder ? `
        <div class="mt-8 pt-8 border-t border-white/10">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="${CINEMATIC_THEME.text.sectionTitle} text-white">Scene Builder</h2>
              <p class="text-sm text-secondary">Structure your video into scenes</p>
            </div>
            <div class="flex items-center gap-2">
              <button id="add-scene-btn" class="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-secondary text-xs font-bold rounded-lg transition-colors">
                + Add Scene
              </button>
              <button id="open-storyboard-btn" class="px-4 py-2 bg-primary text-black text-xs font-bold rounded-lg hover:scale-105 transition-transform">
                🎨 Storyboard
              </button>
            </div>
          </div>
          <div id="scenes-list" class="space-y-3">
            <!-- Scenes will be rendered here -->
          </div>
        </div>
      ` : ''}
    `;
    formPanel.appendChild(innerWrapper);
    grid.appendChild(formPanel);

    renderModelSelector(formPanel);
    renderVideoUploadButton(formPanel);

    renderAiEnhancer(formPanel);
    renderGtmBoost(formPanel);

    // Unified action row (matches Image Studio): Thumbnail · Advanced · Personalize.
    // Personalize is mounted into this row once the view is in the DOM.
    // The rebuilt Advanced pill and #advancedControls start collapsed, so
    // reset the flag to match (mode switches re-render this view).
    showAdvanced = false;
    const actionRow = createActionRow('mt-6');
    actionRow.id = 'personalize-trigger';
    const advancedToggleBtn = createAdvancedButton({ id: 'advancedToggle', tooltip: 'Show advanced controls' });
    arrangeActionRow(actionRow, { thumbnail: thumbAction, advanced: advancedToggleBtn });
    formPanel.appendChild(actionRow);

    renderGenerateButton(formPanel);

    renderCreativeIntelligence(formPanel);

    // Right: Output panel
    const outputPanel = document.createElement('div');
    outputPanel.id = 'output-panel';
    outputPanel.className = 'min-w-0 space-y-5';
    outputPanel.innerHTML = `
      <div class="relative">
          <h3 class="${CINEMATIC_THEME.text.eyebrow} text-white mb-4">Output</h3>

         <div class="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.018))] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
           <div class="mb-4 flex flex-wrap items-center gap-2">
             <span class="inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/12 px-3 py-1 text-xs font-medium text-emerald-100">${currentTemplate.outputType === 'video' ? 'Video' : 'Image'}</span>
             <span class="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-white/75">${currentTemplate.category}</span>
             <span class="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-white/75">${currentInputs.aspectRatio || currentTemplate.aspectRatio || '16:9'}</span>
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
         </div>

         </div>
       `;
    grid.appendChild(outputPanel);

    renderOutputTabs(outputPanel);
    outputPanel.appendChild(resultHistory.element);
    updateOutputContent();

    container.appendChild(content);

    renderFormInputs();
    renderVideoIntentForm();
    renderSceneTimeline();
    renderSceneBuilder();
    updatePreviewThumbnail();
    updateApiKeyIndicator();

    // Sync initial video intent into template inputs and listen for changes
    const initialIntent = getVideoIntent();
    syncVideoIntentToTemplate(initialIntent);
    subscribeVideoIntent(onVideoIntentChanged);

    // Debounced scene timeline refresh on input changes
    const formEl = container.querySelector('#inputs-form');
    if (formEl) {
      formEl.addEventListener('input', () => {
        if (sceneTimelineDebounce) clearTimeout(sceneTimelineDebounce);
        sceneTimelineDebounce = setTimeout(() => {
          if (currentTemplate.outputType === 'video') {
            const targetDuration = currentInputs.duration || currentTemplate.duration?.default || 90;
            try {
              selectedScenes = selectScenes(currentTemplate, currentInputs, targetDuration);
            } catch {
              selectedScenes = [];
            }
            syncScenesToBuilder();
            renderSceneTimeline();
            renderSceneBuilder();
          }
        }, 800);
      });
    }

    container.querySelector('#back-btn').onclick = () => {
      view = 'browse';
      render();
    };

    container.querySelector('#quick-mode-btn').onclick = () => {
      currentMode = 'quick';
      currentInputs = new TemplateInputBuilder(currentTemplate, currentMode).getDefaults();
      lastBuiltPrompt = '';
      promptManuallyEdited = false;
      render();
    };

    container.querySelector('#advanced-mode-btn').onclick = () => {
      currentMode = 'advanced';
      currentInputs = new TemplateInputBuilder(currentTemplate, currentMode).getDefaults();
      lastBuiltPrompt = '';
      promptManuallyEdited = false;
      render();
    };

    container.querySelector('#refresh-scenes-btn')?.addEventListener('click', () => {
      if (currentTemplate.outputType === 'video') {
        const targetDuration = currentInputs.duration || currentTemplate.duration?.default || 90;
        try {
          selectedScenes = selectScenes(currentTemplate, currentInputs, targetDuration);
        } catch {
          selectedScenes = [];
        }
        renderSceneTimeline();
        showToast('Scene timeline refreshed', 'success');
      }
    });

    container.querySelector('#save-btn').onclick = () => {
      TemplateStorage.saveProject({
        templateId: currentTemplate.id,
        templateName: currentTemplate.name,
        inputs: currentInputs,
        mode: currentMode
      });
      showToast('Project saved!', 'success');
    };

    container.querySelector('#generate-btn').onclick = () => {
      generateVideo();
    };

    // Personalize trigger wiring (element created in renderCreateView and appended to formPanel)
    const personalizeTriggerEl = container.querySelector('#personalize-trigger');
    if (personalizeTriggerEl && !personalizeTriggerEl.querySelector('#v-contact-btn')) {
      mountPersonalizeTrigger({ 
        controlsContainer: personalizeTriggerEl, 
        appId: 'cinema-template',
        getTextarea: () => container.querySelector('#outputTextarea') || null 
      });
    }

    if (currentTemplate.sceneBuilder) {
      if (container.querySelector('#open-storyboard-btn')) {
        container.querySelector('#open-storyboard-btn').onclick = () => {
          view = 'storyboard';
          render();

          // If a template ID was passed via the `template` query param, try to
          // select it in this studio. If it's not in the cinematic template
          // registry, fall back to TemplateStudio which can resolve all 512
          // showcase demos via the unified resolver.
          if (incomingCinemaTemplateId) {
            const cinematicTemplate = registry.get(incomingCinemaTemplateId);
            if (cinematicTemplate) {
              selectTemplate(cinematicTemplate);
            } else {
              // Not a cinematic template — redirect to TemplateStudio which
              // falls back to the unified showcase resolver.
              try {
                const resolved = resolveTemplate(incomingCinemaTemplateId);
                if (resolved) {
                  navigate('template/' + incomingCinemaTemplateId);
                }
              } catch { /* ignore */ }
            }
          }
        };
      }
      if (container.querySelector('#add-scene-btn')) {
        container.querySelector('#add-scene-btn').onclick = () => {
          try {
            if (!sceneBuilder) return;
            const scenes = sceneBuilder.getScenes();
            const nextNumber = scenes.length ? Math.max(...scenes.map(s => s.sceneNumber || 0)) + 1 : 1;
            sceneBuilder.addScene({
              sceneNumber: nextNumber,
              beat: `Scene ${nextNumber}`,
              duration: 5,
              shots: [{ type: 'MEDIUM', movement: 'STATIC', duration: 3, order: 1 }]
            });
            renderSceneBuilder();
            renderSceneTimeline();
          } catch (err) {
            console.error('[CinemaTemplateStudio] Failed to add scene:', err);
            showToast('Failed to add scene', 'error');
          }
        };
      }
    }

    if (incomingStoryboard) {
      const banner = document.createElement('div');
      banner.className = 'mx-6 mt-4 mb-2 px-4 py-3 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-between';
      banner.innerHTML = `
        <div class="flex items-center gap-3">
          <span class="text-lg">🎬</span>
          <div>
            <div class="text-xs font-bold text-white">Storyboard Loaded</div>
            <div class="text-[10px] text-secondary">${escapeHtml(incomingStoryboard.projectName || incomingStoryboard.id || 'Untitled')} — ${incomingStoryboard.frames?.length || 0} frames</div>
          </div>
        </div>
        <button id="clear-storyboard-btn" class="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-secondary text-xs font-bold rounded-lg transition-colors">Clear</button>
      `;
      formPanel.insertBefore(banner, formPanel.firstChild);

      banner.querySelector('#clear-storyboard-btn').onclick = () => {
        incomingStoryboard = null;
        storyboardProjectId = null;
        sceneBuilder.clear();
        renderSceneBuilder();
        renderSceneTimeline();
        render();
        showToast('Storyboard cleared', 'success');
      };
    }

    // Output tab switching, wand button, and textarea input handler
    // are all wired in renderOutputTabs — no duplicate wiring needed here.
  }

  function updatePreviewThumbnail() {
    const previewArea = container.querySelector('#previewArea');
    if (!previewArea) return;
    // Clean up any previously inserted image
    const existingImg = previewArea.querySelector('img#preview-thumb');
    const existingFallback = previewArea.querySelector('#preview-thumb-fallback');
    if (existingImg) existingImg.remove();
    if (existingFallback) existingFallback.remove();

    if (customThumbnailUrl) {
      const img = document.createElement('img');
      img.id = 'preview-thumb';
      img.src = customThumbnailUrl;
      img.alt = currentTemplate.name;
      img.className = 'w-full h-full object-cover';
      const fallback = document.createElement('div');
      fallback.id = 'preview-thumb-fallback';
      fallback.className = 'hidden';
      previewArea.appendChild(img);
      previewArea.appendChild(fallback);
    }
  }

  function updateApiKeyIndicator() {
    const indicator = container.querySelector('#api-key-indicator');
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

  function renderFormInputs() {
    const formBuilder = new TemplateInputBuilder(currentTemplate, currentMode);
    const schema = formBuilder.buildFormSchema();
    const formContainer = container.querySelector('#inputs-form');
    if (!formContainer) return;

    formContainer.innerHTML = '';

    // Identify the primary prompt field (mirrors TemplateStudio logic):
    // prefer name === 'prompt' among text/textarea inputs, fall back to the
    // first text/textarea input.
    const primaryPromptInput = schema.find(i => i && i.name === 'prompt' && (i.type === 'text' || i.type === 'textarea'))
      || schema.find(i => i && (i.type === 'text' || i.type === 'textarea'));
    const primaryPromptFieldName = primaryPromptInput ? primaryPromptInput.name : null;

    schema.forEach(input => {
      const field = createFormField(input, primaryPromptFieldName);
      formContainer.appendChild(field);
    });

    if (currentTemplate.includeBrandContext) {
      const brandContainer = container.querySelector('#brand-form');
      if (brandContainer) {
        brandContainer.innerHTML = '';

        const brandFields = [
          { name: 'brandName', type: 'text', label: 'Brand Name', placeholder: 'Your brand name' },
          { name: 'brandVoice', type: 'select', label: 'Brand Voice', options: Object.values(BRAND_VOICES).map(v => v.id) },
          { name: 'targetAudience', type: 'select', label: 'Target Audience', options: Object.values(TARGET_AUDIENCES).map(a => a.id) }
        ];

        brandFields.forEach(input => {
          const field = createFormField(input, null);
          brandContainer.appendChild(field);
        });
      }
    }

    // Prompt attachment toolbar (Video Studio) on the template's main text field.
    const mainPromptField = (primaryPromptFieldName && formContainer.querySelector(`[name="${primaryPromptFieldName}"]`))
      || formContainer.querySelector('textarea, input[type="text"]');
    if (videoTools && mainPromptField && !mainPromptField.parentElement?.querySelector('.studio-attachment-toolbar')) {
      videoTools.attachToPrompt(mainPromptField);
    }
  }

  function renderVideoIntentForm() {
    const section = container.querySelector('#video-intent-section');
    if (!section) return;

    const intent = getVideoIntent();

    section.innerHTML = `
      <div class="bg-white/5 border border-white/10 rounded-xl p-5">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-lg font-bold text-white">Video Intent</h2>
            <p class="text-xs text-secondary">Describe the video you want to create</p>
          </div>
          <button id="open-storyboard-btn-2" class="px-4 py-2 bg-primary text-black text-xs font-bold rounded-lg hover:scale-105 transition-transform">
            🎨 Storyboard
          </button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-white uppercase mb-1.5">Video Type</label>
            <select id="vi-videoType" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
              ${['commercial','brand film','trailer','social reel','testimonial','documentary','short film','explainer'].map(v => `<option value="${v}" ${intent.videoType === v ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-white uppercase mb-1.5">Duration (seconds)</label>
            <input id="vi-duration" type="number" min="5" max="300" value="${intent.duration}" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label class="block text-xs font-bold text-white uppercase mb-1.5">Aspect Ratio</label>
            <select id="vi-aspectRatio" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
              ${['16:9','9:16','1:1','4:5'].map(v => `<option value="${v}" ${intent.aspectRatio === v ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-white uppercase mb-1.5">Tone</label>
            <select id="vi-tone" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
              ${['dramatic','cinematic','upbeat','luxury','gritty','minimal','emotional','humorous'].map(v => `<option value="${v}" ${intent.tone === v ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-white uppercase mb-1.5">Style Preset</label>
            <select id="vi-stylePreset" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
              ${['None','Photorealistic','Cinematic','Noir','Anime','Watercolor','Oil Painting','Cyberpunk','Fantasy','Documentary'].map(v => `<option value="${v}" ${intent.stylePreset === v ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-white uppercase mb-1.5">Lighting Preset</label>
            <select id="vi-lightingPreset" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
              ${['None','Golden Hour','Neon','Studio','Dramatic','Soft','Volumetric','High Key','Low Key'].map(v => `<option value="${v}" ${intent.lightingPreset === v ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-white uppercase mb-1.5">Color Grade</label>
            <select id="vi-colorGrade" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
              ${['None','Warm','Cool','Desaturated','Vibrant','Monochrome','Sepia','Teal & Orange'].map(v => `<option value="${v}" ${intent.colorGrade === v ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-white uppercase mb-1.5">Target Audience</label>
            <input id="vi-targetAudience" type="text" value="${escapeHtml(intent.targetAudience || '')}" placeholder="e.g. Gen Z, professionals" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label class="block text-xs font-bold text-white uppercase mb-1.5">Call to Action (optional)</label>
            <input id="vi-cta" type="text" value="${escapeHtml(intent.cta || '')}" placeholder="e.g. Buy now, Sign up" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
          <div class="md:col-span-2">
            <label class="block text-xs font-bold text-white uppercase mb-1.5">Subject</label>
            <input id="vi-subject" type="text" value="${escapeHtml(intent.subject || '')}" placeholder="What is the video about?" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
          <div class="md:col-span-2">
            <label class="block text-xs font-bold text-white uppercase mb-1.5">Premise</label>
            <textarea id="vi-premise" rows="2" placeholder="Core narrative or value prop..." class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-none">${escapeHtml(intent.premise || '')}</textarea>
          </div>
        </div>
        <div class="mt-4 flex items-center justify-between">
          <button id="vi-reset-btn" class="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-secondary text-xs font-bold rounded-lg transition-colors">Reset</button>
          <span class="text-[10px] text-secondary">Video intent is saved automatically</span>
        </div>
      </div>
    `;

    const debounce = (fn, ms) => {
      let t;
      return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
      };
    };

    const syncIntentNow = () => {
      flushVideoIntentSync = null;
      setVideoIntent({
        videoType: section.querySelector('#vi-videoType')?.value || intent.videoType,
        duration: parseInt(section.querySelector('#vi-duration')?.value || intent.duration, 10),
        aspectRatio: section.querySelector('#vi-aspectRatio')?.value || intent.aspectRatio,
        tone: section.querySelector('#vi-tone')?.value || intent.tone,
        stylePreset: section.querySelector('#vi-stylePreset')?.value || intent.stylePreset,
        lightingPreset: section.querySelector('#vi-lightingPreset')?.value || intent.lightingPreset,
        colorGrade: section.querySelector('#vi-colorGrade')?.value || intent.colorGrade,
        targetAudience: section.querySelector('#vi-targetAudience')?.value || intent.targetAudience,
        cta: section.querySelector('#vi-cta')?.value || intent.cta,
        subject: section.querySelector('#vi-subject')?.value || intent.subject,
        premise: section.querySelector('#vi-premise')?.value || intent.premise,
      });
    };
    const syncIntentDebounced = debounce(syncIntentNow, 300);
    // Generate flushes a pending sync so the last keystrokes are not lost.
    const syncIntent = () => { flushVideoIntentSync = syncIntentNow; syncIntentDebounced(); };

    section.querySelectorAll('input, select, textarea').forEach(el => {
      el.addEventListener('input', syncIntent);
      el.addEventListener('change', syncIntent);
    });

    section.querySelector('#vi-reset-btn')?.addEventListener('click', () => {
      resetVideoIntent();
      renderVideoIntentForm();
      showToast('Video intent reset', 'success');
    });

    section.querySelector('#open-storyboard-btn-2')?.addEventListener('click', () => {
      view = 'storyboard';
      render();
    });
  }

  function syncVideoIntentToTemplate(intent) {
    if (!currentTemplate || !intent) return;
    const mapping = {
      subject: 'subject',
      tone: 'tone',
      targetAudience: 'targetAudience',
      duration: 'duration',
      aspectRatio: 'aspectRatio',
      stylePreset: 'visualStyle',
      lightingPreset: 'lighting',
      colorGrade: 'colorPalette',
      cta: 'cta',
    };
    // Never overwrite a value the user typed or picked in the form (template
    // fields or Advanced Controls); values only copied from an earlier intent
    // keep following the intent. Intent values reach the prompt at Generate.
    const typedOwn = (key) => userEditedFields.has(key) && currentInputs[key] != null && currentInputs[key] !== '';
    Object.entries(mapping).forEach(([intentKey, inputKey]) => {
      // The intent style goes to Visual Style only when that select offers it
      // (otherwise it is added to the prompt as "Style preset").
      if (intentKey === 'stylePreset' && !VISUAL_STYLE_OPTIONS.includes(String(intent[intentKey]).toLowerCase())) return;
      if (intent[intentKey] !== undefined && intent[intentKey] !== null && intent[intentKey] !== '' && !typedOwn(inputKey)) {
        currentInputs[inputKey] = intent[intentKey];
      }
    });
    if (intent.premise && !typedOwn('premise')) {
      currentInputs.premise = intent.premise;
    }
  }

  function onVideoIntentChanged(intent) {
    syncVideoIntentToTemplate(intent);
    // Keep the Ratio control showing what will be sent (until the user picks one there).
    videoTools?.syncAspectRatio?.(resolveGenerationAspectRatio(currentInputs, currentTemplate));
    renderSceneTimeline();
    renderSceneBuilder();
    updateOutputContent();
  }

  function renderSceneTimeline() {
    const timeline = container.querySelector('#scene-timeline');
    if (!timeline) return;

    if (!selectedScenes.length) {
      timeline.innerHTML = `
        <div class="text-center py-8 text-secondary">
          <div class="text-2xl mb-2">🎬</div>
          <p class="text-sm">Scenes will be auto-selected when you generate</p>
        </div>
      `;
      return;
    }

    timeline.innerHTML = selectedScenes.map((scene, idx) => {
      const duration = scene.timing?.duration_seconds || scene.duration || 5;
      const shots = scene.shots?.length || 1;
      const shotInfo = scene.shots?.map(s => s.type || 'medium shot').join(', ') || 'medium shot';
      const name = scene.purpose?.description || scene.name || `Scene ${idx + 1}`;
      const primaryEmotion = scene.emotion?.primary || scene.emotionalTone?.[0] || 'neutral';
      const emotionalTones = scene.emotion ? [scene.emotion.primary, scene.emotion.secondary].filter(Boolean) : (scene.emotionalTone || []);

      return `
        <div class="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors">
          <div class="flex items-start gap-3">
            <div class="flex-shrink-0 w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center text-primary font-bold text-sm">
              ${idx + 1}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <h4 class="text-sm font-bold text-white truncate">${escapeHtml(name)}</h4>
                ${scene.purpose?.story_function ? `<span class="px-2 py-0.5 bg-white/5 rounded text-[10px] text-secondary">${escapeHtml(scene.purpose.story_function)}</span>` : ''}
              </div>
              <div class="flex items-center gap-3 text-[10px] text-secondary mb-2">
                <span>⏱ ${duration}s</span>
                <span>📷 ${shots} shot${shots !== 1 ? 's' : ''}</span>
                <span class="truncate">${escapeHtml(shotInfo)}</span>
              </div>
              ${emotionalTones.length ? `
                <div class="flex gap-1 flex-wrap">
                  ${emotionalTones.map(tone => `<span class="px-2 py-0.5 bg-white/5 rounded text-[10px] text-white/60">${escapeHtml(tone)}</span>`).join('')}
                </div>
              ` : ''}
              ${scene.flowName ? `<div class="text-[10px] text-secondary mt-1">Flow: ${escapeHtml(scene.flowName)}</div>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    const totalDuration = selectedScenes.reduce((sum, s) => sum + (s.timing?.duration_seconds || s.duration || 5), 0);
    const totalShots = selectedScenes.reduce((sum, s) => sum + (s.shots?.length || 1), 0);

    const summary = document.createElement('div');
    summary.className = 'mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-secondary';
    summary.innerHTML = `
      <span>${selectedScenes.length} scenes</span>
      <span>${totalDuration}s total</span>
      <span>${totalShots} shots</span>
    `;
    timeline.appendChild(summary);
  }

  function syncScenesToBuilder() {
    if (!sceneBuilder || !selectedScenes.length) return;
    // Only sync if sceneBuilder is empty; preserve manual edits once user has touched scenes.
    if (sceneBuilder.getScenes().length === 0) {
      sceneBuilder.clear();
      selectedScenes.forEach((s, idx) => {
        sceneBuilder.addScene({
          sceneNumber: s.scene_number || idx + 1,
          beat: s.purpose?.description || s.name || `Scene ${idx + 1}`,
          duration: s.timing?.duration_seconds || s.duration || 5,
          shots: s.shots || [],
          // Preserve rich metadata for prompt generation
          ...s
        });
      });
    }
  }

  function ingestStoryboardIntoBuilder(storyboard) {
    if (!sceneBuilder || !storyboard?.frames?.length) return;
    sceneBuilder.clear();
    storyboard.frames.forEach((frame, idx) => {
      sceneBuilder.addScene({
        sceneNumber: frame.sceneNumber || idx + 1,
        beat: frame.description || frame.prompt || `Scene ${idx + 1}`,
        duration: frame.duration || 5,
        shots: frame.shotType ? [{
          type: frame.shotType,
          movement: frame.cameraMovement || 'Static',
          duration: frame.duration || 3,
          order: 1
        }] : [],
        // Preserve full storyboard frame metadata
        storyboardFrame: frame,
        flowName: frame.sceneNumber ? `Storyboard Frame ${frame.sceneNumber}` : `Frame ${idx + 1}`,
      });
    });
    selectedScenes = [];
    renderSceneBuilder();
    renderSceneTimeline();
  }

  function renderSceneBuilder() {
    const list = container.querySelector('#scenes-list');
    if (!list || !sceneBuilder) return;

    const scenes = sceneBuilder.getScenes();
    if (!scenes.length) {
      list.innerHTML = `
        <div class="text-center py-6 text-secondary">
          <p class="text-sm">No scenes yet. Add a scene or generate from the timeline.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = scenes.map((scene, idx) => {
      const shots = scene.shots || [];
      const shotCount = shots.length || 1;
      const duration = scene.duration || 5;
      const storyboardFrame = scene.storyboardFrame;

      return `
        <div class="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors">
          <div class="flex items-start gap-3">
            <div class="flex-shrink-0 w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center text-primary font-bold text-sm">
              ${scene.sceneNumber || idx + 1}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <h4 class="text-sm font-bold text-white truncate">${escapeHtml(scene.beat || `Scene ${scene.sceneNumber || idx + 1}`)}</h4>
                ${storyboardFrame ? `<span class="px-2 py-0.5 bg-primary/20 text-primary text-[10px] font-bold rounded">From storyboard</span>` : ''}
              </div>
              <div class="flex items-center gap-3 text-[10px] text-secondary mb-2">
                <span>⏱ ${duration}s</span>
                <span>📷 ${shotCount} shot${shotCount !== 1 ? 's' : ''}</span>
              </div>
              ${shots.length ? `
                <div class="flex gap-1 flex-wrap">
                  ${shots.slice(0, 4).map(shot => `<span class="px-2 py-0.5 bg-white/5 rounded text-[10px] text-white/60">${escapeHtml(shot.type || 'shot')}</span>`).join('')}
                  ${shots.length > 4 ? `<span class="px-2 py-0.5 bg-white/5 rounded text-[10px] text-white/60">+${shots.length - 4} more</span>` : ''}
                </div>
              ` : ''}
              ${storyboardFrame ? `
                <div class="flex gap-1 flex-wrap mt-2">
                  ${storyboardFrame.cameraMovement ? `<span class="px-2 py-0.5 bg-white/5 rounded text-[10px] text-white/60">🎥 ${escapeHtml(storyboardFrame.cameraMovement)}</span>` : ''}
                  ${storyboardFrame.visualStyle ? `<span class="px-2 py-0.5 bg-white/5 rounded text-[10px] text-white/60">🎨 ${escapeHtml(storyboardFrame.visualStyle)}</span>` : ''}
                  ${storyboardFrame.lighting ? `<span class="px-2 py-0.5 bg-white/5 rounded text-[10px] text-white/60">💡 ${escapeHtml(storyboardFrame.lighting)}</span>` : ''}
                  ${storyboardFrame.colorPalette ? `<span class="px-2 py-0.5 bg-white/5 rounded text-[10px] text-white/60">🎨 ${escapeHtml(storyboardFrame.colorPalette)}</span>` : ''}
                </div>
              ` : ''}
            </div>
            <div class="flex items-center gap-1 flex-shrink-0">
              <button class="move-scene-btn p-1 text-white/30 hover:text-white/70 transition-colors" data-dir="up" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''} title="Move up">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg>
              </button>
              <button class="move-scene-btn p-1 text-white/30 hover:text-white/70 transition-colors" data-dir="down" data-idx="${idx}" ${idx === scenes.length - 1 ? 'disabled' : ''} title="Move down">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-9"/></svg>
              </button>
              <button class="edit-scene-btn p-1 text-white/30 hover:text-primary transition-colors" data-id="${scene.id}" title="Edit scene">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="delete-scene-btn p-1 text-white/30 hover:text-red-400 transition-colors" data-id="${scene.id}" title="Delete scene">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Wire up buttons
    list.querySelectorAll('.edit-scene-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const scene = sceneBuilder.getScenes().find(s => s.id === btn.dataset.id);
        if (scene) openSceneEditor(scene);
      });
    });

    list.querySelectorAll('.delete-scene-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        try {
          sceneBuilder.removeScene(btn.dataset.id);
          renderSceneBuilder();
          renderSceneTimeline();
        } catch (err) {
          console.error('[CinemaTemplateStudio] Failed to remove scene:', err);
          showToast('Failed to remove scene', 'error');
        }
      });
    });

    list.querySelectorAll('.move-scene-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        try {
          const idx = parseInt(btn.dataset.idx, 10);
          const dir = btn.dataset.dir;
          const scenes = sceneBuilder.getScenes();
          const newIdx = dir === 'up' ? idx - 1 : idx + 1;
          if (newIdx < 0 || newIdx >= scenes.length) return;
          sceneBuilder.moveScene(scenes[idx].id, newIdx);
          renderSceneBuilder();
          renderSceneTimeline();
        } catch (err) {
          console.error('[CinemaTemplateStudio] Failed to move scene:', err);
          showToast('Failed to move scene', 'error');
        }
      });
    });
  }

  function openSceneEditor(scene) {
    if (!sceneBuilder) return;

    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4';

    const modal = document.createElement('div');
    modal.className = 'w-full max-w-lg bg-white/[0.04] border border-white/10 rounded-2xl p-6';

    const shots = scene.shots || [];
    const defaultShotType = Object.keys(SHOT_TYPES)[0];
    const defaultMovement = Object.keys(CAMERA_MOVEMENTS)[0];

    modal.innerHTML = `
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-lg font-bold text-white">Edit Scene ${scene.sceneNumber || ''}</h3>
        <button id="close-scene-modal-btn" class="text-white/50 hover:text-white transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-white uppercase mb-1.5">Scene Number</label>
            <input id="edit-scene-number" type="number" min="1" value="${scene.sceneNumber || ''}" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label class="block text-xs font-bold text-white uppercase mb-1.5">Duration (s)</label>
            <input id="edit-scene-duration" type="number" min="1" value="${scene.duration || 5}" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
        </div>
        <div>
          <label class="block text-xs font-bold text-white uppercase mb-1.5">Beat / Description</label>
          <textarea id="edit-scene-beat" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-none" rows="2">${escapeHtml(scene.beat || '')}</textarea>
        </div>
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="block text-xs font-bold text-white uppercase mb-0">Shots</label>
            <button id="add-shot-btn" class="px-2 py-1 bg-white/5 hover:bg-white/10 text-secondary text-[10px] font-bold rounded transition-colors">+ Add Shot</button>
          </div>
          <div id="shots-list" class="space-y-2">
            ${shots.map((shot, shotIdx) => `
              <div class="grid grid-cols-12 gap-2 items-center shot-row" data-idx="${shotIdx}">
                <div class="col-span-4">
                  <select class="shot-type w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs">
                    ${Object.entries(SHOT_TYPES).map(([key, val]) => `<option value="${key}" ${shot.type === key ? 'selected' : ''}>${val.name}</option>`).join('')}
                  </select>
                </div>
                <div class="col-span-3">
                  <select class="shot-movement w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs">
                    ${Object.entries(CAMERA_MOVEMENTS).map(([key, val]) => `<option value="${key}" ${shot.movement === key ? 'selected' : ''}>${val.name}</option>`).join('')}
                  </select>
                </div>
                <div class="col-span-3">
                  <input type="number" min="1" value="${shot.duration || 3}" class="shot-duration w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs" />
                </div>
                <div class="col-span-2 flex justify-end">
                  <button class="remove-shot-btn text-white/30 hover:text-red-400 transition-colors" data-idx="${shotIdx}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="mt-6 flex gap-3">
        <button id="save-scene-btn" class="flex-1 py-2.5 bg-primary text-black font-bold text-sm rounded-xl hover:scale-[1.02] transition-transform">
          Save Changes
        </button>
        <button id="cancel-scene-btn" class="px-6 py-2.5 bg-white/5 text-white font-bold text-sm rounded-xl hover:bg-white/10 transition-colors">
          Cancel
        </button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.remove();
    };

    modal.querySelector('#close-scene-modal-btn').onclick = () => overlay.remove();
    modal.querySelector('#cancel-scene-btn').onclick = () => overlay.remove();

    modal.querySelector('#add-shot-btn').addEventListener('click', () => {
      const shotsList = modal.querySelector('#shots-list');
      const idx = shotsList.children.length;
      const row = document.createElement('div');
      row.className = 'grid grid-cols-12 gap-2 items-center shot-row';
      row.dataset.idx = idx;
      row.innerHTML = `
        <div class="col-span-4">
          <select class="shot-type w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs">
            ${Object.entries(SHOT_TYPES).map(([key, val]) => `<option value="${key}">${val.name}</option>`).join('')}
          </select>
        </div>
        <div class="col-span-3">
          <select class="shot-movement w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs">
            ${Object.entries(CAMERA_MOVEMENTS).map(([key, val]) => `<option value="${key}">${val.name}</option>`).join('')}
          </select>
        </div>
        <div class="col-span-3">
          <input type="number" min="1" value="3" class="shot-duration w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs" />
        </div>
        <div class="col-span-2 flex justify-end">
          <button class="remove-shot-btn text-white/30 hover:text-red-400 transition-colors" data-idx="${idx}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      `;
      shotsList.appendChild(row);
    });

    modal.querySelector('#save-scene-btn').addEventListener('click', () => {
      const sceneNumber = parseInt(modal.querySelector('#edit-scene-number').value, 10) || scene.sceneNumber || 1;
      const duration = parseInt(modal.querySelector('#edit-scene-duration').value, 10) || scene.duration || 5;
      const beat = modal.querySelector('#edit-scene-beat').value.trim();

      const newShots = [];
      modal.querySelectorAll('.shot-row').forEach(row => {
        newShots.push({
          type: row.querySelector('.shot-type').value,
          movement: row.querySelector('.shot-movement').value,
          duration: parseInt(row.querySelector('.shot-duration').value, 10) || 3,
          order: newShots.length + 1
        });
      });

      sceneBuilder.updateScene(scene.id, {
        sceneNumber,
        beat: beat || scene.beat,
        duration,
        shots: newShots
      });

      overlay.remove();
      renderSceneBuilder();
      renderSceneTimeline();
      showToast('Scene updated!', 'success');
    });

    // Wire remove shot buttons
    modal.querySelectorAll('.remove-shot-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('.shot-row');
        if (row) row.remove();
      });
    });
  }

  function createFormField(input, primaryPromptFieldName) {
    const field = document.createElement('div');
    field.className = 'mt-6 first:mt-0';

    const isPrimaryPromptField = primaryPromptFieldName && input.name === primaryPromptFieldName;

    const label = document.createElement('div');
    label.className = 'mb-3 flex items-center justify-between gap-3';
    const showTextButtons = input.type === 'text' || input.type === 'textarea';
    label.innerHTML = `
      <div class="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">${input.label}${input.required ? ' <span class="text-primary">*</span>' : ''}</div>
      ${showTextButtons ? `
        <div class="flex items-center gap-2">
          <button class="enhancer-btn rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] transition border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-white" data-field="${input.name}">Enhance</button>
           ${isPrimaryPromptField ? '<div class="overflow-menu shrink-0" data-gtm-menu="primary"><button type="button" class="overflow-menu__trigger" data-tooltip="More tools" aria-label="More enhancement tools"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg></button><div class="overflow-menu__panel"><button type="button" class="overflow-menu__item" data-enhance="gtm">🎯 GTM Boost</button><button type="button" class="overflow-menu__item" data-enhance="recipe">📋 Recipes</button><button type="button" class="overflow-menu__item" data-enhance="monetize">💼 Monetize</button><button type="button" class="overflow-menu__item" data-enhance="prompts">📚 Prompts</button></div></div>' : ''}
        </div>
      ` : ''}
    `;
    field.appendChild(label);

    switch (input.type) {
      case 'text':
      case 'number': {
        const textInput = document.createElement('input');
        textInput.type = input.type;
        textInput.name = input.name;
        textInput.className = 'h-11 w-full rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-4 text-sm text-white outline-none transition focus:border-emerald-400/50';
        textInput.placeholder = input.placeholder || '';
        textInput.value = currentInputs[input.name] || '';
        textInput.min = input.min;
        textInput.max = input.max;
        textInput.oninput = () => {
          currentInputs[input.name] = textInput.value;
        };
        field.appendChild(textInput);
        break;
      }

      case 'textarea': {
        const textarea = document.createElement('textarea');
        textarea.name = input.name;
        textarea.className = 'w-full rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400/50 resize-none';
        textarea.placeholder = input.placeholder || '';
        textarea.rows = 3;
        textarea.value = currentInputs[input.name] || '';
        textarea.oninput = () => {
          currentInputs[input.name] = textarea.value;
        };
        field.appendChild(textarea);
        break;
      }

      case 'select': {
        const select = document.createElement('select');
        select.name = input.name;
        select.className = 'h-11 w-full rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-4 text-sm text-white outline-none transition focus:border-emerald-400/50 appearance-none cursor-pointer';

        if (input.options && input.options.length > 0) {
          input.options.forEach(opt => {
            const option = document.createElement('option');
            option.value = typeof opt === 'string' ? opt : opt.id || opt;
            option.textContent = typeof opt === 'string' ? opt : opt.name || opt;
            if (currentInputs[input.name] === option.value) {
              option.selected = true;
            }
            select.appendChild(option);
          });
        }

        select.onchange = () => {
          currentInputs[input.name] = select.value;
        };
        field.appendChild(select);
        break;
      }

      case 'image':
      case 'frame':
      case 'video': {
        // Same upload picker + stock browser as the Video Studio.
        const mediaField = createTemplateMediaField({
          kind: input.type,
          required: input.type !== 'video' && (!!input.required || currentTemplate.modelType === 'i2v' || currentTemplate.modelType === 'i2i'),
          anchorContainer: container,
          studioName: 'Cinema Template Studio',
          initialValue: currentInputs[input.name] || null,
          onChange: (value) => {
            currentInputs[input.name] = value;
            clearStaleRetry();
            refreshMediaRoute();
          },
        });
        field.appendChild(mediaField.element);
        mediaFields[input.type]?.push(mediaField);
        break;
      }

      case 'checkbox': {
        const checkbox = document.createElement('label');
        checkbox.className = 'flex items-center gap-3 cursor-pointer';

        const checkInput = document.createElement('input');
        checkInput.type = 'checkbox';
        checkInput.checked = currentInputs[input.name] || false;
        checkInput.className = 'w-5 h-5 rounded bg-white/5 border border-white/10 text-primary focus:ring-primary';
        checkInput.onchange = () => {
          currentInputs[input.name] = checkInput.checked;
        };

        const checkSpan = document.createElement('span');
        checkSpan.className = 'text-sm text-white';
        checkSpan.textContent = input.checkboxLabel || '';

        checkbox.appendChild(checkInput);
        checkbox.appendChild(checkSpan);
        field.appendChild(checkbox);
        break;
      }
    }

    // Wire up Enhance and GTM Boost buttons created in the label HTML
    setTimeout(() => {
      const enhanceBtn = label.querySelector('button[data-field]');
        if (enhanceBtn) {
         enhanceBtn.onclick = () => {
           const el = field.querySelector('textarea, input');
           if (el && el.value) {
             const enhancedValue = `${el.value}, cinematic style, professional quality, premium aesthetic`;
             el.value = enhancedValue;
             el.dispatchEvent(new Event('input', { bubbles: true }));
             el.dispatchEvent(new Event('change', { bubbles: true }));
             currentInputs[input.name] = enhancedValue;
            enhanceBtn.textContent = 'Enhanced ✓';
            enhanceBtn.classList.add('border-emerald-400/40', 'bg-emerald-500/15', 'text-emerald-200');
            setTimeout(() => {
              enhanceBtn.textContent = 'Enhance';
              enhanceBtn.classList.remove('border-emerald-400/40', 'bg-emerald-500/15', 'text-emerald-200');
            }, 2000);
          }
        };
      }

      const enhanceMenu = label.querySelector('.overflow-menu');
      if (enhanceMenu) {
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
          item.addEventListener('click', () => {
            const action = item.dataset.enhance;
            if (action === 'gtm') {
              const promptEl = field.querySelector('textarea, input');
              const basePrompt = (promptEl && promptEl.value) || currentTemplate.description || '';
              const templateContext = {
                basePrompt,
                templateId: currentTemplate.id,
                category: currentTemplate.category,
                niche: currentTemplate.niche,
                outputType: currentTemplate.outputType,
              };
              const onPromptGenerated = (prompt) => {
                const ta = field.querySelector('textarea, input');
                if (ta) {
                  ta.value = prompt;
                  ta.dispatchEvent(new Event('input', { bubbles: true }));
                  ta.dispatchEvent(new Event('change', { bubbles: true }));
                  ta.focus();
                }
              };
              import('../lib/uiIntegration.js').then(async ({ fetchGTMTemplateContext, openGTMPromptModal }) => {
                const ctx = await Promise.resolve(fetchGTMTemplateContext?.(currentTemplate)).catch(() => null) || {};
                if (ctx?.basePrompt) {
                  templateContext.basePrompt = ctx.basePrompt;
                }
                openGTMPromptModal('cinema-template-studio', { onPromptGenerated, templateContext });
              }).catch((err) => console.error('[CinemaTemplateStudio] GTM Boost failed:', err));
            } else if (action === 'recipe') {
              openRecipeModal().catch((err) => console.error('[Recipe] open failed:', err));
            } else if (action === 'monetize') {
              openMonetizationHub().catch((err) => console.error('[Monetization] open failed:', err));
            } else if (action === 'prompts') {
              openPromptGallery({
                appTheme: 'cinema-template-studio',
                onSelect: (prompt) => {
                  const ta = field.querySelector('textarea, input');
                  if (ta) {
                    ta.value = prompt;
                    ta.dispatchEvent(new Event('input', { bubbles: true }));
                    ta.focus();
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
        window.addEventListener('click', closeEnhanceMenu);
      }
    }, 0);

    return field;
  }

  // ================================
  // MODEL SELECTOR
  // ================================
  function renderModelSelector(formPanel) {
    const outputType = currentTemplate.outputType || (currentTemplate.modelType === 't2i' || currentTemplate.modelType === 'i2i' ? 'image' : 'video');

    if (outputType !== 'video' && currentTemplate.modelType !== 'i2i' && currentTemplate.modelType !== 't2i') return;

    const modelWrapper = document.createElement('div');
    modelWrapper.className = 'mt-6';

     let fallbackList = [];
     if (currentTemplate.modelType === 'i2i') fallbackList = i2iModels;
     else if (currentTemplate.modelType === 't2i') fallbackList = t2iModels;
     else if (currentTemplate.modelType === 't2v') fallbackList = t2vModels;
     else if (currentTemplate.modelType === 'v2v') fallbackList = v2vModels;
     else fallbackList = i2vModels;
    // The picker lists models for the current route (Text / Image / Video →
    // Video), starting from the template's own type.
    let pickerRoute = ['i2i', 't2i', 't2v', 'v2v'].includes(currentTemplate.modelType) ? currentTemplate.modelType : 'i2v';
    const routeModelPicks = {};

    let loadedModels = fallbackList;
    const getModelName = (id) => {
      const m = loadedModels.find(x => x.id === id) || fallbackList.find(x => x.id === id) || findTemplateModel(id);
      return m ? m.name : id;
    };
    const getModel = (id) => loadedModels.find(x => x.id === id) || fallbackList.find(x => x.id === id) || findTemplateModel(id);

    const triggerBtn = document.createElement('button');
    triggerBtn.type = 'button';
    triggerBtn.className = 'w-full flex items-center gap-3 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition';
    const updateTrigger = () => {
      const model = getModel(selectedModel);
      const provider = model?.provider || 'muapi';
      const logoUrl = PROVIDER_LOGOS[provider];
      const name = model ? model.name : getModelName(selectedModel);
      if (logoUrl) {
        triggerBtn.innerHTML = `<div class="w-5 h-5 rounded-md flex items-center justify-center overflow-hidden bg-white/5 shrink-0">${renderProviderLogoImg(provider, '', 'w-full h-full object-contain', invertLogos.includes(provider) ? 'invert' : '')}</div><span class="text-sm font-bold text-white truncate">${name}</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-muted shrink-0 ml-auto"><polyline points="6 9 12 15 18 9"/></svg>`;
      } else {
        const style = getProviderStyle(provider);
        triggerBtn.innerHTML = `<div class="w-5 h-5 bg-primary rounded-md flex items-center justify-center shadow-lg shadow-primary/20 shrink-0"><span class="text-[10px] font-black text-black">${style.text}</span></div><span class="text-sm font-bold text-white truncate">${name}</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-muted shrink-0 ml-auto"><polyline points="6 9 12 15 18 9"/></svg>`;
      }
    };
    updateTrigger();

    const dropdown = document.createElement('div');
    dropdown.className = 'fixed z-[100] bg-gray-900 border border-white/10 rounded-2xl shadow-3xl p-2 opacity-0 pointer-events-none transition-all duration-200 scale-95 origin-bottom-left';
    dropdown.style.width = 'calc(100vw - 2rem)';
    dropdown.style.maxWidth = '480px';
    dropdown.style.maxHeight = '70vh';
    dropdown.style.minHeight = '350px';

    const closeDropdown = () => {
      dropdown.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
      dropdown.classList.remove('opacity-100', 'pointer-events-auto', 'scale-100');
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
              explicitModelPick = model.id;
              routeModelPicks[pickerRoute] = model.id;
              updateTrigger();
              if (videoSettings) videoSettings.refresh();
              if (videoTools) videoTools.refresh();
              closeDropdown();
            },
          });
        };

        // Show a loading state immediately, then populate once the catalog resolves.
        renderModelPanel([]);
        modelLoadingStatus.textContent = 'Loading...';
        modelLoadingStatus.className = 'text-[10px] text-zinc-400';

        const withTimeout = (promise, ms = 5000) => {
          return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Model catalog load timed out')), ms))
          ]);
        };

        const requestedRoute = pickerRoute;
        withTimeout(getEnrichedModels(requestedRoute))
          .then(enriched => {
            // The route changed while loading: this list is for the old route.
            if (requestedRoute !== pickerRoute) return;
            const models = enriched && enriched.length > 0 ? enriched : fallbackList;
            loadedModels = models;
            renderModelPanel(models);
            modelLoadingStatus.textContent = models.length + ' models';
            modelLoadingStatus.className = 'text-[10px] text-emerald-400/70';
          })
          .catch(err => {
            if (requestedRoute !== pickerRoute) return;
            console.warn('[CinemaTemplateStudio] Failed to load enriched model catalog, using fallback:', err);
            loadedModels = fallbackList;
            if (!fallbackList.find(x => x.id === selectedModel)) {
              selectedModel = fallbackList[0]?.id || selectedModel;
            }
            renderModelPanel(fallbackList);
            modelLoadingStatus.textContent = fallbackList.length + ' models (fallback)';
            modelLoadingStatus.className = 'text-[10px] text-amber-400/70';
          });
      }
    };

    // The same model picker as the Video Studio (video templates) / Image
    // Studio (image templates): provider sidebar, families, T2V / I2V / V2V.
    let studioPickerController = null;
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
        return;
      }
      openStudioModelPicker({
        kind: outputType === 'video' ? 'video' : 'image',
        anchor: triggerBtn,
        selectedModelId: selectedModel,
        currentMode: pickerRoute,
        onPick: (modelId, mode) => {
          selectedModel = modelId;
          explicitModelPick = modelId;
          pickedMode = mode || null;
          if (pickedMode) routeModelPicks[pickedMode] = modelId;
          refreshMediaRoute();
          updateTrigger();
          if (videoSettings) videoSettings.refresh();
        },
        onClose: () => { studioPickerController = null; },
      }).then((c) => { studioPickerController = c; })
        .catch((err) => {
          console.warn('[CinemaTemplateStudio] Video Studio model picker unavailable, using list picker:', err);
          openDropdown();
        });
    };

    const headerRow = document.createElement('div');
    headerRow.className = 'mb-3';
    const label = document.createElement('div');
    label.className = 'text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 mb-2';
    label.textContent = 'Model';

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
      label.textContent = `Model · ${MEDIA_ROUTE_LABELS[route] || route}`;
      modelLoadingStatus.textContent = `${fallbackList.length} models`;
      modelLoadingStatus.className = 'text-[10px] text-zinc-500';
    };
    headerRow.appendChild(label);
    headerRow.appendChild(triggerBtn);
    headerRow.appendChild(modelLoadingStatus);
    modelWrapper.appendChild(headerRow);
    videoSettings = null;
    if (outputType === 'video') {
      // Same per-model controls as the Video Studio prompt bar.
      videoSettings = createVideoSettingsControls({
        getTarget: () => {
          const { route, model } = currentMediaRoute();
          return { route, model };
        },
        preferred: { duration: currentInputs.duration || normalizeDuration(currentTemplate), effect: currentTemplate.defaultParams?.name },
        offerEffects: !getTemplateMediaInputs().some(i => i && i.name === 'name'),
      });
      modelWrapper.appendChild(videoSettings.element);
      videoSettings.refresh();
    }
    // Same prompt-bar tools as the Video Studio.
    const templateInputsNow = getTemplateMediaInputs();
    videoTools = createTemplateVideoTools({
      studioName: 'Cinema Template Studio',
      kind: outputType === 'video' ? 'video' : 'image',
      hasOwnAspectRatio: templateInputsNow.some(i => i && (i.name === 'aspect_ratio' || i.name === 'aspectRatio')),
      defaultAspectRatio: resolveGenerationAspectRatio(currentInputs, currentTemplate) || '',
      getTarget: () => {
        const { route, model, media } = currentMediaRoute();
        return { route, model, imageUrl: media.imageUrl };
      },
      onAttach: (key, url) => attachFromToolbar(key, url),
    });
    modelWrapper.appendChild(videoTools.element);
    videoTools.refresh();
    modelWrapper.appendChild(dropdown);
    formPanel.appendChild(modelWrapper);
   }

  // ================================
  // VIDEO UPLOAD BUTTON
  // ================================
  function renderVideoUploadButton(formPanel) {
    // Media sources for video templates — the same pickers the Video Studio
    // uses. A reference image (when the template has no image input of its
    // own) turns the run into image-to-video; a source video turns it into
    // video-to-video. The route badge shows which path Generate will take.
    if (currentTemplate.outputType !== 'video') return;
    const inputs = getTemplateMediaInputs();

    const wrapper = document.createElement('div');
    wrapper.className = 'mt-4';
    wrapper.innerHTML = `
      <div class="mb-3 flex items-center justify-between gap-3">
        <label class="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Media Sources</label>
        <span data-media-route class="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400"></span>
      </div>
      <div data-media-fields class="flex flex-col gap-2"></div>
    `;
    const fieldsHost = wrapper.querySelector('[data-media-fields]');
    mediaRouteBadge = wrapper.querySelector('[data-media-route]');

    if (!inputs.some(i => i && (i.type === 'image' || i.type === 'frame'))) {
      const imageField = createTemplateMediaField({
        kind: 'frame',
        required: currentTemplate.modelType === 'i2v',
        anchorContainer: container,
        studioName: 'Cinema Template Studio',
        initialValue: currentInputs['image_url'] || null,
        onChange: (value) => { currentInputs['image_url'] = value; clearStaleRetry(); refreshMediaRoute(); },
      });
      fieldsHost.appendChild(imageField.element);
      mediaFields.frame.push(imageField);
    }
    if (!inputs.some(i => i && i.type === 'video')) {
      const videoField = createTemplateMediaField({
        kind: 'video',
        anchorContainer: container,
        studioName: 'Cinema Template Studio',
        initialValue: currentInputs['video_url'] || null,
        onChange: (value) => { currentInputs['video_url'] = value; clearStaleRetry(); refreshMediaRoute(); },
      });
      fieldsHost.appendChild(videoField.element);
      mediaFields.video.push(videoField);
    }
    formPanel.appendChild(wrapper);
    refreshMediaRoute();
  }

  function getTemplateMediaInputs() {
    if (!currentTemplate) return [];
    return [
      ...(currentTemplate.inputs || []),
      ...(currentTemplate.quickInputs || []),
      ...(currentTemplate.advancedInputs || []),
    ];
  }

  // Which MuAPI path Generate will take with the media currently attached.
  function currentMediaRoute(modelOverride) {
    const media = extractTemplateMedia(currentInputs, getTemplateMediaInputs());
    return {
      media,
      ...routeTemplateGeneration({
        outputType: currentTemplate?.outputType,
        modelType: currentTemplate?.modelType,
        model: modelOverride || selectedModel,
        pickedMode,
        ...media,
      }),
    };
  }

  /** Media changed: an old Retry would resubmit the previous media. */
  function clearStaleRetry() {
    lastGenerationParams = null;
    container.querySelectorAll('[data-generation-error]').forEach(el => el.remove());
  }

  function refreshMediaRoute() {
    const { route } = currentMediaRoute();
    if (mediaRouteBadge) mediaRouteBadge.textContent = MEDIA_ROUTE_LABELS[route] || route;
    // Like the Video Studio: attaching an image / video swaps the model
    // picker to models that accept it.
    if (syncModelPickerToRoute) syncModelPickerToRoute(route);
    if (videoSettings) videoSettings.refresh();
    if (videoTools) videoTools.refresh();
  }


  // ================================
  // AI ENHANCER SECTION
  // ================================
  function renderAiEnhancer(formPanel) {
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
        <button id="enhancerToggle" class="relative h-7 w-12 rounded-full transition ${isAiEnhancer ? 'bg-emerald-400' : 'bg-white/10'}">
          <span class="absolute top-1 h-5 w-5 rounded-full bg-black transition ${isAiEnhancer ? 'left-6' : 'left-1'}" id="enhancerToggleKnob"></span>
        </button>
      </div>
      <div id="advancedControls" class="mt-5 grid gap-4 md:grid-cols-2 hidden"></div>
    `;
    formPanel.appendChild(enhancerSection);

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
            <select class="h-11 w-full rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-4 text-sm text-white outline-none transition focus:border-emerald-400/50 appearance-none cursor-pointer" data-advanced-field="${field.name}">
              ${field.options.map(opt => `<option value="${opt}" class="bg-zinc-950 text-white">${opt}</option>`).join('')}
            </select>
          </div>
        `;
      } else {
        wrapper.innerHTML = `
          <div class="mb-3 flex items-center justify-between gap-3">
            <div class="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">${field.label}</div>
            <button class="enhancer-btn rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] transition border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-white" data-field="${field.name}">Enhance</button>
          </div>
          <input type="text" class="h-11 w-full rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-4 text-sm text-white outline-none transition focus:border-emerald-400/50" placeholder="${field.placeholder || ''}" data-advanced-field="${field.name}" />
        `;
      }
      advancedControls.appendChild(wrapper);
    });

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

    // Wire enhancer buttons (handled by renderGenerateButton setTimeout)
    // Wire advanced field change listeners
    setTimeout(() => {
      const advControls = document.getElementById('advancedControls');
      if (advControls) {
        advControls.querySelectorAll('select[data-advanced-field], input[data-advanced-field], textarea[data-advanced-field]').forEach(el => {
          const fieldName = el.dataset.advancedField;
          if (!fieldName) return;
          // Keep the shown value and the value Generate uses in sync.
          const stored = currentInputs[fieldName];
          const isOption = el.tagName !== 'SELECT' || Array.from(el.options).some(o => o.value === String(stored));
          if (stored != null && stored !== '' && isOption) el.value = stored;
          // Template Type only counts once the user picks it (its default
          // would add a competing "Format:" to the prompt).
          else if (el.tagName === 'SELECT' && fieldName !== 'templateType') currentInputs[fieldName] = el.value;
          if (el.tagName === 'SELECT') {
            el.onchange = () => {
              currentInputs[fieldName] = el.value;
            };
          } else {
            el.oninput = () => {
              currentInputs[fieldName] = el.value;
            };
          }
        });
      }
    }, 0);
  }

  // ================================
  // CREATIVE INTELLIGENCE SECTION
  // ================================
  function renderCreativeIntelligence(formPanel) {
    const intelligenceSection = document.createElement('div');
     intelligenceSection.className = 'mt-6 rounded-[28px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.35)]';
    intelligenceSection.innerHTML = `
      <h2 class="text-xl font-bold text-white">Creative Intelligence</h2>
       <p class="mt-2 mb-5 text-sm text-zinc-400">These tiles show the cinematic structure, creative direction, and visual strategy this template will use to build your final video.</p>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-4 hover:border-blue-400/20 transition cursor-pointer">
          <div class="mb-3 text-3xl">🏷️</div>
          <h3 class="text-lg font-bold text-white mb-2">Auto-Detected Niche</h3>
          <textarea class="w-full rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-zinc-300 outline-none transition focus:border-emerald-400/50 resize-none" rows="3" data-tile="niche">${escapeHtml(currentTiles.niche || (currentInputs.niche && currentInputs.niche !== 'auto-detect' ? currentInputs.niche : detectTemplateNiche({ template: currentTemplate, advanced: currentInputs })) || '')}</textarea>
        </div>
        <div class="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-4 hover:border-violet-400/20 transition cursor-pointer">
          <div class="mb-3 text-3xl">🎬</div>
          <h3 class="text-lg font-bold text-white mb-2">Scene Structure</h3>
          <textarea class="w-full rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-zinc-300 outline-none transition focus:border-emerald-400/50 resize-none" rows="3" data-tile="scene">${getSceneBeats(currentTemplate).join(' → ')}</textarea>
        </div>
        <div class="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-4 hover:border-emerald-400/20 transition cursor-pointer">
          <div class="mb-3 text-3xl">🎥</div>
          <h3 class="text-lg font-bold text-white mb-2">Cinematic Enrichment</h3>
          <textarea class="w-full rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-zinc-300 outline-none transition focus:border-emerald-400/50 resize-none" rows="3" data-tile="cinematic">Dynamic camera movement, shallow depth of field, professional lighting</textarea>
        </div>
        <div class="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-4 hover:border-amber-400/20 transition cursor-pointer">
          <div class="mb-3 text-3xl">⚙️</div>
          <h3 class="text-lg font-bold text-white mb-2">Visual Style</h3>
          <textarea class="w-full rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-zinc-300 outline-none transition focus:border-emerald-400/50 resize-none" rows="3" data-tile="style">Polished, cinematic, high-contrast, premium aesthetic</textarea>
        </div>
        <div class="md:col-span-2 rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-4 hover:border-rose-400/20 transition cursor-pointer">
          <div class="mb-3 text-3xl">✨</div>
          <h3 class="text-lg font-bold text-white mb-2">Enhancer Keywords</h3>
          <textarea class="w-full rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-zinc-300 outline-none transition focus:border-emerald-400/50 resize-none" rows="4" data-tile="keywords">cinematic, professional, 4K, high quality, premium</textarea>
        </div>
      </div>
    `;
    formPanel.appendChild(intelligenceSection);

    setTimeout(() => {
      intelligenceSection.querySelectorAll('textarea[data-tile]').forEach(ta => {
        const tileName = ta.dataset.tile;
        if (!tileName) return;
        // Generate uses the cards exactly as shown (and as edited).
        if (tileEdited[tileName] && currentTiles[tileName] != null) ta.value = currentTiles[tileName];
        else currentTiles[tileName] = ta.value;
        ta.oninput = () => {
          currentTiles[tileName] = ta.value;
          tileEdited[tileName] = true;
          promptManuallyEdited = false;
        };
      });
    }, 0);
  }

  // ================================
  // OUTPUT TABS
  // ================================
  function renderOutputTabs(outputPanel) {
    const outputTabs = ['Enhanced Prompt', 'Scene Beats', 'Voiceover', 'Negative Prompt'];
    const outputSection = document.createElement('div');
    outputSection.className = 'mt-6 rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.018))] p-5';

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
        if (activeTab === 'Enhanced Prompt') {
          const ta = document.getElementById('outputTextarea');
          if (ta) updatePromptLengthCounter(ta.value);
        } else {
          const counter = document.getElementById('promptLengthCounter');
          if (counter) counter.innerHTML = '';
        }
      };
      tabRow.appendChild(tabBtn);
    });
    outputSection.appendChild(tabRow);

    const outputContent = document.createElement('div');
    outputContent.className = 'rounded-[22px] border border-white/10 bg-black/40 p-4';
    outputContent.innerHTML = `
      <div class="mb-3 flex items-center justify-between gap-3">
        <div class="text-xs uppercase tracking-[0.18em] text-zinc-500">Editable Output</div>
        <button id="wandBtn" class="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/12 text-emerald-200 transition hover:bg-emerald-500/18" title="Enhance with AI">✨</button>
      </div>
      <textarea id="outputTextarea" class="w-full rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-4 py-3 text-sm leading-7 text-zinc-200 outline-none transition focus:border-emerald-400/50 resize-none" rows="12">Click Generate to create an enhanced prompt...</textarea>
      <div id="promptLengthCounter" class="mt-2 text-[11px] text-zinc-500 flex items-center justify-between"></div>
      <button id="resetPromptBtn" class="mt-2 hidden w-full py-2 text-xs font-semibold text-zinc-400 border border-white/10 rounded-[20px] hover:bg-white/5 hover:text-white transition-colors" title="Reset to auto-generated prompt">↩ Reset to auto-generated prompt</button>
    `;

    const outputTextarea = outputContent.querySelector('#outputTextarea');
    if (outputTextarea) {
      outputTextarea.addEventListener('input', () => {
        outputTabValues[activeTab] = outputTextarea.value;
        if (activeTab === 'Enhanced Prompt') {
          lastBuiltPrompt = outputTextarea.value;
          promptManuallyEdited = true;
        } else if (activeTab === 'Negative Prompt') {
          currentInputs['_customNegativePrompt'] = outputTextarea.value;
        } else if (activeTab === 'Scene Beats') {
          currentInputs['_customSceneBlueprint'] = outputTextarea.value;
        }
        updatePromptLengthCounter(outputTextarea.value);
        updateResetButtonVisibility();
      });
      updatePromptLengthCounter(outputTextarea.value);
      updateResetButtonVisibility();
    }
    outputSection.appendChild(outputContent);
    outputPanel.appendChild(outputSection);

    // Wand button
    setTimeout(() => {
      const wandBtn = document.getElementById('wandBtn');
      if (wandBtn) {
        wandBtn.onclick = () => {
          const textarea = document.getElementById('outputTextarea');
          if (!textarea) return;
          const current = (lastBuiltPrompt || textarea.value || '').replace(/[\s.,]+$/, '');
          const extra = 'cinematic quality, professional lighting, high detail, 4K resolution';
          const enhanced = current.toLowerCase().includes('cinematic quality, professional lighting') ? `${current}.` : `${current}, ${extra}.`;
          lastBuiltPrompt = enhanced;
          outputTabValues['Enhanced Prompt'] = enhanced;
          textarea.value = enhanced;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
          textarea.classList.add('border-emerald-400/50');
          setTimeout(() => textarea.classList.remove('border-emerald-400/50'), 1000);
          updatePromptLengthCounter(enhanced);
          updateResetButtonVisibility();
          // Sent as-is until an input changes (the form fields keep the
          // user's own text, so nothing is enriched twice).
          promptManuallyEdited = true;
        };
      }
      const resetBtn = document.getElementById('resetPromptBtn');
      if (resetBtn) {
        resetBtn.onclick = () => resetManualPrompt();
      }
    }, 0);
  }

  function getSceneBeats(template) {
    const blueprint = template.storyBlueprint || template.sceneStructure;
    if (Array.isArray(blueprint)) return blueprint;
    if (blueprint && typeof blueprint === 'object' && Array.isArray(blueprint.acts)) {
      return blueprint.acts.flatMap(act => act.beats || []);
    }
    return ['Hook', 'Subject', 'Movement', 'Payoff', 'CTA'];
  }

  function updateOutputContent() {
    const textarea = document.getElementById('outputTextarea');
    if (!textarea) return;

    const saved = outputTabValues[activeTab];
    switch (activeTab) {
      case 'Enhanced Prompt':
        textarea.value = saved || lastBuiltPrompt || 'Click Generate to create an enhanced prompt...';
        break;
      case 'Scene Beats': {
        const beats = saved || getSceneBeats(currentTemplate);
        textarea.value = Array.isArray(beats) ? beats.join(' → ') : String(beats ?? '');
        break;
      }
      case 'Voiceover':
        textarea.value = saved || `Create a premium voiceover for a ${currentTemplate.name}. Open with a fast hook, build emotional or commercial momentum, end with a clear call to action.`;
        break;
      case 'Negative Prompt':
        textarea.value = saved || 'Low quality, blurry, amateur, poorly lit, generic stock look';
        break;
    }
  }

  function updatePromptLengthCounter(text) {
    const counter = document.getElementById('promptLengthCounter');
    if (!counter) return;
    const len = (text || '').length;
    const tokens = Math.ceil(len / 4);
    let color = 'text-emerald-400';
    if (len > 4000) color = 'text-red-400';
    else if (len > 2000) color = 'text-amber-400';
    counter.innerHTML = `<span class="${color}">${len.toLocaleString()} chars · ~${tokens.toLocaleString()} tokens</span><span class="text-zinc-600">limit 6000</span>`;
  }

  function updateResetButtonVisibility() {
    const btn = document.getElementById('resetPromptBtn');
    if (!btn) return;
    btn.classList.toggle('hidden', !promptManuallyEdited);
    if (promptManuallyEdited) {
      btn.classList.add('border-amber-400/30', 'text-amber-300');
    } else {
      btn.classList.remove('border-amber-400/30', 'text-amber-300');
    }
  }

  function resetManualPrompt() {
    promptManuallyEdited = false;
    lastBuiltPrompt = '';
    try {
      const engine = new PromptAssemblyEngine(currentTemplate, currentInputs, {}, { mode: currentMode });
      lastBuiltPrompt = engine.assemble();
    } catch {
      lastBuiltPrompt = currentInputs.prompt || '';
    }
    outputTabValues['Enhanced Prompt'] = lastBuiltPrompt;
    const textarea = document.getElementById('outputTextarea');
    if (textarea) {
      textarea.value = lastBuiltPrompt;
    }
    updatePromptLengthCounter(lastBuiltPrompt);
    updateResetButtonVisibility();
  }

  // ================================
  // GTM BOOST
  // ================================
  function renderGtmBoost(formPanel) {
    // GTM Boost moved to overflow menu in primary prompt field
  }

  // ================================
  // GENERATE BUTTON + EVENT WIRING
  // ================================
  function renderGenerateButton(formPanel) {
    const genBtn = document.createElement('button');
    genBtn.type = 'button';
    genBtn.id = 'generate-btn';
    genBtn.className = 'mt-6 flex h-14 w-full items-center justify-center rounded-[20px] bg-white text-lg font-semibold text-black shadow-xl transition hover:opacity-90';
    genBtn.textContent = 'Generate';
    genBtn.setAttribute('aria-label', 'Generate template');
    formPanel.appendChild(genBtn);

    // Set disabled state based on isGenerating when rendering
    if (isGenerating) {
      genBtn.disabled = true;
      genBtn.innerHTML = '<span class="animate-spin inline-block mr-2">&#9711;</span> Generating...';
    }

    // AI Captions button — always visible in the create-view controls for video templates
    if (currentTemplate?.outputType === 'video') {
      const captionBtn = document.createElement('button');
      captionBtn.type = 'button';
      captionBtn.textContent = '💬 Add AI Captions';
      captionBtn.setAttribute('data-caption-test', 'cinema-template-studio-v1');
      captionBtn.className = 'mt-3 flex w-full items-center justify-center rounded-[18px] bg-white/10 px-4 py-3 text-sm font-bold text-white border border-white/10 transition-all hover:bg-white/20';
      if (!generationResult) {
        captionBtn.disabled = true;
        captionBtn.classList.add('opacity-50', 'cursor-not-allowed');
      }
      captionBtn.onclick = () => {
        const target = generationResult || '';
        addCaptionButton({
          videoUrl: target || undefined,
          appTheme: 'cinema-template-studio',
          onComplete: (captionedUrl) => {
            const preview = document.querySelector('.cinema-template-studio .preview img, .cinema-template-studio .preview video');
            if (preview) {
              preview.src = captionedUrl;
              if (currentTemplate?.outputType === 'video') {
                preview.outerHTML = `<video src="${captionedUrl}" controls autoplay loop class="max-w-full max-h-[60vh] rounded-xl border border-white/10" style="display:block"></video>`;
              }
            }
          },
        });
      };
      formPanel.appendChild(captionBtn);
    }

    genBtn.onclick = () => {
      generateVideo();
    };

    // Enhance buttons (advanced controls only — form-field Enhance buttons are wired in createFormField)
    setTimeout(() => {
      const advancedControls = document.getElementById('advancedControls');
      if (advancedControls) {
        advancedControls.querySelectorAll('.enhancer-btn').forEach(btn => {
          btn.onclick = () => {
            const fieldName = btn.dataset.field;
            if (!fieldName) return;
            const input = document.querySelector(`[data-advanced-field="${fieldName}"]`);
            if (input && input.value) {
              const enhancedValue = `${input.value}, cinematic style, professional quality, premium aesthetic`;
              input.value = enhancedValue;
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
              currentInputs[fieldName] = enhancedValue;
              userEditedFields.add(fieldName);
              // Rebuild the prompt with the enhanced field.
              promptManuallyEdited = false;
              btn.classList.add('border-emerald-400/40', 'bg-emerald-500/15', 'text-emerald-200');
              btn.textContent = 'Enhanced ✓';
              setTimeout(() => {
                btn.classList.remove('border-emerald-400/40', 'bg-emerald-500/15', 'text-emerald-200');
                 btn.textContent = 'Enhance';
              }, 2000);
            }
          };
        });
      }

      // Enhancer toggle
      const toggleBtn = document.getElementById('enhancerToggle');
      const toggleKnob = document.getElementById('enhancerToggleKnob');
      if (toggleBtn) {
        toggleBtn.onclick = () => {
          isAiEnhancer = !isAiEnhancer;
          toggleBtn.className = `relative h-7 w-12 rounded-full transition ${isAiEnhancer ? 'bg-emerald-400' : 'bg-white/10'}`;
          toggleKnob.className = `absolute top-1 h-5 w-5 rounded-full bg-black transition ${isAiEnhancer ? 'left-6' : 'left-1'}`;
        };
      }

      // Advanced toggle
      const advancedBtn = document.getElementById('advancedToggle');
      const advControls = document.getElementById('advancedControls');
      if (advancedBtn && advControls) {
        advancedBtn.onclick = () => {
          showAdvanced = !showAdvanced;
          setActionPillLabel(advancedBtn, showAdvanced ? 'Less' : 'Advanced');
          advancedBtn.setAttribute('aria-expanded', String(showAdvanced));
          advControls.className = showAdvanced ? 'mt-5 grid gap-4 md:grid-cols-2' : 'mt-5 grid gap-4 md:grid-cols-2 hidden';
        };
      }
    }, 0);
  }

  // ================================
  // GENERATE VIDEO
  // ================================
  function generateVideo() {
    if (flushVideoIntentSync) flushVideoIntentSync();
    if (isGenerating) return;

    const apiKey = apiKeyManager.getMuapiKey();
    if (!apiKey) {
      AuthModal(() => generateVideo());
      return;
    }

    const formBuilder = new TemplateInputBuilder(currentTemplate, currentMode);
    const errors = formBuilder.validateInputs(currentInputs);

    if (errors.length > 0) {
      showToast(`Please fill in required fields: ${errors.map(e => e.field).join(', ')}`, 'error');
      return;
    }

    TemplateStorage.addToRecent(currentTemplate.id, currentInputs);

    // Phase 1 scene selection: auto-pick scenes when the user hasn't
    // manually built a scene list in advanced mode.
    if (!selectedScenes.length && currentTemplate.outputType === 'video') {
      try {
        const targetDuration = currentInputs.duration || currentTemplate.duration?.default || 90;
        selectedScenes = selectScenes(currentTemplate, currentInputs, targetDuration);
      } catch {
        // Non-blocking: fall back to monolithic prompt
        selectedScenes = [];
      }
    }

    // Sync selector output into the scene builder so the storyboard and
    // generation pipeline share one source of truth.
    if (selectedScenes.length && sceneBuilder && !sceneBuilder.getScenes().length) {
      sceneBuilder.clear();
      selectedScenes.forEach((s, idx) => {
        sceneBuilder.addScene({
          sceneNumber: s.scene_number || idx + 1,
          beat: s.purpose?.description || s.name || `Scene ${idx + 1}`,
          duration: s.timing?.duration_seconds || s.duration || 5,
          shots: s.shots || [],
          ...s
        });
      });
    }

    const isVideo = currentTemplate.outputType === 'video';

    // Validate selected model matches template modelType
    const candidates = currentTemplate.modelType === 'i2i' ? i2iModels
      : currentTemplate.modelType === 't2i' ? t2iModels
      : currentTemplate.modelType === 't2v' ? t2vModels
      : currentTemplate.modelType === 'v2v' ? v2vModels
      : i2vModels;

    const validModel = candidates.find(m => m.id === selectedModel)
      || modelsForRoute(currentMediaRoute(selectedModel).route).find(m => m.id === selectedModel);
    if (!validModel) {
      selectedModel = resolveModel(currentTemplate, selectedModel, { i2i: i2iModels, t2i: t2iModels, i2v: i2vModels, t2v: t2vModels, v2v: v2vModels });
    }

    // Route by attached media exactly like the Video Studio: a source video
    // goes to v2v, an image to i2v / i2i, otherwise text-to-video / image.
    const { media, route, model: routedModel } = currentMediaRoute(selectedModel);
    const imageUrl = media.imageUrl;

    // Needs an image when the resolved route is image-driven (e.g. Movie
    // Poster switched to an image-to-image model) or the template is,
    // except on video-to-video, which only needs the source video.
    const needsImage = route === 'i2v' || route === 'i2i'
      || ((currentTemplate.modelType === 'i2v' || currentTemplate.modelType === 'i2i') && route !== 'v2v');
    if (needsImage && !imageUrl) {
      showToast('Please upload an image before generating.', 'error');
      return;
    }
    if (route === 'v2v' && !media.videoUrl) {
      showToast('Please upload a video before generating.', 'error');
      return;
    }
    const v2vBlock = promptlessV2VBlock(route, routedModel, explicitModelPick);
    if (v2vBlock) {
      showToast(v2vBlock, 'error');
      return;
    }

    let model = routedModel;
    if (!model) {
      if (imageUrl && isVideo) {
        model = 'kling-v2.6-pro-i2v';
      } else if (isVideo) {
        model = 'kling-v2.6-pro-t2v';
      } else {
        model = 'flux-dev';
      }
    }

    let prompt;
    if (promptManuallyEdited && lastBuiltPrompt) {
      prompt = lastBuiltPrompt;
    } else {
      try {
        const engine = new PromptAssemblyEngine(currentTemplate, currentInputs, {}, { mode: currentMode });

        // If we have an incoming storyboard, prefer it for prompt assembly
        if (incomingStoryboard?.frames?.length) {
          const storyboardScenes = incomingStoryboard.frames.map((frame, idx) => ({
            scene_number: frame.sceneNumber || idx + 1,
            name: frame.description || frame.prompt || `Scene ${idx + 1}`,
            timing: { duration_seconds: frame.duration || 5 },
            emotion: { primary: frame.emotionalTone || 'neutral' },
            shots: frame.shotType ? [{
              type: frame.shotType,
              movement: frame.cameraMovement || 'Static',
              duration: frame.duration || 3,
              order: 1
            }] : [],
            flowName: `Storyboard: ${storyboardProjectId || 'External'}`,
            storyboardFrame: frame
          }));
          prompt = engine.assembleScenePromptsFromSelector(storyboardScenes).join('\n\n---\n\n');
        } else {
          // Phase 1: prefer scene-builder output if the user has edited scenes;
          // otherwise fall back to scene-selector output; otherwise monolithic prompt.
          const builderScenes = sceneBuilder?.getScenes() || [];
          if (builderScenes.length) {
            const scenePrompts = engine.assembleScenePromptsFromSelector(builderScenes);
            prompt = scenePrompts.join('\n\n---\n\n');
          } else if (selectedScenes.length) {
            const scenePrompts = engine.assembleScenePromptsFromSelector(selectedScenes);
            prompt = scenePrompts.join('\n\n---\n\n');
          } else {
            prompt = engine.assemble();
          }
        }
      } catch {
        prompt = currentInputs.prompt || '';
      }
      // Make sure every input the user set is in the prompt — the assembly
      // engine only knows some field names.
      prompt = appendMissingInputs(prompt, collectCinemaPromptEntries());
      // Motion & Style (Video Studio) modifiers.
      if (videoTools) prompt = videoTools.applyToPrompt(prompt, currentMediaRoute(selectedModel).route);
      lastBuiltPrompt = prompt;
    }

    const negNiche = (currentInputs.niche && currentInputs.niche !== 'auto-detect') ? currentInputs.niche : (currentTemplate.niche || '');

    // A prompt the user edited by hand is sent as-is (no extra enrichment).
    if (isAiEnhancer && !promptManuallyEdited) {
      try {
        prompt = enrichPromptString(prompt, {
          niche: negNiche,
          visualStyle: currentInputs.visualStyle || 'commercial',
          filmType: currentTemplate.filmFamily || undefined
        });
        lastBuiltPrompt = prompt;
      } catch (err) {
        console.warn('[CinemaTemplateStudio] Enrichment failed, using raw prompt:', err);
        showToast('AI enhancement failed, using raw prompt', 'warning');
      }
    }

    // Validate that there's some prompt content to work with
    const trimmedPrompt = (prompt || '').trim();
    if (!trimmedPrompt && !currentTemplate?.basePrompt) {
      showToast('Please enter a prompt or description before generating.', 'error');
      return;
    }

    promptManuallyEdited = false;

    if (prompt.length > 6000) {
      showToast(`Prompt is ${prompt.length.toLocaleString()} characters — this may exceed model limits. Consider shortening.`, 'warning');
    }

    const negativePrompt = currentInputs['_customNegativePrompt'] || buildNegativePrompt(currentTemplate, currentInputs, {}) || 'Low quality, blurry, amateur, poorly lit, generic stock look';

    const params = {
      model,
      prompt,
      studioType: 'cinema-template',
    };

    // The user's explicit aspect-ratio choice (form control / video intent) wins
    // over the template metadata — otherwise changing the aspect-ratio control
    // would silently regenerate at the template's default. Fall back to the
    // template metadata only when the user has not chosen one, then to 16:9.
    const aspectRatio = resolveGenerationAspectRatio(currentInputs, currentTemplate);
    if (aspectRatio) params.aspect_ratio = aspectRatio;

    if (isVideo) {
      const duration = normalizeDuration(currentTemplate);
      if (duration) {
        const rawDuration = currentInputs.duration || duration;
        // The MuAPI video endpoint only accepts 5 or 10 seconds.
        // Clamp template durations to the nearest supported value.
        params.duration = rawDuration <= 5 ? 5 : 10;
      }
    }

    applyTemplateMediaToParams(params, media, route);
    if (route === 'i2v' && media.endImageUrl && endFrameSupport(route, params.model) === 'none') {
      const mm = findTemplateModel(params.model);
      showToast(`${mm?.name || params.model} has no end-frame input, so your end frame isn't used. Pick a model with start & end frames (e.g. Seedance 2.5) to use it.`, 'warning');
    }
    // Per-model duration / resolution / native audio (only values the
    // selected model accepts) override the generic 5/10s clamp above.
    if (isVideo && videoSettings) Object.assign(params, videoSettings.getSettings());
    if (params.aspect_ratio) params.aspect_ratio = snapAspectRatioForModel(route, params.model, params.aspect_ratio);

     if (negativePrompt) {
      params.negative_prompt = negativePrompt;
    }

    attachThumbnail(params, customThumbnailUrl);

    const outputTextarea = container.querySelector('#outputTextarea');
    if (outputTextarea) {
      outputTextarea.value = params.prompt;
      lastBuiltPrompt = params.prompt;
      outputTabValues['Enhanced Prompt'] = params.prompt;
    }

    const handoff = new RenderHandoff(
      currentTemplate,
      currentInputs,
      sceneBuilder?.getScenes() || selectedScenes || [],
      { mode: currentMode }
    );

    try {
      sessionStorage.setItem('cinematic_render_handoff', handoff.toJSON());
    } catch (error) {
      console.warn('[CinemaTemplateStudio] Failed to store render handoff in sessionStorage:', error);
    }

    lastGenerationParams = params;
    retryCount = 0;

    try {
      sessionStorage.setItem('cinematic_last_generation_params', JSON.stringify(params));
    } catch (error) {
      console.warn('[CinemaTemplateStudio] Failed to store generation params in sessionStorage:', error);
    }

    runGeneration(params);
  }

  /**
   * Media dropped / picked in the prompt attachment toolbar goes into the
   * matching media field (same as attaching it there directly).
   */
  function attachFromToolbar(key, url) {
    const frame = mediaFields.frame.find(f => f.element.isConnected) || mediaFields.frame[0];
    const image = mediaFields.image.find(f => f.element.isConnected) || mediaFields.image[0];
    const video = mediaFields.video.find(f => f.element.isConnected) || mediaFields.video[0];
    if (key === 'video') {
      if (video) video.setValue(url);
      else { currentInputs.video_url = url; refreshMediaRoute(); }
    } else if (key === 'endFrame') {
      if (frame) frame.setValue({ endUrl: url });
      else { currentInputs.last_image_url = url; refreshMediaRoute(); }
    } else if (frame) {
      frame.setValue({ startUrl: url });
    } else if (image) {
      image.setValue(url);
    } else {
      currentInputs.image_url = url;
      refreshMediaRoute();
    }
    promptManuallyEdited = false;
  }

  /**
   * Every value the user can see in the form, as prompt entries: the
   * template's own fields (current Quick / Advanced mode), Advanced Controls,
   * the edited Scene Beats tab and the Creative Intelligence cards.
   */
  function collectCinemaPromptEntries() {
    const i = currentInputs || {};
    const shown = new TemplateInputBuilder(currentTemplate, currentMode).inputs || [];
    const humanize = (v) => String(v || '').replace(/[-_]+/g, ' ');
    let intent = {};
    try { intent = getVideoIntent() || {}; } catch { /* no intent yet */ }
    const entries = [
      ...templateInputEntries(shown, i),
      // Video Intent panel.
      { label: 'Subject', value: intent.subject },
      { label: 'Core narrative', value: intent.premise },
      { label: 'Target audience', value: i.targetAudience || intent.targetAudience },
      { label: 'Call to action', value: intent.cta },
      { label: 'Tone', value: intent.tone },
      { label: 'Video type', value: intent.videoType ? humanize(intent.videoType) : '' },
      { label: 'Lighting', value: intent.lightingPreset && intent.lightingPreset !== 'None' ? intent.lightingPreset : '' },
      { label: 'Color grade', value: intent.colorGrade && intent.colorGrade !== 'None' ? intent.colorGrade : '' },
      { label: 'Style preset', value: intent.stylePreset && intent.stylePreset !== 'None' ? intent.stylePreset : '' },
      // Brand Context (when the template includes it).
      { label: 'Brand', value: currentTemplate?.includeBrandContext ? i.brandName : '' },
      { label: 'Brand voice', value: currentTemplate?.includeBrandContext && i.brandVoice ? humanize(i.brandVoice) : '' },
      { label: 'Format', value: currentTemplate?.outputType === 'image' ? '' : humanize(i.templateType) },
      { label: 'Niche', value: i.niche && i.niche !== 'auto-detect' ? humanize(i.niche) : (tileEdited.niche ? currentTiles.niche : '') },
      { label: 'Business', value: i.businessType },
      { label: 'Target audience', value: i.audience },
      { label: 'Subject', value: i.subject },
      { label: 'Setting', value: i.setting },
      { label: 'Visual style', value: i.visualStyle },
      { label: 'Call to action', value: i.cta },
      { label: 'Creative direction', value: i.extraInstructions },
      { label: 'Scene structure', value: i._customSceneBlueprint || currentTiles.scene },
      { label: '', value: currentTiles.cinematic },
      { label: 'Style direction', value: currentTiles.style },
    ];
    if (isAiEnhancer) entries.push({ label: '', value: currentTiles.keywords });
    return entries;
  }

  /**
   * @param {object} params
   * @param {{ exact?: boolean }} [opts] exact: params are a stored snapshot of an
   *   earlier run (Regenerate) — do not re-apply the current form's Advanced /
   *   Character Lock / ratio on top of it.
   */
  async function runGeneration(params, { exact = false } = {}) {
    if (isGenerating) return;
    const exactParams = exact ? { ...params } : null;

    isGenerating = true;
    let genBtn = container.querySelector('#generate-btn');
    if (genBtn) {
      genBtn.disabled = true;
      genBtn.innerHTML = '<span class="animate-spin inline-block mr-2">&#9711;</span> Generating...';
    }

    // Same as the Video Studio: Cancel button, progress timer, and a pending
    // job record so a generation that finishes after a reload is recovered.
    let cancelHandle = null;
    let progressHandle = null;
    let pendingJob = null;

    try {
      let result;
      const isVideo = currentTemplate.outputType === 'video';
      params = { ...params };
      // Advanced (negative prompt / seed), Character Lock, guidance, ratio.
      if (!exact && videoTools) await videoTools.applyToParams(params);
      const hasImageUrl = !!params.image_url;
      const isV2V = getV2VModelById(params.model);
      const { route: runRoute } = currentMediaRoute(params.model);
      if (params.aspect_ratio) params.aspect_ratio = snapAspectRatioForModel(runRoute, params.model, params.aspect_ratio);
      // Only settings this model declares (Kling v2.6 I2V: no ratio / resolution).
      dropUndeclaredSettings(params, runRoute);

      if (genBtn) {
        cancelHandle = createAbortAwareGenerateButton(genBtn);
        cancelHandle.showCancel();
        params.signal = cancelHandle.controller.signal;
        progressHandle = startGenerationProgress({ parent: genBtn.parentElement, type: isVideo ? 'video' : 'image' });
      }
      pendingJob = createPendingJobTracker('cinema-template', { prompt: params.prompt || '', model: params.model, templateId: currentTemplate.id, outputType: isVideo ? 'video' : 'image' });
      lastRequestId = null;
      params.onRequestId = (rid) => { lastRequestId = rid; pendingJob.onRequestId(rid); };

      // Same MuAPI calls the Video Studio makes for each route.
      if (isV2V && params.video_url) {
        result = await muapi.processV2V(params, params.signal);
      } else if (isVideo && hasImageUrl) {
        result = await muapi.generateI2V(params, params.signal);
      } else if (isVideo) {
        result = await muapi.generateVideo(params, params.signal);
      } else if (hasImageUrl) {
        result = await muapi.generateI2I(params, params.signal);
      } else {
        result = await muapi.generateImage(params, params.signal);
      }
      progressHandle?.stop();
      pendingJob.finish();
      // On success the view switches to the preview, which removes the
      // Cancel button with the old form.

      if (result && result.url) {
        generationResult = result.url;
        try {
          sessionStorage.setItem('cinematic_generation_result', result.url);
        } catch (error) {
          console.warn('[CinemaTemplateStudio] Failed to store generation result in sessionStorage:', error);
        }
        saveToHistory(result.url, params.prompt, params.model, currentTemplate.id);
        currentResultEntry = {
          id: result.id || result.request_id || lastRequestId || null,
          url: result.url,
          prompt: params.prompt || '',
          model: params.model,
          type: isVideo ? 'video' : 'image',
          templateId: currentTemplate.id,
          regenParams: snapshotGenerationParams(params),
        };
        resultHistory.add(currentResultEntry);
        retryCount = 0;
        view = 'preview';
        render();
      } else {
        throw new Error('No output URL returned');
      }
    } catch (err) {
      progressHandle?.stop();
      pendingJob?.finish();
      const cancelled = cancelHandle?.isCancelled?.() || err?.name === 'AbortError';
      cancelHandle?.reset();
      const { userMessage } = cancelled ? { userMessage: 'Generation cancelled.' } : formatGenerationError(err, retryCount, MAX_RETRIES);
      const errEl = document.createElement('div');
      errEl.className = 'mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200';
      errEl.dataset.generationError = '';
      errEl.textContent = userMessage;

      if (!cancelled && retryCount < MAX_RETRIES && (exact || lastGenerationParams)) {
        const retryBtn = document.createElement('button');
        retryBtn.id = 'retry-btn';
        retryBtn.className = 'ml-2 underline text-emerald-200 hover:text-white';
        retryBtn.textContent = 'Retry';
        retryBtn.onclick = () => {
          retryCount++;
          if (errEl && errEl.parentNode) errEl.remove();
          // A failed Regenerate retries that same stored run, not the newest form.
          if (exact) runGeneration({ ...exactParams }, { exact: true });
          else runGeneration(lastGenerationParams);
        };
        errEl.appendChild(retryBtn);
      }

      const target = container.querySelector('#generate-btn') || container;
      target.insertAdjacentElement('afterend', errEl);

      isGenerating = false;
      if (genBtn) {
        genBtn.textContent = 'Generate';
        genBtn.disabled = false;
      }

      setTimeout(() => {
        if (errEl && errEl.parentNode) errEl.remove();
      }, 5000);
      return;
    }

    isGenerating = false;
    genBtn = container.querySelector('#generate-btn');
    if (genBtn) {
      genBtn.textContent = 'Generate';
      genBtn.disabled = false;
    }
  }

  function saveToHistory(url, prompt, model, templateId, type) {
    saveGeneration({
      studio: 'cinema',
      type: type || (currentTemplate?.outputType === 'video' ? 'video' : 'image'),
      url,
      prompt,
      model: model || selectedModel,
      parameters: { template_id: templateId || (currentTemplate ? currentTemplate.id : '') },
      timestamp: new Date().toISOString(),
    });
  }

  // ================================
  // STORYBOARD VIEW
  // ================================
  function renderStoryboardView() {
    container.innerHTML = '';

    // Embed StoryboardStudio without its own chrome/drawer to avoid
    // nested navigation. CinemaTemplateStudio supplies the back button
    // and drawer context.
    const storyboardRoot = StoryboardStudio({ embedded: true });
    container.appendChild(storyboardRoot);

    // Back button: return to the cinema create view.
    const backBtn = document.createElement('button');
    backBtn.id = 'back-btn';
    backBtn.className = 'p-2 hover:bg-white/10 rounded-lg transition-colors shrink-0';
    backBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>`;
    backBtn.onclick = () => {
      view = 'create';
      render();
    };

const firstChild = storyboardRoot.firstElementChild;
    if (firstChild) {
      storyboardRoot.insertBefore(backBtn, firstChild);
    } else {
      storyboardRoot.appendChild(backBtn);
    }
  }




  // ================================
  // PREVIEW VIEW
  // ================================
  function renderPreviewView() {
    const preview = document.createElement('div');
    preview.className = 'flex-1 min-h-0 flex flex-col items-center p-8 overflow-y-auto custom-scrollbar';
    preview.style.justifyContent = 'safe center';

    // The selected result's own type wins over the open template's.
    const shownEntry = currentResultEntry && currentResultEntry.url === generationResult ? currentResultEntry : null;
    const isVideoOutput = shownEntry?.type ? shownEntry.type === 'video' : currentTemplate?.outputType === 'video';
    const resultMedia = document.createElement(isVideoOutput ? 'video' : 'img');
    resultMedia.src = generationResult || '';
    resultMedia.className = 'max-w-full max-h-[60vh] rounded-xl border border-white/10';
    resultMedia.alt = 'Generated result';
    if (isVideoOutput) {
      resultMedia.controls = true;
      resultMedia.autoplay = true;
      resultMedia.loop = true;
    }

    const actions = document.createElement('div');
    actions.className = 'mt-6 flex items-center gap-3';

    const backBtn = document.createElement('button');
    backBtn.id = 'back-btn';
    backBtn.className = 'p-2 hover:bg-white/10 rounded-lg transition-colors';
    backBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>`;
    backBtn.onclick = () => {
      view = 'create';
      render();
    };

    const newTabBtn = document.createElement('a');
    newTabBtn.href = generationResult || '#';
    newTabBtn.target = '_blank';
    newTabBtn.className = 'px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-sm rounded-lg transition-colors';
    newTabBtn.textContent = 'Open in new tab';

    const downloadBtn = document.createElement('a');
    downloadBtn.href = generationResult || '#';
    downloadBtn.download = '';
    downloadBtn.className = 'px-4 py-2 bg-primary text-black text-sm font-bold rounded-lg hover:scale-105 transition-transform';
    downloadBtn.textContent = 'Download';

    actions.appendChild(backBtn);
    actions.appendChild(newTabBtn);
    actions.appendChild(downloadBtn);

    const mediaType = currentTemplate?.outputType === 'video' ? 'video' : 'image';
    const publishBtn = document.createElement('button');
    publishBtn.type = 'button';
    publishBtn.className = 'publish-social-btn px-4 py-2 bg-gradient-to-r from-[#6d5efc] to-[#a855f7] text-white text-sm font-bold rounded-lg hover:scale-105 transition-transform';
    publishBtn.textContent = 'Publish to Social';
    publishBtn.onclick = () => {
      const target = generationResult || resultMedia.src || '';
      if (target) openSocialPublish({ mediaUrl: target, mediaType });
    };
    actions.appendChild(publishBtn);

    preview.appendChild(resultMedia);
    // Frame scrubber (Video Studio).
    if (isVideoOutput) {
      const scrubberWrap = document.createElement('div');
      scrubberWrap.className = 'w-full max-w-3xl';
      scrubberWrap.appendChild(createFrameScrubber(resultMedia));
      preview.appendChild(scrubberWrap);
    }
    preview.appendChild(actions);

    // Regenerate / Extend (Video Studio) — same model as the last run.
    const entry = (currentResultEntry && currentResultEntry.url === generationResult)
      ? currentResultEntry
      : (resultHistory.find(generationResult) || { url: generationResult, type: isVideoOutput ? 'video' : 'image' });
    const resultActions = createResultActions({
      onRegenerate: () => {
        // Re-run the settings of the result on screen. An entry without them
        // (older saved history, an Extend result) goes back to the form
        // rather than silently re-running a different, newer generation.
        const templateType = currentTemplate?.outputType === 'video' ? 'video' : 'image';
        if (entry.regenParams && (!entry.type || entry.type === templateType)) {
          runGeneration({ ...entry.regenParams }, { exact: true });
        } else {
          // Only open the form; the user starts the new generation.
          view = 'create';
          render();
        }
      },
      onExtend: (e, opts) => extendResult(e, opts),
    });
    resultActions.setEntry(entry);
    const actionsWrap = document.createElement('div');
    actionsWrap.className = 'w-full max-w-3xl';
    actionsWrap.appendChild(resultActions.element);
    preview.appendChild(actionsWrap);

    // History strip.
    const historyWrap = document.createElement('div');
    historyWrap.className = 'w-full max-w-3xl';
    resultHistory.setActive(generationResult);
    historyWrap.appendChild(resultHistory.element);
    preview.appendChild(historyWrap);
    container.appendChild(preview);
  }

  /**
   * Extend a Seedance 2.0 result (Video Studio "Extend"): runs the
   * seedance-v2.0-extend model from the video model catalog with the
   * original request id.
   */
  async function extendResult(entry, { prompt, duration }) {
    if (!canExtend(entry)) throw new Error('Only Seedance 2.0 videos can be extended.');
    const params = buildExtendParams(entry, { prompt, duration });
    let rid = null;
    params.onRequestId = (id) => { rid = id; };
    const result = await muapi.generateVideo(params);
    if (!result || !result.url) throw new Error('No output URL returned');
    generationResult = result.url;
    currentResultEntry = {
      id: result.id || result.request_id || rid || null,
      url: result.url,
      prompt: params.prompt || entry.prompt || '',
      model: params.model,
      type: 'video',
      templateId: entry.templateId || currentTemplate?.id || '',
    };
    resultHistory.add(currentResultEntry);
    saveToHistory(result.url, currentResultEntry.prompt, params.model, currentResultEntry.templateId);
    view = 'preview';
    render();
  }

  return container;
}

