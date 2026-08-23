import { muapi } from '../lib/muapi.js';
import { openSocialPublish } from '../lib/socialPublishHelpers.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { AuthModal } from './AuthModal.js';
import { createInlineInstructions } from './InlineInstructions.js';
import { createHeroSection, getCustomThumbnailFromCache, saveCustomThumbnailToCache, clearCustomThumbnailCache } from '../lib/thumbnails.js';
import { mountPersonalizeTrigger, replaceTokensInPrompt } from './personalize/personalizePopover.js';
import { openaiService } from '../lib/openaiService.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import Store from '../stores/base/Store.js';
import { t2iModels, getAspectRatiosForModel, getModelById, getI2IModelById, getI2VModelById, getV2VModelById } from '../lib/models.js';
import { showToast } from '../lib/loading.js';
import { requireEntitlement } from '../lib/clerkEntitlements.js';
import { CINEMATIC_THEME } from '../lib/cinematicTheme.js';
import { getVideoIntent, setVideoIntent } from '../lib/videoIntentStore.js';
import { generateStoryboardFromIntent, generateFrameImage as engineGenerateFrameImage, resolveOpenAISize } from '../lib/storyboardEngine.js';
import { createAutosave, saveProject, loadProject } from '../lib/editor/persistence.js';
import { TemplateThumbnailModal, mountThumbnailModal } from './modals/TemplateThumbnailModal.jsx';
import { subscribeToGtmThumbnails } from '../lib/gtmThumbnailBridge.js';
import { createUploadPicker } from './UploadPicker.js';
import { mountModelSelector, PROVIDER_LOGOS, invertLogos, getProviderStyle } from '../lib/modelSelectorUI.js';
import { createAdvancedControls } from '../lib/studioControls.js';
import { getExtendedModel } from '../lib/modelInputExtensions.js';
import { resolveTemplate, loadTemplatePrompt } from '../lib/showcaseTemplateResolver.js';
import { getAcademyCreateTarget } from '../data/academyStudioAdapters.js';
import { openPromptGallery } from '../lib/promptGalleryIntegration.js';
import { openRecipeModal } from '../lib/recipeIntegration.js';
import { openMonetizationHub } from '../lib/monetizationIntegration.js';

const SHOT_TYPES = ['Wide Shot', 'Medium Shot', 'Close-Up', 'Extreme Close-Up', 'POV', 'Overhead', 'Low Angle'];

const SHOT_PRESETS = [
  { shot: 'Wide Shot', prompt: 'Cinematic establishing shot, wide angle, epic landscape, professional cinematography' },
  { shot: 'Medium Shot', prompt: 'Medium shot, character focused, natural lighting, professional composition' },
  { shot: 'Close-Up', prompt: 'Intimate close-up, detailed expression, shallow depth of field, dramatic lighting' },
  { shot: 'Extreme Close-Up', prompt: 'Extreme close-up detail shot, macro detail, shallow depth of field, cinematic' },
  { shot: 'POV', prompt: 'Point of view shot, first person perspective, immersive, cinematic' },
  { shot: 'Overhead', prompt: 'Overhead drone shot, bird\'s eye view, epic scale, cinematic' },
  { shot: 'Low Angle', prompt: 'Low angle shot, dramatic perspective, heroic composition, cinematic' },
];

const STYLE_OPTIONS = ['None', 'Photorealistic', 'Cinematic', 'Noir', 'Anime', 'Watercolor', 'Oil Painting', 'Cyberpunk', 'Fantasy', 'Documentary'];
const LIGHTING_OPTIONS = ['None', 'Golden Hour', 'Neon', 'Studio', 'Dramatic', 'Soft', 'Volumetric', 'High Key', 'Low Key'];
const COLOR_OPTIONS = ['None', 'Warm', 'Cool', 'Desaturated', 'Vibrant', 'Monochrome', 'Sepia', 'Teal & Orange'];

const LAYOUTS = [
  { id: 'horizontal', label: 'Horizontal' },
  { id: 'grid', label: 'Grid' },
  { id: 'story', label: 'Story' },
];

// Image generation model/AR state (mirrors ImageStudio pattern)
const defaultModel = t2iModels[0];
let selectedModel = defaultModel.id;
let selectedModelName = defaultModel.name;
let selectedAr = defaultModel.inputs?.aspect_ratio?.default || '1:1';
let selectedProvider = 'all';
let customThumbnailUrl = null;

// Enhancement state
let selectedStyle = 'None';
let selectedLighting = 'None';
let selectedColor = 'None';
let selectedPreset = null;
let frameNotes = '';
let revisedPrompt = '';
let referenceImages = [];
let generationProgress = { current: 0, total: 0, failed: [] };
let batchRetryCount = 0;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 1000;

function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function withRetry(fn, retries = MAX_RETRIES, delay = RETRY_BASE_DELAY) {
  return (async () => {
    let lastErr;
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        const isTransient = err?.status === 429 || (err?.status >= 500 && err?.status < 600);
        if (!isTransient || i === retries - 1) throw err;
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
    throw lastErr;
  })();
}

const storyboardStore = new Store({
  frames: [],
  layout: 'horizontal',
  selectedModel: t2iModels[0]?.id,
  selectedModelName: t2iModels[0]?.name,
  selectedAr: t2iModels[0]?.inputs?.aspect_ratio?.default || '1:1',
  selectedStyle: 'None',
  selectedLighting: 'None',
  selectedColor: 'None',
  selectedPreset: null,
  generationProgress: { current: 0, total: 0, failed: [] },
});

function createUndoRedo() {
  let undoStack = [];
  let redoStack = [];
  const maxHistory = 50;

  function push(state) {
    undoStack.push(JSON.parse(JSON.stringify(state)));
    if (undoStack.length > maxHistory) undoStack.shift();
    redoStack = [];
  }

  function undo(currentState) {
    if (!undoStack.length) return null;
    const prev = undoStack.pop();
    redoStack.push(JSON.parse(JSON.stringify(currentState)));
    return prev;
  }

  function redo(currentState) {
    if (!redoStack.length) return null;
    const next = redoStack.pop();
    undoStack.push(JSON.parse(JSON.stringify(currentState)));
    return next;
  }

  function canUndo() { return undoStack.length > 0; }
  function canRedo() { return redoStack.length > 0; }

  return { push, undo, redo, canUndo, canRedo };
}

