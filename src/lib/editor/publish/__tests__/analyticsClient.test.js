// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAnalytics, consentMode, randomId, ENDPOINT } from '../analyticsClient.js';

const mem = () => { const m = {}; return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = String(v); }, m }; };
const timers = () => {
  const q = [];
  return { setTimer: (fn, ms) => { const t = { fn, ms }; q.push(t); return t; }, clearTimer: (t) => { const i = q.indexOf(t); if (i >= 0) q.splice(i, 1); }, q, run: async () => { const t = q.shift(); if (t) await t.fn(); } };
};
const doc = (o = {}) => ({ hidden: false, visibilityState: 'visible', referrer: '', location: { hostname: 'smartvid.app' }, addEventListener() {}, removeEventListener() {}, ...o });
const ok = () => vi.fn(async () => ({ ok: true, status: 200 }));
function make(extra = {}) {
  const t = timers();
  const fetchImpl = extra.fetchImpl || ok();
  const a = createAnalytics({ videoId: 'abcdefgh12', mode: 'full', storage: mem(), fetchImpl, beacon: null, doc: doc(), ...t, ...extra });
  return { a, fetchImpl, t };
}
const bodyOf = (f, i = 0) => JSON.parse(f.mock.calls[i][1].body);
const tick = (a, time, duration = 100, playing = true) => a.onPlayerChange({ playing, time, duration });
const play = (a, from, to, step = 0.5) => { for (let x = from; x <= to + 1e-9; x += step) tick(a, x); };
const types = (a) => a._state().queue.map((e) => e.type);

describe('consent', () => {
  it('honors DNT / GPC / consent flags', () => {
    expect(consentMode('', { doNotTrack: '1' })).toBe('off');
    expect(consentMode('', { globalPrivacyControl: true })).toBe('off');
    expect(consentMode('?consent=off', {})).toBe('off');
    expect(consentMode('?consent=essential', {})).toBe('anonymous');
    expect(consentMode('', {})).toBe('full');
  });
  it('sends nothing when tracking is off', async () => {
    const f = ok();
    const a = createAnalytics({ videoId: 'abcdefgh12', mode: 'off', fetchImpl: f });
    a.track('play'); a.onPlayerChange({ playing: true, time: 1, duration: 10 }); await a.flush(); a.destroy();
    expect(f).not.toHaveBeenCalled();
  });
  it('anonymous mode has no persistent viewer id', async () => {
    const s = mem();
    const { a, fetchImpl } = make({ mode: 'anonymous', storage: s });
    await a.flush();
    expect(bodyOf(fetchImpl).viewer).toBeUndefined();
    expect(Object.keys(s.m)).toHaveLength(0);
  });
  it('full mode keeps one random viewer id across sessions', async () => {
    const s = mem();
    const one = make({ storage: s }); await one.a.flush();
    const two = make({ storage: s }); await two.a.flush();
    expect(bodyOf(one.fetchImpl).viewer).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(bodyOf(one.fetchImpl).viewer).toBe(bodyOf(two.fetchImpl).viewer);
    expect(bodyOf(one.fetchImpl).session).not.toBe(bodyOf(two.fetchImpl).session);
  });
});

describe('batching and delivery', () => {
  it('opens with page_open and batches instead of sending per event', async () => {
    const { a, fetchImpl, t } = make({ contactId: 'c-1' });
    expect(types(a)).toEqual(['page_open']);
    a.track('cta_click', { clip: 'cta1', props: { label: 'Quote' } });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(t.q.length).toBe(1); // a single flush timer, not one per event
    await t.run();
    const b = bodyOf(fetchImpl);
    expect(fetchImpl.mock.calls[0][0]).toBe(ENDPOINT);
    expect(b.video).toBe('abcdefgh12');
    expect(b.contact).toBe('c-1');
    expect(b.events.map((e) => e.seq)).toEqual([0, 1]);
    expect(b.owner_id).toBeUndefined();
  });

  it('never sends a server-derived event type and caps batch size', async () => {
    const { a, fetchImpl, t } = make();
    for (let i = 0; i < 30; i += 1) a.track('pause', { t: i });
    await t.run();
    expect(bodyOf(fetchImpl).events.length).toBeLessThanOrEqual(20);
    expect(JSON.stringify(bodyOf(fetchImpl))).not.toContain('"return"');
  });

  it('retries a failed batch with the same sequence numbers (idempotent) then gives up', async () => {
    const f = vi.fn(async () => ({ ok: false, status: 503 }));
    const { a, t } = make({ fetchImpl: f });
    await a.flush();
    expect(t.q.length).toBe(1);
    expect(t.q[0].ms).toBe(2000);
    await t.run();
    expect(t.q[0].ms).toBe(4000);
    await t.run();
    expect(f).toHaveBeenCalledTimes(3);
    expect(bodyOf(f, 0).events).toEqual(bodyOf(f, 1).events);
    expect(a._state().queue).toHaveLength(0); // dropped after MAX_ATTEMPTS
  });

  it('does not resend a batch the server rejected (4xx) but retries 429', async () => {
    const f = vi.fn(async () => ({ ok: false, status: 404 }));
    const { a } = make({ fetchImpl: f });
    await a.flush();
    expect(a._state().queue).toHaveLength(0);
    const f2 = vi.fn(async () => ({ ok: false, status: 429 }));
    const b = make({ fetchImpl: f2 });
    await b.a.flush();
    expect(b.a._state().queue).toHaveLength(1);
  });

  it('uses sendBeacon on page hide', async () => {
    const beacon = vi.fn(() => true);
    const { a } = make({ beacon });
    a.track('pause');
    a.destroy();
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(beacon.mock.calls[0][0]).toBe(ENDPOINT);
  });
});

