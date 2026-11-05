/**
 * Template media inputs — shared by Template Studio and Cinema Template Studio.
 *
 * Mirrors the Video Studio prompt bar exactly: one persistent
 * `createUploadPicker` (same trigger, same panel with upload history,
 * drag & drop, paste, "From URL", Asset Library) plus the Pexels stock
 * browser button next to it. The picker panel is mounted once into the
 * studio container, so clicking the field opens the real panel instead of
 * building a fresh, invisible picker on every click.
 *
 * It also owns the generation routing for templates so an uploaded image or
 * video reaches MuAPI the same way it does in the Video Studio:
 *   - a source video  → video-to-video (v2v) model
 *   - an image        → image-to-video (i2v) for video templates,
 *                       image-to-image (i2i) for image templates
 *   - nothing         → text-to-video / text-to-image
 */
import { createUploadPicker } from '../components/UploadPicker.js';
import { t2iModels, i2iModels, i2vModels, t2vModels, v2vModels } from './models.js';

// Model families (Kling t2v / i2v / … as one entry), loaded lazily so this
// module stays importable where the full catalog is not available.
let modelFamilies = null;
const modelFamiliesReady = import('./modelFamilies.js')
  .then((m) => { modelFamilies = m; return m; })
  .catch(() => null);
export function whenModelFamiliesReady() { return modelFamiliesReady; }

const PEXELS_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-secondary group-hover:text-primary"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>';
const LAST_FRAME_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-secondary group-hover:text-primary"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/><line x1="12" y1="9" x2="12" y2="15"/></svg>';
const CLEAR_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

const EMPTY_TEXT = {
  image: 'Upload, paste or drop an image',
  frame: 'Add a start frame (and optional end frame)',
  video: 'Upload, paste or drop a video',
};

// The picker panel is absolutely positioned against the studio container, so
// the container must be a positioning context. Studios build their DOM while
// detached (computed style is empty then), so check classes / inline style.
function ensurePositioned(el) {
  if (!el || !el.style) return;
  if (el.style.position && el.style.position !== 'static') return;
  const cls = ` ${el.className || ''} `;
  if (/\s(relative|absolute|fixed|sticky)\s/.test(cls)) return;
  el.style.position = 'relative';
}

function pexelsImageUrl(asset) {
  return asset?.src?.large2x || asset?.src?.large || asset?.src?.original || asset?.url || asset?.original || null;
}

function pexelsVideoUrl(asset) {
  const files = asset?.video_files || [];
  const hd = files.find(f => f.quality === 'hd') || files[0];
  return hd?.link || asset?.url || asset?.original || null;
}

/**
 * Build a media input row (image | frame | video) for a template form.
 *
 * @param {Object} opts
 * @param {'image'|'frame'|'video'} opts.kind
 * @param {HTMLElement} opts.anchorContainer  Studio root; the picker panel is mounted here.
 * @param {string} opts.studioName            Shown in the Pexels browser header.
 * @param {(value: string|{startUrl:string,endUrl:string|null,urls:string[]}|null, meta?: object) => void} opts.onChange
 * @param {string} [opts.title]               Pexels modal title.
 * @param {*} [opts.initialValue]             Media already attached (re-render).
 * @param {boolean} [opts.required]           Generation needs this media.
 * @returns {{ element: HTMLElement, clear: () => void, getValue: () => any }}
 */
