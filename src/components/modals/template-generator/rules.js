/**
 * Template Generator wizard rules — a port of the original's
 * components/modals/TemplateGenerator/ModalContent.jsx (+ lib/constants/templateGenerator.js).
 *
 * Pure functions, no DOM: the modal calls these so the rules are testable and
 * identical to the original's behaviour.
 *
 *   Steps: Video → Script → Overlay → Preview
 *   - up to 5 videos;
 *   - Script needs ≥1 video; Overlay needs ≥2 videos and a script; Preview needs both;
 *   - with fewer than 2 videos, Next on Script skips Overlay and goes to Preview;
 *   - Next is disabled until the current step's requirement is met.
 */

export const STEPS = { VIDEO: 0, SCRIPT: 1, OVERLAY: 2, PREVIEW: 3 };
export const STEP_LABELS = ['Video', 'Script', 'Overlay', 'Preview'];
export const MAX_VIDEOS = 5;

export const MESSAGES = {
  needVideo: 'Please select at least one video',
  needTwoVideos: 'To use overlays, you need to select two or more videos',
  needScript: 'Please select a niche script',
  maxVideos: 'Select only 5 videos at a maximum. If you want to add more, you can do so later in the timeline.',
};

/** True when the user has chosen or written a script (a niche script card or their own text). */
export const hasScript = (s) => !!(s.selectedScript || (s.script?.text || '').trim());

/**
 * Same checks as the original's setActiveTab: returns the warning to show,
 * or null when moving to `target` is allowed.
 */
export function guardStep(s, target) {
  const videos = s.selectedVideos.length;
  switch (target) {
    case STEPS.SCRIPT:
      return videos ? null : MESSAGES.needVideo;
    case STEPS.OVERLAY:
      if (videos < 2) return MESSAGES.needTwoVideos;
      return hasScript(s) ? null : MESSAGES.needScript;
    case STEPS.PREVIEW:
      if (!videos) return MESSAGES.needVideo;
      return hasScript(s) ? null : MESSAGES.needScript;
    default:
      return null;
  }
}

/** Where the Next button goes from `step` (skips Overlay when there's only one video). */
export function nextStepIndex(s, step) {
  if (step === STEPS.SCRIPT && s.selectedVideos.length < 2) return STEPS.PREVIEW;
  return step + 1;
}

/** Whether the Next / Add to Timeline button is disabled on `step`. */
export function nextDisabled(s, step, busy = false) {
  if (busy) return true;
  switch (step) {
    case STEPS.VIDEO: return !s.selectedVideos.length;
    case STEPS.SCRIPT: return !hasScript(s);
    default: return !s.selectedVideos.length || !hasScript(s);
  }
}

export const nextLabel = (step) => (step === STEPS.PREVIEW ? 'Add to Timeline' : 'Next');

/**
 * Toggle a video in/out of the selection (max 5). Mutates `s.selectedVideos`.
 * @returns {{ok: boolean, selected: boolean, message?: string}}
 */
export function toggleVideo(s, item) {
  const i = s.selectedVideos.findIndex((v) => v.id === item.id);
  if (i >= 0) {
    s.selectedVideos.splice(i, 1);
    return { ok: true, selected: false };
  }
  if (s.selectedVideos.length >= MAX_VIDEOS) return { ok: false, selected: false, message: MESSAGES.maxVideos };
  s.selectedVideos.push(item);
  return { ok: true, selected: true };
}

export function createWizardState() {
  return {
    started: false,
    step: STEPS.VIDEO,
    selectedVideos: [],          // up to MAX_VIDEOS stock/upload/remote/AI items
    selectedScript: null,        // a niche script card (a niche template)
    script: { text: '', tone: 'conversational', audience: 'general', cta: '' },
    selectedTransition: null,    // { type, duration } from the editor's transitions library
    // Text elements the timeline can create today (applyTemplate makes media + text/caption clips).
    elements: { captions: true, title: '', lowerThird: '', cta: '' },
    voice: { enabled: false, provider: 'openai', voice: 'alloy', text: '', instructions: '' },
    personalization: { enabled: false, contactId: null, tokens: {} },
  };
}

const CLIP_SECONDS = { video: 8, image: 5 };

