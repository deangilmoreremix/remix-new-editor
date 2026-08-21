import { muapi } from '../lib/muapi.js';
import { openSocialPublish } from '../lib/socialPublishHelpers.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { AuthModal } from './AuthModal.js';
import { createUploadPicker } from './UploadPicker.js';
import { createInlineInstructions } from './InlineInstructions.js';
import { createHeroSection, getToolThumbnail, createThumbnailImg, getCustomThumbnailFromCache, saveCustomThumbnailToCache, clearCustomThumbnailCache } from '../lib/thumbnails.js';
import { mountPersonalizeTrigger, replaceTokensInPrompt } from './personalize/personalizePopover.js';
import { TemplateThumbnailModal, mountThumbnailModal } from './modals/TemplateThumbnailModal.jsx';
import { requireEntitlement } from '../lib/clerkEntitlements.js';
import { getI2IModelById } from '../lib/models.js';
import { mountModelSelector } from '../lib/modelSelectorUI.js';
import { createAdvancedControls } from '../lib/studioControls.js';
import { getExtendedModel } from '../lib/modelInputExtensions.js';

const EDIT_AI_MODELS = [
  { id: 'flux-kontext-dev-i2i', name: 'Flux Kontext Dev I2I', hasPrompt: true },
  { id: 'flux-kontext-pro-i2i', name: 'Flux Kontext Pro I2I', hasPrompt: true },
  { id: 'flux-kontext-max-i2i', name: 'Flux Kontext Max I2I', hasPrompt: true },
  { id: 'gpt4o-image-to-image', name: 'GPT-4o Image To Image', hasPrompt: true },
  { id: 'gpt4o-edit', name: 'GPT-4o Edit', hasPrompt: true },
  { id: 'gpt-image-1.5-edit', name: 'Gpt Image 1.5 Edit', hasPrompt: true },
  { id: 'midjourney-v7-image-to-image', name: 'Midjourney v7 Image To Image', hasPrompt: true },
  { id: 'midjourney-v7-style-reference', name: 'Midjourney v7 Style Reference', hasPrompt: true },
  { id: 'midjourney-v7-omni-reference', name: 'Midjourney v7 Omni Reference', hasPrompt: true },
  { id: 'bytedance-seededit-v3', name: 'Bytedance Seededit v3', hasPrompt: true },
  { id: 'bytedance-seedream-edit-v4', name: 'Bytedance Seedream Edit v4', hasPrompt: true },
  { id: 'bytedance-seedream-v4.5-edit', name: 'Bytedance Seedream v4.5 Edit', hasPrompt: true },
  { id: 'nano-banana-edit', name: 'Nano Banana Edit', hasPrompt: true },
  { id: 'nano-banana-pro-edit', name: 'Nano Banana Pro Edit', hasPrompt: true },
  { id: 'nano-banana-2-edit', name: 'Nano Banana 2 Edit', hasPrompt: true },
  { id: 'qwen-image-edit', name: 'Qwen Image Edit', hasPrompt: true },
  { id: 'qwen-image-edit-plus', name: 'Qwen Image Edit Plus', hasPrompt: true },
  { id: 'qwen-image-edit-2511', name: 'Qwen Image Edit 2511', hasPrompt: true },
  { id: 'ideogram-character', name: 'Ideogram Character', hasPrompt: true },
  { id: 'wan2.5-image-edit', name: 'Wan2.5 Image Edit', hasPrompt: true },
  { id: 'wan2.6-image-edit', name: 'Wan2.6 Image Edit', hasPrompt: true },
  { id: 'reve-image-edit', name: 'Reve Image Edit', hasPrompt: true },
  { id: 'kling-o1-edit-image', name: 'Kling O1 Edit Image', hasPrompt: true },
  { id: 'vidu-q2-reference-to-image', name: 'Vidu Q2 Reference To Image', hasPrompt: true },
  { id: 'grok-imagine-image-to-image', name: 'Grok Imagine Image To Image', hasPrompt: true },
  { id: 'flux-2-dev-edit', name: 'Flux 2 Dev Edit', hasPrompt: true },
  { id: 'flux-2-flex-edit', name: 'Flux 2 Flex Edit', hasPrompt: true },
  { id: 'flux-2-pro-edit', name: 'Flux 2 Pro Edit', hasPrompt: true },
  { id: 'flux-2-klein-4b-edit', name: 'Flux 2 Klein 4b Edit', hasPrompt: true },
  { id: 'flux-2-klein-9b-edit', name: 'Flux 2 Klein 9b Edit', hasPrompt: true },
  { id: 'flux-redux', name: 'Flux Redux', hasPrompt: true },
];

