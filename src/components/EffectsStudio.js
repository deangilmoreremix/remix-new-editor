import { muapi } from '../lib/muapi.js';
import { saveGeneration } from '../lib/generationHistory.js';
import { openSocialPublish } from '../lib/socialPublishHelpers.js';
import { addCaptionButton } from '../lib/editor/captionActions.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { AuthModal } from './AuthModal.js';
import { createUploadPicker } from './UploadPicker.js';
import { createMediaPreview } from './MediaPreview.js';
import { MediaDetailView } from './MediaDetailView.js';
import { createInlineInstructions } from './InlineInstructions.js';
import { i2iModels, i2vModels } from '../lib/models.js';
import { createHeroSection, getCustomThumbnailFromCache, saveCustomThumbnailToCache, clearCustomThumbnailCache } from '../lib/thumbnails.js';
import { mountPersonalizeTrigger, replaceTokensInPrompt } from './personalize/personalizePopover.js';
import { TemplateThumbnailModal, mountThumbnailModal } from './modals/TemplateThumbnailModal.jsx';
import { requireEntitlement } from '../lib/clerkEntitlements.js';
import { navigate } from '../lib/router.js';
import { saveGeneratedAsset } from '../lib/assets/assetActions.js';
import { showToast } from '../lib/loading.js';
import { validateEffectParams, EFFECT_PARAM_SCHEMA, createSliderControl, createAdvancedSection } from '../lib/effectParamValidator.js';
import { EffectCompositor } from '../lib/editor/effectCompositor.js';
import { getAssetsForStudio } from '../data/exampleGalleryAssets.js';
import ExampleGallery from './studios/ExampleGallery.js';
import { resolveTemplate, loadTemplatePrompt } from '../lib/showcaseTemplateResolver.js';
import { getAcademyCreateTarget } from '../data/academyStudioAdapters.js';
import { openPromptGallery } from '../lib/promptGalleryIntegration.js';
import { openRecipeModal } from '../lib/recipeIntegration.js';
import { openMonetizationHub } from '../lib/monetizationIntegration.js';
import { openModelPicker } from '../lib/modelPickerIntegration.js';

const EFFECT_TABS = [
  { id: 'image-effects', label: 'Image Effects', type: 'i2i', field: 'name' },
  { id: 'nano-banana-effects', label: 'Nano Banana', type: 'i2i', field: 'name' },
  { id: 'flux-kontext-effects', label: 'Kontext Effects', type: 'i2i', field: 'name' },
  { id: 'ai-video-effects', label: 'Video Effects', type: 'i2v', field: 'name' },
  { id: 'motion-controls', label: 'Motion Controls', type: 'i2v', field: 'name' },
  { id: 'video-effects', label: 'Video FX v2', type: 'i2v', field: 'name' },
];

function getEffectsForModel(modelId) {
  const allModels = [...i2iModels, ...i2vModels];
  const model = allModels.find(m => m.id === modelId);
  if (!model) return [];
  const nameField = model.inputs?.name;
  if (nameField?.enum) return nameField.enum;
  return [];
}

