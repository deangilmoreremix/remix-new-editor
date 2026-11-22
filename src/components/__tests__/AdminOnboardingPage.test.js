// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { AdminOnboardingPage, funnelRows, formatSeconds } from '../AdminOnboardingPage.js';

const report = {
  ok: true,
  funnel: [
    { key: 'signup', label: 'Signed up', people: 12 }, { key: 'start', label: 'Started', people: 10 }, { key: 'step_1', label: 'Step 1', people: 10 },
    { key: 'step_2', label: 'Step 2', people: 8 }, { key: 'ready', label: 'Get ready screen', people: 4 }, { key: 'complete', label: 'Finished', people: 3 },
  ],
  left_for_academy: 2, median_seconds_to_complete: 185.4, keys: { saved: 2, tested_ok: 1 },
  top_goal: [{ value: 'ai-video', count: 5 }], top_team: [], top_volume: [], top_heard: [{ value: '<img src=x onerror=alert(1)>', count: 1 }],
  top_first_studio: [{ value: 'avatar', count: 2 }], top_types: [], top_studios: [{ value: 'image', count: 3 }],
};
const reply = (body, status = 200) => vi.fn(async () => ({ ok: status < 300, status, json: async () => body }));
const flush = () => new Promise((r) => setTimeout(r, 0));
const NOW = new Date('2026-11-22T12:00:00Z');
const mount = (over = {}) => { const p = AdminOnboardingPage({ now: () => NOW, getToken: async () => 'tok', fetchImpl: reply(report), ...over }); document.body.replaceChildren(p); return p; };
const q = (s, r = document) => r.querySelector(s);

describe('funnel math', () => {
  it('shares are of those who started; drop is from the stage before; signup is shown as a count only', () => {
    const rows = funnelRows(report.funnel);
    const by = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(by.signup).toMatchObject({ people: 12, pct: null, drop: null });
    expect(by.start).toMatchObject({ pct: 100, drop: null });
    expect(by.step_2).toMatchObject({ pct: 80, drop: 20 });
    expect(by.ready).toMatchObject({ pct: 40, drop: 50 });
    expect(by.complete).toMatchObject({ pct: 30, drop: 25 });
  });
  it('no one started means no percentages, never a divide by zero', () => {
    expect(funnelRows([{ key: 'start', label: 'Started', people: 0 }, { key: 'step_1', label: 'S1', people: 0 }]).every((r) => r.pct === null)).toBe(true);
  });
  it('formats seconds as m:ss', () => {
    expect(formatSeconds(185.4)).toBe('3:05');
    expect(formatSeconds(null)).toBe('-');
    expect(formatSeconds(-1)).toBe('-');
  });
});

describe('admin onboarding page', () => {
  it('asks for the last 30 days with the session token, shows loading, then the funnel and summary', async () => {
    const f = reply(report);
    const p = mount({ fetchImpl: f });
    expect(p.textContent).toContain('Loading');
    await flush(); await flush();
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('/api/admin/onboarding-funnel?from=2026-10-23&to=2026-11-22');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(q('[data-funnel-row="step_2"]', p).textContent).toContain('8 · 80% · -20% from the step before');
    expect(q('[data-card-finished]', p).textContent).toContain('3 (30%)');
    expect(q('[data-card-median]', p).textContent).toContain('3:05');
    expect(q('[data-card-keys]', p).textContent).toContain('2 / 1');
    expect(q('[data-table="top_team"]', p).textContent).toContain('No answers yet.');
  });

  it('writes values as text, never as HTML', async () => {
    const p = mount(); await flush(); await flush();
    expect(p.querySelector('img')).toBeNull();
    expect(q('[data-table="top_heard"]', p).textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('shows only "not available" for 403, 401, a failed request, a body that is not ok, or no session', async () => {
    for (const over of [{ fetchImpl: reply({ ok: false }, 403) }, { fetchImpl: reply({}, 401) }, { fetchImpl: vi.fn(async () => { throw new Error('net'); }) },
      { fetchImpl: reply({ ok: false, error: 'x' }) }, { fetchImpl: reply({ ok: true }) }, { getToken: async () => null }, { getToken: async () => { throw new Error('no clerk'); } }]) {
      const p = mount(over); await flush(); await flush();
      expect(p.textContent.trim()).toBe('This page is not available.');
    }
  });
  it('makes no request at all without a session', async () => {
    const f = reply(report);
    mount({ fetchImpl: f, getToken: async () => null }); await flush(); await flush();
    expect(f).not.toHaveBeenCalled();
  });

  it('range presets and the date inputs refetch with the new range', async () => {
    const f = reply(report);
    const p = mount({ fetchImpl: f }); await flush(); await flush();
    q('[data-range-preset="7"]', p).click(); await flush(); await flush();
    expect(f.mock.calls.at(-1)[0]).toBe('/api/admin/onboarding-funnel?from=2026-11-15&to=2026-11-22');
    q('[data-range-from]', p).value = '2026-11-01'; q('[data-range-to]', p).value = '2026-11-10';
    q('[data-range-apply]', p).click(); await flush(); await flush();
    expect(f.mock.calls.at(-1)[0]).toBe('/api/admin/onboarding-funnel?from=2026-11-01&to=2026-11-10');
  });
});
