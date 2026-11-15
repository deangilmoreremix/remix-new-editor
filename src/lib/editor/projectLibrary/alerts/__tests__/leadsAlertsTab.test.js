// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { leadsAlertsTab } from '../leadsAlertsTab.js';

const NOW = Date.parse('2026-11-15T12:00:00Z');
const base = (over = {}) => ({
  notes: [{ id: 'a', type: 'new_lead', title: 'New lead from <b>Acme</b>', summary: 'They filled the form', read_at: null, created_at: new Date(NOW - 60_000).toISOString(), pushed_at: new Date(NOW).toISOString() },
          { id: 'b', type: 'daily_digest', title: 'Daily summary', summary: 'Yesterday', read_at: null, created_at: new Date(NOW - 3600_000).toISOString(), pushed_at: null },
          { id: 'c', type: 'pricing_cta', title: 'Pricing clicked', summary: 'x', read_at: null, created_at: new Date(NOW - 30_000).toISOString(), pushed_at: null }],
  pushedKnown: true, now: NOW,
  leads: { count: 12, rows: [{ id: 'l1', kind: 'lead-form', created_at: new Date(NOW).toISOString(), data: { NAME: '<img src=x onerror=alert(1)>', EMAIL: 'a@acme.com' } }] },
  server: { configured: true, devices: 0, publicKey: 'K' }, topRecommendation: { title: 'Pricing explained', observed: '3 sessions showed interest.', suggestion: 'Create a follow-up video.' }, ...over });
const mount = async (data, extra = {}) => {
  const panel = document.createElement('div'); document.body.appendChild(panel);
  const ctx = { project: { id: 'p1', name: 'My video', videoId: 'vid12345' }, openTab: vi.fn() };
  const deps = { getClient: async () => ({}), loadFn: async () => data, openLeads: vi.fn(), enableFn: vi.fn(async () => ({ ok: true, devices: 1 })), ...extra };
  const stop = leadsAlertsTab(deps)(panel, ctx); await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0));
  return { panel, ctx, deps, stop };
};
afterEach(() => { document.body.innerHTML = ''; });

describe('Leads & alerts tab', () => {
  it('shows leads, alerts and why each was or was not pushed, in plain words', async () => {
    const { panel } = await mount(base());
    expect(panel.querySelector('[data-testid="la-summary"]').textContent).toMatch(/12 leads/); expect(panel.querySelector('[data-testid="la-summary"]').textContent).toMatch(/3 unread alerts/); expect(panel.querySelector('[data-testid="la-summary"]').textContent).toMatch(/1 sent to your devices/)
    const chips = Object.fromEntries([...panel.querySelectorAll('[data-n]')].map((el) => [el.dataset.n, el.querySelector('[data-push]').dataset.push]))
    expect(chips).toEqual({ a: 'pushed', b: 'in-app-only', c: 'not-pushed' }); expect(panel.querySelector('[data-n="c"]').textContent).toMatch(/No device had notifications turned on/)
    expect(panel.querySelector('[data-testid="la-push"]').textContent).toMatch(/No device has notifications turned on/); expect(panel.querySelector('[data-testid="la-retarget"]').textContent).toMatch(/Pricing explained/)
  });
  it('escapes everything that came from the database (titles and lead answers)', async () => {
    const { panel } = await mount(base());
    expect(panel.querySelector('b')).toBeNull(); expect(panel.querySelector('img')).toBeNull(); expect(panel.textContent).toMatch(/New lead from <b>Acme<\/b>/); expect(panel.textContent).toMatch(/<img src=x onerror=alert\(1\)>/)
  });
  it('the buttons go where they say: all leads, alert history, retarget', async () => {
    const { panel, ctx, deps } = await mount(base());
    panel.querySelector('[data-open-leads]').click(); expect(deps.openLeads).toHaveBeenCalled()
    panel.querySelector('[data-open-alerts]').click(); expect(ctx.openTab).toHaveBeenCalledWith('notifications')
    panel.querySelector('[data-open-retarget]').click(); expect(ctx.openTab).toHaveBeenCalledWith('retarget')
  });
  it('"Turn on notifications" uses the server public key, then reloads the view; a refusal is explained and the button comes back', async () => {
    const enableFn = vi.fn(async () => ({ ok: false, reason: 'denied', message: 'Notifications are blocked in this browser.' }))
    const { panel } = await mount(base(), { enableFn }); panel.querySelector('[data-enable]').click(); await new Promise((r) => setTimeout(r, 0))
    expect(enableFn).toHaveBeenCalledWith('K', undefined, 'This browser'); expect(panel.querySelector('[data-enable-msg]').textContent).toMatch(/blocked/); expect(panel.querySelector('[data-enable]').disabled).toBe(false)
  });
  it('no button when push is not set up on the server; says so instead', async () => {
    const { panel } = await mount(base({ server: { configured: false, devices: 0, publicKey: null } }))
    expect(panel.querySelector('[data-enable]')).toBeNull(); expect(panel.querySelector('[data-testid="la-push"]').textContent).toMatch(/not set up on this server/); expect(panel.querySelector('[data-n="c"]').textContent).toMatch(/not set up on this server/)
  });
  it('empty states are friendly, and a leads error is shown without hiding the alerts', async () => {
    const empty = await mount(base({ notes: [], leads: { count: 0, rows: [] }, topRecommendation: null })); expect(empty.panel.textContent).toMatch(/No leads yet/); expect(empty.panel.textContent).toMatch(/No alerts yet/); expect(empty.panel.querySelector('[data-testid="la-retarget"]')).toBeNull()
    document.body.innerHTML = ''; const err = await mount(base({ leads: { count: 0, rows: [], error: 'permission denied' } })); expect(err.panel.querySelector('[data-testid="la-leads"]').textContent).toMatch(/permission denied/); expect(err.panel.querySelectorAll('[data-n]')).toHaveLength(3)
  });
  it('a failed load shows a clear message, and unmounting stops late updates', async () => {
    const { panel } = await mount(null, { loadFn: async () => { throw new Error('Publish this video first.'); } }); expect(panel.textContent).toMatch(/Could not load leads and alerts/); expect(panel.textContent).toMatch(/Publish this video first/)
    let release; const slow = new Promise((r) => { release = r; }); const p2 = document.createElement('div'); const stop = leadsAlertsTab({ getClient: async () => ({}), loadFn: () => slow })(p2, { project: { videoId: 'v' }, openTab() {} }); await new Promise((r) => setTimeout(r, 0)); stop(); release(base()); await new Promise((r) => setTimeout(r, 0)); expect(p2.textContent).not.toMatch(/Leads/)
  });
});
