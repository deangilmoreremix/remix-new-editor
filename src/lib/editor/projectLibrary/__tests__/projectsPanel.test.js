// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderProjectsPanel, fmtDuration, DETAIL_TABS, heatStripHtml, heatPlaceholderHtml, wantsHeat, canHaveHeat } from '../projectsPanel.js';

const rows = [
  { id: 'a', name: 'Roofing promo', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z', duration_s: 65, aspect_ratio: '16:9', render: { status: 'complete' }, tags: [] },
  { id: 'b', name: 'Kitchen tour', created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-05T00:00:00Z', duration_s: null, aspect_ratio: null, render: {}, tags: [] },
];

function clientFor(list) {
  const b = {
    select() { return b; }, is() { return b; }, ilike() { return b; }, order() { return b; }, range() { return b; },
    eq(_c, v) { b._id = v; return b; },
    maybeSingle: async () => ({ data: list.find((r) => r.id === b._id) || null, error: null }),
    then: (res, rej) => Promise.resolve({ data: list, error: null }).then(res, rej),
  };
  return { from: () => b };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('projects panel', () => {
  let host;
  let deps;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(host);
    deps = {
      getClient: async () => clientFor(rows),
      getPublished: async () => ({ a: { id: 'abc12345', published: true } }),
      getStats: async () => ({ a: { plays: 0, leads: 0 } }),
      getCurrentProjectId: () => 'b',
      onOpen: vi.fn(), onCreate: vi.fn(), onToast: vi.fn(),
    };
  });

  it('shows skeleton, then cards with real/unavailable metrics', async () => {
    renderProjectsPanel(host, deps);
    expect(host.querySelector('.prj-skel')).toBeTruthy();
    await tick(); await tick();
    expect(host.querySelectorAll('.prj-card')).toHaveLength(2);
    const a = host.querySelector('[data-id="a"]');
    expect(a.textContent).toContain('Published');
    expect(a.textContent).toContain('1:05');
    // plays = 0 is a real zero; completion was never computed => unavailable marker, not 0%
    const line = a.querySelector('.prj-line');
    expect(line.children[0].textContent).toBe('0 plays');
    expect(line.children[1].querySelector('.prj-na')).toBeTruthy();
    // a project without any stats shows unavailable for both
    expect(host.querySelector('[data-id="b"] .prj-line').querySelectorAll('.prj-na').length).toBe(2);
    expect(host.querySelector('[data-id="b"]').classList.contains('is-current')).toBe(true);
  });

  it('summary uses real totals and shows unavailable instead of inventing numbers', async () => {
    renderProjectsPanel(host, { ...deps, getStats: async () => ({ a: { plays: 12800, leads: 86 } }), getUnread: async () => 3 });
    await tick(); await tick();
    const main = [...host.querySelectorAll('.prj-stat-lg')].map((e) => [e.querySelector('span').textContent, e.querySelector('b').textContent]);
    expect(main).toEqual([['Published videos', '1'], ['Total plays · 30 days', '12.8K'], ['Leads · 30 days', '86']]);
    expect(host.querySelector('.prj-stats-rest').textContent).toContain('3Unread alerts');
    const none = document.createElement('div'); document.body.appendChild(none);
    renderProjectsPanel(none, { ...deps, getStats: async () => null, getPublished: async () => ({}) });
    await tick(); await tick();
    expect([...none.querySelectorAll('.prj-stat-lg b')].map((e) => e.textContent)).toEqual(['0', '—', '—']);
  });

  it('offers one contextual primary action per card', async () => {
    renderProjectsPanel(host, { ...deps, getStats: async () => ({ a: { plays: 5, needs_follow_up: false } }) });
    await tick(); await tick();
    expect(host.querySelector('[data-id="a"] .prj-primary').textContent).toBe('Analytics');
    expect(host.querySelector('[data-id="b"] .prj-primary').textContent).toBe('Publish');
    const h2 = document.createElement('div'); document.body.appendChild(h2);
    renderProjectsPanel(h2, { ...deps, getStats: async () => ({ a: { plays: 5, needs_follow_up: true } }) });
    await tick(); await tick();
    expect(h2.querySelector('[data-id="a"] .prj-primary').textContent).toBe('Retarget');
    h2.querySelector('[data-id="a"] .prj-primary').click();
    expect(h2.querySelector('.prj-tabs .active').textContent).toBe('Retarget');
  });

  it('filters sit behind a toggle', async () => {
    renderProjectsPanel(host, deps);
    await tick(); await tick();
    const f = host.querySelector('#prj-filters');
    expect(f.hidden).toBe(true);
    host.querySelector('[data-toggle-filters]').click();
    expect(f.hidden).toBe(false);
    expect(host.querySelector('[data-toggle-filters]').getAttribute('aria-expanded')).toBe('true');
  });

  it('mounts tab content, tears it down on change, and passes tab options', async () => {
    const cleanup = vi.fn();
    const analytics = vi.fn(() => cleanup);
    const notifications = vi.fn();
    renderProjectsPanel(host, { ...deps, tabs: { analytics, notifications } });
    await tick(); await tick();
    host.querySelector('[data-id="a"] [data-act="details"]').click();
    host.querySelector('[data-tab="analytics"]').click();
    expect(analytics).toHaveBeenCalledTimes(1);
    const ctx = analytics.mock.calls[0][1];
    expect(ctx.project.id).toBe('a');
    ctx.openTab('notifications', { focusId: 'n1' });          // e.g. clicking an opportunity
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(notifications.mock.calls[0][2]).toEqual({ focusId: 'n1' });
    expect(host.querySelector('.prj-tabs .active').textContent).toBe('Notifications');
  });

  it('searches and toggles list view', async () => {
    renderProjectsPanel(host, deps);
    await tick(); await tick();
    const input = host.querySelector('.prj-search');
    input.value = 'kitchen';
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 200));
    expect(host.querySelectorAll('.prj-card')).toHaveLength(1);
    input.value = 'zzz';
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 200));
    expect(host.textContent).toContain('No projects match');
    host.querySelector('[data-view="list"]').click();
    expect(host.querySelector('.prj-body').classList.contains('prj-list')).toBe(true);
  });

  it('opens the six-tab detail and an honest empty analytics state', async () => {
    renderProjectsPanel(host, deps);
    await tick(); await tick();
    host.querySelector('[data-id="b"] [data-act="details"]').click();
    expect([...host.querySelectorAll('.prj-tabs [data-tab]')].map((b) => b.textContent)).toEqual(DETAIL_TABS.map(([, l]) => l));
    host.querySelector('[data-tab="analytics"]').click();
    expect(host.querySelector('.prj-tabpanel').textContent).toContain('Publish this video');
    host.querySelector('[data-tab="share"]').click();
    expect(host.querySelector('.prj-tabpanel').textContent).toContain('Not published');
    host.querySelector('[data-act="back"]').click();
    expect(host.querySelectorAll('.prj-card')).toHaveLength(2);
  });

  it('shows an actionable error and an empty state', async () => {
    deps.getClient = async () => { throw new Error('Sign in to manage your projects'); };
    renderProjectsPanel(host, deps);
    await tick(); await tick();
    expect(host.querySelector('[role="alert"]').textContent).toContain('Sign in');
    expect(host.querySelector('[data-act="retry"]')).toBeTruthy();

    const h2 = document.createElement('div');
    document.body.appendChild(h2);
    renderProjectsPanel(h2, { ...deps, getClient: async () => clientFor([]) });
    await tick(); await tick();
    expect(h2.textContent).toContain('No projects yet');
  });

  it('escapes project names', async () => {
    const evil = [{ ...rows[0], name: '<img src=x onerror=alert(1)>' }];
    renderProjectsPanel(host, { ...deps, getClient: async () => clientFor(evil) });
    await tick(); await tick();
    expect(host.querySelector('.prj-name img')).toBeNull();
    expect(host.querySelector('.prj-name').textContent).toContain('<img');
  });

  it('formats durations', () => {
    expect(fmtDuration(null)).toBe('—');
    expect(fmtDuration(59.6)).toBe('1:00');
    expect(fmtDuration(65)).toBe('1:05');
  });

  it('replaces the list title, stats and search with the project header while a detail is open', async () => {
    renderProjectsPanel(host, deps);
    await tick(); await tick();
    host.querySelector('[data-id="a"] [data-act="details"]').click();
    for (const sel of ['.prj-title', '.prj-summary', '.prj-head']) expect(host.querySelector(sel).hidden, sel).toBe(true);
    host.querySelector('[data-act="back"]').click();
    for (const sel of ['.prj-title', '.prj-summary', '.prj-head']) expect(host.querySelector(sel).hidden, sel).toBe(false);
    expect(host.querySelector('#prj-filters').hidden).toBe(true); // filters stay behind their toggle
  });

  it('status chips use the panel\'s own chip class (not the editor-scoped pz-chip)', async () => {
    renderProjectsPanel(host, deps);
    await tick(); await tick();
    expect(host.querySelectorAll('.pz-chip').length).toBe(0);
    expect(host.querySelector('[data-id="a"] .prj-status').classList.contains('is-published')).toBe(true);
  });

  describe('heatmap strip on cards', () => {
    const curve = [0, 25, 50, 75, 100].map((p, i) => ({ positionPercent: p, retentionPercent: [100, 80, 60, 40, 20][i] }));
    const withPlays = (extra = {}) => ({
      ...deps,
      getStats: async () => ({ a: { plays: 12 } }),
      getRetention: vi.fn(async () => curve),
      ...extra,
    });

    it('draws 34 bars with an accessible summary under a played, published card', async () => {
      const d = withPlays();
      renderProjectsPanel(host, d);
      await tick(); await tick(); await tick();
      const strip = host.querySelector('[data-id="a"] .prj-heat');
      expect(strip).toBeTruthy();
      expect(strip.querySelectorAll('span')).toHaveLength(34);
      expect(strip.getAttribute('role')).toBe('img');
      expect(strip.getAttribute('aria-label')).toBe('Audience retention across the video: starts at 100%, ends at 20%');
      expect(d.getRetention).toHaveBeenCalledWith('abc12345');
    });

    it('shows a placeholder (no bars) for completed videos without viewers, and asks for nothing', async () => {
      const d = withPlays({ getStats: async () => ({ a: { plays: 0 }, b: { plays: 9 } }) });
      renderProjectsPanel(host, d);
      await tick(); await tick(); await tick();
      // a: completed, published, 0 plays -> placeholder; b: not rendered and not published -> nothing at all
      expect(host.querySelector('.prj-heat:not(.prj-heat-empty)')).toBeNull();
      const a = host.querySelector('[data-id="a"]');
      expect(a.querySelector('.prj-heat-empty')).toBeTruthy();
      expect(a.querySelector('.prj-heat-note').textContent).toBe('No viewer data yet. Share your video to see where viewers stay.');
      expect(host.querySelector('[data-id="b"] .prj-heat-slot')).toBeNull();
      expect(d.getRetention).not.toHaveBeenCalled();                // nothing worth asking for
    });

    it('completed but unpublished videos say how to get viewer data', async () => {
      renderProjectsPanel(host, withPlays({ getPublished: async () => ({}), getStats: async () => null }));
      await tick(); await tick(); await tick();
      const a = host.querySelector('[data-id="a"]');
      expect(a.querySelector('.prj-heat-note').textContent).toBe('Publish and share this video to see where viewers stay.');
      expect(a.querySelector('.prj-heat').getAttribute('aria-label')).toBe('Publish and share this video to see where viewers stay.');
      expect(host.querySelector('[data-id="b"] .prj-heat-slot')).toBeNull();   // not completed
    });

    it('a played video shows a loading strip, then its real bars', async () => {
      let release;
      const gate = new Promise((r) => { release = r; });
      renderProjectsPanel(host, withPlays({ getRetention: vi.fn(async () => { await gate; return curve; }) }));
      await tick(); await tick(); await tick();
      const loading = host.querySelector('[data-id="a"] .prj-heat');
      expect(loading.classList.contains('prj-heat-empty')).toBe(true);
      expect(host.querySelector('[data-id="a"] .prj-heat-note')).toBeNull();   // no note while loading
      release();
      await tick(); await tick(); await tick();
      const strip = host.querySelector('[data-id="a"] .prj-heat');
      expect(strip.classList.contains('prj-heat-empty')).toBe(false);
      expect(strip.querySelectorAll('span')).toHaveLength(34);
    });

    it('by default asks the database for the video\'s curve (30-day range) through the injected client', async () => {
      const rpc = vi.fn(async () => ({ data: [{ bucket: 0, viewers: 10, base: 10 }, { bucket: 50, viewers: 6, base: 10 }, { bucket: 99, viewers: 4, base: 10 }], error: null }));
      renderProjectsPanel(host, { ...deps, getStats: async () => ({ a: { plays: 12 } }), getClient: async () => ({ ...clientFor(rows), rpc }) });
      await tick(); await tick(); await tick();
      expect(rpc).toHaveBeenCalledTimes(1);
      const [name, args] = rpc.mock.calls[0];
      expect(name).toBe('video_retention_curve');
      expect(args.p_video_id).toBe('abc12345');
      expect(args.p_from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(args.p_to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(host.querySelector('[data-id="a"] .prj-heat')).toBeTruthy();
    });

    it('a failing database call (or a client without rpc) says the data is unavailable, never bars', async () => {
      const rpc = vi.fn(async () => ({ data: null, error: { message: 'denied' } }));
      renderProjectsPanel(host, { ...deps, getStats: async () => ({ a: { plays: 12 } }), getClient: async () => ({ ...clientFor(rows), rpc }) });
      await tick(); await tick(); await tick();
      expect(host.querySelector('.prj-heat:not(.prj-heat-empty)')).toBeNull();
      expect(host.querySelector('[data-id="a"] .prj-heat-note').textContent).toBe('Viewer data is not available right now.');
      const other = document.createElement('div'); document.body.appendChild(other);
      renderProjectsPanel(other, { ...deps, getStats: async () => ({ a: { plays: 12 } }) });   // test client has no rpc
      await tick(); await tick(); await tick();
      expect(other.querySelector('.prj-heat:not(.prj-heat-empty)')).toBeNull();
      expect(other.querySelectorAll('.prj-card')).toHaveLength(2);
    });

    it('never draws bars when the request fails or returns nothing', async () => {
      for (const getRetention of [vi.fn(async () => { throw new Error('boom'); }), vi.fn(async () => []), vi.fn(async () => null)]) {
        const h = document.createElement('div'); document.body.appendChild(h);
        renderProjectsPanel(h, withPlays({ getRetention }));
        await tick(); await tick(); await tick();
        expect(h.querySelector('.prj-heat:not(.prj-heat-empty)')).toBeNull();
        expect(h.querySelector('[data-id="a"] .prj-heat-note').textContent).toBe('Viewer data is not available right now.');
        expect(h.querySelector('[data-id="a"] .prj-line').textContent).toContain('12 plays');
        expect(h.querySelectorAll('.prj-card')).toHaveLength(2);
      }
    });

    it('asks for at most four curves at a time', async () => {
      const many = Array.from({ length: 9 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z', render: {}, tags: [] }));
      let running = 0; let peak = 0;
      const getRetention = vi.fn(async () => { running++; peak = Math.max(peak, running); await tick(); running--; return curve; });
      renderProjectsPanel(host, {
        ...deps,
        getClient: async () => clientFor(many),
        getPublished: async (ids) => Object.fromEntries(ids.map((id) => [id, { id: `v-${id}`, published: true }])),
        getStats: async (ids) => Object.fromEntries(ids.map((id) => [id, { plays: 3 }])),
        getRetention,
      });
      for (let i = 0; i < 12; i++) await tick();
      expect(getRetention).toHaveBeenCalledTimes(9);
      expect(peak).toBeLessThanOrEqual(4);
      expect(host.querySelectorAll('.prj-heat')).toHaveLength(9);
    });

    it('keeps strips when the view or search changes', async () => {
      renderProjectsPanel(host, withPlays());
      await tick(); await tick(); await tick();
      host.querySelector('[data-view="list"]').click();
      expect(host.querySelector('[data-id="a"] .prj-heat')).toBeTruthy();
    });

    it('decides which cards get the area and which can have data', () => {
      const base = { renderStatus: 'not_rendered', published: false, publishedId: null, plays: null };
      expect(wantsHeat({ ...base })).toBe(false);
      expect(wantsHeat({ ...base, renderStatus: 'complete' })).toBe(true);
      expect(wantsHeat({ ...base, published: true, publishedId: 'v', plays: 5 })).toBe(true);   // viewer data even if not rendered
      expect(canHaveHeat({ ...base, renderStatus: 'complete' })).toBe(false);
      expect(canHaveHeat({ ...base, published: true, publishedId: 'v', plays: 0 })).toBe(false);
      expect(canHaveHeat({ ...base, published: true, publishedId: 'v', plays: 5 })).toBe(true);
    });

    it('placeholder html is 34 muted slices with an escaped, accessible note', () => {
      const html = heatPlaceholderHtml('unwatched');
      expect((html.match(/<span><\/span>/g) || [])).toHaveLength(34);
      expect(html).toContain('prj-heat-empty');
      expect(html).toContain('No viewer data yet. Share your video');
      expect(heatPlaceholderHtml('loading')).not.toContain('prj-heat-note');
    });

    it('builds nothing from an empty curve and escapes nothing unsafe', () => {
      expect(heatStripHtml([])).toBe('');
      expect(heatStripHtml(null)).toBe('');
      const html = heatStripHtml([{ positionPercent: 0, retentionPercent: '<b>' }, { positionPercent: 100, retentionPercent: 50 }]);
      expect(html).not.toContain('<b>');
      expect(html).toContain('height:7%');
    });
  });
});
