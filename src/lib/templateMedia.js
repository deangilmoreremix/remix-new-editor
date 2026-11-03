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

const PEXELS_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-secondary group-hover:text-primary"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>';
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
 * @returns {{ element: HTMLElement, clear: () => void, getValue: () => any }}
 */
export function createTemplateMediaField({ kind = 'image', anchorContainer, studioName = 'Template Studio', onChange, title, initialValue = null } = {}) {
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

  const setStatus = (text, tone = 'idle') => {
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
          picker.reset();
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
  row.appendChild(status);
  row.appendChild(clearBtn);
  if (value) {
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
      if (!imageUrl) imageUrl = val.startUrl || val.url || (Array.isArray(val.urls) ? val.urls[0] : null) || null;
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
export function routeTemplateGeneration({ outputType, modelType, model, imageUrl, videoUrl }) {
  const isVideo = outputType === 'video' || ['t2v', 'i2v', 'v2v'].includes(modelType);
  let route;
  if (isVideo) {
    const wantsV2V = modelType === 'v2v' || inList('v2v', model);
    if (videoUrl && (wantsV2V || !imageUrl)) route = 'v2v';
    else if (imageUrl || modelType === 'i2v') route = 'i2v';
    // A v2v template / model with no video yet stays on v2v so Generate
    // asks for the source video instead of silently running text-to-video.
    else if (wantsV2V) route = 'v2v';
    else route = 't2v';
  } else {
    route = imageUrl || modelType === 'i2i' ? 'i2i' : 't2i';
  }

  // Effect-style i2v models can be used without an image only when the
  // template explicitly asks for them; otherwise keep the user's model when
  // it fits the route, else fall back to the first model of that route.
  const fits = inList(route, model);
  const fallback = (LISTS[route] || [])[0]?.id || model;
  return { route, model: fits ? model : fallback };
}

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
  delete params.video_url;

  if (route === 'v2v') {
    if (videoUrl) params.video_url = videoUrl;
  } else if (route === 'i2v' || route === 'i2i') {
    if (imageUrl) params.image_url = imageUrl;
    if (route === 'i2v' && endImageUrl) {
      params.last_image_url = endImageUrl;
      params.lastFrameUrl = endImageUrl;
    }
  }
  return params;
}