export async function EffectsStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col bg-app-bg overflow-hidden relative';
  mountStudioChrome(container, { currentRoute: 'effects' });

  let activeTab = EFFECT_TABS[0];
  let selectedEffect = null;
  let uploadedUrl = null;
  let customThumbnailUrl = getCustomThumbnailFromCache('effects-studio');
  let comparisonMode = false;
  let lastResultUrl = null;
  let lastResultType = null;
  let lastInputUrl = null;

  // Read gallery / deep-link params and apply them as studio defaults.
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const templateParam = urlParams.get('template');
    const academyParam = urlParams.get('academy-template');
    const promptParam = urlParams.get('prompt');
    const styleParam = urlParams.get('style');
    const arParam = urlParams.get('aspect_ratio');
    const durationParam = urlParams.get('duration');

    if (templateParam) {
      const tpl = resolveTemplate(templateParam);
      if (tpl) {
        if (tpl.model) { activeTab = EFFECT_TABS.find(t => t.id === tpl.model) || activeTab; }
        if (tpl.aspectRatio) { /* set aspect ratio */ }
        if (tpl.duration) { /* set duration */ }
        if (tpl.basePrompt) {
          const ta = document.getElementById('fx-prompt-input');
          if (ta) ta.value = tpl.basePrompt;
        } else if (tpl.slug) {
          loadTemplatePrompt(templateParam).then((prompt) => {
            if (prompt) {
              const ta = document.getElementById('fx-prompt-input');
              if (ta) ta.value = prompt;
            }
          }).catch(() => {});
        }
      }
    }

    if (academyParam || promptParam) {
      const target = academyParam ? getAcademyCreateTarget(academyParam) : null;
      const params = target?.params || {};
      if (params.prompt) {
        const ta = document.getElementById('fx-prompt-input');
        if (ta) ta.value = params.prompt;
      }
      if (params.aspect_ratio) { /* set aspect ratio */ }
      if (params.duration) { /* set duration */ }
    }
  } catch { /* ignore */ }

  // ─── Advanced generation controls ────────────────────────────────────
  const ADVANCED_STORAGE_KEY = 'effects_studio_advanced_settings';
  const advancedDefaults = {
    guidanceScale: 7.5,
    steps: 20,
    seed: -1,       // -1 = random
    negativePrompt: '',
    denoiseStrength: 0.7,
    effectStrength: 1.0,
    cfgScale: 0.5,
  };

  let advancedSettings = loadAdvancedSettings();

  function loadAdvancedSettings() {
    try {
      const raw = localStorage.getItem(ADVANCED_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...advancedDefaults, ...parsed };
      }
    } catch { /* ignore */ }
    return { ...advancedDefaults };
  }

  function saveAdvancedSettings() {
    try {
      localStorage.setItem(ADVANCED_STORAGE_KEY, JSON.stringify(advancedSettings));
    } catch { /* ignore quota errors */ }
  }

  const topBar = document.createElement('div');
  topBar.className = 'px-4 md:px-8 pt-6 pb-4 shrink-0';
  const effectsBanner = createHeroSection('effects', 'h-32 md:h-44 mb-4');
  if (effectsBanner) {
    const bannerText = document.createElement('div');
    bannerText.className = 'absolute bottom-0 left-0 right-0 p-4 z-10';
    bannerText.innerHTML = '<h1 class="text-2xl md:text-3xl font-black text-white tracking-tight mb-1">Effects Studio</h1><p class="text-white/60 text-xs">Apply 350+ visual effects to your photos and videos</p>';
    effectsBanner.appendChild(bannerText);
    topBar.appendChild(effectsBanner);

    // Thumbnail studio button
    const thumbBtn = document.createElement('button');
    thumbBtn.type = 'button';
    thumbBtn.textContent = '🖼 Thumbnail';
    thumbBtn.title = 'Generate a custom thumbnail';
    thumbBtn.className = 'absolute top-3 right-3 z-20 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:from-violet-400 hover:to-indigo-400 transition-all shadow-lg shadow-violet-500/25';
    thumbBtn.onclick = () => {
      const modal = new TemplateThumbnailModal({
        studioId: 'effects-studio',
        layout: 'panel',
        studioLabel: 'Effects Studio',
        accentGradient: 'from-violet-500 to-indigo-500',
      });
      mountThumbnailModal(modal);
    };
  } else {
    topBar.innerHTML = '<h1 class="text-2xl md:text-3xl font-black text-white tracking-tight mb-1">Effects Studio</h1><p class="text-secondary text-xs mb-4">Apply 350+ visual effects to your photos and videos</p>';
  }

  const tabRow = document.createElement('div');
  tabRow.className = 'flex gap-2 overflow-x-auto no-scrollbar pb-2';

  const tabButtons = {};
  EFFECT_TABS.forEach(tab => {
    const btn = document.createElement('button');
    const count = getEffectsForModel(tab.id).length;
    btn.className = 'px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all';
    btn.textContent = `${tab.label} (${count})`;
    btn.onclick = () => switchTab(tab);
    tabButtons[tab.id] = btn;
    tabRow.appendChild(btn);
  });
  // Model Picker button
  const modelPickerBtn = document.createElement('button');
  modelPickerBtn.type = 'button';
  modelPickerBtn.textContent = 'AI Pick';
  modelPickerBtn.title = 'Open intelligent model picker';
  modelPickerBtn.setAttribute('aria-label', 'Open model picker');
  modelPickerBtn.className = 'text-[11px] font-bold text-cyan-400 border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1.5 rounded-lg hover:bg-cyan-400/20 transition-colors ml-2 whitespace-nowrap';
  modelPickerBtn.addEventListener('click', () => {
    openModelPicker({
      currentModelId: activeTab.id,
      onSelectModel: (id) => {
      const tab = EFFECT_TABS.find(t => t.id === id);
      if (tab) switchTab(tab);
      }
    }).catch((err) => console.error('[ModelPicker] open failed:', err));
  });
  tabRow.appendChild(modelPickerBtn);

  topBar.appendChild(tabRow);

  const inlineInstructions = createInlineInstructions('effects');
  inlineInstructions.classList.add('mt-2');
  topBar.appendChild(inlineInstructions);

  container.appendChild(topBar);

  const bodyArea = document.createElement('div');
  bodyArea.className = 'flex flex-1 overflow-hidden';

  const effectsPanel = document.createElement('div');
  effectsPanel.className = 'w-full md:w-[340px] lg:w-[400px] shrink-0 overflow-y-auto px-4 md:px-6 pb-6 md:border-r border-white/5';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search effects...';
  searchInput.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors mb-3';
  effectsPanel.appendChild(searchInput);

  const effectsGrid = document.createElement('div');
  effectsGrid.className = 'grid grid-cols-2 gap-2';
  effectsPanel.appendChild(effectsGrid);

  const previewPanel = document.createElement('div');
  previewPanel.className = 'hidden md:flex flex-1 flex-col overflow-y-auto';

  const previewTop = document.createElement('div');
  previewTop.className = 'p-4 lg:p-6 flex flex-col gap-4 flex-1';

  const previewHeader = document.createElement('div');
  previewHeader.className = 'flex items-center justify-between';
  previewHeader.innerHTML = '<div class="text-xs font-bold text-secondary uppercase tracking-wider">Preview</div>';

  const headerActions = document.createElement('div');
  headerActions.className = 'flex items-center gap-2';

  const compareBtn = document.createElement('button');
  compareBtn.type = 'button';
  compareBtn.className = 'px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white/5 border border-white/10 text-secondary hover:text-white hover:border-white/20 transition-all';
  compareBtn.textContent = '⟺ Compare';
  compareBtn.title = 'Toggle side-by-side comparison';
  compareBtn.onclick = () => {
    comparisonMode = !comparisonMode;
    compareBtn.classList.toggle('bg-primary/20', comparisonMode);
    compareBtn.classList.toggle('border-primary/40', comparisonMode);
    compareBtn.classList.toggle('text-primary', comparisonMode);
    updateComparisonView();
  };
  headerActions.appendChild(compareBtn);
  previewHeader.appendChild(headerActions);

  const selectedBadge = document.createElement('div');
  selectedBadge.className = 'text-xs font-bold text-muted';
  selectedBadge.textContent = 'No effect selected';
  previewHeader.appendChild(selectedBadge);
  previewTop.appendChild(previewHeader);

  const splitRow = document.createElement('div');
  splitRow.className = 'flex gap-4 flex-1 min-h-0';

  const inputCol = document.createElement('div');
  inputCol.className = 'flex-1 flex flex-col gap-3 min-w-0';
  const inputLabel = document.createElement('div');
  inputLabel.className = 'text-[10px] font-bold text-muted uppercase tracking-wider';
  inputLabel.textContent = 'Input';
  inputCol.appendChild(inputLabel);

  const inputPreview = createMediaPreview({ maxHeight: '40vh', showDownload: false, showMeta: true, onClear: () => {
    uploadedUrl = null;
    inputPreview.clear();
  }});
  inputCol.appendChild(inputPreview.element);

  const uploadRow = document.createElement('div');
  uploadRow.className = 'flex items-center gap-3';

  const picker = createUploadPicker({
    anchorContainer: container,
    acceptVideo: true,
    onFilePreview: (file) => {
      inputPreview.loadFile(file);
    },
    onSelect: ({ url }) => {
      uploadedUrl = url;
      inputPreview.load(url, { filename: 'Uploaded media' });
    },
    onClear: () => {
      uploadedUrl = null;
      inputPreview.clear();
    },
  });
  uploadRow.appendChild(picker.trigger);

  const pexelsBtn = document.createElement('button');
  pexelsBtn.type = 'button';
  pexelsBtn.className = 'w-10 h-10 shrink-0 rounded-xl border transition-all flex items-center justify-center bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40 group relative overflow-hidden';
  pexelsBtn.title = 'Browse stock photos from Pexels';
  pexelsBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-secondary group-hover:text-primary"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>';
  pexelsBtn.onclick = async () => {
    const { browsePexelsImages } = await import('../lib/studioPexels.js');
    browsePexelsImages({
      title: 'Select Reference Photo',
      studioName: 'Effects Studio',
      onSelect: (asset) => {
        uploadedUrl = asset.src?.large || asset.url || asset.original;
        inputPreview.load(asset.src?.large || asset.url || asset.original, { filename: 'Pexels image' });
        const attrContainer = document.getElementById('pexels-effects-attribution');
        if (attrContainer) {
          attrContainer.innerHTML = '';
          import('../lib/attributionChip.js').then(mod => mod.renderAttributionChip(asset, attrContainer));
        }
      }
    });
  };
  uploadRow.appendChild(pexelsBtn);

  container.appendChild(picker.panel);

  const uploadHint = document.createElement('span');
  uploadHint.className = 'text-xs text-muted';
  uploadHint.textContent = 'Upload image or video';
  uploadRow.appendChild(uploadHint);
  inputCol.appendChild(uploadRow);

  const pexelsEffectsAttr = document.createElement('div');
  pexelsEffectsAttr.id = 'pexels-effects-attribution';
  pexelsEffectsAttr.className = 'mt-1';
  inputCol.appendChild(pexelsEffectsAttr);

  const outputCol = document.createElement('div');
  outputCol.className = 'flex-1 flex flex-col gap-3 min-w-0';
  outputCol.setAttribute('role', 'status');
  outputCol.setAttribute('aria-live', 'polite');
  const outputLabel = document.createElement('div');
  outputLabel.className = 'text-[10px] font-bold text-muted uppercase tracking-wider';
  outputLabel.textContent = 'Output';
  outputCol.appendChild(outputLabel);

  const outputPreview = createMediaPreview({ maxHeight: '40vh', showDownload: true, showMeta: true, onClear: () => outputPreview.clear() });
  outputCol.appendChild(outputPreview.element);

  const outputActions = document.createElement('div');
  outputActions.className = 'flex items-center gap-2 flex-wrap';

  const downloadActionBtn = document.createElement('button');
  downloadActionBtn.type = 'button';
  downloadActionBtn.className = 'btn-secondary-modern flex-1 min-w-[100px] px-3 py-2 rounded-xl text-[10px] font-bold transition-all active:scale-95';
  downloadActionBtn.textContent = '↓ Download';
  downloadActionBtn.title = 'Download result';
  downloadActionBtn.onclick = () => {
    const url = outputPreview.getUrl();
    if (!url) { showToast('No result to download', 'warning'); return; }
    const a = document.createElement('a');
    a.href = url;
    a.download = `fx-${selectedEffect || 'result'}-${Date.now()}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Download started', 'success');
  };
  outputActions.appendChild(downloadActionBtn);

  const addToLibraryBtn = document.createElement('button');
  addToLibraryBtn.type = 'button';
  addToLibraryBtn.className = 'flex-1 min-w-[100px] bg-white/10 hover:bg-white/20 border border-white/10 text-white px-3 py-2 rounded-xl text-[10px] font-bold transition-all active:scale-95';
  addToLibraryBtn.textContent = '＋ Add to Library';
  addToLibraryBtn.title = 'Save to media library';
  addToLibraryBtn.onclick = async () => {
    const url = outputPreview.getUrl();
    if (!url) { showToast('No result to save', 'warning'); return; }
    try {
      const type = lastResultType === 'video' ? 'video' : 'image';
      const asset = await saveGeneratedAsset(type, {
        title: `${selectedEffect || 'FX'} result`,
        media: { url, type },
        metadata: { effect: selectedEffect, model: activeTab.id, prompt: promptInput.value.trim() },
        sourceApp: 'effects-studio',
      }, 'effects-studio');
      showToast('Added to media library', 'success');
    } catch (err) {
      console.error('[EffectsStudio] Failed to save asset:', err);
      showToast('Failed to add to library', 'error');
    }
  };
  outputActions.appendChild(addToLibraryBtn);

  const insertTimelineBtn = document.createElement('button');
  insertTimelineBtn.type = 'button';
  insertTimelineBtn.className = 'flex-1 min-w-[100px] bg-white/10 hover:bg-white/20 border border-white/10 text-white px-3 py-2 rounded-xl text-[10px] font-bold transition-all active:scale-95';
  insertTimelineBtn.textContent = '⏱ Insert into Timeline';
  insertTimelineBtn.title = 'Add to timeline';
  insertTimelineBtn.onclick = async () => {
    const url = outputPreview.getUrl();
    if (!url) { showToast('No result to insert', 'warning'); return; }
    try {
      const type = lastResultType === 'video' ? 'video' : 'image';
      const asset = await saveGeneratedAsset(type, {
        title: `${selectedEffect || 'FX'} result`,
        media: { url, type },
        metadata: { effect: selectedEffect, model: activeTab.id, prompt: promptInput.value.trim() },
        sourceApp: 'effects-studio',
      }, 'effects-studio');
      navigate('timeline', { asset: asset.id });
      showToast('Inserting into timeline...', 'success');
    } catch (err) {
      console.error('[EffectsStudio] Failed to insert into timeline:', err);
      showToast('Failed to insert into timeline', 'error');
    }
  };
  outputActions.appendChild(insertTimelineBtn);

  const captionActionBtn = document.createElement('button');
  captionActionBtn.type = 'button';
  captionActionBtn.className = 'flex-1 min-w-[100px] bg-white/10 hover:bg-white/20 border border-white/10 text-white px-3 py-2 rounded-xl text-[10px] font-bold transition-all active:scale-95 hidden';
  captionActionBtn.textContent = '💬 Add AI Captions';
  captionActionBtn.title = 'Add AI captions to this video';
  captionActionBtn.onclick = () => {
    if (lastResultType !== 'video' || !lastResultUrl) return;
    addCaptionButton({
      videoUrl: lastResultUrl,
      appTheme: 'effects-studio',
      onComplete: (captionedUrl) => {
        lastResultUrl = captionedUrl;
        outputPreview.load(captionedUrl, { type: 'video', model: activeTab.label, filename: `${selectedEffect || 'fx'}-${Date.now()}` });
        mobileOutputPreview.load(captionedUrl, { type: 'video' });
        updateComparisonView();
      },
    });
  };
  outputActions.appendChild(captionActionBtn);

  outputCol.appendChild(outputActions);

  splitRow.appendChild(inputCol);
  splitRow.appendChild(outputCol);
  previewTop.appendChild(splitRow);

  const promptRow = document.createElement('div');
  promptRow.className = 'flex items-center gap-3';
  const promptInput = document.createElement('input');
  promptInput.id = 'fx-prompt-input';
  promptInput.type = 'text';
  promptInput.placeholder = 'Optional prompt...';
  promptInput.className = 'flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors';
  promptInput.setAttribute('aria-label', 'Effect prompt');
  promptRow.appendChild(promptInput);

  // Thumbnail studio button — next to creation controls, GTM Boost styling
  const thumbBtn = document.createElement('button');
  thumbBtn.type = 'button';
  thumbBtn.textContent = '🖼 Thumbnail';
  thumbBtn.title = 'Generate a custom thumbnail';
  thumbBtn.className = 'btn-ghost-modern';
  thumbBtn.addEventListener('click', () => {
    const modal = new TemplateThumbnailModal({
      appTheme: 'effects-studio',
      layout: 'panel',
      studioId: 'effects-studio',
      studioName: 'Effects Studio',
      aspectRatio: '16:9',
      outputType: 'image',
      onApply: ({ imageUrl }) => {
        customThumbnailUrl = imageUrl;
        saveCustomThumbnailToCache('effects-studio', imageUrl);
      },
      onClear: () => {
        customThumbnailUrl = null;
        clearCustomThumbnailCache('effects-studio');
      },
    });
    mountThumbnailModal(modal);
    modal.open();
  });
  promptRow.appendChild(thumbBtn);

  const generateBtn = document.createElement('button');
generateBtn.type = 'button';
  generateBtn.className = 'btn-primary-modern px-[14px] py-2 min-h-[40px] text-[13px] font-bold rounded-2xl inline-flex items-center justify-center gap-1.5 transition-all whitespace-nowrap';
  generateBtn.textContent = 'Apply Effect';
  generateBtn.setAttribute('aria-label', 'Apply effect');
    promptRow.appendChild(generateBtn);
    const effectsPublishBtn = document.createElement('button');
    effectsPublishBtn.type = 'button';
    effectsPublishBtn.textContent = 'Publish to Social';
    effectsPublishBtn.className = 'bg-gradient-to-r from-[#6d5efc] to-[#a855f7] text-white px-6 py-2.5 rounded-xl font-black text-sm hover:shadow-glow transition-all whitespace-nowrap';
    effectsPublishBtn.onclick = () => openSocialPublish({ mediaUrl: lastResultUrl, mediaType: lastResultType });
    promptRow.appendChild(effectsPublishBtn);
    mountPersonalizeTrigger({ controlsContainer: promptRow, getTextarea: () => promptInput, appId: 'effects-studio' });
  // Prompt Gallery button
  const promptGalleryBtn = document.createElement('button');
  promptGalleryBtn.type = 'button';
  promptGalleryBtn.textContent = '📚 Prompts';
  promptGalleryBtn.title = 'Browse prompt gallery';
  promptGalleryBtn.setAttribute('aria-label', 'Open prompt gallery');
  promptGalleryBtn.className = 'btn-ghost-modern';
  promptGalleryBtn.addEventListener('click', () => {
    openPromptGallery({
      appTheme: 'video-studio',
      onSelect: (prompt) => {
        const ta = promptInput;
        if (ta) { ta.value = prompt; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus(); }
      }
    }).catch((err) => console.error('[PromptGallery] open failed:', err));
  });

    // Recipe Engine button
    const recipeBtn = document.createElement('button');
    recipeBtn.type = 'button';
    recipeBtn.textContent = '📋 Recipes';
    recipeBtn.title = 'Browse AI recipes';
    recipeBtn.setAttribute('aria-label', 'Open recipe engine');
    recipeBtn.className = 'btn-ghost-modern';
    recipeBtn.addEventListener('click', () => {
      openRecipeModal({
        onRunRecipe: (url) => {
        }
      }).catch((err) => console.error('[Recipe] open failed:', err));
    });


    // Monetization Hub button
    const monetizationBtn = document.createElement('button');
    monetizationBtn.type = 'button';
    monetizationBtn.textContent = '💼 Monetize';
    monetizationBtn.title = "Open Smart Video AI Monetization Hub";
    monetizationBtn.setAttribute('aria-label', 'Open Smart Video AI Monetization Hub');
    monetizationBtn.className = 'btn-ghost-modern';
    monetizationBtn.addEventListener('click', () => {
      openMonetizationHub().catch((err) => console.error('[Monetization] open failed:', err));
    });
  promptRow.appendChild(recipeBtn);
  promptRow.appendChild(monetizationBtn);
  promptRow.appendChild(promptGalleryBtn);
    previewTop.appendChild(promptRow);

  // ─── Advanced Generation Controls ────────────────────────────────────
  const advancedControls = document.createElement('div');
  advancedControls.className = 'flex flex-col gap-3';

  // Advanced toggle button
  const advToggleBtn = document.createElement('button');
  advToggleBtn.type = 'button';
  advToggleBtn.className = 'text-[10px] font-bold text-secondary hover:text-white uppercase tracking-wider transition-colors flex items-center gap-1';
  advToggleBtn.textContent = '⚙ Advanced';
  advToggleBtn.setAttribute('aria-expanded', 'false');
  advancedControls.appendChild(advToggleBtn);

  const advContent = document.createElement('div');
  advContent.className = 'hidden flex-col gap-3 p-4 border border-white/5 rounded-xl bg-white/[0.01]';
  advancedControls.appendChild(advContent);

  // Toggle logic
  let showAdvanced = false;
  advToggleBtn.onclick = () => {
    showAdvanced = !showAdvanced;
    advToggleBtn.setAttribute('aria-expanded', String(showAdvanced));
    advToggleBtn.textContent = showAdvanced ? '⚙ Less' : '⚙ Advanced';
    advContent.classList.toggle('hidden', !showAdvanced);
    advContent.style.display = showAdvanced ? 'flex' : 'none';
  };

  // Row 1: Guidance Scale | Steps | Seed
  const row1 = document.createElement('div');
  row1.className = 'flex gap-3 flex-wrap';

  const guidanceSlider = createSliderControl({
    id: 'fx-guidance-slider',
    label: 'Guidance',
    min: 1, max: 20, step: 0.5, value: advancedSettings.guidanceScale,
    format: '%.1f',
    description: 'How closely to follow the prompt (1=creative, 20=strict)',
  });
  guidanceSlider.querySelector('label').setAttribute('for', 'fx-guidance-slider');

  const stepsSlider = createSliderControl({
    id: 'fx-steps-slider',
    label: 'Steps',
    min: 1, max: 50, step: 1, value: advancedSettings.steps,
    format: '%d',
    description: 'More steps = better quality, slower generation',
  });

  const seedWrapper = document.createElement('div');
  seedWrapper.className = 'flex flex-col gap-1.5 flex-1 min-w-[120px]';
  const seedLabelRow = document.createElement('div');
  seedLabelRow.className = 'flex items-center justify-between';
  const seedLabel = document.createElement('label');
  seedLabel.className = 'text-[10px] font-bold text-secondary uppercase tracking-wider';
  seedLabel.textContent = 'Seed';
  seedLabel.setAttribute('for', 'fx-seed-input');
  const seedRandomBtn = document.createElement('button');
  seedRandomBtn.type = 'button';
  seedRandomBtn.textContent = '🎲';
  seedRandomBtn.title = 'Randomize seed';
  seedRandomBtn.className = 'text-xs hover:scale-110 transition-transform';
  seedRandomBtn.onclick = () => {
    advancedSettings.seed = Math.floor(Math.random() * 999999999);
    seedInput.value = String(advancedSettings.seed);
    saveAdvancedSettings();
  };
  seedLabelRow.appendChild(seedLabel);
  seedLabelRow.appendChild(seedRandomBtn);
  seedWrapper.appendChild(seedLabelRow);
  const seedInput = document.createElement('input');
  seedInput.type = 'number';
  seedInput.id = 'fx-seed-input';
  seedInput.value = String(advancedSettings.seed);
  seedInput.placeholder = '-1 = random';
  seedInput.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors';
  seedInput.setAttribute('aria-label', 'Generation seed');
  seedInput.oninput = (e) => {
    advancedSettings.seed = parseInt(e.target.value) || -1;
    saveAdvancedSettings();
  };
  seedWrapper.appendChild(seedInput);

  row1.appendChild(guidanceSlider);
  row1.appendChild(stepsSlider);
  row1.appendChild(seedWrapper);
  advContent.appendChild(row1);

  // Row 2: Negative Prompt
  const negPromptWrapper = document.createElement('div');
  negPromptWrapper.className = 'flex flex-col gap-1.5';
  const negPromptLabel = document.createElement('label');
  negPromptLabel.className = 'text-[10px] font-bold text-secondary uppercase tracking-wider';
  negPromptLabel.textContent = 'Negative Prompt';
  negPromptLabel.setAttribute('for', 'fx-neg-prompt');
  negPromptWrapper.appendChild(negPromptLabel);
  const negPromptInput = document.createElement('input');
  negPromptInput.type = 'text';
  negPromptInput.id = 'fx-neg-prompt';
  negPromptInput.value = advancedSettings.negativePrompt;
  negPromptInput.placeholder = 'What to avoid (e.g., blurry, distorted, watermark)';
  negPromptInput.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-xs placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors';
  negPromptInput.setAttribute('aria-label', 'Negative prompt');
  negPromptInput.oninput = (e) => {
    advancedSettings.negativePrompt = e.target.value;
    saveAdvancedSettings();
  };
  negPromptWrapper.appendChild(negPromptInput);
  advContent.appendChild(negPromptWrapper);

  // Row 3: Effect Strength | Denoise Strength
  const row3 = document.createElement('div');
  row3.className = 'flex gap-3 flex-wrap';

  const effectStrengthSlider = createSliderControl({
    id: 'fx-effect-strength-slider',
    label: 'Effect Strength',
    min: 0, max: 1, step: 0.05, value: advancedSettings.effectStrength,
    format: '%.0f%%',
    description: 'How strongly the effect is applied',
  });
  effectStrengthSlider.querySelector('label').setAttribute('for', 'fx-effect-strength-slider');
  // Override display to show percentage
  const effectStrengthValueEl = effectStrengthSlider.querySelector(`#fx-effect-strength-slider-value`);
  if (effectStrengthValueEl) {
    effectStrengthSlider.querySelector('#fx-effect-strength-slider').oninput = (e) => {
      const val = parseFloat(e.target.value);
      effectStrengthValueEl.textContent = Math.round(val * 100) + '%';
      advancedSettings.effectStrength = val;
      saveAdvancedSettings();
    };
  }

  const denoiseSlider = createSliderControl({
    id: 'fx-denoise-slider',
    label: 'Denoise Strength',
    min: 0, max: 1, step: 0.05, value: advancedSettings.denoiseStrength,
    format: '%.2f',
    description: 'How much to change from source (0=preserve, 1=regenerate)',
  });
  denoiseSlider.querySelector('label').setAttribute('for', 'fx-denoise-slider');

  row3.appendChild(effectStrengthSlider);
  row3.appendChild(denoiseSlider);
  advContent.appendChild(row3);

  // Reset button
  const resetRow = document.createElement('div');
  resetRow.className = 'flex justify-end';
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.textContent = 'Reset to defaults';
  resetBtn.className = 'text-[10px] font-bold text-muted hover:text-white transition-colors';
  resetBtn.onclick = () => {
    advancedSettings = { ...advancedDefaults };
    seedInput.value = String(advancedSettings.seed);
    negPromptInput.value = advancedSettings.negativePrompt;
    guidanceSlider.setValue(advancedSettings.guidanceScale);
    stepsSlider.setValue(advancedSettings.steps);
    effectStrengthSlider.setValue(advancedSettings.effectStrength);
    denoiseSlider.setValue(advancedSettings.denoiseStrength);
    saveAdvancedSettings();
    showToast('Advanced settings reset', 'success');
  };
  resetRow.appendChild(resetBtn);
  advContent.appendChild(resetRow);

  // ─── Keyframe Animate Toggles ─────────────────────────────────────────
  const fxKeyframes = {
    guidance_scale: [],
    steps: [],
    denoise_strength: [],
    effect_strength: [],
  };
  const fxAnimatedProps = new Set();

  function addAnimateToggle(sliderEl, propertyName, currentValue) {
    const row = sliderEl.querySelector('.slider-row') || sliderEl;
    const existingValue = row.querySelector('.value-display') || sliderEl.querySelector('span') || sliderEl;
    
    const animBtn = document.createElement('button');
    animBtn.type = 'button';
    animBtn.textContent = '🎬';
    animBtn.title = 'Toggle animation for this property';
    animBtn.className = 'text-xs hover:scale-110 transition-transform ml-1';
    animBtn.onclick = () => {
      const isAnimated = fxAnimatedProps.has(propertyName);
      if (isAnimated) {
        fxAnimatedProps.delete(propertyName);
        animBtn.textContent = '🎬';
        animBtn.classList.remove('text-yellow-400');
      } else {
        fxAnimatedProps.add(propertyName);
        fxKeyframes[propertyName] = [{ time: 0, value: currentValue }];
        animBtn.textContent = '🎬';
        animBtn.classList.add('text-yellow-400');
        showToast(`Animation enabled for ${propertyName}`, 'success');
      }
    };
    
    // Try to insert after the value display
    const valueDisplay = sliderEl.querySelector('.value-display');
    if (valueDisplay && valueDisplay.parentNode) {
      valueDisplay.parentNode.insertBefore(animBtn, valueDisplay.nextSibling);
    } else if (existingValue && existingValue.parentNode) {
      existingValue.parentNode.insertBefore(animBtn, existingValue.nextSibling);
    } else {
      sliderEl.appendChild(animBtn);
    }
  }

  // Add animate toggles to sliders
  addAnimateToggle(guidanceSlider, 'guidance_scale', advancedSettings.guidanceScale);
  addAnimateToggle(stepsSlider, 'steps', advancedSettings.steps);
  addAnimateToggle(effectStrengthSlider, 'effect_strength', advancedSettings.effectStrength);
  addAnimateToggle(denoiseSlider, 'denoise_strength', advancedSettings.denoiseStrength);

  previewTop.appendChild(advancedControls);

  // ─── Effect Layers ────────────────────────────────────────────────────
  const layersPanel = document.createElement('div');
  layersPanel.className = 'flex flex-col gap-2 mt-3';
  const layersHeader = document.createElement('div');
  layersHeader.className = 'flex items-center justify-between';
  layersHeader.innerHTML = '<div class="text-[10px] font-bold text-secondary uppercase tracking-wider">Effect Layers</div>';
  const addLayerBtn = document.createElement('button');
  addLayerBtn.type = 'button';
  addLayerBtn.textContent = '+ Add Layer';
  addLayerBtn.className = 'text-[10px] font-bold text-primary hover:text-white transition-colors';
  addLayerBtn.onclick = () => addEffectLayer();
  layersHeader.appendChild(addLayerBtn);
  layersPanel.appendChild(layersHeader);

  const layersList = document.createElement('div');
  layersList.className = 'flex flex-col gap-2';
  layersPanel.appendChild(layersList);

  const layersPreview = document.createElement('canvas');
  layersPreview.className = 'hidden w-full h-32 rounded-lg border border-white/5 bg-black/20 mt-2';
  layersPreview.width = 640;
  layersPreview.height = 360;
  layersPanel.appendChild(layersPreview);

  previewTop.appendChild(layersPanel);

  const fxLayers = [];
  let fxLayerCounter = 0;

  function addEffectLayer(overrides = {}) {
    fxLayerCounter++;
    const id = `fx-layer-${fxLayerCounter}-${Date.now()}`;
    const layer = {
      id,
      name: `Layer ${fxLayerCounter}`,
      blendMode: 'normal',
      opacity: 1.0,
      effectOverrides: {},
      ...overrides,
    };
    fxLayers.push(layer);
    renderLayersList();
    updateLayersPreview();
    return layer;
  }

  function removeEffectLayer(id) {
    const idx = fxLayers.findIndex(l => l.id === id);
    if (idx !== -1) fxLayers.splice(idx, 1);
    renderLayersList();
    updateLayersPreview();
  }

  function updateEffectLayer(id, props) {
    const layer = fxLayers.find(l => l.id === id);
    if (!layer) return;
    Object.assign(layer, props);
    if (props.blendMode !== undefined || props.opacity !== undefined) {
      updateLayersPreview();
    }
  }

  function renderLayersList() {
    layersList.innerHTML = '';
    fxLayers.forEach(layer => {
      const row = document.createElement('div');
      row.className = 'flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/5';

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = layer.name;
      nameInput.className = 'flex-1 bg-transparent text-[10px] font-bold text-white border-none outline-none';
      nameInput.oninput = (e) => updateEffectLayer(layer.id, { name: e.target.value });

      const blendSelect = document.createElement('select');
      blendSelect.className = 'bg-white/5 border border-white/10 rounded text-[10px] text-white px-1 py-1';
      ['normal', 'multiply', 'screen', 'overlay', 'soft-light', 'hard-light', 'color-dodge', 'color-burn', 'darken', 'lighten', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'].forEach(mode => {
        const opt = document.createElement('option');
        opt.value = mode;
        opt.textContent = mode;
        if (mode === layer.blendMode) opt.selected = true;
        blendSelect.appendChild(opt);
      });
      blendSelect.onchange = (e) => updateEffectLayer(layer.id, { blendMode: e.target.value });

      const opacityInput = document.createElement('input');
      opacityInput.type = 'range';
      opacityInput.min = '0';
      opacityInput.max = '1';
      opacityInput.step = '0.05';
      opacityInput.value = String(layer.opacity);
      opacityInput.className = 'w-16';
      opacityInput.oninput = (e) => updateEffectLayer(layer.id, { opacity: parseFloat(e.target.value) });

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = '✕';
      removeBtn.className = 'text-[10px] text-red-400 hover:text-red-300 transition-colors';
      removeBtn.onclick = () => removeEffectLayer(layer.id);

      row.appendChild(nameInput);
      row.appendChild(blendSelect);
      row.appendChild(opacityInput);
      row.appendChild(removeBtn);
      layersList.appendChild(row);
    });
  }

  async function updateLayersPreview() {
    if (fxLayers.length === 0 || !uploadedUrl) {
      layersPreview.classList.add('hidden');
      return;
    }
    layersPreview.classList.remove('hidden');
    const ctx = layersPreview.getContext('2d');
    ctx.clearRect(0, 0, layersPreview.width, layersPreview.height);
    // Draw base
    const baseImg = new Image();
    baseImg.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
      baseImg.onload = resolve;
      baseImg.onerror = reject;
      baseImg.src = uploadedUrl;
    });
    ctx.drawImage(baseImg, 0, 0, layersPreview.width, layersPreview.height);
    // Composite layers
    for (const layer of fxLayers) {
      if (!layer.imageUrl) continue;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = layer.imageUrl;
      });
      ctx.globalCompositeOperation = layer.blendMode === 'normal' ? 'source-over' : layer.blendMode;
      ctx.globalAlpha = layer.opacity;
      ctx.drawImage(img, 0, 0, layersPreview.width, layersPreview.height);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;
  }

  previewPanel.appendChild(previewTop);

  bodyArea.appendChild(effectsPanel);
  bodyArea.appendChild(previewPanel);
  container.appendChild(bodyArea);

  const mobileControls = document.createElement('div');
  mobileControls.className = 'md:hidden px-4 pb-4 shrink-0 flex flex-col gap-3 border-t border-white/5 pt-3';

  const mobilePreviewRow = document.createElement('div');
  mobilePreviewRow.className = 'flex gap-3';

  const mobileInputPreview = createMediaPreview({ maxHeight: '30vh', showDownload: false, showMeta: false, onClear: () => mobileInputPreview.clear() });
  mobileInputPreview.element.className += ' flex-1 fx-hidden';
  const mobileOutputPreview = createMediaPreview({ maxHeight: '30vh', showDownload: true, showMeta: false, onClear: () => mobileOutputPreview.clear() });
  mobileOutputPreview.element.className += ' flex-1';
  mobileOutputPreview.element.setAttribute('role', 'status');
  mobileOutputPreview.element.setAttribute('aria-live', 'polite');

  mobilePreviewRow.appendChild(mobileInputPreview.element);
  mobilePreviewRow.appendChild(mobileOutputPreview.element);
  mobileControls.appendChild(mobilePreviewRow);

  const mobileUploadRow = document.createElement('div');
  mobileUploadRow.className = 'flex items-center gap-3';
  const mobilePicker = createUploadPicker({
    anchorContainer: container,
    acceptVideo: true,
    onFilePreview: (file) => { mobileInputPreview.loadFile(file); },
    onSelect: ({ url }) => {
      uploadedUrl = url;
      mobileInputPreview.load(url);
    },
    onClear: () => {
      uploadedUrl = null;
      mobileInputPreview.clear();
    },
  });
  mobileUploadRow.appendChild(mobilePicker.trigger);
  container.appendChild(mobilePicker.panel);

  const mobilePrompt = document.createElement('input');
  mobilePrompt.type = 'text';
  mobilePrompt.placeholder = 'Optional prompt...';
  mobilePrompt.className = 'flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs placeholder:text-muted focus:outline-none focus:border-primary/50';
  mobilePrompt.setAttribute('aria-label', 'Effect prompt');
  mobileUploadRow.appendChild(mobilePrompt);
  mobileControls.appendChild(mobileUploadRow);

  const mobileCompareBtn = document.createElement('button');
  mobileCompareBtn.type = 'button';
  mobileCompareBtn.className = 'w-full px-3 py-2 rounded-xl text-[10px] font-bold bg-white/5 border border-white/10 text-secondary hover:text-white hover:border-white/20 transition-all';
  mobileCompareBtn.textContent = '⟺ Toggle Compare';
  mobileCompareBtn.onclick = () => {
    comparisonMode = !comparisonMode;
    mobileCompareBtn.classList.toggle('bg-primary/20', comparisonMode);
    mobileCompareBtn.classList.toggle('border-primary/40', comparisonMode);
    mobileCompareBtn.classList.toggle('text-primary', comparisonMode);
    updateComparisonView();
  };
  mobileControls.appendChild(mobileCompareBtn);

  const mobileGenBtn = document.createElement('button');
  mobileGenBtn.type = 'button';
  mobileGenBtn.className = 'btn-primary-modern w-full px-[14px] py-2 min-h-[40px] text-[13px] font-bold rounded-2xl inline-flex items-center justify-center gap-1.5 transition-all';
  mobileGenBtn.textContent = 'Apply Effect';
  mobileGenBtn.setAttribute('aria-label', 'Apply effect');
  mobileControls.appendChild(mobileGenBtn);
  const mobilePublishBtn = document.createElement('button');
  mobilePublishBtn.type = 'button';
  mobilePublishBtn.textContent = 'Publish to Social';
  mobilePublishBtn.className = 'w-full bg-gradient-to-r from-[#6d5efc] to-[#a855f7] text-white py-3 rounded-xl font-black text-sm hover:shadow-glow transition-all';
  mobilePublishBtn.onclick = () => openSocialPublish({ mediaUrl: lastResultUrl, mediaType: lastResultType });
  mobileControls.appendChild(mobilePublishBtn);
  container.appendChild(mobileControls);

  function switchTab(tab) {
    activeTab = tab;
    selectedEffect = null;
    selectedBadge.textContent = 'No effect selected';
    selectedBadge.className = 'text-xs font-bold text-muted';
    Object.entries(tabButtons).forEach(([id, btn]) => {
      btn.className = id === tab.id
        ? 'px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all btn-secondary-modern'
        : 'px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all bg-white/5 text-secondary hover:bg-white/10';
    });
    renderEffects();
  }

  // Helper to get thumbnail URL for an effect
  function getEffectThumbnail(effectName, tabId, tabType) {
    // Create a slug from the effect name
    const slug = effectName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    
    // Map effect names to their thumbnail indices (for ai-video effects)
    const effectIndexMap = {
      '360 rotation': '01', 'abandoned places': '02', 'angry': '03', 'animal documentary': '04',
      'assassin it': '05', 'baby it': '06', 'boxing': '07', 'bride it': '08', 'cakeify': '09',
      'cartoon jaw drop': '10', 'cats': '11', 'crush it': '12', 'crying': '13', 'cyberpunk 2077': '14',
      'deflate it': '15', 'disney princess it': '16', 'dogs': '17', 'eye close-up': '18',
      'fantasy landscapes': '19', 'film noir': '20', 'fire': '21', 'glamor': '22', 'goblin': '23',
      'gun reveal': '24', 'hug jesus': '25', 'hulk transformation': '26', 'inflate it': '27',
      'jungle it': '28', 'jumpscare': '29', 'kamehameha': '30', 'kiss cam': '31', 'kissing': '32',
      'lego': '33', 'laughing': '34', 'little planet': '35', 'live wallpaper': '36',
      'looping pixel art': '37', 'melt it': '38', 'mona lisa it': '39', 'museum it': '40',
      'muscle show off': '41', 'orc': '42', 'pixar': '43', 'pirate captain': '44', 'pov driving': '45',
      'princess it': '46', 'puppy it': '47', 'robotic face reveal': '48', 'samurai it': '49',
      'sharingan eyes': '50', 'skyrim fus-ro-dah': '51', 'snow white it': '52', 'squish it': '53',
      'steamboat willie': '54', 'super saiyan transformation': '55', 'tsunami': '56', 'ultra wide': '57',
      'vhs footage': '58', 'vip it': '59', 'warrior it': '60', 'wind blast': '61',
      'younger self selfie': '62', 'zen it': '63', 'zoom call': '64'
    };
    
    const index = effectIndexMap[slug] || effectIndexMap[effectName.toLowerCase()];
    
    if (tabId === 'ai-video-effects' && index) {
      // AI Video Effects - use webp first, fallback to svg
      return `/thumbnails/effects/ai-video/${index}-${slug}.webp.png`;
    }
    
    if (tabId === 'image-effects') {
      // Image Effects - use webp.png format
      return `/thumbnails/effects/image-effects/${slug}.webp.png`;
    }
    
    if (tabId === 'nano-banana-effects') {
      // Nano Banana Effects - use webp.png format
      return `/thumbnails/effects/nano-banana/${slug}.webp.png`;
    }
    
    if (tabId === 'flux-kontext-effects') {
      // Kontext Effects - use webp.png format
      return `/thumbnails/effects/kontext-effects/${slug}.webp.png`;
    }
    
    if (tabId === 'motion-controls') {
      // Motion Controls - use webp.png format
      return `/thumbnails/effects/motion-controls/${slug}.webp.png`;
    }
    
    if (tabId === 'video-effects') {
      // Video Effects v2 - use direct slug mapping
      return `/thumbnails/effects/vfx/${slug}.webp.png`;
    }
    
    if (tabType === 'i2v' && index) {
      // Fallback for other i2v tabs
      return `/thumbnails/effects/ai-video/${index}-${slug}.webp.png`;
    }
    
    return null;
  }

  function renderEffects(filter = '') {
    effectsGrid.innerHTML = '';
    let effects = getEffectsForModel(activeTab.id);

    if (filter) {
      effects = effects.filter(name => name.toLowerCase().includes(filter.toLowerCase()));
    }

    effects.forEach(name => {
      const card = document.createElement('div');
      const isVideo = activeTab.type === 'i2v';
      const thumbnailUrl = getEffectThumbnail(name, activeTab.id, activeTab.type);
      
      card.className = 'bg-white/[0.03] border border-white/5 rounded-xl p-2 cursor-pointer hover:bg-white/[0.06] hover:border-white/10 transition-all group overflow-hidden';
      
      // Card HTML with thumbnail
      const placeholderSVG = isVideo ?
        '<svg class="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>' :
        '<svg class="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';

      card.innerHTML = `
        <div class="relative w-full aspect-square mb-2 rounded-lg overflow-hidden bg-white/5">
          ${thumbnailUrl ? `<img src="${thumbnailUrl}" alt="${name}" class="w-full h-full object-cover" loading="lazy" decoding="async" />` : `
            <div class="w-full h-full flex items-center justify-center">${placeholderSVG}</div>
          `}
        </div>
        <div class="flex items-center gap-1.5">
          ${isVideo ? '<div class="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0"></div>' : '<div class="w-1.5 h-1.5 rounded-full bg-primary shrink-0"></div>'}
          <div class="text-[10px] font-bold text-white group-hover:text-primary transition-colors truncate">${name}</div>
        </div>
        <div class="text-[9px] text-muted mt-0.5">${isVideo ? 'Video' : 'Image'}</div>
      `;

      // Graceful fallback: missing .webp.png -> .svg -> placeholder icon
      const img = card.querySelector('img');
      if (img) {
        img.onerror = () => {
          const svgSrc = img.getAttribute('src').replace(/\.webp\.png$/, '.svg');
          img.onerror = () => {
            const ph = document.createElement('div');
            ph.className = 'w-full h-full flex items-center justify-center';
            ph.innerHTML = placeholderSVG;
            img.replaceWith(ph);
          };
          img.src = svgSrc;
        };
      }
      card.onclick = () => {
        selectedEffect = name;
        effectsGrid.querySelectorAll('[data-selected]').forEach(el => {
          el.removeAttribute('data-selected');
          el.classList.remove('border-primary/50', 'bg-primary/5');
          el.classList.add('border-white/5');
        });
        card.setAttribute('data-selected', '1');
        card.classList.remove('border-white/5');
        card.classList.add('border-primary/50', 'bg-primary/5');
        selectedBadge.textContent = name;
        selectedBadge.className = 'text-xs font-bold text-primary';
      };
      effectsGrid.appendChild(card);
    });

    if (effects.length === 0) {
      effectsGrid.innerHTML = '<div class="col-span-2 text-xs text-muted py-6 text-center">No effects match your search</div>';
    }
  }

  searchInput.oninput = () => renderEffects(searchInput.value);

  async function handleGenerate() {
    if (!(await requireEntitlement())) return;
    if (!selectedEffect) { alert('Select an effect first'); return; }
    if (!uploadedUrl) { alert('Upload an image or video first'); return; }
    const apiKey = apiKeyManager.getMuapiKey();
    if (!apiKey) { AuthModal(() => handleGenerate()); return; }

    generateBtn.disabled = true;
    mobileGenBtn.disabled = true;
    generateBtn.innerHTML = '<span class="animate-spin inline-block mr-2">&#9711;</span> Processing...';
    mobileGenBtn.innerHTML = generateBtn.innerHTML;

    outputPreview.showLoading(`Applying "${selectedEffect}"...`);
    mobileOutputPreview.showLoading('Processing...');

    const controller = new AbortController();
    const isVideo = activeTab.type === 'i2v';
    const timeoutMs = isVideo ? 180000 : 90000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const hasLayers = fxLayers.length > 0;
      const hasKeyframes = fxAnimatedProps.size > 0 && isVideo;

      if (hasLayers) {
        // Generate base + each layer, then composite
        await generateWithLayers(controller);
      } else if (hasKeyframes) {
        // Generate video with keyframe segments
        await generateWithKeyframes(controller);
      } else {
        // Standard single generation
        await generateSingle(controller);
      }
    } catch (err) {
      outputPreview.showError(`Error: ${err.message}`);
      mobileOutputPreview.showError('Error');
    } finally {
      clearTimeout(timeoutId);
      controller.abort();
      generateBtn.disabled = false;
      mobileGenBtn.disabled = false;
      generateBtn.textContent = 'Apply Effect';
      mobileGenBtn.textContent = 'Apply Effect';
    }
  }

  async function buildBaseParams() {
    const params = {
      model: activeTab.id,
      image_url: uploadedUrl,
      [activeTab.field]: selectedEffect,
      customThumbnailUrl: customThumbnailUrl || undefined,
      guidance_scale: advancedSettings.guidanceScale,
      steps: advancedSettings.steps,
      seed: advancedSettings.seed,
      negative_prompt: advancedSettings.negativePrompt || undefined,
      denoise_strength: advancedSettings.denoiseStrength,
      effect_strength: advancedSettings.effectStrength,
      cfg_scale: advancedSettings.cfgScale,
    };

    let profiles = null;
    try {
      const raw = localStorage.getItem('remix_contact_profiles');
      if (raw) profiles = JSON.parse(raw);
    } catch { profiles = null; }
    let selectedContactId = null;
    try {
      selectedContactId = localStorage.getItem('remix_selected_contact_id');
    } catch { selectedContactId = null; }
    const activeProfile = profiles?.find((p) => p.id === selectedContactId) || null;
    const prompt = replaceTokensInPrompt(promptInput.value.trim() || mobilePrompt.value.trim(), activeProfile);
    if (prompt) params.prompt = prompt;

    return params;
  }

  async function generateSingle(controller) {
    const params = await buildBaseParams();
    const isVideo = activeTab.type === 'i2v';
    
    if (activeTab.id === 'ai-video-effects' || activeTab.id === 'motion-controls') {
      params.resolution = '720p';
      params.duration = 5;
      const result = await muapi.generateVideoEffect(params, controller.signal);
      handleResult(result, isVideo);
    } else if (activeTab.type === 'i2v') {
      params.resolution = '720p';
      params.duration = 5;
      const result = await muapi.generateI2V(params, controller.signal);
      handleResult(result, isVideo);
    } else {
      const result = await muapi.generateI2I(params, controller.signal);
      handleResult(result, isVideo);
    }
  }

  async function generateWithLayers(controller) {
    const isVideo = activeTab.type === 'i2v';
    const layerResults = [];
    
    // Generate base
    const baseParams = await buildBaseParams();
    let baseResult;
    if (activeTab.id === 'ai-video-effects' || activeTab.id === 'motion-controls') {
      baseParams.resolution = '720p';
      baseParams.duration = 5;
      baseResult = await muapi.generateVideoEffect(baseParams, controller.signal);
    } else if (activeTab.type === 'i2v') {
      baseParams.resolution = '720p';
      baseParams.duration = 5;
      baseResult = await muapi.generateI2V(baseParams, controller.signal);
    } else {
      baseResult = await muapi.generateI2I(baseParams, controller.signal);
    }
    layerResults.push({ url: baseResult.url, blendMode: 'normal', opacity: 1.0 });

    // Generate each layer
    for (const layer of fxLayers) {
      const layerParams = await buildBaseParams();
      // Apply layer overrides
      if (layer.effectOverrides) {
        Object.assign(layerParams, layer.effectOverrides);
      }
      layerParams.blendMode = layer.blendMode;
      layerParams.opacity = layer.opacity;
      
      let layerResult;
      if (activeTab.type === 'i2v') {
        layerParams.resolution = '720p';
        layerParams.duration = 5;
        layerResult = await muapi.generateI2V(layerParams, controller.signal);
      } else {
        layerResult = await muapi.generateI2I(layerParams, controller.signal);
      }
      layerResults.push({ url: layerResult.url, blendMode: layer.blendMode, opacity: layer.opacity });
    }

    // Composite layers
    const compositor = new EffectCompositor(1280, 720);
    await compositor.setBaseImage(baseResult.url);
    for (let i = 1; i < layerResults.length; i++) {
      await compositor.addLayer({
        id: `layer-${i}`,
        imageSource: layerResults[i].url,
        blendMode: layerResults[i].blendMode,
        opacity: layerResults[i].opacity,
      });
    }
    await compositor.composite();
    const compositeDataUrl = compositor.getOutputDataURL('image/png', 0.92);
    handleResult({ url: compositeDataUrl }, isVideo);
  }

  async function generateWithKeyframes(controller) {
    const isVideo = activeTab.type === 'i2v';
    const duration = 5; // seconds
    const keyframeSegments = buildKeyframeSegments(duration);
    
    outputPreview.showLoading(`Generating ${keyframeSegments.length} segments...`);
    mobileOutputPreview.showLoading('Generating segments...');

    const segmentResults = [];
    for (let i = 0; i < keyframeSegments.length; i++) {
      const segment = keyframeSegments[i];
      const params = await buildBaseParams();
      params.resolution = '720p';
      params.duration = segment.duration;
      params.start_time = segment.startTime;
      params.end_time = segment.endTime;
      // Apply interpolated params
      Object.assign(params, segment.params);
      
      const result = await muapi.generateVideoEffect(params, controller.signal);
      segmentResults.push({ url: result.url, startTime: segment.startTime, duration: segment.duration });
      
      const progress = Math.round(((i + 1) / keyframeSegments.length) * 100);
      outputPreview.showLoading(`Generating segment ${i + 1}/${keyframeSegments.length}...`);
      mobileOutputPreview.showLoading(`Segment ${i + 1}/${keyframeSegments.length}`);
    }

    // Stitch segments using canvas recording
    const stitchedBlob = await stitchVideoSegments(segmentResults, duration);
    const stitchedUrl = URL.createObjectURL(stitchedBlob);
    handleResult({ url: stitchedUrl }, isVideo);
  }

  function buildKeyframeSegments(totalDuration) {
    const segments = [];
    const animatedProps = {};
    
    for (const prop of fxAnimatedProps) {
      const keyframes = fxKeyframes[prop] || [];
      if (keyframes.length > 0) {
        animatedProps[prop] = keyframes;
      }
    }

    if (Object.keys(animatedProps).length === 0) {
      return [{ startTime: 0, endTime: totalDuration, duration: totalDuration, params: {} }];
    }

    // Collect all keyframe times
    const times = new Set([0, totalDuration]);
    for (const keyframes of Object.values(animatedProps)) {
      for (const kf of keyframes) {
        times.add(Math.max(0, Math.min(totalDuration, kf.time)));
      }
    }
    const sortedTimes = Array.from(times).sort((a, b) => a - b);

    for (let i = 0; i < sortedTimes.length - 1; i++) {
      const startTime = sortedTimes[i];
      const endTime = sortedTimes[i + 1];
      const midTime = (startTime + endTime) / 2;
      const params = {};
      
      for (const [prop, keyframes] of Object.entries(animatedProps)) {
        params[prop] = interpolateKeyframes(keyframes, midTime);
      }
      
      segments.push({
        startTime,
        endTime,
        duration: endTime - startTime,
        params,
      });
    }

    return segments;
  }

  function interpolateKeyframes(keyframes, time) {
    if (!keyframes || keyframes.length === 0) return 0;
    if (keyframes.length === 1) return keyframes[0].value;

    // Find surrounding keyframes
    let before = keyframes[0];
    let after = keyframes[keyframes.length - 1];
    
    for (let i = 0; i < keyframes.length - 1; i++) {
      if (keyframes[i].time <= time && keyframes[i + 1].time >= time) {
        before = keyframes[i];
        after = keyframes[i + 1];
        break;
      }
    }

    if (time <= before.time) return before.value;
    if (time >= after.time) return after.value;

    const t = (time - before.time) / (after.time - before.time);
    return before.value + (after.value - before.value) * t;
  }

  async function stitchVideoSegments(segments, totalDuration) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.muted = true;
      video.crossOrigin = 'anonymous';
      
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');
      
      const stream = canvas.captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        resolve(blob);
      };
      recorder.onerror = (e) => reject(e.error || new Error('MediaRecorder failed'));
      
      let segmentIndex = 0;
      
      function playNextSegment() {
        if (segmentIndex >= segments.length) {
          recorder.stop();
          return;
        }
        
        const segment = segments[segmentIndex];
        video.src = segment.url;
        video.currentTime = 0;
        
        video.onseeked = () => {
          video.play().catch(() => {});
        };
        
        video.onended = () => {
          segmentIndex++;
          playNextSegment();
        };
        
        // Timeout fallback
        setTimeout(() => {
          if (video.currentTime < (segment.duration - 0.1)) {
            video.onended();
          }
        }, segment.duration * 1000 + 500);
      }
      
      // Draw loop
      function drawFrame() {
        if (video.paused || video.ended) {
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        requestAnimationFrame(drawFrame);
      }
      drawFrame();
      
      recorder.start(100);
      playNextSegment();
    });
  }

  function handleResult(result, isVideo) {
    if (result?.url) {
      const mediaType = isVideo ? 'video' : 'image';
      outputPreview.load(result.url, { type: mediaType, model: activeTab.label, filename: `${selectedEffect}-${Date.now()}` });
      mobileOutputPreview.load(result.url, { type: mediaType });
      lastResultUrl = result.url;
      lastResultType = mediaType;
      lastInputUrl = uploadedUrl;
      updateComparisonView();
      saveToHistory(result.url, mediaType);
      const captionBtn = outputCol.querySelector('.caption-action-btn, button[title="Add AI captions to this video"]');
      if (captionBtn) {
        captionBtn.classList.toggle('hidden', !isVideo);
      }
    } else {
      outputPreview.showError('No output URL returned');
      mobileOutputPreview.showError('Failed');
    }
  }

  function updateComparisonView() {
    // Desktop: replace splitRow with side-by-side comparison wrapper
    const existingDesktop = previewTop.querySelector('.fx-comparison-wrapper');
    if (existingDesktop) existingDesktop.remove();

    if (comparisonMode && lastResultUrl) {
      const wrapper = document.createElement('div');
      wrapper.className = 'fx-comparison-wrapper';

      const inputPane = document.createElement('div');
      inputPane.className = 'fx-comparison-pane';
      const inputLabel = document.createElement('div');
      inputLabel.className = 'fx-comparison-label';
      inputLabel.textContent = 'Input';
      inputPane.appendChild(inputLabel);

      const inputClone = createMediaPreview({ maxHeight: '45vh', showDownload: false, showMeta: false });
      if (lastInputUrl) inputClone.load(lastInputUrl);
      inputPane.appendChild(inputClone.element);

      const divider = document.createElement('div');
      divider.className = 'fx-comparison-divider';

      const outputPane = document.createElement('div');
      outputPane.className = 'fx-comparison-pane';
      const outputLabel = document.createElement('div');
      outputLabel.className = 'fx-comparison-label';
      outputLabel.textContent = 'Output';
      outputPane.appendChild(outputLabel);

      const outputClone = createMediaPreview({ maxHeight: '45vh', showDownload: true, showMeta: true });
      outputClone.load(lastResultUrl, { type: lastResultType });
      outputPane.appendChild(outputClone.element);

      wrapper.appendChild(inputPane);
      wrapper.appendChild(divider);
      wrapper.appendChild(outputPane);
      previewTop.appendChild(wrapper);
    }

    // Mobile: show/hide input preview
    if (mobileInputPreview) {
      if (comparisonMode) {
        mobileInputPreview.element.classList.remove('fx-hidden');
      } else {
        mobileInputPreview.element.classList.add('fx-hidden');
      }
    }
  }

  function saveToHistory(url, type) {
    saveGeneration({
      studio: 'effects',
      type,
      url,
      prompt: selectedEffect,
      model: activeTab.id,
      parameters: {},
      timestamp: new Date().toISOString(),
    });
  }

  generateBtn.onclick = handleGenerate;
  mobileGenBtn.onclick = handleGenerate;

  outputPreview.element.style.cursor = 'pointer';
  outputPreview.element.onclick = () => {
    const url = outputPreview.getUrl();
    if (!url) return;
    const detailView = new MediaDetailView({
      mediaUrl: url,
      mediaType: outputPreview.getType() || 'image',
      title: 'Effects Studio Output',
      model: activeTab.label || '',
      autoCollapsePrompt: true,
    });
    detailView.show();
  };

  switchTab(EFFECT_TABS[0]);
    const galleryAssets = getAssetsForStudio('effects');
    if (galleryAssets.length > 0) {
      const gallery = ExampleGallery({ studioId: 'effects', assets: galleryAssets, maxCards: 28 });
      container.appendChild(gallery);
    }

    return container;
}
