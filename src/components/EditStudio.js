import { muapi } from '../lib/muapi.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { AuthModal } from './AuthModal.js';
import { createUploadPicker } from './UploadPicker.js';
import { createInlineInstructions } from './InlineInstructions.js';
import { createHeroSection, getToolThumbnail, createThumbnailImg, getCustomThumbnailFromCache, saveCustomThumbnailToCache, clearCustomThumbnailCache } from '../lib/thumbnails.js';
import { replaceTokensInPrompt } from './personalize/personalizePopover.js';
import { getEnrichedModels } from '../lib/modelCatalog.js';

const EDIT_TOOLS = [
  {
    id: 'ai-object-eraser',
    name: 'Remove Object',
    description: 'Erase unwanted objects from images',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 5H9l-7 7 7 7h11a2 2 0 002-2V7a2 2 0 00-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg>',
    hasPrompt: false,
    requiresMask: true,
  },
  {
    id: 'ai-background-remover',
    name: 'Remove Background',
    description: 'Clean background removal',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 3l18 18"/></svg>',
    hasPrompt: false,
  },
  {
    id: 'ai-image-extension',
    name: 'Extend Image',
    description: 'AI outpainting to expand images',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
    hasPrompt: false,
  },
  {
    id: 'seedream-5.0-edit',
    name: 'AI Edit',
    description: 'Instruction-based image editing',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    hasPrompt: true,
    promptPlaceholder: 'Describe the edit...',
    controls: [
      { type: 'select', key: 'aspect_ratio', label: 'Aspect Ratio', options: ['1:1', '16:9', '9:16', '4:3', '3:4', '2:3', '3:2', '21:9'], default: '1:1' },
      { type: 'select', key: 'quality', label: 'Quality', options: ['basic', 'high'], default: 'basic' },
    ],
  },
  {
    id: 'ideogram-v3-reframe',
    name: 'Reframe',
    description: 'Change aspect ratio intelligently',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2"/><rect x="6" y="6" width="12" height="12" rx="1"/></svg>',
    hasPrompt: false,
    controls: [
      { type: 'select', key: 'aspect_ratio', label: 'Aspect Ratio', options: ['16:9', '9:16', '1:1', '4:3', '3:4'], default: '1:1' },
      { type: 'select', key: 'render_speed', label: 'Render Speed', options: ['Turbo', 'Balanced', 'Quality'], default: 'Balanced' },
      { type: 'select', key: 'style', label: 'Style', options: ['Auto', 'General', 'Realistic', 'Design'], default: 'Auto' },
      { type: 'number', key: 'num_images', label: 'Variations', min: 1, max: 4, step: 1, default: 1 },
    ],
  },
  {
    id: 'ai-dress-change',
    name: 'Change Dress',
    description: 'AI outfit and clothing swap',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.38 3.46L16 2 12 5.5 8 2l-4.38 1.46a2 2 0 00-1.34 2.31l2.1 9.89A2 2 0 006.34 17H7l-2 5h14l-2-5h.66a2 2 0 001.96-1.34l2.1-9.89a2 2 0 00-1.34-2.31z"/></svg>',
    hasPrompt: false,
    requiresGarment: true,
  },
  {
    id: 'ai-skin-enhancer',
    name: 'Enhance Skin',
    description: 'Professional skin retouching',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
    hasPrompt: false,
  },
  {
    id: 'ai-color-photo',
    name: 'Colorize',
    description: 'Add color to B&W photos',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="19" cy="13" r="2.5"/><circle cx="7" cy="13" r="2.5"/><circle cx="13.5" cy="19.5" r="2.5"/></svg>',
    hasPrompt: false,
  },
  {
    id: 'add-image-watermark',
    name: 'Add Watermark',
    description: 'Overlay watermark on images',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    hasPrompt: false,
    controls: [
      { type: 'select', key: 'position', label: 'Position', options: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'], default: 'bottom-right' },
      { type: 'range', key: 'opacity', label: 'Opacity', min: 0, max: 100, step: 1, default: 70, unit: '%' },
      { type: 'range', key: 'scale', label: 'Size', min: 5, max: 100, step: 1, default: 20, unit: '%' },
    ],
    requiresWatermarkImage: true,
  },
  {
    id: 'ai-image-upscaler',
    name: 'Upscale',
    description: 'AI image upscaling to higher resolution',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
    hasPrompt: false,
  },
  {
    id: 'ai-image-face-swap',
    name: 'Face Swap',
    description: 'Swap faces in images',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10S17.52 2 12 2z"/><path d="M12 6v6l4 2"/></svg>',
    hasPrompt: false,
    controls: [
      { type: 'number', key: 'target_index', label: 'Target Face Index', min: 0, max: 10, step: 1, default: 0 },
    ],
    requiresSwapImage: true,
  },
  {
    id: 'ai-product-shot',
    name: 'Product Shot',
    description: 'Create professional product images',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="3"/></svg>',
    hasPrompt: true,
    promptKey: 'scene_description',
    promptPlaceholder: 'Describe the product scene...',
  },
  {
    id: 'ai-ghibli-style',
    name: 'Ghibli Style',
    description: 'Transform into Studio Ghibli art style',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
    hasPrompt: false,
  },
];

const DYNAMIC_MODEL_CACHE_KEY = 'edit_studio_dynamic_models_v2';
const DYNAMIC_SCHEMA_CACHE_KEY = 'edit_studio_dynamic_schema_v1';

async function fetchDynamicModels() {
    try {
        const [i2iData, t2iData] = await Promise.all([
            getEnrichedModels('i2i').catch(() => []),
            getEnrichedModels('t2i').catch(() => []),
        ]);
        const merged = new Map();
        (i2iData || []).forEach(m => merged.set(m.id, m));
        (t2iData || []).forEach(m => merged.set(m.id, m));
        return Array.from(merged.values());
    } catch (e) {
        console.warn('[EditStudio] Failed to fetch dynamic model catalog:', e);
        return [];
    }
}

async function fetchModelSchema(modelId) {
    const schemaCache = getDynamicSchemaCache();
    if (schemaCache[modelId]) return schemaCache[modelId];

    const schema = await muapi.getModelSchema(modelId);
    schemaCache[modelId] = schema;
    try { localStorage.setItem(DYNAMIC_SCHEMA_CACHE_KEY, JSON.stringify(schemaCache)); } catch {}
    return schema;
}

function getDynamicModelCache() {
    try {
        const raw = localStorage.getItem(DYNAMIC_MODEL_CACHE_KEY);
        if (!raw) return [];
        const entry = JSON.parse(raw);
        if (Date.now() - entry.ts > 5 * 60 * 1000) {
            localStorage.removeItem(DYNAMIC_MODEL_CACHE_KEY);
            return [];
        }
        return entry.data || [];
    } catch {
        return [];
    }
}

function setDynamicModelCache(models) {
    try { localStorage.setItem(DYNAMIC_MODEL_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: models })); } catch {}
}

