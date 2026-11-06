import { muapi } from '../lib/muapi.js';
import { registerGeneration } from '../lib/generationHistory.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { AuthModal } from './AuthModal.js';
import { createUploadPicker } from './UploadPicker.js';
import { getToolThumbnail, createThumbnailImg, createStudioHeader } from '../lib/thumbnails.js';
import { replaceTokensInPrompt } from './personalize/personalizePopover.js';
import {
  AI_EDIT_MODEL_IDS, UPSCALE_MODEL_IDS, PRODUCT_MODEL_IDS,
  EFFECT_MODEL_IDS, ANGLE_MODEL_IDS, CHARACTER_MODEL_IDS,
  getModelSpec, getModelInfo,
} from './edit/editModels.js';
import { showToast } from '../lib/loading.js';
import { createMediaRemoveButton } from '../lib/studioHelpers.js';
import { createMaskPainter } from './edit/maskPainter.js';

// Edit Studio: a gallery of 16 image tools. Clicking a tool opens its own
// studio (inputs, settings, before/after preview) at /?tool=<slug>#/edit.
// Tools with several models (AI Edit, Upscale, Product Shot, Photo Effects,
// Character & Reference) show a Model picker; the studio adapts to the model.

export const EDIT_TOOLS = [
  {
    id: 'ai-object-eraser',
    slug: 'remove-object',
    howTo: 'Upload a photo, paint over what you want gone, then apply.',
    secondary: { key: 'mask_image_url', label: 'Mask image (optional)', hint: 'Upload a mask instead of painting: white = remove, black = keep.', optional: true },
    name: 'Remove Object',
    description: 'Erase unwanted objects from images',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 5H9l-7 7 7 7h11a2 2 0 002-2V7a2 2 0 00-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg>',
    hasPrompt: false,
  },
  {
    id: 'ai-background-remover',
    slug: 'remove-background',
    howTo: 'Upload a photo and get a clean cut-out with a transparent background.',
    name: 'Remove Background',
    description: 'Clean background removal',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 3l18 18"/></svg>',
    hasPrompt: false,
  },
  {
    id: 'ai-image-extension',
    slug: 'extend-image',
    howTo: 'Upload a photo and AI paints in more scene around its edges.',
    name: 'Extend Image',
    description: 'AI outpainting to expand images',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
    hasPrompt: false,
  },
  {
    id: 'seedream-5.0-edit',
    slug: 'ai-edit',
    models: AI_EDIT_MODEL_IDS,
    howTo: 'Upload a photo and describe the change, e.g. "make it night time".',
    promptRequired: true,
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
    slug: 'reframe',
    howTo: 'Upload a photo and pick a new aspect ratio; AI fills the new space.',
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
    slug: 'change-dress',
    howTo: 'Upload a photo of a person and a photo of the outfit to put on them.',
    secondary: { key: 'garment_image_url', label: 'Outfit image', hint: 'A clear photo of the clothing item.' },
    name: 'Change Dress',
    description: 'AI outfit and clothing swap',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.38 3.46L16 2 12 5.5 8 2l-4.38 1.46a2 2 0 00-1.34 2.31l2.1 9.89A2 2 0 006.34 17H7l-2 5h14l-2-5h.66a2 2 0 001.96-1.34l2.1-9.89a2 2 0 00-1.34-2.31z"/></svg>',
    hasPrompt: false,
  },
  {
    id: 'ai-skin-enhancer',
    slug: 'enhance-skin',
    howTo: 'Upload a portrait for natural, professional skin retouching.',
    name: 'Enhance Skin',
    description: 'Professional skin retouching',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
    hasPrompt: false,
  },
  {
    id: 'ai-color-photo',
    slug: 'colorize',
    howTo: 'Upload a black-and-white photo to bring it to life in color.',
    name: 'Colorize',
    description: 'Add color to B&W photos',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="19" cy="13" r="2.5"/><circle cx="7" cy="13" r="2.5"/><circle cx="13.5" cy="19.5" r="2.5"/></svg>',
    hasPrompt: false,
  },
  {
    id: 'add-image-watermark',
    slug: 'add-watermark',
    howTo: 'Upload a photo and your logo, then choose where it sits.',
    secondary: { key: 'watermark_image_url', label: 'Watermark / logo image', hint: 'A PNG with a transparent background works best.' },
    name: 'Add Watermark',
    description: 'Overlay watermark on images',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    hasPrompt: false,
    controls: [
      { type: 'select', key: 'position', label: 'Position', options: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'], default: 'bottom-right' },
      { type: 'range', key: 'opacity', label: 'Opacity', min: 0, max: 100, step: 1, default: 70, unit: '%' },
      { type: 'range', key: 'scale', label: 'Size', min: 5, max: 100, step: 1, default: 20, unit: '%' },
    ],
  },
  {
    id: 'ai-image-upscaler',
    slug: 'upscale',
    models: UPSCALE_MODEL_IDS,
    howTo: 'Upload a photo to sharpen it and increase its resolution.',
    name: 'Upscale',
    description: 'AI image upscaling to higher resolution',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
    hasPrompt: false,
  },
  {
    id: 'ai-image-face-swap',
    slug: 'face-swap',
    howTo: 'Upload the photo to change, then a clear photo of the new face.',
    secondary: { key: 'swap_url', label: 'New face photo', hint: 'A front-facing, well-lit face works best.' },
    name: 'Face Swap',
    description: 'Swap faces in images',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10S17.52 2 12 2z"/><path d="M12 6v6l4 2"/></svg>',
    hasPrompt: false,
    controls: [
      { type: 'number', key: 'target_index', label: 'Target Face Index', min: 0, max: 10, step: 1, default: 0 },
    ],
  },
  {
    id: 'ai-product-shot',
    slug: 'product-shot',
    models: PRODUCT_MODEL_IDS,
    howTo: 'Upload a product photo and describe the scene to place it in.',
    promptRequired: true,
    name: 'Product Shot',
    description: 'Create professional product images',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="3"/></svg>',
    hasPrompt: true,
    promptKey: 'scene_description',
    promptPlaceholder: 'Describe the product scene...',
  },
  {
    id: 'ai-ghibli-style',
    slug: 'ghibli-style',
    howTo: 'Upload any photo to redraw it in a hand-painted anime style.',
    name: 'Ghibli Style',
    description: 'Transform into Studio Ghibli art style',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
    hasPrompt: false,
  },
  {
    id: 'image-effects',
    slug: 'photo-effects',
    models: EFFECT_MODEL_IDS,
    presetKey: 'name',
    howTo: 'Upload a photo and pick a one-click look: 3D figurine, cyberpunk, 1980s, cartoon and more.',
    name: 'Photo Effects',
    description: 'One-click looks and styles for any photo',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/></svg>',
    hasPrompt: false,
  },
  {
    id: 'qwen-image-edit-plus-lora',
    slug: 'change-angle',
    models: ANGLE_MODEL_IDS,
    howTo: 'Upload a photo and re-shoot it from a new angle: rotate, move closer, look up or down.',
    name: 'Change Angle',
    description: 'Re-shoot a photo from a different camera angle',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>',
    hasPrompt: false,
  },
  {
    id: 'ideogram-character',
    slug: 'character-reference',
    models: CHARACTER_MODEL_IDS,
    sourceLabel: 'Reference image',
    howTo: 'Upload a person, product or style, then describe a new scene to put it in.',
    name: 'Character & Reference',
    description: 'Keep the same person, product or style in new scenes',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    hasPrompt: true,
    promptRequired: true,
    promptPlaceholder: 'Describe the new scene, e.g. "standing on a beach at sunset"...',
    promptMessage: 'Describe the scene you want the reference placed in.',
  },
];

/** Bundled model definition for a tool, shaped like the live API schema. */
/** Request fields that carry images (not user settings). */
function isImageField(key, field) {
  if (String(field?.field || '').toLowerCase() === 'image') return true;
  return /_url$|_urls$|^images?_list$|^reference_images$|^image$/.test(String(key || '').toLowerCase());
}

const PROMPT_KEYS = new Set(['prompt', 'scene_description']);
// native_audio is a video-only switch that some shared schemas carry along.
const HIDDEN_KEYS = new Set(['native_audio']);
const SIZE_KEYS = new Set(['width', 'height']);

/**
 * Settings for a model, from its definition in src/lib/models.js. A tool's
 * hand-written controls win for the tool's own model; other models use the
 * schema alone.
 */
export function getSchemaControls(tool, modelId = tool.id) {
  const properties = getModelSpec(modelId)?.inputs || {};
  const covered = modelId === tool.id ? new Set((tool.controls || []).map(c => c.key)) : new Set();
  const controls = [];
  for (const [key, field] of Object.entries(properties)) {
    if (covered.has(key) || PROMPT_KEYS.has(key) || HIDDEN_KEYS.has(key) || isImageField(key, field)) continue;
    const label = field.title || key.replace(/_/g, ' ');
    if (Array.isArray(field.enum)) {
      const type = key === tool.presetKey ? 'preset' : 'select';
      controls.push({ type, key, label, options: field.enum, default: field.default ?? field.enum[0] });
    } else if (field.type === 'boolean') {
      controls.push({ type: 'toggle', key, label, default: !!field.default });
    } else if (['number', 'integer', 'int'].includes(field.type)) {
      const min = field.minValue ?? field.minimum;
      const max = field.maxValue ?? field.maximum;
      const bounded = Number.isFinite(min) && Number.isFinite(max);
      if (bounded && !SIZE_KEYS.has(key)) {
        controls.push({ type: 'range', key, label, min, max, step: field.step || 1, default: field.default ?? min });
      } else {
        controls.push({ type: 'number', key, label, min: min ?? 0, max: max ?? 4096, step: field.step || 1, default: field.default ?? min ?? 0 });
      }
    } else if (field.type === 'string') {
      controls.push({ type: 'text', key, label, placeholder: field.description || '' });
    }
  }
  return controls;
}

export function getEditToolBySlug(slug) {
  return EDIT_TOOLS.find(tool => tool.slug === slug) || null;
}

/** First missing input for a tool, or null when it can run. */
export function validateEditInputs(tool, { sourceUrl, secondaryUrl, hasPaintedMask, prompt, modelId }) {
  if (!sourceUrl) return 'Upload a source image first.';
  if (tool.id === 'ai-object-eraser') {
    if (!hasPaintedMask && !secondaryUrl) return 'Paint over the object you want removed (or upload a mask).';
  } else if (tool.secondary && !tool.secondary.optional && !secondaryUrl) {
    return `Upload the ${tool.secondary.label.toLowerCase()}.`;
  }
  const promptKey = getModelSpec(modelId || tool.id)?.promptKey;
  if (promptKey && tool.promptRequired && !String(prompt || '').trim()) {
    return promptKey === 'scene_description' ? 'Describe the product scene.' : (tool.promptMessage || 'Describe the edit you want.');
  }
  return null;
}

function readToolFromUrl() {
  try {
    return getEditToolBySlug(new URLSearchParams(window.location.search).get('tool'));
  } catch {
    return null;
  }
}

function setToolInUrl(tool) {
  try {
    const params = new URLSearchParams(window.location.search);
    if (tool) params.set('tool', tool.slug);
    else params.delete('tool');
    const query = params.toString();
    const next = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash || '#/edit'}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.pushState({ editTool: tool?.slug || null }, '', next);
    }
  } catch { /* ignore */ }
}

