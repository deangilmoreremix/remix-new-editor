import { describe, it, expect, vi } from 'vitest';
import { createHeatCollector, viewportClass, permille, heatCells } from '../heat.js';
import { sanitizeFormSettings, defaultFormSettings, activeWebhooks } from '../formSettings.js';
import { recordPageHeat, fetchPageHeat, loadFormSettings, saveFormSettings } from '../client.js';

const fakeEnv = () => {
  const handlers = {}; const winHandlers = {};
  const doc = {
    documentElement: { scrollWidth: 1000, clientWidth: 1000, scrollHeight: 2000, clientHeight: 800, scrollTop: 0 }, visibilityState: 'visible',
    addEventListener: (t, f) => { (handlers[t] ||= []).push(f); }, removeEventListener: (t, f) => { handlers[t] = (handlers[t] || []).filter((x) => x !== f); },
  };
  const win = { innerWidth: 1280, innerHeight: 800, scrollY: 0, addEventListener: (t, f) => { (winHandlers[t] ||= []).push(f); }, removeEventListener: (t, f) => { winHandlers[t] = (winHandlers[t] || []).filter((x) => x !== f); } };
  return { doc, win, fire: (t, e) => (handlers[t] || []).forEach((f) => f(e)), fireWin: (t, e) => (winHandlers[t] || []).forEach((f) => f(e)), handlers };
};

describe('heat collector', () => {
  it('classifies the viewport and converts to permille', () => {
    expect(viewportClass(390)).toBe('mobile'); expect(viewportClass(800)).toBe('tablet'); expect(viewportClass(1400)).toBe('desktop');
    expect(permille(500, 1000)).toBe(500); expect(permille(5000, 1000)).toBe(1000); expect(permille(-5, 1000)).toBe(0); expect(permille(1, 0)).toBe(0);
  });
  it('records clicks, scroll depth steps and each watched second once; sends nothing else', () => {
    const e = fakeEnv(); const sent = [];
    const c = createHeatCollector({ send: (b) => sent.push(...b), win: e.win, doc: e.doc, setTimer: () => 1, clearTimer: () => {} });
    e.fire('click', { pageX: 500, pageY: 400, target: { textContent: 'secret' } });
    e.win.scrollY = 0; e.fireWin('scroll'); e.win.scrollY = 700; e.fireWin('scroll'); e.win.scrollY = 700; e.fireWin('scroll');
    const video = { tagName: 'VIDEO', paused: false, currentTime: 3.4 };
    e.fire('timeupdate', { target: video }); e.fire('timeupdate', { target: video });
    e.fire('timeupdate', { target: { tagName: 'VIDEO', paused: true, currentTime: 9 } });
    c.flush();
    expect(sent.filter((x) => x.t === 'click')).toEqual([{ t: 'click', x: 500, y: 200, vp: 'desktop' }]);
    expect(sent.filter((x) => x.t === 'scroll').map((x) => x.d)).toEqual([40, 70]);
    expect(sent.filter((x) => x.t === 'watch')).toEqual([{ t: 'watch', s: 3, vp: 'desktop' }]);
    expect(JSON.stringify(sent)).not.toContain('secret');
    expect(Object.keys(sent.find((x) => x.t === 'click')).sort()).toEqual(['t', 'vp', 'x', 'y']);
    c.stop();
    expect(e.handlers.click).toHaveLength(0);
  });
  it('does not measure scroll depth before the page has rendered', () => {
    vi.useFakeTimers();
    const e = fakeEnv(); const sent = [];
    const c = createHeatCollector({ send: (b) => sent.push(...b), win: e.win, doc: e.doc, setTimer: () => 1, clearTimer: () => {} });
    c.flush(); expect(sent.filter((x) => x.t === 'scroll')).toHaveLength(0);
    vi.advanceTimersByTime(2100); c.flush(); expect(sent.filter((x) => x.t === 'scroll').map((x) => x.d)).toEqual([40]);
    c.stop(); vi.useRealTimers();
  });
  it('sends in batches of at most 40', () => {
    const e = fakeEnv(); const batches = [];
    const c = createHeatCollector({ send: (b) => batches.push(b), win: e.win, doc: e.doc, setTimer: () => 1, clearTimer: () => {} });
    for (let i = 0; i < 95; i++) e.fire('click', { pageX: i, pageY: i });
    c.flush();
    expect(batches.every((b) => b.length <= 40)).toBe(true);
    expect(batches.flat().filter((x) => x.t === 'click')).toHaveLength(95);
  });
  it('turns database rows into overlay cells', () => {
    const cells = heatCells([{ cx: 20, cy: 12, clicks: 8, sessions: 4 }, { cx: 0, cy: 0, clicks: 2, sessions: 3 }, { cx: 1, cy: 1, clicks: 0 }]);
    expect(cells).toHaveLength(2); expect(cells[0]).toMatchObject({ left: 50, top: 30, size: 2.5, weight: 1 }); expect(cells[1].weight).toBe(0.25);
  });
});

