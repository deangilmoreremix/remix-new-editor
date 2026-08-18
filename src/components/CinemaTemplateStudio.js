/**
 * CINEMA TEMPLATE STUDIO
 * UI Component for the Cinematic Template System
 */

import { navigate } from '../lib/router.js';
import { mountStudioDrawer, createStudioMenuButton } from '../lib/studioChrome.js';
import { showToast } from '../lib/loading.js';
import { escapeHtml, sanitizeUrl } from '../lib/security.js';
import { mountPersonalizeTrigger } from './personalize/personalizePopover.js';
import { muapi } from '../lib/muapi.js';
import { StoryboardStudio } from './StoryboardStudio.js';
import { createUploadPicker } from './UploadPicker.js';
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
import { t2iModels, i2iModels, i2vModels } from '../lib/models.js';
import { CINEMATIC_THEME, cx } from '../lib/cinematicTheme.js';

import { getTemplateThumbnailCandidates, saveCustomThumbnailToCache, getCustomThumbnailFromCache, clearCustomThumbnailCache } from '../lib/thumbnails.js';
import { TemplateThumbnailModal, mountThumbnailModal } from './modals/TemplateThumbnailModal.jsx';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import { AuthModal } from './AuthModal.js';
import { getGtmContext } from '../lib/gtmContextStore.js';
import { selectScenes } from '../lib/sceneSelector.js';
import { getEnrichedModels } from '../lib/modelCatalog.js';
import { PROVIDER_LOGOS, invertLogos, getProviderStyle, getAvailableProviders, filterModels, renderProviderSidebar, renderSearchBar, renderModelList } from '../lib/modelSelectorUI.js';
import { enrichPromptString, composeNegativePrompt } from '../lib/templateEngine.js';

