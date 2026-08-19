/**
 * Single, shared entry point for uploading a media file and obtaining its
 * public URL.
 *
 * Every studio that only needs the URL for a generation input
 * (video-to-video, image-to-video, lip-sync, avatar audio, agent video) must
 * call this instead of hand-rolling `muapi.uploadFile` + bespoke error
 * handling. The full-editor pipeline (`processFileUpload` in
 * `uploadPipeline.js`) remains the single path for uploads that must be
 * inserted into the timeline; this helper is the single path for "just give me
 * the URL".
 *
 * Responsibilities, centralized here so they cannot drift per-caller:
 *   - Validate type/size (delegated to `muapi.uploadFile`).
 *   - Return the public URL string, or throw.
 *   - Preserve the HTTP `status` on the thrown error.
 *   - Map the error to a user-facing message via `formatErrorMessage`, so
 *     callers can simply surface `err.message`.
 *
 * @param {File|Blob} file
 * @param {{ kind?: 'image'|'video'|'audio'|'other' }} [options]
 * @returns {Promise<string>} the public URL
 */
import { muapi } from '../muapi.js';
import { formatErrorMessage } from '../errorMessages.js';

export async function uploadMediaFile(file, options = {}) {
  try {
    const url = await muapi.uploadFile(file);
    if (!url) {
      const noUrl = new Error('Upload returned no URL');
      noUrl.status = 0;
      throw noUrl;
    }
    return url;
  } catch (err) {
    const status =
      typeof err?.status === 'number' ? err.status
        : (err?.response && typeof err.response.status === 'number' ? err.response.status : undefined);

    const message = formatErrorMessage(err);
    const wrapped = new Error(message);
    if (status !== undefined) wrapped.status = status;
    wrapped.cause = err;
    throw wrapped;
  }
}
