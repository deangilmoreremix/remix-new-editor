// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { handle, normalizeEvent, EVENT_TYPES, HEAT_TYPES, CTA_KINDS } from '../video-events.js';

const env = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'service-secret' };
const base = { video: 'abcdefgh12', session: 'sess_0123456789abcdef' };

function fakeFetch({ heat = { ok: true, accepted: 2, duplicates: 0 }, ingest = { ok: true, accepted: 1, duplicates: 0 } } = {}) {
  const calls = [];
  const fn = vi.fn(async (url, init) => {
    const name = url.split('/rpc/')[1];
    calls.push({ name, args: JSON.parse(init.body) });
    if (name === 'rate_limit_check') return { ok: true, json: async () => ({ allowed: true }) };
    if (name === 'ingest_video_heat_events') return { ok: true, json: async () => heat };
    return { ok: true, json: async () => ingest };
  });
  fn.calls = calls;
  return fn;
}

describe('video-events: heat event allow-list and shaping', () => {
  it('adds the new types to the allow-list', () => {
    expect(EVENT_TYPES).toEqual(expect.arrayContaining(['heat_click', 'cta_impression', 'scroll_depth']));
    expect(HEAT_TYPES).toContain('watch_buckets');
    expect(normalizeEvent({ type: 'watch_buckets', seq: 1, props: { r: [[0, 3]] } })).not.toBeNull();
  });
  it('heat_click keeps only normalized coords, viewport, bucket and CTA id/kind/label', () => {
    expect(normalizeEvent({ type: 'heat_click', seq: 1, t: 5, text: 'hello', props: { vp: 'mobile', x: 0.123456, y: 1, pb: 3, cta: 'c1', kind: 'book_call', label: 'Book', value: 'secret', selector: '#a' } }))
      .toEqual({ type: 'heat_click', seq: 1, props: { vp: 'mobile', x: 0.1235, y: 1, pb: 3, cta: 'c1', kind: 'book_call', label: 'Book' } });
  });
  it('heat_click rejects missing or out-of-range coordinates', () => {
    for (const props of [{}, { x: 0.5 }, { x: -0.1, y: 0.5 }, { x: 0.5, y: 1.01 }, { x: '0.5', y: 0.5 }, { x: NaN, y: 0.5 }]) {
      expect(normalizeEvent({ type: 'heat_click', seq: 1, props })).toBeNull();
    }
    expect(normalizeEvent({ type: 'heat_click', seq: 1 })).toBeNull();
  });
  it('unknown CTA kind falls back to other; bad viewport/bucket are dropped', () => {
    const e = normalizeEvent({ type: 'heat_click', seq: 1, props: { vp: 'watch', x: 0.5, y: 0.5, pb: 99, cta: 'c', kind: 'weird' } });
    expect(e.props).toEqual({ x: 0.5, y: 0.5, pb: 1, cta: 'c', kind: 'other' });
    expect(CTA_KINDS).toEqual(['book_call', 'visit_website', 'call_now', 'get_offer', 'contact', 'lead_capture', 'other']);
  });
  it('cta_impression requires a CTA id', () => {
    expect(normalizeEvent({ type: 'cta_impression', seq: 1, props: {} })).toBeNull();
    expect(normalizeEvent({ type: 'cta_impression', seq: 1, props: { cta: 'c1', label: 'x'.repeat(200) } }).props.label).toHaveLength(80);
  });
  it('scroll_depth accepts only 25/50/75/100', () => {
    expect(normalizeEvent({ type: 'scroll_depth', seq: 1, props: { v: 50 } }).props.v).toBe(50);
    expect(normalizeEvent({ type: 'scroll_depth', seq: 1, props: { v: 33 } })).toBeNull();
    expect(normalizeEvent({ type: 'scroll_depth', seq: 1, props: { v: '50' } })).toBeNull();
  });
  it('watch_buckets validates ranges and totals', () => {
    expect(normalizeEvent({ type: 'watch_buckets', seq: 1, props: { r: [[0, 9], [20, 29]] } }).props.r).toEqual([[0, 9], [20, 29]]);
    for (const r of [[], [[5, 2]], [[0, 4000]], [[-1, 3]], [[0, 1.5]], [[0]], 'x', [[0, 599], [600, 1200]], Array.from({ length: 31 }, (_, i) => [i, i])]) {
      expect(normalizeEvent({ type: 'watch_buckets', seq: 1, props: { r } })).toBeNull();
    }
  });
});

describe('video-events handler with heat events (mocked database)', () => {
  it('creates the session via ingest_video_events (legacy events only), then calls the heat RPC', async () => {
    const f = fakeFetch();
    const res = await handle({ ...base, events: [
      { type: 'page_open', seq: 0 },
      { type: 'heat_click', seq: 1, props: { vp: 'desktop', x: 0.5, y: 0.5, pb: 2 } },
      { type: 'scroll_depth', seq: 2, props: { v: 25 } },
    ] }, { fetchImpl: f, env });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({ ok: true, accepted: 3, duplicates: 0 });
    const names = f.calls.map((c) => c.name).filter((n) => n !== 'rate_limit_check');
    expect(names).toEqual(['ingest_video_events', 'ingest_video_heat_events']);
    const legacy = f.calls.find((c) => c.name === 'ingest_video_events').args;
    const heat = f.calls.find((c) => c.name === 'ingest_video_heat_events').args;
    expect(legacy.p_events.map((e) => e.type)).toEqual(['page_open']);
    expect(heat.p_events.map((e) => e.type)).toEqual(['heat_click', 'scroll_depth']);
    expect(Object.keys(heat).sort()).toEqual(['p_events', 'p_session_key', 'p_video_id']); // no owner/viewer/ip leaks
  });
  it('a heat-only batch still runs the session-creating legacy call with an empty list', async () => {
    const f = fakeFetch({ ingest: { ok: true, accepted: 0, duplicates: 0 }, heat: { ok: true, accepted: 1, duplicates: 0 } });
    const res = await handle({ ...base, events: [{ type: 'cta_impression', seq: 5, props: { cta: 'c1' } }] }, { fetchImpl: f, env });
    expect(res.statusCode).toBe(200);
    expect(f.calls.find((c) => c.name === 'ingest_video_events').args.p_events).toEqual([]);
  });
  it('does not call the heat RPC for an unknown video (404) or when no heat events are sent', async () => {
    const f = fakeFetch({ ingest: { ok: false, error: 'unknown_video' } });
    expect((await handle({ ...base, events: [{ type: 'scroll_depth', seq: 1, props: { v: 25 } }] }, { fetchImpl: f, env })).statusCode).toBe(404);
    expect(f.calls.some((c) => c.name === 'ingest_video_heat_events')).toBe(false);
    const g = fakeFetch();
    await handle({ ...base, events: [{ type: 'pause', seq: 1 }] }, { fetchImpl: g, env });
    expect(g.calls.some((c) => c.name === 'ingest_video_heat_events')).toBe(false);
  });
  it('rejects a batch of only invalid heat events without touching the database', async () => {
    const f = fakeFetch();
    const res = await handle({ ...base, events: [{ type: 'heat_click', seq: 1, props: { x: 5, y: 5 } }] }, { fetchImpl: f, env });
    expect(res.statusCode).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });
  it('surfaces a heat RPC rejection', async () => {
    const f = fakeFetch({ heat: { ok: false, error: 'no_session' } });
    const res = await handle({ ...base, events: [{ type: 'scroll_depth', seq: 1, props: { v: 25 } }] }, { fetchImpl: f, env });
    expect(res.statusCode).toBe(400);
  });
});