function getDynamicSchemaCache() {
    try {
        const raw = localStorage.getItem(DYNAMIC_SCHEMA_CACHE_KEY);
        if (!raw) return {};
        const entry = JSON.parse(raw);
        if (Date.now() - entry.ts > 5 * 60 * 1000) {
            localStorage.removeItem(DYNAMIC_SCHEMA_CACHE_KEY);
            return {};
        }
        return entry.data || {};
    } catch {
        return {};
    }
}

function isImageField(field) {
    const name = (field.name || '').toLowerCase();
    const title = (field.title || '').toLowerCase();
    const fieldType = (field.field || '').toLowerCase();
    if (fieldType === 'image') return true;
    if (name.includes('url') && (name.includes('image') || name.includes('img') || name.includes('swap') || name.includes('mask') || name.includes('watermark') || name.includes('garment'))) return true;
    if (title.includes('image') || title.includes('url')) return true;
    if (field.type === 'string' && name.includes('url')) return true;
    return false;
}

function buildControlsFromSchema(schema) {
    const controls = [];
    const properties = schema?.input_schema?.schemas?.input_data?.properties || {};
    const required = schema?.input_schema?.schemas?.input_data?.required || [];

    const entries = Object.entries(properties).filter(([key, field]) => {
        if (key === 'image_url') return false;
        if (key === 'images_list') return false;
        if (isImageField(field)) return false;
        return true;
    });

    entries.forEach(([key, field]) => {
        const name = field.name || key;
        const title = field.title || key;
        const fieldType = (field.field || '').toLowerCase();
        const type = field.type;

        if (field.enum && Array.isArray(field.enum)) {
            controls.push({ type: 'select', key, label: title, options: field.enum, default: field.default || field.enum[0] });
        } else if (type === 'boolean') {
            controls.push({ type: 'toggle', key, label: title, default: !!field.default });
        } else if (type === 'number' || type === 'integer' || type === 'int') {
            const min = typeof field.minValue === 'number' ? field.minValue : (typeof field.minimum === 'number' ? field.minimum : 0);
            const max = typeof field.maxValue === 'number' ? field.maxValue : (typeof field.maximum === 'number' ? field.maximum : 100);
            const step = typeof field.step === 'number' ? field.step : 1;
            const defaultVal = typeof field.default === 'number' ? field.default : (Array.isArray(field.examples) && field.examples[0] ? Number(field.examples[0]) : min);
            controls.push({ type: 'number', key, label: title, min, max, step, default: defaultVal });
        } else if (type === 'string') {
            if (fieldType === 'text' || fieldType === 'textarea' || fieldType === 'prompt') {
                controls.push({ type: 'text', key, label: title, placeholder: field.description || '' });
            } else {
                controls.push({ type: 'text', key, label: title, placeholder: field.description || '' });
            }
        }
    });

    return controls;
}

function buildDynamicToolFromSchema(modelId, schema) {
    const name = schema.name || modelId;
    const description = schema.description || '';
    const inputSchema = schema.input_schema?.schemas?.input_data || {};
    const properties = inputSchema.properties || {};
    const hasPrompt = !!properties.prompt || !!properties.scene_description;
    const promptKey = properties.prompt ? 'prompt' : (properties.scene_description ? 'scene_description' : null);
    const hasImagesList = !!properties.images_list;

    const extraUploads = [];
    Object.entries(properties).forEach(([key, field]) => {
        if (key === 'image_url') return;
        if (key === 'images_list') return;
        if (isImageField(field)) {
            const isSwap = key.toLowerCase().includes('swap');
            const isMask = key.toLowerCase().includes('mask');
            const isGarment = key.toLowerCase().includes('garment') || key.toLowerCase().includes('dress');
            const isWatermark = key.toLowerCase().includes('watermark');
            extraUploads.push({ key, isSwap, isMask, isGarment, isWatermark, label: field.title || key });
        }
    });

    return {
        id: modelId,
        name,
        description,
        hasPrompt,
        promptKey,
        promptPlaceholder: 'Describe the edit...',
        controls: buildControlsFromSchema(schema),
        requiresSwapImage: extraUploads.some(u => u.isSwap),
        requiresMask: extraUploads.some(u => u.isMask),
        requiresGarment: extraUploads.some(u => u.isGarment),
        requiresWatermarkImage: extraUploads.some(u => u.isWatermark),
        requiresMultiImage: hasImagesList,
        maxImages: properties.images_list?.maxItems || 10,
        extraUploads,
        isDynamic: true,
    };
}