const EDIT_TOOLS = [
  { id: 'ai-object-eraser', name: 'Remove Object', description: 'Erase unwanted objects from images', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 5H9l-7 7 7 7h11a2 2 0 002-2V7a2 2 0 00-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg>', hasPrompt: false },
  { id: 'ai-background-remover', name: 'Remove Background', description: 'Clean background removal', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 3l18 18"/></svg>', hasPrompt: false },
  { id: 'ai-image-extension', name: 'Extend Image', description: 'AI outpainting to expand images', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>', hasPrompt: false },
  { id: 'seedream-5.0-edit', name: 'AI Edit', description: 'Instruction-based image editing', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>', hasPrompt: true, promptPlaceholder: 'Describe the edit...' },
  { id: 'ideogram-v3-reframe', name: 'Reframe', description: 'Change aspect ratio intelligently', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2"/><rect x="6" y="6" width="12" height="12" rx="1"/></svg>', hasPrompt: false },
  { id: 'ai-dress-change', name: 'Change Dress', description: 'AI outfit and clothing swap', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.38 3.46L16 2 12 5.5 8 2l-4.38 1.46a2 2 0 00-1.34 2.31l2.1 9.89A2 2 0 006.34 17H7l-2 5h14l-2-5h.66a2 2 0 001.96-1.34l2.1-9.89a2 2 0 00-1.34-2.31z"/></svg>', hasPrompt: false },
  { id: 'ai-skin-enhancer', name: 'Enhance Skin', description: 'Professional skin retouching', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>', hasPrompt: false },
  { id: 'ai-color-photo', name: 'Colorize', description: 'Add color to B&W photos', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="19" cy="13" r="2.5"/><circle cx="7" cy="13" r="2.5"/><circle cx="13.5" cy="19.5" r="2.5"/></svg>', hasPrompt: false },
  { id: 'add-image-watermark', name: 'Add Watermark', description: 'Overlay watermark on images', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>', hasPrompt: false },
  { id: 'ai-image-upscaler', name: 'Upscale', description: 'AI image upscaling to higher resolution', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>', hasPrompt: false },
  { id: 'ai-image-face-swap', name: 'Face Swap', description: 'Swap faces in images', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M12 6v6l4 2"/></svg>', hasPrompt: false },
  { id: 'ai-product-shot', name: 'Product Shot', description: 'Create professional product images', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="3"/></svg>', hasPrompt: true, promptPlaceholder: 'Describe the scene...' },
  { id: 'ai-ghibli-style', name: 'Ghibli Style', description: 'Transform into Studio Ghibli art style', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>', hasPrompt: false },
];

export function EditStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col bg-app-bg overflow-y-auto relative';
  mountStudioChrome(container, { currentRoute: 'edit' });

  let activeTool = null;
  let uploadedUrl = null;
let lastOutputUrl = null;
  let customThumbnailUrl = getCustomThumbnailFromCache('edit-studio');
  let currentBlobUrl = null;
  let selectedModelId = 'seedream-5.0-edit';

  // Control values for static tools
  let aspectRatioValue = '1:1';
  let qualityValue = 'basic';
  let targetIndexValue = '0';
  let numImagesValue = '1';
  let renderSpeedValue = 'Balanced';
  let styleValue = 'Auto';
  let watermarkPositionValue = 'bottom-right';
  let watermarkOpacityValue = '0.7';
  let watermarkScaleValue = '0.2';

  // Dynamic controls for dropdown models
  let dynamicControls = null;
  let dynamicControlsContainer = null;

  const topBar = document.createElement('div');
  topBar.className = 'px-4 md:px-8 pt-6 pb-4 shrink-0';
  const editBanner = createHeroSection('edit', 'h-32 md:h-44 mb-4');
  if (editBanner) {
    const bannerText = document.createElement('div');
    bannerText.className = 'absolute bottom-0 left-0 right-0 p-4 z-10';
    bannerText.innerHTML = '<h1 class="text-2xl md:text-3xl font-black text-white tracking-tight mb-1">Edit Studio</h1><p class="text-white/60 text-xs">13 AI-powered editing tools for images</p>';
    editBanner.appendChild(bannerText);
    topBar.appendChild(editBanner);
  } else {
    topBar.innerHTML = '<h1 class="text-2xl md:text-3xl font-black text-white tracking-tight mb-1">Edit Studio</h1><p class="text-secondary text-xs mb-5">13 AI-powered editing tools for images</p>';
  }

  const toolGrid = document.createElement('div');
  toolGrid.className = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2';

  EDIT_TOOLS.forEach(tool => {
    const card = document.createElement('div');
    card.className = 'bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden cursor-pointer hover:bg-white/[0.06] hover:border-white/10 transition-all group';
    const thumbSrc = getToolThumbnail(tool.id);
    if (thumbSrc) {
      const thumbWrapper = document.createElement('div');
      thumbWrapper.className = 'thumb-hero h-20 relative';
      thumbWrapper.innerHTML = '<div class="thumb-skeleton absolute inset-0"></div>';
      const img = createThumbnailImg(thumbSrc, tool.name, 'w-full h-full object-cover');
      thumbWrapper.appendChild(img);
      card.appendChild(thumbWrapper);
    }
    const info = document.createElement('div');
    info.className = 'p-3';
    info.innerHTML = `
      <div class="text-xs font-bold text-white group-hover:text-primary transition-colors">${tool.name}</div>
      <div class="text-[10px] text-muted mt-0.5">${tool.description}</div>
    `;
    card.appendChild(info);
    card.onclick = () => selectTool(tool, card);
    toolGrid.appendChild(card);
  });

  topBar.appendChild(toolGrid);

  const inlineInstructions = createInlineInstructions('edit');
  inlineInstructions.classList.add('px-4', 'md:px-8', 'mt-2');
  topBar.appendChild(inlineInstructions);
  container.appendChild(topBar);

  const personalizeRow = document.createElement('div');
  personalizeRow.className = 'flex items-center gap-2 px-4 md:px-8 pt-4';

  const recipeBtn = document.createElement('button');
  recipeBtn.type = 'button';
  recipeBtn.textContent = 'Recipes';
  recipeBtn.title = 'Browse AI recipes';
  recipeBtn.setAttribute('aria-label', 'Open recipe engine');
  recipeBtn.className = 'btn-ghost-modern shrink-0';
  recipeBtn.addEventListener('click', () => {
    openRecipeModal({ onRunRecipe: () => {} }).catch((err) => console.error('[Recipe] open failed:', err));
  });

  const monetizationBtn = document.createElement('button');
  monetizationBtn.type = 'button';
  monetizationBtn.textContent = '💼 Smart Video AI Monetize';
  monetizationBtn.title = "Open Smart Video AI Monetization Hub"
  monetizationBtn.setAttribute('aria-label', 'Open Smart Video AI Monetization Hub');
  monetizationBtn.className = 'btn-ghost-modern shrink-0';
  monetizationBtn.addEventListener('click', () => {
    openMonetizationHub().catch((err) => console.error('[Monetization] open failed:', err));
  });

  const promptGalleryBtn = document.createElement('button');
  promptGalleryBtn.type = 'button';
  promptGalleryBtn.textContent = 'Prompts';
  promptGalleryBtn.title = 'Browse prompt gallery';
  promptGalleryBtn.setAttribute('aria-label', 'Open prompt gallery');
  promptGalleryBtn.className = 'btn-ghost-modern shrink-0';
  promptGalleryBtn.addEventListener('click', () => {
    openPromptGallery({
      appTheme: 'editor-page',
      onSelect: (prompt) => {
        const ta = document.querySelector('input[data-advanced-field="extraInstructions"], textarea, input');
        if (ta) { ta.value = prompt; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus(); }
      }
    }).catch((err) => console.error('[PromptGallery] open failed:', err));
  });

  const modelPickerBtn = document.createElement('button');
  modelPickerBtn.type = 'button';
  modelPickerBtn.textContent = 'AI Pick';
  modelPickerBtn.title = 'Open intelligent model picker';
  modelPickerBtn.setAttribute('aria-label', 'Open model picker');
  modelPickerBtn.className = 'text-[11px] font-bold text-cyan-400 border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1.5 rounded-lg hover:bg-cyan-400/20 transition-colors ml-2 whitespace-nowrap';
  modelPickerBtn.addEventListener('click', () => {
    openModelPicker({}).catch((err) => console.error('[ModelPicker] open failed:', err));
  });

  personalizeRow.appendChild(recipeBtn);
  personalizeRow.appendChild(monetizationBtn);
  personalizeRow.appendChild(promptGalleryBtn);
  personalizeRow.appendChild(modelPickerBtn);
  container.appendChild(personalizeRow);

  const workArea = document.createElement('div');
  workArea.className = 'flex-1 px-4 md:px-8 pb-8';

  const workCard = document.createElement('div');
  workCard.className = 'relative max-w-xl mx-auto bg-white/[0.03] border border-white/5 rounded-2xl p-6 hidden flex-col gap-4';

  const toolTitle = document.createElement('div');
  toolTitle.className = 'text-sm font-bold text-primary';
  workCard.appendChild(toolTitle);

  const previewImg = document.createElement('img');
  previewImg.className = 'hidden w-full h-48 object-cover rounded-xl border border-white/10 cursor-zoom-in';

  const uploadHint = document.createElement('span');
  uploadHint.className = 'text-sm text-muted';
  uploadHint.textContent = 'Upload source image or video';

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'hidden text-xs font-bold text-red-400 hover:text-red-300 transition-colors';
  clearBtn.textContent = 'Remove';

  const uploadSection = document.createElement('div');
  uploadSection.className = 'flex flex-col gap-3';
  const uploadRow = document.createElement('div');
  uploadRow.className = 'flex items-center gap-4';

  const picker = createUploadPicker({
    anchorContainer: container,
    onSelect: ({ url }) => {
      uploadedUrl = url;
      previewImg.src = url;
      previewImg.classList.remove('hidden');
      uploadHint.textContent = 'Media uploaded';
      clearBtn.classList.remove('hidden');
    },
    onClear: () => {
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
        currentBlobUrl = null;
      }
      uploadedUrl = null;
      previewImg.classList.add('hidden');
      previewImg.src = '';
      previewImg.onerror = null;
      uploadHint.textContent = 'Upload source image or video';
      clearBtn.classList.add('hidden');
    },
    onFilePreview: (file) => {
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
        currentBlobUrl = null;
      }
      const blobUrl = URL.createObjectURL(file);
      currentBlobUrl = blobUrl;
      previewImg.src = blobUrl;
      previewImg.classList.remove('hidden');
      uploadHint.textContent = file.name;
      previewImg.onerror = () => {
        previewImg.classList.add('hidden');
        uploadHint.textContent = 'Preview failed to load';
      };
    },
  });

  clearBtn.onclick = (e) => {
    e.stopPropagation();
    picker.reset();
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl);
      currentBlobUrl = null;
    }
    uploadedUrl = null;
    previewImg.classList.add('hidden');
    previewImg.src = '';
    previewImg.onerror = null;
    uploadHint.textContent = 'Upload source image or video';
    clearBtn.classList.add('hidden');
  };

  uploadRow.appendChild(picker.trigger);
  uploadRow.appendChild(uploadHint);
  uploadRow.appendChild(clearBtn);

  // Pexels browse button
  const pexelsEditBtn = document.createElement('button');
  pexelsEditBtn.type = 'button';
  pexelsEditBtn.title = 'Browse photos to edit from Pexels';
  pexelsEditBtn.className = 'w-10 h-10 shrink-0 rounded-xl border transition-all flex items-center justify-center bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40 group relative overflow-hidden';
  pexelsEditBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-secondary group-hover:text-primary"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>';
  pexelsEditBtn.onclick = async () => {
    const { browsePexelsImages } = await import('../lib/studioPexels.js');
    browsePexelsImages({
      title: 'Select Photo to Edit',
      studioName: 'Edit Studio',
      onSelect: (asset) => {
        uploadedUrl = asset.src?.large || asset.url || asset.original;
        previewImg.src = uploadedUrl;
        previewImg.classList.remove('hidden');
        uploadHint.textContent = 'Loaded from Pexels';
        clearBtn.classList.remove('hidden');
        const attrContainer = document.getElementById('pexels-edit-attribution');
        if (attrContainer) {
          attrContainer.innerHTML = '';
          import('../lib/attributionChip.js').then(mod => mod.renderAttributionChip(asset, attrContainer));
        }
        showToast('Photo loaded from Pexels', 'success');
      }
    });
  };
  uploadRow.appendChild(pexelsEditBtn);

  // Pexels attribution container
  const pexelsEditAttr = document.createElement('div');
  pexelsEditAttr.id = 'pexels-edit-attribution';
  pexelsEditAttr.className = 'mt-2';
  uploadSection.appendChild(pexelsEditAttr);

  uploadSection.appendChild(uploadRow);
  uploadSection.appendChild(previewImg);
  workCard.appendChild(uploadSection);
  container.appendChild(picker.panel);

// Watermark image uploader — declared here (before first use) to avoid a
  // temporal-dead-zone ReferenceError when the row below appends .trigger/.panel.
  let watermarkImageUrl = null;
  const watermarkImageHint = document.createElement('span');
  watermarkImageHint.className = 'text-sm text-muted hidden';
  watermarkImageHint.textContent = 'Upload watermark image';

  const watermarkClearBtn = document.createElement('button');
  watermarkClearBtn.type = 'button';
  watermarkClearBtn.className = 'hidden text-xs font-bold text-red-400 hover:text-red-300 transition-colors';
  watermarkClearBtn.textContent = 'Remove';

  const watermarkPicker = createUploadPicker({
    anchorContainer: container,
    onSelect: ({ url }) => {
      watermarkImageUrl = url;
      watermarkImageHint.textContent = 'Watermark uploaded';
      watermarkImageHint.classList.remove('hidden');
      watermarkClearBtn.classList.remove('hidden');
    },
    onClear: () => {
      watermarkImageUrl = null;
      watermarkImageHint.textContent = 'Upload watermark image';
      watermarkImageHint.classList.add('hidden');
      watermarkClearBtn.classList.add('hidden');
    },
  });

  watermarkClearBtn.onclick = (e) => {
    e.stopPropagation();
    watermarkPicker.reset();
    watermarkImageUrl = null;
    watermarkImageHint.textContent = 'Upload watermark image';
    watermarkImageHint.classList.add('hidden');
    watermarkClearBtn.classList.add('hidden');
  };

  // Watermark image upload row (hidden by default)
  const watermarkImageRow = document.createElement('div');
  watermarkImageRow.className = 'watermark-image-row hidden flex flex-col gap-3';
  const watermarkImageRowInner = document.createElement('div');
  watermarkImageRowInner.className = 'flex items-center gap-4';
  watermarkImageRowInner.appendChild(watermarkPicker.trigger);
  watermarkImageRowInner.appendChild(watermarkImageHint);
  watermarkImageRowInner.appendChild(watermarkClearBtn);
  watermarkImageRow.appendChild(watermarkImageRowInner);
  container.appendChild(watermarkPicker.panel);
  workCard.appendChild(watermarkImageRow);

  const promptField = document.createElement('input');
  promptField.type = 'text';
  promptField.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors hidden';
promptField.setAttribute('aria-label', 'Edit prompt');
  workCard.appendChild(promptField);
  workCard.appendChild(negativePromptLabel);
  workCard.appendChild(negativePromptField);
  workCard.appendChild(controlsContainer);

  const controlsRow = document.createElement('div');
  controlsRow.className = 'flex flex-col gap-3 hidden';
  workCard.appendChild(controlsRow);

  const aspectRatioSelect = document.createElement('select');
  aspectRatioSelect.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-primary/50 transition-colors';
  aspectRatioSelect.setAttribute('aria-label', 'Aspect ratio');
  [
    { value: '1:1', label: '1:1' },
    { value: '16:9', label: '16:9' },
    { value: '9:16', label: '9:16' },
    { value: '4:3', label: '4:3' },
    { value: '3:4', label: '3:4' },
    { value: '2:3', label: '2:3' },
    { value: '3:2', label: '3:2' },
    { value: '21:9', label: '21:9' },
  ].forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    aspectRatioSelect.appendChild(option);
  });
  aspectRatioSelect.addEventListener('change', () => {
    aspectRatioValue = aspectRatioSelect.value;
  });
  controlsRow.appendChild(aspectRatioSelect);

  const qualitySelect = document.createElement('select');
  qualitySelect.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-primary/50 transition-colors';
  qualitySelect.setAttribute('aria-label', 'Quality');
  [
    { value: 'basic', label: 'Basic' },
    { value: 'high', label: 'High' },
  ].forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    qualitySelect.appendChild(option);
  });
  qualitySelect.addEventListener('change', () => {
    qualityValue = qualitySelect.value;
  });
  controlsRow.appendChild(qualitySelect);

  const numImagesSelect = document.createElement('select');
  numImagesSelect.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-primary/50 transition-colors';
  numImagesSelect.setAttribute('aria-label', 'Number of images');
  [1, 2, 3, 4].forEach(n => {
    const option = document.createElement('option');
    option.value = String(n);
    option.textContent = String(n);
    numImagesSelect.appendChild(option);
  });
  numImagesSelect.addEventListener('change', () => {
    numImagesValue = numImagesSelect.value;
  });

  const renderSpeedSelect = document.createElement('select');
  renderSpeedSelect.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-primary/50 transition-colors';
  renderSpeedSelect.setAttribute('aria-label', 'Render speed');
  ['Turbo', 'Balanced', 'Quality'].forEach(speed => {
    const option = document.createElement('option');
    option.value = speed;
    option.textContent = speed;
    renderSpeedSelect.appendChild(option);
  });
  renderSpeedSelect.addEventListener('change', () => {
    renderSpeedValue = renderSpeedSelect.value;
  });

  const styleSelect = document.createElement('select');
  styleSelect.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-primary/50 transition-colors';
  styleSelect.setAttribute('aria-label', 'Style');
  ['Auto', 'General', 'Realistic', 'Design'].forEach(s => {
    const option = document.createElement('option');
    option.value = s;
    option.textContent = s;
    styleSelect.appendChild(option);
  });
  styleSelect.addEventListener('change', () => {
    styleValue = styleSelect.value;
  });

  const targetIndexInput = document.createElement('input');
  targetIndexInput.type = 'number';
  targetIndexInput.min = '0';
  targetIndexInput.max = '10';
  targetIndexInput.value = '0';
  targetIndexInput.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-primary/50 transition-colors';
  targetIndexInput.setAttribute('aria-label', 'Target face index');
  targetIndexInput.addEventListener('input', () => {
    targetIndexValue = targetIndexInput.value;
  });

  const watermarkPositionSelect = document.createElement('select');
  watermarkPositionSelect.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-primary/50 transition-colors';
  watermarkPositionSelect.setAttribute('aria-label', 'Watermark position');
  ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'].forEach(pos => {
    const option = document.createElement('option');
    option.value = pos;
    option.textContent = pos.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
    watermarkPositionSelect.appendChild(option);
  });
  watermarkPositionSelect.addEventListener('change', () => {
    watermarkPositionValue = watermarkPositionSelect.value;
  });

  const watermarkOpacityInput = document.createElement('input');
  watermarkOpacityInput.type = 'number';
  watermarkOpacityInput.min = '0';
  watermarkOpacityInput.max = '1';
  watermarkOpacityInput.step = '0.1';
  watermarkOpacityInput.value = '0.7';
  watermarkOpacityInput.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-primary/50 transition-colors';
  watermarkOpacityInput.setAttribute('aria-label', 'Watermark opacity');
  watermarkOpacityInput.addEventListener('input', () => {
    watermarkOpacityValue = watermarkOpacityInput.value;
  });

  const watermarkScaleInput = document.createElement('input');
  watermarkScaleInput.type = 'number';
  watermarkScaleInput.min = '0.1';
  watermarkScaleInput.max = '1';
  watermarkScaleInput.step = '0.1';
  watermarkScaleInput.value = '0.2';
  watermarkScaleInput.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-primary/50 transition-colors';
  watermarkScaleInput.setAttribute('aria-label', 'Watermark scale');
  watermarkScaleInput.addEventListener('input', () => {
    watermarkScaleValue = watermarkScaleInput.value;
  });

  // Model selector — split-pane picker, consistent with the other studios.
  // (Originally a native <select>; replaced to match the unified design.)
  const modelSelect = document.createElement('button');
  modelSelect.type = 'button';
  modelSelect.className = 'flex items-center gap-2 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm hover:bg-white/10 transition-colors hidden';
  modelSelect.setAttribute('aria-label', 'AI model');
  modelSelect.setAttribute('aria-haspopup', 'listbox');
  const modelSelectLabel = document.createElement('span');
  modelSelectLabel.className = 'flex-1 text-left truncate';
  modelSelect.appendChild(modelSelectLabel);
  modelSelect.insertAdjacentHTML('beforeend', '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-50 shrink-0"><path d="M6 9l6 6 6-6"/></svg>');

  const modelSelectPopover = document.createElement('div');
  modelSelectPopover.className = 'absolute left-0 top-full z-50 mt-2 hidden';
  modelSelectPopover.style.minWidth = '320px';

  const updateModelSelectLabel = () => {
    const m = (EDIT_AI_MODELS.find(x => x.id === selectedModelId) || EDIT_AI_MODELS[0]);
    modelSelectLabel.textContent = m ? m.name : selectedModelId;
  };
  updateModelSelectLabel();

  let modelSelectOpen = false;
  const closeModelSelect = () => {
    modelSelectOpen = false;
    modelSelectPopover.classList.add('hidden');
  };
  const openModelSelect = () => {
    if (modelSelectOpen) { closeModelSelect(); return; }
    modelSelectOpen = true;
    modelSelectPopover.classList.remove('hidden');
    mountModelSelector(modelSelectPopover, {
      models: EDIT_AI_MODELS,
      selectedModelId: selectedModelId,
      showProviderName: true,
      onSelectModel: (modelId) => {
        selectedModelId = modelId;
        updateModelSelectLabel();
        buildDynamicControls(selectedModelId);
        closeModelSelect();
      },
    });
  };
  modelSelect.onclick = (e) => { e.stopPropagation(); openModelSelect(); };
  document.addEventListener('click', (e) => {
    if (modelSelectOpen && !modelSelectPopover.contains(e.target) && e.target !== modelSelect) {
      closeModelSelect();
    }
  });

  workCard.appendChild(modelSelect);
  workCard.appendChild(modelSelectPopover);

  // Thumbnail studio button — next to creation controls, GTM Boost styling
  const thumbBtn = document.createElement('button');
  thumbBtn.type = 'button';
  thumbBtn.textContent = 'Thumbnail';
  thumbBtn.title = 'Generate a custom thumbnail';
  thumbBtn.className = 'btn-ghost-modern w-full';
  thumbBtn.addEventListener('click', () => {
    const modal = new TemplateThumbnailModal({
      appTheme: 'edit-studio',
      layout: 'panel',
      studioId: 'edit-studio',
      studioName: 'Edit Studio',
      aspectRatio: '1:1',
      outputType: 'image',
      onApply: ({ imageUrl }) => {
        customThumbnailUrl = imageUrl;
        saveCustomThumbnailToCache('edit-studio', imageUrl);
      },
      onClear: () => {
        customThumbnailUrl = null;
        clearCustomThumbnailCache('edit-studio');
      },
    });
    mountThumbnailModal(modal);
    modal.open();
  });
  workCard.appendChild(thumbBtn);

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'btn-primary-modern w-full px-[14px] py-2 min-h-[40px] text-[13px] font-bold rounded-2xl inline-flex items-center justify-center gap-1.5 transition-all';
  editBtn.textContent = 'Apply Edit';
  editBtn.setAttribute('aria-label', 'Apply edit');
  workCard.appendChild(editBtn);

const errorArea = document.createElement('div');
  errorArea.className = 'hidden mt-4';
  errorArea.setAttribute('role', 'alert');
  workCard.appendChild(errorArea);

  const resultArea = document.createElement('div');
  resultArea.className = 'hidden mt-4';
  resultArea.setAttribute('role', 'status');
  resultArea.setAttribute('aria-live', 'polite');
  workCard.appendChild(resultArea);

  workArea.appendChild(workCard);
  container.appendChild(workArea);

function buildDynamicControls(modelId) {
    const model = getI2IModelById(modelId);
    if (!model || !model.inputs || Object.keys(model.inputs).length === 0) {
      if (dynamicControlsContainer) dynamicControlsContainer.classList.add('hidden');
      return;
    }

    if (!dynamicControlsContainer) {
      dynamicControlsContainer = document.createElement('div');
      dynamicControlsContainer.className = 'flex flex-col gap-3';
      workCard.insertBefore(dynamicControlsContainer, controlsRow);
    }

    dynamicControlsContainer.classList.remove('hidden');

    if (dynamicControls) {
      dynamicControls.destroy();
    }

    const extendedModel = getExtendedModel(model);
    dynamicControls = createAdvancedControls({
      model: extendedModel,
      container: dynamicControlsContainer,
      exclude: new Set(['prompt']),
    });
  }

  function showControlsForTool(toolId) {
    controlsRow.innerHTML = '';
    promptField.classList.add('hidden');
    modelSelect.classList.add('hidden');
    modelSelectPopover.classList.add('hidden');
    if (dynamicControlsContainer) dynamicControlsContainer.classList.add('hidden');
    container.querySelectorAll('.watermark-image-row').forEach(el => el.classList.add('hidden'));

    if (toolId === 'seedream-5.0-edit') {
      modelSelect.classList.remove('hidden');
      updateModelSelectLabel();
      promptField.classList.remove('hidden');
      promptField.placeholder = 'Describe the edit...';
      buildDynamicControls(selectedModelId || 'seedream-5.0-edit');
    } else if (toolId === 'ideogram-v3-reframe') {
      controlsRow.classList.remove('hidden');
      controlsRow.appendChild(aspectRatioSelect);
      controlsRow.appendChild(renderSpeedSelect);
      controlsRow.appendChild(styleSelect);
      controlsRow.appendChild(numImagesSelect);
      aspectRatioSelect.value = aspectRatioValue;
      renderSpeedSelect.value = renderSpeedValue;
      styleSelect.value = styleValue;
      numImagesSelect.value = numImagesValue;
    } else if (toolId === 'add-image-watermark') {
      controlsRow.classList.remove('hidden');
      controlsRow.appendChild(watermarkPositionSelect);
      controlsRow.appendChild(watermarkOpacityInput);
      controlsRow.appendChild(watermarkScaleInput);
      watermarkPositionSelect.value = watermarkPositionValue;
      watermarkOpacityInput.value = watermarkOpacityValue;
      watermarkScaleInput.value = watermarkScaleValue;
      // Show watermark image upload row
      const wmImgRow = container.querySelector('.watermark-image-row');
      if (wmImgRow) wmImgRow.classList.remove('hidden');
    } else if (toolId === 'ai-image-face-swap') {
      controlsRow.classList.remove('hidden');
      controlsRow.appendChild(targetIndexInput);
      targetIndexInput.value = targetIndexValue;
    } else if (toolId === 'ai-product-shot') {
      promptField.classList.remove('hidden');
      promptField.placeholder = 'Describe the scene...';
    }
  }

  function selectTool(tool, cardEl) {
    activeTool = tool;
    toolGrid.querySelectorAll('.border-primary').forEach(el => {
      el.classList.remove('border-primary');
      el.classList.add('border-white/5');
    });
    cardEl.classList.remove('border-white/5');
    cardEl.classList.add('border-primary');

    workCard.classList.remove('hidden');
    workCard.classList.add('flex');
    toolTitle.textContent = tool.name;
    advancedOpen = false;
    renderControls(tool);

    referenceImageUrl = null;
    referencePreview.src = '';
    referencePreview.classList.add('hidden');
    referenceRow.classList.add('hidden');

showControlsForTool(tool.id);
    resultArea.classList.add('hidden');
    errorArea.classList.add('hidden');
  }

  editBtn.onclick = async () => {
    if (!(await requireEntitlement())) return;
    if (!activeTool) return;
    if (!uploadedUrl) { showError('Upload a source image first'); return; }

    // Validate static controls
    const faceIndex = parseInt(targetIndexValue, 10);
    if (activeTool.id === 'ai-image-face-swap' && (isNaN(faceIndex) || faceIndex < 0 || faceIndex > 10)) {
      showError('Target face index must be between 0 and 10'); return;
    }
    const wmOpacity = parseFloat(watermarkOpacityValue);
    if (activeTool.id === 'add-image-watermark' && (isNaN(wmOpacity) || wmOpacity < 0 || wmOpacity > 1)) {
      showError('Watermark opacity must be between 0 and 1'); return;
    }
    const wmScale = parseFloat(watermarkScaleValue);
    if (activeTool.id === 'add-image-watermark' && (isNaN(wmScale) || wmScale < 0.1 || wmScale > 1)) {
      showError('Watermark scale must be between 0.1 and 1'); return;
    }
    const numImages = parseInt(numImagesValue, 10);
    if (activeTool.id === 'ideogram-v3-reframe' && (isNaN(numImages) || numImages < 1 || numImages > 4)) {
      showError('Number of images must be between 1 and 4'); return;
    }

    const apiKey = apiKeyManager.getMuapiKey();
    if (!apiKey) { AuthModal(() => editBtn.click()); return; }

    editBtn.disabled = true;
    editBtn.innerHTML = '<span class="animate-spin inline-block mr-2">&#9711;</span> Processing...';
errorArea.classList.add('hidden');
    resultArea.classList.add('hidden');

    try {
      const modelToUse = selectedModelId || activeTool.id;
      const params = { model: modelToUse, image_url: uploadedUrl, thumbnail_url: customThumbnailUrl || undefined };
      const activeProfile = (() => { try { return JSON.parse(localStorage.getItem('remix_contact_profiles') || '[]').find((p) => p.id === localStorage.getItem('remix_selected_contact_id')) || null; } catch { return null; } })();

      if (modelToUse === 'ai-product-shot') {
        params.scene_description = replaceTokensInPrompt(promptField.value.trim(), activeProfile);
      } else if (activeTool.hasPrompt && promptField.value.trim()) {
        params.prompt = replaceTokensInPrompt(promptField.value.trim(), activeProfile);
      }

if (activeTool.id === 'seedream-5.0-edit' || modelToUse === 'seedream-5.0-edit') {
        params.aspect_ratio = aspectRatioValue;
        params.quality = qualityValue;
      }
      if (activeTool.id === 'ideogram-v3-reframe') {
        params.aspect_ratio = aspectRatioValue;
        params.render_speed = renderSpeedValue;
        params.style = styleValue;
        params.num_images = numImages;
      }
      if (activeTool.id === 'add-image-watermark') {
        params.position = watermarkPositionValue;
        params.opacity = wmOpacity;
        params.scale = wmScale;
        if (watermarkImageUrl) {
          params.watermark_image_url = watermarkImageUrl;
        }
      }
      if (activeTool.id === 'ai-image-face-swap') {
        params.target_index = faceIndex;
      }

      // Append dynamic model-specific controls via the control engine
      if (dynamicControls) {
        const dynamicPayload = dynamicControls.getPayload({});
        Object.assign(params, dynamicPayload);
      }

      const result = await muapi.generateI2I(params);
      updateProgress(null);

      if (result?.url) {
        lastOutputUrl = result.url;
        resultArea.classList.remove('hidden');
        resultArea.innerHTML = `
<img src="${result.url}" class="w-full rounded-xl border border-white/10 mb-3">
          <a href="${result.url}" download class="block w-full btn-secondary-modern py-2.5 rounded-xl font-bold text-sm text-center hover:shadow-glow transition-all">Download</a>
          <button type="button" class="publish-social-btn block w-full mt-2 bg-gradient-to-r from-[#6d5efc] to-[#a855f7] text-white py-2.5 rounded-xl font-bold text-sm text-center hover:shadow-glow transition-all">Publish to Social</button>
        `;
        const publishBtn = resultArea.querySelector('.publish-social-btn');
        if (publishBtn) publishBtn.onclick = () => openSocialPublish({ mediaUrl: lastOutputUrl, mediaType: 'image' });
      } else {
        resultArea.classList.remove('hidden');
        resultArea.innerHTML = `<div class="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl p-3">Edit completed, but no result image was returned. Please try again.</div>`;
      }
    } catch (err) {
      showError(err.message || 'An unexpected error occurred');
    } finally {
      editBtn.disabled = false;
      editBtn.textContent = 'Apply Edit';
      cancelBtn.classList.add('hidden');
    }
  };

  function showError(message) {
    errorArea.classList.remove('hidden');
    errorArea.innerHTML = `<div class="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl p-3">${message}</div>`;
  }

  return container;
}
