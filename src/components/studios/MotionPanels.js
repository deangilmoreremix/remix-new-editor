// Recast and Motion Control panels, ported from upstream Open-Generative-AI's
// RecastStudio.jsx / MotionControlStudio.jsx: upload a motion video plus
// character image(s), pick a model and options, generate. Results are kept in
// localStorage per panel.

import { muapi } from '../../lib/muapi.js';
import { apiKeyManager } from '../../lib/apiKeyManager.js';
import { requireEntitlement } from '../../lib/clerkEntitlements.js';
import { AuthModal } from '../AuthModal.js';
import { showToast } from '../../lib/loading.js';
import { recastModels, motionControlModels, getRecastModelById, getMotionControlModelById } from '../../lib/motionModels.js';
import { createPromptComposer, createPill, createSegmented, openComposerPopover, ICONS } from '../studio/promptComposer.js';
import { createResultsGallery } from '../studio/resultsGallery.js';
import { createEmptyState } from '../studio/emptyState.js';
import { createMediaSlot } from '../studio/mediaSlot.js';
import { notifyGeneration } from '../studio/generationNotifications.js';

const ICON_VIDEO = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>';
const ICON_IMAGE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';

/** Pure payload builder — exported for tests. */
export function buildMotionParams(kind, state, prompt) {
  if (kind === 'recast') {
    return {
      model: state.modelId,
      video_url: state.videoUrl,
      image_url: state.imageUrls[0],
      prompt,
      aspect_ratio: state.aspectRatio || undefined,
      character_orientation: state.orientation,
    };
  }
  return {
    model: state.modelId,
    mode: state.mode,
    video_url: state.videoUrl,
    images_list: state.imageUrls,
    prompt,
    aspect_ratio: state.aspectRatio,
    duration: state.duration,
    quality: state.quality,
    high_bitrate: state.highBitrate,
    generate_audio: state.audio,
    seed: state.seed,
  };
}

