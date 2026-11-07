// [remix] Real browser implementations of the parts of CineGen's `window.electronAPI` this editor needs.
// Registered into the shim (electron-shim.ts) so CineGen's own code paths run unchanged.
import { registerElectronApi } from './electron-shim';
import { uploadFileToStorage } from '../../lib/supabase.js';

export function registerWebApi() {
  registerElectronApi('elements', {
    // CineGen uploads reference images/frames and expects { url }. We store them in our storage bucket.
    upload: async (file: unknown) => {
      const f = file as { buffer: ArrayBuffer; name: string; type: string };
      const blob = new File([f.buffer], f.name, { type: f.type });
      const url = await uploadFileToStorage(blob);
      return { url };
    },
  });
}
