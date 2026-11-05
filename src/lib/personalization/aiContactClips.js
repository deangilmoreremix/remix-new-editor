// src/lib/personalization/aiContactClips.js
//
// AI video clip per contact: a video clip on the timeline can be generated
// once per contact from one of their images (opening frame, product, brand)
// and a prompt with {{tokens}}. Each contact's version is stored on the clip
// (clip.aiPerContact.variants[contactId]) and played for that contact in the
// editor preview, exports and personal share links — the same way
// personalized Smart Speech voice lines work.
//
// Photos of people are not offered as a source: animating someone's face
// from a photo found online isn't something to do without their consent.
//
// Pure: planning, prompts and which clip each contact sees. The editor does
// the generation calls.

import { resolveToken } from '../../components/personalize/tokenSchema.js';
import { resolveOverlayText } from '../editor/addons/overlayRender.js';

export const CLIP_IMAGE_SLOTS = Object.freeze([
  { key: 'firstFrameUrl', label: 'Opening frame' },
  { key: 'productImageUrl', label: 'Product image' },
  { key: 'brandImageUrl', label: 'Brand image' },
  { key: 'lastFrameUrl', label: 'Closing frame' },
]);

// Image-to-video models from the MuAPI catalog (src/lib/models.js i2vModels).
export const AI_CLIP_MODELS = Object.freeze([
  { id: 'kling-v2.5-turbo-pro-i2v', label: 'Kling 2.5 Turbo Pro' },
  { id: 'seedance-pro-i2v-fast', label: 'Seedance Pro (fast)' },
  { id: 'veo3.1-fast-image-to-video', label: 'Veo 3.1 Fast' },
  { id: 'wan2.5-image-to-video-fast', label: 'Wan 2.5 (fast)' },
  { id: 'ltx-2-fast-image-to-video', label: 'LTX-2 Fast' },
]);

export const DEFAULT_AI_CLIP = Object.freeze({
  prompt: 'Slow cinematic camera push-in on {{d businessName "the business"}}, natural light, subtle motion',
  imageKey: 'firstFrameUrl',
  model: AI_CLIP_MODELS[0].id,
  duration: 5,
  aspectRatio: '16:9',
});

/** The clip's per-contact settings, with defaults filled in. */
export function aiClipConfig(clip) {
  const cfg = clip?.aiPerContact || {};
  return {
    ...DEFAULT_AI_CLIP,
    ...cfg,
    model: AI_CLIP_MODELS.some((m) => m.id === cfg.model) ? cfg.model : DEFAULT_AI_CLIP.model,
    imageKey: CLIP_IMAGE_SLOTS.some((s) => s.key === cfg.imageKey) ? cfg.imageKey : DEFAULT_AI_CLIP.imageKey,
    duration: [5, 10].includes(Number(cfg.duration)) ? Number(cfg.duration) : DEFAULT_AI_CLIP.duration,
    variants: cfg.variants && typeof cfg.variants === 'object' ? cfg.variants : {},
  };
}

const nameOf = (p) => String(p?.name || p?.contact?.name || p?.personalization?.business?.businessName || p?.id || 'Contact').trim();

/** The prompt for one contact, or null when one of its tokens has no value. */
export function clipPromptFor(prompt, profile) {
  const out = resolveOverlayText(String(prompt || ''), profile).replace(/\s+/g, ' ').trim();
  if (!out || /\{\{[^}]*\}\}/.test(out)) return null;
  return out.slice(0, 1000);
}

/**
 * One job per contact that can get a clip.
 * @param {object} cfg  aiClipConfig(clip)
 * @param {object[]} contacts
 * @param {{ redo?: boolean }} opts  redo: also contacts that already have one
 * @returns {{ jobs: Array<{contactId, contactName, imageUrl, prompt}>, skipped: Array<{contactName, reason}> }}
 */
export function planClipJobs(cfg, contacts = [], { redo = false } = {}) {
  const jobs = [];
  const skipped = [];
  const slot = CLIP_IMAGE_SLOTS.find((s) => s.key === cfg.imageKey);
  contacts.forEach((profile) => {
    if (!redo && cfg.variants?.[String(profile.id)]?.url) return;
    const imageUrl = resolveToken(profile, cfg.imageKey);
    if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
      skipped.push({ contactName: nameOf(profile), reason: `no ${String(slot?.label || 'image').toLowerCase()}` });
      return;
    }
    const prompt = clipPromptFor(cfg.prompt, profile);
    if (!prompt) {
      skipped.push({ contactName: nameOf(profile), reason: 'a detail in the prompt is missing' });
      return;
    }
    jobs.push({ contactId: String(profile.id), contactName: nameOf(profile), imageUrl, prompt });
  });
  return { jobs, skipped };
}

/** The video a clip plays for a contact (their AI version, else the clip's own). */
export function clipSrcFor(clip, profile) {
  const v = profile?.id != null ? clip?.aiPerContact?.variants?.[String(profile.id)] : null;
  return v?.url || clip?.src || '';
}

/** Video clips set up for per-contact AI versions. */
export function aiClipsInProject(project) {
  const tracks = Array.isArray(project?.tracks) ? project.tracks : [];
  return tracks.flatMap((t) => t?.items || t?.clips || []).filter((c) => c?.type === 'video' && c.aiPerContact);
}

/** Export warning: contacts who'd see the original clip instead of theirs. */
export function describeClipGaps(project, contacts = []) {
  const out = [];
  aiClipsInProject(project).forEach((clip) => {
    const missing = contacts.filter((p) => !clip.aiPerContact?.variants?.[String(p.id)]?.url).map(nameOf);
    if (!missing.length) return;
    const shown = missing.slice(0, 3).join(', ');
    const more = missing.length > 3 ? ` and ${missing.length - 3} more` : '';
    out.push(`${missing.length} contact${missing.length === 1 ? " doesn't" : "s don't"} have their own version of "${clip.name || 'AI clip'}" yet (${shown}${more}), so ${missing.length === 1 ? 'they see' : 'they see'} the original clip. Generate them in the clip's settings.`);
  });
  return out;
}