export function CinemaTemplateStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col bg-black overflow-hidden';

  // All-studios side menu (drawer)
  const studioDrawer = mountStudioDrawer(document.body, { currentRoute: 'cinema' });

  // State
  let registry = getTemplateRegistry();
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

  let _modelSelectorOutsideClickHandler = null;

  let selectedModel = 'kling-v2.6-pro-t2v';
  let lastModelType = null;
  let isAiEnhancer = true;
  let customThumbnailUrl = null;
  let lastBuiltPrompt = '';
  let outputTabValues = {};
  let activeTab = 'Enhanced Prompt';
  let showAdvanced = false;
  let showMobileOutput = false;
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

    // Add an "all studios" menu button next to every back button in this view
    container.querySelectorAll('[id="back-btn"]').forEach((backBtn) => {
      if (backBtn.previousElementSibling && backBtn.previousElementSibling.dataset.studioMenu) return;
      const menuBtn = createStudioMenuButton(studioDrawer.toggle);
      menuBtn.dataset.studioMenu = '1';
      backBtn.parentElement.insertBefore(menuBtn, backBtn);
    });
  }

  // ================================
  // BROWSE VIEW
  // ================================
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
    card.className = 'bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 cursor-pointer transition-colors';

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
        onApply: ({ imageUrl }) => {
          img.src = imageUrl + '?v=' + Date.now();
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
    currentMode = 'quick';
    currentInputs = new TemplateInputBuilder(template, currentMode).getDefaults();
    if (lastModelType !== template.modelType) {
      const defaultModel = template.model || 'kling-v2.6-pro-t2v';
      const candidates = template.modelType === 'i2i' ? i2iModels : template.modelType === 't2i' ? t2iModels : i2vModels;
      selectedModel = candidates.find(m => m.id === defaultModel) ? defaultModel : (candidates[0]?.id || defaultModel);
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
      const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
      const storyboardParam = params.get('storyboard');
      if (storyboardParam) {
        incomingStoryboard = JSON.parse(storyboardParam);
        storyboardProjectId = incomingStoryboard.id || incomingStoryboard.projectId || null;
      }
    } catch (e) {
      console.warn('[CinemaTemplateStudio] Failed to parse incoming storyboard:', e);
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
    if (!currentTemplate) return;

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

    const content = document.createElement('div');
    content.className = 'flex-1 flex overflow-hidden flex-col lg:flex-row';

    // Left: Form inputs
    const formPanel = document.createElement('div');
    formPanel.className = 'flex-1 overflow-auto p-6';
    formPanel.innerHTML = `
      <div class="max-w-2xl mx-auto">
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
      </div>
    `;
    content.appendChild(formPanel);

    renderModelSelector(formPanel);
    renderAiEnhancer(formPanel);
    renderCreativeIntelligence(formPanel);
    renderGtmBoost(formPanel);
    renderGenerateButton(formPanel);

    // Right: Output panel
    const outputPanel = document.createElement('div');
    outputPanel.id = 'output-panel';
    outputPanel.className = 'w-full lg:w-96 border-l border-white/10 p-6 overflow-auto hidden lg:block';
    outputPanel.innerHTML = `
      <div class="sticky top-0 relative">
          <h3 class="${CINEMATIC_THEME.text.eyebrow} text-white mb-4">Output</h3>
        <button id="close-output-btn" class="lg:hidden absolute top-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 transition" title="Close output">✕</button>

        <div class="bg-white/5 rounded-2xl p-4 mb-4">
          <div class="aspect-video bg-black rounded-xl mb-3 flex items-center justify-center overflow-hidden">
            <img id="preview-thumb" src="" alt="" class="w-full h-full object-cover hidden" />
            <div id="preview-thumb-fallback" class="text-center">
              <div class="text-4xl mb-2">${escapeHtml(currentTemplate.icon)}</div>
              <div class="text-xs text-secondary">Preview</div>
            </div>
          </div>
          <div class="space-y-2 text-xs">
            <div class="flex justify-between">
              <span class="text-white/50">Template</span>
              <span class="text-white">${escapeHtml(currentTemplate.name)}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-white/50">Duration</span>
              <span class="text-white">${currentInputs.duration || currentTemplate.duration?.default || 30}s</span>
            </div>
            <div class="flex justify-between">
              <span class="text-white/50">Aspect Ratio</span>
              <span class="text-white">${currentInputs.aspectRatio || '16:9'}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-white/50">Style</span>
              <span class="text-white">${currentInputs.visualStyle || 'Cinematic'}</span>
            </div>
          </div>
        </div>

        <div id="personalize-trigger" class="mt-3"></div>
      </div>
    `;
    content.appendChild(outputPanel);

    renderOutputTabs(outputPanel);
    updateOutputContent();

    outputPanel.querySelector('#close-output-btn')?.addEventListener('click', toggleMobileOutput);

    function toggleMobileOutput() {
      showMobileOutput = !showMobileOutput;
      const panel = document.getElementById('output-panel');
      const btn = document.getElementById('mobile-output-btn');
      if (!panel || !btn) return;
      if (showMobileOutput) {
        panel.className = 'fixed inset-0 z-50 bg-black/90 backdrop-blur-md lg:relative lg:bg-transparent w-full lg:w-96 p-6 overflow-auto';
        btn.classList.add('hidden');
      } else {
        panel.className = 'w-full lg:w-96 border-l border-white/10 p-6 overflow-auto hidden lg:block';
        btn.classList.remove('hidden');
      }
    }

    container.appendChild(content);

    const mobileOutputBtn = document.createElement('button');
    mobileOutputBtn.id = 'mobile-output-btn';
    mobileOutputBtn.className = 'lg:hidden fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-black text-sm font-bold shadow-lg hover:scale-105 transition-transform';
    mobileOutputBtn.textContent = 'Output';
    mobileOutputBtn.onclick = toggleMobileOutput;
    container.appendChild(mobileOutputBtn);

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

    const personalizeEl = container.querySelector('#personalize-trigger');
    if (personalizeEl) {
      personalizeEl.innerHTML = '';
      mountPersonalizeTrigger({ controlsContainer: personalizeEl, appId: 'cinema-template' });
    }

    if (currentTemplate.sceneBuilder) {
      if (container.querySelector('#open-storyboard-btn')) {
        container.querySelector('#open-storyboard-btn').onclick = () => {
          view = 'storyboard';
          render();
        };
      }
      if (container.querySelector('#add-scene-btn')) {
        container.querySelector('#add-scene-btn').onclick = () => {
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
    const thumbImg = container.querySelector('#preview-thumb');
    const fallback = container.querySelector('#preview-thumb-fallback');
    if (!thumbImg) return;
    if (customThumbnailUrl) {
      thumbImg.src = customThumbnailUrl;
      thumbImg.classList.remove('hidden');
      if (fallback) fallback.classList.add('hidden');
    } else {
      thumbImg.classList.add('hidden');
      if (fallback) fallback.classList.remove('hidden');
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

    schema.forEach(input => {
      const field = createFormField(input);
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
          const field = createFormField(input);
          brandContainer.appendChild(field);
        });
      }
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

    const syncIntent = debounce(() => {
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
    }, 300);

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
    Object.entries(mapping).forEach(([intentKey, inputKey]) => {
      if (intent[intentKey] !== undefined && intent[intentKey] !== null && intent[intentKey] !== '') {
        currentInputs[inputKey] = intent[intentKey];
      }
    });
    if (intent.premise) {
      currentInputs.premise = intent.premise;
    }
  }

  function onVideoIntentChanged(intent) {
    syncVideoIntentToTemplate(intent);
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
        sceneBuilder.removeScene(btn.dataset.id);
        renderSceneBuilder();
        renderSceneTimeline();
      });
    });

    list.querySelectorAll('.move-scene-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const dir = btn.dataset.dir;
        const scenes = sceneBuilder.getScenes();
        const newIdx = dir === 'up' ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= scenes.length) return;
        sceneBuilder.moveScene(scenes[idx].id, newIdx);
        renderSceneBuilder();
        renderSceneTimeline();
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

  function createFormField(input) {
    const field = document.createElement('div');
    field.className = 'space-y-1.5';

    const label = document.createElement('label');
    label.className = 'block text-xs font-bold text-white uppercase tracking-wider';
    label.textContent = input.label;
    if (input.required) {
      label.innerHTML += ' <span class="text-primary">*</span>';
    }
    field.appendChild(label);

    const isPrimaryPromptField =
      input.name === 'prompt' &&
      (input.type === 'textarea' || input.type === 'text');

    switch (input.type) {
      case 'text':
      case 'number': {
        const textInput = document.createElement('input');
        textInput.type = input.type;
        textInput.name = input.name;
        textInput.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-muted focus:outline-none focus:border-primary/50';
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
        textarea.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-muted focus:outline-none focus:border-primary/50 resize-none';
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
        select.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary/50';

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
      case 'frame': {
        const isFrame = input.type === 'frame';
        const uploadTrigger = document.createElement('button');
        uploadTrigger.type = 'button';
        uploadTrigger.className = 'w-full flex items-center gap-3 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition text-left';
        uploadTrigger.innerHTML = `<div class="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-muted shrink-0"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div><span class="text-sm text-white/80">${input.label || (isFrame ? 'Add start & end frames' : 'Upload image')}</span>`;

        const setDone = (label) => {
          uploadTrigger.innerHTML = `<div class="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-300 shrink-0"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></div><span class="text-sm text-emerald-200">${label}</span>`;
        };
        const setReset = () => {
          uploadTrigger.innerHTML = `<div class="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-muted shrink-0"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div><span class="text-sm text-white/80">${input.label || (isFrame ? 'Add start & end frames' : 'Upload image')}</span>`;
        };

        uploadTrigger.onclick = (e) => {
          e.stopPropagation();
          const picker = createUploadPicker({
            anchorContainer: container,
            frameMode: isFrame,
            onSelect: (sel) => {
              if (isFrame) {
                currentInputs[input.name] = { startUrl: sel.startUrl, endUrl: sel.endUrl, urls: sel.urls };
                setDone(sel.endUrl ? 'Start & end frames set' : 'Start frame set');
              } else {
                currentInputs[input.name] = sel.url;
                setDone('Image uploaded');
              }
            },
            onClear: () => {
              currentInputs[input.name] = null;
              setReset();
            }
          });
          container.appendChild(picker.panel);
        };
        field.appendChild(uploadTrigger);
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

    const enhanceBtn = document.createElement('button');
    enhanceBtn.type = 'button';
    enhanceBtn.textContent = '✨ Enhance';
    enhanceBtn.className = 'mt-1.5 text-xs px-3 py-1 rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 transition';
    enhanceBtn.onclick = () => {
      const el = field.querySelector('textarea, input');
      if (el && el.value) {
        const enhancedValue = `${el.value}, cinematic style, professional quality, premium aesthetic`;
        el.value = enhancedValue;
        currentInputs[input.name] = enhancedValue;
        enhanceBtn.textContent = 'Enhanced ✓';
        enhanceBtn.classList.add('border-emerald-400/40', 'bg-emerald-500/15', 'text-emerald-200');
        setTimeout(() => {
          enhanceBtn.textContent = '✨ Enhance';
          enhanceBtn.classList.remove('border-emerald-400/40', 'bg-emerald-500/15', 'text-emerald-200');
        }, 2000);
      }
    };
    field.appendChild(enhanceBtn);

    if (isPrimaryPromptField) {
      const gtmBtn = document.createElement('button');
      gtmBtn.type = 'button';
      gtmBtn.textContent = '🎯 GTM Boost';
      gtmBtn.title = 'Enhance your prompt with GTM conversion frameworks';
      gtmBtn.setAttribute('aria-label', 'GTM Boost prompt enhancer');
      gtmBtn.className = 'gtm-boost-btn shrink-0';
      gtmBtn.addEventListener('click', () => {
        import('../lib/uiIntegration.js').then(({ openGTMPromptModal }) => {
          openGTMPromptModal('cinema-template-studio', (prompt) => {
            const ta = field.querySelector('textarea, input');
            if (ta) {
              ta.value = prompt;
              ta.dispatchEvent(new Event('input', { bubbles: true }));
              ta.focus();
            }
          });
        }).catch((err) => console.error('[CinemaTemplateStudio] GTM Boost failed:', err));
      });
      field.appendChild(gtmBtn);
    }

    // GTM Boost affordance for the primary user prompt field.
    // Mirrors ImageStudio / VideoStudio: shared `.gtm-boost-btn shrink-0` design,
    // themed via the `cinema-template-studio` app theme. Placed next to the main
    // prompt input (the primary describe/prompt field, not other per-input fields).
    if (isPrimaryPromptField) {
      // The editable element for this field is the last child appended above.
      const promptEl = field.querySelector('textarea, input');

      const gtmBtn = document.createElement('button');
      gtmBtn.type = 'button';
      gtmBtn.textContent = '🎯 GTM Boost';
      gtmBtn.title = 'Enhance your prompt with GTM conversion frameworks';
      gtmBtn.setAttribute('aria-label', 'GTM Boost prompt enhancer');
      gtmBtn.className = 'gtm-boost-btn shrink-0';
      gtmBtn.addEventListener('click', () => {
        import('../lib/uiIntegration.js').then(({ openGTMPromptModal }) => {
          openGTMPromptModal('cinema-template-studio', (prompt) => {
            const ta = promptEl || field.querySelector('textarea, input');
            if (ta) {
              ta.value = prompt;
              ta.dispatchEvent(new Event('input', { bubbles: true }));
              ta.focus();
            }
          });
        }).catch((err) => console.error('[CinemaTemplateStudio] GTM Boost failed:', err));
      });
      field.appendChild(gtmBtn);
    }

    return field;
  }

  // ================================
  // MODEL SELECTOR
  // ================================
  function renderModelSelector(formPanel) {
    const outputType = currentTemplate.outputType || (currentTemplate.modelType === 't2i' ? 'image' : 'video');

    if (outputType !== 'video' && currentTemplate.modelType !== 'i2i' && currentTemplate.modelType !== 't2i') return;

    const modelWrapper = document.createElement('div');
    modelWrapper.className = 'mt-6';

    let fallbackList = [];
    if (currentTemplate.modelType === 'i2i') fallbackList = i2iModels;
    else if (currentTemplate.modelType === 't2i') fallbackList = t2iModels;
    else fallbackList = i2vModels;

    let loadedModels = fallbackList;
    const getModelName = (id) => {
      const m = loadedModels.find(x => x.id === id) || fallbackList.find(x => x.id === id);
      return m ? m.name : id;
    };
    const getModel = (id) => loadedModels.find(x => x.id === id) || fallbackList.find(x => x.id === id);

    const triggerBtn = document.createElement('button');
    triggerBtn.type = 'button';
    triggerBtn.className = 'w-full flex items-center gap-3 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition';
    const updateTrigger = () => {
      const model = getModel(selectedModel);
      const provider = model?.provider || 'muapi';
      const logoUrl = PROVIDER_LOGOS[provider];
      const name = model ? model.name : getModelName(selectedModel);
      if (logoUrl) {
        triggerBtn.innerHTML = `<div class="w-5 h-5 rounded-md flex items-center justify-center overflow-hidden bg-white/5 shrink-0"><img src="${logoUrl}" alt="" class="w-full h-full object-contain ${invertLogos.includes(provider) ? 'invert' : ''}" /></div><span class="text-sm font-bold text-white truncate">${name}</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-muted shrink-0 ml-auto"><polyline points="6 9 12 15 18 9"/></svg>`;
      } else {
        const style = getProviderStyle(provider);
        triggerBtn.innerHTML = `<div class="w-5 h-5 bg-primary rounded-md flex items-center justify-center shadow-lg shadow-primary/20 shrink-0"><span class="text-[10px] font-black text-black">${style.text}</span></div><span class="text-sm font-bold text-white truncate">${name}</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-muted shrink-0 ml-auto"><polyline points="6 9 12 15 18 9"/></svg>`;
      }
    };
    updateTrigger();

    const dropdown = document.createElement('div');
    dropdown.className = 'fixed z-[100] bg-white/[0.04] border border-white/10 rounded-2xl shadow-3xl p-2 opacity-0 pointer-events-none transition-all duration-200 scale-95 origin-bottom-left';
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

    const openDropdown = () => {
      dropdown.classList.remove('opacity-0', 'pointer-events-none', 'scale-95');
      dropdown.classList.add('opacity-100', 'pointer-events-auto', 'scale-100');

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

        dropdown.innerHTML = `
          <div class="flex gap-4 h-full max-h-[70vh] min-h-[350px] overflow-hidden">
            <div data-provider-sidebar></div>
            <div class="flex-1 flex flex-col gap-2 min-w-0">
              <div data-search-bar></div>
              <div class="text-xs font-semibold text-secondary py-1 shrink-0 flex items-center justify-between">
                <span>Available models</span>
                <span data-provider-badge class="text-[10px] bg-white/5 px-2 py-0.5 rounded text-white/60 hidden"></span>
              </div>
              <div data-model-list class="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1"></div>
            </div>
          </div>
        `;

        const sidebarEl = dropdown.querySelector('[data-provider-sidebar]');
        const searchBarEl = dropdown.querySelector('[data-search-bar]');
        const modelListEl = dropdown.querySelector('[data-model-list]');
        const providerBadge = dropdown.querySelector('[data-provider-badge]');

        const showLoading = () => {
          modelListEl.innerHTML = `<div class="text-xs text-white/30 text-center py-6">Loading models...</div>`;
        };
        showLoading();

        const refresh = (models) => {
          const availableProviders = getAvailableProviders(models);
          sidebarEl.innerHTML = renderProviderSidebar(availableProviders, 'all', () => {});
          searchBarEl.innerHTML = renderSearchBar();
          const searchInput = searchBarEl.querySelector('[data-provider-search]');
          const showProviderName = true;
          modelListEl.innerHTML = renderModelList(models, selectedModel, showProviderName, (m) => {
            selectedModel = m.id;
            updateTrigger();
            closeDropdown();
          });

          if (searchInput) {
            searchInput.onclick = (e) => e.stopPropagation();
            searchInput.oninput = () => {
              const filtered = filterModels(models, searchInput.value, 'all');
              modelListEl.innerHTML = renderModelList(filtered, selectedModel, showProviderName, (m) => {
                selectedModel = m.id;
                updateTrigger();
                closeDropdown();
              });
            };
          }

          sidebarEl.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-provider]');
            if (!btn) return;
            e.stopPropagation();
            const provider = btn.getAttribute('data-provider');
            if (provider && provider !== 'all') {
              const filtered = filterModels(models, '', provider);
              modelListEl.innerHTML = renderModelList(filtered, selectedModel, false, (m) => {
                selectedModel = m.id;
                updateTrigger();
                closeDropdown();
              });
              const pName = availableProviders.find(p => p.id === provider)?.name || provider;
              providerBadge.textContent = pName;
              providerBadge.classList.remove('hidden');
            } else {
              modelListEl.innerHTML = renderModelList(models, selectedModel, showProviderName, (m) => {
                selectedModel = m.id;
                updateTrigger();
                closeDropdown();
              });
              providerBadge.classList.add('hidden');
            }
          });
        };

        const withTimeout = (promise, ms = 5000) => {
          return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Model catalog load timed out')), ms))
          ]);
        };

        withTimeout(getEnrichedModels(currentTemplate.modelType))
          .then(enriched => {
            const models = enriched && enriched.length > 0 ? enriched : fallbackList;
            loadedModels = models;
            refresh(models);
          })
          .catch(err => {
            console.warn('[CinemaTemplateStudio] Failed to load enriched model catalog, using fallback:', err);
            loadedModels = fallbackList;
            if (!fallbackList.find(x => x.id === selectedModel)) {
              selectedModel = fallbackList[0]?.id || selectedModel;
            }
            refresh(fallbackList);
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

    const modelLoadingStatus = document.createElement('span');
    modelLoadingStatus.id = 'model-loading-status';
    modelLoadingStatus.className = 'text-[10px] text-zinc-500';

    const headerRow = document.createElement('div');
    headerRow.className = 'mb-3';
    const label = document.createElement('div');
    label.className = 'text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 mb-2';
    label.textContent = 'Model';
    headerRow.appendChild(label);
    headerRow.appendChild(triggerBtn);
    headerRow.appendChild(modelLoadingStatus);
    modelWrapper.appendChild(headerRow);
    modelWrapper.appendChild(dropdown);
    formPanel.appendChild(modelWrapper);
  }

  // ================================
  // AI ENHANCER SECTION
  // ================================
  function renderAiEnhancer(formPanel) {
    const enhancerSection = document.createElement('div');
    enhancerSection.className = 'mt-6 rounded-2xl border border-emerald-400/15 bg-gradient-to-b from-emerald-500/10 to-indigo-500/5 p-4';
    enhancerSection.innerHTML = `
      <div class="flex items-center justify-between gap-4">
        <div>
          <div class="${CINEMATIC_THEME.text.sectionTitle} text-white">AI Enhancer</div>
          <div class="mt-1 text-xs leading-6 text-secondary">
            Keeps the simple template flow, but auto-detects niche, applies cinematic prompt expansion, scene logic, and cleanup in the background.
          </div>
        </div>
        <button id="enhancerToggle" class="relative h-7 w-12 rounded-full transition ${isAiEnhancer ? 'bg-emerald-400' : 'bg-white/10'}">
          <span class="absolute top-1 h-5 w-5 rounded-full bg-black transition ${isAiEnhancer ? 'left-6' : 'left-1'}" id="enhancerToggleKnob"></span>
        </button>
      </div>
      <button id="advancedToggle" class="mt-4 text-sm font-medium text-emerald-200 transition hover:text-emerald-100">
        ${showAdvanced ? 'Hide Advanced Controls' : 'Show Advanced Controls'}
      </button>
      <div id="advancedControls" class="mt-5 grid gap-4 md:grid-cols-2 ${showAdvanced ? '' : 'hidden'}"></div>
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
          <div class="mb-3">
            <div class="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 mb-1.5">${field.label}</div>
            <select class="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition focus:border-emerald-400/50 appearance-none cursor-pointer" data-advanced-field="${field.name}">
              ${field.options.map(opt => `<option value="${opt}" class="bg-zinc-950 text-white">${opt}</option>`).join('')}
            </select>
          </div>
        `;
      } else {
        wrapper.innerHTML = `
          <div class="mb-3 flex items-center justify-between gap-3">
            <div class="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">${field.label}</div>
            <button class="enhancer-btn rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] transition border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white" data-field="${field.name}">✨ Enhance</button>
          </div>
          <input type="text" class="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition focus:border-emerald-400/50" placeholder="${field.placeholder || ''}" data-advanced-field="${field.name}" />
        `;
      }
      advancedControls.appendChild(wrapper);
    });

    const extraWrapper = document.createElement('div');
    extraWrapper.className = 'md:col-span-2';
    extraWrapper.innerHTML = `
      <div class="mb-3 flex items-center justify-between gap-3">
        <div class="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Extra Instructions</div>
        <button class="enhancer-btn rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] transition border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white" data-field="extraInstructions">✨ Enhance</button>
      </div>
      <textarea class="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400/50 resize-none" rows="4" placeholder="optional cinematic instructions" data-advanced-field="extraInstructions"></textarea>
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
    intelligenceSection.className = 'mt-6 rounded-2xl border border-white/10 bg-white/5 p-5';
    intelligenceSection.innerHTML = `
      <h2 class="${CINEMATIC_THEME.text.sectionTitle} text-white">Creative Intelligence</h2>
      <p class="mt-2 mb-5 text-sm text-secondary">These tiles show the cinematic structure, creative direction, and visual strategy this template will use.</p>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="rounded-xl border border-white/10 bg-white/5 p-4 hover:border-blue-400/20 transition">
          <div class="mb-3 text-2xl">🏷️</div>
          <h3 class="text-sm font-bold text-white mb-2">Auto-Detected Niche</h3>
          <textarea class="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-relaxed text-white/80 outline-none transition focus:border-emerald-400/50 resize-none" rows="3" data-tile="niche">${currentInputs.niche || 'general-business'}</textarea>
        </div>
        <div class="rounded-xl border border-white/10 bg-white/5 p-4 hover:border-violet-400/20 transition">
          <div class="mb-3 text-2xl">🎬</div>
          <h3 class="text-sm font-bold text-white mb-2">Scene Structure</h3>
          <textarea class="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-relaxed text-white/80 outline-none transition focus:border-emerald-400/50 resize-none" rows="3" data-tile="scene">${getSceneBeats(currentTemplate).join(' → ')}</textarea>
        </div>
        <div class="rounded-xl border border-white/10 bg-white/5 p-4 hover:border-emerald-400/20 transition">
          <div class="mb-3 text-2xl">🎥</div>
          <h3 class="text-sm font-bold text-white mb-2">Cinematic Enrichment</h3>
          <textarea class="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-relaxed text-white/80 outline-none transition focus:border-emerald-400/50 resize-none" rows="3" data-tile="cinematic">Dynamic camera movement, shallow depth of field, professional lighting</textarea>
        </div>
        <div class="rounded-xl border border-white/10 bg-white/5 p-4 hover:border-amber-400/20 transition">
          <div class="mb-3 text-2xl">⚙️</div>
          <h3 class="text-sm font-bold text-white mb-2">Visual Style</h3>
          <textarea class="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-relaxed text-white/80 outline-none transition focus:border-emerald-400/50 resize-none" rows="3" data-tile="style">Polished, cinematic, high-contrast, premium aesthetic</textarea>
        </div>
        <div class="md:col-span-2 rounded-xl border border-white/10 bg-white/5 p-4 hover:border-rose-400/20 transition">
          <div class="mb-3 text-2xl">✨</div>
          <h3 class="text-sm font-bold text-white mb-2">Enhancer Keywords</h3>
          <textarea class="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-relaxed text-white/80 outline-none transition focus:border-emerald-400/50 resize-none" rows="4" data-tile="keywords">cinematic, professional, 4K, high quality, premium</textarea>
        </div>
      </div>
    `;
    formPanel.appendChild(intelligenceSection);

    setTimeout(() => {
      intelligenceSection.querySelectorAll('textarea[data-tile]').forEach(ta => {
        ta.oninput = () => {
          const tileName = ta.dataset.tile;
          if (tileName) {
            currentInputs[tileName] = ta.value;
          }
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
    outputSection.className = 'mt-6 rounded-2xl border border-white/10 bg-white/5 p-5';

    const tabRow = document.createElement('div');
    tabRow.className = 'mb-4 flex flex-wrap gap-2';
    tabRow.id = 'outputTabs';
    outputTabs.forEach(tab => {
      const tabBtn = document.createElement('button');
      tabBtn.className = `rounded-full px-2 py-1.5 text-[11px] font-medium transition ${tab === activeTab ? 'border border-emerald-400/30 bg-emerald-500/12 text-emerald-100' : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'}`;
      tabBtn.textContent = tab;
      tabBtn.onclick = () => {
        activeTab = tab;
        document.querySelectorAll('#outputTabs button').forEach(b => {
          b.className = `rounded-full px-2 py-1.5 text-[11px] font-medium transition ${b.textContent === activeTab ? 'border border-emerald-400/30 bg-emerald-500/12 text-emerald-100' : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'}`;
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
    outputContent.className = 'rounded-xl border border-white/10 bg-black/40 p-4';
    outputContent.innerHTML = `
      <div class="mb-3 flex items-center justify-between gap-3">
        <div class="text-xs uppercase tracking-[0.18em] text-secondary">Editable Output</div>
        <button id="wandBtn" class="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/12 text-emerald-200 transition hover:bg-emerald-500/18" title="Enhance with AI">✨</button>
      </div>
      <textarea id="outputTextarea" class="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-7 text-white/80 outline-none transition focus:border-emerald-400/50 resize-none" rows="12">Click Generate to create an enhanced prompt...</textarea>
      <div id="promptLengthCounter" class="mt-2 text-[11px] text-zinc-500 flex items-center justify-between"></div>
      <button id="resetPromptBtn" class="mt-2 hidden w-full py-2 text-xs font-semibold text-zinc-400 border border-white/10 rounded-xl hover:bg-white/5 hover:text-white transition-colors" title="Reset to auto-generated prompt">↩ Reset to auto-generated prompt</button>
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
          const current = lastBuiltPrompt || textarea.value || '';
          const enhanced = `${current}, cinematic quality, professional lighting, high detail, 4K resolution`.trim();
          lastBuiltPrompt = enhanced;
          outputTabValues['Enhanced Prompt'] = enhanced;
          textarea.value = enhanced;
          textarea.classList.add('border-emerald-400/50');
          setTimeout(() => textarea.classList.remove('border-emerald-400/50'), 1000);
          updatePromptLengthCounter(enhanced);
          updateResetButtonVisibility();
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
    const gtmBoostBtn = document.createElement('button');
    gtmBoostBtn.type = 'button';
    gtmBoostBtn.textContent = '🎯 GTM Boost';
    gtmBoostBtn.title = 'Enhance your prompt with GTM conversion frameworks';
    gtmBoostBtn.setAttribute('aria-label', 'GTM Boost prompt enhancer');
    gtmBoostBtn.className = 'w-full mt-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-400 text-black font-bold text-sm rounded-xl hover:opacity-90 transition';
    formPanel.appendChild(gtmBoostBtn);

    setTimeout(() => {
      if (gtmBoostBtn) {
        gtmBoostBtn.onclick = async () => {
          try {
            const ctx = (await import('../lib/uiIntegration.js').then(m => m.fetchGTMTemplateContext(currentTemplate)).catch(() => null)) || {};
            const basePrompt = (document.getElementById('outputTextarea')?.value) || currentTemplate.description || '';
            const templateContext = {
              ...ctx,
              basePrompt,
              templateId: currentTemplate.id,
              category: currentTemplate.category,
              niche: currentTemplate.niche,
              outputType: currentTemplate.outputType,
            };
            import('../lib/uiIntegration.js').then(({ openGTMPromptModal }) => {
              openGTMPromptModal('cinema-template-studio', {
                templateContext,
                onPromptGenerated: (text) => {
                  lastBuiltPrompt = text;
                  outputTabValues['Enhanced Prompt'] = text;
                  const ta = document.getElementById('outputTextarea');
                  if (ta) {
                    ta.value = text;
                    ta.dispatchEvent(new Event('input', { bubbles: true }));
                    ta.dispatchEvent(new Event('change', { bubbles: true }));
                  }
                  const primaryPromptField = formPanel.querySelector('[name="prompt"]') || formPanel.querySelector('textarea, input');
                  if (primaryPromptField) {
                    primaryPromptField.value = text;
                  }
                }
              });
            }).catch((e) => {
              console.warn('[CinemaTemplateStudio] GTM Boost modal load failed:', e);
            });
          } catch (e) {
            console.warn('[CinemaTemplateStudio] GTM Boost failed:', e);
          }
        };
      }
    }, 0);
  }

  // ================================
  // GENERATE BUTTON + EVENT WIRING
  // ================================
  function renderGenerateButton(formPanel) {
    const genBtn = document.createElement('button');
    genBtn.type = 'button';
    genBtn.id = 'generate-btn';
    genBtn.className = 'w-full py-3 bg-primary text-black font-black text-sm rounded-xl hover:scale-[1.02] transition-transform flex items-center justify-center gap-2';
    genBtn.innerHTML = '<span>✨</span> Generate Video';
    genBtn.setAttribute('aria-label', 'Generate video');
    formPanel.appendChild(genBtn);

    genBtn.onclick = () => {
      generateVideo();
    };

    // Enhancer buttons
    setTimeout(() => {
      document.querySelectorAll('.enhancer-btn').forEach(btn => {
        btn.onclick = () => {
          const fieldName = btn.dataset.field;
          if (!fieldName) return;
          const input = document.querySelector(`[data-advanced-field="${fieldName}"]`);
          if (input && input.value) {
            const enhancedValue = `${input.value}, cinematic style, professional quality, premium aesthetic`;
            input.value = enhancedValue;
            currentInputs[fieldName] = enhancedValue;
            btn.classList.add('border-emerald-400/40', 'bg-emerald-500/15', 'text-emerald-200');
            btn.textContent = 'Enhanced ✓';
            setTimeout(() => {
              btn.classList.remove('border-emerald-400/40', 'bg-emerald-500/15', 'text-emerald-200');
              btn.textContent = '✨ Enhance';
            }, 2000);
          }
        };
      });

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
          advancedBtn.textContent = showAdvanced ? 'Hide Advanced Controls' : 'Show Advanced Controls';
          advControls.className = showAdvanced ? 'mt-5 grid gap-4 md:grid-cols-2' : 'mt-5 grid gap-4 md:grid-cols-2 hidden';
        };
      }
    }, 0);
  }

  // ================================
  // GENERATE VIDEO
  // ================================
  function generateVideo() {
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
    const imageUrl = currentInputs.image_url || currentInputs.referenceImage || null;

    let model = selectedModel;
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
      lastBuiltPrompt = prompt;
    }

    const negNiche = (currentInputs.niche && currentInputs.niche !== 'auto-detect') ? currentInputs.niche : (currentTemplate.niche || '');

    if (isAiEnhancer) {
      prompt = enrichPromptString(prompt, {
        niche: negNiche,
        visualStyle: currentInputs.visualStyle || 'commercial',
        filmType: currentTemplate.filmFamily || undefined
      });
      lastBuiltPrompt = prompt;
    }

    promptManuallyEdited = false;

    if (prompt.length > 6000) {
      showToast(`Prompt is ${prompt.length.toLocaleString()} characters — this may exceed model limits. Consider shortening.`, 'warning');
    }

    const negativePrompt = composeNegativePrompt(currentTemplate.filmFamily || undefined, negNiche, currentInputs.visualStyle || 'commercial') || 'Low quality, blurry, amateur, poorly lit, generic stock look';

    const params = {
      model,
      prompt,
      studioType: 'cinema-template',
    };

    if (isVideo) {
      params.aspect_ratio = currentInputs.aspectRatio || currentTemplate.aspectRatios?.[0] || '16:9';
      const duration = currentTemplate.duration;
      if (duration) {
        let rawDuration = typeof duration === 'object' ? duration.default : duration;
        // The MuAPI video endpoint only accepts 5 or 10 seconds.
        // Clamp template durations to the nearest supported value.
        params.duration = rawDuration <= 5 ? 5 : 10;
      }
    } else {
      params.aspect_ratio = currentInputs.aspectRatio || '16:9';
    }

    if (imageUrl) {
      params.image_url = imageUrl;
    }

    if (negativePrompt) {
      params.negative_prompt = negativePrompt;
    }

    if (customThumbnailUrl) {
      params.thumbnail_url = customThumbnailUrl;
    }

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
    } catch { /* ignore */ }

    runGeneration(params);
  }

  async function runGeneration(params) {
    if (isGenerating) return;

    isGenerating = true;
    let genBtn = container.querySelector('#generate-btn');
    if (genBtn) {
      genBtn.disabled = true;
      genBtn.innerHTML = '<span class="animate-spin inline-block mr-2">&#9711;</span> Generating...';
    }

    try {
      let result;
      const isVideo = currentTemplate.outputType === 'video';
      const hasImageUrl = !!params.image_url;

      if (isVideo && hasImageUrl) {
        result = await muapi.generateI2V(params);
      } else if (isVideo) {
        result = await muapi.generateVideo(params);
      } else {
        result = await muapi.generateImage(params);
      }

      if (result && result.url) {
        generationResult = result.url;
        customThumbnailUrl = result.url;
        try {
          sessionStorage.setItem('cinematic_generation_result', result.url);
        } catch { /* ignore */ }
        saveToHistory(result.url, params.prompt, params.model, currentTemplate.id);
        retryCount = 0;
        view = 'preview';
        render();
      } else {
        throw new Error('No output URL returned');
      }
    } catch (err) {
      console.error('[CinemaTemplateStudio]', err);
      const message = err.message || 'Generation failed';
      const userMessage = message.length > 80 ? 'Generation failed. Please try again.' : message;

      const errEl = document.createElement('div');
      errEl.className = 'mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200';
      errEl.textContent = userMessage;

      if (retryCount < MAX_RETRIES && lastGenerationParams) {
        const retryBtn = document.createElement('button');
        retryBtn.id = 'retry-btn';
        retryBtn.className = 'ml-2 underline text-emerald-200 hover:text-white';
        retryBtn.textContent = 'Retry';
        retryBtn.onclick = () => {
          retryCount++;
          if (errEl && errEl.parentNode) errEl.remove();
          runGeneration(lastGenerationParams);
        };
        errEl.appendChild(retryBtn);
      }

      const target = container.querySelector('#generate-btn') || container;
      target.insertAdjacentElement('afterend', errEl);

      isGenerating = false;
      if (genBtn) {
        genBtn.innerHTML = '<span>✨</span> Generate Video';
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
      genBtn.innerHTML = '<span>✨</span> Generate Video';
      genBtn.disabled = false;
    }
  }

  function saveToHistory(url, prompt, model, templateId) {
    try {
      const history = JSON.parse(localStorage.getItem('muapi_history') || '[]');
      history.unshift({
        id: Date.now().toString(),
        url,
        prompt,
        model: model || selectedModel,
        template: templateId || (currentTemplate ? currentTemplate.id : ''),
        timestamp: new Date().toISOString(),
      });
      localStorage.setItem('muapi_history', JSON.stringify(history.slice(0, 100)));
    } catch { /* ignore */ }
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
    preview.className = 'flex-1 flex flex-col items-center justify-center p-8';

    const resultImg = document.createElement('img');
    resultImg.src = generationResult || '';
    resultImg.className = 'max-w-full max-h-[60vh] rounded-xl border border-white/10';
    resultImg.alt = 'Generated result';

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

    preview.appendChild(resultImg);
    preview.appendChild(actions);
    container.appendChild(preview);
  }

  return container;
}
