import { describe, it, expect } from 'vitest';
import { PLATFORM_ORDER, PLATFORM_SPECS, buildPublishPayload, isPublicMediaUrl } from '../socialPayloads';

describe('social networks', () => {
  it('lists all eight networks', () => {
    expect(PLATFORM_ORDER).toEqual(['youtube', 'instagram', 'tiktok', 'facebook', 'linkedin', 'pinterest', 'threads', 'x']);
    for (const id of PLATFORM_ORDER) expect(PLATFORM_SPECS[id].label).toBeTruthy();
  });

  it('only accepts public https media', () => {
    expect(isPublicMediaUrl('https://cdn.example.com/a.mp4')).toBe(true);
    expect(isPublicMediaUrl('blob:https://x/1')).toBe(false);
    expect(isPublicMediaUrl('http://localhost/a.mp4')).toBe(false);
  });

  it('requires an account and public media', () => {
    const r = buildPublishPayload({ platform: 'x', accountId: '', mediaUrl: 'blob:x', mediaType: 'video', copy: { master: 'hi' } });
    expect(r.errors.length).toBeGreaterThanOrEqual(2);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('builds a payload for each network that accepts video', () => {
    for (const platform of PLATFORM_ORDER) {
      if (!PLATFORM_SPECS[platform].media.includes('video')) continue;
      const r = buildPublishPayload({ platform, accountId: 7, mediaUrl: 'https://cdn.example.com/a.mp4', mediaType: 'video', copy: { master: 'Hello', title: 'Title', description: 'Desc' } });
      expect(r.errors, platform).toEqual([]);
      expect(r.payload?.account_id, platform).toBe(7);
    }
  });
});