export function createMotionPanel(kind) {
  const isRecast = kind === 'recast';
  const models = isRecast ? recastModels : motionControlModels;
  const label = isRecast ? 'Recast' : 'Motion Control';
  const key = isRecast ? 'recast_history' : 'motion_control_history';
  const getModel = (id) => (isRecast ? getRecastModelById(id) : getMotionControlModelById(id));

  const state = {
    modelId: models[0].id,
    videoUrl: null,
    imageUrls: [],
    aspectRatio: isRecast ? '' : models[0].defaultAspectRatio,
    duration: isRecast ? 0 : models[0].defaultDuration,
    quality: 'high',
    highBitrate: false,
    audio: false,
    seed: -1,
    mode: 'motion_transfer',
    orientation: 'video',
  };
  let history = [];
  try { history = JSON.parse(localStorage.getItem(key) || '[]') || []; } catch { /* ignore */ }
  let generating = false;
  const persist = () => { try { localStorage.setItem(key, JSON.stringify(history.slice(0, 30))); } catch { /* ignore */ } };

  const root = document.createElement('div');
  root.className = 'w-full flex flex-col items-center relative pb-4';
  root.dataset.motionPanel = kind;

  const emptyState = createEmptyState({
    heading: 'Start creating with',
    highlight: `Video Tools · ${label}`,
    subtitle: isRecast
      ? 'Drive a character image with the motion from any video.'
      : 'Rebuild a performance video with new characters and assets while keeping its motion.',
    samples: [],
  });
  const gallery = createResultsGallery({
    kind: 'video',
    historyType: 'video',
    filenamePrefix: kind,
    onDelete: (item) => { history = history.filter((h) => h.id !== item.id); persist(); },
  });
  const area = document.createElement('div');
  area.className = 'w-full flex flex-col items-center pb-6';
  area.append(emptyState, gallery.root);

  const composer = createPromptComposer({
    placeholder: isRecast ? 'Optional: describe the performance (supported models only)' : 'Optional: describe tweaks to the rebuilt scene',
    onSubmit: () => run(),
    positionClass: 'sticky bottom-4 z-30 w-full max-w-[95%] lg:max-w-4xl mx-auto animate-fade-in-up',
  });

  async function upload(files, slot, apply) {
    slot.setProgress(1);
    try {
      const urls = [];
      for (const file of files) {
        const url = await muapi.uploadFile(file, { onProgress: (p) => slot.setProgress(Math.min(99, p)) });
        if (url) urls.push(url);
      }
      apply(urls);
    } catch (err) {
      showToast(`Upload failed: ${err.message || 'try again'}`, 'error', 5000);
    } finally {
      slot.setProgress(100);
    }
  }

  const videoSlot = createMediaSlot({
    icon: ICON_VIDEO,
    title: 'Motion video',
    accept: 'video/*',
    onFiles: (files) => upload(files, videoSlot, ([url]) => { state.videoUrl = url; videoSlot.setPreview(url); }),
    onClear: () => { state.videoUrl = null; },
  });
  const imageSlot = createMediaSlot({
    icon: ICON_IMAGE,
    title: isRecast ? 'Character image' : 'Character images',
    multiple: !isRecast,
    onFiles: (files) => upload(files, imageSlot, (urls) => {
      state.imageUrls = isRecast ? urls.slice(0, 1) : [...state.imageUrls, ...urls].slice(0, getModel(state.modelId).maxImages || 30);
      imageSlot.setPreview(state.imageUrls);
    }),
    onClear: () => { state.imageUrls = []; },
  });
  composer.mediaRow.append(videoSlot.el, imageSlot.el);

  const modelPill = createPill({ label: getModel(state.modelId).name, title: 'Model' });
  const arPill = createPill({ label: state.aspectRatio || 'Aspect', icon: 'aspect', title: 'Aspect ratio' });
  const durPill = createPill({ label: `${state.duration}s`, icon: 'duration', title: 'Duration' });
  const qualityPill = createPill({ label: 'High', icon: 'quality', title: 'Quality' });
  const bitratePill = createPill({ label: 'Bitrate: normal', title: 'High bitrate' });
  const audioPill = createPill({ label: 'Audio: off', title: 'Generate audio' });
  const orientPill = createPill({ label: 'Orientation: video', title: 'Character orientation' });
  const modeToggle = createSegmented(
    [{ value: 'motion_transfer', label: 'Motion transfer' }, { value: 'objects_swap', label: 'Objects swap' }],
    state.mode,
    (v) => { state.mode = v; },
  );

  function ratiosFor(model) { return model.aspectRatios || []; }

  function syncControls() {
    const model = getModel(state.modelId);
    modelPill.setLabel(model.name);
    const ratios = ratiosFor(model);
    if (ratios.length && !ratios.includes(state.aspectRatio)) state.aspectRatio = model.defaultAspectRatio || ratios[0];
    if (!ratios.length) state.aspectRatio = '';
    arPill.classList.toggle('hidden', !ratios.length);
    arPill.setLabel(state.aspectRatio || 'Aspect');
    if (!isRecast) {
      state.duration = Math.min(model.maxDuration, Math.max(model.minDuration, state.duration));
      durPill.setLabel(`${state.duration}s`);
      qualityPill.classList.toggle('hidden', !model.supportsQuality);
      bitratePill.classList.toggle('hidden', !model.supportsBitrate);
      audioPill.classList.toggle('hidden', !model.supportsAudio);
      if (state.imageUrls.length > model.maxImages) { state.imageUrls = state.imageUrls.slice(0, model.maxImages); imageSlot.setPreview(state.imageUrls); }
    } else {
      composer.textarea.disabled = !model.hasPrompt;
      composer.textarea.placeholder = model.hasPrompt ? 'Optional: describe the performance' : 'This model does not take a prompt';
    }
  }

  modelPill.addEventListener('click', () => openComposerPopover(modelPill, {
    title: `${label} model`,
    items: models.map((m) => ({ label: m.name, description: m.description, selected: m.id === state.modelId, onSelect: () => { state.modelId = m.id; syncControls(); } })),
  }));
  arPill.addEventListener('click', () => openComposerPopover(arPill, {
    title: 'Aspect Ratio',
    items: ratiosFor(getModel(state.modelId)).map((r) => ({ label: r, selected: r === state.aspectRatio, onSelect: () => { state.aspectRatio = r; arPill.setLabel(r); } })),
  }));
  durPill.addEventListener('click', () => {
    const m = getModel(state.modelId);
    const options = [];
    for (let d = m.minDuration; d <= m.maxDuration; d += d < 10 ? 1 : 5) options.push(d);
    openComposerPopover(durPill, { title: 'Duration', items: options.map((d) => ({ label: `${d}s`, selected: d === state.duration, onSelect: () => { state.duration = d; durPill.setLabel(`${d}s`); } })) });
  });
  qualityPill.addEventListener('click', () => openComposerPopover(qualityPill, {
    title: 'Quality',
    items: ['high', 'basic'].map((q) => ({ label: q === 'high' ? 'High' : 'Basic', selected: q === state.quality, onSelect: () => { state.quality = q; qualityPill.setLabel(q === 'high' ? 'High' : 'Basic'); } })),
  }));
  bitratePill.addEventListener('click', () => { state.highBitrate = !state.highBitrate; bitratePill.setLabel(`Bitrate: ${state.highBitrate ? 'high' : 'normal'}`); bitratePill.setActive(state.highBitrate); });
  audioPill.addEventListener('click', () => { state.audio = !state.audio; audioPill.setLabel(`Audio: ${state.audio ? 'on' : 'off'}`); audioPill.setActive(state.audio); });
  orientPill.addEventListener('click', () => openComposerPopover(orientPill, {
    title: 'Character orientation',
    items: ['video', 'image'].map((o) => ({ label: o === 'video' ? 'Follow the video' : 'Follow the image', selected: o === state.orientation, onSelect: () => { state.orientation = o; orientPill.setLabel(`Orientation: ${o}`); } })),
  }));

  composer.controls.append(...(isRecast ? [modelPill, arPill, orientPill] : [modeToggle, modelPill, arPill, durPill, qualityPill, bitratePill, audioPill]));
  root.append(area, composer.root);

  function syncGallery() {
    gallery.setItems(history.map((h) => ({ id: h.id, url: h.url, prompt: h.prompt, model: h.model, aspect_ratio: h.aspectRatio || '' })));
    emptyState.classList.toggle('hidden', history.length > 0 || generating);
  }

  async function run() {
    if (generating) return;
    composer.clearError();
    if (!state.videoUrl) { composer.showError('Please upload a motion video first.'); return; }
    if (!state.imageUrls.length) { composer.showError(isRecast ? 'Please upload a character image first.' : 'Please add at least one character image.'); return; }
    if (!(await requireEntitlement())) return;
    if (!apiKeyManager.getMuapiKey()) { AuthModal(() => run()); return; }

    generating = true;
    composer.setGenerating(true);
    emptyState.classList.add('hidden');
    const pending = gallery.addPending(`${label}…`);
    const notifyId = `${kind}:${Date.now()}`;
    notifyGeneration({ phase: 'start', id: notifyId, studio: 'videotools', label: `Video Tools · ${label}` });
    let failed = null;
    try {
      const prompt = composer.getPrompt();
      const params = buildMotionParams(kind, state, prompt);
      const result = isRecast ? await muapi.processRecast(params) : await muapi.processMotionControl(params);
      const url = result?.url || result?.outputs?.[0];
      if (!url) throw new Error('No video URL returned by API');
      history = [{
        id: result?.request_id || String(Date.now()), url, prompt, model: getModel(state.modelId).name,
        aspectRatio: state.aspectRatio, timestamp: new Date().toISOString(),
      }, ...history].slice(0, 30);
      persist();
    } catch (err) {
      failed = err?.message || `${label} generation failed`;
      showToast(failed, 'error', 5000);
    } finally {
      generating = false;
      pending.remove();
      notifyGeneration(failed
        ? { phase: 'error', id: notifyId, studio: 'videotools', label: `Video Tools · ${label}`, message: failed }
        : { phase: 'success', id: notifyId, studio: 'videotools', label: `Video Tools · ${label}` });
      composer.setGenerating(false);
      composer.action.innerHTML = `Generate ${ICONS.sparkle}`;
      if (failed) composer.setRetry();
      syncGallery();
    }
  }

  composer.action.innerHTML = `Generate ${ICONS.sparkle}`;
  syncControls();
  syncGallery();
  return root;
}
