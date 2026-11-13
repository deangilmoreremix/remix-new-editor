/**
 * remix-new-editor shim for OpenHiggsBolt's `packages/studio/src/lib/assetStore.js`.
 *
 * OpenHiggsBolt keeps a lasting copy of every MuAPI upload / generated result
 * in its own asset library from inside muapi.js. In remix the same outcomes
 * are already handled elsewhere, so mirroring them here would store each file
 * twice:
 *   - uploaded originals go to the durable `personalization-assets` bucket
 *     (shared/personalization/assetUploadService.ts);
 *   - an approved result is saved to the Asset Library the Library page lists
 *     (lib/remixAssetLibrary.ts, called from StepPreviewApprove).
 *
 * Both functions are best-effort in OpenHiggsBolt (they resolve to null when
 * nothing is saved and never throw), so a no-op keeps muapi.js unchanged.
 */
export async function saveUploadedFile() {
  return null;
}

export async function saveResultUrl() {
  return null;
}
