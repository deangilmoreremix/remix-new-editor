// uploadStudioInput: studio inputs go to MuAPI when there is a key, else to storage.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../muapi.js', () => ({ muapi: { uploadFile: vi.fn() } }));
vi.mock('../apiKeyManager.js', () => ({ apiKeyManager: { hasMuapiKey: () => false } }));
vi.mock('../uploadService.js', () => ({ uploadFileToSupabase: vi.fn() }));

const { uploadStudioInput } = await import('../studioInputUpload.js');
const file = new File([new Uint8Array(4)], 'a.mp4', { type: 'video/mp4' });

describe('uploadStudioInput', () => {
  it('uses the MuAPI upload when a MuAPI key is saved', async () => {
    const muapiUpload = vi.fn(async () => 'https://cdn.muapi.ai/a.mp4');
    const storageUpload = vi.fn();
    const out = await uploadStudioInput(file, { category: 'video', deps: { hasMuapiKey: () => true, muapiUpload, storageUpload } });
    expect(out).toEqual({ url: 'https://cdn.muapi.ai/a.mp4', via: 'muapi' });
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it('uses storage when there is no MuAPI key, so the upload still works', async () => {
    const muapiUpload = vi.fn();
    const storageUpload = vi.fn(async () => ({ url: 'https://x.supabase.co/storage/v1/object/public/uploads/smartvideo/anonymous/a.mp4' }));
    const out = await uploadStudioInput(file, { category: 'video', deps: { hasMuapiKey: () => false, muapiUpload, storageUpload } });
    expect(out.via).toBe('storage');
    expect(storageUpload).toHaveBeenCalledWith(file, expect.objectContaining({ category: 'video' }));
    expect(muapiUpload).not.toHaveBeenCalled();
  });

  it('passes MuAPI errors through (a bad key or empty balance is shown, not hidden)', async () => {
    const muapiUpload = vi.fn(async () => { throw new Error('Invalid API key'); });
    await expect(uploadStudioInput(file, { deps: { hasMuapiKey: () => true, muapiUpload } })).rejects.toThrow('Invalid API key');
  });
});
