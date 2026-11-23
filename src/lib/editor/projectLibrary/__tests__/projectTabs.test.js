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
      .toEqual({ enabled_types: ['new_lead'], in_app: true, email: true, digest_frequency: 'daily', interest_threshold: 500, quiet_hours: null, push: false, push_types: ['new_lead'] });
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
      select: () => api, eq: (c, v) => { q.f.push([c, v]); return api; }, is: () => api, or: () => api, order: () => api, limit: () => api, range: (a, b) => { q.range = [a, b]; return api; },
      upsert: async (row) => { calls.push(['upsert', table, row]); if (o.beforeUpsert) await o.beforeUpsert(row); const err = o.upsertError?.(row); if (err) return { error: err }; state.prefs = row; return { error: null }; },
      insert: (row) => { q.ins = row; return api; },
      single: async () => { const r = { id: 'new-proj', name: q.ins.name, ...q.ins }; state.inserted.push(r); return { data: r, error: null }; },
      maybeSingle: async () => {
        if (table === 'published_videos') return { data: o.video === undefined ? { id: 'vid-1', title: 'Roofing', published: true, slug: 'roofing', project: { timelineSeconds: 100, tracks: [], interestMap: [] } } : o.video, error: null };
        if (table === 'video_owner_profiles') return { data: { business_slug: 'acme' }, error: null };
        if (table === 'retarget_preferences') return { data: state.prefs, error: null };
        if (table === 'timeline_projects') return { data: { id: 'orig', name: 'Roofing promo', data: PROJECT_STATE, tags: [], settings: {} }, error: null };
        return { data: null, error: null };
      },
      then: (res, rej) => Promise.resolve({ data: table === 'owner_notifications' ? (q.range ? state.notes.slice(q.range[0], q.range[1] + 1) : state.notes) : table === 'timeline_projects' ? state.followups : [], error: null }).then(res, rej),
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
  it('pages long histories: first page then Load more appends the rest', async () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ id: 'p' + i, type: 'new_lead', title: 'Lead ' + i, summary: 's', interest: null, metrics: {}, read_at: 'x', created_at: '2026-11-10T10:00:00Z' }));
    const { panel } = mount(notificationsTab, client({ notes: many }));
    await tick();
    expect(panel.querySelectorAll('[data-n]').length).toBe(20);
    panel.querySelector('[data-more]').click();
    await tick();
    expect(panel.querySelectorAll('[data-n]').length).toBe(25);
    expect(panel.querySelector('[data-more]')).toBeNull();
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
  it('saves preferences; the Email alerts box is usable and the note makes no delivery claim', async () => {
    const c = client({ notes: [] });
    const { panel } = mount(notificationsTab, c);
    await tick();
    expect(panel.textContent).toContain('Email alerts go to the address on your account. Pushes and email follow the same quiet hours.');
    expect(panel.textContent).not.toMatch(/requires configuration|no email provider/i);
    expect(panel.querySelector('[name=email]').disabled).toBe(false);
    expect(panel.querySelector('[name=email]').checked).toBe(false);
    panel.querySelectorAll('[name=type]').forEach((b) => { b.checked = b.value === 'new_lead' || b.value === 'high_interest'; });
    panel.querySelector('[name=threshold]').value = '80';
    panel.querySelector('[name=digest]').value = 'weekly';
    panel.querySelector('[data-prefs]').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await tick();
    const saved = c.calls.find((x) => x[0] === 'upsert')[2];
    expect(saved).toMatchObject({ enabled_types: ['new_lead', 'high_interest'], interest_threshold: 80, digest_frequency: 'weekly', in_app: true, email: false });
    expect(panel.querySelector('[data-prefs-msg]').textContent).toBe('Saved.');
  });
  it('the Email alerts box reflects the saved value and is saved', async () => {
    const c = client({ notes: [], prefs: { ...DEFAULT_PREFERENCES, email: true } });
    const { panel } = mount(notificationsTab, c);
    await tick();
    const box = panel.querySelector('[name=email]');
    expect(box.checked).toBe(true);
    const send = async () => { panel.querySelector('[data-prefs]').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); await tick(); };
    await send();
    expect(c.calls.find((x) => x[0] === 'upsert')[2].email).toBe(true);
    box.checked = false;
    await send();
    expect(c.calls.filter((x) => x[0] === 'upsert').pop()[2].email).toBe(false);
  });
});