export async function StoryboardStudio(options = {}) {
  const { embedded = false, onBack } = options;
  const undoRedo = createUndoRedo();
  const autosave = createAutosave({
    debounceMs: 1500,
    onSave: () => {},
    onError: (err) => console.warn('[StoryboardStudio] Autosave failed:', err),
  });
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col bg-app-bg overflow-y-auto relative storyboard-studio';
  mountStudioChrome(container, { currentRoute: 'storyboard' });
  container.setAttribute('data-app', 'storyboard');

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
        if (tpl.model) { selectedModel = tpl.model; }
        if (tpl.aspectRatio) { selectedAr = tpl.aspectRatio; }
        if (tpl.duration) {
          const durEl = document.getElementById('vi-duration');
          if (durEl) durEl.value = tpl.duration;
        }
        if (tpl.basePrompt) {
          const ta = document.getElementById('vi-premise');
          if (ta) ta.value = tpl.basePrompt;
        } else if (tpl.slug) {
          loadTemplatePrompt(templateParam).then((prompt) => {
            if (prompt) {
              const ta = document.getElementById('vi-premise');
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
        const ta = document.getElementById('vi-premise');
        if (ta) ta.value = params.prompt;
      }
      if (params.aspect_ratio) { selectedAr = params.aspect_ratio; }
      if (params.duration) {
        const durEl = document.getElementById('vi-duration');
        if (durEl) durEl.value = params.duration;
      }
    }
  } catch { /* ignore */ }

  const topBar = document.createElement('div');
  topBar.className = 'px-4 md:px-8 pt-6 pb-4 shrink-0';
  if (!embedded) {
    const storyBanner = createHeroSection('storyboard', 'h-32 md:h-44 mb-4');
    if (storyBanner) {
      const bannerText = document.createElement('div');
      bannerText.className = 'absolute bottom-0 left-0 right-0 p-4 z-10';
      bannerText.innerHTML = `<h1 class="${CINEMATIC_THEME.text.title} text-white mb-1">Storyboard Studio</h1><p class="${CINEMATIC_THEME.text.eyebrow} text-white/60">Plan your scenes with AI-generated storyboard frames</p>`;
      storyBanner.appendChild(bannerText);
      topBar.appendChild(storyBanner);
    } else {
      topBar.innerHTML = `<h1 class="${CINEMATIC_THEME.text.title} text-white mb-1">Storyboard Studio</h1><p class="${CINEMATIC_THEME.text.eyebrow} text-secondary mb-4">Plan your scenes with AI-generated storyboard frames</p>`;
    }
  }
  const inlineInstructions = createInlineInstructions('storyboard');
  inlineInstructions.classList.add('px-4', 'md:px-8', 'mt-2');
  topBar.appendChild(inlineInstructions);

  container.appendChild(topBar);

  let generatedStoryboard = null;

  const videoIntentSection = document.createElement('div');
  videoIntentSection.className = 'px-4 md:px-8 mb-4';
  videoIntentSection.innerHTML = `
    <div class="bg-white/5 border border-white/10 rounded-xl p-4 md:p-6">
      <button id="video-intent-toggle" class="flex items-center justify-between w-full text-left mb-4">
        <span class="${CINEMATIC_THEME.text.body} font-bold text-white">Video Intent</span>
        <svg id="video-intent-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="text-white/60 transition-transform"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div id="video-intent-form" class="hidden">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5">Video Type</label>
            <select id="vi-videoType" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none appearance-none cursor-pointer">
              <option value="commercial">Commercial</option>
              <option value="brand film">Brand Film</option>
              <option value="trailer">Trailer</option>
              <option value="social reel">Social Reel</option>
              <option value="testimonial">Testimonial</option>
              <option value="documentary">Documentary</option>
              <option value="short film">Short Film</option>
              <option value="explainer">Explainer</option>
            </select>
          </div>
          <div>
            <label class="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5">Duration (seconds)</label>
            <input type="number" id="vi-duration" value="60" min="10" max="300" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none" />
          </div>
          <div>
            <label class="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5">Aspect Ratio</label>
            <select id="vi-aspectRatio" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none appearance-none cursor-pointer">
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
              <option value="1:1">1:1</option>
              <option value="4:5">4:5</option>
            </select>
          </div>
          <div>
            <label class="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5">Tone</label>
            <select id="vi-tone" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none appearance-none cursor-pointer">
              <option value="dramatic">Dramatic</option>
              <option value="cinematic">Cinematic</option>
              <option value="upbeat">Upbeat</option>
              <option value="luxury">Luxury</option>
              <option value="gritty">Gritty</option>
              <option value="minimal">Minimal</option>
              <option value="emotional">Emotional</option>
              <option value="humorous">Humorous</option>
            </select>
          </div>
          <div>
            <label class="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5">Style Preset</label>
            <select id="vi-stylePreset" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none appearance-none cursor-pointer">
              <option value="None">None</option>
              <option value="Photorealistic">Photorealistic</option>
              <option value="Cinematic">Cinematic</option>
              <option value="Noir">Noir</option>
              <option value="Anime">Anime</option>
              <option value="Watercolor">Watercolor</option>
              <option value="Oil Painting">Oil Painting</option>
              <option value="Cyberpunk">Cyberpunk</option>
              <option value="Fantasy">Fantasy</option>
              <option value="Documentary">Documentary</option>
            </select>
          </div>
          <div>
            <label class="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5">Lighting Preset</label>
            <select id="vi-lightingPreset" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none appearance-none cursor-pointer">
              <option value="None">None</option>
              <option value="Golden Hour">Golden Hour</option>
              <option value="Neon">Neon</option>
              <option value="Studio">Studio</option>
              <option value="Dramatic">Dramatic</option>
              <option value="Soft">Soft</option>
              <option value="Volumetric">Volumetric</option>
              <option value="High Key">High Key</option>
              <option value="Low Key">Low Key</option>
            </select>
          </div>
          <div>
            <label class="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5">Color Grade</label>
            <select id="vi-colorGrade" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none appearance-none cursor-pointer">
              <option value="None">None</option>
              <option value="Warm">Warm</option>
              <option value="Cool">Cool</option>
              <option value="Desaturated">Desaturated</option>
              <option value="Vibrant">Vibrant</option>
              <option value="Monochrome">Monochrome</option>
              <option value="Sepia">Sepia</option>
              <option value="Teal & Orange">Teal & Orange</option>
            </select>
          </div>
          <div>
            <label class="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5">Target Audience</label>
            <input type="text" id="vi-targetAudience" placeholder="e.g. Gen Z, professionals" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-muted focus:outline-none" />
          </div>
          <div>
            <label class="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5">Call to Action (optional)</label>
            <input type="text" id="vi-cta" placeholder="e.g. Buy now, Sign up" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-muted focus:outline-none" />
          </div>
        </div>
        <div class="mb-4">
          <label class="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5">Subject</label>
          <input type="text" id="vi-subject" placeholder="What is the video about?" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-muted focus:outline-none" />
        </div>
        <div class="mb-4">
          <label class="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5">Premise</label>
          <textarea id="vi-premise" rows="3" placeholder="Core narrative or value prop..." class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-muted focus:outline-none resize-none"></textarea>
        </div>
        <div class="flex items-center gap-3 flex-wrap">
          <button id="vi-generate-btn" class="btn-primary-modern px-[14px] py-2 min-h-[40px] text-[13px] font-bold rounded-2xl inline-flex items-center justify-center gap-1.5 transition-all">Generate Storyboard</button>
          <button id="vi-template-btn" class="hidden px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition-all">Send to Template Studio</button>
          <span id="vi-status" class="text-[10px] text-muted"></span>
        </div>
        <p class="text-[10px] text-muted mt-3">Describe your video and we'll generate a complete storyboard with frames, shots, and prompts.</p>
      </div>
    </div>
  `;

  container.appendChild(videoIntentSection);

  const toggleBtn = videoIntentSection.querySelector('#video-intent-toggle');
  const formEl = videoIntentSection.querySelector('#video-intent-form');
  const chevron = videoIntentSection.querySelector('#video-intent-chevron');
  toggleBtn.addEventListener('click', () => {
    const isHidden = formEl.classList.contains('hidden');
    formEl.classList.toggle('hidden');
    chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
  });

  // Sync standalone form into shared store
  if (!embedded) {
    const syncFormToStore = () => {
      setVideoIntent({
        videoType: videoIntentSection.querySelector('#vi-videoType')?.value || getVideoIntent().videoType,
        duration: parseInt(videoIntentSection.querySelector('#vi-duration')?.value || getVideoIntent().duration, 10),
        aspectRatio: videoIntentSection.querySelector('#vi-aspectRatio')?.value || getVideoIntent().aspectRatio,
        tone: videoIntentSection.querySelector('#vi-tone')?.value || getVideoIntent().tone,
        stylePreset: videoIntentSection.querySelector('#vi-stylePreset')?.value || getVideoIntent().stylePreset,
        lightingPreset: videoIntentSection.querySelector('#vi-lightingPreset')?.value || getVideoIntent().lightingPreset,
        colorGrade: videoIntentSection.querySelector('#vi-colorGrade')?.value || getVideoIntent().colorGrade,
        targetAudience: videoIntentSection.querySelector('#vi-targetAudience')?.value || getVideoIntent().targetAudience,
        cta: videoIntentSection.querySelector('#vi-cta')?.value || getVideoIntent().cta,
        subject: videoIntentSection.querySelector('#vi-subject')?.value || getVideoIntent().subject,
        premise: videoIntentSection.querySelector('#vi-premise')?.value || getVideoIntent().premise,
      });
    };
    videoIntentSection.querySelectorAll('input, select, textarea').forEach(el => {
      el.addEventListener('input', syncFormToStore);
      el.addEventListener('change', syncFormToStore);
    });
  }

  const generateBtn = videoIntentSection.querySelector('#vi-generate-btn');
  const templateBtn = videoIntentSection.querySelector('#vi-template-btn');
  const statusEl = videoIntentSection.querySelector('#vi-status');

  generateBtn.addEventListener('click', async () => {
    if (!(await requireEntitlement())) return;
    const intent = {
      ...getVideoIntent(),
      model: selectedModel,
      customThumbnailUrl: customThumbnailUrl || undefined,
    };

    generateBtn.disabled = true;
    generateBtn.innerHTML = '<span class="animate-spin inline-block mr-2">&#9711;</span> Generating...';
    statusEl.textContent = 'Generating storyboard...';

    try {
      const result = await generateStoryboardFromIntent(intent, { generateImages: true });
      generatedStoryboard = result;
      frames.length = 0;
      frames.push(...result.frames.map(f => ({ ...f, imageUrl: f.imageUrl || null })));
      frameDurations = frames.map(() => Math.max(2, Math.round(intent.duration / frames.length)));
      layout = 'grid';
      layoutSelect.value = 'grid';
      renderFrames();
      templateBtn.classList.remove('hidden');
      statusEl.textContent = `Generated ${result.frames.length} frames`;
      showToast('Storyboard generated from intent', 'success');
    } catch (err) {
      statusEl.textContent = '';
      showToast('Generation failed: ' + err.message, 'error');
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate Storyboard';
    }
  });

  templateBtn.addEventListener('click', () => {
    if (!generatedStoryboard) return;
    if (typeof window.useStoryboardInTemplate === 'function') {
      window.useStoryboardInTemplate(generatedStoryboard);
    } else {
      navigate('cinema-template', { storyboard: JSON.stringify(generatedStoryboard) });
    }
  });

  const frames = [
    { prompt: '', narration: '', shot: 'Wide Shot', imageUrl: null, notes: '', referenceImages: [] },
    { prompt: '', narration: '', shot: 'Medium Shot', imageUrl: null, notes: '', referenceImages: [] },
    { prompt: '', narration: '', shot: 'Close-Up', imageUrl: null, notes: '', referenceImages: [] },
  ];

  let frameDurations = frames.map(() => 3);

  const controlBar = document.createElement('div');
  controlBar.className = 'px-4 md:px-8 mb-4 flex items-center gap-3 flex-wrap';

  const LAYOUTS = [
    { id: 'horizontal', label: 'Horizontal' },
    { id: 'grid', label: 'Grid' },
    { id: 'story', label: 'Story' },
  ];
  let layout = 'horizontal';

  const layoutLabel = document.createElement('span');
  layoutLabel.className = 'text-xs font-bold text-secondary';
  layoutLabel.textContent = 'Layout:';
  controlBar.appendChild(layoutLabel);

  const layoutSelect = document.createElement('select');
  layoutSelect.className = 'bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none appearance-none cursor-pointer';
  LAYOUTS.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.id;
    opt.textContent = l.label;
    opt.style.background = '#111';
    if (l.id === layout) opt.selected = true;
    layoutSelect.appendChild(opt);
  });
  layoutSelect.onchange = () => {
    layout = layoutSelect.value;
    renderFrames();
  };
  controlBar.appendChild(layoutSelect);

  const presetLabel = document.createElement('span');
  presetLabel.className = 'text-xs font-bold text-secondary';
  presetLabel.textContent = 'Preset:';
  controlBar.appendChild(presetLabel);

  const presetSelect = document.createElement('select');
  presetSelect.className = 'bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none appearance-none cursor-pointer';
  presetSelect.innerHTML = '<option value="">None</option>';
  SHOT_PRESETS.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.shot;
    opt.textContent = p.shot;
    opt.style.background = '#111';
    presetSelect.appendChild(opt);
  });
  presetSelect.onchange = () => {
    const preset = SHOT_PRESETS.find(p => p.shot === presetSelect.value);
    if (!preset) return;
    undoRedo.push(frames);
    selectedPreset = preset;
    frames.forEach((frame, idx) => {
      frame.shot = preset.shot;
      frame.prompt = idx === 0 ? preset.prompt : `${preset.prompt} (part ${idx + 1})`;
    });
    renderFrames();
    autosave.schedule(getStoryboardState());
  };
  controlBar.appendChild(presetSelect);

  const projectIdInput = document.createElement('input');
  projectIdInput.type = 'text';
  projectIdInput.placeholder = 'Project ID';
  projectIdInput.value = 'storyboard-' + Date.now();
  projectIdInput.className = 'bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none w-40';
  controlBar.appendChild(projectIdInput);

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition-all';
  saveBtn.textContent = 'Save';
  saveBtn.onclick = async () => {
    if (!(await requireEntitlement())) return;
    const id = projectIdInput.value.trim() || ('storyboard-' + Date.now());
    try {
      const r = await fetch('/api/storyboard/' + encodeURIComponent(id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, frames, preset: selectedPreset }),
      });
      if (!r.ok) throw new Error('Save failed');
      const state = getStoryboardState();
      state.projectId = id;
      const saveResult = await saveProject(state);
      if (saveResult.supabase) {
        showToast('Storyboard saved to Supabase', 'success');
      } else {
        showToast('Storyboard saved locally', 'success');
      }
    } catch (e) {
      showToast('Save failed: ' + e.message, 'error');
    }
  };
  controlBar.appendChild(saveBtn);

  const loadBtn = document.createElement('button');
  loadBtn.type = 'button';
  loadBtn.className = 'px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition-all';
  loadBtn.textContent = 'Load';
  loadBtn.onclick = async () => {
    if (!(await requireEntitlement())) return;
    const id = projectIdInput.value.trim();
    if (!id) { showToast('Enter a project ID', 'warning'); return; }
    let loadedFromSupabase = false;
    if (supabaseAvailable) {
      try {
        const supabaseModule = await import('../lib/supabase.js');
        const { data, error } = await supabaseModule.supabase
          .from('timeline_projects')
          .select('project')
          .eq('id', id)
          .order('updated_at', { ascending: false })
          .limit(1);
        if (!error && data && data[0] && data[0].project) {
          const loaded = data[0].project.data || data[0].project;
          if (loaded && loaded.frames && Array.isArray(loaded.frames)) {
            frames.length = 0;
            frames.push(...loaded.frames);
            if (loaded.layout) layout = loaded.layout;
            if (loaded.selectedModel) selectedModel = loaded.selectedModel;
            if (loaded.selectedModelName) selectedModelName = loaded.selectedModelName;
            if (loaded.selectedAr) selectedAr = loaded.selectedAr;
            if (loaded.selectedStyle) selectedStyle = loaded.selectedStyle || 'None';
            if (loaded.selectedLighting) selectedLighting = loaded.selectedLighting || 'None';
            if (loaded.selectedColor) selectedColor = loaded.selectedColor || 'None';
            renderFrames();
            showToast('Storyboard loaded from Supabase', 'success');
            loadedFromSupabase = true;
          }
        }
      } catch (e) {
        console.warn('[StoryboardStudio] Supabase load failed:', e);
      }
    }
    if (loadedFromSupabase) return;
    try {
      const r = await fetch('/api/storyboard/' + encodeURIComponent(id));
      if (!r.ok) throw new Error('Load failed');
      const data = await r.json();
      if (data.frames && Array.isArray(data.frames)) {
        frames.length = 0;
        frames.push(...data.frames);
        renderFrames();
        showToast('Storyboard loaded', 'success');
      }
    } catch (e) {
      // Fallback: try loading from localStorage/IndexedDB/Supabase via the
      // shared persistence layer. This covers the case where the
      // /api/storyboard/{id} endpoint is not implemented.
      try {
        const state = await loadProject();
        if (state && state.frames && Array.isArray(state.frames)) {
          frames.length = 0;
          frames.push(...state.frames);
          if (state.layout) layout = state.layout;
          if (state.selectedModel) selectedModel = state.selectedModel;
          if (state.selectedModelName) selectedModelName = state.selectedModelName;
          if (state.selectedAr) selectedAr = state.selectedAr;
          if (state.selectedStyle) selectedStyle = state.selectedStyle || 'None';
          if (state.selectedLighting) selectedLighting = state.selectedLighting || 'None';
          if (state.selectedColor) selectedColor = state.selectedColor || 'None';
          renderFrames();
          showToast('Storyboard loaded from local storage', 'success');
        } else {
          showToast('No saved storyboard found', 'warning');
        }
      } catch (fallbackErr) {
        showToast('Load failed: ' + e.message, 'error');
      }
    }
  };
  controlBar.appendChild(loadBtn);

  const addFrameBtn = document.createElement('button');
  addFrameBtn.className = 'px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition-all';
  addFrameBtn.textContent = '+ Add Frame';
  addFrameBtn.onclick = async () => {
    if (!(await requireEntitlement())) return;
    undoRedo.push(frames);
    frames.push({ prompt: '', narration: '', shot: 'Wide Shot', imageUrl: null, notes: '', referenceImages: [] });
    renderFrames();
    autosave.schedule(getStoryboardState());
  };
  controlBar.appendChild(addFrameBtn);

  const genAllBtn = document.createElement('button');
