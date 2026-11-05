/**
 * Video Studio input tools for the template studios.
 *
 * Template Studio and Cinema Template Studio get the same prompt-bar tools
 * as the Video Studio, built from the same modules:
 *
 *   - Attachment toolbar on the prompt (start / end frame, image, video)
 *     → createAttachmentToolbar + uploadMediaFile
 *   - Aspect ratio limited to the selected model (when the template has no
 *     aspect-ratio field of its own)
 *   - Advanced panel: Character Lock + per-model controls (negative prompt,
 *     seed) → createAdvancedControls + characterConsistency
 *   - Motion & Style: camera speed, guidance scale, style presets
 *
 * Nothing here replaces a template feature: values are added to the params /
 * prompt the studio already builds.
 */
import { t2iModels, i2iModels, i2vModels, t2vModels, v2vModels } from './models.js';

const LISTS = { t2i: t2iModels, i2i: i2iModels, i2v: i2vModels, t2v: t2vModels, v2v: v2vModels };
const STYLE_PRESETS = ['None', 'Cinematic', 'Anime', 'Realistic', 'Watercolor', 'Noir'];
const DEFAULT_CAMERA_SPEED = 5;
const DEFAULT_GUIDANCE = 7.5;
const CHARACTER_REF_ID = 'studio-character-lock'; // shared with the Video Studio

function findModel(route, modelId) {
  return (LISTS[route] || []).find(m => m && m.id === modelId) || null;
}

const chipClass = 'h-9 shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300 transition hover:bg-white/[0.08] hover:text-white';
const panelClass = 'mt-3 hidden rounded-[20px] border border-white/10 bg-black/40 p-4 flex flex-col gap-4';

/**
 * Motion & Style prompt modifiers (same wording as the Video Studio).
 * Pure, exported for tests.
 */
export function motionStyleModifiers({ style = 'None', cameraSpeed = DEFAULT_CAMERA_SPEED } = {}) {
  const mods = [];
  if (cameraSpeed !== DEFAULT_CAMERA_SPEED) {
    const speed = cameraSpeed <= 3 ? 'slow' : cameraSpeed <= 7 ? 'medium' : 'fast';
    mods.push(`${speed} camera speed (${cameraSpeed}/10)`);
  }
  if (style && style !== 'None') mods.push(`${style.toLowerCase()} style`);
  return mods;
}

/**
 * @param {Object} opts
 * @param {string} opts.studioName
 * @param {'video'|'image'} [opts.kind='video']
 * @param {() => {route: string, model: string, imageUrl?: string}} opts.getTarget
 * @param {(key: 'startFrame'|'endFrame'|'image'|'video', url: string) => void} opts.onAttach
 * @param {boolean} [opts.hasOwnAspectRatio=false]  Template already has an aspect-ratio field.
 * @param {string} [opts.defaultAspectRatio]
 */