export function createTemplateMediaField({ kind = 'image', anchorContainer, studioName = 'Template Studio', onChange, title, initialValue = null, required = false } = {}) {
  const isVideo = kind === 'video';
  const isFrame = kind === 'frame';
  let value = initialValue || null;

  ensurePositioned(anchorContainer);

  const row = document.createElement('div');
  row.className = 'template-media-field flex items-center gap-2 rounded-[20px] border border-white/10 bg-white/[0.03] px-3 py-2';
  row.dataset.mediaKind = kind;

  const status = document.createElement('button');
  status.type = 'button';
  status.className = 'flex-1 min-w-0 text-left text-sm text-zinc-400 hover:text-white transition truncate';

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.title = 'Remove';
  clearBtn.setAttribute('aria-label', 'Remove media');
  clearBtn.className = 'hidden w-8 h-8 shrink-0 rounded-lg items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition';
  clearBtn.innerHTML = CLEAR_ICON;

  const emptyText = required ? `Required — ${EMPTY_TEXT[kind].charAt(0).toLowerCase()}${EMPTY_TEXT[kind].slice(1)}` : EMPTY_TEXT[kind];
  if (required) row.dataset.required = 'true';
  const setStatus = (text, tone = 'idle') => {
    if (text === EMPTY_TEXT[kind]) text = emptyText;
    status.textContent = text;
    status.classList.remove('text-zinc-400', 'text-emerald-200', 'text-primary');
    status.classList.add(tone === 'done' ? 'text-emerald-200' : tone === 'stock' ? 'text-primary' : 'text-zinc-400');
    clearBtn.classList.toggle('hidden', tone === 'idle');
    clearBtn.classList.toggle('flex', tone !== 'idle');
  };

  const emit = (next, meta = {}) => {
    value = next;
    if (typeof onChange === 'function') onChange(next, meta);
  };

  // Same picker the Video Studio prompt bar uses.
  const picker = createUploadPicker({
    anchorContainer,
    frameMode: isFrame,
    acceptVideo: isVideo,
    acceptDocuments: false,
    singleLabel: isVideo ? 'Source video' : 'Reference image',
    onSelect: (sel) => {
      if (isFrame) {
        const next = { startUrl: sel.startUrl || null, endUrl: sel.endUrl || null, urls: sel.urls || [] };
        emit(next, { source: 'upload', selection: sel });
        setStatus(next.endUrl ? 'Start & end frames set' : 'Start frame set — add an end frame (optional)', 'done');
      } else {
        // Only the media type this field takes (an image picked from history
        // in the video field — or the reverse — would go in the wrong slot).
        const t = sel.type || '';
        if ((isVideo && t && t !== 'video') || (!isVideo && t && t !== 'image')) {
          picker.reset();
          import('./loading.js').then(m => m.showToast?.(isVideo ? 'Please choose a video for this field.' : 'Please choose an image for this field.', 'error')).catch(() => {});
          if (!value) setStatus(EMPTY_TEXT[kind]);
          return;
        }
        emit(sel.url || null, { source: 'upload', selection: sel });
        setStatus(isVideo ? 'Video ready' : 'Image ready', 'done');
      }
    },
    onClear: () => {
      emit(null, { source: 'clear' });
      setStatus(EMPTY_TEXT[kind]);
    },
  });

  if (isVideo) picker.trigger.title = 'Upload a source video';

  status.onclick = (e) => {
    e.stopPropagation();
    picker.trigger.click();
  };

  clearBtn.onclick = (e) => {
    e.stopPropagation();
    picker.reset();
    emit(null, { source: 'clear' });
    setStatus(EMPTY_TEXT[kind]);
  };

  const pexelsBtn = document.createElement('button');
  pexelsBtn.type = 'button';
  pexelsBtn.title = isVideo ? 'Browse stock videos' : 'Browse stock photos';
  pexelsBtn.setAttribute('aria-label', pexelsBtn.title);
  pexelsBtn.className = 'w-10 h-10 shrink-0 rounded-xl border transition-all flex items-center justify-center bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40 group relative overflow-hidden';
  pexelsBtn.innerHTML = PEXELS_ICON;
  pexelsBtn.onclick = async (e) => {
    e.stopPropagation();
    try {
      const mod = await import('./studioPexels.js');
      const browse = isVideo ? mod.browsePexelsVideos : mod.browsePexelsImages;
      await browse({
        title: title || (isVideo ? 'Select Source Video' : isFrame ? 'Select Start Frame' : 'Select Reference Image'),
        studioName,
        onSelect: (asset) => {
          const url = isVideo ? pexelsVideoUrl(asset) : pexelsImageUrl(asset);
          if (!url) return;
          // Frame fields: put the stock image in the picker's start slot, so a
          // later end-frame pick from the picker keeps it (the picker reports
          // only its own slots). Other fields: nothing to keep.
          if (isFrame && typeof picker.setFrames === 'function') picker.setFrames(url, null);
          else picker.reset();
          if (isFrame) {
            emit({ startUrl: url, endUrl: null, urls: [url] }, { source: 'pexels', asset });
            setStatus('Start frame from stock library', 'stock');
          } else {
            emit(url, { source: 'pexels', asset });
            setStatus(isVideo ? 'Video from stock library' : 'Image from stock library', 'stock');
          }
        },
      });
    } catch (err) {
      console.error(`[${studioName}] stock media browse failed:`, err);
      import('./loading.js').then(m => m.showToast?.('Failed to load stock media', 'error')).catch(() => {});
    }
  };

  // The picker trigger already carries mt-1.5 for the Video Studio bar.
  picker.trigger.classList.remove('mt-1.5');

  row.appendChild(picker.trigger);
  row.appendChild(pexelsBtn);

  // Video Studio shortcut: use the last frame of a video as the start image.
  // The frame is uploaded through the same picker pipeline as any image.
  if (!isVideo && typeof picker.uploadFile === 'function') {
    const lastFrameInput = document.createElement('input');
    lastFrameInput.type = 'file';
    lastFrameInput.accept = 'video/*';
    lastFrameInput.className = 'hidden';
    const lastFrameBtn = document.createElement('button');
    lastFrameBtn.type = 'button';
    lastFrameBtn.title = 'Use the last frame of a video';
    lastFrameBtn.setAttribute('aria-label', lastFrameBtn.title);
    lastFrameBtn.dataset.action = 'last-frame';
    lastFrameBtn.className = pexelsBtn.className;
    lastFrameBtn.innerHTML = LAST_FRAME_ICON;
    lastFrameBtn.onclick = (e) => {
      e.stopPropagation();
      lastFrameInput.click();
    };
    lastFrameInput.onchange = async () => {
      const file = lastFrameInput.files && lastFrameInput.files[0];
      lastFrameInput.value = '';
      if (!file) return;
      lastFrameBtn.disabled = true;
      lastFrameBtn.innerHTML = '<span class="animate-spin text-primary text-sm">◌</span>';
      try {
        const { extractLastFrameFile } = await import('./videoFrames.js');
        const frame = await extractLastFrameFile(file);
        const before = value;
        if (!before) setStatus('Uploading last frame…');
        await picker.uploadFile(frame);
        // Upload stopped without selecting (no key, size cap, failure).
        if (value === before && !before) setStatus(EMPTY_TEXT[kind]);
      } catch (err) {
        console.error(`[${studioName}] last-frame extraction failed:`, err);
        import('./loading.js').then(m => m.showToast?.(`Failed to extract last frame: ${err.message}`, 'error')).catch(() => {});
        if (!value) setStatus(EMPTY_TEXT[kind]);
      } finally {
        lastFrameBtn.disabled = false;
        lastFrameBtn.innerHTML = LAST_FRAME_ICON;
      }
    };
    lastFrameBtn.appendChild(lastFrameInput);
    row.appendChild(lastFrameBtn);
  }

  row.appendChild(status);
  row.appendChild(clearBtn);
  if (value) {
    // Re-render with frames already attached: seed the picker's slots so the
    // next pick from the picker keeps the other frame.
    if (isFrame && typeof value === 'object' && typeof picker.setFrames === 'function') {
      picker.setFrames(value.startUrl || null, value.endUrl || null);
    }
    const hasEnd = isFrame && typeof value === 'object' && value.endUrl;
    setStatus(isVideo ? 'Video ready' : isFrame ? (hasEnd ? 'Start & end frames set' : 'Start frame set') : 'Image ready', 'done');
  } else {
    setStatus(EMPTY_TEXT[kind]);
  }

  if (anchorContainer && !picker.panel.isConnected) anchorContainer.appendChild(picker.panel);

  return {
    element: row,
    getValue: () => value,
    clear: () => {
      picker.reset();
      emit(null, { source: 'clear' });
      setStatus(EMPTY_TEXT[kind]);
    },
    /**
     * Set media that was uploaded elsewhere (the prompt attachment toolbar).
     * For frame fields pass { startUrl?, endUrl? }; missing parts keep the
     * current value.
     */
    setValue: (next, label) => {
      if (next == null) return;
      let v = next;
      if (isFrame) {
        const prev = value && typeof value === 'object' ? value : {};
        const start = typeof next === 'string' ? next : (next.startUrl ?? prev.startUrl ?? null);
        const end = typeof next === 'string' ? (prev.endUrl ?? null) : (next.endUrl ?? prev.endUrl ?? null);
        v = { startUrl: start, endUrl: end, urls: [start, end].filter(Boolean) };
      }
      if (isFrame && typeof picker.setFrames === 'function') picker.setFrames(v.startUrl, v.endUrl);
      else picker.reset();
      emit(v, { source: 'attachment' });
      const hasEnd = isFrame && v.endUrl;
      setStatus(label || (isVideo ? 'Video ready' : isFrame ? (hasEnd ? (v.startUrl ? 'Start & end frames set' : 'End frame set — add a start frame') : 'Start frame set') : 'Image ready'), 'done');
    },
  };
}

