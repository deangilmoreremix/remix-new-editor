// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('../engines.js', async (orig) => ({ ...(await orig()), detectCapabilities: async () => ({ webgpu: false, wasm: true }) }));
import { CAPTION_PRESETS, CAPITE_PRESETS } from '../model.js';
import { CaptionStudioModal } from '../modal.js';

const DIR = join(process.cwd(), 'public/caption-looks');
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeAll(() => { vi.stubGlobal('indexedDB', undefined); HTMLMediaElement.prototype.load = vi.fn(); });
afterEach(() => { document.body.innerHTML = ''; });

describe('real pictures of every caption look (scripts/generate-caption-look-previews.mjs)', () => {
  const keys = [...Object.keys(CAPTION_PRESETS), ...Object.keys(CAPITE_PRESETS)];
  it('has one real picture per look, none empty (re-run the script when looks change)', () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith('.webp')).sort();
    expect(keys).toHaveLength(32);
    expect(files).toEqual(keys.map((k) => `${k}.webp`).sort());
    for (const f of files) expect(statSync(join(DIR, f)).size, f).toBeGreaterThan(5000);   // a drawn photo, never a blank
  });

  it('the Motion & Style tiles show them when the host gives lookImage, and keep the old tile otherwise', async () => {
    const withImgs = new CaptionStudioModal({ lookImage: (k) => `/caption-looks/${k}.webp` });
    withImgs.open(); await flush();
    document.querySelector('[data-act="tab"][data-tab="style"]').click();
    const imgs = [...document.querySelectorAll('img.csm-pic-img')];
    expect(imgs).toHaveLength(32);
    expect(imgs[0].getAttribute('src')).toBe('/caption-looks/tiktok.webp');
    expect(imgs[5].getAttribute('alt')).toContain('caption look');
    withImgs.close(); document.body.innerHTML = '';

    const without = new CaptionStudioModal({ sampleImage: '/library-previews/sample-in.jpg' });
    without.open(); await flush();
    document.querySelector('[data-act="tab"][data-tab="style"]').click();
    expect(document.querySelectorAll('img.csm-pic-img')).toHaveLength(0);
    expect(document.querySelector('.csm-pic').getAttribute('style')).toContain('sample-in.jpg');
    without.close();
  });
});
