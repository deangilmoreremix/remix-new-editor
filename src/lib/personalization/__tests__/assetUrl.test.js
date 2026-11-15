import { describe, it, expect } from 'vitest';
import { resolveAssetUrl, resolveOriginalAssetUrl, isCutoutAsset } from '../assetUrl.js';

describe('resolveAssetUrl', () => {
  it('handles empty and string input', () => {
    expect(resolveAssetUrl(null)).toBe('');
    expect(resolveAssetUrl({})).toBe('');
    expect(resolveAssetUrl('https://a.test/x.png')).toBe('https://a.test/x.png');
  });
  it('uses the cutout in url over the original', () => {
    expect(resolveAssetUrl({ url: 'https://a.test/cut.png', originalUrl: 'https://a.test/o.jpg' })).toBe('https://a.test/cut.png');
  });
  it('prefers editedUrl on discovered assets', () => {
    expect(resolveAssetUrl({ editedUrl: 'https://a.test/e.png', previewUrl: 'https://a.test/p.jpg', sourceUrl: 'https://a.test/s.jpg' })).toBe('https://a.test/e.png');
  });
  it('prefers a durable uploadedUrl over a blob url', () => {
    expect(resolveAssetUrl({ url: 'blob:http://x/1', uploadedUrl: 'https://a.test/up.png', originalUrl: 'https://a.test/o.jpg' })).toBe('https://a.test/up.png');
  });
  it('skips a blob url for a durable original, but keeps it when it is all there is', () => {
    expect(resolveAssetUrl({ url: 'blob:http://x/1', originalUrl: 'https://a.test/o.jpg' })).toBe('https://a.test/o.jpg');
    expect(resolveAssetUrl({ url: 'blob:http://x/1' })).toBe('blob:http://x/1');
  });
  it('treats a data: url as durable: a cutout kept as a data url beats the original it was made from', () => {
    expect(resolveAssetUrl({ url: 'data:image/png;base64,Q1VU', originalUrl: 'https://a.test/o.jpg', edited: true })).toBe('data:image/png;base64,Q1VU');
  });
  it('falls back through preview, source, original', () => {
    expect(resolveAssetUrl({ previewUrl: 'p', sourceUrl: 's', originalUrl: 'o' })).toBe('p');
    expect(resolveAssetUrl({ originalUrl: 'o' })).toBe('o');
  });
});

describe('resolveOriginalAssetUrl / isCutoutAsset', () => {
  it('returns the pre-edit image', () => {
    expect(resolveOriginalAssetUrl({ url: 'cut', originalUrl: 'orig' })).toBe('orig');
    expect(resolveOriginalAssetUrl({ url: 'only' })).toBe('only');
    expect(resolveOriginalAssetUrl(null)).toBe('');
  });
  it('flags edited / transparent assets', () => {
    expect(isCutoutAsset({ hasTransparency: true })).toBe(true);
    expect(isCutoutAsset({ edited: true })).toBe(true);
    expect(isCutoutAsset({ url: 'x' })).toBe(false);
    expect(isCutoutAsset(null)).toBe(false);
  });
});
