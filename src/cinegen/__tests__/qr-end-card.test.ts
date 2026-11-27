// [remix] QR end card for MP4 viewers: link, QR image and overlay clips.
import { describe, it, expect } from 'vitest';
import { createQrEndCard, mp4WatchLink, qrDataUrl } from '@cinegen/lib/leads/qr-end-card';
import { normalizeOverlays } from '@cinegen/lib/overlays/overlays';

describe('QR end card', () => {
  it('links to the published page with a source tag', () => {
    expect(mp4WatchLink('Abc123XyZ9', 'https://x.app')).toBe('https://x.app/watch/Abc123XyZ9?src=mp4');
  });
  it('makes a PNG QR data URL', async () => {
    expect((await qrDataUrl('https://x.app/watch/Abc123XyZ9?src=mp4')).startsWith('data:image/png;base64,')).toBe(true);
  });
  it('builds editable overlays in the last seconds', async () => {
    const clips = await createQrEndCard('https://x.app/watch/Abc123XyZ9?src=mp4', 30);
    expect(clips.map((c) => c.type)).toEqual(['overlay-background', 'overlay-text', 'overlay-image', 'overlay-text']);
    clips.forEach((c) => { expect(c.start).toBe(24); expect(c.end).toBe(30); });
    expect((clips[2].addon as { src: string }).src).toMatch(/^data:image\/png/);
    expect((clips[3].addon as { text: string }).text).toContain('x.app/watch/Abc123XyZ9');
    expect(normalizeOverlays(clips)).toHaveLength(4);
  });
  it('fits short videos', async () => {
    const clips = await createQrEndCard('https://x.app/watch/Abc123XyZ9', 3);
    expect(clips[0].start).toBe(0); expect(clips[0].end).toBe(3);
  });
});
