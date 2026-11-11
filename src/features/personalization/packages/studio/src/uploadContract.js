/**
 * uploadContract.js — THE single authoritative upload contract.
 *
 * This module is deliberately plain JavaScript with no TypeScript syntax so it
 * can be consumed from three places without duplication:
 *
 *   1. `packages/studio/src/*` (this package) — Babel builds it with only
 *      preset-env + preset-react, so a `.ts` import here would break the
 *      standalone package build.
 *   2. The host app's typed code via `src/lib/uploadConfig.ts`, which re-exports
 *      everything below (so `@/lib/uploadConfig` remains the typed entry point).
 *   3. The upload route `app/api/v1/upload_file/route.ts`, which historically
 *      re-declared its own copy and drifted.
 *
 * RULE: never hardcode an upload size or MIME type anywhere else. Import it.
 *
 * Mirrors the MuAPI File Upload API (https://muapi.ai/docs/file-upload):
 *   Images  10MB  .jpg .png .webp
 *   Videos  50MB  .mp4 .mov
 *   Others  10MB  .zip .pdf .json
 */

const KB = 1024;
const MB = 1024 * 1024;

export const UPLOAD_LIMITS = {
  image: 10 * MB,
  video: 50 * MB,
  audio: 10 * MB,
  other: 10 * MB,
};

export const UPLOAD_MIME_TYPES = {
  image: new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']),
  // .mov (video/quicktime) is documented by the spec and is the most common
  // iPhone-recorded format, so it must not be rejected.
  video: new Set(['video/mp4', 'video/webm', 'video/quicktime']),
  audio: new Set(['audio/mpeg', 'audio/wav', 'audio/webm']),
  // Documented "Others" category.
  other: new Set(['application/zip', 'application/pdf', 'application/json']),
};

/** Legacy alias kept so older call sites keep working. */
export const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  ...UPLOAD_MIME_TYPES.image,
  ...UPLOAD_MIME_TYPES.video,
  ...UPLOAD_MIME_TYPES.audio,
  ...UPLOAD_MIME_TYPES.other,
]);

export function normalizeImageMimeType(mime) {
  return mime === 'image/jpg' ? 'image/jpeg' : mime;
}

export function getUploadLimit(file) {
  if (!file) return UPLOAD_LIMITS.other;
  if (typeof file.type !== 'string' || file.type === '') return UPLOAD_LIMITS.other;
  if (file.type.startsWith('video/')) return UPLOAD_LIMITS.video;
  if (file.type.startsWith('audio/')) return UPLOAD_LIMITS.audio;
  return UPLOAD_LIMITS.other;
}

/**
 * Whether a file's MIME type is allowed.
 *
 * With no `category`, returns true for anything the MuAPI spec supports.
 * Pass a category to restrict a media-specific caller: an image-only upload
 * path must keep rejecting a PDF even though MuAPI would accept it, so its own
 * contract stays intact.
 */
export function isAllowedUploadMimeType(file, category) {
  const type = file && typeof file.type === 'string' ? file.type : '';

  if (category === 'image') {
    return UPLOAD_MIME_TYPES.image.has(type) || UPLOAD_MIME_TYPES.image.has(normalizeImageMimeType(type));
  }
  if (category === 'video') return UPLOAD_MIME_TYPES.video.has(type);
  if (category === 'audio') return UPLOAD_MIME_TYPES.audio.has(type);
  if (category === 'other') return UPLOAD_MIME_TYPES.other.has(type);

  return (
    UPLOAD_MIME_TYPES.image.has(type) ||
    UPLOAD_MIME_TYPES.image.has(normalizeImageMimeType(type)) ||
    UPLOAD_MIME_TYPES.video.has(type) ||
    UPLOAD_MIME_TYPES.audio.has(type) ||
    UPLOAD_MIME_TYPES.other.has(type)
  );
}

/**
 * The `accept` attribute for a file input.
 *
 * Deliberately broad (the OS picker filters by extension, not MIME) — real
 * validation must always run `isAllowedUploadMimeType` after selection.
 */
export function getUploadAcceptAttribute(fileType) {
  if (fileType === 'video') return 'video/*';
  if (fileType === 'audio') return 'audio/*';
  if (fileType === 'other') return '.zip,.pdf,.json,application/zip,application/pdf,application/json';
  return 'image/*';
}

/**
 * Human-readable size cap, for error messages.
 */
export function formatUploadLimit(bytes) {
  const mb = bytes / MB;
  return Number.isInteger(mb) ? `${mb}MB` : `${(mb).toFixed(1)}MB`;
}
