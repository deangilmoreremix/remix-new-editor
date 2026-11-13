import { describe, expect, it, vi } from 'vitest';
import { fetchVideoStats } from '../lib/editor/publish/publishClient.js';
import { renderSharePanel } from '../lib/editor/publish/sharePanel.js';
import { mountWatchPage } from '../pages/WatchPage.jsx';

describe('fetchVideoStats', () => {
  it('maps per-contact totals', async () => {
    const client = { rpc: vi.fn(async () => ({ data: [{ contact_id: 'c_acme', views: '3', plays: 2, completes: 1, cta_clicks: 1, leads: 0, last_seen: '2026-11-05T10:00:00Z' }, { contact_id: null, views: 5, plays: 1, completes: 0, cta_clicks: 0, leads: 0 }], error: null })) };
    const rows = await fetchVideoStats(client, 'abcdefgh12');
    expect(client.rpc).toHaveBeenCalledWith('video_events_by_contact', { video_id: 'abcdefgh12' });
    expect(rows[0]).toEqual({ contactId: 'c_acme', views: 3, plays: 2, completes: 1, ctaClicks: 1, leads: 0, lastSeen: '2026-11-05T10:00:00Z' });
    expect(rows[1].contactId).toBeNull();
  });
});

const T = 4;
function project() {
  return {
    version: 1, title: 'Demo', timelineSeconds: T,
    tracks: [
      { id: 'v', type: 'video', items: [{ id: 'vid', type: 'video', src: 'https://cdn/x.mp4', left: 0, width: 100 }] },
      { id: 't', type: 'text', items: [{ id: 'cta', type: 'click-to-call', linkUrl: 'https://example.com/buy', buttonText: 'Buy', style: {}, left: 0, width: 100 }] },
    ],
    listBuilder: null,
  };
}
function fakeEngine() {
  const e = { frame: 0, playing: false };
  const create = (host, o) => {
    e.onFrame = o.onFrame;
    return { play: () => { e.playing = true; }, pause: () => { e.playing = false; }, seekToFrame: (f) => { e.frame = f; }, update: () => {}, destroy: () => {} };
  };
  e.advance = (sec) => { if (e.playing) { e.frame = Math.round(sec * 30); e.onFrame(e.frame); } };
  return { e, create };
}

describe('watch page records first-party analytics', () => {
  it('page_open, play, CTA click (with label) and finish flow through the analytics client', async () => {
    window.history.replaceState(null, '', '/watch/abcdefgh12?c=c_acme&firstName=Ann');
    const box = document.createElement('div');
    document.body.appendChild(box);
    const { e, create } = fakeEngine();
    const analytics = { track: vi.fn(), onPlayerChange: vi.fn(), destroy: vi.fn() };
    const p = project();
    p.tracks[1].items[0].buttonText = 'Get a quote';
    const player = await mountWatchPage(box, 'abcdefgh12', {
      fetchVideo: async () => ({ id: 'abcdefgh12', title: 'Demo', project: p }),
      createEngine: create, onLead: vi.fn(), analytics,
    });
    box.querySelector('[data-bigplay]').click();
    e.advance(1);
    expect(analytics.onPlayerChange).toHaveBeenCalledWith(expect.objectContaining({ playing: true }));
    const cta = box.querySelector('a[href="https://example.com/buy"]');
    expect(cta).toBeTruthy();
    cta.addEventListener('click', (ev) => ev.preventDefault());
    cta.click();
    expect(analytics.track).toHaveBeenCalledWith('cta_click', expect.objectContaining({ clip: 'cta', props: { label: 'Get a quote', pricing: true } }));
    e.advance(T);
    expect(analytics.onPlayerChange).toHaveBeenLastCalledWith(expect.objectContaining({ time: expect.any(Number), duration: T }));
    player.destroy();
    window.history.replaceState(null, '', '/');
  });

  it('opens real analytics (with the personal-link contact) when no override is given', async () => {
    window.history.replaceState(null, '', '/watch/abcdefgh12?c=c_acme');
    const box = document.createElement('div');
    document.body.appendChild(box);
    const { create } = fakeEngine();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 200 });
    Object.defineProperty(navigator, 'doNotTrack', { value: '0', configurable: true });
    const player = await mountWatchPage(box, 'abcdefgh12', { fetchVideo: async () => ({ id: 'abcdefgh12', title: 'Demo', project: project() }), createEngine: create, onLead: vi.fn() });
    player.destroy();
    window.dispatchEvent(new Event('pagehide'));
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/video-events');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ video: 'abcdefgh12', contact: 'c_acme' });
    expect(body.events[0].type).toBe('page_open');
    expect(body.owner_id).toBeUndefined();
    fetchSpy.mockRestore();
    window.history.replaceState(null, '', '/');
  });

  it('respects Do-Not-Track: nothing is sent', async () => {
    const box = document.createElement('div');
    document.body.appendChild(box);
    const { create } = fakeEngine();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 200 });
    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true });
    const player = await mountWatchPage(box, 'abcdefgh12', { fetchVideo: async () => ({ id: 'abcdefgh12', title: 'Demo', project: project() }), createEngine: create, onLead: vi.fn() });
    player.destroy();
    window.dispatchEvent(new Event('pagehide'));
    expect(fetchSpy).not.toHaveBeenCalled();
    Object.defineProperty(navigator, 'doNotTrack', { value: '0', configurable: true });
    fetchSpy.mockRestore();
  });
});

describe('share panel: views by contact', () => {
  it('lists totals per contact once the video is published', async () => {
    const box = document.createElement('div');
    renderSharePanel(box, {
      getInfo: async () => ({ id: 'abcdefgh12', title: 'Promo', published: true, view_count: 8 }),
      countLeads: async () => 0,
      fetchStats: async () => [
        { contactId: 'c_acme', views: 3, plays: 2, completes: 1, ctaClicks: 1, leads: 0 },
        { contactId: null, views: 5, plays: 1, completes: 0, ctaClicks: 0, leads: 0 },
      ],
      contactLabel: (id) => (id === 'c_acme' ? 'Ann Smith' : null),
      copy: async () => {},
    });
    await vi.waitFor(() => expect(box.querySelector('.share-stats-table table')).toBeTruthy());
    const rows = [...box.querySelectorAll('.share-stats-table tbody tr')].map((tr) => [...tr.cells].map((c) => c.textContent.trim()).join(' '));
    expect(rows).toEqual(['Ann Smith 3 2 1 1 0', 'Everyone else 5 1 0 0 0']);
  });

  it('explains when the database update is not installed yet', async () => {
    const box = document.createElement('div');
    renderSharePanel(box, {
      getInfo: async () => ({ id: 'abcdefgh12', published: true }),
      fetchStats: async () => { throw Object.assign(new Error('Could not find the function public.video_events_by_contact'), { code: 'PGRST202' }); },
    });
    await vi.waitFor(() => expect(box.textContent).toContain('once the analytics update is installed'));
  });
});
