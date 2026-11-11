/**
 * Typed re-export of the authoritative upload contract.
 *
 * The canonical definitions live in `packages/studio/src/uploadContract.js`
 * (plain JS, so the studio package can consume it too). This module exists only
 * to give app-side TypeScript consumers a typed surface — DO NOT define limits
 * or MIME types here, re-export them from there.
 *
 * Mirrors the MuAPI File Upload API (https://muapi.ai/docs/file-upload):
 *   Images  10MB  .jpg .png .webp
 *   Videos  50MB  .mp4 .mov
 *   Others  10MB  .zip .pdf .json
 */
import {
  UPLOAD_LIMITS,
  UPLOAD_MIME_TYPES,
  ALLOWED_UPLOAD_MIME_TYPES,
  normalizeImageMimeType,
  getUploadLimit,
  isAllowedUploadMimeType,
  getUploadAcceptAttribute,
  formatUploadLimit,
} from '../../packages/studio/src/uploadContract.js';

export type UploadCategory = 'image' | 'video' | 'audio' | 'other';

export { UPLOAD_LIMITS, UPLOAD_MIME_TYPES, ALLOWED_UPLOAD_MIME_TYPES, formatUploadLimit };
export { normalizeImageMimeType, getUploadLimit, isAllowedUploadMimeType, getUploadAcceptAttribute };