export function EditStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col bg-app-bg overflow-y-auto relative';
  mountStudioChrome(container, { currentRoute: 'edit' });

  let activeTool = null;
  let uploadedUrl = null;
  let maskUrl = null;
  let garmentUrl = null;
  let swapUrl = null;
  let watermarkImageUrl = null;
  let multiImageUrls = [];
  let dynamicSchema = null;
  let dynamicModels = [];
  let dynamicModelsLoading = false;

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

  // Browse All Models section
  const browseSection = document.createElement('div');
  browseSection.className = 'mt-6';
  const browseHeader = document.createElement('div');
  browseHeader.className = 'flex items-center justify-between mb-3';
  browseHeader.innerHTML = `
    <div>
      <h2 class="text-sm font-black text-white">Browse All Models</h2>
      <p class="text-[10px] text-muted mt-0.5">Dynamic controls powered by live API schemas</p>
    </div>
    <button type="button" id="refresh-dynamic-models" class="text-[10px] font-bold text-primary hover:text-white transition-colors">Refresh</button>
  `;
  browseSection.appendChild(browseHeader);

  const dynamicGrid = document.createElement('div');
  dynamicGrid.className = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2';
  browseSection.appendChild(dynamicGrid);

  const dynamicStatus = document.createElement('div');
  dynamicStatus.className = 'text-[10px] text-muted mt-2 hidden';
  browseSection.appendChild(dynamicStatus);

  topBar.appendChild(browseSection);

  const inlineInstructions = createInlineInstructions('edit');
  inlineInstructions.classList.add('px-4', 'md:px-8', 'mt-2');
  topBar.appendChild(inlineInstructions);
  container.appendChild(topBar);

  const workArea = document.createElement('div');
  workArea.className = 'flex-1 px-4 md:px-8 pb-8';

  const workCard = document.createElement('div');
  workCard.className = 'max-w-xl mx-auto bg-white/[0.03] border border-white/5 rounded-2xl p-6 hidden flex-col gap-4';

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
      uploadedUrl = null;
      previewImg.classList.add('hidden');
      previewImg.src = '';
      uploadHint.textContent = 'Upload source image or video';
      clearBtn.classList.add('hidden');
    },
    onFilePreview: (file) => {
      const blobUrl = URL.createObjectURL(file);
      previewImg.src = blobUrl;
      previewImg.classList.remove('hidden');
      uploadHint.textContent = file.name;
    },
  });

  clearBtn.onclick = (e) => {
    e.stopPropagation();
    picker.reset();
    uploadedUrl = null;
    previewImg.classList.add('hidden');
    previewImg.src = '';
    uploadHint.textContent = 'Upload source image or video';
    clearBtn.classList.add('hidden');
  };

  uploadRow.appendChild(picker.trigger);
  uploadRow.appendChild(uploadHint);
  uploadRow.appendChild(clearBtn);
  uploadSection.appendChild(uploadRow);
  uploadSection.appendChild(previewImg);
  workCard.appendChild(uploadSection);
  container.appendChild(picker.panel);

  // Multi-image upload row for models with images_list
  const multiImagePreviewGrid = document.createElement('div');
  multiImagePreviewGrid.className = 'hidden grid grid-cols-4 gap-2 mt-2';
  const multiImageHint = document.createElement('span');
  multiImageHint.className = 'text-sm text-muted';
  multiImageHint.textContent = 'Upload reference images';
  const multiImageClearBtn = document.createElement('button');
  multiImageClearBtn.type = 'button';
  multiImageClearBtn.className = 'hidden text-xs font-bold text-red-400 hover:text-red-300 transition-colors';
  multiImageClearBtn.textContent = 'Remove All';
  const multiImageRow = document.createElement('div');
  multiImageRow.className = 'hidden flex flex-col gap-2';
  multiImageRow.appendChild(multiImageHint);
  multiImageRow.appendChild(multiImagePreviewGrid);
  multiImageRow.appendChild(multiImageClearBtn);

  const multiImagePicker = createUploadPicker({
    anchorContainer: container,
    multiple: true,
    onSelect: ({ urls }) => {
      multiImageUrls = urls;
      multiImagePreviewGrid.innerHTML = '';
      urls.forEach(url => {
        const img = document.createElement('img');
        img.src = url;
        img.className = 'w-full h-16 object-cover rounded-lg border border-white/10';
        multiImagePreviewGrid.appendChild(img);
      });
      multiImageHint.textContent = `${urls.length} image(s) uploaded`;
      multiImageHint.classList.remove('hidden');
      multiImagePreviewGrid.classList.remove('hidden');
      multiImageClearBtn.classList.remove('hidden');
    },
    onClear: () => {
      multiImageUrls = [];
      multiImagePreviewGrid.innerHTML = '';
      multiImageHint.textContent = 'Upload reference images';
      multiImageHint.classList.add('hidden');
      multiImagePreviewGrid.classList.add('hidden');
      multiImageClearBtn.classList.add('hidden');
    },
  });
  multiImageRow.appendChild(multiImagePicker.trigger);
  multiImageClearBtn.onclick = (e) => {
    e.stopPropagation();
    multiImagePicker.reset();
    multiImageUrls = [];
    multiImagePreviewGrid.innerHTML = '';
    multiImageHint.textContent = 'Upload reference images';
    multiImageHint.classList.add('hidden');
    multiImagePreviewGrid.classList.add('hidden');
    multiImageClearBtn.classList.add('hidden');
  };
  container.appendChild(multiImagePicker.panel);

  // Mask upload for ai-object-eraser
  const maskPicker = createUploadPicker({
    anchorContainer: container,
    onSelect: ({ url }) => {
      maskUrl = url;
      maskHint.textContent = 'Mask uploaded';
      maskHint.classList.remove('hidden');
      maskClearBtn.classList.remove('hidden');
    },
    onClear: () => {
      maskUrl = null;
      maskHint.textContent = 'Upload mask image';
      maskHint.classList.add('hidden');
      maskClearBtn.classList.add('hidden');
    },
  });
  const maskRow = document.createElement('div');
  maskRow.className = 'hidden flex flex-col gap-2';
  const maskHint = document.createElement('span');
  maskHint.className = 'text-sm text-muted';
  maskHint.textContent = 'Upload mask image';
  const maskClearBtn = document.createElement('button');
  maskClearBtn.type = 'button';
  maskClearBtn.className = 'hidden text-xs font-bold text-red-400 hover:text-red-300 transition-colors';
  maskClearBtn.textContent = 'Remove';
  maskClearBtn.onclick = (e) => {
    e.stopPropagation();
    maskPicker.reset();
    maskUrl = null;
    maskHint.textContent = 'Upload mask image';
    maskHint.classList.add('hidden');
    maskClearBtn.classList.add('hidden');
  };
  maskRow.appendChild(maskPicker.trigger);
  maskRow.appendChild(maskHint);
  maskRow.appendChild(maskClearBtn);
  container.appendChild(maskPicker.panel);

  // Garment upload for ai-dress-change
  const garmentPicker = createUploadPicker({
    anchorContainer: container,
    onSelect: ({ url }) => {
      garmentUrl = url;
      garmentHint.textContent = 'Garment uploaded';
      garmentHint.classList.remove('hidden');
      garmentClearBtn.classList.remove('hidden');
    },
    onClear: () => {
      garmentUrl = null;
      garmentHint.textContent = 'Upload garment image';
      garmentHint.classList.add('hidden');
      garmentClearBtn.classList.add('hidden');
    },
  });
  const garmentRow = document.createElement('div');
  garmentRow.className = 'hidden flex flex-col gap-2';
  const garmentHint = document.createElement('span');
  garmentHint.className = 'text-sm text-muted';
  garmentHint.textContent = 'Upload garment image';
  const garmentClearBtn = document.createElement('button');
  garmentClearBtn.type = 'button';
  garmentClearBtn.className = 'hidden text-xs font-bold text-red-400 hover:text-red-300 transition-colors';
  garmentClearBtn.textContent = 'Remove';
  garmentClearBtn.onclick = (e) => {
    e.stopPropagation();
    garmentPicker.reset();
    garmentUrl = null;
    garmentHint.textContent = 'Upload garment image';
    garmentHint.classList.add('hidden');
    garmentClearBtn.classList.add('hidden');
  };
  garmentRow.appendChild(garmentPicker.trigger);
  garmentRow.appendChild(garmentHint);
  garmentRow.appendChild(garmentClearBtn);
  container.appendChild(garmentPicker.panel);

  // Swap image upload for ai-image-face-swap
  const swapPicker = createUploadPicker({
    anchorContainer: container,
    onSelect: ({ url }) => {
      swapUrl = url;
      swapHint.textContent = 'Swap image uploaded';
      swapHint.classList.remove('hidden');
      swapClearBtn.classList.remove('hidden');
    },
    onClear: () => {
      swapUrl = null;
      swapHint.textContent = 'Upload swap face image';
      swapHint.classList.add('hidden');
      swapClearBtn.classList.add('hidden');
    },
  });
  const swapRow = document.createElement('div');
  swapRow.className = 'hidden flex flex-col gap-2';
  const swapHint = document.createElement('span');
  swapHint.className = 'text-sm text-muted';
  swapHint.textContent = 'Upload swap face image';
  const swapClearBtn = document.createElement('button');
  swapClearBtn.type = 'button';
  swapClearBtn.className = 'hidden text-xs font-bold text-red-400 hover:text-red-300 transition-colors';
  swapClearBtn.textContent = 'Remove';
  swapClearBtn.onclick = (e) => {
    e.stopPropagation();
    swapPicker.reset();
    swapUrl = null;
    swapHint.textContent = 'Upload swap face image';
    swapHint.classList.add('hidden');
    swapClearBtn.classList.add('hidden');
  };
  swapRow.appendChild(swapPicker.trigger);
  swapRow.appendChild(swapHint);
  swapRow.appendChild(swapClearBtn);
  container.appendChild(swapPicker.panel);

  // Watermark image upload for add-image-watermark
  const watermarkImagePicker = createUploadPicker({
    anchorContainer: container,
    onSelect: ({ url }) => {
      watermarkImageUrl = url;
      watermarkImageHint.textContent = 'Watermark image uploaded';
      watermarkImageHint.classList.remove('hidden');
      watermarkImageClearBtn.classList.remove('hidden');
    },
    onClear: () => {
      watermarkImageUrl = null;
      watermarkImageHint.textContent = 'Upload watermark image';
      watermarkImageHint.classList.add('hidden');
      watermarkImageClearBtn.classList.add('hidden');
    },
  });
  const watermarkImageRow = document.createElement('div');
  watermarkImageRow.className = 'hidden flex flex-col gap-2';
  const watermarkImageHint = document.createElement('span');
  watermarkImageHint.className = 'text-sm text-muted';
  watermarkImageHint.textContent = 'Upload watermark image';
  const watermarkImageClearBtn = document.createElement('button');
  watermarkImageClearBtn.type = 'button';
  watermarkImageClearBtn.className = 'hidden text-xs font-bold text-red-400 hover:text-red-300 transition-colors';
  watermarkImageClearBtn.textContent = 'Remove';
  watermarkImageClearBtn.onclick = (e) => {
    e.stopPropagation();
    watermarkImagePicker.reset();
    watermarkImageUrl = null;
    watermarkImageHint.textContent = 'Upload watermark image';
    watermarkImageHint.classList.add('hidden');
    watermarkImageClearBtn.classList.add('hidden');
  };
  watermarkImageRow.appendChild(watermarkImagePicker.trigger);
  watermarkImageRow.appendChild(watermarkImageHint);
  watermarkImageRow.appendChild(watermarkImageClearBtn);
  container.appendChild(watermarkImagePicker.panel);

  const promptField = document.createElement('input');
  promptField.type = 'text';
  promptField.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors hidden';
  promptField.setAttribute('aria-label', 'Edit prompt');

  const controlsContainer = document.createElement('div');
  controlsContainer.className = 'w-full flex flex-col gap-3';

  // Result area with before/after comparison
  const resultArea = document.createElement('div');
  resultArea.className = 'hidden mt-4';
  const resultToggle = document.createElement('div');
  resultToggle.className = 'flex items-center justify-between mb-2';
  const resultLabel = document.createElement('span');
  resultLabel.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
  resultLabel.textContent = 'Result';
  const resultViewToggle = document.createElement('div');
  resultViewToggle.className = 'flex gap-1 bg-white/5 rounded-lg p-0.5';
  const btnAfter = document.createElement('button');
  btnAfter.type = 'button';
  btnAfter.className = 'text-[10px] font-bold text-black bg-primary rounded-md px-2 py-1';
  btnAfter.textContent = 'After';
  const btnBefore = document.createElement('button');
  btnBefore.type = 'button';
  btnBefore.className = 'text-[10px] font-bold text-white hover:text-primary rounded-md px-2 py-1';
  btnBefore.textContent = 'Before';
  resultViewToggle.appendChild(btnBefore);
  resultViewToggle.appendChild(btnAfter);
  resultToggle.appendChild(resultLabel);
  resultToggle.appendChild(resultViewToggle);

  const resultContent = document.createElement('div');
  resultContent.className = 'relative';
  const resultImg = document.createElement('img');
  resultImg.className = 'w-full rounded-xl mb-3 border border-white/10';
  resultImg.alt = 'Result';
  const originalImg = document.createElement('img');
  originalImg.className = 'w-full rounded-xl mb-3 border border-white/10 hidden';
  originalImg.alt = 'Original';
  resultContent.appendChild(originalImg);
  resultContent.appendChild(resultImg);

  const resultActions = document.createElement('div');
  resultActions.className = 'flex gap-3';
  const downloadBtn = document.createElement('a');
  downloadBtn.className = 'flex-1 bg-primary text-black py-2.5 rounded-xl font-bold text-sm text-center hover:shadow-glow transition-all';
  downloadBtn.textContent = 'Download';
  const regenBtn = document.createElement('button');
  regenBtn.type = 'button';
  regenBtn.className = 'flex-1 bg-white/10 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-white/20 transition-all';
  regenBtn.textContent = 'Generate Again';

  resultActions.appendChild(downloadBtn);
  resultActions.appendChild(regenBtn);
  resultArea.appendChild(resultToggle);
  resultArea.appendChild(resultContent);
  resultArea.appendChild(resultActions);
  workCard.appendChild(resultArea);

  let showBefore = false;
  btnBefore.onclick = () => {
    showBefore = true;
    btnBefore.classList.add('text-black', 'bg-primary');
    btnBefore.classList.remove('text-white');
    btnAfter.classList.remove('text-black', 'bg-primary');
    btnAfter.classList.add('text-white');
    originalImg.classList.remove('hidden');
    resultImg.classList.add('hidden');
  };
  btnAfter.onclick = () => {
    showBefore = false;
    btnAfter.classList.add('text-black', 'bg-primary');
    btnAfter.classList.remove('text-white');
    btnBefore.classList.remove('text-black', 'bg-primary');
    btnBefore.classList.add('text-white');
    resultImg.classList.remove('hidden');
    originalImg.classList.add('hidden');
  };

  const editBtn = document.createElement('button');
  editBtn.className = 'w-full bg-primary text-black py-3 rounded-xl font-black text-sm hover:shadow-glow transition-all';
  editBtn.textContent = 'Apply Edit';

  // Insert prompt + controls above the action buttons
  workCard.appendChild(promptField);
  workCard.appendChild(controlsContainer);
  workCard.appendChild(editBtn);

  const progressContainer = document.createElement('div');
  progressContainer.className = 'hidden w-full flex-col gap-2';
  const progressBar = document.createElement('div');
  progressBar.className = 'w-full bg-white/10 rounded-full h-2 overflow-hidden';
  const progressFill = document.createElement('div');
  progressFill.className = 'h-full bg-primary rounded-full transition-all duration-300 w-0';
  const progressText = document.createElement('span');
  progressText.className = 'text-xs text-muted text-center';
  progressBar.appendChild(progressFill);
  progressContainer.appendChild(progressBar);
  progressContainer.appendChild(progressText);
  workCard.appendChild(progressContainer);

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'hidden w-full bg-white/5 border border-white/10 text-red-400 font-bold py-2 rounded-xl hover:bg-white/10 transition-all';
  cancelBtn.textContent = 'Cancel';
  workCard.appendChild(cancelBtn);

  workArea.appendChild(workCard);
  container.appendChild(workArea);

  let progressPoll = null;

  function updateProgress(percent, message) {
    if (percent === null) {
      progressContainer.classList.add('hidden');
      if (progressPoll) { clearInterval(progressPoll); progressPoll = null; }
      return;
    }
    progressFill.style.width = `${percent}%`;
    progressText.textContent = message || `Processing... ${Math.round(percent)}%`;
    progressContainer.classList.remove('hidden');
  }

  function showError(message) {
    resultContent.innerHTML = `<div class="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl p-3">${message}</div>`;
    resultArea.classList.remove('hidden');
    resultLabel.textContent = 'Error';
  }

  function renderResult(resultUrl) {
    resultArea.classList.remove('hidden');
    resultLabel.textContent = 'Result';
    resultImg.src = resultUrl;
    originalImg.src = uploadedUrl || '';
    showBefore = false;
    btnAfter.classList.add('text-black', 'bg-primary');
    btnAfter.classList.remove('text-white');
    btnBefore.classList.remove('text-black', 'bg-primary');
    btnBefore.classList.add('text-white');
    resultImg.classList.remove('hidden');
    originalImg.classList.add('hidden');
    downloadBtn.href = resultUrl;
  }

  function renderControls(tool) {
    controlsContainer.innerHTML = '';

    if (tool.hasPrompt) {
      promptField.classList.remove('hidden');
      promptField.placeholder = tool.promptPlaceholder || 'Describe...';
    } else {
      promptField.classList.add('hidden');
    }

    if (tool.controls) {
      tool.controls.forEach(ctrl => {
        const factory = CONTROL_FACTORIES[ctrl.type];
        if (factory) controlsContainer.appendChild(factory(ctrl));
      });
    }

    if (tool.dynamicControls) {
      tool.dynamicControls.forEach(ctrl => {
        const factory = CONTROL_FACTORIES[ctrl.type];
        if (factory) controlsContainer.appendChild(factory(ctrl));
      });
    }
  }

  function updateUploadVisibility(tool) {
    const isT2I = tool.mode === 't2i';
    const isI2I = tool.mode === 'i2i';

    uploadRow.classList.add('hidden');
    previewImg.classList.add('hidden');
    clearBtn.classList.add('hidden');
    uploadHint.textContent = 'Upload source image or video';
    picker.reset();
    uploadedUrl = null;

    multiImageRow.classList.add('hidden');
    multiImagePreviewGrid.innerHTML = '';
    multiImageHint.classList.add('hidden');
    multiImagePreviewGrid.classList.add('hidden');
    multiImageClearBtn.classList.add('hidden');
    multiImageHint.textContent = 'Upload reference images';
    multiImageUrls = [];

    if (isT2I) {
      uploadRow.classList.add('hidden');
      multiImageRow.classList.add('hidden');
    } else if (isI2I) {
      if (tool.requiresMultiImage) {
        multiImageRow.classList.remove('hidden');
      } else if (tool.requiresMask) {
        maskRow.classList.remove('hidden');
      } else if (tool.requiresGarment) {
        garmentRow.classList.remove('hidden');
      } else if (tool.requiresSwapImage) {
        swapRow.classList.remove('hidden');
      } else if (tool.requiresWatermarkImage) {
        watermarkImageRow.classList.remove('hidden');
      } else {
        uploadRow.classList.remove('hidden');
      }
    } else {
      uploadRow.classList.remove('hidden');
    }
  }

  async function selectTool(tool, cardEl) {
    activeTool = tool;
    dynamicSchema = null;

    if (cardEl) {
      toolGrid.querySelectorAll('.border-primary').forEach(el => {
        el.classList.remove('border-primary');
        el.classList.add('border-white/5');
      });
      cardEl.classList.remove('border-white/5');
      cardEl.classList.add('border-primary');
    }

    workCard.classList.remove('hidden');
    workCard.classList.add('flex');
    toolTitle.textContent = tool.name;

    updateUploadVisibility(tool);

    if (tool.isDynamic && tool.schema) {
      dynamicSchema = tool.schema;
      const enriched = buildDynamicToolFromSchema(tool.id, tool.schema);
      activeTool = enriched;
      renderControls(enriched);

      const properties = tool.schema.input_schema?.schemas?.input_data?.properties || {};
      Object.entries(properties).forEach(([key, field]) => {
        if (key === 'image_url') return;
        if (key === 'images_list') return;
        if (!isImageField(field)) return;
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('swap')) { swapRow.classList.remove('hidden'); }
        if (lowerKey.includes('mask')) { maskRow.classList.remove('hidden'); }
        if (lowerKey.includes('garment') || lowerKey.includes('dress')) { garmentRow.classList.remove('hidden'); }
        if (lowerKey.includes('watermark')) { watermarkImageRow.classList.remove('hidden'); }
      });
    } else {
      renderControls(tool);
    }

    if (!tool.isDynamic) {
      if (tool.requiresMask) maskRow.classList.remove('hidden');
      if (tool.requiresGarment) garmentRow.classList.remove('hidden');
      if (tool.requiresSwapImage) swapRow.classList.remove('hidden');
      if (tool.requiresWatermarkImage) watermarkImageRow.classList.remove('hidden');
      if (tool.requiresMultiImage) multiImageRow.classList.remove('hidden');
    }

    resultArea.classList.add('hidden');
    updateProgress(null);
  }

  async function loadDynamicModels() {
    if (dynamicModelsLoading) return;
    dynamicModelsLoading = true;
    dynamicStatus.classList.remove('hidden');
    dynamicStatus.textContent = 'Loading models...';

    try {
      const cached = getDynamicModelCache();
      if (cached.length > 0) {
        dynamicModels = cached;
        renderDynamicModels();
        dynamicStatus.textContent = `${cached.length} models available`;
        dynamicModelsLoading = false;
        return;
      }

      const catalog = await fetchDynamicModels();
      const i2iModels = catalog.filter(m => !EDIT_TOOLS.some(t => t.id === m.id));
      dynamicModels = i2iModels;
      setDynamicModelCache(dynamicModels);
      renderDynamicModels();
      dynamicStatus.textContent = `${dynamicModels.length} models available`;
    } catch (e) {
      dynamicStatus.textContent = 'Failed to load models';
      console.error(e);
    } finally {
      dynamicModelsLoading = false;
    }
  }

  async function renderDynamicModels() {
    dynamicGrid.innerHTML = '';
    const loadingEl = document.createElement('div');
    loadingEl.className = 'col-span-full text-[10px] text-muted';
    loadingEl.textContent = 'Loading schemas...';
    dynamicGrid.appendChild(loadingEl);

    const existingIds = new Set(EDIT_TOOLS.map(t => t.id));
    const toShow = dynamicModels.filter(m => !existingIds.has(m.id));

    const fragment = document.createDocumentFragment();
    const schemaPromises = toShow.map(async (model) => {
      try {
        const schema = await fetchModelSchema(model.id);
        return { model, schema };
      } catch {
        return { model, schema: null };
      }
    });

    const results = await Promise.all(schemaPromises);
    dynamicGrid.innerHTML = '';

    results.forEach(({ model, schema }) => {
      if (!schema) return;
      const card = document.createElement('div');
      card.className = 'bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden cursor-pointer hover:bg-white/[0.06] hover:border-white/10 transition-all group';
      const info = document.createElement('div');
      info.className = 'p-3';
      info.innerHTML = `
        <div class="text-xs font-bold text-white group-hover:text-primary transition-colors">${model.name || model.id}</div>
        <div class="text-[10px] text-muted mt-0.5">${model.description || 'Dynamic model'}</div>
      `;
      card.appendChild(info);
      card.onclick = () => {
        const enriched = buildDynamicToolFromSchema(model.id, schema);
        selectTool(enriched, card);
      };
      dynamicGrid.appendChild(card);
    });

    if (dynamicGrid.children.length === 0) {
      dynamicStatus.textContent = 'No additional models available';
    }
  }

  editBtn.onclick = async () => {
    if (!activeTool) return;
    if (activeTool.mode === 't2i' && !promptField.value.trim()) { showError('Enter a prompt first'); return; }
    if (activeTool.mode === 'i2i' && !uploadedUrl && multiImageUrls.length === 0) { showError('Upload a source image first'); return; }

    // Validate required secondary uploads
    if (activeTool.requiresMask && !maskUrl) { showError('Upload a mask image for Remove Object'); return; }
    if (activeTool.requiresGarment && !garmentUrl) { showError('Upload a garment image for Change Dress'); return; }
    if (activeTool.requiresSwapImage && !swapUrl) { showError('Upload a swap face image for Face Swap'); return; }
    if (activeTool.requiresWatermarkImage && !watermarkImageUrl) { showError('Upload a watermark image'); return; }
    if (activeTool.requiresMultiImage && multiImageUrls.length === 0) { showError('Upload reference images'); return; }

    // Validate dynamic schema required fields
    if (dynamicSchema) {
      const inputData = dynamicSchema.input_schema?.schemas?.input_data || {};
      const properties = inputData.properties || {};
      const required = inputData.required || [];
      const missing = required.filter(key => {
        if (key === 'image_url') return !uploadedUrl;
        if (key === 'images_list') return multiImageUrls.length === 0;
        if (key === 'prompt') return !promptField.value.trim();
        const field = properties[key];
        if (!field) return false;
        if (isImageField(field)) {
          if (key.toLowerCase().includes('swap')) return !swapUrl;
          if (key.toLowerCase().includes('mask')) return !maskUrl;
          if (key.toLowerCase().includes('garment') || key.toLowerCase().includes('dress')) return !garmentUrl;
          if (key.toLowerCase().includes('watermark')) return !watermarkImageUrl;
          return false;
        }
        const el = controlsContainer.querySelector(`[data-control-key="${key}"]`);
        if (!el) return true;
        return !el.value;
      });
      if (missing.length > 0) {
        showError(`Missing required fields: ${missing.join(', ')}`);
        return;
      }
    }

    const apiKey = localStorage.getItem('muapi_key');
    if (!apiKey) { AuthModal(() => editBtn.click()); return; }

    editBtn.disabled = true;
    editBtn.innerHTML = '<span class="animate-spin inline-block mr-2">&#9711;</span> Processing...';
    updateProgress(0, 'Starting...');

    if (progressPoll) clearInterval(progressPoll);
    progressPoll = setInterval(() => {
      const current = parseFloat(progressFill.style.width) || 0;
      const next = Math.min(current + Math.random() * 8 + 2, 90);
      updateProgress(next, `Processing... ${Math.round(next)}%`);
    }, 500);

    cancelBtn.classList.remove('hidden');
    cancelBtn.onclick = () => {
      if (progressPoll) { clearInterval(progressPoll); progressPoll = null; }
      updateProgress(null);
      editBtn.disabled = false;
      editBtn.textContent = 'Apply Edit';
      cancelBtn.classList.add('hidden');
    };

    try {
      const params = {
        model: activeTool.id,
      };

      if (activeTool.mode === 't2i') {
        params.prompt = replaceTokensInPrompt(promptField.value.trim());
      } else if (activeTool.mode === 'i2i') {
        if (multiImageUrls.length > 0) {
          params.images_list = multiImageUrls;
        } else if (uploadedUrl) {
          params.image_url = uploadedUrl;
        }
        if (promptField.value.trim()) {
          const promptKey = activeTool.promptKey || 'prompt';
          params[promptKey] = replaceTokensInPrompt(promptField.value.trim());
        }
      } else {
        if (uploadedUrl) params.image_url = uploadedUrl;
        if (activeTool.hasPrompt && promptField.value.trim()) {
          const promptKey = activeTool.promptKey || 'prompt';
          params[promptKey] = replaceTokensInPrompt(promptField.value.trim());
        }
      }

      if (maskUrl) params.mask_image_url = maskUrl;
      if (garmentUrl) params.garment_image_url = garmentUrl;
      if (swapUrl) params.swap_url = swapUrl;
      if (watermarkImageUrl) params.watermark_image_url = watermarkImageUrl;

      // Collect control values from DOM
      controlsContainer.querySelectorAll('select, input').forEach(el => {
        const key = el.dataset.controlKey;
        if (!key) return;
        if (el.type === 'number') {
          params[key] = parseFloat(el.value);
        } else {
          params[key] = el.value;
        }
      });

      const isT2I = activeTool.mode === 't2i';
      const result = isT2I
        ? await muapi.generateImage(params)
        : await muapi.generateI2I(params);
      updateProgress(null);

      if (result?.url) {
        renderResult(result.url);
      } else {
        showError('Edit completed, but no result image was returned. Please try again.');
      }
    } catch (err) {
      updateProgress(null);
      showError(err.message || 'An unexpected error occurred');
    } finally {
      editBtn.disabled = false;
      editBtn.textContent = 'Apply Edit';
      cancelBtn.classList.add('hidden');
    }
  };

  // Control factories
  function createRangeControl(control) {
    const wrapper = document.createElement('div');
    wrapper.className = 'flex flex-col gap-1.5';
    const label = document.createElement('label');
    label.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
    label.textContent = control.label;
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = control.min;
    slider.max = control.max;
    slider.step = control.step || 1;
    slider.value = control.default;
    slider.dataset.controlKey = control.key;
    slider.className = 'flex-1 h-2 bg-white/5 rounded-full appearance-none';
    const valueSpan = document.createElement('span');
    valueSpan.className = 'text-xs font-bold text-white w-16 text-right';
    const unitLabel = control.unitLabel || '';
    const updateValueSpan = (val) => {
      if (control.unit === 'deg') {
        valueSpan.textContent = `${Math.round(val)} deg`;
      } else {
        valueSpan.textContent = `${Math.round(val)}${control.unit || ''} ${unitLabel}`.trim();
      }
    };
    updateValueSpan(control.default);
    slider.oninput = () => {
      const val = parseFloat(slider.value);
      updateValueSpan(val);
    };
    wrapper.appendChild(label);
    wrapper.appendChild(valueSpan);
    wrapper.appendChild(slider);
    return wrapper;
  }

  function createSelectControl(control) {
    const wrapper = document.createElement('div');
    wrapper.className = 'flex flex-col gap-1.5';
    const label = document.createElement('label');
    label.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
    label.textContent = control.label;
    const select = document.createElement('select');
    select.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors';
    select.dataset.controlKey = control.key;
    control.options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt;
      option.textContent = opt;
      if (opt === control.default) option.selected = true;
      select.appendChild(option);
    });
    wrapper.appendChild(label);
    wrapper.appendChild(select);
    return wrapper;
  }

  function createNumberControl(control) {
    const wrapper = document.createElement('div');
    wrapper.className = 'flex flex-col gap-1.5';
    const label = document.createElement('label');
    label.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
    label.textContent = control.label;
    const numInput = document.createElement('input');
    numInput.type = 'number';
    numInput.min = control.min || 0;
    numInput.max = control.max || 999;
    numInput.step = control.step || 1;
    numInput.value = control.default;
    numInput.dataset.controlKey = control.key;
    numInput.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors';
    wrapper.appendChild(label);
    wrapper.appendChild(numInput);
    return wrapper;
  }

  function createToggleControl(control) {
    const wrapper = document.createElement('div');
    wrapper.className = 'flex items-center justify-between';
    const label = document.createElement('label');
    label.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
    label.textContent = control.label;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = `relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${control.default ? 'bg-primary' : 'bg-white/10'}`;
    toggle.dataset.controlKey = control.key;
    const dot = document.createElement('span');
    dot.className = `inline-block h-4 w-4 rounded-full bg-white transition-transform ${control.default ? 'translate-x-6' : 'translate-x-1'}`;
    toggle.appendChild(dot);
    toggle.onclick = () => {
      const isOn = toggle.classList.contains('bg-primary');
      if (isOn) {
        toggle.classList.remove('bg-primary');
        toggle.classList.add('bg-white/10');
        dot.classList.remove('translate-x-6');
        dot.classList.add('translate-x-1');
      } else {
        toggle.classList.remove('bg-white/10');
        toggle.classList.add('bg-primary');
        dot.classList.remove('translate-x-1');
        dot.classList.add('translate-x-6');
      }
    };
    wrapper.appendChild(label);
    wrapper.appendChild(toggle);
    return wrapper;
  }

  function createTextControl(control) {
    const wrapper = document.createElement('div');
    wrapper.className = 'flex flex-col gap-1.5';
    const label = document.createElement('label');
    label.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
    label.textContent = control.label;
    const textarea = document.createElement('textarea');
    textarea.placeholder = control.placeholder || '';
    textarea.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors resize-y';
    textarea.rows = 3;
    textarea.dataset.controlKey = control.key;
    wrapper.appendChild(label);
    wrapper.appendChild(textarea);
    return wrapper;
  }

  const CONTROL_FACTORIES = {
    range: createRangeControl,
    select: createSelectControl,
    number: createNumberControl,
    toggle: createToggleControl,
    text: createTextControl,
  };

  // Initialize dynamic models
  loadDynamicModels();

  if (browseHeader.querySelector('#refresh-dynamic-models')) {
    browseHeader.querySelector('#refresh-dynamic-models').onclick = async () => {
      localStorage.removeItem(DYNAMIC_MODEL_CACHE_KEY);
      localStorage.removeItem(DYNAMIC_SCHEMA_CACHE_KEY);
      dynamicModels = [];
      await loadDynamicModels();
    };
  }

  return container;
}
