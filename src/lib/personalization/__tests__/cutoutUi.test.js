// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderPersonalizationPanel } from '../../editor/panels/personalPanels.js';

const base = (over = {}) => ({
  contacts: () => [{ id: 'c1', name: 'Ann Lee' }],
  active: () => ({ id: 'c1', name: 'Ann Lee', contact: { name: 'Ann Lee' } }),
  select() {}, addText() {}, openPersonalize() {},
  images: () => [
    { id: 'a', saved: true, name: 'Logo', roleLabel: 'Logo', src: 'https://a.test/l.jpg', transparent: false, hasOriginal: false },
    { id: 'b', saved: true, name: 'Photo', roleLabel: 'Headshot', src: 'https://a.test/p.png', transparent: true, hasOriginal: true },
    { id: 'd', saved: false, name: 'Site image', roleLabel: 'Website image', src: 'https://a.test/s.jpg' },
  ],
  busy: () => new Set(),
  removeBackground: vi.fn(), useOriginal: vi.fn(),
  ...over,
});

describe('Personalization panel Images grid', () => {
  it('lists saved images only, with the right actions', () => {
    const el = document.createElement('div');
    renderPersonalizationPanel(el, base());
    expect(el.querySelectorAll('.rp-image')).toHaveLength(2);
    expect(el.querySelector('[data-cutout="a"]').textContent).toMatch(/Remove background/);
    expect(el.querySelector('[data-cutout="b"]').textContent).toMatch(/Redo/);
    expect(el.querySelector('[data-original="b"]')).toBeTruthy();
    expect(el.querySelector('[data-original="a"]')).toBeNull();
    expect(el.textContent).toContain('Transparent');
  });
  it('calls the services with the asset id', () => {
    const s = base();
    const el = document.createElement('div');
    renderPersonalizationPanel(el, s);
    el.querySelector('[data-cutout="a"]').click();
    el.querySelector('[data-original="b"]').click();
    expect(s.removeBackground).toHaveBeenCalledWith('a', expect.any(Function));
    expect(s.useOriginal).toHaveBeenCalledWith('b', expect.any(Function));
  });
  it('shows progress instead of buttons while an image is busy', () => {
    const el = document.createElement('div');
    renderPersonalizationPanel(el, base({ busy: () => new Set(['a']) }));
    expect(el.querySelector('[data-cutout="a"]')).toBeNull();
    expect(el.textContent).toContain('Working');
  });
});

describe('studio engine modules the cutout service loads', () => {
  it('resolve and export what backgroundCutout.js uses', async () => {
    const base = '../../../features/personalization/shared/personalization';
    const client = await import(`${base}/backgroundRemoval/backgroundRemovalClient.ts`);
    const loader = await import(`${base}/backgroundRemoval/loadImageBlob.ts`);
    const persist = await import(`${base}/editedAssetPersistence.ts`);
    expect([client.removeAssetBackground, client.canRemoveBackgrounds, client.blobToDataUrl, loader.loadImageBlob, persist.persistEditedPersonalizationAsset].every((f) => typeof f === 'function')).toBe(true);
  });
});