/**
 * Pull image / end-frame / video URLs out of a template form state, whatever
 * shape the inputs were stored in (plain URL, frame object, legacy keys).
 */
export function extractTemplateMedia(state = {}, inputs = []) {
  let imageUrl = null;
  let endImageUrl = null;
  let videoUrl = null;

  const take = (val) => {
    if (!val) return;
    if (typeof val === 'string') { if (!imageUrl) imageUrl = val; return; }
    if (typeof val === 'object') {
      // A frame object with a startUrl key never promotes its end frame.
      if (!imageUrl) imageUrl = ('startUrl' in val) ? (val.startUrl || null) : (val.url || (Array.isArray(val.urls) ? val.urls[0] : null) || null);
      if (!endImageUrl && val.endUrl) endImageUrl = val.endUrl;
    }
  };

  inputs.forEach(input => {
    if (!input) return;
    if (input.type === 'image' || input.type === 'frame') take(state[input.name]);
    if (input.type === 'video' && !videoUrl && typeof state[input.name] === 'string') videoUrl = state[input.name];
  });

  take(state.image_url);
  take(state.referenceImage);
  if (!endImageUrl && typeof state.last_image_url === 'string') endImageUrl = state.last_image_url;
  if (!videoUrl && typeof state.video_url === 'string') videoUrl = state.video_url;

  return { imageUrl, endImageUrl, videoUrl };
}

