// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderProjectsPanel, fmtDuration, DETAIL_TABS } from '../projectsPanel.js';

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
});
