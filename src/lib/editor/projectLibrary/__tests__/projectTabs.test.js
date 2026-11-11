// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { seedInterestMap, cleanInterestMap, cleanPreferences, saveInterestMap, DEFAULT_PREFERENCES } from '../tabsData.js';
import { audienceTab, retargetTab, notificationsTab } from '../projectTabs.js';

const NOW = new Date('2026-11-11T15:30:00Z');
const tick = (n = 6) => new Promise((r) => { let i = 0; const go = () => (++i >= n ? r() : setTimeout(go, 0)); go(); });

const PROJECT_STATE = { timelineSeconds: 100, tracks: [
  { type: 'video', items: [{ id: 'a', name: 'Roof repair', left: 0, width: 50 }, { id: 'b', name: 'Kitchens', left: 50, width: 50 }] },
  { type: 'text', items: [{ id: 'cta1', type: 'click-to-call', buttonText: 'Book roof inspection', left: 10, width: 20 }, { id: 'form1', type: 'lead-form', left: 60, width: 10 }] }] };

describe('interest mapping', () => {
  it('seeds from timeline scenes, links the CTAs shown during each, and keeps saved mappings', () => {
    const map = seedInterestMap(PROJECT_STATE, [{ id: 'a', interest: { type: 'service', label: 'Roof repair' } }]);
    expect(map.map((m) => [m.id, m.title, m.start, m.end, m.clipIds])).toEqual([['a', 'Roof repair', 0, 50, ['cta1']], ['b', 'Kitchens', 50, 100, ['form1']]]);
    expect(map[0].interest).toEqual({ type: 'service', label: 'Roof repair' });
    expect(map[1].interest).toBeNull();
    expect(seedInterestMap({ timelineSeconds: 10, tracks: [] })).toEqual([]);
  });
  it('cleans owner input (types, labels, lengths) and drops unmapped/invalid rows from what is saved', async () => {
    const cleaned = cleanInterestMap([
      { id: 'a', title: 'T', start: 0, end: 10, interest: { type: 'bogus', label: '  Roof   repair ' }, clipIds: [1, 2] },
      { id: 'b', start: 5, end: 5, interest: { type: 'product', label: 'x' } },
      { id: 'c', title: 'C', start: 10, end: 20, interest: { type: 'product', label: '' } },
    ]);
    expect(cleaned).toEqual([
      { id: 'a', title: 'T', start: 0, end: 10, interest: { type: 'topic', label: 'Roof repair' }, clipIds: ['1', '2'] },
      { id: 'c', title: 'C', start: 10, end: 20, interest: null, clipIds: [] },
    ]);
    const update = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
    const saved = await saveInterestMap({ from: () => ({ update }) }, 'p1', { keep: 1 }, cleaned);
    expect(saved).toHaveLength(1);                       // only mapped sections become interests
    expect(update).toHaveBeenCalledWith({ settings: { keep: 1, interestMap: saved } });
  });
  it('cleans notification preferences', () => {
    expect(cleanPreferences({ enabled_types: ['new_lead', 'hack'], in_app: 1, email: 1, digest_frequency: 'hourly', interest_threshold: '9999', quiet_hours: { start: '22:00', end: 'x' } }))
      .toEqual({ enabled_types: ['new_lead'], in_app: true, email: true, digest_frequency: 'daily', interest_threshold: 500, quiet_hours: null });
    expect(cleanPreferences({ ...DEFAULT_PREFERENCES, quiet_hours: { start: '22:00', end: '07:00' } }).quiet_hours).toEqual({ start: '22:00', end: '07:00' });
  });
});

/** Client double covering tables + RPCs used by the tabs. */
function client(o = {}) {
  const calls = [];
  const state = { notes: o.notes || [], prefs: o.prefs || null, followups: o.followups || [], inserted: [] };
  const from = (table) => {
    const q = { table, f: [] };
    const api = {
      select: () => api, eq: (c, v) => { q.f.push([c, v]); return api; }, is: () => api, order: () => api, limit: () => api,
      upsert: async (row) => { calls.push(['upsert', table, row]); state.prefs = row; return { error: null }; },
      insert: (row) => { q.ins = row; return api; },
      single: async () => { const r = { id: 'new-proj', name: q.ins.name, ...q.ins }; state.inserted.push(r); return { data: r, error: null }; },
      maybeSingle: async () => {
        if (table === 'published_videos') return { data: o.video === undefined ? { id: 'vid-1', title: 'Roofing', published: true, slug: 'roofing', project: { timelineSeconds: 100, tracks: [], interestMap: [] } } : o.video, error: null };
        if (table === 'video_owner_profiles') return { data: { business_slug: 'acme' }, error: null };
        if (table === 'retarget_preferences') return { data: state.prefs, error: null };
        if (table === 'timeline_projects') return { data: { id: 'orig', name: 'Roofing promo', data: PROJECT_STATE, tags: [], settings: {} }, error: null };
        return { data: null, error: null };
      },
      then: (res, rej) => Promise.resolve({ data: table === 'owner_notifications' ? state.notes : table === 'timeline_projects' ? state.followups : [], error: null }).then(res, rej),
    };
    return api;
  };
  const rpc = async (name, args) => {
    calls.push(['rpc', name, args]);
    if (name === 'mark_notifications_read') { state.notes.forEach((n) => { if (!args.p_ids || args.p_ids.includes(n.id)) n.read_at = 'now'; }); return { data: 1, error: null }; }
    return { data: (o.rpcs || {})[name] ?? [], error: null };
  };
  return { from, rpc, calls, state };
}
// The Projects LIST row deliberately has no `data` (it is heavy); tabs must load the full project themselves.
const ORIGINAL = { id: 'orig', name: 'Roofing promo', settings: {}, thumbnail_url: 'https://cdn/t.png' };
const mount = (tab, c, extra = {}, ctxOver = {}) => {
  const panel = document.createElement('div'); document.body.appendChild(panel);
  const ctx = { project: ORIGINAL, openTab: vi.fn(), ...ctxOver };
  const deps = { getClient: async () => c, now: () => NOW, navigate: vi.fn(), onToast: vi.fn(), onUnreadChanged: vi.fn(), ...extra };
  const cleanup = tab(deps)(panel, ctx, extra.tabOpts || {});
  return { panel, ctx, deps, cleanup };
};