const LISTS = { t2i: t2iModels, i2i: i2iModels, i2v: i2vModels, t2v: t2vModels, v2v: v2vModels };

function inList(type, modelId) {
  return !!modelId && !!(LISTS[type] || []).find(m => m && m.id === modelId);
}

/**
 * Decide which MuAPI path a template generation should take and return a
 * model that actually belongs to that path — the same switching the Video
 * Studio does when you add or remove an image / video.
 *
 * @returns {{ route: 't2i'|'i2i'|'t2v'|'i2v'|'v2v', model: string }}
 */
export function routeTemplateGeneration({ outputType, modelType, model, imageUrl, videoUrl, pickedMode }) {
  // A mode picked in the model picker (e.g. an image-to-video variant) takes
  // the place of the template's own type; attached media still wins.
  const route = templateMediaRoute({ outputType, modelType: pickedMode || modelType, imageUrl, videoUrl, preferV2V: inList('v2v', model) });
  // Keep the user's model when it fits the route, else fall back to the
  // first model of that route.
  return { route, model: modelForRoute(route, model) };
}

/**
 * The route alone (no model resolution). Depends only on the template type
 * and the attached media, so clearing a video always leaves video-to-video.
 * @param {boolean} [preferV2V] when both an image and a video are attached,
 *   prefer video-to-video (the user picked a v2v model).
 */
export function templateMediaRoute({ outputType, modelType, imageUrl, videoUrl, preferV2V = false }) {
  const isVideo = outputType === 'video' || ['t2v', 'i2v', 'v2v'].includes(modelType);
  if (!isVideo) return imageUrl || modelType === 'i2i' ? 'i2i' : 't2i';
  // An image-to-video template keeps asking for its image when only a video
  // is attached (unless a video-to-video model was picked).
  if (modelType === 'i2v' && !imageUrl && !preferV2V) return 'i2v';
  if (videoUrl && (modelType === 'v2v' || preferV2V || !imageUrl)) return 'v2v';
  if (imageUrl || modelType === 'i2v') return 'i2v';
  // A v2v template with no video yet stays on v2v so Generate asks for the
  // source video instead of silently running text-to-video.
  if (modelType === 'v2v') return 'v2v';
  return 't2v';
}

/**
 * Attaching a source video to a template switches to video-to-video and the
 * route's default model, which may take no prompt (e.g. the watermark
 * remover). Running it would silently drop the template prompt, so it only
 * runs when the user picked that model themselves.
 * @returns {string|null} a message to show instead of generating, or null.
 */
