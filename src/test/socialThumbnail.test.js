import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../features/personalization/lib/thumbnailUpload', () => ({
  prepareThumbnailFile: vi.fn(async () => new File(['x'], 'thumb.png', { type: 'image/png' })),
}));
vi.mock('../lib/muapiUpload.js', () => ({
  uploadImageToMuAPI: vi.fn(),
  handleMuAPIUploadError: vi.fn((e) => ({ message: `Upload failed: ${e.message}` })),
}));

import { toPublicThumbnailUrl } from '../lib/socialThumbnail.js';
import { uploadImageToMuAPI } from '../lib/muapiUpload.js';

describe('toPublicThumbnailUrl', () => {
  beforeEach(() => vi.clearAllMocks());

  test('an https link is used as is, without uploading', async () => {
    await expect(toPublicThumbnailUrl('https://cdn.example.com/t.jpg')).resolves.toBe('https://cdn.example.com/t.jpg');
    expect(uploadImageToMuAPI).not.toHaveBeenCalled();
  });

  test('a data: URL is uploaded to muapi and the hosted link is returned', async () => {
    uploadImageToMuAPI.mockResolvedValue({ url: 'https://cdn.muapi.ai/u/t.png' });
    await expect(toPublicThumbnailUrl('data:image/png;base64,AAAA')).resolves.toBe('https://cdn.muapi.ai/u/t.png');
    expect(uploadImageToMuAPI).toHaveBeenCalledTimes(1);
  });

  test('a failed upload throws instead of returning a link to a missing file', async () => {
    uploadImageToMuAPI.mockRejectedValue(new Error('storage rejected'));
    await expect(toPublicThumbnailUrl('data:image/png;base64,AAAA')).rejects.toThrow('Upload failed: storage rejected');
  });

  test('an offline or non-public result is never accepted', async () => {
    uploadImageToMuAPI.mockResolvedValue({ url: 'blob:offline/smartvideo/x.png' });
    await expect(toPublicThumbnailUrl('data:image/png;base64,AAAA')).rejects.toThrow();
  });
});
