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
    const cards = host.querySelectorAll('.prj-card');
    expect(cards).toHaveLength(2);
    const a = host.querySelector('[data-id="a"]');
    expect(a.textContent).toContain('Published');
    expect(a.textContent).toContain('1:05');
    // plays = 0 is a real zero; viewers were never collected => unavailable marker
    expect(a.querySelector('.prj-metrics div:nth-child(1) dd').textContent).toBe('0');
    expect(a.querySelector('.prj-metrics div:nth-child(2) .prj-na')).toBeTruthy();
    // project without any stats shows unavailable everywhere
    expect(host.querySelector('[data-id="b"]').querySelectorAll('.prj-na').length).toBe(5);
    expect(host.querySelector('[data-id="b"]').classList.contains('is-current')).toBe(true);
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