describe('Notifications preferences: per-type push and quiet hours', () => {
  const KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
  const pushEnv = () => {
    const reg = { pushManager: { getSubscription: async () => null }, showNotification: async () => {} };
    return { navigator: { userAgent: 'Chrome', serviceWorker: { getRegistration: async () => reg } }, Notification: { permission: 'granted' }, PushManager: function PushManager() {} };
  };
  const usable = () => ({ push: { vapidKey: KEY, env: pushEnv() } });
  const row = (panel, k) => ({ alert: panel.querySelector(`[name=type][value="${k}"]`), push: panel.querySelector(`[name=pushtype][value="${k}"]`) });
  const submit = async (panel) => { panel.querySelector('[data-prefs]').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); await tick(); };
  const change = (el, checked) => { el.checked = checked; el.dispatchEvent(new Event('change', { bubbles: true })); };

  it('shows the helper text, an Alert and a Push box per type, and no Push box for daily_digest', async () => {
    const { panel } = mount(notificationsTab, client({ prefs: { ...DEFAULT_PREFERENCES, push: true } }), usable());
    await tick(12);
    expect(panel.querySelector('[data-prefs]').textContent).toContain('Alerts always appear in the app. Choose which ones also send a push to your devices.');
    expect(panel.querySelectorAll('[name=pushtype]')).toHaveLength(8);
    expect(row(panel, 'daily_digest').alert).toBeTruthy();
    expect(row(panel, 'daily_digest').push).toBeNull();
    expect(row(panel, 'new_lead').alert.getAttribute('aria-label')).toBe('New lead captured: Alert');
  });
  it('null push_types shows Push checked for every enabled type; an explicit array only those', async () => {
    let { panel } = mount(notificationsTab, client({ prefs: { ...DEFAULT_PREFERENCES, enabled_types: ['new_lead', 'milestone'], push: true, push_types: null } }), usable());
    await tick(12);
    expect([...panel.querySelectorAll('[name=pushtype]:checked')].map((b) => b.value)).toEqual(['new_lead', 'milestone']);
    ({ panel } = mount(notificationsTab, client({ prefs: { ...DEFAULT_PREFERENCES, push: true, push_types: ['milestone', 'daily_digest'] } }), usable()));
    await tick(12);
    expect([...panel.querySelectorAll('[name=pushtype]:checked')].map((b) => b.value)).toEqual(['milestone']);
  });
  it('Push is disabled while push is not set up or the master is off, and enabled when both are fine', async () => {
    let { panel } = mount(notificationsTab, client({ prefs: { ...DEFAULT_PREFERENCES, push: true } })); // no VAPID key here
    await tick(12);
    expect(panel.querySelector('[name=pushtype]').disabled).toBe(true);
    ({ panel } = mount(notificationsTab, client({ prefs: { ...DEFAULT_PREFERENCES, push: false } }), usable()));
    await tick(12);
    expect(panel.querySelector('[name=pushtype]').disabled).toBe(true);
    expect(panel.querySelector('[data-group-push]').disabled).toBe(true);
    ({ panel } = mount(notificationsTab, client({ prefs: { ...DEFAULT_PREFERENCES, push: true } }), usable()));
    await tick(12);
    expect(panel.querySelector('[name=pushtype]').disabled).toBe(false);
  });
  it('unchecking Alert unchecks and disables Push; the group masters show indeterminate', async () => {
    const { panel } = mount(notificationsTab, client({ prefs: { ...DEFAULT_PREFERENCES, push: true } }), usable());
    await tick(12);
    const r = row(panel, 'high_interest');
    change(r.push, false);
    const master = panel.querySelector('[data-group-push="retarget"]');
    expect(master.indeterminate).toBe(true);
    expect(master.checked).toBe(false);
    change(r.push, true);
    change(r.alert, false);
    expect(r.push.checked).toBe(false);
    expect(r.push.disabled).toBe(true);
    expect(panel.querySelector('[data-group="retarget"]').indeterminate).toBe(true);
    expect(master.indeterminate).toBe(false); // the remaining three alerts all push
    expect(master.checked).toBe(true);
    change(master, false);
    expect(panel.querySelectorAll('[data-group-box="retarget"] [name=pushtype]:checked')).toHaveLength(0);
    expect(row(panel, 'new_lead').push.checked).toBe(true); // other groups untouched
    change(panel.querySelector('[data-group="retarget"]'), false);
    expect(master.disabled).toBe(true);
  });
  it('saves an explicit push_types array, and a legacy null becomes all enabled types', async () => {
    const c = client({ prefs: { ...DEFAULT_PREFERENCES, push: true, enabled_types: ['new_lead', 'milestone', 'daily_digest'], push_types: null } });
    const { panel } = mount(notificationsTab, c, usable());
    await tick(12);
    change(row(panel, 'milestone').push, false);
    await submit(panel);
    expect(c.calls.find((x) => x[0] === 'upsert')[2]).toMatchObject({ enabled_types: ['new_lead', 'milestone', 'daily_digest'], push_types: ['new_lead'] });
  });
  it('retries without push_types when the column is missing and says so', async () => {
    const c = client({ prefs: { ...DEFAULT_PREFERENCES, push: true }, upsertError: (r) => ('push_types' in r ? { code: 'PGRST204', message: "Could not find the 'push_types' column of 'retarget_preferences' in the schema cache" } : null) });
    const { panel } = mount(notificationsTab, c, usable());
    await tick(12);
    await submit(panel);
    const ups = c.calls.filter((x) => x[0] === 'upsert');
    expect(ups).toHaveLength(2);
    expect('push_types' in ups[1][2]).toBe(false);
    expect(panel.querySelector('[data-prefs-msg]').textContent).toMatch(/per-type push choices need a database update/i);
  });
  it('with In-app alerts off the Push boxes are disabled and the form says no push or e-mail will be sent', async () => {
    const { panel } = mount(notificationsTab, client({ prefs: { ...DEFAULT_PREFERENCES, push: true, in_app: true } }), usable());
    await tick(12);
    const inapp = panel.querySelector('[name=inapp]'); const hint = () => panel.querySelector('[data-inapp-hint]').textContent;
    expect(row(panel, 'new_lead').push.disabled).toBe(false);
    expect(panel.querySelector('[data-group-push]').disabled).toBe(false);
    expect(hint()).toBe('');
    change(inapp, false);
    expect(row(panel, 'new_lead').push.disabled).toBe(true);
    expect(panel.querySelector('[data-group-push]').disabled).toBe(true);
    expect(hint()).toMatch(/In-app alerts is off.*no push or e-mail/);
    change(inapp, true);
    expect(row(panel, 'new_lead').push.disabled).toBe(false);
    expect(hint()).toBe('');
  });
  it('after saving, a redraw (Mark as read) shows the SAVED quiet hours and push choices, not the values from the first load', async () => {
    const unread = [{ id: 'n1', type: 'new_lead', title: 'New lead', summary: 's', interest: null, metrics: {}, read_at: null, created_at: '2026-11-10T10:00:00Z' }];
    const c = client({ notes: unread, prefs: { ...DEFAULT_PREFERENCES, push: true, enabled_types: ['new_lead', 'milestone'], push_types: null } });
    const { panel } = mount(notificationsTab, c, usable());
    await tick(12);
    change(panel.querySelector('[name=quiet]'), true);
    panel.querySelector('[name=quiet-start]').value = '21:30';
    change(row(panel, 'milestone').push, false);
    await submit(panel);
    panel.querySelector('[data-read]').click();                        // redraws the whole tab
    await tick(12);
    expect(panel.querySelector('[name=quiet]').checked).toBe(true);
    expect(panel.querySelector('[name=quiet-start]').value).toBe('21:30');
    expect(row(panel, 'milestone').push.checked).toBe(false);
    expect(row(panel, 'new_lead').push.checked).toBe(true);
  });
  it('the push toggle and the preferences form do not overwrite each other when they save at the same time', async () => {
    let release; const gate = new Promise((r) => { release = r; }); let n = 0;
    const c = client({ prefs: { ...DEFAULT_PREFERENCES, push: false }, beforeUpsert: async () => { if (n++ === 0) await gate; } }); // the first write is slow
    const { panel } = mount(notificationsTab, c, usable());
    await tick(12);
    const master = panel.querySelector('[name=push]');
    master.checked = true; master.dispatchEvent(new Event('change', { bubbles: true }));   // write 1: push on (held back)
    await tick(2);
    panel.querySelector('[name=threshold]').value = '77';
    await submit(panel);                                              // write 2: the form
    release(); await tick(20);
    expect(c.state.prefs.push).toBe(true);
    expect(Number(c.state.prefs.interest_threshold)).toBe(77);
  });
  it('quiet hours: off by default, defaults 22:00-07:00 and the browser zone when enabled, saved as jsonb', async () => {
    const c = client({ prefs: null });
    const { panel } = mount(notificationsTab, c, usable());
    await tick(12);
    const box = panel.querySelector('[name=quiet]');
    expect(box.checked).toBe(false);
    expect(panel.querySelector('[name=quiet-start]').disabled).toBe(true);
    expect(panel.querySelector('[data-prefs]').textContent).toContain('During quiet hours push notifications are held and sent as one summary when quiet hours end. Alerts still appear in the app right away.');
    expect(panel.querySelector('[name=quiet-summary]').checked).toBe(true);
    expect(panel.querySelector('[name=quiet-summary]').disabled).toBe(true);
    await submit(panel);
    expect(c.calls.find((x) => x[0] === 'upsert')[2].quiet_hours).toBeNull();
    change(box, true);
    expect(panel.querySelector('[name=quiet-start]').value).toBe('22:00');
    expect(panel.querySelector('[name=quiet-end]').value).toBe('07:00');
    const zone = panel.querySelector('[name=quiet-zone]');
    expect(zone.value).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    zone.value = 'America/New_York';
    await submit(panel);
    const q = c.calls.filter((x) => x[0] === 'upsert').pop()[2].quiet_hours;
    expect(q).toEqual({ start: '22:00', end: '07:00', timeZone: 'America/New_York', utcOffsetMinutes: -300, summary: true }); // NOW is 11 Nov 2026 (EST)
  });
  it('quiet hours: reloads stored values, flags start == end and blocks invalid times', async () => {
    const stored = { start: '23:00', end: '06:30', timeZone: 'Europe/Paris', utcOffsetMinutes: 60 };
    const c = client({ prefs: { ...DEFAULT_PREFERENCES, quiet_hours: stored } });
    const { panel } = mount(notificationsTab, c, usable());
    await tick(12);
    expect(panel.querySelector('[name=quiet]').checked).toBe(true);
    expect(panel.querySelector('[name=quiet-start]').value).toBe('23:00');
    expect(panel.querySelector('[name=quiet-zone]').value).toBe('Europe/Paris');
    panel.querySelector('[name=quiet-end]').value = '23:00';
    panel.querySelector('[name=quiet-end]').dispatchEvent(new Event('input', { bubbles: true }));
    expect(panel.querySelector('[data-quiet-hint]').textContent).toMatch(/quiet hours are off/);
    panel.querySelector('[name=quiet-end]').value = '';
    panel.querySelector('[name=quiet-end]').dispatchEvent(new Event('input', { bubbles: true }));
    await submit(panel);
    expect(c.calls.some((x) => x[0] === 'upsert')).toBe(false);
    expect(panel.querySelector('[data-prefs-msg]').textContent).toMatch(/Quiet hours/);
  });
  it('summary checkbox: stored false reloads unchecked, the note switches wording, and it is saved in quiet_hours', async () => {
    const stored = { start: '23:00', end: '06:30', timeZone: 'Europe/Paris', utcOffsetMinutes: 60, summary: false };
    const c = client({ prefs: { ...DEFAULT_PREFERENCES, quiet_hours: stored } });
    const { panel } = mount(notificationsTab, c, usable());
    await tick(12);
    const box = panel.querySelector('[name=quiet-summary]');
    expect(box.checked).toBe(false);
    expect(box.disabled).toBe(false);
    expect(panel.querySelector('[data-quiet-note]').textContent).toContain('not sent and no summary follows');
    await submit(panel);
    expect(c.calls.filter((x) => x[0] === 'upsert').pop()[2].quiet_hours.summary).toBe(false);
    change(box, true);
    expect(panel.querySelector('[data-quiet-note]').textContent).toContain('sent as one summary when quiet hours end');
    await submit(panel);
    expect(c.calls.filter((x) => x[0] === 'upsert').pop()[2].quiet_hours.summary).toBe(true);
  });
  it('old stored quiet hours without the summary key load with the box checked', async () => {
    const c = client({ prefs: { ...DEFAULT_PREFERENCES, quiet_hours: { start: '23:00', end: '06:30', timeZone: 'Europe/Paris' } } });
    const { panel } = mount(notificationsTab, c, usable());
    await tick(12);
    expect(panel.querySelector('[name=quiet-summary]').checked).toBe(true);
  });
});

describe('editor palette on the other tabs', () => {
  it('Audience, Retarget and Notifications use the editor theme class', async () => {
    for (const tab of [audienceTab, retargetTab, notificationsTab]) {
      const { panel } = mount(tab, client({ rpcs: { video_audience_segments: [], video_interest_summary: [] } }));
      await tick(10);
      expect(panel.querySelector('.sv-analytics').classList.contains('sv-editor')).toBe(true);
      expect(panel.querySelector('.sv-analytics').classList.contains('sv-dark')).toBe(false);
    }
  });
});