export function promptlessV2VBlock(route, modelId, explicitPickId) {
  if (route !== 'v2v') return null;
  const m = findTemplateModel(modelId);
  if (!m || m.hasPrompt !== false || explicitPickId === modelId) return null;
  return `${m.name || modelId} doesn't use your prompt. Pick a video-to-video model in the model dropdown (or pick ${m.name || 'this model'} there to run it without the prompt).`;
}

/** Look a model up in every route list. */
export function findTemplateModel(modelId) {
  for (const list of Object.values(LISTS)) {
    const m = (list || []).find(x => x && x.id === modelId);
    if (m) return m;
  }
  return null;
}

/** Models offered for a route (the same lists the Video / Image Studio use). */
export function modelsForRoute(route) {
  return LISTS[route] || [];
}

// Preferred general-purpose defaults. The raw lists start with effect / tool
// models (AI Video Effects, Image Upscaler, …) that need extra inputs and
// would surprise someone who just attached an image.
const ROUTE_DEFAULTS = { i2v: 'kling-v2.6-pro-i2v', t2v: 'kling-v2.6-pro-t2v' };
const SPECIALIST_FAMILIES = new Set(['effects', 'tools']);

/** A sensible default model for a route (skips effect / tool models). */
export function defaultModelForRoute(route) {
  const list = LISTS[route] || [];
  if (ROUTE_DEFAULTS[route] && inList(route, ROUTE_DEFAULTS[route])) return ROUTE_DEFAULTS[route];
  // v2v keeps the Video Studio default (its first entry).
  if (route === 'v2v') return list[0]?.id || null;
  const general = list.find(m => m && !SPECIALIST_FAMILIES.has(m.family));
  return (general || list[0])?.id || null;
}

/** `model` when it belongs to `route`, else the route's default model. */
export function modelForRoute(route, model) {
  if (inList(route, model)) return model;
  // Same family, other mode (Kling t2v → Kling i2v), like the Video Studio.
  const family = modelFamilies?.videoModelPickerEntryByVariantId?.get?.(model) || modelFamilies?.imageModelPickerEntryByVariantId?.get?.(model);
  const sibling = family?.variantsByMode?.[route]?.model?.id;
  if (sibling && inList(route, sibling)) return sibling;
  return defaultModelForRoute(route) || model;
}

/**
 * Open the Video Studio / Image Studio model picker (upstream
 * Open-Generative-AI ModelDropdown) for a template studio.
 *
 * @param {Object} opts
 * @param {'video'|'image'} opts.kind
 * @param {HTMLElement} opts.anchor          The model button.
 * @param {string} opts.selectedModelId
 * @param {string} opts.currentMode          Mode used when picking from "All".
 * @param {(modelId: string, mode: string) => void} opts.onPick
 * @param {() => void} [opts.onClose]
 * @returns {Promise<{open: Function, close: Function}|null>}
 */
export async function openStudioModelPicker({ kind, anchor, selectedModelId, currentMode, onPick, onClose }) {
  const { mountUpstreamModelPicker } = await import('../components/upstream-picker/mountUpstreamModelPicker.jsx');
  const controller = mountUpstreamModelPicker({
    kind,
    anchor,
    selectedModelId,
    onSelect: (entry, catId) => {
      // Upstream rule (Video / Image Studio): a mode tab picks that mode's
      // variant; from "All", keep the current mode, else the family default.
      const variant = catId !== 'all'
        ? entry.variantsByMode[catId] || entry.defaultVariant
        : entry.variantsByMode[currentMode] || entry.defaultVariant;
      if (variant?.model?.id) onPick(variant.model.id, variant.mode || (catId !== 'all' ? catId : currentMode));
      controller.close();
    },
    onClose,
  });
  controller.open();
  return controller;
}

export const TEMPLATE_ROUTE_LABELS = {
  t2v: 'Text → Video',
  i2v: 'Image → Video',
  v2v: 'Video → Video',
  t2i: 'Text → Image',
  i2i: 'Image → Image',
};

/**
 * Apply extracted media to a params object using the MuAPI field names the
 * Video Studio sends (image_url, last_image_url, video_url).
 */
