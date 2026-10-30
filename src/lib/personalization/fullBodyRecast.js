/**
 * Full Body Recast for the personalization image editor.
 *
 * Mirrors the open-genjutsu flow (github.com/deangilmoreremix/open-genjutsu):
 * a 4–30 second source performance clip plus a character reference image are
 * sent as one MuAPI motion-control request. The model keeps the source
 * movement and location and replaces the performer with the character.
 *
 * Source media goes through the existing studio upload pipeline and the
 * request through the canonical MuAPI client (Supabase muapi-proxy), so no
 * API key is handled in the browser.
 */

import { muapi } from '../muapi.js';
import { ingestStudioUpload } from '../muapiStudioMedia.js';
import { FULL_BODY_MODEL } from '../../components/personalize/modelCapabilityResolver.js';
import { persistPersonalizationAssetVersion } from './assetDiscoveryService.js';

export const RECAST_MIN_SECONDS = 4;
export const RECAST_MAX_SECONDS = 30;
export const RECAST_MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const RECAST_VIDEO_TYPES = Object.freeze(['video/mp4', 'video/quicktime']);
const RECAST_VIDEO_EXTENSIONS = /\.(mp4|mov)$/i;

export function clampRecastDuration(seconds) {
  const value = Math.round(Number(seconds) || 0);
  return Math.max(RECAST_MIN_SECONDS, Math.min(RECAST_MAX_SECONDS, value || RECAST_MIN_SECONDS));
}

/**
 * Validate the file's type and size. Duration is checked separately once the
 * browser has read the clip's metadata.
 */
export function validateRecastSourceFile(file) {
  if (!file) return 'Choose a source performance clip.';
  const type = String(file.type || '').toLowerCase();
  const typeOk = RECAST_VIDEO_TYPES.includes(type) || (!type && RECAST_VIDEO_EXTENSIONS.test(file.name || ''));
  if (!typeOk) return 'Use an MP4 or MOV source clip.';
  if (!file.size) return 'The selected clip is empty.';
  if (file.size > RECAST_MAX_VIDEO_BYTES) return 'The source clip is over the 50 MB limit.';
  return '';
}

export function validateRecastDuration(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return 'Could not read the clip length.';
  if (value < RECAST_MIN_SECONDS) return `The source clip must be at least ${RECAST_MIN_SECONDS} seconds.`;
  if (value > RECAST_MAX_SECONDS + 0.5) return `The source clip must be ${RECAST_MAX_SECONDS} seconds or shorter.`;
  return '';
}

export function readVideoDuration(url) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => {
      const { duration } = video;
      video.removeAttribute('src');
      video.load();
      resolve(duration);
    };
    video.onerror = () => reject(new Error('This clip could not be read. Try an MP4 (H.264) file.'));
    video.src = url;
  });
}

/** Upload the source clip so MuAPI can fetch it. Returns an https URL. */
export async function uploadRecastSource(file) {
  const stored = await ingestStudioUpload(file);
  const url = stored?.muapiUrl || stored?.url;
  if (!url) throw new Error('The source clip uploaded but no usable URL was returned.');
  return url;
}

/**
 * The character image must be a fetchable URL. Edited versions can still be
 * data URLs, so those are stored durably first.
 */
export async function resolveRecastCharacterUrl(imageUrl, { role, name } = {}) {
  if (!imageUrl) throw new Error('A character image is required.');
  if (!imageUrl.startsWith('data:')) return imageUrl;
  const stored = await persistPersonalizationAssetVersion({
    sourceUrl: imageUrl,
    role: role || 'presenter_identity',
    name: name ? `${name} — Recast Character` : 'Recast Character',
  });
  return stored.url;
}

export async function runFullBodyRecast({
  sourceUrl,
  characterUrl,
  duration,
  prompt = '',
  signal,
} = {}) {
  if (!sourceUrl) throw new Error('Upload a source performance clip first.');
  if (!characterUrl) throw new Error('A character image is required.');

  const result = await muapi.processV2V({
    model: FULL_BODY_MODEL,
    video_url: sourceUrl,
    images_list: [characterUrl],
    aspect_ratio: 'adaptive',
    duration: clampRecastDuration(duration),
    generate_audio: false,
    prompt: String(prompt || '').trim() || undefined,
    studioType: 'personalize-recast',
  }, signal);

  const url = result?.url || result?.outputs?.[0] || result?.output?.url;
  if (!url) throw new Error('The recast finished but returned no video.');
  return { url, model: FULL_BODY_MODEL };
}

/**
 * Keep a durable copy of the recast result in the user's storage. If the
 * browser cannot fetch the provider URL (CORS), fall back to that URL.
 */
export async function persistRecastVideo(resultUrl, { name = 'Full Body Recast' } = {}) {
  try {
    const response = await fetch(resultUrl);
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    const blob = await response.blob();
    const safeName = `${String(name).replace(/[^\w.-]+/g, '-').slice(0, 60) || 'recast'}.mp4`;
    const file = new File([blob], safeName, { type: blob.type || 'video/mp4' });
    const { uploadFileToStorage } = await import('../hybrid-supabase.js');
    const url = await uploadFileToStorage(file);
    if (url) return { url, durable: true };
  } catch {
    // Fall through to the provider URL.
  }
  return { url: resultUrl, durable: false };
}
