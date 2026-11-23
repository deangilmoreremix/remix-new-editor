import { describe, it, expect, vi } from 'vitest';
import { renderContactVideo, contactVideoName } from '../contactVideo.js';

const mike = { id: 'c1', firstName: 'Mike', lastName: 'Markovic', email: 'mike@acme.com', company: 'Acme', website: 'https://acme.com' };

describe('per-contact video file', () => {
  it('draws the published campaign for the contact and renders it', async () => {
    const project = { tracks: [] };
    const deps = {
      fetchPublishedVideo: vi.fn(async () => ({ id: 'abc12345', project })),
      buildViewerModel: vi.fn(() => ({ width: 1920 })),
      exportModel: vi.fn(async () => new Blob(['mp4'], { type: 'video/mp4' })),
    };
    const blob = await renderContactVideo({ campaignId: 'abc12345', contact: mike, siteShots: { 'https://acme.com/': 'https://cdn/acme.jpg' }, deps });
    expect(blob.type).toBe('video/mp4');
    const profile = deps.buildViewerModel.mock.calls[0][1];
    expect(profile).toMatchObject({ id: 'c1', variables: { firstName: 'Mike', company: 'Acme' } });
    expect(deps.exportModel.mock.calls[0][1]).toMatchObject({ container: 'mp4' });
  });

  it('falls back to WebM when MP4 cannot be encoded, and explains a missing campaign', async () => {
    const exportModel = vi.fn()
      .mockRejectedValueOnce(new Error('No H.264 encoder support'))
      .mockResolvedValueOnce(new Blob(['w'], { type: 'video/webm' }));
    const deps = { fetchPublishedVideo: async () => ({ project: {} }), buildViewerModel: () => ({}), exportModel };
    expect((await renderContactVideo({ campaignId: 'x', contact: mike, deps })).type).toBe('video/webm');
    await expect(renderContactVideo({ campaignId: 'x', contact: mike, deps: { ...deps, fetchPublishedVideo: async () => null } })).rejects.toThrow(/could not be loaded/);
  });

  it('names the file after the campaign and contact', () => {
    expect(contactVideoName('Cold outreach', mike)).toBe('Cold_outreach-Mike-Markovic');
    expect(contactVideoName('', { email: 'a@b.co' })).toBe('video-a_b.co');
  });
});
