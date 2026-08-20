import { muapi } from '../lib/muapi.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { AuthModal } from './AuthModal.js';
import { createUploadPicker } from './UploadPicker.js';
import { createInlineInstructions } from './InlineInstructions.js';
import { createHeroSection, getToolThumbnail, createThumbnailImg } from '../lib/thumbnails.js';
import { mountPersonalizeTrigger, replaceTokensInPrompt } from './personalize/personalizePopover.js';
import { openPromptGallery } from '../lib/promptGalleryIntegration.js';
import { openModelPicker } from '../lib/modelPickerIntegration.js';
import { openRecipeModal } from '../lib/recipeIntegration.js';
import { openMonetizationHub } from '../lib/monetizationIntegration.js';

const EDIT_TOOLS = [
  {
    id: 'ai-object-eraser',
    name: 'Remove Object',
    description: 'Erase unwanted objects from images',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 5H9l-7 7 7 7h11a2 2 0 002-2V7a2 2 0 00-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg>',
    hasPrompt: false,
    controls: [
      { type: 'range', key: 'feather', label: 'Edge Feather', min: 0, max: 100, step: 1, default: 20, unit: '%' },
      { type: 'range', key: 'strength', label: 'Removal Strength', min: 0, max: 100, step: 1, default: 85, unit: '%' },
      { type: 'select', key: 'fill_mode', label: 'Fill Mode', options: ['Generative Fill', 'Content-Aware', 'Inpaint', 'Clone'], default: 'Generative Fill' },
    ],
  },
  {
    id: 'ai-background-remover',
    name: 'Remove Background',
    description: 'Clean background removal',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 3l18 18"/></svg>',
    hasPrompt: false,
    controls: [
      { type: 'select', key: 'background_type', label: 'Output', options: ['Transparent', 'White', 'Black', 'Custom Color', 'Gradient'], default: 'Transparent' },
      { type: 'range', key: 'edge_refinement', label: 'Edge Refinement', min: 0, max: 100, step: 1, default: 50, unit: '%' },
      { type: 'toggle', key: 'hair_detail', label: 'Preserve Hair Detail', default: true },
      { type: 'toggle', key: 'shadow_removal', label: 'Remove Cast Shadow', default: true },
    ],
  },
  {
    id: 'ai-image-extension',
    name: 'Extend Image',
    description: 'AI outpainting to expand images',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
    hasPrompt: false,
    controls: [
      { type: 'directions', key: 'extend_direction', label: 'Extend Direction', default: ['all'] },
      { type: 'range', key: 'expansion_amount', label: 'Expansion Amount', min: 10, max: 100, step: 5, default: 50, unit: '%' },
      { type: 'range', key: 'seam_blending', label: 'Seam Blending', min: 0, max: 100, step: 1, default: 70, unit: '%' },
      { type: 'select', key: 'aspect_ratio', label: 'Aspect Ratio', options: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'], default: '16:9' },
    ],
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
      { type: 'range', key: 'strength', label: 'Edit Strength', min: 0, max: 100, step: 1, default: 70, unit: '%' },
    ],
    advancedControls: [
      { type: 'number', key: 'num_images', label: 'Variations', min: 1, max: 4, step: 1, default: 1 },
      { type: 'text', key: 'negative_prompt', label: 'Negative Prompt', placeholder: 'What to avoid...' },
      { type: 'number', key: 'seed', label: 'Seed (optional)', placeholder: 'Random' },
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
      { type: 'toggle', key: 'smart_crop', label: 'Smart Crop (preserve subject)', default: true },
      { type: 'range', key: 'padding', label: 'Padding', min: 0, max: 30, step: 1, default: 10, unit: '%' },
    ],
    advancedControls: [
      { type: 'number', key: 'num_images', label: 'Variations', min: 1, max: 4, step: 1, default: 1 },
    ],
  },
  {
    id: 'ai-dress-change',
    name: 'Change Dress',
    description: 'AI outfit and clothing swap',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.38 3.46L16 2 12 5.5 8 2l-4.38 1.46a2 2 0 00-1.34 2.31l2.1 9.89A2 2 0 006.34 17H7l-2 5h14l-2-5h.66a2 2 0 001.96-1.34l2.1-9.89a2 2 0 00-1.34-2.31z"/></svg>',
    hasPrompt: false,
    controls: [
      { type: 'select', key: 'outfit_style', label: 'Style Preset', options: ['Casual', 'Formal', 'Sport', 'Traditional', 'Elegant', 'Statement'], default: 'Formal' },
      { type: 'color', key: 'outfit_color', label: 'Color', default: '#000000' },
      { type: 'select', key: 'fabric', label: 'Fabric Type', options: ['Silk', 'Cotton', 'Leather', 'Velvet', 'Denim', 'Lace'], default: 'Silk' },
      { type: 'range', key: 'fit', label: 'Fit', min: 0, max: 100, step: 1, default: 50, unit: '%', unitLabel: 'Loose to Tight' },
      { type: 'select', key: 'lighting', label: 'Lighting', options: ['Studio Softbox', 'Natural Window', 'Dramatic', 'Flat Lay'], default: 'Studio Softbox' },
      { type: 'toggle', key: 'preserve_background', label: 'Preserve Background', default: true },
      { type: 'toggle', key: 'preserve_hair', label: 'Preserve Hair Details', default: true },
    ],
  },
  {
    id: 'ai-skin-enhancer',
    name: 'Enhance Skin',
    description: 'Professional skin retouching',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
    hasPrompt: false,
    controls: [
      { type: 'range', key: 'smoothing', label: 'Smoothing', min: 0, max: 100, step: 1, default: 50, unit: '%' },
      { type: 'range', key: 'blemish_removal', label: 'Blemish Removal', min: 0, max: 100, step: 1, default: 70, unit: '%' },
      { type: 'range', key: 'wrinkle_reduction', label: 'Wrinkle Reduction', min: 0, max: 100, step: 1, default: 40, unit: '%' },
      { type: 'toggle', key: 'eye_brightening', label: 'Brighten Eyes', default: true },
      { type: 'toggle', key: 'teeth_whitening', label: 'Whiten Teeth', default: true },
      { type: 'range', key: 'skin_tone_preservation', label: 'Skin Tone Preservation', min: 0, max: 100, step: 1, default: 90, unit: '%' },
      { type: 'toggle', key: 'face_detection', label: 'Auto Face Detection', default: true },
    ],
  },
  {
    id: 'ai-color-photo',
    name: 'Colorize',
    description: 'Add color to B&W photos',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="19" cy="13" r="2.5"/><circle cx="7" cy="13" r="2.5"/><circle cx="13.5" cy="19.5" r="2.5"/></svg>',
    hasPrompt: false,
    controls: [
      { type: 'select', key: 'color_style', label: 'Style Preset', options: ['Realistic', 'Vintage', 'Vibrant', 'Pastel', 'Duotone'], default: 'Realistic' },
      { type: 'range', key: 'saturation', label: 'Saturation', min: 0, max: 100, step: 1, default: 60, unit: '%' },
      { type: 'range', key: 'warmth', label: 'Color Temperature', min: 0, max: 100, step: 1, default: 50, unit: '%', unitLabel: 'Cool to Warm' },
      { type: 'range', key: 'intensity', label: 'Color Intensity', min: 0, max: 100, step: 1, default: 80, unit: '%' },
      { type: 'text', key: 'reference_colors', label: 'Reference Colors', placeholder: 'e.g. blue sky, green grass' },
    ],
  },
  {
    id: 'add-image-watermark',
    name: 'Add Watermark',
    description: 'Overlay watermark on images',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    hasPrompt: true,
    promptPlaceholder: 'Watermark text...',
    controls: [
      { type: 'select', key: 'position', label: 'Position', options: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'], default: 'bottom-right' },
      { type: 'range', key: 'opacity', label: 'Opacity', min: 0, max: 100, step: 1, default: 70, unit: '%' },
      { type: 'range', key: 'scale', label: 'Size', min: 5, max: 100, step: 1, default: 20, unit: '%' },
      { type: 'text', key: 'font_family', label: 'Font Family', placeholder: 'Arial, Helvetica, etc.' },
      { type: 'color', key: 'text_color', label: 'Text Color', default: '#ffffff' },
      { type: 'range', key: 'rotation', label: 'Rotation', min: -90, max: 90, step: 1, default: 0, unit: 'deg' },
      { type: 'toggle', key: 'shadow', label: 'Text Shadow', default: false },
      { type: 'toggle', key: 'tile', label: 'Tile Pattern', default: false },
    ],
  },
  {
    id: 'ai-image-upscaler',
    name: 'Upscale',
    description: 'AI image upscaling to higher resolution',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
    hasPrompt: false,
    controls: [
      { type: 'select', key: 'upscale_factor', label: 'Upscale Factor', options: ['2x', '4x'], default: '2x' },
      { type: 'range', key: 'denoise', label: 'Denoise Strength', min: 0, max: 100, step: 1, default: 30, unit: '%' },
      { type: 'range', key: 'sharpness', label: 'Sharpening', min: 0, max: 100, step: 1, default: 50, unit: '%' },
      { type: 'toggle', key: 'face_enhancement', label: 'Face Enhancement', default: true },
      { type: 'toggle', key: 'color_correction', label: 'Auto Color Correction', default: true },
    ],
    advancedControls: [
      { type: 'select', key: 'output_format', label: 'Output Format', options: ['PNG', 'JPEG', 'WEBP'], default: 'PNG' },
    ],
  },
  {
    id: 'ai-image-face-swap',
    name: 'Face Swap',
    description: 'Swap faces in images',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M12 6v6l4 2"/></svg>',
    hasPrompt: false,
    controls: [
      { type: 'number', key: 'target_index', label: 'Target Face Index', min: 0, max: 10, step: 1, default: 0, description: '0 = largest face' },
      { type: 'number', key: 'source_face', label: 'Source Face Index', min: 0, max: 10, step: 1, default: 0, description: '0 = largest face' },
      { type: 'range', key: 'blend_strength', label: 'Blend Strength', min: 0, max: 100, step: 1, default: 80, unit: '%' },
      { type: 'range', key: 'feather', label: 'Edge Feather', min: 0, max: 100, step: 1, default: 30, unit: '%' },
      { type: 'toggle', key: 'preserve_expression', label: 'Preserve Target Expression', default: true },
      { type: 'toggle', key: 'color_correction', label: 'Color Match to Target', default: true },
    ],
  },
  {
    id: 'ai-product-shot',
    name: 'Product Shot',
    description: 'Create professional product images',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="3"/></svg>',
    hasPrompt: true,
    promptPlaceholder: 'Product style...',
    controls: [
      { type: 'select', key: 'lighting', label: 'Lighting Preset', options: ['Studio Softbox', 'Natural Window', 'Dramatic', 'Product Flat Lay', 'Ring Light'], default: 'Studio Softbox' },
      { type: 'select', key: 'background', label: 'Background Type', options: ['White', 'Gradient', 'Lifestyle', 'Transparent', 'Color'], default: 'White' },
      { type: 'select', key: 'angle', label: 'Camera Angle', options: ['Front (0 deg)', '45 deg Angle', 'Top-Down', 'Macro Close-Up', 'Low Angle'], default: '45 deg Angle' },
      { type: 'select', key: 'shadow', label: 'Shadow', options: ['Soft Drop Shadow', 'Hard Shadow', 'Floating', 'None'], default: 'Soft Drop Shadow' },
      { type: 'select', key: 'reflection', label: 'Reflection', options: ['Floor Reflection', 'Surface Reflection', 'None'], default: 'Floor Reflection' },
    ],
    advancedControls: [
      { type: 'select', key: 'output_format', label: 'Output Format', options: ['PNG', 'JPEG', 'WEBP'], default: 'PNG' },
      { type: 'select', key: 'quality', label: 'Image Quality', options: ['Standard', 'High', '4K'], default: 'High' },
    ],
  },
  {
    id: 'ai-ghibli-style',
    name: 'Ghibli Style',
    description: 'Transform into Studio Ghibli art style',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
    hasPrompt: false,
    controls: [
      { type: 'select', key: 'style_variant', label: 'Ghibli Style', options: ['Auto', 'My Neighbor Totoro', 'Spirited Away', 'Princess Mononoke', 'Kiki Delivery', 'Howl Moving Castle', 'Ponyo'], default: 'Auto' },
      { type: 'range', key: 'strength', label: 'Style Intensity', min: 0, max: 100, step: 1, default: 85, unit: '%' },
      { type: 'select', key: 'color_palette', label: 'Color Palette', options: ['Muted Pastels', 'Vibrant', 'Natural', 'Dreamy'], default: 'Muted Pastels' },
      { type: 'select', key: 'render_style', label: 'Render Style', options: ['Hand-Painted', 'Line Art', 'Watercolor Wash'], default: 'Hand-Painted' },
      { type: 'range', key: 'grain', label: 'Film Grain', min: 0, max: 100, step: 1, default: 20, unit: '%' },
      { type: 'toggle', key: 'character_consistency', label: 'Character Consistency', default: true },
    ],
  },
];

export function EditStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col bg-app-bg overflow-y-auto relative';
  mountStudioChrome(container, { currentRoute: 'edit' });

  let activeTool = null;
  let uploadedUrl = null;
  let referenceImageUrl = null;
  let progressPoll = null;
  let progress = 0;
  let controlValues = {};
  let advancedOpen = false;

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
  recipeBtn.className = 'gtm-boost-btn shrink-0';
  recipeBtn.addEventListener('click', () => {
    openRecipeModal({ onRunRecipe: () => {} }).catch((err) => console.error('[Recipe] open failed:', err));
  });

  const monetizationBtn = document.createElement('button');
  monetizationBtn.type = 'button';
  monetizationBtn.textContent = 'Monetize';
  monetizationBtn.title = 'Open monetization hub';
  monetizationBtn.setAttribute('aria-label', 'Open monetization hub');
  monetizationBtn.className = 'gtm-boost-btn shrink-0';
  monetizationBtn.addEventListener('click', () => {
    openMonetizationHub().catch((err) => console.error('[Monetization] open failed:', err));
  });

  const promptGalleryBtn = document.createElement('button');
  promptGalleryBtn.type = 'button';
  promptGalleryBtn.textContent = 'Prompts';
  promptGalleryBtn.title = 'Browse prompt gallery';
  promptGalleryBtn.setAttribute('aria-label', 'Open prompt gallery');
  promptGalleryBtn.className = 'gtm-boost-btn shrink-0';
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

  const referencePicker = createUploadPicker({
    anchorContainer: container,
    onSelect: ({ url }) => {
      referenceImageUrl = url;
      referencePreview.src = url;
      referencePreview.classList.remove('hidden');
      referenceRow.classList.remove('hidden');
    },
    onClear: () => {
      referenceImageUrl = null;
      referencePreview.src = '';
      referencePreview.classList.add('hidden');
      referenceRow.classList.add('hidden');
    },
  });

  const referenceRow = document.createElement('div');
  referenceRow.className = 'flex items-center gap-3 hidden mt-2';

  const referencePreview = document.createElement('img');
  referencePreview.className = 'w-12 h-12 object-cover rounded border border-white/10';

  const refClearBtn = document.createElement('button');
  refClearBtn.type = 'button';
  refClearBtn.className = 'text-xs font-bold text-red-400 hover:text-red-300';
  refClearBtn.textContent = 'x';
  refClearBtn.onclick = () => {
    referenceImageUrl = null;
    referencePreview.src = '';
    referencePreview.classList.add('hidden');
    referenceRow.classList.add('hidden');
  };
  referenceRow.appendChild(referencePreview);
  referenceRow.appendChild(refClearBtn);

  const promptField = document.createElement('input');
  promptField.type = 'text';
  promptField.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors hidden';

  const negativePromptField = document.createElement('input');
  negativePromptField.type = 'text';
  negativePromptField.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors hidden';

  const negativePromptLabel = document.createElement('label');
  negativePromptLabel.className = 'text-xs font-bold text-secondary uppercase tracking-wider hidden';
  negativePromptLabel.textContent = 'Negative Prompt';

  const controlsContainer = document.createElement('div');
  controlsContainer.className = 'w-full flex flex-col gap-3';

  const advancedToggleBtn = document.createElement('button');
  advancedToggleBtn.type = 'button';
  advancedToggleBtn.className = 'text-xs font-bold text-secondary hover:text-white transition-colors text-left flex items-center gap-1';
  advancedToggleBtn.innerHTML = '<span>▼</span> Advanced Controls';
  advancedToggleBtn.onclick = () => {
    advancedOpen = !advancedOpen;
    renderControls(activeTool);
  };

  const referenceToggleBtn = document.createElement('button');
  referenceToggleBtn.type = 'button';
  referenceToggleBtn.className = 'text-xs font-bold text-secondary hover:text-white transition-colors text-left mt-2';
  referenceToggleBtn.textContent = '+ Add Reference Image';
  referenceToggleBtn.onclick = () => referencePicker.pick();

  workCard.appendChild(uploadSection);
  workCard.appendChild(promptField);
  workCard.appendChild(negativePromptLabel);
  workCard.appendChild(negativePromptField);
  workCard.appendChild(controlsContainer);

  const editBtn = document.createElement('button');
  editBtn.className = 'w-full bg-primary text-black py-3 rounded-xl font-black text-sm hover:shadow-glow transition-all';
  editBtn.textContent = 'Apply Edit';
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

  const resultArea = document.createElement('div');
  resultArea.className = 'hidden mt-4';
  workCard.appendChild(resultArea);

  workArea.appendChild(workCard);
  container.appendChild(workArea);

  mountPersonalizeTrigger({ controlsContainer: personalizeRow, getTextarea: () => promptField, appId: 'edit-studio' });

  function createRangeControl(control) {
    const wrapper = document.createElement('div');
    wrapper.className = 'flex flex-col gap-1.5';

    const labelRow = document.createElement('div');
    labelRow.className = 'flex justify-between items-baseline';

    const label = document.createElement('label');
    label.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
    label.textContent = control.label;
    labelRow.appendChild(label);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = control.min;
    slider.max = control.max;
    slider.step = control.step || 1;
    slider.value = control.default;
    slider.className = 'flex-1 h-2 bg-white/5 rounded-full appearance-none';

    const valueSpan = document.createElement('span');
    valueSpan.className = 'text-xs font-bold text-white w-16 text-right';

    const sliderRow = document.createElement('div');
    sliderRow.className = 'flex items-center gap-2';
    sliderRow.appendChild(slider);
    sliderRow.appendChild(valueSpan);

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
      controlValues[control.key] = val;
      updateValueSpan(val);
    };

    controlValues[control.key] = parseFloat(control.default);

    labelRow.appendChild(label);
    wrapper.appendChild(labelRow);
    wrapper.appendChild(sliderRow);

    if (control.description) {
      const desc = document.createElement('span');
      desc.className = 'text-[10px] text-muted';
      desc.textContent = control.description;
      wrapper.appendChild(desc);
    }
    return wrapper;
  }

  function createSelectControl(control) {
    const wrapper = document.createElement('div');
    wrapper.className = 'flex flex-col gap-1.5';

    const label = document.createElement('label');
    label.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
    label.textContent = control.label;
    wrapper.appendChild(label);

    const select = document.createElement('select');
    select.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors';
    control.options.forEach(opt => {
      const optEl = document.createElement('option');
      optEl.value = opt;
      optEl.textContent = opt;
      if (opt === control.default) optEl.selected = true;
      select.appendChild(optEl);
    });
    select.onchange = () => { controlValues[control.key] = select.value; };
    controlValues[control.key] = control.default;
    wrapper.appendChild(select);
    return wrapper;
  }

  function createToggleControl(control) {
    const wrapper = document.createElement('div');
    wrapper.className = 'flex items-center justify-between py-1';

    const isOn = control.default !== false;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.dataset.on = isOn;
    toggle.className = 'relative inline-flex h-6 w-10 items-center rounded-full';

    const updateToggle = () => {
      const on = toggle.dataset.on === 'true';
      if (on) {
        toggle.className = 'relative inline-flex h-6 w-10 items-center rounded-full bg-primary';
        toggle.innerHTML = '<span class="absolute inset-0 flex items-center justify-center text-xs font-bold text-black">ON</span>';
      } else {
        toggle.className = 'relative inline-flex h-6 w-10 items-center rounded-full bg-white/10 border border-white/5';
        toggle.innerHTML = '<span class="absolute inset-0 flex items-center justify-center text-xs font-bold text-secondary">OFF</span>';
      }
    };

    toggle.addEventListener('click', () => {
      toggle.dataset.on = toggle.dataset.on === 'true' ? 'false' : 'true';
      controlValues[control.key] = toggle.dataset.on === 'true';
      updateToggle();
    });
    controlValues[control.key] = isOn;
    updateToggle();

    const toggleLabel = document.createElement('span');
    toggleLabel.className = 'text-xs text-secondary';
    toggleLabel.textContent = control.label;

    wrapper.appendChild(toggleLabel);
    wrapper.appendChild(toggle);

    if (control.description) {
      const desc = document.createElement('span');
      desc.className = 'text-[10px] text-muted mt-1';
      desc.textContent = control.description;
      wrapper.appendChild(desc);
    }
    return wrapper;
  }

  function createNumberControl(control) {
    const wrapper = document.createElement('div');
    wrapper.className = 'flex flex-col gap-1.5';

    const label = document.createElement('label');
    label.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
    label.textContent = control.label;
    wrapper.appendChild(label);

    const numInput = document.createElement('input');
    numInput.type = 'number';
    numInput.min = control.min || 0;
    numInput.max = control.max || 999;
    numInput.step = control.step || 1;
    numInput.value = control.default;
    numInput.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors';
    if (control.placeholder) numInput.placeholder = control.placeholder;
    numInput.onchange = () => { controlValues[control.key] = parseInt(numInput.value) || control.default; };
    controlValues[control.key] = control.default;
    wrapper.appendChild(numInput);

    if (control.description) {
      const desc = document.createElement('span');
      desc.className = 'text-[10px] text-muted';
      desc.textContent = control.description;
      wrapper.appendChild(desc);
    }
    return wrapper;
  }

  function createTextControl(control) {
    const wrapper = document.createElement('div');
    wrapper.className = 'flex flex-col gap-1.5';

    const label = document.createElement('label');
    label.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
    label.textContent = control.label;
    wrapper.appendChild(label);

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors';
    if (control.placeholder) textInput.placeholder = control.placeholder;
    textInput.oninput = () => { controlValues[control.key] = textInput.value.trim(); };
    controlValues[control.key] = '';
    wrapper.appendChild(textInput);
    return wrapper;
  }

  function createColorControl(control) {
    const wrapper = document.createElement('div');
    wrapper.className = 'flex flex-col gap-1.5';

    const label = document.createElement('label');
    label.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
    label.textContent = control.label;
    wrapper.appendChild(label);

    const colorRow = document.createElement('div');
    colorRow.className = 'flex items-center gap-2';

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = control.default;
    colorInput.className = 'w-10 h-8 rounded cursor-pointer bg-transparent border border-white/10';

    const colorText = document.createElement('input');
    colorText.type = 'text';
    colorText.className = 'flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors';
    colorText.value = control.default;

    colorText.oninput = () => {
      colorInput.value = colorText.value;
      controlValues[control.key] = colorText.value;
    };
    colorInput.oninput = () => {
      colorText.value = colorInput.value;
      controlValues[control.key] = colorInput.value;
    };
    controlValues[control.key] = control.default;

    colorRow.appendChild(colorInput);
    colorRow.appendChild(colorText);
    wrapper.appendChild(colorRow);
    return wrapper;
  }

  function createDirectionsControl(control) {
    const wrapper = document.createElement('div');
    wrapper.className = 'flex flex-col gap-2';

    const label = document.createElement('label');
    label.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
    label.textContent = control.label;
    wrapper.appendChild(label);

    const dirOptions = ['Left', 'Right', 'Top', 'Bottom'];
    const dirButtons = {};
    let selectedDirs = control.default || ['all'];

    const dirRow = document.createElement('div');
    dirRow.className = 'flex flex-wrap gap-2';

    const updateDirBtns = () => {
      dirOptions.forEach(d => {
        if (dirButtons[d]) {
          const sel = selectedDirs.includes(d.toLowerCase());
          dirButtons[d].className = sel
            ? 'px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-black'
            : 'px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 text-secondary hover:bg-white/10 transition-all';
        }
      });
    };

    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.textContent = 'All';
    allBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 text-secondary hover:bg-white/10 transition-all';
    allBtn.onclick = () => {
      selectedDirs = ['all'];
      controlValues[control.key] = selectedDirs;
      updateDirBtns();
    };
    dirRow.appendChild(allBtn);

    dirOptions.forEach(d => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = d;
      btn.className = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 text-secondary hover:bg-white/10 transition-all';
      btn.onclick = () => {
        const key = d.toLowerCase();
        if (selectedDirs.includes('all')) {
          selectedDirs = [key];
        } else {
          if (selectedDirs.includes(key)) {
            selectedDirs = selectedDirs.filter(x => x !== key);
            if (selectedDirs.length === 0) selectedDirs = ['all'];
          } else {
            selectedDirs = [...selectedDirs, key];
          }
        }
        controlValues[control.key] = selectedDirs;
        updateDirBtns();
      };
      dirButtons[d] = btn;
      dirRow.appendChild(btn);
    });

    controlValues[control.key] = selectedDirs;
    wrapper.appendChild(dirRow);
    return wrapper;
  }

  const CONTROL_FACTORIES = {
    range: createRangeControl,
    select: createSelectControl,
    toggle: createToggleControl,
    number: createNumberControl,
    text: createTextControl,
    color: createColorControl,
    directions: createDirectionsControl,
  };

  function renderControls(tool) {
    controlsContainer.innerHTML = '';
    controlValues = {};

    if (tool.controls) {
      tool.controls.forEach(ctrl => {
        const factory = CONTROL_FACTORIES[ctrl.type];
        if (factory) controlsContainer.appendChild(factory(ctrl));
      });
    }

    const hasAdvanced = tool.advancedControls && tool.advancedControls.length > 0;

    negativePromptField.value = '';

    if (tool.hasPrompt) {
      promptField.classList.remove('hidden');
      promptField.placeholder = tool.promptPlaceholder || 'Describe...';
      negativePromptLabel.classList.remove('hidden');
      negativePromptField.classList.remove('hidden');
      negativePromptField.placeholder = 'What to avoid...';
    } else {
      promptField.classList.add('hidden');
      negativePromptLabel.classList.add('hidden');
      negativePromptField.classList.add('hidden');
    }

    if (hasAdvanced) {
      controlsContainer.appendChild(advancedToggleBtn);
      advancedToggleBtn.innerHTML = `<span>${advancedOpen ? '▲' : '▼'}</span> Advanced Controls`;

      if (advancedOpen) {
        tool.advancedControls.forEach(ctrl => {
          const factory = CONTROL_FACTORIES[ctrl.type];
          if (factory) controlsContainer.appendChild(factory(ctrl));
        });
        controlsContainer.appendChild(referenceToggleBtn);
        controlsContainer.appendChild(referenceRow);
      }
    }

    controlsContainer.classList.remove('hidden');
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

    resultArea.classList.add('hidden');
    updateProgress(null);
  }

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

  editBtn.onclick = async () => {
    if (!activeTool) return;
    if (!uploadedUrl) { alert('Upload an image or video first'); return; }
    const apiKey = localStorage.getItem('muapi_key');
    if (!apiKey) { AuthModal(() => editBtn.click()); return; }

    editBtn.disabled = true;
    editBtn.innerHTML = '<span class="animate-spin inline-block mr-2">&#9711;</span> Processing...';
    progress = 0;
    updateProgress(0, 'Starting...');

    if (progressPoll) clearInterval(progressPoll);
    progressPoll = setInterval(() => {
      progress = Math.min(progress + Math.random() * 8 + 2, 90);
      updateProgress(progress, `Processing... ${Math.round(progress)}%`);
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
      const params = { model: activeTool.id, image_url: uploadedUrl };
      const activeProfile = (() => { try { return JSON.parse(localStorage.getItem('remix_contact_profiles') || '[]').find((p) => p.id === localStorage.getItem('remix_selected_contact_id')) || null; } catch { return null; } })();
      if (activeTool.hasPrompt && promptField.value.trim()) {
        params.prompt = replaceTokensInPrompt(promptField.value.trim(), activeProfile);
      }

      for (const [key, value] of Object.entries(controlValues)) {
        if (value !== undefined && value !== null && value !== '' && value !== 'undefined') {
          params[key] = value;
        }
      }

      const negPrompt = negativePromptField.value?.trim();
      if (negPrompt) {
        params.negative_prompt = negPrompt;
      }

      if (referenceImageUrl) {
        params.reference_images = [referenceImageUrl];
      }

      const result = await muapi.generateI2I(params);
      updateProgress(null);

      if (result?.url) {
        resultArea.classList.remove('hidden');
        resultArea.innerHTML = `
          <div class="bg-[#111]/80 border border-white/10 rounded-2xl p-4 animate-fade-in-up">
            <div class="relative group">
              <img src="${result.url}" class="w-full rounded-xl mb-3 border border-white/10" alt="Result">
            </div>
            <div class="flex gap-3">
              <a href="${result.url}" download class="flex-1 bg-primary text-black py-2.5 rounded-xl font-bold text-sm text-center hover:shadow-glow transition-all">Download</a>
              <button class="flex-1 bg-white/10 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-white/20 transition-all regen-btn">Generate Again</button>
            </div>
          </div>
        `;
        resultArea.querySelector('.regen-btn').onclick = () => editBtn.click();
      }
    } catch (err) {
      updateProgress(null);
      alert(`Error: ${err.message}`);
    } finally {
      editBtn.disabled = false;
      editBtn.textContent = 'Apply Edit';
      cancelBtn.classList.add('hidden');
    }
  };

  return container;
}