export function applyTemplateMediaToParams(params, { imageUrl, endImageUrl, videoUrl }, route) {
  // Drop raw frame objects copied straight from form state.
  Object.keys(params).forEach(key => {
    const v = params[key];
    if (v && typeof v === 'object' && !Array.isArray(v) && ('startUrl' in v || 'endUrl' in v)) delete params[key];
  });
  delete params.image_url;
  delete params.last_image_url;
  delete params.lastFrameUrl;
  delete params.last_frame_url;
  delete params.video_url;

  if (route === 'v2v') {
    if (videoUrl) params.video_url = videoUrl;
    // Video-to-video models such as face swap / motion control also take a
    // reference image (processV2V forwards only inputs the model declares).
    if (imageUrl) params.image_url = imageUrl;
  } else if (route === 'i2v' || route === 'i2i') {
    if (imageUrl) params.image_url = imageUrl;
    if (route === 'i2v' && endImageUrl) {
      const support = endFrameSupport(route, params.model);
      if (support === 'declared') {
        params.last_frame_url = endImageUrl;
        params.lastFrameUrl = endImageUrl;
      } else if (support === 'list') {
        // Keyframe models take [start, end] in images_list; generateI2V builds
        // that list from lastFrameUrl.
        params.lastFrameUrl = endImageUrl;
      } else if (support === 'unknown') {
        // No input schema for this model: keep the legacy keys.
        params.last_image_url = endImageUrl;
        params.lastFrameUrl = endImageUrl;
      }
      // 'none': the model has no end-frame input, so it is not sent
      // (callers can tell the user with endFrameSupport()).
    }
  }
  return params;
}

/**
 * Whether a model takes an end frame: 'declared' (its inputs list
 * last_frame_url), 'list' (a keyframe model: start and end both go in
 * images_list), 'none' (it has an input schema without one) or 'unknown'
 * (no schema to check).
 */
export function endFrameSupport(route, modelId) {
  const m = findRouteModel(route, modelId) || findTemplateModel(modelId);
  if (!m || !m.inputs) return 'unknown';
  if (Object.prototype.hasOwnProperty.call(m.inputs, 'last_frame_url')) return 'declared';
  if (m.imageField === 'images_list' && Object.prototype.hasOwnProperty.call(m.inputs, 'images_list')) return 'list';
  return 'none';
}

// ── Video settings (duration / resolution / native audio) ──────────────────

function findRouteModel(route, modelId) {
  return (LISTS[route] || []).find(m => m && m.id === modelId) || null;
}

/** Durations a model accepts (enum, or a min/max/step range), as numbers. */
export function durationsForModel(model) {
  const dur = model?.inputs?.duration;
  if (!dur) return [];
  if (Array.isArray(dur.enum)) return dur.enum.map(Number).filter(n => !Number.isNaN(n));
  const min = dur.minValue ?? dur.minimum;
  const max = dur.maxValue ?? dur.maximum;
  const step = dur.step || 1;
  if (min !== undefined && max !== undefined && max >= min && (max - min) / step <= 60) {
    const vals = [];
    for (let v = min; v <= max; v += step) vals.push(v);
    return vals;
  }
  return dur.default !== undefined ? [Number(dur.default)] : [];
}

/** Resolutions a model accepts. */
export function resolutionsForModel(model) {
  const res = model?.inputs?.resolution;
  return Array.isArray(res?.enum) ? res.enum.map(String) : [];
}

function nearest(options, wanted) {
  if (!options.length) return null;
  const w = Number(wanted);
  if (Number.isNaN(w)) return options[0];
  return options.reduce((best, o) => (Math.abs(o - w) < Math.abs(best - w) ? o : best), options[0]);
}

/**
 * Duration / resolution / native-audio controls that follow the selected
 * model, like the Video Studio prompt bar. Only options the model accepts
 * are offered; a template's own preference is snapped to the closest one.
 *
 * @param {Object} opts
 * @param {() => {route: string, model: string}} opts.getTarget  Current route + model.
 * @param {{duration?: any, resolution?: string, effect?: string}} [opts.preferred] Template
 *   defaults (`effect` = the template's preset, e.g. defaultParams.name).
 * @param {boolean} [opts.offerEffects=true] Show an effect preset select for
 *   effect models (set false when the template has its own `name` input).
 * @returns {{ element: HTMLElement, refresh: () => void, getSettings: () => object }}
 */