genAllBtn.type = 'button';
  genAllBtn.className = 'btn-primary-modern px-[14px] py-2 min-h-[40px] text-[13px] font-bold rounded-2xl inline-flex items-center justify-center gap-1.5 transition-all';
  genAllBtn.textContent = 'Generate All Frames';
  genAllBtn.setAttribute('aria-label', 'Generate all frames');
  controlBar.appendChild(genAllBtn);

  // Premium GTM Boost entry point — opens the cinematic prompt enhancer.
  // Produces a conversion-optimized base concept that is propagated to every
  // frame (prepended to each frame's own prompt at generation time).
  let enhancedConcept = '';
  const gtmBtn = document.createElement('button');
  gtmBtn.type = 'button';
  gtmBtn.textContent = '🎯 GTM Boost';
  gtmBtn.title = 'Enhance your storyboard with GTM conversion frameworks';
  gtmBtn.setAttribute('aria-label', 'GTM Boost prompt enhancer');
  gtmBtn.className = 'gtm-boost-btn shrink-0';
  gtmBtn.addEventListener('click', () => {
    import('../lib/uiIntegration.js').then(({ openGTMPromptModal }) => {
      openGTMPromptModal('storyboard', (prompt) => {
        enhancedConcept = prompt;
        gtmBtn.classList.add('active');
        // Re-render so any visible "boosted" indicator stays in sync.
        renderFrames();
      });
    }).catch((err) => console.error('[StoryboardStudio] GTM Boost failed:', err));
  });
  controlBar.appendChild(gtmBtn);

  const personalizeTrigger = mountPersonalizeTrigger({ controlsContainer: controlBar, appId: 'storyboard', getTextarea: () => null });
  // Live reference to the active personalization profile so generateFrame can
  // resolve {{tokens}} at generation time without mutating the textarea.
  const activeProfileRef = { value: null };
  const syncProfile = () => { activeProfileRef.value = personalizeTrigger?.getActiveProfile?.() || null; };
  syncProfile();
  window.addEventListener('remix:contact-changed', syncProfile);

  const progressLabel = document.createElement('span');
  progressLabel.className = 'text-[10px] text-muted tabular-nums';
  progressLabel.textContent = '';
  controlBar.appendChild(progressLabel);

  const retryBtn = document.createElement('button');
  retryBtn.type = 'button';
  retryBtn.className = 'px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition-all hidden';
  retryBtn.textContent = 'Retry failed';
  retryBtn.onclick = async () => {
    if (!generationProgress.failed.length) return;
    const failedIndices = [...generationProgress.failed];
    generationProgress.failed = [];
    retryBtn.classList.add('hidden');
    for (const idx of failedIndices) {
      if (idx >= frames.length) continue;
      const card = framesArea.children[idx];
      const btn = card?.querySelector('button:last-child');
      const imageArea = card?.querySelector('.aspect-video');
      if (!btn || !imageArea) continue;
      try {
        await generateFrame(idx, btn, imageArea);
        generationProgress.current++;
        updateProgressLabel();
      } catch (err) {
        showToast(`Frame ${idx + 1} failed: ${err.message}`, 'error');
        generationProgress.failed.push(idx);
      }
    }
    if (generationProgress.failed.length === 0) {
      showToast('All retries completed', 'success');
    }
    retryBtn.classList.toggle('hidden', generationProgress.failed.length === 0);
  };
  controlBar.appendChild(retryBtn);

  const thumbBtn = document.createElement('button');
  thumbBtn.type = 'button';
  thumbBtn.textContent = '🖼 Thumbnail';
  thumbBtn.title = 'Generate a custom thumbnail';
  thumbBtn.className = 'btn-ghost-modern shrink-0';
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
  controlBar.appendChild(thumbBtn);

  subscribeToGtmThumbnails(({ imageUrl }) => {
    customThumbnailUrl = imageUrl;
    saveCustomThumbnailToCache('storyboard-studio', imageUrl);
    renderFrames();
  });

  const exportBtn = document.createElement('button');
  exportBtn.className = 'px-4 py-2 bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/20 transition-all ml-auto';
  exportBtn.innerHTML = 'Export PDF';
  exportBtn.onclick = async () => {
    if (!(await requireEntitlement())) return;
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) {
      showToast('Popup blocked. Please allow popups to export PDF.', 'error');
      return;
    }
    const rows = frames
      .map((frame, idx) => `
        <tr>
          <td style="width:60px;text-align:center;font-weight:bold;color:#fff;">${idx + 1}</td>
          <td style="width:120px;padding:8px;">
            <img src="${frame.imageUrl || ''}" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;background:#0f172a;" />
          </td>
          <td style="color:#fff;padding:8px 12px;">${escapeHtml(frame.shot || '')}</td>
          <td style="color:#fff;padding:8px 12px;">${escapeHtml(frame.prompt || '')}</td>
          <td style="color:#fff;padding:8px 12px;">${escapeHtml(frame.narration || '')}</td>
        </tr>
      `)
      .join('');
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Storyboard Export</title>
  <style>
    body { background:#020617; color:#e5e7eb; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; padding:24px; }
    h1 { font-size:20px; margin-bottom:4px; }
    p { color:#9ca3af; margin-top:0; margin-bottom:16px; }
    table { width:100%; border-collapse:collapse; }
    th { text-align:left; padding:8px 12px; color:#9ca3af; border-bottom:1px solid #27272a; font-size:12px; }
    td { border-bottom:1px solid #27272a; font-size:13px; vertical-align:top; }
    @media print {
      body { padding:0; }
      table { page-break-inside:auto; }
      tr { page-break-inside:avoid; }
    }
  </style>
</head>
<body>
  <h1>Storyboard Studio Export</h1>
  <p>${new Date().toLocaleString()} · ${frames.length} frames</p>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Frame</th>
        <th>Shot</th>
        <th>Prompt</th>
        <th>Narration</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <script>setTimeout(() => { window.print(); }, 300);</script>
</body>
</html>`);
    printWindow.document.close();
  };
  controlBar.appendChild(exportBtn);

const compareBtn = document.createElement('button');
  compareBtn.type = 'button';
  compareBtn.className = 'px-4 py-2 bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/20 transition-all';
  compareBtn.textContent = 'Compare';
  compareBtn.onclick = () => openComparison();
  controlBar.appendChild(compareBtn);

  // Model / aspect-ratio dropdowns
  const dropdown = document.createElement('div');
  dropdown.className = 'absolute bottom-[102%] left-2 z-[200] transition-all opacity-0 pointer-events-none scale-95 origin-bottom-left glass rounded-3xl p-3 translate-y-2 w-[calc(100vw-3rem)] max-w-xs shadow-4xl border border-white/10 flex flex-col';

  function closeDropdown() {
    dropdown.classList.add('opacity-0', 'pointer-events-none');
    dropdown.classList.remove('opacity-100', 'pointer-events-auto');
    selectedProvider = 'all';
    if (_storyboardOutsideClickHandler) {
      document.removeEventListener('click', _storyboardOutsideClickHandler);
      _storyboardOutsideClickHandler = null;
    }
  }

  function showDropdown(type, anchorBtn) {
    dropdown.innerHTML = '';
    dropdown.classList.remove('opacity-0', 'pointer-events-none');
    dropdown.classList.add('opacity-100', 'pointer-events-auto');

    if (type === 'model') {
      dropdown.classList.add('w-[calc(100vw-2rem)]', 'md:w-[480px]', 'max-w-md');
      dropdown.classList.remove('max-w-xs', 'max-w-[240px]', 'max-w-[200px]');
      const storyboardModels = t2iModels;
      mountModelSelector(dropdown, {
        models: storyboardModels,
        selectedModelId: selectedModel,
        showProviderName: true,
        onSelectModel: (model) => {
          selectedModel = model.id;
          selectedModelName = model.name;
          const availableArs = getAspectRatiosForModel(selectedModel);
          selectedAr = availableArs[0];
          document.getElementById('model-btn-label').textContent = selectedModelName;
          document.getElementById('ar-btn-label').textContent = selectedAr;
          updateModelBtnIcon();
          if (dynamicControls) {
            const resolved = getModelById(selectedModel)
              || getI2IModelById(selectedModel)
              || getI2VModelById(selectedModel)
              || getV2VModelById(selectedModel)
              || { id: selectedModel, inputs: {} };
            dynamicControls.update(getExtendedModel(resolved));
            dynamicControls.setValue('aspect_ratio', selectedAr);
          }
          closeDropdown();
        },
      });

    } else if (type === 'ar') {
      dropdown.classList.add('max-w-[240px]');
      dropdown.classList.remove('w-[calc(100vw-3rem)]', 'max-w-xs', 'max-w-[200px]');
      dropdown.innerHTML = `<div class="text-[10px] font-bold text-muted uppercase tracking-widest px-3 py-2 border-b border-white/5 mb-2">Aspect Ratio</div>`;
      const list = document.createElement('div');
      list.className = 'flex flex-col gap-1';

      const availableArs = getAspectRatiosForModel(selectedModel);
      availableArs.forEach(r => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between p-3.5 hover:bg-white/5 rounded-2xl cursor-pointer transition-all group';
        item.innerHTML = `
          <div class="flex items-center gap-4">
            <div class="w-6 h-6 border-2 border-white/20 rounded-md shadow-inner flex items-center justify-center group-hover:border-primary/50 transition-colors">
              <div class="w-3 h-3 bg-white/10 rounded-sm"></div>
            </div>
            <span class="text-xs font-bold text-white opacity-80 group-hover:opacity-100 transition-opacity">${r}</span>
          </div>
          ${selectedAr === r ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d9ff00" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
        `;
        item.onclick = (e) => {
          e.stopPropagation();
          selectedAr = r;
          document.getElementById('ar-btn-label').textContent = r;
          closeDropdown();
        };
        list.appendChild(item);
      });
      dropdown.appendChild(list);
    }

    if (_storyboardOutsideClickHandler) {
      document.removeEventListener('click', _storyboardOutsideClickHandler);
      _storyboardOutsideClickHandler = null;
    }
    _storyboardOutsideClickHandler = (e) => {
      if (!dropdown.contains(e.target) && e.target !== modelBtn && e.target !== arBtn) {
        closeDropdown();
      }
    };
    document.addEventListener('click', _storyboardOutsideClickHandler);
  }

  const createControlBtn = (icon, label, id, tooltip) => {
    const btn = document.createElement('button');
    btn.id = id;
    btn.className = 'flex items-center gap-1.5 md:gap-2.5 px-3 md:px-4 py-2 md:py-2.5 bg-white/5 hover:bg-white/10 rounded-xl md:rounded-2xl transition-all border border-white/5 group whitespace-nowrap';
    if (tooltip) btn.setAttribute('data-tooltip', tooltip);
    btn.innerHTML = `
      ${icon}
      <span id="${id}-label" class="text-xs font-bold text-white group-hover:text-primary transition-colors">${label}</span>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" class="opacity-20 group-hover:opacity-100 transition-opacity"><path d="M6 9l6 6 6-6"/></svg>
    `;
    return btn;
  };

  const modelBtn = createControlBtn(`
    <div id="model-btn-icon" class="w-5 h-5 rounded-md flex items-center justify-center overflow-hidden bg-white/5"></div>
  `, selectedModelName, 'model-btn', 'Select AI generation model');

  const updateModelBtnIcon = () => {
    const iconEl = document.getElementById('model-btn-icon');
    if (!iconEl) return;
    const current = t2iModels.find(m => m.id === selectedModel);
    const provider = current?.provider || 'muapi';
    const logoUrl = PROVIDER_LOGOS[provider];
    if (logoUrl) {
      iconEl.innerHTML = `<img src="${logoUrl}" alt="" class="w-full h-full object-contain ${invertLogos.includes(provider) ? 'invert' : ''}" />`;
    } else {
      const style = getProviderStyle(provider);
      iconEl.innerHTML = `<span class="text-[10px] font-black text-black">${style.text}</span>`;
      iconEl.className = 'w-5 h-5 bg-primary rounded-md flex items-center justify-center shadow-lg shadow-primary/20';
    }
  };
  updateModelBtnIcon();

  const arBtn = createControlBtn(`
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-60 text-secondary"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
  `, selectedAr, 'ar-btn', 'Change aspect ratio');

  controlBar.appendChild(modelBtn);
  controlBar.appendChild(arBtn);

  modelBtn.onclick = (e) => {
    e.stopPropagation();
    if (dropdown.classList.contains('opacity-100')) {
      closeDropdown();
    } else {
      showDropdown('model', modelBtn);
    }
  };

  arBtn.onclick = (e) => {
    e.stopPropagation();
    if (dropdown.classList.contains('opacity-100')) {
      closeDropdown();
    } else {
      showDropdown('ar', arBtn);
    }
  };

  let _storyboardOutsideClickHandler = null;

  container.appendChild(controlBar);

  // ==========================================
  // ADVANCED OPTIONS PANEL (control engine)
  // ==========================================
  const advancedPanel = document.createElement('div');
  advancedPanel.className = 'px-4 md:px-8 mb-4 animate-fade-in-up';
  advancedPanel.id = 'storyboard-advanced-panel';
  const advancedCard = document.createElement('div');
  advancedCard.className = 'bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex flex-col gap-4';
  advancedPanel.appendChild(advancedCard);

  const advHeader = document.createElement('div');
  advHeader.className = 'flex items-center justify-between pb-3 border-b border-white/5';
  advHeader.innerHTML = `
    <h3 class="${CINEMATIC_THEME.text.body} font-bold text-white">Advanced Options</h3>
    <button id="close-storyboard-adv-btn" class="text-white/40 hover:text-white transition-colors">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>
  `;
  advancedPanel.appendChild(advHeader);

  const advancedControlsContainer = document.createElement('div');
  advancedControlsContainer.className = 'flex flex-col gap-4';
  advancedCard.appendChild(advancedControlsContainer);

  const dynamicControls = createAdvancedControls({
    model: getExtendedModel(getModelById(selectedModel)),
    state: {},
    container: advancedControlsContainer,
    exclude: new Set(['style', 'lighting', 'color', 'prompt', 'batch_count']),
    extraInputs: {
      style: { type: 'enum', title: 'Style', options: STYLE_OPTIONS, default: 'None', group: 'basic' },
      lighting: { type: 'enum', title: 'Lighting', options: LIGHTING_OPTIONS, default: 'None', group: 'basic' },
      color: { type: 'enum', title: 'Color Grade', options: COLOR_OPTIONS, default: 'None', group: 'basic' },
    },
    onChange: (key, value) => {
      if (key === 'style')    { selectedStyle    = value; }
      if (key === 'lighting') { selectedLighting = value; }
      if (key === 'color')    { selectedColor    = value; }
      if (key === 'aspect_ratio') { selectedAr = value; if (updateArBtn) updateArBtn(); }
      if (key === 'negative_prompt') { currentSettings.negativePrompt = value; }
    }
  });
  container.appendChild(advancedPanel);

  advancedPanel.querySelector('#close-storyboard-adv-btn').onclick = () => {
    advancedPanel.classList.add('hidden');
  };

  const comparisonOverlay = document.createElement('div');
  comparisonOverlay.className = 'fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm hidden items-center justify-center p-4';
  comparisonOverlay.innerHTML = `
    <div class="bg-app-bg border border-white/10 rounded-2xl shadow-4xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
      <div class="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
        <h2 class="${CINEMATIC_THEME.text.body} font-bold text-white tracking-tight">Compare Frames</h2>
        <button class="compare-close-btn text-muted hover:text-white transition-colors text-lg leading-none px-2">&times;</button>
      </div>
      <div class="flex-1 overflow-y-auto p-6">
        <div class="flex flex-col md:flex-row gap-6">
          <div class="flex-1 flex flex-col gap-3">
            <label class="text-[10px] font-bold text-secondary uppercase tracking-widest">Frame A</label>
            <select class="compare-select-a bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none appearance-none cursor-pointer"></select>
            <div class="aspect-video bg-white/[0.02] rounded-lg border border-white/5 flex items-center justify-center overflow-hidden">
              <img class="compare-image-a w-full h-full object-cover hidden" alt="Compare frame A" />
              <span class="compare-placeholder-a text-muted text-xs">No image</span>
            </div>
            <div class="compare-meta-a text-[10px] text-secondary leading-relaxed"></div>
          </div>
          <div class="flex items-center justify-center">
            <div class="w-px h-24 bg-white/10 hidden md:block"></div>
            <div class="md:hidden text-[10px] font-bold text-secondary uppercase tracking-widest">VS</div>
          </div>
          <div class="flex-1 flex flex-col gap-3">
            <label class="text-[10px] font-bold text-secondary uppercase tracking-widest">Frame B</label>
            <select class="compare-select-b bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none appearance-none cursor-pointer"></select>
            <div class="aspect-video bg-white/[0.02] rounded-lg border border-white/5 flex items-center justify-center overflow-hidden">
              <img class="compare-image-b w-full h-full object-cover hidden" alt="Compare frame B" />
              <span class="compare-placeholder-b text-muted text-xs">No image</span>
            </div>
            <div class="compare-meta-b text-[10px] text-secondary leading-relaxed"></div>
          </div>
        </div>
      </div>
    </div>
  `;
  comparisonOverlay.querySelector('.compare-close-btn').addEventListener('click', closeComparison);
  container.appendChild(comparisonOverlay);

  function openComparison() {
    comparisonMode = true;
    const selA = comparisonOverlay.querySelector('.compare-select-a');
    const selB = comparisonOverlay.querySelector('.compare-select-b');
    selA.innerHTML = '';
    selB.innerHTML = '';
    frames.forEach((frame, idx) => {
      const optA = document.createElement('option');
      optA.value = String(idx);
      optA.textContent = `Frame ${idx + 1}`;
      optA.style.background = '#111';
      if (idx === compareIndices[0]) optA.selected = true;
      selA.appendChild(optA);
      const optB = document.createElement('option');
      optB.value = String(idx);
      optB.textContent = `Frame ${idx + 1}`;
      optB.style.background = '#111';
      if (idx === compareIndices[1]) optB.selected = true;
      selB.appendChild(optB);
    });
    selA.onchange = () => { compareIndices[0] = Number(selA.value); renderComparison(); };
    selB.onchange = () => { compareIndices[1] = Number(selB.value); renderComparison(); };
    renderComparison();
    comparisonOverlay.classList.remove('hidden');
    comparisonOverlay.classList.add('flex');
  }

  function closeComparison() {
    comparisonMode = false;
    comparisonOverlay.classList.add('hidden');
    comparisonOverlay.classList.remove('flex');
  }

  function renderComparison() {
    const [a, b] = compareIndices;
    const frameA = frames[a];
    const frameB = frames[b];
    const imgA = comparisonOverlay.querySelector('.compare-image-a');
    const imgB = comparisonOverlay.querySelector('.compare-image-b');
    const placeholderA = comparisonOverlay.querySelector('.compare-placeholder-a');
    const placeholderB = comparisonOverlay.querySelector('.compare-placeholder-b');
    const metaA = comparisonOverlay.querySelector('.compare-meta-a');
    const metaB = comparisonOverlay.querySelector('.compare-meta-b');
    if (frameA?.imageUrl) {
      imgA.src = frameA.imageUrl;
      imgA.classList.remove('hidden');
      placeholderA.classList.add('hidden');
      metaA.textContent = `Shot: ${frameA.shot || ''}\nModel: ${selectedModelName}\nPrompt: ${frameA.prompt || ''}`;
    } else {
      imgA.classList.add('hidden');
      placeholderA.classList.remove('hidden');
      metaA.textContent = '';
    }
    if (frameB?.imageUrl) {
      imgB.src = frameB.imageUrl;
      imgB.classList.remove('hidden');
      placeholderB.classList.add('hidden');
      metaB.textContent = `Shot: ${frameB.shot || ''}\nModel: ${selectedModelName}\nPrompt: ${frameB.prompt || ''}`;
    } else {
      imgB.classList.add('hidden');
      placeholderB.classList.remove('hidden');
      metaB.textContent = '';
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && comparisonMode) {
      closeComparison();
    }
  });

  const framesArea = document.createElement('div');
  framesArea.className = 'px-4 md:px-8 pb-8 flex gap-4 overflow-x-auto no-scrollbar';
  container.appendChild(framesArea);

  const timelineStrip = document.createElement('div');
  timelineStrip.className = 'px-4 md:px-8 pb-6 shrink-0';
  container.appendChild(timelineStrip);

  function getStoryboardState() {
    return {
      frames,
      layout,
      selectedModel,
      selectedModelName,
      selectedAr,
      selectedStyle,
      selectedLighting,
      selectedColor,
      selectedPreset,
      generationProgress,
    };
  }

  function getLayoutClasses() {
    if (layout === 'grid') return 'px-4 md:px-8 pb-8 grid grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto';
    if (layout === 'story') return 'px-4 md:px-8 pb-8 flex flex-col gap-6 overflow-y-auto';
    return 'px-4 md:px-8 pb-8 flex gap-4 overflow-x-auto no-scrollbar';
  }

  function updateProgressLabel() {
    const failedCount = generationProgress.failed.length;
    progressLabel.textContent = `${generationProgress.current}/${generationProgress.total}${failedCount ? ` · ${failedCount} failed` : ''}`;
  }

  function renderFrames() {
    framesArea.className = getLayoutClasses();
    framesArea.innerHTML = '';
    frames.forEach((frame, idx) => {
      const card = document.createElement('div');
      const isGrid = layout === 'grid';
      const isStory = layout === 'story';
      card.className = `${isGrid || isStory ? 'w-full' : 'shrink-0 w-72'} bg-white/[0.03] border border-white/5 rounded-xl p-4 flex flex-col gap-3 cursor-move`;
      card.draggable = true;
      card.dataset.frameIndex = idx;

      card.ondragstart = (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(idx));
        card.classList.add('opacity-50');
      };

      card.ondragend = () => {
        card.classList.remove('opacity-50');
      };

      card.ondragover = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      };

      card.ondrop = (e) => {
        e.preventDefault();
        const fromIdx = Number(e.dataTransfer.getData('text/plain'));
        const toIdx = idx;
        if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= frames.length || toIdx >= frames.length) return;
        undoRedo.push(frames);
        const [moved] = frames.splice(fromIdx, 1);
        frames.splice(toIdx, 0, moved);
        renderFrames();
        autosave.schedule(getStoryboardState());
      };

      const frameNum = document.createElement('div');
      frameNum.className = 'flex items-center justify-between';
      frameNum.innerHTML = `
        <span class="text-xs font-bold text-primary">Frame ${idx + 1}</span>
        <button class="text-muted hover:text-red-400 transition-colors text-xs remove-frame">&times;</button>
      `;
      card.appendChild(frameNum);

      const imageArea = document.createElement('div');
      imageArea.className = 'w-full aspect-video bg-white/[0.02] rounded-lg border border-white/5 flex items-center justify-center overflow-hidden';
      imageArea.setAttribute('role', 'status');
      imageArea.setAttribute('aria-live', 'polite');
      if (frame.imageUrl) {
        const img = document.createElement('img');
        img.src = frame.imageUrl;
        img.className = 'w-full h-full object-cover cursor-pointer';
        img.alt = `Storyboard frame ${idx + 1}`;
        img.onclick = () => {
          fullscreen.show(frame.imageUrl, {
            type: 'image',
            prompt: frame.prompt,
            model: selectedModelName,
            shot: frame.shot,
          });
        };
        imageArea.appendChild(img);
      } else {
        imageArea.innerHTML = '<span class="text-muted text-xs">No image</span>';
      }
      card.appendChild(imageArea);

      const shotSelect = document.createElement('select');
      shotSelect.className = 'bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none appearance-none cursor-pointer';
      SHOT_TYPES.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        opt.style.background = '#111';
        if (s === frame.shot) opt.selected = true;
        shotSelect.appendChild(opt);
      });
      shotSelect.onchange = () => { frame.shot = shotSelect.value; autosave.schedule(getStoryboardState()); };
      card.appendChild(shotSelect);

      const promptInput = document.createElement('textarea');
      promptInput.className = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-muted focus:outline-none focus:border-primary/50 resize-none';
      promptInput.rows = 2;
      promptInput.placeholder = 'Describe this scene...';
      promptInput.value = frame.prompt;
      promptInput.setAttribute('aria-label', 'Frame description');
      promptInput.oninput = () => { frame.prompt = promptInput.value; autosave.schedule(getStoryboardState()); };
      card.appendChild(promptInput);

      // Per-frame GTM Boost — enhances this single frame's prompt.
      const frameEnhanceBtn = document.createElement('button');
      frameEnhanceBtn.type = 'button';
      frameEnhanceBtn.className = 'self-start text-xs font-bold text-primary hover:text-white transition-colors frame-enhance-btn';
      frameEnhanceBtn.textContent = '🎯 Enhance';
      frameEnhanceBtn.title = 'Enhance this frame with GTM conversion frameworks';
      frameEnhanceBtn.addEventListener('click', () => {
        import('../lib/uiIntegration.js').then(({ openGTMPromptModal }) => {
          openGTMPromptModal('storyboard', (prompt) => {
            frame.enhancedPrompt = prompt;
            frameEnhanceBtn.textContent = '🎯 Enhanced';
            frameEnhanceBtn.classList.add('active');
          });
        }).catch((err) => console.error('[StoryboardStudio] Frame GTM Boost failed:', err));
      });
      const enhanceRow = document.createElement('div');
      enhanceRow.className = 'flex items-center justify-between -mt-1';
      const enhanceHint = document.createElement('span');
      enhanceHint.className = 'text-[10px] text-muted';
      enhanceHint.textContent = 'GTM-conversion boost';
      enhanceRow.appendChild(enhanceHint);
      enhanceRow.appendChild(frameEnhanceBtn);
      card.appendChild(enhanceRow);

      // Narration input
      const narrationInput = document.createElement('input');
      narrationInput.type = 'text';
      narrationInput.className = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-muted focus:outline-none focus:border-primary/50';
      narrationInput.placeholder = 'Narration text (optional)...';
      narrationInput.value = frame.narration || '';
      narrationInput.oninput = () => { frame.narration = narrationInput.value; autosave.schedule(getStoryboardState()); };
      card.appendChild(narrationInput);

      const notesInput = document.createElement('input');
      notesInput.type = 'text';
      notesInput.className = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-muted focus:outline-none focus:border-primary/50';
      notesInput.placeholder = 'Director notes (optional)...';
      notesInput.value = frame.notes || '';
      notesInput.oninput = () => { frame.notes = notesInput.value; autosave.schedule(getStoryboardState()); };
      card.appendChild(notesInput);

      const refRow = document.createElement('div');
      refRow.className = 'flex items-center gap-2';

      const refThumbWrap = document.createElement('div');
      refThumbWrap.className = 'hidden w-8 h-8 rounded-md overflow-hidden border border-white/10 relative shrink-0';
      const refThumb = document.createElement('img');
      refThumb.className = 'w-full h-full object-cover';
      refThumbWrap.appendChild(refThumb);

      const refRemoveBtn = document.createElement('button');
      refRemoveBtn.type = 'button';
      refRemoveBtn.className = 'hidden absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors';
      refRemoveBtn.innerHTML = `<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
      refRemoveBtn.title = 'Remove reference';
      refRemoveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        frame.referenceImages = [];
        refThumbWrap.classList.add('hidden');
        refRemoveBtn.classList.add('hidden');
        resetRef();
        autosave.schedule(getStoryboardState());
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
          autosave.schedule(getStoryboardState());
        },
        onClear: () => {
          frame.referenceImages = [];
          refThumbWrap.classList.add('hidden');
          refRemoveBtn.classList.add('hidden');
          autosave.schedule(getStoryboardState());
        },
      });

      if (frame.referenceImages.length > 0 && frame.referenceImages[0].thumbnail) {
        refThumb.src = frame.referenceImages[0].thumbnail;
        refThumbWrap.classList.remove('hidden');
        refRemoveBtn.classList.remove('hidden');
      }

      refRow.appendChild(refTrigger);

      // Pexels reference frame button
      const pexelsRefBtn = document.createElement('button');
      pexelsRefBtn.type = 'button';
      pexelsRefBtn.title = 'Browse reference frame from Pexels';
      pexelsRefBtn.className = 'w-8 h-8 shrink-0 rounded-md border transition-all flex items-center justify-center bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40';
      pexelsRefBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-secondary"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>';
      pexelsRefBtn.onclick = async () => {
        const { browsePexelsImages } = await import('../lib/studioPexels.js');
        browsePexelsImages({
          title: 'Select Reference Frame',
          studioName: 'Storyboard Studio',
          onSelect: (asset) => {
            frame.referenceImages = [{
              url: asset.src?.large || asset.url || asset.original,
              thumbnail: asset.src?.medium || asset.src?.small || asset.url || asset.original,
              source: 'pexels',
              attribution: {
                photographer: asset.photographer || asset.user?.name || '',
                photographerUrl: asset.photographer_url || asset.user?.url || '',
                pexelsUrl: asset.url || '',
              }
            }];
            refThumb.src = asset.src?.medium || asset.src?.small || asset.url || asset.original;
            refThumbWrap.classList.remove('hidden');
            refRemoveBtn.classList.remove('hidden');
            autosave.schedule(getStoryboardState());
            const attrContainer = document.getElementById(`pexels-storyboard-${idx}-attr`);
            if (attrContainer) {
              attrContainer.innerHTML = '';
              import('../lib/attributionChip.js').then(mod => mod.renderAttributionChip(asset, attrContainer));
            }
          }
        });
      };
      refRow.appendChild(pexelsRefBtn);

      refRow.appendChild(refThumbWrap);
      card.appendChild(refRow);

      // Pexels attribution container
      const storyboardAttr = document.createElement('div');
      storyboardAttr.id = `pexels-storyboard-${idx}-attr`;
      storyboardAttr.className = 'mt-1';
      card.appendChild(storyboardAttr);

      const genFrameBtn = document.createElement('button');
      genFrameBtn.type = 'button';
      genFrameBtn.className = 'w-full bg-white/10 text-white py-2 rounded-lg text-xs font-bold hover:bg-white/20 transition-all';
      genFrameBtn.textContent = 'Generate Frame';
      genFrameBtn.setAttribute('aria-label', 'Generate frame');
      genFrameBtn.onclick = async () => {
        if (!(await requireEntitlement())) return;
        try {
          await generateFrame(idx, genFrameBtn, imageArea);
        } catch (err) {
          // Error already shown in generateFrame
        }
      };
      card.appendChild(genFrameBtn);

      const publishFrameBtn = document.createElement('button');
      publishFrameBtn.type = 'button';
      publishFrameBtn.textContent = 'Publish to Social';
      publishFrameBtn.className = 'w-full mt-2 bg-gradient-to-r from-[#6d5efc] to-[#a855f7] text-white py-2 rounded-lg text-xs font-bold hover:shadow-glow transition-all';
      publishFrameBtn.onclick = () => openSocialPublish({ mediaUrl: frame.imageUrl, mediaType: 'image' });
      card.appendChild(publishFrameBtn);

      card.querySelector('.remove-frame').onclick = () => {
        if (frames.length > 1) { undoRedo.push(frames); frames.splice(idx, 1); renderFrames(); autosave.schedule(getStoryboardState()); }
      };

      framesArea.appendChild(card);
    });
    renderTimelineStrip();
  }

  function renderTimelineStrip() {
    timelineStrip.innerHTML = '';
    if (frames.length === 0) return;

    const totalDuration = frameDurations.reduce((sum, d) => sum + d, 0);
    const minSegmentWidth = 40;
    const naturalWidth = frames.length * 80;
    const totalWidth = Math.max(naturalWidth, minSegmentWidth * frames.length);

    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'overflow-x-auto no-scrollbar';

    const strip = document.createElement('div');
    strip.className = 'flex h-10 rounded-lg border border-white/10 bg-white/[0.03] relative';
    strip.style.width = totalWidth + 'px';
    strip.style.minWidth = '100%';

    const shotAbbrevMap = {
      'Wide Shot': 'WS',
      'Medium Shot': 'MS',
      'Close-Up': 'CU',
      'Extreme Close-Up': 'ECU',
      'POV': 'POV',
      'Overhead': 'OH',
      'Low Angle': 'LA',
    };

    frames.forEach((frame, idx) => {
      const duration = frameDurations[idx] || 3;
      const segmentWidth = Math.max(minSegmentWidth, (duration / totalDuration) * totalWidth);
      const segment = document.createElement('div');
      segment.className = 'flex items-center justify-center border-r border-white/5 last:border-r-0 cursor-pointer hover:bg-white/10 transition-all relative group';
      segment.style.width = segmentWidth + 'px';
      segment.style.minWidth = minSegmentWidth + 'px';
      segment.dataset.frameIndex = idx;

      const label = document.createElement('span');
      label.className = 'text-[10px] font-bold text-white/80 tabular-nums select-none';
      label.textContent = idx + 1;
      segment.appendChild(label);

      const tooltip = document.createElement('span');
      tooltip.className = 'absolute -top-8 left-1/2 -translate-x-1/2 bg-black/90 text-white text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 border border-white/10';
      tooltip.textContent = `${shotAbbrevMap[frame.shot] || frame.shot} · ${duration}s`;
      segment.appendChild(tooltip);

      segment.onclick = () => {
        const card = framesArea.children[idx];
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          card.classList.add('ring-2', 'ring-primary');
          setTimeout(() => card.classList.remove('ring-2', 'ring-primary'), 1500);
        }
      };

      strip.appendChild(segment);
    });

    const totalLabel = document.createElement('span');
    totalLabel.className = 'text-[10px] font-bold text-secondary tabular-nums ml-3 shrink-0';
    totalLabel.textContent = `Total: ${totalDuration}s`;

    const row = document.createElement('div');
    row.className = 'flex items-center gap-2';
    row.appendChild(scrollContainer);
    scrollContainer.appendChild(strip);
    row.appendChild(totalLabel);
    timelineStrip.appendChild(row);
  }


    // Prompt Gallery button
    const promptGalleryBtn = document.createElement('button');
    promptGalleryBtn.type = 'button';
    promptGalleryBtn.textContent = '📚 Prompts';
    promptGalleryBtn.title = 'Browse prompt gallery';
    promptGalleryBtn.setAttribute('aria-label', 'Open prompt gallery');
    promptGalleryBtn.className = 'btn-ghost-modern shrink-0';
    promptGalleryBtn.addEventListener('click', () => {
      openPromptGallery({
        appTheme: 'storyboard-studio',
        onSelect: (prompt) => {
          // Default: try to find a textarea in the studio
          const ta = document.querySelector('textarea') || document.querySelector('[data-prompt]');
          if (ta) {
            ta.value = prompt;
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            ta.focus();
          }
        }
      }).catch((err) => console.error('[PromptGallery] open failed:', err));
    });

    // Recipe Engine button
    const recipeBtn = document.createElement('button');
    recipeBtn.type = 'button';
    recipeBtn.textContent = '📋 Recipes';
    recipeBtn.title = 'Browse AI recipes';
    recipeBtn.setAttribute('aria-label', 'Open recipe engine');
    recipeBtn.className = 'btn-ghost-modern shrink-0';
    recipeBtn.addEventListener('click', () => {
      openRecipeModal({
        onRunRecipe: (url) => {
        }
      }).catch((err) => console.error('[Recipe] open failed:', err));
    });


    // Monetization Hub button
    const monetizationBtn = document.createElement('button');
    monetizationBtn.type = 'button';
    monetizationBtn.textContent = "💼 Monetize";
    monetizationBtn.title = "Open Smart Video AI Monetization Hub";
    monetizationBtn.setAttribute('aria-label', 'Open Smart Video AI Monetization Hub');
    monetizationBtn.className = 'btn-ghost-modern shrink-0';
    monetizationBtn.addEventListener('click', () => {
      openMonetizationHub().catch((err) => console.error('[Monetization] open failed:', err));
    });
  controlBar.appendChild(recipeBtn);
  controlBar.appendChild(monetizationBtn);

  async function generateFrame(idx, btn, imageArea) {
    const frame = frames[idx];
    if (!frame.prompt.trim()) { alert('Enter a scene description'); return; }
    const hasKey = apiKeyManager.hasOpenAIKey() || apiKeyManager.hasMuapiKey();
    if (!hasKey) { AuthModal(() => generateFrame(idx, btn, imageArea)); return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="animate-spin inline-block mr-2">&#9711;</span>';

    try {
      // Resolve personalization tokens at generation time only (tokens stay
      // visible in the textarea until now).
      let rawPrompt = frame.prompt;
      if (frame.enhancedPrompt) {
        // Per-frame GTM Boost output takes precedence for this frame.
        rawPrompt = `${frame.enhancedPrompt} — ${frame.shot} composition`;
      } else if (enhancedConcept) {
        // Global GTM Boost concept propagated to every frame.
        rawPrompt = `${enhancedConcept} Scene: ${frame.prompt} (${frame.shot})`;
      }
      const profile = activeProfileRef.value;
      const resolvedPrompt = profile ? replaceTokensInPrompt(rawPrompt, profile) : rawPrompt;

      const prompt = `${frame.shot} cinematic storyboard frame: ${resolvedPrompt}, professional cinematography, 4K quality`;
      const url = await engineGenerateFrameImage(prompt, selectedAr, selectedModel, selectedStyle, selectedLighting, selectedColor, customThumbnailUrl);
      if (url) {
        frame.imageUrl = url;
        imageArea.innerHTML = `<img src="${url}" class="w-full h-full object-cover">`;
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
      throw err;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate Frame';
    }
  }

  /**
   * Generate a single storyboard frame image. Prefers the user's OpenAI key
   * (direct to the OpenAI Image API) and falls back to MuAPI when only a MuAPI
   * key is configured.
   * @param {string} prompt
   * @returns {Promise<string|null>} image URL/data-URL or null
   */
   async function generateFrameImage(prompt) {
     if (apiKeyManager.hasOpenAIKey()) {
       try {
         const { images } = await openaiService.generateImageResponses({
           input: prompt,
           size: '16:9',
           quality: 'auto',
           outputFormat: 'png',
         });
         const img = images?.[0];
         if (!img) return null;
         return img.base64 ? `data:image/png;base64,${img.base64}` : img.url || null;
       } catch (err) {
         // Surface OpenAI-specific failures clearly; MuAPI fallback below.
         if (!apiKeyManager.hasMuapiKey()) throw err;
         console.warn('[StoryboardStudio] OpenAI Responses generation failed, falling back to MuAPI:', err.message);
       }
     }
     const result = await muapi.generateImage({ model: 'nano-banana', prompt, aspect_ratio: '16:9' });
     return result?.url || null;
   }

  genAllBtn.onclick = async () => {
    const hasKey = apiKeyManager.hasOpenAIKey() || apiKeyManager.hasMuapiKey();
    if (!hasKey) { AuthModal(() => genAllBtn.click()); return; }

    genAllBtn.disabled = true;
    genAllBtn.innerHTML = '<span class="animate-spin inline-block mr-2">&#9711;</span> Generating...';

    for (let i = 0; i < frames.length; i++) {
      if (!frames[i].prompt.trim()) continue;
      try {
        const card = framesArea.children[i];
        const btn = card?.querySelector('button:last-child');
        const imageArea = card?.querySelector('.aspect-video');
        if (!btn || !imageArea) continue;
        await withRetry(() => generateFrame(i, btn, imageArea));
        generationProgress.current++;
        updateProgressLabel();
      } catch (err) {
        showToast(`Frame ${i + 1} failed: ${err.message}`, 'error');
        generationProgress.failed.push(i);
        updateProgressLabel();
      }
    }

    genAllBtn.disabled = false;
    genAllBtn.textContent = 'Generate All Frames';
    retryBtn.classList.toggle('hidden', generationProgress.failed.length === 0);
    if (generationProgress.failed.length === 0) {
      showToast('All frames generated', 'success');
    }
  };

  renderFrames();

  function updateUndoRedoButtons() {
    if (undoBtn) undoBtn.classList.toggle('opacity-50', !undoRedo.canUndo());
    if (redoBtn) redoBtn.classList.toggle('opacity-50', !undoRedo.canRedo());
  }

  const undoBtn = document.createElement('button');
  undoBtn.type = 'button';
  undoBtn.className = 'px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition-all';
  undoBtn.innerHTML = '↶ Undo';
  undoBtn.title = 'Undo (Ctrl+Z)';
  undoBtn.onclick = () => {
    const prev = undoRedo.undo(frames);
    if (prev) { frames.length = 0; frames.push(...prev); renderFrames(); autosave.schedule(getStoryboardState()); updateUndoRedoButtons(); }
  };

  const redoBtn = document.createElement('button');
  redoBtn.type = 'button';
  redoBtn.className = 'px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition-all';
  redoBtn.innerHTML = '↷ Redo';
  redoBtn.title = 'Redo (Ctrl+Shift+Z)';
  redoBtn.onclick = () => {
    const next = undoRedo.redo(frames);
    if (next) { frames.length = 0; frames.push(...next); renderFrames(); autosave.schedule(getStoryboardState()); updateUndoRedoButtons(); }
  };

  controlBar.appendChild(undoBtn);
  controlBar.appendChild(redoBtn);

  window.addEventListener('keydown', (e) => {
    const isMeta = e.metaKey || e.ctrlKey;
    if (isMeta && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      undoBtn.click();
      return;
    }
    if (isMeta && ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y')) {
      e.preventDefault();
      redoBtn.click();
      return;
    }
    if (isMeta && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveBtn.click();
    }
  });

  return container;
}