export function createTemplateVideoTools({
  studioName = 'Template Studio',
  kind = 'video',
  getTarget,
  onAttach,
  hasOwnAspectRatio = false,
  defaultAspectRatio = '',
} = {}) {
  const isVideo = kind === 'video';
  const state = {
    aspectRatio: defaultAspectRatio || '',
    characterLock: false,
    cameraSpeed: DEFAULT_CAMERA_SPEED,
    guidance: DEFAULT_GUIDANCE,
    style: 'None',
  };
  let advanced = null;      // createAdvancedControls handle
  let advancedModelId = null;
  let current = { route: '', model: '', supportsCharacter: false, ratios: [], guidance: false };

  const root = document.createElement('div');
  root.className = 'template-video-tools mt-4';
  root.dataset.videoTools = '';

  const row = document.createElement('div');
  row.className = 'flex flex-wrap items-center gap-2';
  root.appendChild(row);

  // Aspect ratio (model-aware) — only when the template has none of its own.
  const arWrap = document.createElement('label');
  arWrap.className = 'flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500';
  arWrap.textContent = 'Ratio';
  const arSel = document.createElement('select');
  arSel.name = 'template-aspect-ratio';
  arSel.className = 'h-9 rounded-full border border-white/10 bg-white/[0.03] px-3 text-xs font-semibold text-white outline-none';
  arSel.onchange = () => { state.aspectRatio = arSel.value; };
  arWrap.appendChild(arSel);
  if (!hasOwnAspectRatio) row.appendChild(arWrap);

  // Advanced + Motion & Style toggles
  const advBtn = document.createElement('button');
  advBtn.type = 'button';
  advBtn.textContent = 'Advanced';
  advBtn.title = 'Show advanced options';
  advBtn.dataset.tool = 'advanced';
  advBtn.className = chipClass;
  row.appendChild(advBtn);

  const motionBtn = document.createElement('button');
  motionBtn.type = 'button';
  motionBtn.textContent = 'Motion & Style';
  motionBtn.title = 'Camera speed, guidance & style presets';
  motionBtn.dataset.tool = 'motion-style';
  motionBtn.className = chipClass;
  if (isVideo) row.appendChild(motionBtn);

  // Advanced panel
  const advPanel = document.createElement('div');
  advPanel.className = panelClass;
  advPanel.dataset.panel = 'advanced';
  advPanel.innerHTML = `
    <div class="flex items-center justify-between" data-row="character-lock">
      <div>
        <div class="text-sm font-semibold text-white">Character Lock</div>
        <div class="text-xs text-zinc-500">Keep the same character across generations (uses your reference image)</div>
      </div>
      <button type="button" role="switch" aria-checked="false" data-toggle="character-lock" class="relative h-7 w-12 rounded-full border border-white/10 bg-white/10 transition">
        <span class="absolute top-1 left-1 h-5 w-5 rounded-full bg-white transition"></span>
      </button>
    </div>
    <div data-advanced-controls class="flex flex-col gap-4"></div>
  `;
  root.appendChild(advPanel);
  const lockRow = advPanel.querySelector('[data-row="character-lock"]');
  const lockBtn = advPanel.querySelector('[data-toggle="character-lock"]');
  const lockKnob = lockBtn.querySelector('span');
  const controlsHost = advPanel.querySelector('[data-advanced-controls]');
  const paintLock = () => {
    lockBtn.setAttribute('aria-checked', String(state.characterLock));
    lockBtn.classList.toggle('bg-emerald-400', state.characterLock);
    lockBtn.classList.toggle('bg-white/10', !state.characterLock);
    lockKnob.style.left = state.characterLock ? 'calc(100% - 24px)' : '4px';
  };
  lockBtn.onclick = async (e) => {
    e.stopPropagation();
    state.characterLock = !state.characterLock;
    paintLock();
    const { imageUrl, model } = getTarget?.() || {};
    if (state.characterLock && imageUrl) {
      try {
        const { saveCharacterReference } = await import('./characterConsistency.js');
        await saveCharacterReference({ id: CHARACTER_REF_ID, imageUrl, modelId: model });
      } catch (err) {
        console.warn(`[${studioName}] could not save character reference:`, err);
      }
    }
  };
  advBtn.onclick = (e) => {
    e.stopPropagation();
    const open = advPanel.classList.toggle('hidden') === false;
    advBtn.textContent = open ? 'Less' : 'Advanced';
    if (open) refresh();
  };

  // Motion & Style panel
  const motionPanel = document.createElement('div');
  motionPanel.className = panelClass;
  motionPanel.dataset.panel = 'motion-style';
  motionPanel.innerHTML = `
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between"><label class="text-xs font-medium text-white/70">Camera Speed</label><span data-value="camera-speed" class="text-xs font-bold text-primary">${DEFAULT_CAMERA_SPEED}</span></div>
      <input type="range" min="1" max="10" value="${DEFAULT_CAMERA_SPEED}" name="template-camera-speed" class="w-full accent-primary" />
    </div>
    <div class="flex flex-col gap-2" data-row="guidance">
      <div class="flex items-center justify-between"><label class="text-xs font-medium text-white/70">Guidance Scale</label><span data-value="guidance" class="text-xs font-bold text-primary">${DEFAULT_GUIDANCE}</span></div>
      <input type="range" min="1" max="20" step="0.5" value="${DEFAULT_GUIDANCE}" name="template-guidance" class="w-full accent-primary" />
    </div>
    <div class="flex flex-col gap-2">
      <label class="text-xs font-medium text-white/70">Style Preset</label>
      <div class="flex flex-wrap gap-2" data-style-presets>
        ${STYLE_PRESETS.map(s => `<button type="button" data-style="${s}" class="rounded-lg border px-3 py-1.5 text-xs font-medium transition ${s === 'None' ? 'bg-primary/20 text-primary border-primary/30' : 'bg-white/5 text-zinc-400 border-white/5'}">${s}</button>`).join('')}
      </div>
    </div>
  `;
  if (isVideo) root.appendChild(motionPanel);
  const speedInput = motionPanel.querySelector('[name="template-camera-speed"]');
  const speedVal = motionPanel.querySelector('[data-value="camera-speed"]');
  speedInput.oninput = () => { state.cameraSpeed = parseInt(speedInput.value, 10); speedVal.textContent = String(state.cameraSpeed); };
  const guidanceInput = motionPanel.querySelector('[name="template-guidance"]');
  const guidanceVal = motionPanel.querySelector('[data-value="guidance"]');
  guidanceInput.oninput = () => { state.guidance = parseFloat(guidanceInput.value); guidanceVal.textContent = String(state.guidance); };
  motionPanel.querySelectorAll('[data-style]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      state.style = b.dataset.style;
      motionPanel.querySelectorAll('[data-style]').forEach((x) => {
        const on = x === b;
        x.classList.toggle('bg-primary/20', on); x.classList.toggle('text-primary', on); x.classList.toggle('border-primary/30', on);
        x.classList.toggle('bg-white/5', !on); x.classList.toggle('text-zinc-400', !on); x.classList.toggle('border-white/5', !on);
      });
      // Changing style is an input change: the prompt is rebuilt.
      root.dispatchEvent(new Event('change', { bubbles: true }));
    };
  });
  motionBtn.onclick = (e) => {
    e.stopPropagation();
    const open = motionPanel.classList.toggle('hidden') === false;
    motionBtn.textContent = open ? 'Less' : 'Motion & Style';
  };

  function buildAdvancedControls(model) {
    if (!model || model.id === advancedModelId) return;
    advancedModelId = model.id;
    controlsHost.innerHTML = '';
    advanced = null;
    const inputs = {};
    for (const [key, schema] of Object.entries(model.inputs || {})) {
      if (key === 'negative_prompt' || key === 'seed') inputs[key] = schema;
    }
    if (!Object.keys(inputs).length) {
      controlsHost.innerHTML = '<div class="text-xs text-zinc-500">This model has no extra advanced options.</div>';
      return;
    }
    import('./studioControls.js').then(({ createAdvancedControls }) => {
      if (advancedModelId !== model.id) return;
      const handle = createAdvancedControls({
        model: { ...model, inputs },
        state: {},
        container: controlsHost,
        exclude: new Set(['aspect_ratio', 'duration', 'resolution', 'quality']),
      }) || null;
      advanced = handle ? { ...handle, modelId: model.id } : null;
    }).catch((err) => {
      console.warn(`[${studioName}] advanced controls unavailable:`, err);
      // Let the next open retry for this model.
      if (advancedModelId === model.id) advancedModelId = null;
    });
  }

  /** Re-read the selected model and update what is offered. */
  function refresh() {
    const { route, model } = getTarget?.() || {};
    const m = findModel(route, model);
    const ratios = Array.isArray(m?.inputs?.aspect_ratio?.enum) ? m.inputs.aspect_ratio.enum.map(String) : [];
    const supportsCharacter = !!(m?.inputs?.character_consistency || m?.inputs?.reference_images);
    const guidance = !!m?.inputs?.guidance_scale;
    current = { route, model, supportsCharacter, ratios, guidance };

    // Aspect ratio
    if (!hasOwnAspectRatio) {
      if (ratios.length && !ratios.includes(state.aspectRatio)) state.aspectRatio = ratios.includes(defaultAspectRatio) ? defaultAspectRatio : ratios[0];
      arSel.innerHTML = ratios.map(r => `<option value="${r}"${r === state.aspectRatio ? ' selected' : ''}>${r}</option>`).join('');
      arWrap.classList.toggle('hidden', !ratios.length);
    }
    // Character lock only for models that support it (like the Video Studio).
    lockRow.classList.toggle('hidden', !supportsCharacter);
    if (!supportsCharacter && state.characterLock) { state.characterLock = false; paintLock(); }
    motionPanel.querySelector('[data-row="guidance"]').classList.toggle('opacity-50', !guidance);
    if (!advPanel.classList.contains('hidden')) buildAdvancedControls(m);
    else if (m && m.id !== advancedModelId) { advancedModelId = null; advanced = null; }
  }

  /** Attachment toolbar on the prompt field (same as the Video Studio). */
  async function attachToPrompt(promptField) {
    if (!promptField || !promptField.parentElement) return null;
    try {
      const [{ createAttachmentToolbar }, { uploadMediaFile }] = await Promise.all([
        import('./attachmentToolbar.js'),
        import('./editor/upload.js'),
      ]);
      return createAttachmentToolbar({
        container: promptField.parentElement,
        getTextarea: () => promptField,
        acceptAudio: false,
        acceptVideo: isVideo,
        acceptStartFrame: isVideo,
        acceptEndFrame: isVideo,
        onUpload: async (key, file) => {
          try {
            const url = await uploadMediaFile(file);
            if (url) onAttach?.(key, url);
            refresh();
          } catch (err) {
            const { showToast } = await import('./loading.js');
            showToast?.(`Attachment upload failed: ${err.message}`, 'error');
          }
        },
      });
    } catch (err) {
      console.warn(`[${studioName}] attachment toolbar unavailable:`, err);
      return null;
    }
  }

  /** Motion & Style modifiers appended to the prompt (not for video-to-video). */
  function applyToPrompt(prompt, route) {
    if (!isVideo || route === 'v2v') return prompt;
    const mods = motionStyleModifiers({ style: state.style, cameraSpeed: state.cameraSpeed });
    if (!mods.length) return prompt;
    const text = mods.join(', ');
    if (!prompt) return text;
    if (prompt.toLowerCase().includes(text.toLowerCase())) return prompt;
    return `${prompt.replace(/[\s.]+$/, '')}, ${text}.`;
  }

  /** Advanced / Character Lock / guidance / aspect ratio → request params. */
  async function applyToParams(params) {
    // Only the Advanced values built for the model being sent.
    const payload = (advanced?.getPayload && advanced.modelId === current.model) ? advanced.getPayload() : {};
    if (payload.negative_prompt) params.negative_prompt = payload.negative_prompt;
    if (payload.seed !== undefined && payload.seed !== null && payload.seed !== '' && payload.seed !== -1) params.seed = payload.seed;
    if (current.guidance && state.guidance !== DEFAULT_GUIDANCE) params.guidance_scale = state.guidance;
    if (!hasOwnAspectRatio && current.ratios.length && state.aspectRatio) params.aspect_ratio = state.aspectRatio;
    if (state.characterLock && current.supportsCharacter) {
      try {
        const { getCharacterReference } = await import('./characterConsistency.js');
        const ref = await getCharacterReference(CHARACTER_REF_ID);
        if (ref?.imageUrl) {
          params.reference_images = [ref.imageUrl];
          params.character_consistency = true;
        }
      } catch { /* no saved reference */ }
    }
    return params;
  }

  return {
    element: root,
    refresh,
    attachToPrompt,
    applyToPrompt,
    applyToParams,
    getState: () => ({ ...state }),
  };
}
