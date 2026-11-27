// src/lib/studioInputUpload.js
//
// A file someone adds to a studio to generate or edit with goes to MuAPI (muapi.uploadFile), like AI VFX and the
// other studios. muapi.uploadFile already falls back to permanent storage on network/5xx failures and reports a bad
// key or empty balance instead. With no MuAPI key on this device it goes straight to storage, so the upload still works.
// (Finished results saved to the Library, Video Pages media and the Content library stay on permanent storage:
// those links must not expire.)
import { muapi } from './muapi.js';
import { apiKeyManager } from './apiKeyManager.js';
import { uploadFileToSupabase } from './uploadService.js';

/** @returns {Promise<{ url: string, via: 'muapi' | 'storage' }>} */
export async function uploadStudioInput(file, { category, signal, onProgress, deps = {} } = {}) {
  const hasKey = (deps.hasMuapiKey || (() => apiKeyManager.hasMuapiKey()))();
  if (hasKey) {
    const url = await (deps.muapiUpload || ((f, o) => muapi.uploadFile(f, o)))(file, { signal, onProgress });
    return { url, via: 'muapi' };
  }
  const { url } = await (deps.storageUpload || uploadFileToSupabase)(file, { category, signal, onProgress });
  return { url, via: 'storage' };
}
