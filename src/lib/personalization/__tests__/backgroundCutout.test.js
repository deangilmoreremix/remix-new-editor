import { describe, it, expect, vi } from 'vitest';
import { buildCutoutPatch, buildRevertPatch, cutoutAsset, MAX_LOCAL_DATA_URL } from '../backgroundCutout.js';
import { resolveAssetUrl } from '../assetUrl.js';

const logo = { id: 'logo-1', role: 'logo', name: 'Logo', url: 'https://a.test/logo.jpg' };
const blob = new Blob(['x'], { type: 'image/png' });

describe('buildCutoutPatch / buildRevertPatch', () => {
  it('keeps the id, puts the cutout in url and the old image in originalUrl', () => {
    const p = buildCutoutPatch(logo, { url: 'https://a.test/cut.png', uploadedUrl: 'https://a.test/cut.png', provider: 'wasm' });
    expect(p).toMatchObject({ id: 'logo-1', url: 'https://a.test/cut.png', originalUrl: 'https://a.test/logo.jpg', edited: true, hasTransparency: true, uploadStatus: 'ready' });
    expect(p.versions).toHaveLength(1);
    expect(resolveAssetUrl(p)).toBe('https://a.test/cut.png');
  });
  it('does not overwrite the first original when cut out twice', () => {
    const once = buildCutoutPatch(logo, { url: 'https://a.test/c1.png', uploadedUrl: 'https://a.test/c1.png' });
    const twice = buildCutoutPatch(once, { url: 'https://a.test/c2.png', uploadedUrl: 'https://a.test/c2.png' });
    expect(twice.originalUrl).toBe('https://a.test/logo.jpg');
    expect(twice.versions).toHaveLength(2);
  });
  it('marks an un-uploaded cutout local', () => {
    expect(buildCutoutPatch(logo, { url: 'blob:x/1' }).uploadStatus).toBe('local');
  });
  it('reverts to the original and clears the cutout flags', () => {
    const r = buildRevertPatch(buildCutoutPatch(logo, { url: 'https://a.test/c.png', uploadedUrl: 'https://a.test/c.png' }));
    expect(r).toMatchObject({ url: 'https://a.test/logo.jpg', edited: false, hasTransparency: false });
    expect(r.originalUrl).toBeUndefined();
    expect(buildRevertPatch(logo)).toBe(logo);
  });
});

describe('cutoutAsset', () => {
  const deps = (over = {}) => ({
    canRemove: async () => true,
    loadImageBlob: vi.fn(async () => blob),
    removeBackground: vi.fn(async () => ({ blob, width: 10, height: 20, provider: 'wasm' })),
    blobToDataUrl: async () => 'data:image/png;base64,eA==',
    persist: vi.fn(async () => ({ ok: true, publicUrl: 'https://a.test/up.png' })),
    ...over,
  });

  it('removes the background and uses the uploaded url', async () => {
    const d = deps();
    const { patch, uploaded } = await cutoutAsset(logo, { deps: d });
    expect(d.loadImageBlob).toHaveBeenCalledWith('https://a.test/logo.jpg', expect.anything());
    expect(uploaded).toBe(true);
    expect(patch).toMatchObject({ url: 'https://a.test/up.png', hasTransparency: true, width: 10, height: 20 });
  });
  it('keeps a small un-uploaded cutout as a data url, so it survives a reload and a sync', async () => {
    const { patch, uploaded } = await cutoutAsset(logo, { deps: deps({ persist: async () => ({ ok: false }) }) });
    expect(uploaded).toBe(false);
    expect(patch.url).toBe('data:image/png;base64,eA==');
    expect(patch.uploadStatus).toBe('local');
  });
  it('falls back to a blob url only when the cutout is too large to keep in localStorage', async () => {
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:local/1');
    const big = 'data:image/png;base64,' + 'A'.repeat(MAX_LOCAL_DATA_URL + 10);
    const { patch } = await cutoutAsset(logo, { deps: deps({ persist: async () => ({ ok: false }), blobToDataUrl: async () => big }) });
    expect(patch.url).toBe('blob:local/1');
  });
  it('fails clearly when the browser cannot run it or there is no url', async () => {
    await expect(cutoutAsset(logo, { deps: deps({ canRemove: async () => false }) })).rejects.toThrow(/WebAssembly/);
    await expect(cutoutAsset({ id: 'x' }, { deps: deps() })).rejects.toThrow(/no URL/);
  });
});
