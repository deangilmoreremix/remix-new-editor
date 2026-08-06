import { muapi } from '../lib/muapi.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { AuthModal } from './AuthModal.js';
import { createUploadPicker } from './UploadPicker.js';
import { createMediaPreview, createFullscreenPreview } from './MediaPreview.js';
import { createInlineInstructions } from './InlineInstructions.js';
import { i2iModels, i2vModels } from '../lib/models.js';
import { createHeroSection, getCustomThumbnailFromCache, saveCustomThumbnailToCache, clearCustomThumbnailCache } from '../lib/thumbnails.js';
import { mountPersonalizeTrigger, replaceTokensInPrompt } from './personalize/personalizePopover.js';
import { StudioThumbnailModal, mountStudioThumbnailModal } from './modals/StudioThumbnailPanel.jsx';
import { requireEntitlement } from '../lib/clerkEntitlements.js';
import { navigate } from '../lib/router.js';
import { saveGeneratedAsset } from '../lib/assets/assetActions.js';
import { showToast } from '../lib/loading.js';

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

export function EffectsStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col bg-app-bg overflow-hidden relative';
  mountStudioChrome(container, { currentRoute: 'effects' });

  // Comparison mode styles
  const comparisonStyles = document.createElement('style');
  comparisonStyles.textContent = `
    .fx-comparison-wrapper { position: relative; flex: 1; display: flex; gap: 8px; min-height: 0; }
    .fx-comparison-pane { flex: 1; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
    .fx-comparison-pane .media-preview-media { max-height: 45vh; }
    .fx-comparison-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #9ca3af; }
    .fx-comparison-divider { width: 2px; background: linear-gradient(to bottom, rgba(255,255,255,0.1), rgba(255,255,255,0.3), rgba(255,255,255,0.1)); cursor: col-resize; flex-shrink: 0; }
    .fx-comparison-slider { position: absolute; top: 0; bottom: 0; width: 3px; background: #fff; cursor: ew-resize; z-index: 10; box-shadow: 0 0 8px rgba(0,0,0,0.5); }
    .fx-comparison-slider::after { content: ''; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 28px; height: 28px; border-radius: 50%; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
    .fx-hidden { display: none !important; }
  `;
  container.appendChild(comparisonStyles);

  let activeTab = EFFECT_TABS[0];
  let selectedEffect = null;
  let uploadedUrl = null;
  let customThumbnailUrl = getCustomThumbnailFromCache('effects-studio');
  let comparisonMode = false;
  let lastResultUrl = null;
  let lastResultType = null;
  let lastInputUrl = null;

  const fullscreen = createFullscreenPreview();
  container.appendChild(fullscreen.element);

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
      const modal = new StudioThumbnailModal({
        studioId: 'effects-studio',
        studioLabel: 'Effects Studio',
        accentGradient: 'from-violet-500 to-indigo-500',
      });
      mountStudioThumbnailModal(modal);
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

  const inputPreview = createMediaPreview({ maxHeight: '40vh', showDownload: false, showMeta: true });
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
  container.appendChild(picker.panel);

  const uploadHint = document.createElement('span');
  uploadHint.className = 'text-xs text-muted';
  uploadHint.textContent = 'Upload image or video';
  uploadRow.appendChild(uploadHint);
  inputCol.appendChild(uploadRow);

  const outputCol = document.createElement('div');
  outputCol.className = 'flex-1 flex flex-col gap-3 min-w-0';
  outputCol.setAttribute('role', 'status');
  outputCol.setAttribute('aria-live', 'polite');
  const outputLabel = document.createElement('div');
  outputLabel.className = 'text-[10px] font-bold text-muted uppercase tracking-wider';
  outputLabel.textContent = 'Output';
  outputCol.appendChild(outputLabel);

  const outputPreview = createMediaPreview({ maxHeight: '40vh', showDownload: true, showMeta: true });
  outputCol.appendChild(outputPreview.element);

  const outputActions = document.createElement('div');
  outputActions.className = 'flex items-center gap-2 flex-wrap';

  const downloadActionBtn = document.createElement('button');
  downloadActionBtn.type = 'button';
  downloadActionBtn.className = 'flex-1 min-w-[100px] bg-primary text-black px-3 py-2 rounded-xl text-[10px] font-black hover:shadow-glow transition-all active:scale-95';
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

  outputCol.appendChild(outputActions);

  splitRow.appendChild(inputCol);
  splitRow.appendChild(outputCol);
  previewTop.appendChild(splitRow);

  const promptRow = document.createElement('div');
  promptRow.className = 'flex items-center gap-3';
  const promptInput = document.createElement('input');
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
  thumbBtn.className = 'gtm-boost-btn shrink-0';
  thumbBtn.addEventListener('click', () => {
    const modal = new StudioThumbnailModal({
      appTheme: 'effects-studio',
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
    mountStudioThumbnailModal(modal);
    modal.open();
  });
  promptRow.appendChild(thumbBtn);

  const generateBtn = document.createElement('button');
  generateBtn.type = 'button';
  generateBtn.className = 'bg-primary text-black px-6 py-2.5 rounded-xl font-black text-sm hover:shadow-glow transition-all whitespace-nowrap';
  generateBtn.textContent = 'Apply Effect';
  generateBtn.setAttribute('aria-label', 'Apply effect');
    promptRow.appendChild(generateBtn);
    mountPersonalizeTrigger({ controlsContainer: promptRow, getTextarea: () => promptInput, appId: 'effects-studio' });
    previewTop.appendChild(promptRow);

  previewPanel.appendChild(previewTop);

  bodyArea.appendChild(effectsPanel);
  bodyArea.appendChild(previewPanel);
  container.appendChild(bodyArea);

  const mobileControls = document.createElement('div');
  mobileControls.className = 'md:hidden px-4 pb-4 shrink-0 flex flex-col gap-3 border-t border-white/5 pt-3';

  const mobilePreviewRow = document.createElement('div');
  mobilePreviewRow.className = 'flex gap-3';

  const mobileInputPreview = createMediaPreview({ maxHeight: '30vh', showDownload: false, showMeta: false });
  mobileInputPreview.element.className += ' flex-1 fx-hidden';
  const mobileOutputPreview = createMediaPreview({ maxHeight: '30vh', showDownload: true, showMeta: false });
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
  mobileGenBtn.className = 'w-full bg-primary text-black py-3 rounded-xl font-black text-sm';
  mobileGenBtn.textContent = 'Apply Effect';
  mobileGenBtn.setAttribute('aria-label', 'Apply effect');
  mobileControls.appendChild(mobileGenBtn);
  container.appendChild(mobileControls);

  function switchTab(tab) {
    activeTab = tab;
    selectedEffect = null;
    selectedBadge.textContent = 'No effect selected';
    selectedBadge.className = 'text-xs font-bold text-muted';
    Object.entries(tabButtons).forEach(([id, btn]) => {
      btn.className = id === tab.id
        ? 'px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all bg-primary text-black'
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
      card.innerHTML = `
        <div class="relative w-full aspect-square mb-2 rounded-lg overflow-hidden bg-white/5">
          ${thumbnailUrl ? `<img src="${thumbnailUrl}" alt="${name}" class="w-full h-full object-cover" loading="lazy" decoding="async" />` : `
            <div class="w-full h-full flex items-center justify-center">
              ${isVideo ? 
                '<svg class="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>' :
                '<svg class="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>'
              }
            </div>
          `}
        </div>
        <div class="flex items-center gap-1.5">
          ${isVideo ? '<div class="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0"></div>' : '<div class="w-1.5 h-1.5 rounded-full bg-primary shrink-0"></div>'}
          <div class="text-[10px] font-bold text-white group-hover:text-primary transition-colors truncate">${name}</div>
        </div>
        <div class="text-[9px] text-muted mt-0.5">${isVideo ? 'Video' : 'Image'}</div>
      `;
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
    const timeoutMs = isVideo ? 120000 : 60000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const params = {
        model: activeTab.id,
        image_url: uploadedUrl,
        [activeTab.field]: selectedEffect,
        customThumbnailUrl: customThumbnailUrl || undefined,
      };

      let profiles = null;
      try {
        const raw = localStorage.getItem('remix_contact_profiles');
        if (raw) profiles = JSON.parse(raw);
      } catch {
        profiles = null;
      }
      let selectedContactId = null;
      try {
        selectedContactId = localStorage.getItem('remix_selected_contact_id');
      } catch {
        selectedContactId = null;
      }
      const activeProfile = profiles?.find((p) => p.id === selectedContactId) || null;

      const prompt = replaceTokensInPrompt(promptInput.value.trim() || mobilePrompt.value.trim(), activeProfile);
      if (prompt) params.prompt = prompt;

      let result;
      if (activeTab.id === 'ai-video-effects' || activeTab.id === 'motion-controls') {
        params.resolution = '720p';
        params.duration = 5;
        result = await muapi.generateVideoEffect(params, controller.signal);
      } else if (activeTab.type === 'i2v') {
        params.resolution = '720p';
        params.duration = 5;
        result = await muapi.generateI2V(params, controller.signal);
      } else {
        result = await muapi.generateI2I(params, controller.signal);
      }

      if (result?.url) {
        const mediaType = isVideo ? 'video' : 'image';
        outputPreview.load(result.url, { type: mediaType, model: activeTab.label, filename: `${selectedEffect}-${Date.now()}` });
        mobileOutputPreview.load(result.url, { type: mediaType });

        lastResultUrl = result.url;
        lastResultType = mediaType;
        lastInputUrl = uploadedUrl;
        updateComparisonView();

        saveToHistory(result.url, mediaType);
      } else {
        outputPreview.showError('No output URL returned');
        mobileOutputPreview.showError('Failed');
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
    try {
      const key = type === 'video' ? 'video_history' : 'muapi_history';
      const history = JSON.parse(localStorage.getItem(key) || '[]');
      history.unshift({
        id: Date.now().toString(),
        url,
        prompt: selectedEffect,
        model: activeTab.id,
        type,
        timestamp: new Date().toISOString(),
      });
      localStorage.setItem(key, JSON.stringify(history.slice(0, 100)));
    } catch (e) { /* ignore */ }
  }

  generateBtn.onclick = handleGenerate;
  mobileGenBtn.onclick = handleGenerate;

  outputPreview.element.style.cursor = 'pointer';
  outputPreview.element.onclick = () => {
    const url = outputPreview.getUrl();
    if (url) fullscreen.show(url, { type: outputPreview.getType(), model: activeTab.label });
  };

  switchTab(EFFECT_TABS[0]);
  return container;
}
