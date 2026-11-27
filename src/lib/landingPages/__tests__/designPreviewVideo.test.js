// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { attachDesignPreview } from '../designPreview.js';

const host = () => {
  const h = document.createElement('div');
  Object.defineProperty(h, 'clientWidth', { value: 640 });
  document.body.appendChild(h);
  return h;
};
// A host that is "in view" at once, so the preview is drawn without waiting for scrolling.
vi.stubGlobal('IntersectionObserver', class { constructor(cb) { this.cb = cb; } observe(el) { this.cb([{ isIntersecting: true, target: el }]); } disconnect() {} });
vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });

const run = async (opts) => {
  const mount = vi.fn(() => ({ unmount() {} }));
  const h = attachDesignPreview(host(), { content: [] }, { deps: { mountEditablePage: mount }, ...opts });
  await vi.waitFor(() => expect(mount).toHaveBeenCalled());
  h.destroy();
  return mount.mock.calls[0][1];
};

describe('a design preview with the user\'s own video', () => {
  it('puts the video and poster in the page and fills the first prospect\'s words', async () => {
    const args = await run({ page: { video_url: 'https://cdn.test/me.mp4', poster_url: 'https://cdn.test/p.jpg' }, tokens: { firstname: 'Mike', company: 'Hypatos' } });
    expect(args.page.video_url).toBe('https://cdn.test/me.mp4');
    expect(args.page.poster_url).toBe('https://cdn.test/p.jpg');
    expect(args.tokens).toMatchObject({ firstname: 'Mike', company: 'Hypatos' });
    expect(args.preview).toBe(true);
  });
  it('without a video it keeps the empty placeholder page and the sample words', async () => {
    const args = await run({});
    expect(args.page.video_url).toBe('');
    expect(args.tokens).toMatchObject({ firstname: 'Alex', company: 'Brightline' });
  });
});