describe('playback tracking', () => {
  it('plays once, pauses, resumes, completes; milestones need real viewing', () => {
    const { a } = make();
    play(a, 0, 30);                    // 0-30 watched continuously
    expect(types(a)).toContain('play');
    expect(types(a).filter((x) => x === 'play')).toHaveLength(1);
    expect(types(a)).toContain('progress_25');
    expect(types(a)).not.toContain('progress_50');
    tick(a, 30, 100, false);
    expect(types(a)).toContain('pause');
    tick(a, 30.5, 100, true);
    expect(types(a)).toContain('resume');
    play(a, 31, 100);
    expect(['progress_50', 'progress_75', 'progress_90', 'complete'].every((x) => types(a).includes(x))).toBe(true);
    expect(types(a).filter((x) => x === 'complete')).toHaveLength(1);
  });

  it('skipping ahead does not award milestones or watch time for the skipped part', () => {
    const { a } = make();
    tick(a, 0); tick(a, 0.5);
    tick(a, 95);                       // seek to near the end
    tick(a, 95.5);
    expect(types(a)).not.toContain('progress_25');
    expect(types(a)).not.toContain('progress_50');
    expect(types(a)).not.toContain('progress_90');
    const watch = a._state().queue.filter((e) => e.type === 'watch');
    const seconds = watch.reduce((s, e) => s + (e.t1 - e.t0), 0);
    expect(seconds).toBeLessThan(2);
  });

  it('measures continuous segments only and flushes them on pause', () => {
    const { a } = make();
    play(a, 0, 12);
    tick(a, 12, 100, false);
    const watch = a._state().queue.filter((e) => e.type === 'watch');
    expect(watch.length).toBeGreaterThan(0);
    const total = watch.reduce((s, e) => s + (e.t1 - e.t0), 0);
    expect(total).toBeGreaterThan(11);
    expect(total).toBeLessThanOrEqual(12);
    expect(watch.every((e) => e.t1 - e.t0 <= 120)).toBe(true);
  });

  it('a hidden tab is not watch time', () => {
    const d = doc();
    const { a } = make({ doc: d });
    play(a, 0, 3);
    d.hidden = true;
    play(a, 3.5, 20);
    const total = a._state().queue.filter((e) => e.type === 'watch').reduce((s, e) => s + (e.t1 - e.t0), 0);
    expect(total).toBeLessThanOrEqual(3.5);
  });

  it('replays after completion are tracked as replay, not a second play', () => {
    const { a } = make();
    play(a, 0, 100, 1);
    tick(a, 100, 100, false);
    tick(a, 0, 100, true);
    expect(types(a)).toContain('replay');
    expect(types(a).filter((x) => x === 'play')).toHaveLength(1);
  });

  it('records a section rewatch when a watched section is re-entered', () => {
    const { a } = make({ sections: [{ id: 'roof', start: 0, end: 20 }, { id: 'kitchen', start: 20, end: 40 }] });
    play(a, 0, 39);
    tick(a, 39, 100, false);
    tick(a, 1, 100, true);
    play(a, 1.5, 4);
    const rewatch = a._state().queue.filter((e) => e.type === 'section_rewatch');
    expect(rewatch.length).toBeGreaterThan(0);
    expect(rewatch[0].section).toBe('roof');
  });

  it('numbers every event so retries stay idempotent', () => {
    const { a } = make();
    play(a, 0, 12);
    const seqs = a._state().queue.map((e) => e.seq);
    expect(seqs).toEqual([...seqs].sort((x, y) => x - y));
    expect(new Set(seqs).size).toBe(seqs.length);
  });
});

describe('randomId', () => {
  it('produces url-safe ids of the requested length', () => {
    expect(randomId(24)).toMatch(/^[A-Za-z0-9]{24}$/);
  });
});

describe('overlapping flushes', () => {
  it('a final beacon does not drop an event queued while an earlier fetch is still pending', async () => {
    let release;
    const slow = vi.fn(() => new Promise((res) => { release = () => res({ ok: true, status: 200 }); }));
    const beacon = vi.fn(() => true);
    const { a } = make({ fetchImpl: slow, beacon });
    a.track('page_open');
    const pending = a.flush();                 // normal fetch in flight (sending = true)
    await a.flush({ final: true });            // page hidden: beacon sends and acknowledges the same batch
    a.track('cta_click', { clip: 'late' });    // the viewer returns and clicks while the fetch is still pending
    release(); await pending;
    expect(types(a)).toEqual(['cta_click']);   // the newer, unsent event survives
  });
});
