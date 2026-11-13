import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLocalPathForFile, resolveMediaFileUrl } from '@cinegen/lib/utils/media-file';

const originalElectronApi = window.electronAPI;

afterEach(() => {
  (window as Window & { electronAPI: typeof window.electronAPI }).electronAPI = originalElectronApi;
});

describe('resolveMediaFileUrl', () => {
  // [remix] Web: no local-media:// protocol; the path is returned as-is.
  it('returns a Finder file path unchanged on the web', async () => {
    const file = new File(['frame'], 'Shot #1?.png', { type: 'image/png' });
    (window as Window & { electronAPI: typeof window.electronAPI }).electronAPI = {
      file: {
        getPathForFile: () => '/Users/editor/Shot #1?.png',
      },
    } as typeof window.electronAPI;

    await expect(resolveMediaFileUrl(file))
      .resolves.toBe('/Users/editor/Shot #1?.png');
  });
});

it('uploads a phone video when the browser bridge supplies only a blob preview', async () => {
  const file = new File(['video bytes'], 'IMG_5388.MOV', { type: 'video/quicktime' });
  const buffer = new TextEncoder().encode('video bytes').buffer;
  Object.defineProperty(file, 'arrayBuffer', { value: async () => buffer });
  const upload = vi.fn().mockResolvedValue({ url: 'https://cinegen-film.vercel.app/media/uploads/phone.MOV' });
  window.electronAPI = {
    file: { getPathForFile: () => 'blob:https://cinegen-film.vercel.app/preview-only' },
    elements: { upload },
  } as unknown as typeof window.electronAPI;
  expect(getLocalPathForFile(file)).toBeUndefined();
  await expect(resolveMediaFileUrl(file)).resolves.toBe('https://cinegen-film.vercel.app/media/uploads/phone.MOV');
  expect(upload).toHaveBeenCalledWith({ buffer, name: 'IMG_5388.MOV', type: 'video/quicktime' }, 'byok'); // [remix] sentinel key
});