const BTN_GHOST = 'text-xs font-bold px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-white/80 hover:text-white hover:bg-white/10 transition-colors';
const PANEL = 'bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex flex-col gap-3';
const LABEL = 'text-[11px] font-bold text-secondary uppercase tracking-wider';

export function EditStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col bg-app-bg overflow-y-auto relative';
  mountStudioChrome(container, { currentRoute: 'edit' });

  let activeTool = null;
  let source = null;     // { url, assetId }
  let extras = [];       // more reference images: [{ url, assetId }]
  let activeModelId = null;
  let secondary = null;  // { url, assetId }
  let resultUrl = null;
  let inFlight = false;
  const runs = [];
  let runId = 0;

  // ── Gallery view ───────────────────────────────────────────────────────
  const galleryView = document.createElement('div');
  galleryView.className = 'px-4 md:px-8 pt-6 pb-10';
  galleryView.dataset.editView = 'gallery';
  galleryView.appendChild(createStudioHeader('edit', 'Edit Studio', '16 AI editing tools: remove objects, backgrounds, reframe, effects and more', 'mb-5'));

  const toolGrid = document.createElement('div');
  toolGrid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4';
  toolGrid.dataset.editToolGrid = 'true';
  EDIT_TOOLS.forEach(tool => {
    const card = document.createElement('button');
    card.type = 'button';
    card.dataset.editTool = tool.slug;
    card.setAttribute('aria-label', `Open ${tool.name}`);
    card.className = 'text-left bg-white/[0.03] border border-white/5 rounded-2xl overflow-hidden hover:bg-white/[0.06] hover:border-primary/40 hover:-translate-y-0.5 transition-all group focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';
    const thumbWrapper = document.createElement('div');
    thumbWrapper.className = 'thumb-hero relative aspect-video bg-white/5 overflow-hidden';
    thumbWrapper.innerHTML = '<div class="thumb-skeleton absolute inset-0"></div>';
    const thumbSrc = getToolThumbnail(tool.id);
    if (thumbSrc) thumbWrapper.appendChild(createThumbnailImg(thumbSrc, tool.name, 'absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500'));
    const openChip = document.createElement('span');
    openChip.className = 'absolute bottom-2 right-2 text-[10px] font-black bg-primary/10 border border-primary/30 text-white rounded-full px-2.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity';
    openChip.textContent = 'Open studio →';
    thumbWrapper.appendChild(openChip);
    const info = document.createElement('div');
    info.className = 'p-3';
    const name = document.createElement('div');
    name.className = 'text-sm font-bold text-white group-hover:text-primary transition-colors';
    name.textContent = tool.name;
    const desc = document.createElement('div');
    desc.className = 'text-[11px] text-muted mt-0.5';
    desc.textContent = tool.description;
    info.append(name, desc);
    card.append(thumbWrapper, info);
    card.onclick = () => openTool(tool);
    toolGrid.appendChild(card);
  });
  galleryView.appendChild(toolGrid);
  container.appendChild(galleryView);

  // ── Tool studio view ───────────────────────────────────────────────────
  const studioView = document.createElement('div');
  studioView.className = 'hidden px-4 md:px-8 pt-6 pb-10 flex-col gap-5';
  studioView.dataset.editView = 'studio';

  const studioTop = document.createElement('div');
  studioTop.className = 'flex flex-col md:flex-row md:items-center gap-4';
  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = `${BTN_GHOST} self-start`;
  backBtn.textContent = '← All tools';
  backBtn.onclick = () => closeTool();
  const titleWrap = document.createElement('div');
  titleWrap.className = 'flex items-center gap-3 min-w-0 flex-1';
  const titleThumb = document.createElement('img');
  titleThumb.alt = '';
  titleThumb.className = 'hidden sm:block w-20 h-12 rounded-lg object-cover border border-white/10';
  const titleText = document.createElement('div');
  titleText.className = 'min-w-0';
  const toolTitle = document.createElement('h1');
  toolTitle.className = 'text-xl font-black text-white';
  const toolHowTo = document.createElement('p');
  toolHowTo.className = 'text-xs text-muted';
  titleText.append(toolTitle, toolHowTo);
  titleWrap.append(titleThumb, titleText);
  const switchLabel = document.createElement('label');
  switchLabel.className = 'flex items-center gap-2 text-xs text-muted';
  switchLabel.innerHTML = '<span class="whitespace-nowrap">Switch tool</span>';
  const toolSwitch = document.createElement('select');
  toolSwitch.className = 'bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50';
  toolSwitch.setAttribute('aria-label', 'Switch tool');
  EDIT_TOOLS.forEach(tool => {
    const option = document.createElement('option');
    option.value = tool.slug;
    option.textContent = tool.name;
    toolSwitch.appendChild(option);
  });
  toolSwitch.onchange = () => openTool(getEditToolBySlug(toolSwitch.value));
  switchLabel.appendChild(toolSwitch);
  studioTop.append(backBtn, titleWrap, switchLabel);
  studioView.appendChild(studioTop);

  const studioGrid = document.createElement('div');
  studioGrid.className = 'grid grid-cols-1 lg:grid-cols-[minmax(320px,420px)_1fr] gap-5 items-start';
  const leftCol = document.createElement('div');
  leftCol.className = 'flex flex-col gap-4';
  const rightCol = document.createElement('div');
  rightCol.className = 'flex flex-col gap-4 lg:sticky lg:top-4';
  studioGrid.append(leftCol, rightCol);
  studioView.appendChild(studioGrid);
  container.appendChild(studioView);

  // Model picker (tools that offer more than one model).
  const modelPanel = document.createElement('div');
  modelPanel.className = `${PANEL} hidden`;
  const modelLabel = document.createElement('label');
  modelLabel.className = LABEL;
  modelLabel.textContent = 'Model';
  modelLabel.htmlFor = 'edit-model-select';
  const modelSelect = document.createElement('select');
  modelSelect.id = 'edit-model-select';
  modelSelect.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors';
  const modelNote = document.createElement('p');
  modelNote.className = 'text-[11px] leading-relaxed text-muted';
  modelPanel.append(modelLabel, modelSelect, modelNote);
  modelSelect.onchange = () => applyModel(modelSelect.value);
  leftCol.appendChild(modelPanel);

  // Source image. Created and mounted before any other picker so "Use in
  // studio" from the Library lands here (earliest mounted picker wins).
  const sourcePanel = document.createElement('div');
  sourcePanel.className = PANEL;
  const sourceLabel = document.createElement('div');
  sourceLabel.className = LABEL;
  sourceLabel.textContent = 'Source image';
  const sourceRow = document.createElement('div');
  sourceRow.className = 'flex items-center gap-3';
  const sourceHint = document.createElement('span');
  sourceHint.className = 'text-sm text-muted';
  sourceHint.textContent = 'Upload the image to edit';
  const sourcePrompt = () => (activeTool?.sourceLabel ? 'Upload the reference image' : 'Upload the image to edit');
  sourcePanel.append(sourceLabel, sourceRow);
  leftCol.appendChild(sourcePanel);

  const picker = createUploadPicker({
    anchorContainer: container,
    muapiStudio: true,
    studioId: 'edit-studio',
    acceptVideo: false,
    acceptDocuments: false,
    onSelect: ({ url, assetId }) => setSource(url ? { url, assetId: assetId || null } : null),
    onClear: () => setSource(null),
    onFilePreview: (file) => {
      showBefore(URL.createObjectURL(file));
      sourceHint.textContent = `Uploading ${file.name}…`;
    },
  });
  sourceRow.appendChild(picker.trigger);
  container.appendChild(picker.panel);

  const pexelsBtn = document.createElement('button');
  pexelsBtn.type = 'button';
  pexelsBtn.title = 'Browse stock photos from Pexels';
  pexelsBtn.setAttribute('aria-label', 'Browse stock photos from Pexels');
  pexelsBtn.className = 'w-10 h-10 shrink-0 rounded-xl border transition-all flex items-center justify-center bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40 group';
  pexelsBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-secondary group-hover:text-primary"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>';
  pexelsBtn.onclick = async () => {
    const { browsePexelsImages } = await import('../lib/studioPexels.js');
    browsePexelsImages({
      title: 'Select Photo to Edit',
      studioName: 'Edit Studio',
      onSelect: (asset) => {
        const url = asset.src?.large || asset.src?.original || asset.url;
        if (url) setSource({ url, assetId: null });
      },
    });
  };
  const sourceClear = document.createElement('button');
  sourceClear.type = 'button';
  sourceClear.className = 'hidden ml-auto text-xs font-bold text-red-400 hover:text-red-300';
  sourceClear.textContent = 'Remove';
  sourceClear.onclick = () => { picker.reset(); setSource(null); };
  sourceRow.append(pexelsBtn, sourceHint, sourceClear);

  // More reference images, for models that accept several (Nano Banana 2 takes 14).
  const extrasPanel = document.createElement('div');
  extrasPanel.className = `${PANEL} hidden`;
  const extrasLabel = document.createElement('div');
  extrasLabel.className = LABEL;
  const extrasRow = document.createElement('div');
  extrasRow.className = 'flex items-center gap-3';
  const extrasHint = document.createElement('span');
  extrasHint.className = 'text-sm text-muted';
  extrasHint.textContent = 'Optional';
  const extrasGrid = document.createElement('div');
  extrasGrid.className = 'hidden grid grid-cols-4 gap-2';
  extrasPanel.append(extrasLabel, extrasRow, extrasGrid);
  leftCol.appendChild(extrasPanel);

  function renderExtras() {
    extrasGrid.innerHTML = '';
    extrasGrid.classList.toggle('hidden', extras.length === 0);
    extrasHint.textContent = extras.length ? `${extras.length} added` : 'Optional';
    extras.forEach((item, index) => {
      const cell = document.createElement('div');
      cell.className = 'relative';
      const img = document.createElement('img');
      img.src = item.url;
      img.alt = '';
      img.className = 'w-full h-16 object-cover rounded-lg border border-white/10';
      cell.appendChild(img);
      cell.appendChild(createMediaRemoveButton(() => {
        extras = extras.filter((_, i) => i !== index);
        renderExtras();
      }));
      extrasGrid.appendChild(cell);
    });
  }

  const extrasPicker = createUploadPicker({
    anchorContainer: container,
    muapiStudio: true,
    studioId: 'edit-studio',
    acceptVideo: false,
    acceptDocuments: false,
    maxImages: 2,
    onSelect: ({ assets }) => {
      extras = (assets || []).map(a => ({ url: a.url, assetId: a.assetId || null }));
      renderExtras();
    },
    onClear: () => { extras = []; renderExtras(); },
  });
  extrasRow.append(extrasPicker.trigger, extrasHint);
  container.appendChild(extrasPicker.panel);

  // Remove Object: paint the mask on the source image.
  const maskPanel = document.createElement('div');
  maskPanel.className = `${PANEL} hidden`;
  const maskLabel = document.createElement('div');
  maskLabel.className = LABEL;
  maskLabel.textContent = 'Select what to remove';
  const maskEmpty = document.createElement('p');
  maskEmpty.className = 'text-[11px] text-muted';
  maskEmpty.textContent = 'Upload a source image, then paint over the object.';
  const maskPainter = createMaskPainter({ onChange: () => {} });
  maskPainter.element.classList.add('hidden');
  maskPanel.append(maskLabel, maskEmpty, maskPainter.element);
  leftCol.appendChild(maskPanel);

  // The tool's second image (outfit, face, logo, or an uploaded mask).
  const secondaryPanel = document.createElement('div');
  secondaryPanel.className = `${PANEL} hidden`;
  const secondaryLabel = document.createElement('div');
  secondaryLabel.className = LABEL;
  const secondaryHelp = document.createElement('p');
  secondaryHelp.className = 'text-[11px] text-muted';
  const secondaryRow = document.createElement('div');
  secondaryRow.className = 'flex items-center gap-3';
  const secondaryPreview = document.createElement('img');
  secondaryPreview.alt = '';
  secondaryPreview.className = 'hidden w-16 h-16 rounded-lg object-cover border border-white/10';
  const secondaryHint = document.createElement('span');
  secondaryHint.className = 'text-sm text-muted';
  secondaryHint.textContent = 'Not uploaded yet';
  const secondaryClear = document.createElement('button');
  secondaryClear.type = 'button';
  secondaryClear.className = 'hidden ml-auto text-xs font-bold text-red-400 hover:text-red-300';
  secondaryClear.textContent = 'Remove';
  secondaryPanel.append(secondaryLabel, secondaryHelp, secondaryRow);
  leftCol.appendChild(secondaryPanel);

  const secondaryPicker = createUploadPicker({
    anchorContainer: container,
    muapiStudio: true,
    studioId: 'edit-studio',
    acceptVideo: false,
    acceptDocuments: false,
    onSelect: ({ url, assetId }) => setSecondary(url ? { url, assetId: assetId || null } : null),
    onClear: () => setSecondary(null),
  });
  secondaryRow.append(secondaryPicker.trigger, secondaryPreview, secondaryHint, secondaryClear);
  container.appendChild(secondaryPicker.panel);
  secondaryClear.onclick = () => { secondaryPicker.reset(); setSecondary(null); };

  // Prompt (shown for models that take one).
  const promptPanel = document.createElement('div');
  promptPanel.className = `${PANEL} hidden`;
  const promptLabel = document.createElement('label');
  promptLabel.className = LABEL;
  promptLabel.textContent = 'Prompt';
  const promptField = document.createElement('textarea');
  promptField.rows = 3;
  promptField.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors resize-y';
  promptField.setAttribute('aria-label', 'Edit prompt');
  promptPanel.append(promptLabel, promptField);
  leftCol.appendChild(promptPanel);

  // Settings.
  const settingsPanel = document.createElement('div');
  settingsPanel.className = `${PANEL} hidden`;
  const settingsLabel = document.createElement('div');
  settingsLabel.className = LABEL;
  settingsLabel.textContent = 'Settings';
  const controlsContainer = document.createElement('div');
  controlsContainer.className = 'w-full flex flex-col gap-3';
  settingsPanel.append(settingsLabel, controlsContainer);
  leftCol.appendChild(settingsPanel);

  // Apply + progress.
  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'w-full bg-primary/10 border border-primary/30 text-white py-3 rounded-xl font-black text-sm hover:shadow-glow transition-all disabled:opacity-50';
  editBtn.textContent = 'Apply Edit';
  const formError = document.createElement('div');
  formError.className = 'hidden text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl p-3';
  formError.setAttribute('role', 'alert');
  const progressContainer = document.createElement('div');
  progressContainer.className = 'hidden w-full flex-col gap-2';
  const progressBar = document.createElement('div');
  progressBar.className = 'w-full bg-white/10 rounded-full h-2 overflow-hidden';
  const progressFill = document.createElement('div');
  progressFill.className = 'h-full bg-primary rounded-full transition-all duration-300 w-0';
  const progressText = document.createElement('span');
  progressText.className = 'text-xs text-muted text-center';
  progressBar.appendChild(progressFill);
  progressContainer.append(progressBar, progressText);
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'hidden w-full bg-white/5 border border-white/10 text-red-400 font-bold py-2 rounded-xl hover:bg-white/10 transition-all';
  cancelBtn.textContent = 'Cancel';
  leftCol.append(formError, editBtn, progressContainer, cancelBtn);

  // ── Preview ────────────────────────────────────────────────────────────
  const previewPanel = document.createElement('div');
  previewPanel.className = PANEL;
  const previewHead = document.createElement('div');
  previewHead.className = 'flex items-center justify-between gap-2';
  const previewLabel = document.createElement('div');
  previewLabel.className = LABEL;
  previewLabel.textContent = 'Preview';
  const viewToggle = document.createElement('div');
  viewToggle.className = 'hidden flex gap-1 bg-white/5 rounded-lg p-0.5';
  const viewButtons = {};
  for (const [id, label] of [['compare', 'Compare'], ['before', 'Before'], ['after', 'After']]) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.view = id;
    btn.textContent = label;
    btn.onclick = () => setCompareMode(id);
    viewButtons[id] = btn;
    viewToggle.appendChild(btn);
  }
  previewHead.append(previewLabel, viewToggle);

  const stage = document.createElement('div');
  stage.className = 'relative w-full min-h-[320px] lg:min-h-[460px] rounded-xl bg-black/40 border border-white/5 overflow-hidden flex items-center justify-center';
  const emptyState = document.createElement('div');
  emptyState.className = 'flex flex-col items-center gap-3 p-8 text-center';
  const emptyThumb = document.createElement('img');
  emptyThumb.alt = '';
  emptyThumb.className = 'w-56 max-w-full rounded-xl border border-white/10 opacity-80';
  const emptyText = document.createElement('p');
  emptyText.className = 'text-sm text-muted';
  emptyText.textContent = 'Upload an image to start. Your before/after preview appears here.';
  emptyState.append(emptyThumb, emptyText);

  const compareBox = document.createElement('div');
  compareBox.className = 'hidden relative w-full select-none';
  const beforeImg = document.createElement('img');
  beforeImg.alt = 'Before';
  beforeImg.className = 'block w-full max-h-[70vh] object-contain';
  const afterLayer = document.createElement('div');
  afterLayer.className = 'absolute inset-0';
  const afterImg = document.createElement('img');
  afterImg.alt = 'After';
  afterImg.className = 'w-full h-full object-contain';
  afterLayer.appendChild(afterImg);
  const divider = document.createElement('div');
  divider.className = 'absolute top-0 bottom-0 w-0.5 bg-primary shadow-[0_0_12px_rgba(34,211,238,0.9)] pointer-events-none';
  const beforeTag = document.createElement('span');
  beforeTag.className = 'absolute top-2 left-2 text-[10px] font-black bg-black/70 text-white rounded px-2 py-0.5';
  beforeTag.textContent = 'BEFORE';
  const afterTag = document.createElement('span');
  afterTag.className = 'absolute top-2 right-2 text-[10px] font-black bg-primary/10 border border-primary/30 text-white rounded px-2 py-0.5';
  afterTag.textContent = 'AFTER';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.value = '50';
  slider.setAttribute('aria-label', 'Before/after slider');
  slider.className = 'absolute inset-0 w-full h-full opacity-0 cursor-ew-resize';
  slider.oninput = () => applySlider();
  compareBox.append(beforeImg, afterLayer, divider, beforeTag, afterTag, slider);

  const runningState = document.createElement('div');
  runningState.className = 'hidden absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3';
  runningState.innerHTML = '<div class="w-10 h-10 border-2 border-white/10 border-t-primary rounded-full animate-spin"></div><p class="text-sm font-bold text-white">Applying edit…</p>';
  const errorState = document.createElement('div');
  errorState.className = 'hidden absolute bottom-3 left-3 right-3 text-xs text-red-300 bg-red-500/15 border border-red-400/30 rounded-xl p-3';
  stage.append(emptyState, compareBox, runningState, errorState);

  const resultActions = document.createElement('div');
  resultActions.className = 'hidden flex flex-wrap gap-2';
  const downloadBtn = document.createElement('a');
  downloadBtn.className = 'flex-1 min-w-[120px] bg-primary/10 border border-primary/30 text-white py-2.5 rounded-xl font-bold text-sm text-center hover:shadow-glow transition-all';
  downloadBtn.textContent = 'Download';
  downloadBtn.target = '_blank';
  downloadBtn.rel = 'noopener';
  downloadBtn.setAttribute('download', '');
  const regenBtn = document.createElement('button');
  regenBtn.type = 'button';
  regenBtn.className = `flex-1 min-w-[120px] ${BTN_GHOST}`;
  regenBtn.textContent = 'Generate Again';
  regenBtn.onclick = () => editBtn.click();
  const reuseBtn = document.createElement('button');
  reuseBtn.type = 'button';
  reuseBtn.className = `flex-1 min-w-[120px] ${BTN_GHOST}`;
  reuseBtn.textContent = 'Use result as new source';
  reuseBtn.onclick = () => {
    if (!resultUrl) return;
    picker.reset();
    setSource({ url: resultUrl, assetId: null });
    showToast('Result is now the source image', 'success');
  };
  resultActions.append(downloadBtn, regenBtn, reuseBtn);

  const historyPanel = document.createElement('div');
  historyPanel.className = 'hidden flex flex-col gap-2';
  const historyLabel = document.createElement('div');
  historyLabel.className = LABEL;
  historyLabel.textContent = 'This session';
  const historyStrip = document.createElement('div');
  historyStrip.className = 'flex gap-2 overflow-x-auto pb-1';
  historyPanel.append(historyLabel, historyStrip);

  previewPanel.append(previewHead, stage, resultActions, historyPanel);
  rightCol.appendChild(previewPanel);

  // ── State updates ──────────────────────────────────────────────────────
  function showBefore(url) {
    beforeImg.src = url;
    resultUrl = null;
    emptyState.classList.add('hidden');
    compareBox.classList.remove('hidden');
    afterLayer.classList.add('hidden');
    divider.classList.add('hidden');
    afterTag.classList.add('hidden');
    beforeTag.classList.remove('hidden');
    slider.classList.add('hidden');
    viewToggle.classList.add('hidden');
    resultActions.classList.add('hidden');
    errorState.classList.add('hidden');
  }

  function showEmpty() {
    beforeImg.removeAttribute('src');
    resultUrl = null;
    emptyState.classList.remove('hidden');
    compareBox.classList.add('hidden');
    viewToggle.classList.add('hidden');
    resultActions.classList.add('hidden');
    errorState.classList.add('hidden');
  }

  function setSource(next) {
    source = next;
    formError.classList.add('hidden');
    if (next?.url) {
      sourceHint.textContent = 'Image ready';
      sourceClear.classList.remove('hidden');
      showBefore(next.url);
    } else {
      sourceHint.textContent = sourcePrompt();
      sourceClear.classList.add('hidden');
      showEmpty();
    }
    if (activeTool?.id === 'ai-object-eraser') {
      maskPainter.setImage(next?.url || null);
      maskPainter.element.classList.toggle('hidden', !next?.url);
      maskEmpty.classList.toggle('hidden', !!next?.url);
    }
  }

  function setSecondary(next) {
    secondary = next;
    formError.classList.add('hidden');
    if (next?.url) {
      secondaryPreview.src = next.url;
      secondaryPreview.classList.remove('hidden');
      secondaryHint.textContent = 'Uploaded';
      secondaryClear.classList.remove('hidden');
    } else {
      secondaryPreview.classList.add('hidden');
      secondaryPreview.removeAttribute('src');
      secondaryHint.textContent = 'Not uploaded yet';
      secondaryClear.classList.add('hidden');
    }
  }

  function applySlider() {
    const pct = Number(slider.value);
    afterLayer.style.clipPath = `inset(0 0 0 ${pct}%)`;
    divider.style.left = `${pct}%`;
  }

  function setCompareMode(mode) {
    for (const [id, btn] of Object.entries(viewButtons)) {
      const active = id === mode;
      btn.setAttribute('aria-pressed', String(active));
      btn.className = `text-[10px] font-bold rounded-md px-2 py-1 ${active ? 'text-white bg-primary/10 border border-primary/30' : 'text-white hover:text-primary'}`;
    }
    if (!resultUrl) return;
    const compare = mode === 'compare';
    afterLayer.classList.toggle('hidden', mode === 'before');
    afterLayer.style.clipPath = compare ? `inset(0 0 0 ${slider.value}%)` : 'none';
    divider.classList.toggle('hidden', !compare);
    slider.classList.toggle('hidden', !compare);
    beforeTag.classList.toggle('hidden', mode === 'after');
    afterTag.classList.toggle('hidden', mode === 'before');
    if (compare) applySlider();
  }

  function showResult(url, beforeUrl) {
    resultUrl = url;
    beforeImg.src = beforeUrl || url;
    afterImg.src = url;
    emptyState.classList.add('hidden');
    compareBox.classList.remove('hidden');
    errorState.classList.add('hidden');
    viewToggle.classList.remove('hidden');
    resultActions.classList.remove('hidden');
    downloadBtn.href = url;
    previewLabel.textContent = 'Result';
    slider.value = '50';
    setCompareMode(beforeUrl ? 'compare' : 'after');
  }

  function addToHistory(url, beforeUrl) {
    runs.unshift({ url, beforeUrl, tool: activeTool?.name });
    historyPanel.classList.toggle('hidden', runs.length < 2);
    historyStrip.innerHTML = '';
    runs.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.title = item.tool || 'Result';
      btn.className = 'w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-white/10 hover:border-primary';
      const img = document.createElement('img');
      img.src = item.url;
      img.alt = '';
      img.className = 'w-full h-full object-cover';
      btn.appendChild(img);
      btn.onclick = () => showResult(item.url, item.beforeUrl);
      historyStrip.appendChild(btn);
    });
  }

  function showError(message) {
    formError.textContent = message;
    formError.classList.remove('hidden');
  }

  function updateProgress(percent, message) {
    if (percent === null) {
      progressContainer.classList.add('hidden');
      progressContainer.classList.remove('flex');
      runningState.classList.add('hidden');
      return;
    }
    progressFill.style.width = `${percent}%`;
    progressText.textContent = message || `Processing... ${Math.round(percent)}%`;
    progressContainer.classList.remove('hidden');
    progressContainer.classList.add('flex');
  }

  // ── Opening / closing tools ────────────────────────────────────────────
  function renderControls(tool, modelId = tool.id) {
    controlsContainer.innerHTML = '';
    const handWritten = modelId === tool.id ? (tool.controls || []) : [];
    const controls = [...handWritten, ...getSchemaControls(tool, modelId)];
    controls.forEach(ctrl => {
      const factory = CONTROL_FACTORIES[ctrl.type];
      if (factory) controlsContainer.appendChild(factory(ctrl));
    });
    settingsPanel.classList.toggle('hidden', controls.length === 0);
  }

  // Fill the Model dropdown (grouped by maker) for tools that offer several.
  function buildModelSelect(tool) {
    const ids = tool.models || [];
    modelPanel.classList.toggle('hidden', ids.length < 2);
    modelSelect.innerHTML = '';
    if (ids.length < 2) return;
    const groups = new Map();
    ids.forEach(id => {
      const info = getModelInfo(id);
      if (!groups.has(info.group)) groups.set(info.group, []);
      groups.get(info.group).push(info);
    });
    groups.forEach((items, group) => {
      const parent = groups.size > 1 ? Object.assign(document.createElement('optgroup'), { label: group }) : modelSelect;
      items.forEach(info => {
        const option = document.createElement('option');
        option.value = info.id;
        option.textContent = info.label;
        parent.appendChild(option);
      });
      if (parent !== modelSelect) modelSelect.appendChild(parent);
    });
  }

  // The studio adapts to the chosen model: prompt, how many images, settings.
  function applyModel(modelId) {
    const tool = activeTool;
    if (!tool) return;
    activeModelId = modelId;
    const spec = getModelSpec(modelId);
    const info = getModelInfo(modelId);
    if (modelSelect.value !== modelId) modelSelect.value = modelId;
    modelNote.textContent = info.note;

    const promptKey = spec?.promptKey || null;
    promptPanel.classList.toggle('hidden', !promptKey);
    promptField.placeholder = tool.promptPlaceholder || 'Describe the edit...';
    promptLabel.textContent = promptKey === 'scene_description' ? 'Scene description' : 'Prompt';

    const moreImages = Math.max(0, (spec?.maxImages || 1) - 1);
    extrasPanel.classList.toggle('hidden', moreImages < 1);
    if (moreImages >= 1) {
      extrasLabel.textContent = `More reference images (up to ${moreImages})`;
      extrasPicker.setMaxImages(Math.max(1, moreImages));
      if (extras.length > moreImages) {
        extras = extras.slice(0, moreImages);
        renderExtras();
      }
    }
    renderControls(tool, modelId);
  }

  function showTool(tool) {
    activeTool = tool;
    toolSwitch.value = tool.slug;
    toolTitle.textContent = tool.name;
    toolHowTo.textContent = tool.howTo || tool.description;
    const thumb = getToolThumbnail(tool.id);
    titleThumb.src = thumb || '';
    emptyThumb.src = thumb || '';
    titleThumb.classList.toggle('sm:block', !!thumb);
    emptyThumb.classList.toggle('hidden', !thumb);
    previewLabel.textContent = 'Preview';

    sourceLabel.textContent = tool.sourceLabel || 'Source image';
    if (!source?.url) sourceHint.textContent = sourcePrompt();

    // Extra reference images start empty for each tool.
    extrasPicker.reset();
    extras = [];
    renderExtras();

    // Second image.
    secondaryPicker.reset();
    setSecondary(null);
    secondaryPanel.classList.toggle('hidden', !tool.secondary);
    if (tool.secondary) {
      secondaryLabel.textContent = tool.secondary.label;
      secondaryHelp.textContent = tool.secondary.hint || '';
    }

    // Mask painting.
    const isEraser = tool.id === 'ai-object-eraser';
    maskPanel.classList.toggle('hidden', !isEraser);
    if (isEraser) {
      maskPainter.setImage(source?.url || null);
      maskPainter.element.classList.toggle('hidden', !source?.url);
      maskEmpty.classList.toggle('hidden', !!source?.url);
    }

    buildModelSelect(tool);
    applyModel(tool.id);
    formError.classList.add('hidden');
    updateProgress(null);
    if (source?.url) showBefore(source.url); else showEmpty();

    galleryView.classList.add('hidden');
    studioView.classList.remove('hidden');
    studioView.classList.add('flex');
    container.scrollTop = 0;
  }

  function showGallery() {
    activeTool = null;
    studioView.classList.add('hidden');
    studioView.classList.remove('flex');
    galleryView.classList.remove('hidden');
    container.scrollTop = 0;
  }

  function openTool(tool) {
    if (!tool) return;
    showTool(tool);
    setToolInUrl(tool);
  }

  function closeTool() {
    showGallery();
    setToolInUrl(null);
  }

  const onPopState = () => {
    if (!container.isConnected) return;
    const tool = readToolFromUrl();
    if (tool) showTool(tool); else showGallery();
  };
  window.addEventListener('popstate', onPopState);
  container.cleanup = () => window.removeEventListener('popstate', onPopState);

  // ── Apply ──────────────────────────────────────────────────────────────
  let progressPoll = null;
  cancelBtn.onclick = () => {
    runId++;
    if (progressPoll) { clearInterval(progressPoll); progressPoll = null; }
    updateProgress(null);
    editBtn.disabled = false;
    editBtn.textContent = 'Apply Edit';
    cancelBtn.classList.add('hidden');
    inFlight = false;
  };

  editBtn.onclick = async () => {
    if (!activeTool || inFlight) return;
    const tool = activeTool;
    const problem = validateEditInputs(tool, {
      sourceUrl: source?.url,
      secondaryUrl: secondary?.url,
      hasPaintedMask: maskPainter.hasMask(),
      prompt: promptField.value,
      modelId: activeModelId,
    });
    if (problem) { showError(problem); return; }

    const apiKey = localStorage.getItem('muapi_key');
    if (!apiKey) { AuthModal(() => editBtn.click()); return; }

    inFlight = true;
    const myRun = ++runId;
    const cancelled = () => myRun !== runId;
    formError.classList.add('hidden');
    errorState.classList.add('hidden');
    editBtn.disabled = true;
    editBtn.innerHTML = '<span class="animate-spin inline-block mr-2">&#9711;</span> Processing...';
    runningState.classList.remove('hidden');
    updateProgress(0, 'Starting...');
    if (progressPoll) clearInterval(progressPoll);
    progressPoll = setInterval(() => {
      const current = parseFloat(progressFill.style.width) || 0;
      const next = Math.min(current + Math.random() * 8 + 2, 90);
      updateProgress(next, `Processing... ${Math.round(next)}%`);
    }, 500);
    cancelBtn.classList.remove('hidden');
    const beforeUrl = source.url;
    const modelId = activeModelId || tool.id;
    const spec = getModelSpec(modelId);

    try {
      const params = { model: modelId };
      const { resolveMuapiMediaRef, resolveMuapiMediaRefs } = await import('../lib/muapiStudioMedia.js');

      // The first image is the source; the rest are extra references. Each
      // model takes them in its own request field (see getModelSpec).
      const imageRefs = [source, ...extras].filter(Boolean).slice(0, spec?.maxImages || 1);
      const images = await resolveMuapiMediaRefs(imageRefs.map(ref => ({ url: ref.url, assetId: ref.assetId })));
      if (spec?.sourceKey === 'images_list') params.images_list = images;
      else if (spec?.sourceKey === 'reference_images') params.reference_images = images;
      else params.image_url = images[0];

      if (tool.secondary && secondary?.url) {
        params[tool.secondary.key] = await resolveMuapiMediaRef({ url: secondary.url, assetId: secondary.assetId });
      } else if (tool.id === 'ai-object-eraser' && maskPainter.hasMask()) {
        const blob = await maskPainter.toBlob();
        if (!blob) throw new Error('Could not read the painted mask. Try painting again.');
        const { ingestStudioUpload } = await import('../lib/muapiStudioMedia.js');
        const file = new File([blob], `edit-mask-${Date.now()}.png`, { type: 'image/png' });
        const stored = await ingestStudioUpload(file, { studioId: 'edit-studio' });
        params.mask_image_url = await resolveMuapiMediaRef({ url: stored.url, assetId: stored.assetId });
      }

      const promptKey = spec?.promptKey || null;
      if (promptKey && promptField.value.trim()) {
        params[promptKey] = replaceTokensInPrompt(promptField.value.trim());
      }

      Object.assign(params, readControlValues());

      const result = await muapi.generateI2I(params);
      if (cancelled()) return;
      updateProgress(null);
      if (result?.url) {
        registerGeneration('edit', 'image', result.url, {
          prompt: params[promptKey || 'prompt'] || '', model: modelId, parameters: { tool: tool.slug },
        });
        addToHistory(result.url, beforeUrl);
        if (activeTool === tool) showResult(result.url, beforeUrl);
      } else {
        throw new Error('Edit completed, but no result image was returned. Please try again.');
      }
    } catch (err) {
      if (cancelled()) return;
      updateProgress(null);
      errorState.textContent = err.message || 'An unexpected error occurred';
      errorState.classList.remove('hidden');
    } finally {
      if (progressPoll) { clearInterval(progressPoll); progressPoll = null; }
      if (!cancelled()) {
        inFlight = false;
        editBtn.disabled = false;
        editBtn.textContent = 'Apply Edit';
        cancelBtn.classList.add('hidden');
        runningState.classList.add('hidden');
      }
    }
  };

  function readControlValues() {
    const values = {};
    controlsContainer.querySelectorAll('[data-control-key]').forEach(el => {
      const key = el.dataset.controlKey;
      if (el.tagName === 'BUTTON') {
        values[key] = el.getAttribute('aria-pressed') === 'true';
      } else if (el.type === 'number' || el.type === 'range' || el.dataset.numeric) {
        if (el.value !== '') values[key] = parseFloat(el.value);
      } else if (String(el.value).trim() !== '') {
        values[key] = el.value;
      }
    });
    return values;
  }

  // ── Control factories ──────────────────────────────────────────────────
  function fieldWrapper(control) {
    const wrapper = document.createElement('div');
    wrapper.className = 'flex flex-col gap-1.5';
    const label = document.createElement('label');
    label.className = LABEL;
    label.textContent = control.label;
    wrapper.appendChild(label);
    return { wrapper, label };
  }

  function createRangeControl(control) {
    const { wrapper } = fieldWrapper(control);
    const row = document.createElement('div');
    row.className = 'flex items-center gap-3';
    const range = document.createElement('input');
    range.type = 'range';
    range.min = control.min;
    range.max = control.max;
    range.step = control.step || 1;
    range.value = control.default;
    range.dataset.controlKey = control.key;
    range.setAttribute('aria-label', control.label);
    range.className = 'flex-1 accent-[#22d3ee]';
    const valueSpan = document.createElement('span');
    valueSpan.className = 'text-xs font-bold text-white w-12 text-right';
    const decimals = control.step && control.step < 1 ? (String(control.step).split('.')[1] || '').length : 0;
    const show = () => { valueSpan.textContent = `${Number(range.value).toFixed(decimals)}${control.unit || ''}`; };
    show();
    range.oninput = show;
    row.append(range, valueSpan);
    wrapper.appendChild(row);
    return wrapper;
  }

  function createSelectControl(control) {
    const { wrapper } = fieldWrapper(control);
    const select = document.createElement('select');
    select.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors';
    select.dataset.controlKey = control.key;
    select.setAttribute('aria-label', control.label);
    // A list of numbers (e.g. upscale factor 2, 4, 8) is sent as a number.
    if (control.options.every(opt => typeof opt === 'number')) select.dataset.numeric = '1';
    control.options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt;
      option.textContent = opt;
      if (opt === control.default) option.selected = true;
      select.appendChild(option);
    });
    wrapper.appendChild(select);
    return wrapper;
  }

  function createNumberControl(control) {
    const { wrapper } = fieldWrapper(control);
    const numInput = document.createElement('input');
    numInput.type = 'number';
    numInput.min = control.min ?? 0;
    numInput.max = control.max ?? 999;
    numInput.step = control.step || 1;
    numInput.value = control.default;
    numInput.dataset.controlKey = control.key;
    numInput.setAttribute('aria-label', control.label);
    numInput.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors';
    wrapper.appendChild(numInput);
    return wrapper;
  }

  function createToggleControl(control) {
    const wrapper = document.createElement('div');
    wrapper.className = 'flex items-center justify-between';
    const label = document.createElement('span');
    label.className = LABEL;
    label.textContent = control.label;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.dataset.controlKey = control.key;
    toggle.setAttribute('aria-label', control.label);
    const dot = document.createElement('span');
    toggle.appendChild(dot);
    const paint = (on) => {
      toggle.setAttribute('aria-pressed', String(on));
      toggle.className = `relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${on ? 'bg-primary' : 'bg-white/10'}`;
      dot.className = `inline-block h-4 w-4 rounded-full bg-white transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`;
    };
    paint(!!control.default);
    toggle.onclick = () => paint(toggle.getAttribute('aria-pressed') !== 'true');
    wrapper.append(label, toggle);
    return wrapper;
  }

  function createTextControl(control) {
    const { wrapper } = fieldWrapper(control);
    const textarea = document.createElement('textarea');
    textarea.placeholder = control.placeholder || '';
    textarea.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors resize-y';
    textarea.rows = 2;
    textarea.dataset.controlKey = control.key;
    textarea.setAttribute('aria-label', control.label);
    wrapper.appendChild(textarea);
    return wrapper;
  }

  // A grid of clickable presets (Photo Effects). The value lives in a hidden
  // input so it is read like any other setting.
  function createPresetControl(control) {
    const { wrapper } = fieldWrapper(control);
    const hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.dataset.controlKey = control.key;
    hidden.value = control.default;
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1';
    grid.setAttribute('role', 'listbox');
    grid.setAttribute('aria-label', control.label);
    const buttons = control.options.map(option => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.preset = option;
      btn.textContent = option;
      btn.setAttribute('role', 'option');
      btn.onclick = () => select(option);
      grid.appendChild(btn);
      return btn;
    });
    function select(option) {
      hidden.value = option;
      buttons.forEach(btn => {
        const active = btn.dataset.preset === option;
        btn.setAttribute('aria-selected', String(active));
        btn.className = `text-left text-xs font-bold rounded-xl border px-3 py-2 transition-colors ${
          active ? 'border-primary bg-primary/15 text-primary' : 'border-white/10 bg-white/5 text-white/80 hover:text-white hover:border-white/20'
        }`;
      });
    }
    select(control.default);
    wrapper.append(hidden, grid);
    return wrapper;
  }

  const CONTROL_FACTORIES = {
    preset: createPresetControl,
    range: createRangeControl,
    select: createSelectControl,
    number: createNumberControl,
    toggle: createToggleControl,
    text: createTextControl,
  };

  // Deep link: /?tool=<slug>#/edit opens that tool straight away.
  const initialTool = readToolFromUrl();
  if (initialTool) showTool(initialTool);

  return container;
}