export function createVideoSettingsControls({ getTarget, preferred = {}, offerEffects = true } = {}) {
  const state = { duration: preferred.duration ?? null, resolution: preferred.resolution ?? null, nativeAudio: false, effect: preferred.effect ?? null };
  // The user's own effect pick, kept across model switches.
  let pickedEffect = null;
  const wantedDuration = Number(preferred.duration) || null;
  let current = { durations: [], resolutions: [], audio: false, video: false, effects: [] };

  const el = document.createElement('div');
  el.className = 'template-video-settings mt-4 flex flex-wrap items-center gap-2';
  el.dataset.videoSettings = '';

  const selectClass = 'h-9 rounded-full border border-white/10 bg-white/[0.03] px-3 text-xs font-semibold text-white outline-none focus:border-emerald-400/50';
  const makeSelect = (name, label) => {
    const wrap = document.createElement('label');
    wrap.className = 'flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500';
    wrap.textContent = label;
    const sel = document.createElement('select');
    sel.name = name;
    sel.className = selectClass;
    wrap.appendChild(sel);
    return { wrap, sel };
  };
  const dur = makeSelect('template-duration', 'Duration');
  const res = makeSelect('template-resolution', 'Resolution');
  const fx = makeSelect('template-effect', 'Effect');

  const audioBtn = document.createElement('button');
  audioBtn.type = 'button';
  audioBtn.name = 'template-native-audio';
  audioBtn.setAttribute('role', 'switch');
  audioBtn.className = 'h-9 rounded-full border px-3 text-[10px] font-semibold uppercase tracking-[0.18em] transition';
  const paintAudio = () => {
    audioBtn.setAttribute('aria-checked', String(state.nativeAudio));
    audioBtn.textContent = state.nativeAudio ? '♪ Native audio on' : '♪ Native audio off';
    audioBtn.classList.toggle('border-emerald-400/40', state.nativeAudio);
    audioBtn.classList.toggle('bg-emerald-500/15', state.nativeAudio);
    audioBtn.classList.toggle('text-emerald-200', state.nativeAudio);
    audioBtn.classList.toggle('border-white/10', !state.nativeAudio);
    audioBtn.classList.toggle('text-zinc-400', !state.nativeAudio);
  };
  audioBtn.onclick = (e) => {
    e.stopPropagation();
    state.nativeAudio = !state.nativeAudio;
    paintAudio();
  };

  dur.sel.onchange = () => { state.duration = Number(dur.sel.value); };
  res.sel.onchange = () => { state.resolution = res.sel.value; };
  fx.sel.onchange = () => { state.effect = fx.sel.value; pickedEffect = fx.sel.value; };

  // Explains when the template's suggested length is longer than the model
  // can make in one clip (the value is snapped to the longest it supports).
  const durHint = document.createElement('div');
  durHint.dataset.durationHint = '';
  durHint.className = 'hidden w-full text-[11px] text-amber-300/80';

  el.appendChild(fx.wrap);
  el.appendChild(dur.wrap);
  el.appendChild(res.wrap);
  el.appendChild(audioBtn);
  el.appendChild(durHint);

  const fill = (sel, options, value, fmt) => {
    sel.innerHTML = '';
    options.forEach(o => {
      const opt = document.createElement('option');
      opt.value = String(o);
      opt.textContent = fmt(o);
      if (String(o) === String(value)) opt.selected = true;
      sel.appendChild(opt);
    });
  };

  const refresh = () => {
    const { route, model } = (getTarget && getTarget()) || {};
    const video = route === 't2v' || route === 'i2v' || route === 'v2v';
    const m = video ? findRouteModel(route, model) : null;
    const durations = m && route !== 'v2v' ? durationsForModel(m) : [];
    const resolutions = m ? resolutionsForModel(m) : [];
    const audio = !!(m?.inputs?.native_audio) && route !== 'v2v';
    // Effect endpoints (AI Video Effects, Motion Controls) need a preset name.
    const effects = offerEffects && Array.isArray(m?.inputs?.name?.enum) ? m.inputs.name.enum.map(String) : [];
    if (effects.length) {
      // User pick, then the template's preset, then the first effect.
      if (pickedEffect && effects.includes(pickedEffect)) state.effect = pickedEffect;
      else if (preferred.effect && effects.includes(String(preferred.effect))) state.effect = String(preferred.effect);
      else if (!effects.includes(String(state.effect))) state.effect = effects[0];
    }

    if (durations.length) {
      if (!durations.some(d => String(d) === String(state.duration))) state.duration = nearest(durations, state.duration ?? m?.inputs?.duration?.default);
    }
    const maxDur = durations.length ? Math.max(...durations) : null;
    if (wantedDuration && maxDur && wantedDuration > maxDur) {
      durHint.textContent = `This template is designed for about ${wantedDuration}s; ${m?.name || 'this model'} makes clips of up to ${maxDur}s, so ${maxDur}s is used. Pick a longer-clip model in the dropdown or extend the result.`;
      durHint.classList.remove('hidden');
    } else {
      durHint.classList.add('hidden');
    }
    if (resolutions.length) {
      if (!resolutions.includes(String(state.resolution))) {
        const def = m?.inputs?.resolution?.default;
        state.resolution = resolutions.includes(String(def)) ? String(def) : resolutions[0];
      }
    }
    if (!audio) state.nativeAudio = false;

    fill(dur.sel, durations, state.duration, d => `${d}s`);
    fill(res.sel, resolutions, state.resolution, r => r);
    fill(fx.sel, effects, state.effect, e => e);
    fx.wrap.classList.toggle('hidden', !effects.length);
    dur.wrap.classList.toggle('hidden', !durations.length);
    res.wrap.classList.toggle('hidden', !resolutions.length);
    audioBtn.classList.toggle('hidden', !audio);
    paintAudio();
    el.classList.toggle('hidden', !durations.length && !resolutions.length && !audio && !effects.length);
    current = { durations, resolutions, audio, video, effects };
  };

  return {
    element: el,
    refresh,
    /** Only the settings the current model accepts. */
    getSettings: () => {
      const out = {};
      if (current.durations.length && state.duration != null) out.duration = Number(state.duration);
      if (current.resolutions.length && state.resolution) out.resolution = state.resolution;
      if (current.audio && state.nativeAudio) out.native_audio = true;
      if (current.effects.length && state.effect) out.name = state.effect;
      return out;
    },
  };
}