/** How long a picked item stays on screen: videos use their length (capped), images a fixed time. */
export function clipDuration(item) {
  if (item.kind === 'video') {
    const d = Number(item.duration);
    return d > 0 ? Math.min(d, CLIP_SECONDS.video) : CLIP_SECONDS.video;
  }
  return CLIP_SECONDS.image;
}

/** Item → the media-asset shape templateCompositionBuilder expects (credit travels with it). */
export function toMediaAsset(item) {
  return {
    id: item.id,
    type: item.kind === 'image' ? 'image' : 'video',
    name: item.title || item.id,
    url: item.url,
    duration: clipDuration(item),
    thumbnail: item.poster || item.preview || item.url,
    source: item.source,
    provider: item.source,
    credit: item.user || item.pageURL ? { user: item.user || '', pageURL: item.pageURL || '' } : undefined,
  };
}

/** Scene names: the niche script's own scenes, padded so every selected video has a scene. */
export function sceneNames(s) {
  const base = s.selectedScript?.sceneStructure || [];
  const n = Math.max(base.length, s.selectedVideos.length);
  return Array.from({ length: n }, (_, i) => base[i] || `Scene ${i + 1}`);
}

/** Split script text into one caption line per scene (kept simple: sentences/lines, grouped to fit). */
export function scriptLines(text, sceneCount) {
  const parts = String(text || '').split(/\n+|(?<=[.!?])\s+/).map((t) => t.trim()).filter(Boolean);
  if (!parts.length || sceneCount < 1) return [];
  if (parts.length <= sceneCount) return parts;
  const per = Math.ceil(parts.length / sceneCount);
  const out = [];
  for (let i = 0; i < parts.length; i += per) out.push(parts.slice(i, i + per).join(' '));
  return out;
}

/**
 * Wizard state → the `state` shape of buildCompositionFromState():
 * videos become the per-scene media; the script becomes captions timed per scene;
 * the picked transition is applied between consecutive clips; elements/voice carry over.
 */
export function toBuilderState(s) {
  const names = sceneNames(s);
  const mediaByScene = names.map((sceneName, i) => {
    const item = s.selectedVideos[i];
    return item
      ? { sceneName, sceneIndex: i, media: toMediaAsset(item), mediaType: item.kind === 'image' ? 'image' : 'video', status: 'ready' }
      : { sceneName, sceneIndex: i, media: null, mediaType: 'video', status: 'empty' };
  });

  // Captions: one script line per filled scene, spanning that scene.
  const filled = mediaByScene.filter((m) => m.status === 'ready');
  const lines = scriptLines(s.script.text, filled.length);
  let cursor = 0;
  const captions = [];
  filled.forEach((m, i) => {
    const duration = m.media.duration;
    if (lines[i]) {
      captions.push({
        kind: 'caption', type: 'caption', trackName: 'Script', name: `Script ${i + 1}`,
        text: lines[i], startTime: cursor, duration,
      });
    }
    cursor += duration;
  });

  const transitions = s.selectedTransition && filled.length > 1
    ? [{ type: s.selectedTransition.type, duration: s.selectedTransition.duration || 1 }]
    : [];

  // Text elements. Captions come from the script; the rest are plain text clips.
  const total = Math.max(cursor, 3);
  const text = (name, trackName, value, startTime, duration) => value.trim() && ({
    kind: 'text', type: 'text', trackName, name, text: value.trim(), startTime, duration: Math.min(duration, total),
  });
  const elements = [
    text('Title', 'Title', s.elements.title, 0, 3),
    text('Lower third', 'Lower Third', s.elements.lowerThird, Math.min(1, total - 1), 4),
    text('Call to action', 'CTA', s.elements.cta || s.script.cta, Math.max(total - 4, 0), 4),
  ].filter(Boolean);
  const captionClips = s.elements.captions ? captions : [];

  return {
    niche: s.selectedScript?.niche || null,
    script: { text: s.script.text, tone: s.script.tone, audience: s.script.audience, cta: s.script.cta },
    template: null,
    media: [],
    mediaByScene,
    transitions,
    overlays: [...captionClips, ...elements],
    voice: { ...s.voice, text: s.voice.text || s.script.text },
    personalization: s.personalization,
  };
}
