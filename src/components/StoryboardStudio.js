import { registerGeneration } from '../lib/generationHistory.js';
import { openSocialPublish } from '../lib/socialPublishHelpers.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { AuthModal } from './AuthModal.js';
import { createInlineInstructions } from './InlineInstructions.js';
import { saveCustomThumbnailToCache, clearCustomThumbnailCache, createStudioHeader } from '../lib/thumbnails.js';
import { mountPersonalizeTrigger, replaceTokensInPrompt } from './personalize/personalizePopover.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import { t2iModels, getAspectRatiosForModel, getModelById } from '../lib/models.js';
import { showToast } from '../lib/loading.js';
import { navigate } from '../lib/router.js';
import { createFullscreenPreview } from './MediaPreview.js';
import { requireEntitlement } from '../lib/clerkEntitlements.js';
import { CINEMATIC_THEME } from '../lib/cinematicTheme.js';
import { getVideoIntent, setVideoIntent } from '../lib/videoIntentStore.js';
import {
  generateStoryboardFromIntent,
  generateFrameImage as engineGenerateFrameImage,
  buildFramePrompt,
  createFrame,
  syncFrameAliases,
  renumberFrames,
  totalDuration,
  clampFrameCount,
  frameCountForDuration,
  SHOT_TYPES,
  CAMERA_MOVEMENTS,
  MIN_FRAMES,
  MAX_FRAMES,
} from '../lib/storyboardEngine.js';
import { TemplateThumbnailModal, mountThumbnailModal } from './modals/TemplateThumbnailModal.jsx';
import { subscribeToGtmThumbnails } from '../lib/gtmThumbnailBridge.js';
import { createUploadPicker } from './UploadPicker.js';
import { createAttachmentToolbar } from '../lib/attachmentToolbar.js';
import { mountModelSelector, PROVIDER_LOGOS, invertLogos, getProviderStyle, renderProviderLogoImg, positionModelSelectorDropdown } from '../lib/modelSelectorUI.js';
import { createActionRow, arrangeActionRow } from './studio/actionRow.js';
import { getExtendedModel } from '../lib/modelInputExtensions.js';
import { resolveTemplate, loadTemplatePrompt } from '../lib/showcaseTemplateResolver.js';
import { getAcademyCreateTarget } from '../data/academyStudioAdapters.js';
import { openPromptGallery } from '../lib/promptGalleryIntegration.js';
import { openRecipeModal } from '../lib/recipeIntegration.js';
import { openMonetizationHub } from '../lib/monetizationIntegration.js';

const SHOT_PRESETS = {
  'Wide Shot': 'Establishing shot, wide angle, epic landscape, professional cinematography',
  'Medium Shot': 'Medium shot, character focused, natural lighting, professional composition',
  'Close-Up': 'Intimate close-up, detailed expression, shallow depth of field, dramatic lighting',
  'Extreme Close-Up': 'Extreme close-up detail shot, macro detail, shallow depth of field',
  'POV': 'Point of view shot, first person perspective, immersive',
  'Overhead': 'Overhead drone shot, bird\'s eye view, epic scale',
  'Low Angle': 'Low angle shot, dramatic perspective, heroic composition',
};

const SHOT_ABBREV = {
  'Wide Shot': 'WS', 'Medium Shot': 'MS', 'Close-Up': 'CU', 'Extreme Close-Up': 'ECU',
  'POV': 'POV', 'Overhead': 'OH', 'Low Angle': 'LA',
};

const VIDEO_TYPES = ['commercial', 'brand film', 'trailer', 'social reel', 'testimonial', 'documentary', 'short film', 'explainer'];
const TONES = ['dramatic', 'cinematic', 'upbeat', 'luxury', 'gritty', 'minimal', 'emotional', 'humorous'];
const STYLE_OPTIONS = ['None', 'Photorealistic', 'Cinematic', 'Noir', 'Anime', 'Watercolor', 'Oil Painting', 'Cyberpunk', 'Fantasy', 'Documentary'];
const LIGHTING_OPTIONS = ['None', 'Golden Hour', 'Neon', 'Studio', 'Dramatic', 'Soft', 'Volumetric', 'High Key', 'Low Key'];
const COLOR_OPTIONS = ['None', 'Warm', 'Cool', 'Desaturated', 'Vibrant', 'Monochrome', 'Sepia', 'Teal & Orange'];
const STORY_ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:5'];

const LAYOUTS = [
  { id: 'horizontal', label: 'Horizontal' },
  { id: 'grid', label: 'Grid' },
  { id: 'story', label: 'Story' },
];

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 1000;
const GENERATION_CONCURRENCY = 2;
const PROJECTS_KEY = 'storyboard_projects_v1';
const LAST_PROJECT_KEY = 'storyboard_last_project';

const FIELD_CLASS = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-muted focus:outline-none focus:border-primary/50';
const LABEL_CLASS = 'block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5';
const BTN_CLASS = 'px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition-all disabled:opacity-50';
const PRIMARY_BTN_CLASS = 'btn-primary-modern px-[14px] py-2 min-h-[40px] text-[13px] font-bold rounded-2xl inline-flex items-center justify-center gap-1.5 transition-all disabled:opacity-50';

