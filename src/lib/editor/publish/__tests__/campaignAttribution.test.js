// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// WatchPage reads the campaign recipient link (?cr=) and hands it to the analytics client as an untrusted lookup key.
const created = [];
vi.mock('../analyticsClient.js', () => ({
  createAnalytics: vi.fn((o) => { created.push(o); return { track: vi.fn(), trackWatch: vi.fn(), onPlayerChange: vi.fn(), flush: vi.fn(), destroy: vi.fn(), sessionId: 'x' }; }),
  consentMode: () => 'full',
}));
vi.mock('../heatmapCapture.js', async (orig) => ({ ...(await orig()), createHeatmapCapture: () => ({ destroy() {} }) }));

import { mountWatchPage } from '../../../../pages/WatchPage.jsx';

describe('watch page: campaign recipient link', () => {
  beforeEach(() => { created.length = 0; document.head.innerHTML = ''; document.body.innerHTML = ''; });
  const proj = { title: 'Demo', timelineSeconds: 5, tracks: [{ id: 'v', type: 'video', items: [{ left: 0, width: 100, id: 'vid', type: 'video', src: 'https://cdn/x.mp4' }] }] };
  const mount = async (search) => {
    window.history.replaceState({}, '', `/watch/abcdefgh12${search}`);
    const box = document.createElement('div');
    document.body.appendChild(box);
    await mountWatchPage(box, 'abcdefgh12', {
      fetchVideo: async () => ({ id: 'abcdefgh12', title: 'Demo', project: proj, privacy: 'public' }),
      createEngine: () => ({ play() {}, pause() {}, seekToFrame() {}, destroy() {} }),
    });
  };
  it('passes ?cr=<token> to the analytics client', async () => {
    await mount('?cr=Zk3-abcdefghijklmnopqrstuv');
    expect(created[0].recipientToken).toBe('Zk3-abcdefghijklmnopqrstuv');
    expect(created[0].videoId).toBe('abcdefgh12');
  });
  it('passes nothing for a plain link', async () => {
    await mount('');
    expect(created[0].recipientToken).toBeNull();
  });
  it('is independent of the personal-contact parameter (?c=)', async () => {
    await mount('?cr=Zk3-abcdefghijklmnopqrstuv&c=contact-1');
    expect(created[0].recipientToken).toBe('Zk3-abcdefghijklmnopqrstuv');
  });
});