describe('form delivery settings', () => {
  it('keeps only https webhooks, real e-mail addresses and known list providers', () => {
    const s = sanitizeFormSettings({ webhookEnabled: true, webhook: 'https://hooks.example.com/a', webhook2: 'http://insecure.example.com', webhook3: 'javascript:alert(1)', emailEnabled: true, emailAddress: 'me@example.com', emailAddress2: 'nope', espProvider: 'kit', espListId: 'tag_12', extra: 'x' });
    expect(s).toMatchObject({ webhookEnabled: true, webhook: 'https://hooks.example.com/a', webhook2: '', webhook3: '', emailAddress: 'me@example.com', emailAddress2: '', espProvider: 'kit', espListId: 'tag_12' });
    expect(s).not.toHaveProperty('extra');
    expect(sanitizeFormSettings({ espProvider: 'evil', espListId: 'x' })).toMatchObject({ espProvider: '', espListId: '' });
    expect(sanitizeFormSettings({ espProvider: 'kit', espListId: 'bad id!' }).espListId).toBe('');
    expect(sanitizeFormSettings(null)).toEqual(defaultFormSettings());
    expect(sanitizeFormSettings([1])).toEqual(defaultFormSettings());
  });
  it('lists the webhooks only when switched on', () => {
    expect(activeWebhooks({ webhookEnabled: false, webhook: 'https://a.example.com' })).toEqual([]);
    expect(activeWebhooks({ webhookEnabled: true, webhook: 'https://a.example.com', webhook2: '' })).toEqual(['https://a.example.com']);
  });
});

describe('client calls', () => {
  it('sends heat samples through the public RPC with a valid session only', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true }));
    const env = { url: 'https://p.supabase.co', key: 'k', fetchImpl };
    await recordPageHeat('page1234', { session: 'abcdefgh12', events: [{ t: 'click', x: 1, y: 2 }], contactId: 'c1' }, env);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]; expect(url).toBe('https://p.supabase.co/rest/v1/rpc/record_page_heat');
    expect(JSON.parse(init.body)).toEqual({ p_page_id: 'page1234', p_session: 'abcdefgh12', p_events: [{ t: 'click', x: 1, y: 2 }], p_contact_id: 'c1' });
    await recordPageHeat('page1234', { session: 'x', events: [{ t: 'click', x: 1, y: 2 }] }, env);
    await recordPageHeat('page1234', { session: 'abcdefgh12', events: [] }, env);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('loads heat rows and maps the per-contact rows', async () => {
    const calls = [];
    const client = { rpc: async (n, a) => { calls.push([n, a]); return { data: n === 'page_heat_by_contact' ? [{ contact_id: 'c1', sessions: '2', clicks: '3', max_scroll: 60, watched_seconds: '5', last_seen: 't' }] : [{ cx: 1 }], error: null }; } };
    const h = await fetchPageHeat(client, 'page1234', { viewport: 'mobile' });
    expect(calls.map((c) => c[0]).sort()).toEqual(['page_heat_by_contact', 'page_heat_clicks', 'page_heat_scroll', 'page_heat_watch']);
    expect(calls.find((c) => c[0] === 'page_heat_clicks')[1]).toMatchObject({ p_page_id: 'page1234', p_viewport: 'mobile' });
    expect(h.contacts).toEqual([{ contactId: 'c1', sessions: 2, clicks: 3, maxScroll: 60, watchedSeconds: 5, lastSeen: 't' }]);
  });
  it('saves only sanitized settings and reads them back sanitized', async () => {
    let saved = null;
    const client = { from: () => ({ upsert: async (row) => { saved = row; return { error: null }; }, select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { settings: { webhook: 'http://bad', emailAddress: 'a@b.co' } }, error: null }) }) }) }) };
    await saveFormSettings(client, 'page1234', { webhookEnabled: true, webhook: 'https://ok.example.com/h', evil: 1 });
    expect(saved.page_id).toBe('page1234'); expect(saved.settings.webhook).toBe('https://ok.example.com/h'); expect(saved.settings).not.toHaveProperty('evil');
    expect(await loadFormSettings(client, 'page1234')).toMatchObject({ webhook: '', emailAddress: 'a@b.co' });
  });
});