function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function withRetry(fn, retries = MAX_RETRIES, delay = RETRY_BASE_DELAY) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isTransient = err?.status === 429 || (err?.status >= 500 && err?.status < 600);
      if (!isTransient || i === retries - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

/** Shallow copy of the frames. Strings are immutable, so image data is shared, not duplicated. */
function snapshotFrames(frames) {
  return frames.map((f) => ({ ...f, referenceImages: [...(f.referenceImages || [])] }));
}

function createUndoRedo() {
  const undoStack = [];
  const redoStack = [];
  const maxHistory = 50;
  return {
    push(snapshot) {
      undoStack.push(snapshot);
      if (undoStack.length > maxHistory) undoStack.shift();
      redoStack.length = 0;
    },
    undo(current) {
      if (!undoStack.length) return null;
      redoStack.push(current);
      return undoStack.pop();
    },
    redo(current) {
      if (!redoStack.length) return null;
      undoStack.push(current);
      return redoStack.pop();
    },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
  };
}

// ---- Saved projects (localStorage; never touches the Timeline Editor's slot) ----

function readProjects() {
  try {
    return JSON.parse(localStorage.getItem(PROJECTS_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

/** Save a named project. Falls back to dropping inline (data:) images when storage is full. */
function writeProject(name, state) {
  const projects = readProjects();
  const record = { ...state, name, updatedAt: new Date().toISOString() };
  const attempt = (payload) => {
    projects[name] = payload;
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  };
  try {
    attempt(record);
    return { ok: true, stripped: 0 };
  } catch {
    let stripped = 0;
    const lean = {
      ...record,
      frames: record.frames.map((f) => {
        if (typeof f.imageUrl === 'string' && f.imageUrl.startsWith('data:')) {
          stripped += 1;
          return { ...f, imageUrl: null, status: 'idle' };
        }
        return f;
      }),
    };
    try {
      attempt(lean);
      return { ok: true, stripped };
    } catch (err) {
      return { ok: false, error: err };
    }
  }
}

export function StoryboardStudio(options = {}) {
  const { embedded = false } = options;
  const undoRedo = createUndoRedo();
  const cleanups = [];
  const listen = (target, type, handler) => {
    target.addEventListener(type, handler);
    cleanups.push(() => target.removeEventListener(type, handler));
  };

  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col bg-app-bg overflow-y-auto relative storyboard-studio';
  mountStudioChrome(container, { currentRoute: 'storyboard' });
  container.setAttribute('data-app', 'storyboard');

  // ---- State (per mount) ----
  const intent = getVideoIntent();
  const defaultModel = t2iModels[0];
  let selectedModel = defaultModel.id;
  let selectedModelName = defaultModel.name;
  let selectedAr = STORY_ASPECT_RATIOS.includes(intent.aspectRatio) ? intent.aspectRatio : (defaultModel.inputs?.aspect_ratio?.default || '16:9');
  let customThumbnailUrl = null;
  let selectedStyle = intent.stylePreset || 'None';
  let selectedLighting = intent.lightingPreset || 'None';
  let selectedColor = intent.colorGrade || 'None';
  let layout = 'horizontal';
  let projectName = '';
  let enhancedConcept = '';
  let generatedStoryboard = null;
  const settings = { negativePrompt: '', seed: -1, guidanceScale: undefined, steps: undefined, usePreviousFrame: false };
  const generation = { running: false, stop: false, total: 0, done: 0, failedIds: [] };
  const storyboardAttachments = { images: [], videos: [], audios: [] };
  const activeProfileRef = { value: null };

  const frames = [
    createFrame({ shot: 'Wide Shot' }),
    createFrame({ shot: 'Medium Shot' }),
    createFrame({ shot: 'Close-Up' }),
  ];
  renumberFrames(frames);
  /** id -> { imageArea, genBtn, card } for the cards currently on screen */
  const frameRefs = new Map();

  // ---- Deep links (gallery templates, academy, ?prompt=) ----
  let deepLinkPrompt = '';
  let deepLinkDuration = null;
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const templateParam = urlParams.get('template');
    const academyParam = urlParams.get('academy-template');
    const promptParam = urlParams.get('prompt');
    if (templateParam) {
      const tpl = resolveTemplate(templateParam);
      if (tpl) {
        if (tpl.model) { selectedModel = tpl.model; }
        if (tpl.aspectRatio) { selectedAr = tpl.aspectRatio; }
        if (tpl.duration) deepLinkDuration = tpl.duration;
        if (tpl.basePrompt) {
          deepLinkPrompt = tpl.basePrompt;
        } else if (tpl.slug) {
          loadTemplatePrompt(templateParam).then((prompt) => {
            const ta = prompt && container.querySelector('#vi-premise');
            if (ta && !ta.value) { ta.value = prompt; ta.dispatchEvent(new Event('input', { bubbles: true })); }
          }).catch(() => {});
        }
      }
    }
    if (academyParam || promptParam) {
      const target = academyParam ? getAcademyCreateTarget(academyParam) : null;
      const params = target?.params || {};
      if (params.prompt || promptParam) deepLinkPrompt = params.prompt || promptParam;
      if (params.aspect_ratio) selectedAr = params.aspect_ratio;
      if (params.duration) deepLinkDuration = params.duration;
    }
  } catch { /* ignore bad deep-link params */ }
  const selectedModelInfo = getModelById(selectedModel);
  if (selectedModelInfo) selectedModelName = selectedModelInfo.name;

  // =====================================================================
  // 1. Header
  // =====================================================================
  const topBar = document.createElement('div');
  topBar.className = 'px-4 md:px-8 pt-6 pb-4 shrink-0';
  if (!embedded) {
    topBar.appendChild(createStudioHeader('storyboard', 'Storyboard Studio', 'Plan scenes as AI storyboard frames, then turn them into video', 'mb-4'));
  }
  const inlineInstructions = createInlineInstructions('storyboard');
  inlineInstructions.classList.add('px-4', 'md:px-8', 'mt-2');
  topBar.appendChild(inlineInstructions);
  container.appendChild(topBar);

  // =====================================================================
  // 2. Story brief (open by default: this is where a storyboard starts)
  // =====================================================================
  const optionsHtml = (list, current) => list
    .map((o) => `<option value="${escapeHtml(o)}"${o === current ? ' selected' : ''}>${escapeHtml(o)}</option>`)
    .join('');
  const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

  const brief = document.createElement('section');
  brief.className = 'shrink-0 px-4 md:px-8 mb-4';
  brief.setAttribute('aria-label', 'Story brief');
  brief.innerHTML = `
    <div class="bg-white/5 border border-white/10 rounded-xl p-4 md:p-6">
      <button id="video-intent-toggle" type="button" aria-expanded="true" class="flex items-center justify-between w-full text-left">
        <span class="${CINEMATIC_THEME.text.body} font-bold text-white">1 · Story brief</span>
        <svg id="video-intent-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="text-white/60 transition-transform" style="transform:rotate(180deg)"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div id="video-intent-form" class="mt-4">
        <div class="mb-4">
          <label class="${LABEL_CLASS}" for="vi-subject">What is the video about?</label>
          <input type="text" id="vi-subject" value="${escapeHtml(intent.subject)}" placeholder="e.g. A trail-running shoe launch" class="${FIELD_CLASS}" />
        </div>
        <div class="mb-4">
          <label class="${LABEL_CLASS}" for="vi-premise">Story / key message</label>
          <textarea id="vi-premise" rows="3" placeholder="The core narrative or value proposition..." class="${FIELD_CLASS} resize-none">${escapeHtml(deepLinkPrompt || intent.premise)}</textarea>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div><label class="${LABEL_CLASS}" for="vi-videoType">Video type</label>
            <select id="vi-videoType" class="${FIELD_CLASS} appearance-none cursor-pointer">${VIDEO_TYPES.map((v) => `<option value="${v}"${v === intent.videoType ? ' selected' : ''}>${titleCase(v)}</option>`).join('')}</select></div>
          <div><label class="${LABEL_CLASS}" for="vi-tone">Tone</label>
            <select id="vi-tone" class="${FIELD_CLASS} appearance-none cursor-pointer">${TONES.map((v) => `<option value="${v}"${v === intent.tone ? ' selected' : ''}>${titleCase(v)}</option>`).join('')}</select></div>
          <div><label class="${LABEL_CLASS}" for="vi-duration">Total length (sec)</label>
            <input type="number" id="vi-duration" value="${deepLinkDuration || intent.duration || 60}" min="${MIN_FRAMES * 2}" max="300" class="${FIELD_CLASS}" /></div>
          <div><label class="${LABEL_CLASS}" for="vi-frameCount">Frames (${MIN_FRAMES}-${MAX_FRAMES})</label>
            <input type="number" id="vi-frameCount" value="${clampFrameCount(intent.frameCount)}" min="${MIN_FRAMES}" max="${MAX_FRAMES}" class="${FIELD_CLASS}" /></div>
          <div><label class="${LABEL_CLASS}" for="vi-targetAudience">Audience</label>
            <input type="text" id="vi-targetAudience" value="${escapeHtml(intent.targetAudience)}" placeholder="e.g. Gen Z, professionals" class="${FIELD_CLASS}" /></div>
          <div class="md:col-span-3"><label class="${LABEL_CLASS}" for="vi-cta">Call to action (optional)</label>
            <input type="text" id="vi-cta" value="${escapeHtml(intent.cta)}" placeholder="e.g. Shop now" class="${FIELD_CLASS}" /></div>
        </div>
        <div class="mb-4">
          <label class="${LABEL_CLASS}" for="vi-storyBible">Characters, setting and look (kept the same in every frame)</label>
          <textarea id="vi-storyBible" rows="2" placeholder="e.g. Mara, 30s, red jacket, short dark hair. Rainy neon city at night." class="${FIELD_CLASS} resize-none">${escapeHtml(intent.storyBible)}</textarea>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div><label class="${LABEL_CLASS}" for="vi-stylePreset">Visual style</label>
            <select id="vi-stylePreset" class="${FIELD_CLASS} appearance-none cursor-pointer">${optionsHtml(STYLE_OPTIONS, selectedStyle)}</select></div>
          <div><label class="${LABEL_CLASS}" for="vi-lightingPreset">Lighting</label>
            <select id="vi-lightingPreset" class="${FIELD_CLASS} appearance-none cursor-pointer">${optionsHtml(LIGHTING_OPTIONS, selectedLighting)}</select></div>
          <div><label class="${LABEL_CLASS}" for="vi-colorGrade">Color grade</label>
            <select id="vi-colorGrade" class="${FIELD_CLASS} appearance-none cursor-pointer">${optionsHtml(COLOR_OPTIONS, selectedColor)}</select></div>
        </div>
        <div class="flex items-center gap-3 flex-wrap">
          <button id="vi-generate-btn" type="button" class="${PRIMARY_BTN_CLASS}">Generate storyboard</button>
          <label class="flex items-center gap-2 text-[11px] text-secondary cursor-pointer">
            <input type="checkbox" id="vi-with-images" checked class="accent-primary" /> Also generate frame images
          </label>
          <span id="vi-status" class="text-[10px] text-muted" role="status" aria-live="polite"></span>
        </div>
        <p class="text-[10px] text-muted mt-3">We plan the shots, camera moves, timing and narration. You can edit every frame afterwards. Add reference images or video with the paperclip below.</p>
      </div>
    </div>
  `;
  container.appendChild(brief);

  const $ = (sel) => brief.querySelector(sel);
  const premiseEl = $('#vi-premise');
  const durationEl = $('#vi-duration');
  const frameCountEl = $('#vi-frameCount');
  let frameCountTouched = false;

  createAttachmentToolbar({
    container: brief,
    getTextarea: () => premiseEl,
    acceptStartFrame: false,
    acceptEndFrame: false,
    onUpload: async (key, file) => {
      try {
        const { ingestStudioUpload } = await import('../lib/muapiStudioMedia.js');
        const stored = await ingestStudioUpload(file, { studioId: 'storyboard-studio', uploadToMuapi: false });
        storyboardAttachments[key] = storyboardAttachments[key] || [];
        storyboardAttachments[key].push({ url: stored.url, assetId: stored.assetId });
        showToast('Reference uploaded', 'success');
      } catch (err) {
        const { describeMuapiUploadError } = await import('../lib/muapiStudioMedia.js');
        showToast(await describeMuapiUploadError(err), 'error');
      }
    },
  });

  const toggleBtn = $('#video-intent-toggle');
  toggleBtn.addEventListener('click', () => {
    const formEl = $('#video-intent-form');
    const willOpen = formEl.classList.contains('hidden');
    formEl.classList.toggle('hidden', !willOpen);
    toggleBtn.setAttribute('aria-expanded', String(willOpen));
    $('#video-intent-chevron').style.transform = willOpen ? 'rotate(180deg)' : 'rotate(0deg)';
  });

  /** Read the brief form into one intent object. */
  function readBrief() {
    return {
      subject: $('#vi-subject').value,
      premise: premiseEl.value,
      videoType: $('#vi-videoType').value,
      tone: $('#vi-tone').value,
      duration: Math.max(MIN_FRAMES * 2, parseInt(durationEl.value, 10) || 60),
      frameCount: clampFrameCount(frameCountEl.value),
      targetAudience: $('#vi-targetAudience').value,
      cta: $('#vi-cta').value,
      storyBible: $('#vi-storyBible').value,
      stylePreset: selectedStyle,
      lightingPreset: selectedLighting,
      colorGrade: selectedColor,
      aspectRatio: selectedAr,
    };
  }

  function writeBrief(values = {}) {
    const set = (id, v) => { const el = $(id); if (el && v !== undefined && v !== null) el.value = v; };
    set('#vi-subject', values.subject);
    set('#vi-premise', values.premise);
    set('#vi-videoType', values.videoType);
    set('#vi-tone', values.tone);
    set('#vi-duration', values.duration);
    set('#vi-frameCount', values.frameCount);
    set('#vi-targetAudience', values.targetAudience);
    set('#vi-cta', values.cta);
    set('#vi-storyBible', values.storyBible);
    if (values.stylePreset) { selectedStyle = values.stylePreset; set('#vi-stylePreset', selectedStyle); }
    if (values.lightingPreset) { selectedLighting = values.lightingPreset; set('#vi-lightingPreset', selectedLighting); }
    if (values.colorGrade) { selectedColor = values.colorGrade; set('#vi-colorGrade', selectedColor); }
  }

  // The brief is shared with the Cinema Template Studio through the intent store.
  const syncBriefToStore = () => {
    const b = readBrief();
    selectedStyle = b.stylePreset = $('#vi-stylePreset').value;
    selectedLighting = b.lightingPreset = $('#vi-lightingPreset').value;
    selectedColor = b.colorGrade = $('#vi-colorGrade').value;
    if (!embedded) setVideoIntent({ ...b, aspectRatio: STORY_ASPECT_RATIOS.includes(selectedAr) ? selectedAr : getVideoIntent().aspectRatio });
    scheduleAutosave();
  };
  brief.querySelectorAll('input, select, textarea').forEach((el) => {
    if (el.id === 'vi-with-images') return;
    el.addEventListener('input', syncBriefToStore);
    el.addEventListener('change', syncBriefToStore);
  });
  frameCountEl.addEventListener('input', () => { frameCountTouched = true; });
  durationEl.addEventListener('input', () => {
    if (frameCountTouched) return;
    frameCountEl.value = frameCountForDuration(durationEl.value);
  });

  const generateBtn = $('#vi-generate-btn');
  const statusEl = $('#vi-status');
  const withImagesEl = $('#vi-with-images');

  // =====================================================================
  // 3. Toolbar (grouped)
  // =====================================================================
  const toolbar = document.createElement('div');
  toolbar.className = 'shrink-0 px-4 md:px-8 mb-4 flex flex-col gap-3';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Storyboard tools');
  container.appendChild(toolbar);

  const makeRow = () => {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 flex-wrap';
    toolbar.appendChild(row);
    return row;
  };
  const makeBtn = (label, { primary = false, title = '', aria = '' } = {}) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = primary ? PRIMARY_BTN_CLASS : BTN_CLASS;
    b.textContent = label;
    if (title) b.title = title;
    if (aria) b.setAttribute('aria-label', aria);
    return b;
  };
  const makeSelect = (list, value, onChange, ariaLabel) => {
    const s = document.createElement('select');
    s.className = `${FIELD_CLASS} !w-auto appearance-none cursor-pointer`;
    s.setAttribute('aria-label', ariaLabel);
    list.forEach(({ id, label }) => {
      const o = document.createElement('option');
      o.value = id; o.textContent = label; o.style.background = '#111';
      if (id === value) o.selected = true;
      s.appendChild(o);
    });
    s.onchange = () => onChange(s.value);
    return s;
  };
  const makeMenu = (label, items) => {
    const menu = document.createElement('div');
    menu.className = 'overflow-menu shrink-0';
    menu.innerHTML = `
      <button type="button" class="${BTN_CLASS}" aria-haspopup="true">${label}</button>
      <div class="overflow-menu__panel">${items.map((i) => `<button type="button" class="overflow-menu__item" data-act="${i.id}" ${i.attrs || ''}>${i.label}</button>`).join('')}</div>`;
    const trigger = menu.firstElementChild;
    trigger.addEventListener('click', (e) => { e.stopPropagation(); menu.classList.toggle('is-open'); });
    items.forEach((i) => {
      menu.querySelector(`[data-act="${i.id}"]`).addEventListener('click', () => { menu.classList.remove('is-open'); i.run(); });
    });
    listen(window, 'click', (e) => { if (!menu.contains(e.target)) menu.classList.remove('is-open'); });
    return menu;
  };

  // --- Row A: project ---
  const projectRow = makeRow();
  const projectInput = document.createElement('input');
  projectInput.type = 'text';
  projectInput.placeholder = 'Project name';
  projectInput.setAttribute('aria-label', 'Project name');
  projectInput.setAttribute('list', 'storyboard-project-list');
  projectInput.className = `${FIELD_CLASS} !w-48`;
  const projectList = document.createElement('datalist');
  projectList.id = 'storyboard-project-list';
  const refreshProjectList = () => {
    projectList.innerHTML = Object.keys(readProjects()).map((n) => `<option value="${escapeHtml(n)}"></option>`).join('');
  };
  refreshProjectList();
  try { projectInput.value = projectName = localStorage.getItem(LAST_PROJECT_KEY) || ''; } catch { /* storage unavailable */ }
  const saveBtn = makeBtn('Save', { title: 'Save project (Ctrl+S)' });
  const loadBtn = makeBtn('Load', { title: 'Load the project named in the box' });
  const exportMenu = makeMenu('Export ▾', [
    { id: 'pdf', label: 'PDF shot sheet', run: () => exportPdf() },
    { id: 'csv', label: 'CSV shot list', run: () => downloadText('storyboard-shot-list.csv', buildCsv(), 'text/csv') },
    { id: 'json', label: 'JSON', run: () => downloadText('storyboard.json', JSON.stringify(buildStoryboardPayload(), null, 2), 'application/json') },
  ]);
  projectRow.append(projectInput, projectList, saveBtn, loadBtn, exportMenu);

  // --- Row B: edit + generate ---
  const editRow = makeRow();
  const addFrameBtn = makeBtn('+ Add frame');
  const undoBtn = makeBtn('↶ Undo', { title: 'Undo (Ctrl+Z)' });
  const redoBtn = makeBtn('↷ Redo', { title: 'Redo (Ctrl+Shift+Z)' });
  const layoutSelect = makeSelect(LAYOUTS, layout, (v) => { layout = v; renderFrames(); }, 'Layout');
  editRow.append(addFrameBtn, undoBtn, redoBtn, layoutSelect);

  const genAllBtn = document.createElement('button');
  genAllBtn.type = 'button';
  genAllBtn.className = PRIMARY_BTN_CLASS;
  genAllBtn.textContent = 'Generate all frames';
  genAllBtn.setAttribute('aria-label', 'Generate all frames');
  const retryBtn = makeBtn('Retry failed');
  retryBtn.classList.add('hidden');
  const progressWrap = document.createElement('div');
  progressWrap.className = 'hidden items-center gap-2';
  progressWrap.innerHTML = '<div class="w-28 h-1.5 bg-white/10 rounded-full overflow-hidden"><div class="progress-fill h-full bg-primary transition-all" style="width:0%"></div></div><span class="progress-label text-[10px] text-muted tabular-nums" role="status" aria-live="polite"></span>';
  const progressFill = progressWrap.querySelector('.progress-fill');
  const progressLabel = progressWrap.querySelector('.progress-label');

  // Model and aspect-ratio pills (ids used by the picker test and the model selector)
  const dropdown = document.createElement('div');
  dropdown.className = 'absolute z-[200] transition-all opacity-0 pointer-events-none scale-95 origin-bottom-left glass rounded-3xl p-3 translate-y-2 w-[calc(100vw-3rem)] max-w-xs shadow-4xl border border-white/10 flex flex-col';
  dropdown.style.position = 'fixed';
  container.appendChild(dropdown);

  let outsideClickHandler = null;
  function closeDropdown() {
    dropdown.classList.add('opacity-0', 'pointer-events-none');
    dropdown.classList.remove('opacity-100', 'pointer-events-auto');
    if (outsideClickHandler) {
      document.removeEventListener('click', outsideClickHandler);
      outsideClickHandler = null;
    }
  }

  function showDropdown(type, anchorBtn) {
    dropdown.innerHTML = '';
    dropdown.classList.remove('opacity-0', 'pointer-events-none');
    dropdown.classList.add('opacity-100', 'pointer-events-auto');

    if (type === 'model') {
      dropdown.classList.add('w-[calc(100vw-2rem)]', 'md:w-[480px]', 'max-w-md');
      dropdown.classList.remove('max-w-xs', 'max-w-[240px]', 'max-w-[200px]');
      mountModelSelector(dropdown, {
        models: t2iModels,
        selectedModelId: selectedModel,
        showProviderName: true,
        onSelectModel: (model) => {
          selectedModel = model.id;
          selectedModelName = model.name;
          const availableArs = getAspectRatiosForModel(selectedModel);
          if (!availableArs.includes(selectedAr)) selectedAr = availableArs[0];
          container.querySelector('#model-btn-label').textContent = selectedModelName;
          container.querySelector('#ar-btn-label').textContent = selectedAr;
          updateModelBtnIcon();
          refreshSettingsPanel();
          closeDropdown();
        },
      });
    } else if (type === 'ar') {
      dropdown.classList.add('max-w-[240px]');
      dropdown.classList.remove('w-[calc(100vw-3rem)]', 'max-w-xs', 'max-w-[200px]');
      dropdown.innerHTML = '<div class="text-[10px] font-bold text-muted uppercase tracking-widest px-3 py-2 border-b border-white/5 mb-2">Aspect Ratio</div>';
      const list = document.createElement('div');
      list.className = 'flex flex-col gap-1';
      getAspectRatiosForModel(selectedModel).forEach((r) => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between p-3.5 hover:bg-white/5 rounded-2xl cursor-pointer transition-all group';
        item.innerHTML = `
          <span class="text-xs font-bold text-white opacity-80 group-hover:opacity-100 transition-opacity">${escapeHtml(r)}</span>
          ${selectedAr === r ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d9ff00" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg>' : ''}`;
        item.onclick = (e) => {
          e.stopPropagation();
          selectedAr = r;
          container.querySelector('#ar-btn-label').textContent = r;
          if (!embedded) setVideoIntent({ aspectRatio: r });
          scheduleAutosave();
          closeDropdown();
        };
        list.appendChild(item);
      });
      dropdown.appendChild(list);
    }

    if (outsideClickHandler) document.removeEventListener('click', outsideClickHandler);
    outsideClickHandler = (e) => {
      if (!dropdown.contains(e.target) && e.target !== modelBtn && e.target !== arBtn) closeDropdown();
    };
    document.addEventListener('click', outsideClickHandler);
    positionModelSelectorDropdown(dropdown, anchorBtn, 8, container);
  }

  const createControlBtn = (icon, label, id, tooltip) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = id;
    btn.className = 'flex items-center gap-1.5 md:gap-2.5 px-3 md:px-4 py-2 md:py-2.5 bg-white/5 hover:bg-white/10 rounded-xl md:rounded-2xl transition-all border border-white/5 group whitespace-nowrap';
    if (tooltip) btn.setAttribute('data-tooltip', tooltip);
    btn.innerHTML = `
      ${icon}
      <span id="${id}-label" class="text-xs font-bold text-white group-hover:text-primary transition-colors">${escapeHtml(label)}</span>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" class="opacity-20 group-hover:opacity-100 transition-opacity"><path d="M6 9l6 6 6-6"/></svg>`;
    return btn;
  };

  const modelBtn = createControlBtn('<div id="model-btn-icon" class="w-5 h-5 rounded-md flex items-center justify-center overflow-hidden bg-white/5"></div>', selectedModelName, 'model-btn', 'Select AI image model');
  const arBtn = createControlBtn('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-60 text-secondary"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>', selectedAr, 'ar-btn', 'Change aspect ratio');

  const updateModelBtnIcon = () => {
    const iconEl = modelBtn.querySelector('#model-btn-icon');
    if (!iconEl) return;
    const current = t2iModels.find((m) => m.id === selectedModel);
    const provider = current?.provider || 'muapi';
    if (PROVIDER_LOGOS[provider]) {
      iconEl.innerHTML = renderProviderLogoImg(provider, '', 'w-full h-full object-contain', invertLogos.includes(provider) ? 'invert' : '');
    } else {
      const style = getProviderStyle(provider);
      iconEl.innerHTML = `<span class="text-[10px] font-black text-black">${style.text}</span>`;
      iconEl.className = 'w-5 h-5 bg-primary rounded-md flex items-center justify-center shadow-lg shadow-primary/20';
    }
  };
  updateModelBtnIcon();

  modelBtn.onclick = (e) => {
    e.stopPropagation();
    if (dropdown.classList.contains('opacity-100')) closeDropdown(); else showDropdown('model', modelBtn);
  };
  arBtn.onclick = (e) => {
    e.stopPropagation();
    if (dropdown.classList.contains('opacity-100')) closeDropdown(); else showDropdown('ar', arBtn);
  };

  const sendBtn = makeBtn('Send to video studio ▸', { title: 'Use these frames in the Template Studio' });
  sendBtn.classList.add('ml-auto');

  const moreMenu = makeMenu('⋮ Tools', [
    { id: 'gtm', label: '🎯 GTM Boost', attrs: 'data-enhance="gtm"', run: () => openGtmForStoryboard() },
    { id: 'recipe', label: '📋 Recipes', run: () => openRecipeModal({ onRunRecipe: () => {} }).catch((err) => console.error('[Recipe] open failed:', err)) },
    { id: 'monetize', label: '💼 Monetize', run: () => openMonetizationHub().catch((err) => console.error('[Monetization] open failed:', err)) },
    { id: 'prompts', label: '📚 Prompts', run: () => openPromptGallery({ appTheme: 'storyboard-studio', onSelect: (prompt) => { premiseEl.value = prompt; premiseEl.dispatchEvent(new Event('input', { bubbles: true })); premiseEl.focus(); } }).catch((err) => console.error('[PromptGallery] open failed:', err)) },
    { id: 'compare', label: '⚖ Compare frames', run: () => openComparison() },
  ]);

  const generateRow = makeRow();
  generateRow.append(modelBtn, arBtn, genAllBtn, retryBtn, progressWrap, moreMenu);

  // Thumbnail + Personalize (shared studio action row)
  const actionRow = createActionRow();
  generateRow.appendChild(actionRow);
  const personalizeTrigger = mountPersonalizeTrigger({ controlsContainer: actionRow, appId: 'storyboard', getTextarea: () => null });
  const syncProfile = () => { activeProfileRef.value = personalizeTrigger?.getActiveProfile?.() || null; };
  syncProfile();
  listen(window, 'remix:contact-changed', syncProfile);

  const thumbBtn = document.createElement('button');
  thumbBtn.type = 'button';
  thumbBtn.textContent = '🖼 Thumbnail';
  thumbBtn.title = 'Generate a custom thumbnail';
  thumbBtn.className = 'btn-action-secondary shrink-0';
  thumbBtn.addEventListener('click', () => {
    const modal = new TemplateThumbnailModal({
      appTheme: 'storyboard-studio',
      layout: 'panel',
      studioId: 'storyboard-studio',
      studioName: 'Storyboard Studio',
      aspectRatio: selectedAr,
      outputType: 'image',
      onApply: ({ imageUrl }) => {
        customThumbnailUrl = imageUrl;
        saveCustomThumbnailToCache('storyboard-studio', imageUrl);
      },
      onClear: () => {
        customThumbnailUrl = null;
        clearCustomThumbnailCache('storyboard-studio');
      },
    });
    mountThumbnailModal(modal);
    modal.open();
  });
  arrangeActionRow(actionRow, { thumbnail: thumbBtn, personalize: personalizeTrigger?.button });
  generateRow.appendChild(sendBtn);

  const unsubscribeGtm = subscribeToGtmThumbnails(({ imageUrl }) => {
    customThumbnailUrl = imageUrl;
    saveCustomThumbnailToCache('storyboard-studio', imageUrl);
  }, { studioId: 'storyboard-studio' });
  if (typeof unsubscribeGtm === 'function') cleanups.push(unsubscribeGtm);

  // =====================================================================
  // 4. Board, timeline, settings
  // =====================================================================
  const fullscreen = createFullscreenPreview();
  container.appendChild(fullscreen.element);

  const boardHeading = document.createElement('div');
  boardHeading.className = 'shrink-0 px-4 md:px-8 mb-2 flex items-center justify-between';
  boardHeading.innerHTML = `<span class="${CINEMATIC_THEME.text.body} font-bold text-white">2 · Frames</span><span id="board-summary" class="text-[11px] text-secondary tabular-nums"></span>`;
  container.appendChild(boardHeading);

  const framesArea = document.createElement('div');
  container.appendChild(framesArea);

  const timelineStrip = document.createElement('div');
  timelineStrip.className = 'px-4 md:px-8 pb-6 shrink-0';
  container.appendChild(timelineStrip);

  // --- Generation settings (collapsed; only controls the model supports) ---
  const settingsDetails = document.createElement('details');
  settingsDetails.className = 'shrink-0 mx-4 md:mx-8 mb-8 bg-white/[0.04] border border-white/10 rounded-xl';
  settingsDetails.innerHTML = '<summary class="cursor-pointer select-none px-4 py-3 text-xs font-bold text-white">Generation settings</summary>';
  const settingsBody = document.createElement('div');
  settingsBody.className = 'px-4 pb-4 flex flex-col gap-4';
  settingsDetails.appendChild(settingsBody);
  container.appendChild(settingsDetails);

  function refreshSettingsPanel() {
    const inputs = getExtendedModel(getModelById(selectedModel) || { id: selectedModel, inputs: {} })?.inputs || {};
    settingsBody.innerHTML = '';
    const note = document.createElement('p');
    note.className = 'text-[10px] text-muted';
    note.textContent = apiKeyManager.hasOpenAIKey()
      ? 'With an OpenAI key, frames are drawn by OpenAI; only the negative prompt applies. Seed, guidance and steps apply to MuAPI models.'
      : 'These apply to every frame you generate with the selected model.';
    settingsBody.appendChild(note);

    const row = (label, el) => {
      const wrap = document.createElement('div');
      wrap.innerHTML = `<label class="${LABEL_CLASS}">${label}</label>`;
      wrap.appendChild(el);
      settingsBody.appendChild(wrap);
    };

    const neg = document.createElement('input');
    neg.type = 'text';
    neg.className = FIELD_CLASS;
    neg.placeholder = 'e.g. blurry, text, watermark, extra fingers';
    neg.value = settings.negativePrompt;
    neg.oninput = () => { settings.negativePrompt = neg.value; };
    row('Negative prompt', neg);
    const slider = (key, label, min, max, step, fallback) => {
      const wrap = document.createElement('div');
      wrap.className = 'flex items-center gap-3';
      const input = document.createElement('input');
      input.type = 'range'; input.min = min; input.max = max; input.step = step;
      input.value = settings[key] ?? fallback;
      input.className = 'flex-1 accent-primary';
      const out = document.createElement('span');
      out.className = 'text-xs text-primary tabular-nums w-10 text-right';
      out.textContent = settings[key] ?? 'auto';
      input.oninput = () => { settings[key] = Number(input.value); out.textContent = input.value; };
      const reset = document.createElement('button');
      reset.type = 'button'; reset.className = 'text-[10px] text-muted hover:text-white';
      reset.textContent = 'auto';
      reset.onclick = () => { settings[key] = undefined; out.textContent = 'auto'; };
      wrap.append(input, out, reset);
      row(label, wrap);
    };
    if (inputs.guidance_scale) slider('guidanceScale', 'Guidance scale', 1, 20, 0.5, 7.5);
    if (inputs.steps) slider('steps', 'Steps', 10, 50, 1, 25);
    if (inputs.seed) {
      const wrap = document.createElement('div');
      wrap.className = 'flex items-center gap-2';
      const seed = document.createElement('input');
      seed.type = 'number'; seed.min = -1; seed.className = FIELD_CLASS;
      seed.value = settings.seed;
      seed.oninput = () => { const v = parseInt(seed.value, 10); settings.seed = Number.isFinite(v) ? v : -1; };
      const dice = makeBtn('🎲', { title: 'Random seed', aria: 'Random seed' });
      dice.onclick = () => { settings.seed = Math.floor(Math.random() * 2147483647); seed.value = settings.seed; };
      wrap.append(seed, dice);
      row('Seed (-1 = random)', wrap);
    }

    const prev = document.createElement('label');
    prev.className = 'flex items-center gap-2 text-xs text-white cursor-pointer';
    prev.innerHTML = `<input type="checkbox" class="accent-primary" ${settings.usePreviousFrame ? 'checked' : ''}/> Use the previous frame as a reference (keeps characters consistent; frames then generate one at a time)`;
    prev.querySelector('input').onchange = (e) => { settings.usePreviousFrame = e.target.checked; };
    settingsBody.appendChild(prev);
  }
  refreshSettingsPanel();

  // =====================================================================
  // State helpers: undo, autosave, payloads
  // =====================================================================
  function getStoryboardState() {
    return {
      frames: snapshotFrames(frames),
      layout,
      selectedModel,
      selectedModelName,
      selectedAr,
      selectedStyle,
      selectedLighting,
      selectedColor,
      settings: { ...settings },
      brief: readBrief(),
    };
  }

  let autosaveTimer = null;
  function scheduleAutosave() {
    if (!projectName) return;
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => writeProject(projectName, getStoryboardState()), 1500);
  }
  cleanups.push(() => clearTimeout(autosaveTimer));

  let typingSnapshot = null;
  let typingTimer = null;
  function commitTypingSnapshot() {
    clearTimeout(typingTimer);
    if (typingSnapshot) {
      undoRedo.push(typingSnapshot);
      typingSnapshot = null;
      updateUndoRedoButtons();
    }
  }
  /** Call before changing frame text: groups a burst of typing into one undo step. */
  function beginTextEdit() {
    if (!typingSnapshot) typingSnapshot = snapshotFrames(frames);
    clearTimeout(typingTimer);
    typingTimer = setTimeout(commitTypingSnapshot, 800);
    scheduleAutosave();
  }
  cleanups.push(() => clearTimeout(typingTimer));
  function pushUndo() {
    commitTypingSnapshot();
    undoRedo.push(snapshotFrames(frames));
    updateUndoRedoButtons();
  }
  function replaceFrames(next) {
    frames.length = 0;
    frames.push(...next);
    renumberFrames(frames);
    renderFrames();
    scheduleAutosave();
  }
  function updateUndoRedoButtons() {
    undoBtn.classList.toggle('opacity-50', !undoRedo.canUndo() && !typingSnapshot);
    redoBtn.classList.toggle('opacity-50', !undoRedo.canRedo());
  }

  function buildStoryboardPayload() {
    const b = readBrief();
    renumberFrames(frames);
    return {
      id: projectName || `storyboard-${Date.now()}`,
      projectId: projectName || undefined,
      projectName: projectName || 'Untitled storyboard',
      createdAt: generatedStoryboard?.metadata?.generatedAt || new Date().toISOString(),
      videoType: b.videoType,
      duration: totalDuration(frames),
      aspectRatio: selectedAr,
      stylePreset: selectedStyle,
      lightingPreset: selectedLighting,
      colorGrade: selectedColor,
      storyBible: b.storyBible,
      frames: frames.map((f) => syncFrameAliases({ ...f })).map(({ referenceImages, ...rest }) => ({ ...rest, referenceImages })),
    };
  }

  function buildCsv() {
    const header = ['Scene', 'Shot', 'Shot type', 'Camera', 'Duration (s)', 'Description', 'Narration', 'Notes'];
    const rows = frames.map((f, i) => [f.sceneNumber, f.shotNumber || i + 1, f.shot, f.cameraMovement, f.duration, f.prompt, f.narration, f.notes]);
    return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
  }

  function downloadText(filename, text, mime) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function exportPdf() {
    if (!(await requireEntitlement())) return;
    const win = window.open('', '_blank', 'width=1200,height=800');
    if (!win) { showToast('Popup blocked. Please allow popups to export PDF.', 'error'); return; }
    const safeImg = (u) => (typeof u === 'string' && /^(https?:|data:image\/)/.test(u) ? escapeHtml(u) : '');
    const rows = frames.map((f, idx) => `
      <tr>
        <td class="n">${idx + 1}<br><span>${f.sceneNumber}.${f.shotNumber || idx + 1}</span></td>
        <td class="img">${f.imageUrl ? `<img src="${safeImg(f.imageUrl)}" />` : '<div class="empty">No image</div>'}</td>
        <td><b>${escapeHtml(f.shot)}</b><br>${escapeHtml(f.cameraMovement)}<br>${escapeHtml(f.duration)}s</td>
        <td>${escapeHtml(f.prompt)}${f.notes ? `<p class="notes">${escapeHtml(f.notes)}</p>` : ''}</td>
        <td>${escapeHtml(f.narration)}</td>
      </tr>`).join('');
    win.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(projectName || 'Storyboard')}</title><style>
      body{font-family:ui-sans-serif,system-ui,sans-serif;color:#111;padding:24px}
      h1{font-size:20px;margin:0 0 4px} p.meta{color:#555;margin:0 0 16px}
      table{width:100%;border-collapse:collapse} th{text-align:left;font-size:11px;color:#555;border-bottom:2px solid #111;padding:6px}
      td{border-bottom:1px solid #ddd;padding:8px;font-size:12px;vertical-align:top}
      td.n{width:48px;font-weight:700;text-align:center} td.n span{font-weight:400;color:#777;font-size:10px}
      td.img{width:220px} img{width:100%;border-radius:6px} .empty{background:#eee;color:#888;text-align:center;padding:40px 0;border-radius:6px}
      .notes{color:#666;font-style:italic;margin:6px 0 0}
      @media print{tr{page-break-inside:avoid}}
    </style></head><body>
      <h1>${escapeHtml(projectName || 'Storyboard')}</h1>
      <p class="meta">${frames.length} frames · ${totalDuration(frames)}s · ${escapeHtml(selectedAr)} · ${new Date().toLocaleDateString()}</p>
      <table><thead><tr><th>#</th><th>Frame</th><th>Shot / camera / time</th><th>Visual</th><th>Narration</th></tr></thead><tbody>${rows}</tbody></table>
      <script>setTimeout(function(){window.print()},400)</script>
    </body></html>`);
    win.document.close();
  }

  // =====================================================================
  // Frame generation
  // =====================================================================
  function paintImage(frame) {
    const ref = frameRefs.get(frame.id);
    if (!ref) return;
    ref.imageArea.innerHTML = '';
    if (frame.status === 'generating' || frame.status === 'queued') {
      ref.imageArea.innerHTML = `<span class="text-muted text-xs flex items-center gap-2"><span class="animate-spin inline-block">&#9711;</span>${frame.status === 'queued' ? 'Queued' : 'Generating'}...</span>`;
    } else if (frame.imageUrl) {
      const img = document.createElement('img');
      img.src = frame.imageUrl;
      img.className = 'w-full h-full object-cover cursor-pointer';
      img.alt = `Storyboard frame ${frames.indexOf(frame) + 1}`;
      img.onclick = () => fullscreen.show(frame.imageUrl, { type: 'image', prompt: frame.prompt, model: selectedModelName, shot: frame.shot });
      ref.imageArea.appendChild(img);
    } else if (frame.status === 'failed') {
      ref.imageArea.innerHTML = '<span class="text-red-400 text-xs">Failed. Try again.</span>';
    } else {
      ref.imageArea.innerHTML = '<span class="text-muted text-xs">No image yet</span>';
    }
    ref.genBtn.disabled = frame.status === 'generating';
    ref.genBtn.textContent = frame.status === 'generating' ? 'Generating...' : (frame.imageUrl ? 'Regenerate' : 'Generate frame');
  }

  function resolveFramePrompt(frame) {
    let raw = frame.prompt;
    if (frame.enhancedPrompt) {
      raw = frame.enhancedPrompt;
    } else if (enhancedConcept) {
      raw = `${enhancedConcept} Scene: ${frame.prompt}`;
    }
    const profile = activeProfileRef.value;
    return profile ? replaceTokensInPrompt(raw, profile) : raw;
  }

  /** Make one frame's image. Throws on failure (after marking the frame failed). */
  async function generateFrame(frame) {
    if (!frame.prompt.trim()) {
      showToast('Describe this frame first.', 'warning');
      throw new Error('empty prompt');
    }
    if (!(apiKeyManager.hasOpenAIKey() || apiKeyManager.hasMuapiKey())) {
      AuthModal(() => generateFrame(frame).catch(() => {}));
      throw new Error('missing API key');
    }

    frame.status = 'generating';
    paintImage(frame);
    try {
      const idx = frames.indexOf(frame);
      const refs = [...(frame.referenceImages || [])];
      const prev = idx > 0 ? frames[idx - 1] : null;
      if (settings.usePreviousFrame && prev?.imageUrl && /^https?:/.test(prev.imageUrl)) refs.push({ url: prev.imageUrl });

      const prompt = buildFramePrompt({ ...frame, enhancedPrompt: undefined, prompt: resolveFramePrompt(frame) }, { storyBible: readBrief().storyBible });
      const url = await engineGenerateFrameImage(prompt, selectedAr, selectedModel, selectedStyle, selectedLighting, selectedColor, customThumbnailUrl, {
        negativePrompt: settings.negativePrompt || undefined,
        seed: settings.seed,
        guidanceScale: settings.guidanceScale,
        steps: settings.steps,
        referenceImages: refs,
      });
      if (!url) throw new Error('No image was returned');
      frame.imageUrl = url;
      frame.status = 'done';
      registerGeneration('storyboard', 'image', url, { prompt, model: selectedModel || '', parameters: { shot: frame.shot, aspect_ratio: selectedAr } });
      scheduleAutosave();
    } catch (err) {
      frame.status = 'failed';
      showToast(`Frame ${frames.indexOf(frame) + 1}: ${err.message}`, 'error');
      throw err;
    } finally {
      paintImage(frame);
    }
  }

  function updateProgress() {
    const failed = generation.failedIds.length;
    progressWrap.classList.toggle('hidden', generation.total === 0);
    progressWrap.classList.toggle('flex', generation.total > 0);
    progressFill.style.width = generation.total ? `${Math.round(((generation.done + failed) / generation.total) * 100)}%` : '0%';
    progressLabel.textContent = `${generation.done}/${generation.total}${failed ? ` · ${failed} failed` : ''}`;
    retryBtn.classList.toggle('hidden', failed === 0 || generation.running);
  }

  /** Generate a list of frames with limited concurrency. Failures are collected, not thrown. */
  async function runQueue(list) {
    generation.running = true;
    generation.stop = false;
    generation.total = list.length;
    generation.done = 0;
    generation.failedIds = [];
    genAllBtn.textContent = 'Stop';
    list.forEach((f) => { f.status = 'queued'; paintImage(f); });
    updateProgress();

    const concurrency = settings.usePreviousFrame ? 1 : GENERATION_CONCURRENCY;
    let cursor = 0;
    const worker = async () => {
      while (cursor < list.length && !generation.stop) {
        const frame = list[cursor++];
        if (!frames.includes(frame)) { generation.total -= 1; continue; }
        try {
          await withRetry(() => generateFrame(frame));
          generation.done += 1;
        } catch {
          generation.failedIds.push(frame.id);
        }
        updateProgress();
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));
    list.forEach((f) => { if (f.status === 'queued') { f.status = f.imageUrl ? 'done' : 'idle'; paintImage(f); } });

    generation.running = false;
    genAllBtn.textContent = 'Generate all frames';
    updateProgress();
    if (generation.stop) showToast('Stopped. Finished frames are kept.', 'info');
    else if (!generation.failedIds.length) showToast('All frames generated', 'success');
    else showToast(`${generation.failedIds.length} frame(s) failed. Use "Retry failed".`, 'warning');
  }

  genAllBtn.onclick = async () => {
    if (generation.running) { generation.stop = true; genAllBtn.textContent = 'Stopping...'; return; }
    if (!(await requireEntitlement())) return;
    const list = frames.filter((f) => f.prompt.trim());
    if (!list.length) { showToast('Describe at least one frame first.', 'warning'); return; }
    if (!(apiKeyManager.hasOpenAIKey() || apiKeyManager.hasMuapiKey())) { AuthModal(() => genAllBtn.click()); return; }
    await runQueue(list);
  };

  retryBtn.onclick = async () => {
    const list = generation.failedIds.map((id) => frames.find((f) => f.id === id)).filter(Boolean);
    if (!list.length) return;
    await runQueue(list);
  };

  // =====================================================================
  // Generate a whole storyboard from the brief
  // =====================================================================
  generateBtn.addEventListener('click', async () => {
    if (!(await requireEntitlement())) return;
    const hasContent = frames.some((f) => f.prompt.trim() || f.imageUrl);
    if (hasContent && typeof window.confirm === 'function' && !window.confirm('Replace the current frames with a new storyboard?')) return;

    const { resolveMuapiMediaRefs } = await import('../lib/muapiStudioMedia.js');
    const b = readBrief();
    const request = {
      ...b,
      model: selectedModel,
      customThumbnailUrl: customThumbnailUrl || undefined,
      reference_images: storyboardAttachments.images?.length ? await resolveMuapiMediaRefs(storyboardAttachments.images) : undefined,
      reference_videos: storyboardAttachments.videos?.length ? await resolveMuapiMediaRefs(storyboardAttachments.videos) : undefined,
      reference_audios: storyboardAttachments.audios?.length ? await resolveMuapiMediaRefs(storyboardAttachments.audios) : undefined,
    };

    generateBtn.disabled = true;
    generateBtn.innerHTML = '<span class="animate-spin inline-block mr-2">&#9711;</span> Planning...';
    statusEl.textContent = 'Planning shots...';
    try {
      const result = await generateStoryboardFromIntent(request, { generateImages: false });
      generatedStoryboard = result;
      pushUndo();
      replaceFrames(result.frames);
      layout = 'grid';
      layoutSelect.value = 'grid';
      renderFrames();
      statusEl.textContent = `${result.frames.length} frames planned${result.source === 'ai' ? '' : ' (template; add an OpenAI key for a custom story)'}`;
      showToast('Storyboard planned', 'success');
      boardHeading.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      if (withImagesEl.checked && (apiKeyManager.hasOpenAIKey() || apiKeyManager.hasMuapiKey())) {
        await runQueue(frames.filter((f) => f.prompt.trim()));
      }
    } catch (err) {
      statusEl.textContent = '';
      showToast('Could not plan the storyboard: ' + err.message, 'error');
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate storyboard';
    }
  });

  // =====================================================================
  // Frames board
  // =====================================================================
  function getLayoutClasses() {
    if (layout === 'grid') return 'shrink-0 px-4 md:px-8 pb-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4';
    if (layout === 'story') return 'shrink-0 px-4 md:px-8 pb-6 flex flex-col gap-6 max-w-3xl';
    return 'shrink-0 px-4 md:px-8 pb-6 flex gap-4 overflow-x-auto no-scrollbar';
  }

  function updateSummary() {
    const el = container.querySelector('#board-summary');
    if (el) el.textContent = `${frames.length} frames · ${totalDuration(frames)}s`;
  }

  function fieldLabel(text) {
    const l = document.createElement('label');
    l.className = 'block text-[9px] font-bold text-secondary uppercase tracking-widest mb-1';
    l.textContent = text;
    return l;
  }

  function buildFrameCard(frame, idx) {
    const card = document.createElement('div');
    const wide = layout === 'grid' || layout === 'story';
    card.className = `${wide ? 'w-full' : 'shrink-0 w-80'} bg-white/[0.03] border border-white/5 rounded-xl p-4 flex flex-col gap-3`;
    card.dataset.frameIndex = idx;
    card.draggable = true;

    card.ondragstart = (e) => {
      if (e.target !== card) return; // only drag from the card, not from inside a text field
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(idx));
      card.classList.add('opacity-50');
    };
    card.ondragend = () => card.classList.remove('opacity-50');
    card.ondragover = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
    card.ondrop = (e) => {
      e.preventDefault();
      const from = Number(e.dataTransfer.getData('text/plain'));
      if (Number.isNaN(from) || from === idx || from < 0 || from >= frames.length) return;
      moveFrame(from, idx);
    };

    // Header: number, scene.shot, move/duplicate/delete
    const head = document.createElement('div');
    head.className = 'flex items-center justify-between gap-2';
    head.innerHTML = `
      <span class="text-xs font-bold text-primary">Frame ${idx + 1} <span class="text-muted font-normal">· ${frame.sceneNumber}.${frame.shotNumber}</span></span>
      <span class="flex items-center gap-1 text-muted">
        <button type="button" class="px-1.5 hover:text-white disabled:opacity-30" data-act="up" title="Move earlier" aria-label="Move frame earlier" ${idx === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="px-1.5 hover:text-white disabled:opacity-30" data-act="down" title="Move later" aria-label="Move frame later" ${idx === frames.length - 1 ? 'disabled' : ''}>↓</button>
        <button type="button" class="px-1.5 hover:text-white" data-act="dup" title="Duplicate frame" aria-label="Duplicate frame">⧉</button>
        <button type="button" class="px-1.5 hover:text-red-400 disabled:opacity-30" data-act="del" title="Delete frame" aria-label="Delete frame" ${frames.length <= 1 ? 'disabled' : ''}>&times;</button>
      </span>`;
    head.querySelector('[data-act="up"]').onclick = () => moveFrame(idx, idx - 1);
    head.querySelector('[data-act="down"]').onclick = () => moveFrame(idx, idx + 1);
    head.querySelector('[data-act="dup"]').onclick = () => {
      pushUndo();
      const copy = createFrame({ ...frame, id: undefined, imageUrl: frame.imageUrl, referenceImages: [...(frame.referenceImages || [])] });
      frames.splice(idx + 1, 0, copy);
      replaceFrames(frames.slice());
    };
    head.querySelector('[data-act="del"]').onclick = () => {
      if (frames.length <= 1) return;
      pushUndo();
      frames.splice(idx, 1);
      replaceFrames(frames.slice());
    };
    card.appendChild(head);

    const imageArea = document.createElement('div');
    imageArea.className = 'w-full aspect-video bg-white/[0.02] rounded-lg border border-white/5 flex items-center justify-center overflow-hidden';
    imageArea.setAttribute('role', 'status');
    imageArea.setAttribute('aria-live', 'polite');
    if (selectedAr === '9:16') imageArea.className = imageArea.className.replace('aspect-video', 'aspect-[9/16] max-h-80 mx-auto');
    else if (selectedAr === '1:1') imageArea.className = imageArea.className.replace('aspect-video', 'aspect-square');
    else if (selectedAr === '4:5') imageArea.className = imageArea.className.replace('aspect-video', 'aspect-[4/5] max-h-80 mx-auto');
    card.appendChild(imageArea);

    // Shot / camera / duration
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-3 gap-2';
    const mkSelect = (label, options, value, onChange) => {
      const wrap = document.createElement('div');
      wrap.appendChild(fieldLabel(label));
      const s = document.createElement('select');
      s.className = `${FIELD_CLASS} appearance-none cursor-pointer`;
      options.forEach((o) => {
        const opt = document.createElement('option');
        opt.value = o; opt.textContent = o; opt.style.background = '#111';
        if (o === value) opt.selected = true;
        s.appendChild(opt);
      });
      s.onchange = () => { pushUndo(); onChange(s.value); scheduleAutosave(); renderTimelineStrip(); };
      wrap.appendChild(s);
      return wrap;
    };
    grid.appendChild(mkSelect('Shot', SHOT_TYPES, frame.shot, (v) => { frame.shot = v; syncFrameAliases(frame); }));
    grid.appendChild(mkSelect('Camera', CAMERA_MOVEMENTS, frame.cameraMovement, (v) => { frame.cameraMovement = v; }));
    const durWrap = document.createElement('div');
    durWrap.appendChild(fieldLabel('Seconds'));
    const dur = document.createElement('input');
    dur.type = 'number'; dur.min = 1; dur.max = 60; dur.value = frame.duration;
    dur.className = FIELD_CLASS;
    dur.setAttribute('aria-label', `Frame ${idx + 1} duration in seconds`);
    dur.oninput = () => {
      beginTextEdit();
      frame.duration = Math.max(1, Math.min(60, Math.round(Number(dur.value)) || 1));
      renderTimelineStrip();
      updateSummary();
    };
    durWrap.appendChild(dur);
    grid.appendChild(durWrap);
    card.appendChild(grid);

    const textField = (label, tag, prop, placeholder, rows) => {
      const wrap = document.createElement('div');
      wrap.appendChild(fieldLabel(label));
      const el = document.createElement(tag);
      if (tag === 'input') el.type = 'text';
      else { el.rows = rows || 2; }
      el.className = `${FIELD_CLASS} ${tag === 'textarea' ? 'resize-none' : ''}`;
      el.placeholder = placeholder;
      el.value = frame[prop] || '';
      el.setAttribute('aria-label', `Frame ${idx + 1} ${label.toLowerCase()}`);
      el.oninput = () => {
        beginTextEdit();
        frame[prop] = el.value;
        if (prop === 'prompt') { frame.description = el.value; if (frame.enhancedPrompt) { frame.enhancedPrompt = undefined; } }
      };
      wrap.appendChild(el);
      return wrap;
    };

    const descWrap = textField('What we see', 'textarea', 'prompt', 'Describe this shot...', 3);
    card.appendChild(descWrap);

    // Apply a quick shot-style starter to THIS frame only
    const starter = document.createElement('div');
    starter.className = 'flex items-center justify-between -mt-1 gap-2';
    const starterBtn = document.createElement('button');
    starterBtn.type = 'button';
    starterBtn.className = 'text-[10px] font-bold text-primary hover:text-white transition-colors';
    starterBtn.textContent = '✨ Start from shot preset';
    starterBtn.title = 'Fill an empty description with a starter for this shot type';
    starterBtn.onclick = () => {
      if (frame.prompt.trim() && typeof window.confirm === 'function' && !window.confirm('Replace this frame\'s description?')) return;
      pushUndo();
      frame.prompt = SHOT_PRESETS[frame.shot] || '';
      syncFrameAliases(frame);
      renderFrames();
      scheduleAutosave();
    };
    const enhanceBtn = document.createElement('button');
    enhanceBtn.type = 'button';
    enhanceBtn.className = 'text-[10px] font-bold text-primary hover:text-white transition-colors';
    enhanceBtn.textContent = frame.enhancedPrompt ? '🎯 Enhanced' : '🎯 Enhance';
    enhanceBtn.title = 'Enhance this frame with GTM conversion frameworks';
    enhanceBtn.onclick = () => {
      import('../lib/uiIntegration.js').then(({ openGTMPromptModal }) => {
        openGTMPromptModal('storyboard-frame', (prompt) => {
          frame.enhancedPrompt = prompt;
          enhanceBtn.textContent = '🎯 Enhanced';
          scheduleAutosave();
        }, { basePrompt: frame.enhancedPrompt || frame.prompt });
      }).catch((err) => console.error('[StoryboardStudio] Frame GTM Boost failed:', err));
    };
    starter.append(starterBtn, enhanceBtn);
    card.appendChild(starter);

    card.appendChild(textField('Narration / dialogue', 'input', 'narration', 'Voice-over for this shot (optional)'));
    card.appendChild(textField('Director notes', 'input', 'notes', 'Notes (optional)'));

    // Reference image (upload / library / Pexels)
    const refRow = document.createElement('div');
    refRow.className = 'flex items-center gap-2';
    const refThumbWrap = document.createElement('div');
    refThumbWrap.className = 'hidden w-8 h-8 rounded-md overflow-hidden border border-white/10 relative shrink-0';
    const refThumb = document.createElement('img');
    refThumb.className = 'w-full h-full object-cover';
    refThumb.alt = 'Reference';
    refThumbWrap.appendChild(refThumb);
    const refRemoveBtn = document.createElement('button');
    refRemoveBtn.type = 'button';
    refRemoveBtn.className = 'hidden absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors';
    refRemoveBtn.innerHTML = '<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    refRemoveBtn.title = 'Remove reference';
    refRemoveBtn.setAttribute('aria-label', 'Remove reference image');
    refRemoveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      frame.referenceImages = [];
      refThumbWrap.classList.add('hidden');
      refRemoveBtn.classList.add('hidden');
      resetRef();
      scheduleAutosave();
    });
    refThumbWrap.appendChild(refRemoveBtn);

    const { trigger: refTrigger, reset: resetRef } = createUploadPicker({
      anchorContainer: card,
      maxImages: 1,
      onSelect: ({ url, thumbnail }) => {
        frame.referenceImages = [{ url, thumbnail }];
        refThumb.src = thumbnail;
        refThumbWrap.classList.remove('hidden');
        refRemoveBtn.classList.remove('hidden');
        scheduleAutosave();
      },
      onClear: () => {
        frame.referenceImages = [];
        refThumbWrap.classList.add('hidden');
        refRemoveBtn.classList.add('hidden');
        scheduleAutosave();
      },
    });
    if (frame.referenceImages?.[0]?.thumbnail) {
      refThumb.src = frame.referenceImages[0].thumbnail;
      refThumbWrap.classList.remove('hidden');
      refRemoveBtn.classList.remove('hidden');
    }
    refRow.appendChild(refTrigger);

    const pexelsRefBtn = document.createElement('button');
    pexelsRefBtn.type = 'button';
    pexelsRefBtn.title = 'Browse a reference frame from Pexels';
    pexelsRefBtn.setAttribute('aria-label', 'Browse a reference frame from Pexels');
    pexelsRefBtn.className = 'w-8 h-8 shrink-0 rounded-md border transition-all flex items-center justify-center bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40';
    pexelsRefBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-secondary"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>';
    const attrBox = document.createElement('div');
    attrBox.className = 'mt-1';
    pexelsRefBtn.onclick = async () => {
      const { browsePexelsImages } = await import('../lib/studioPexels.js');
      browsePexelsImages({
        title: 'Select Reference Frame',
        studioName: 'Storyboard Studio',
        onSelect: (asset) => {
          const thumb = asset.src?.medium || asset.src?.small || asset.url || asset.original;
          frame.referenceImages = [{
            url: asset.src?.large || asset.url || asset.original,
            thumbnail: thumb,
            source: 'pexels',
            attribution: {
              photographer: asset.photographer || asset.user?.name || '',
              photographerUrl: asset.photographer_url || asset.user?.url || '',
              pexelsUrl: asset.url || '',
            },
          }];
          refThumb.src = thumb;
          refThumbWrap.classList.remove('hidden');
          refRemoveBtn.classList.remove('hidden');
          scheduleAutosave();
          attrBox.innerHTML = '';
          import('../lib/attributionChip.js').then((mod) => mod.renderAttributionChip(asset, attrBox)).catch(() => {});
        },
      });
    };
    refRow.appendChild(pexelsRefBtn);
    refRow.appendChild(refThumbWrap);
    card.appendChild(refRow);
    card.appendChild(attrBox);

    // Actions
    const genFrameBtn = document.createElement('button');
    genFrameBtn.type = 'button';
    genFrameBtn.className = 'w-full bg-white/10 text-white py-2 rounded-lg text-xs font-bold hover:bg-white/20 transition-all disabled:opacity-60';
    genFrameBtn.setAttribute('aria-label', `Generate frame ${idx + 1}`);
    genFrameBtn.onclick = async () => {
      if (!(await requireEntitlement())) return;
      try { await generateFrame(frame); } catch { /* shown by generateFrame */ }
    };
    card.appendChild(genFrameBtn);

    const actions = document.createElement('div');
    actions.className = 'grid grid-cols-2 gap-2';
    const animateBtn = document.createElement('button');
    animateBtn.type = 'button';
    animateBtn.className = 'bg-white/5 border border-white/10 text-white py-2 rounded-lg text-xs font-bold hover:bg-white/10 transition-all';
    animateBtn.textContent = '▶ Animate';
    animateBtn.title = 'Turn this frame into a video clip';
    animateBtn.onclick = () => animateFrame(frame);
    const publishBtn = document.createElement('button');
    publishBtn.type = 'button';
    publishBtn.className = 'bg-gradient-to-r from-[#6d5efc] to-[#a855f7] text-white py-2 rounded-lg text-xs font-bold hover:shadow-glow transition-all';
    publishBtn.textContent = 'Publish';
    publishBtn.onclick = () => {
      if (!frame.imageUrl) { showToast('Generate this frame first.', 'warning'); return; }
      openSocialPublish({ mediaUrl: frame.imageUrl, mediaType: 'image' });
    };
    actions.append(animateBtn, publishBtn);
    card.appendChild(actions);

    frameRefs.set(frame.id, { imageArea, genBtn: genFrameBtn, card });
    paintImage(frame);
    return card;
  }

  function moveFrame(from, to) {
    if (from === to || to < 0 || to >= frames.length) return;
    pushUndo();
    const [moved] = frames.splice(from, 1);
    frames.splice(to, 0, moved);
    replaceFrames(frames.slice());
  }

  function animateFrame(frame) {
    if (!frame.imageUrl) { showToast('Generate this frame first, then animate it.', 'warning'); return; }
    try {
      sessionStorage.setItem('storyboard_animate_frame', JSON.stringify({
        imageUrl: frame.imageUrl,
        prompt: [frame.prompt, frame.cameraMovement && frame.cameraMovement !== 'Static' ? `${frame.cameraMovement} camera move` : ''].filter(Boolean).join('. '),
        duration: frame.duration,
      }));
    } catch {
      showToast('Could not pass the frame along (browser storage is blocked).', 'error');
      return;
    }
    navigate('animate');
  }

  function renderFrames() {
    frameRefs.clear();
    framesArea.className = getLayoutClasses();
    framesArea.innerHTML = '';
    frames.forEach((frame, idx) => framesArea.appendChild(buildFrameCard(frame, idx)));
    updateSummary();
    renderTimelineStrip();
    updateUndoRedoButtons();
  }

  function renderTimelineStrip() {
    timelineStrip.innerHTML = '';
    if (!frames.length) return;
    const total = totalDuration(frames) || frames.length;
    const label = document.createElement('div');
    label.className = 'text-[10px] font-bold text-secondary uppercase tracking-widest mb-2';
    label.textContent = `Timeline · ${total}s`;
    timelineStrip.appendChild(label);

    const strip = document.createElement('div');
    strip.className = 'flex h-11 rounded-lg border border-white/10 bg-white/[0.03] overflow-hidden';
    strip.setAttribute('role', 'list');
    frames.forEach((frame, idx) => {
      const seg = document.createElement('button');
      seg.type = 'button';
      seg.setAttribute('role', 'listitem');
      seg.className = 'relative flex flex-col items-center justify-center border-r border-white/5 last:border-r-0 hover:bg-white/10 transition-all text-white overflow-hidden';
      seg.style.flex = `${Math.max(1, frame.duration)} 1 0`;
      seg.style.minWidth = '34px';
      if (frame.imageUrl && /^(https?:|data:image\/)/.test(frame.imageUrl)) {
        seg.style.backgroundImage = `linear-gradient(rgba(0,0,0,.55),rgba(0,0,0,.55)), url("${frame.imageUrl.replace(/"/g, '%22')}")`;
        seg.style.backgroundSize = 'cover';
      }
      seg.title = `Frame ${idx + 1}: ${frame.shot} · ${frame.cameraMovement} · ${frame.duration}s`;
      seg.innerHTML = `<span class="text-[10px] font-bold tabular-nums">${idx + 1}</span><span class="text-[9px] text-white/70">${SHOT_ABBREV[frame.shot] || ''} ${frame.duration}s</span>`;
      seg.onclick = () => {
        const ref = frameRefs.get(frame.id);
        if (!ref) return;
        ref.card.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        ref.card.classList.add('ring-2', 'ring-primary');
        setTimeout(() => ref.card.classList.remove('ring-2', 'ring-primary'), 1500);
      };
      strip.appendChild(seg);
    });
    timelineStrip.appendChild(strip);
  }

  // =====================================================================
  // Toolbar actions
  // =====================================================================
  function openGtmForStoryboard() {
    import('../lib/uiIntegration.js').then(({ openGTMPromptModal }) => {
      openGTMPromptModal('storyboard-studio', (prompt) => {
        enhancedConcept = prompt;
        showToast('GTM concept will be applied to every frame you generate.', 'success');
      }, { basePrompt: enhancedConcept || frames.map((f) => f.prompt).filter(Boolean).join(' → ') });
    }).catch((err) => console.error('[StoryboardStudio] GTM Boost failed:', err));
  }

  addFrameBtn.onclick = () => {
    if (frames.length >= 40) { showToast('That is plenty of frames. Delete some first.', 'warning'); return; }
    pushUndo();
    const last = frames[frames.length - 1];
    frames.push(createFrame({ shot: 'Wide Shot', sceneNumber: last?.sceneNumber || 1 }));
    replaceFrames(frames.slice());
  };

  undoBtn.onclick = () => {
    commitTypingSnapshot();
    const prev = undoRedo.undo(snapshotFrames(frames));
    if (prev) replaceFrames(prev);
    updateUndoRedoButtons();
  };
  redoBtn.onclick = () => {
    const next = undoRedo.redo(snapshotFrames(frames));
    if (next) replaceFrames(next);
    updateUndoRedoButtons();
  };

  function applyLoaded(state) {
    if (!state || !Array.isArray(state.frames) || !state.frames.length) return false;
    pushUndo();
    frames.length = 0;
    frames.push(...state.frames.map((f) => createFrame({ ...f, status: f.imageUrl ? 'done' : 'idle' })));
    if (state.layout) { layout = state.layout; layoutSelect.value = layout; }
    if (state.selectedModel) {
      selectedModel = state.selectedModel;
      selectedModelName = state.selectedModelName || getModelById(selectedModel)?.name || selectedModelName;
      container.querySelector('#model-btn-label').textContent = selectedModelName;
      updateModelBtnIcon();
    }
    if (state.selectedAr) { selectedAr = state.selectedAr; container.querySelector('#ar-btn-label').textContent = selectedAr; }
    if (state.settings) Object.assign(settings, state.settings);
    writeBrief({ ...(state.brief || {}), stylePreset: state.selectedStyle || state.brief?.stylePreset, lightingPreset: state.selectedLighting || state.brief?.lightingPreset, colorGrade: state.selectedColor || state.brief?.colorGrade });
    refreshSettingsPanel();
    renumberFrames(frames);
    renderFrames();
    return true;
  }

  saveBtn.onclick = async () => {
    if (!(await requireEntitlement())) return;
    const name = projectInput.value.trim() || `Storyboard ${new Date().toLocaleDateString()}`;
    projectInput.value = projectName = name;
    const result = writeProject(name, getStoryboardState());
    if (!result.ok) { showToast('Could not save: browser storage is full or blocked. Export JSON instead.', 'error'); return; }
    try { localStorage.setItem(LAST_PROJECT_KEY, name); } catch { /* ignore */ }
    refreshProjectList();
    showToast(result.stripped ? `Saved "${name}" without ${result.stripped} large image(s). Export a PDF to keep them.` : `Saved "${name}"`, result.stripped ? 'warning' : 'success');
    // Optional server copy for self-hosted deployments; never blocks or fails the save.
    fetch('/api/storyboard/' + encodeURIComponent(name), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: name, frames, preset: null }),
    }).catch(() => {});
  };

  loadBtn.onclick = async () => {
    if (!(await requireEntitlement())) return;
    const name = projectInput.value.trim();
    const saved = readProjects();
    if (!name) {
      const names = Object.keys(saved);
      showToast(names.length ? `Type a project name. Saved: ${names.slice(0, 5).join(', ')}` : 'No saved storyboards yet.', 'warning');
      return;
    }
    if (saved[name]) {
      applyLoaded(saved[name]);
      projectName = name;
      try { localStorage.setItem(LAST_PROJECT_KEY, name); } catch { /* ignore */ }
      showToast(`Loaded "${name}"`, 'success');
      return;
    }
    try {
      const r = await fetch('/api/storyboard/' + encodeURIComponent(name));
      if (!r.ok) throw new Error('not found');
      const data = await r.json();
      if (applyLoaded(data)) { projectName = name; showToast(`Loaded "${name}"`, 'success'); return; }
    } catch { /* fall through */ }
    showToast(`No saved storyboard named "${name}".`, 'warning');
  };

  sendBtn.onclick = () => {
    if (!frames.some((f) => f.prompt.trim())) { showToast('Describe at least one frame first.', 'warning'); return; }
    const payload = buildStoryboardPayload();
    if (typeof window.useStoryboardInTemplate === 'function') {
      window.useStoryboardInTemplate(payload);
      return;
    }
    // Inline images can be megabytes; the template only needs the text plan in the URL.
    const light = { ...payload, frames: payload.frames.map((f) => ({ ...f, imageUrl: /^data:/.test(f.imageUrl || '') ? null : f.imageUrl })) };
    navigate('cinema-template', { storyboard: JSON.stringify(light) });
  };

  // Keyboard shortcuts (only while this studio is on screen)
  const onKeyDown = (e) => {
    if (!container.isConnected) return;
    const isMeta = e.metaKey || e.ctrlKey;
    if (!isMeta) {
      if (e.key === 'Escape' && !comparisonOverlay.classList.contains('hidden')) closeComparison();
      return;
    }
    const target = e.target;
    const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    const key = e.key.toLowerCase();
    if (key === 's') { e.preventDefault(); saveBtn.click(); return; }
    if (typing) return; // let text fields keep their own undo
    if (key === 'z' && !e.shiftKey) { e.preventDefault(); undoBtn.click(); }
    else if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); redoBtn.click(); }
  };
  listen(window, 'keydown', onKeyDown);

  // =====================================================================
  // Compare overlay
  // =====================================================================
  const compareIndices = [0, 1];
  const comparisonOverlay = document.createElement('div');
  comparisonOverlay.className = 'fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm hidden items-center justify-center p-4';
  comparisonOverlay.innerHTML = `
    <div class="bg-app-bg border border-white/10 rounded-2xl shadow-4xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden" role="dialog" aria-label="Compare frames">
      <div class="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
        <h2 class="${CINEMATIC_THEME.text.body} font-bold text-white tracking-tight">Compare frames</h2>
        <button type="button" class="compare-close-btn text-muted hover:text-white transition-colors text-lg leading-none px-2" aria-label="Close">&times;</button>
      </div>
      <div class="flex-1 overflow-y-auto p-6"><div class="flex flex-col md:flex-row gap-6">
        ${['a', 'b'].map((k) => `
          <div class="flex-1 flex flex-col gap-3">
            <label class="text-[10px] font-bold text-secondary uppercase tracking-widest">Frame ${k.toUpperCase()}</label>
            <select class="compare-select-${k} ${FIELD_CLASS} appearance-none cursor-pointer"></select>
            <div class="aspect-video bg-white/[0.02] rounded-lg border border-white/5 flex items-center justify-center overflow-hidden">
              <img class="compare-image-${k} w-full h-full object-cover hidden" alt="Compare frame ${k.toUpperCase()}" />
              <span class="compare-placeholder-${k} text-muted text-xs">No image</span>
            </div>
            <div class="compare-meta-${k} text-[10px] text-secondary leading-relaxed whitespace-pre-line"></div>
          </div>`).join('')}
      </div></div>
    </div>`;
  container.appendChild(comparisonOverlay);

  function renderComparison() {
    ['a', 'b'].forEach((k, n) => {
      const frame = frames[compareIndices[n]];
      const img = comparisonOverlay.querySelector(`.compare-image-${k}`);
      const ph = comparisonOverlay.querySelector(`.compare-placeholder-${k}`);
      const meta = comparisonOverlay.querySelector(`.compare-meta-${k}`);
      if (frame?.imageUrl) {
        img.src = frame.imageUrl;
        img.classList.remove('hidden');
        ph.classList.add('hidden');
      } else {
        img.classList.add('hidden');
        ph.classList.remove('hidden');
      }
      meta.textContent = frame ? `Shot: ${frame.shot} · ${frame.cameraMovement} · ${frame.duration}s\nPrompt: ${frame.prompt || ''}` : '';
    });
  }
  function openComparison() {
    ['a', 'b'].forEach((k, n) => {
      const sel = comparisonOverlay.querySelector(`.compare-select-${k}`);
      sel.innerHTML = '';
      frames.forEach((_, idx) => {
        const opt = document.createElement('option');
        opt.value = String(idx); opt.textContent = `Frame ${idx + 1}`; opt.style.background = '#111';
        sel.appendChild(opt);
      });
      compareIndices[n] = Math.min(compareIndices[n], frames.length - 1);
      sel.value = String(compareIndices[n]);
      sel.onchange = () => { compareIndices[n] = Number(sel.value); renderComparison(); };
    });
    renderComparison();
    comparisonOverlay.classList.remove('hidden');
    comparisonOverlay.classList.add('flex');
  }
  function closeComparison() {
    comparisonOverlay.classList.add('hidden');
    comparisonOverlay.classList.remove('flex');
  }
  comparisonOverlay.querySelector('.compare-close-btn').addEventListener('click', closeComparison);

  // First paint. The story brief sits above the frames, and the board reflects the saved/last state.
  renderFrames();

  // Cleanup hook called by the router when the page is left.
  container.cleanup = () => {
    commitTypingSnapshot();
    if (outsideClickHandler) document.removeEventListener('click', outsideClickHandler);
    generation.stop = true;
    cleanups.splice(0).forEach((fn) => { try { fn(); } catch { /* ignore */ } });
  };

  return container;
}