beforeEach(() => {
  const m = new Map();
  vi.stubGlobal('sessionStorage', { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } });
});

describe('Audience tab', () => {
  const rpcs = {
    video_audience_segments: [{ segment: 'new_viewers', sessions: 7 }, { segment: 'returning_viewers', sessions: 2 }, { segment: 'high_interest', sessions: 1 }],
    video_interest_summary: [{ interest: 'Roof repair', interest_type: 'service', sessions: 5, decayed_score: 210.5, high_interest_sessions: 1 }, { interest: 'Pricing', interest_type: 'pricing', sessions: 2, decayed_score: 60, high_interest_sessions: 0 }],
  };
  it('shows anonymous segment counts, interests, the plain-language score explanation and re-queries by period', async () => {
    const c = client({ rpcs });
    const { panel } = mount(audienceTab, c);
    await tick();
    expect(panel.textContent).toContain('not named people');
    expect(panel.textContent).toContain('Roof repair');
    expect([...panel.querySelectorAll('.sv-stat')].map((e) => e.textContent)).toContain('New viewers7');
    expect(panel.textContent).not.toMatch(/customer/i);
    const q = (name) => c.calls.filter(([k, n]) => k === 'rpc' && n === name).map(([, , a]) => [a.p_from, a.p_to]);
    expect(q('video_audience_segments')).toEqual([['2026-10-13', '2026-11-11']]);
    panel.querySelector('[data-p="7d"]').click();
    await tick();
    expect(q('video_audience_segments').at(-1)).toEqual(['2026-11-05', '2026-11-11']);
  });
  it('says so when there are no sessions, and when unpublished', async () => {
    const empty = mount(audienceTab, client({ rpcs: { video_audience_segments: [], video_interest_summary: [] } }));
    await tick();
    expect(empty.panel.textContent).toContain('No viewing sessions in this period yet');
    const unpublished = mount(audienceTab, client({ video: null }));
    await tick();
    expect(unpublished.panel.textContent).toContain('Publish this video first');
  });
});

describe('Retarget tab', () => {
  const rpcs = {
    video_audience_segments: [{ segment: 'returning_viewers', sessions: 2 }],
    video_interest_summary: [{ interest: 'Roof repair', interest_type: 'service', sessions: 5, decayed_score: 210, high_interest_sessions: 2 }],
  };
  it('turns observed engagement into recommendations (observed vs recommended) and launches the existing personalization flow', async () => {
    const c = client({ rpcs });
    const { panel, deps } = mount(retargetTab, c);
    await tick(10);
    expect(panel.textContent).toContain('Observed: 5 viewing sessions showed interest in "Roof repair", 2 of them strongly.');
    expect(panel.textContent).toContain('Recommendation: Create a follow-up video');
    expect(panel.textContent).toContain('Nothing is sent to anyone automatically');
    panel.querySelector('[data-rec="0"]').click();
    await tick(10);
    expect(c.state.inserted[0]).toMatchObject({ parent_project_id: 'orig', name: 'Roofing promo: Roof repair follow-up' }); // saved as a new, linked project
    expect(deps.navigate).toHaveBeenCalledWith('personalizer');
    const handoff = JSON.parse(sessionStorage.getItem('remix_personalizer_handoff'));
    expect(handoff.asset.metadata).toMatchObject({ originalProjectId: 'orig', interest: 'Roof repair' });
  });
  it('lists timeline scenes for interest mapping and saves the mapping to the project', async () => {
    const c = client({ rpcs: { video_audience_segments: [], video_interest_summary: [] } });
    const upd = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
    const base = c.from;
    c.from = (t) => (t === 'timeline_projects' ? { ...base(t), update: upd } : base(t));
    const saved = vi.fn();
    const { panel } = mount(retargetTab, c, { onInterestMapSaved: saved });
    await tick(10);
    expect(panel.textContent).toContain('No recommendations yet');
    expect(panel.querySelectorAll('[data-row]')).toHaveLength(2);
    panel.querySelector('[data-label="0"]').value = 'Roof repair';
    panel.querySelector('[data-type="0"]').value = 'service';
    panel.querySelector('[data-save-map]').click();
    await tick();
    expect(upd).toHaveBeenCalledTimes(1);
    expect(upd.mock.calls[0][0].settings.interestMap).toEqual([{ id: 'a', title: 'Roof repair', start: 0, end: 50, interest: { type: 'service', label: 'Roof repair' }, clipIds: ['cta1'] }]);
    expect(panel.querySelector('[data-map-msg]').textContent).toContain('Publish again');
  });
  it('without evidence it recommends nothing', async () => {
    const { panel } = mount(retargetTab, client({ rpcs: { video_audience_segments: [], video_interest_summary: [] } }));
    await tick(10);
    expect(panel.querySelector('[data-rec]')).toBeNull();
  });
});