// ── Aspect ratio ────────────────────────────────────────────────────────────

function ratioValue(ar) {
  const [w, h] = String(ar).split(':').map(Number);
  return w > 0 && h > 0 ? w / h : null;
}

/**
 * `aspectRatio` when the model accepts it, else the closest ratio it does
 * accept, keeping the orientation (e.g. 4:3 → 16:9 for effect models). Unchanged when the
 * model publishes no aspect-ratio list.
 */
export function snapAspectRatioForModel(route, modelId, aspectRatio) {
  if (!aspectRatio) return aspectRatio;
  const allowed = findRouteModel(route, modelId)?.inputs?.aspect_ratio?.enum;
  if (!Array.isArray(allowed) || !allowed.length || allowed.includes(aspectRatio)) return aspectRatio;
  const want = ratioValue(aspectRatio);
  if (want == null) return allowed[0];
  // Keep the orientation (landscape / portrait / square) when possible, then
  // pick the closest ratio.
  const orient = (v) => (v > 1.01 ? 1 : v < 0.99 ? -1 : 0);
  const valued = allowed.map(ar => ({ ar, v: ratioValue(ar) })).filter(x => x.v != null);
  const sameOrient = valued.filter(x => orient(x.v) === orient(want));
  const pool = sameOrient.length ? sameOrient : valued;
  if (!pool.length) return allowed[0];
  return pool.reduce((best, x) => (Math.abs(Math.log(x.v / want)) < Math.abs(Math.log(best.v / want)) ? x : best), pool[0]).ar;
}

/**
 * Drop generation settings the selected model does not declare (e.g. Kling
 * v2.6 I2V has no aspect_ratio / resolution input), and ask generateI2V to do
 * the same for the defaults its validator adds. Models without an input
 * schema are left untouched.
 */
export function dropUndeclaredSettings(params, route) {
  const m = findRouteModel(route, params.model);
  params.onlyDeclaredInputs = true;
  if (!m || !m.inputs) return params;
  ['aspect_ratio', 'resolution', 'quality'].forEach((key) => {
    if (params[key] !== undefined && !Object.prototype.hasOwnProperty.call(m.inputs, key)) delete params[key];
  });
  return params;
}

/** True when the model takes an aspect ratio (or publishes no schema). */
export function modelTakesAspectRatio(route, modelId) {
  const m = findRouteModel(route, modelId);
  return !m || !m.inputs || Object.prototype.hasOwnProperty.call(m.inputs, 'aspect_ratio');
}
