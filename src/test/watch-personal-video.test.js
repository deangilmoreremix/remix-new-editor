import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountWatchPage } from '../pages/WatchPage.jsx';

const project = { version: 1, title: 'Demo', timelineSeconds: 4, tracks: [{ id: 'v', type: 'video', items: [{ id: 'vid', type: 'video', src: 'https://cdn/x.mp4', left: 0, width: 100 }] }], listBuilder: null };
const create = () => ({ play: () => {}, pause: () => {}, seekToFrame: () => {}, update: () => {}, destroy: () => {} });
const TOKEN = 'Abcdefghijklmnopqrstuvwxyz012345';
afterEach(() => { window.history.replaceState(null, '', '/'); document.body.innerHTML = ''; });

async function mount(query, fetchRecipientVideo) {
  window.history.replaceState(null, '', `/watch/abcdefgh12${query}`);
  const box = document.createElement('div'); document.body.appendChild(box);
  const analytics = { track: vi.fn(), onPlayerChange: vi.fn(), destroy: vi.fn() };
  await mountWatchPage(box, 'abcdefgh12', { fetchVideo: async () => ({ id: 'abcdefgh12', title: 'Demo', project }), createEngine: create, onLead: vi.fn(), analytics, fetchRecipientVideo });
  return { box, analytics };
}

describe('watch page: the recipient\'s own video', () => {
  it('shows it (from a signed https URL) above the player, and counts its play and finish', async () => {
    const f = vi.fn(async () => ({ ok: true, url: 'https://db.test/storage/v1/object/sign/recipient-videos/p?token=t', contentType: 'video/mp4', expiresIn: 3600 }));
    const { box, analytics } = await mount(`?r=${TOKEN}`, f);
    await vi.waitFor(() => expect(box.querySelector('[data-personal-video]')).toBeTruthy());
    expect(f).toHaveBeenCalledWith('abcdefgh12', TOKEN); const v = box.querySelector('[data-personal-video]');
    expect(v.getAttribute('src')).toMatch(/^https:\/\/db\.test\//); expect(v.controls).toBe(true); expect(v.closest('section').getAttribute('aria-label')).toBe('Your personal video'); expect(v.closest('section').nextElementSibling.classList.contains('watch-player')).toBe(true);
    v.dispatchEvent(new Event('play')); v.dispatchEvent(new Event('play')); v.dispatchEvent(new Event('ended'));
    expect(analytics.track.mock.calls.filter((c) => c[0] === 'play' && c[1]?.props?.reason === 'personal-video')).toHaveLength(1); expect(analytics.track).toHaveBeenCalledWith('complete', {});
  });
  it('shows nothing for a link without one, for no token, and for anything that is not an https URL; failures are silent', async () => {
    for (const f of [vi.fn(async () => null), vi.fn(async () => ({ ok: false })), vi.fn(async () => ({ ok: true, url: 'javascript:alert(1)' })), vi.fn(async () => ({ ok: true, url: 'http://insecure.example/v.mp4' })), vi.fn(async () => { throw new Error('offline'); })]) {
      const { box } = await mount(`?r=${TOKEN}`, f); await vi.waitFor(() => expect(f).toHaveBeenCalled()); await new Promise((r) => setTimeout(r, 20)); expect(box.querySelector('[data-personal-video]')).toBeNull(); expect(box.querySelector('.watch-player')).toBeTruthy(); box.remove();
    }
    const g = vi.fn(); const { box } = await mount('', g); await new Promise((r) => setTimeout(r, 20)); expect(g).not.toHaveBeenCalled(); expect(box.querySelector('[data-personal-video]')).toBeNull();
    const h = vi.fn(); await mount('?r=short', h); await new Promise((r) => setTimeout(r, 20)); expect(h).not.toHaveBeenCalled(); // a malformed token is never sent anywhere
  });
});