describe('Notifications tab', () => {
  const notes = () => [
    { id: 'n1', type: 'high_interest', title: 'High-interest viewer', summary: 'A viewing session showed strong interest.', interest: 'Roof repair', metrics: { score: 80, type: 'service' }, read_at: null, created_at: '2026-11-11T10:00:00Z' },
    { id: 'n2', type: 'new_lead', title: 'New lead captured', summary: 'A viewer submitted a form.', interest: null, metrics: {}, read_at: 'x', created_at: '2026-11-10T10:00:00Z' },
  ];
  it('shows history with type, interest, observed score, timestamp and read state; no fabricated names', async () => {
    const { panel } = mount(notificationsTab, client({ notes: notes() }));
    await tick();
    const first = panel.querySelector('[data-n="n1"]');
    expect(first.textContent).toContain('High-interest viewer');
    expect(first.textContent).toContain('Interest: Roof repair');
    expect(first.textContent).toContain('Observed engagement score: 80');
    expect(first.querySelector('[aria-label="Unread"]')).toBeTruthy();
    expect(panel.querySelector('[data-n="n2"] [aria-label="Unread"]')).toBeNull();
    expect(panel.textContent).not.toMatch(/\b(John|Jane|Smith)\b/);
  });
  it('marks one and all as read through the RPC and refreshes the unread count', async () => {
    const c = client({ notes: notes() });
    const { panel, deps } = mount(notificationsTab, c);
    await tick();
    panel.querySelector('[data-n="n1"] [data-read]').click();
    await tick();
    expect(c.calls).toContainEqual(['rpc', 'mark_notifications_read', { p_ids: ['n1'] }]);
    expect(deps.onUnreadChanged).toHaveBeenCalled();
    expect(panel.querySelector('[data-n="n1"] [aria-label="Unread"]')).toBeNull();
    expect(panel.querySelector('[data-read-all]')).toBeNull(); // nothing left unread
  });
  it('opening an opportunity from analytics focuses it and marks it read', async () => {
    const c = client({ notes: notes() });
    mount(notificationsTab, c, { tabOpts: { focusId: 'n1' } });
    await tick(10);
    expect(c.calls).toContainEqual(['rpc', 'mark_notifications_read', { p_ids: ['n1'] }]);
  });
  it('action buttons open analytics / engagement / retarget and create a follow-up', async () => {
    const c = client({ notes: notes() });
    const { panel, ctx, deps } = mount(notificationsTab, c);
    await tick();
    const row = panel.querySelector('[data-n="n1"]');
    row.querySelector('[data-go="analytics"]').click();
    row.querySelector('[data-go="audience"]').click();
    row.querySelector('[data-go="retarget"]').click();
    expect(ctx.openTab.mock.calls.map((x) => x[0])).toEqual(['analytics', 'audience', 'retarget']);
    row.querySelector('[data-follow]').click();
    await tick(10);
    expect(deps.navigate).toHaveBeenCalledWith('personalizer');
    expect(panel.querySelector('[data-n="n2"] [data-follow]')).toBeNull(); // no interest, no follow-up
  });
  it('saves preferences and states honestly that email needs configuration', async () => {
    const c = client({ notes: [] });
    const { panel } = mount(notificationsTab, c);
    await tick();
    expect(panel.textContent).toContain('Email delivery requires configuration');
    expect(panel.querySelector('[name=email]').disabled).toBe(true);
    panel.querySelectorAll('[name=type]').forEach((b) => { b.checked = b.value === 'new_lead' || b.value === 'high_interest'; });
    panel.querySelector('[name=threshold]').value = '80';
    panel.querySelector('[name=digest]').value = 'weekly';
    panel.querySelector('[data-prefs]').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await tick();
    const saved = c.calls.find((x) => x[0] === 'upsert')[2];
    expect(saved).toMatchObject({ enabled_types: ['new_lead', 'high_interest'], interest_threshold: 80, digest_frequency: 'weekly', in_app: true, email: false });
    expect(panel.querySelector('[data-prefs-msg]').textContent).toBe('Saved.');
  });
});
