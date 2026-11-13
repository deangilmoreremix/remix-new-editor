/* global EventTarget */
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createAnalytics, consentMode } from '../analyticsClient.js';
import { createHeatmapCapture, singleLeadClipId } from '../heatmapCapture.js';

const flushAll = async (a) => { await a.flush(); };
const setup = ({ mode = 'full', html = '', width = 1200 } = {}) => {
  document.body.innerHTML = `<div id="c"><div id="frame">${html}</div></div>`;
  const container = document.getElementById('c');
  const frame = document.getElementById('frame');
  container.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 2000 });
  Object.defineProperty(container, 'scrollHeight', { value: 2000, configurable: true });
  const sent = [];
  const fetchImpl = vi.fn(async (_u, init) => { sent.push(...JSON.parse(init.body).events); return { ok: true, status: 200 }; });
  const analytics = createAnalytics({ videoId: 'abcdefgh12', mode, fetchImpl, beacon: null, storage: { getItem: () => null, setItem() {} } });
  const win = Object.assign(new EventTarget(), { innerWidth: width, innerHeight: 800, scrollY: 0 });
  const ios = [];
  class FakeIO { constructor(cb) { this.cb = cb; this.els = []; ios.push(this); } observe(el) { this.els.push(el); } unobserve() {} disconnect() {} }
  class FakeMO { observe() {} disconnect() {} }
  const heat = createHeatmapCapture({ analytics, container, frame, win, doc: document, IntersectionObserver: FakeIO, MutationObserver: FakeMO,
    labelFor: (id) => (id === 'cta1' ? 'Book a call' : null), leadClipId: 'lead1', allowUntrusted: true, now: () => 1000 });
  return { analytics, heat, container, frame, sent, fetchImpl, ios, win };
};
const click = (el, x, y) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y, detail: 1 }));
const types = (sent, t) => sent.filter((e) => e.type === t);
afterEach(() => { document.body.innerHTML = ''; });

describe('heatmap capture: consent gating', () => {
  it('is inert when analytics is off (DNT / GPC / ?consent=0): no listeners, no events, no requests', async () => {
    expect(consentMode('', { doNotTrack: '1' })).toBe('off');
    expect(consentMode('', { globalPrivacyControl: true })).toBe('off');
    expect(consentMode('?consent=0', {})).toBe('off');
    const s = setup({ mode: 'off' });
    expect(s.heat.active).toBe(false);
    click(s.container, 500, 500);
    s.heat.onPlayerChange({ playing: true, time: 1, duration: 10 });
    await flushAll(s.analytics);
    expect(s.fetchImpl).not.toHaveBeenCalled();
  });
  it('anonymous consent still captures (no viewer id involved)', async () => {
    const s = setup({ mode: 'anonymous' });
    expect(s.heat.active).toBe(true);
    s.heat.destroy();
  });
});

describe('heatmap capture: clicks', () => {
  it('sends normalized coordinates, viewport class and page bucket only', async () => {
    const s = setup();
    click(s.container, 250, 500);
    await flushAll(s.analytics);
    const [e] = types(s.sent, 'heat_click');
    expect(e.props).toEqual({ vp: 'desktop', x: 0.25, y: 0.25, pb: 5 });
    expect(JSON.stringify(e)).not.toMatch(/text|value|key/i);
    s.heat.destroy();
  });
  it('classifies mobile viewports', async () => {
    const s = setup({ width: 390 });
    click(s.container, 10, 10);
    await flushAll(s.analytics);
    expect(types(s.sent, 'heat_click')[0].props.vp).toBe('mobile');
  });
  it('records CTA id, kind and the owner label (not DOM text) when a CTA was hit', async () => {
    const s = setup({ html: '<a class="wf-cta" data-clip-id="cta1" href="https://x.co">SECRET TEXT</a>' });
    click(s.frame.querySelector('a'), 100, 100);
    await flushAll(s.analytics);
    const [e] = types(s.sent, 'heat_click');
    expect(e.props).toMatchObject({ cta: 'cta1', kind: 'book_call', label: 'Book a call' });
    expect(JSON.stringify(s.sent)).not.toContain('SECRET TEXT');
  });
  it('ignores clicks on form fields and keyboard-activated clicks', async () => {
    const s = setup({ html: '<form class="addon-optin"><input id="i" value="my-private-value"></form>' });
    click(s.frame.querySelector('input'), 300, 300);
    s.container.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 0, clientY: 0, detail: 0 }));
    await flushAll(s.analytics);
    expect(types(s.sent, 'heat_click')).toHaveLength(0);
    expect(JSON.stringify(s.sent)).not.toContain('my-private-value');
  });
  it('de-duplicates double clicks and caps clicks per session', async () => {
    const s = setup();
    let t = 0;
    s.heat.destroy();
    const heat = createHeatmapCapture({ analytics: s.analytics, container: s.container, win: s.win, doc: document, allowUntrusted: true, now: () => t });
    click(s.container, 500, 500); click(s.container, 502, 502);
    expect(types(s.analytics._state().queue, 'heat_click')).toHaveLength(1);
    for (let i = 0; i < 60; i += 1) { t += 1000; click(s.container, (i % 40) * 20 + 5, ((i * 7) % 50) * 30 + 5); }
    expect(types(s.analytics._state().queue, 'heat_click').length).toBeLessThanOrEqual(30);
    heat.destroy();
  });
});

describe('heatmap capture: impressions, scroll, watch buckets', () => {
  it('records a CTA impression once per session when >= 50% visible', async () => {
    const s = setup({ html: '<a class="wf-cta" data-clip-id="cta1" href="tel:+15551234567"></a>' });
    const a = s.frame.querySelector('a');
    const io = s.ios[0];
    expect(io.els).toContain(a);
    io.cb([{ target: a, isIntersecting: true, intersectionRatio: 0.3 }]);
    io.cb([{ target: a, isIntersecting: true, intersectionRatio: 0.6 }]);
    io.cb([{ target: a, isIntersecting: true, intersectionRatio: 1 }]);
    await flushAll(s.analytics);
    const imps = types(s.sent, 'cta_impression');
    expect(imps).toHaveLength(1);
    expect(imps[0].props).toMatchObject({ cta: 'cta1', kind: 'call_now', label: 'Book a call' });
  });
  it('observes the lead form as a lead_capture CTA keyed by the single lead-form clip', async () => {
    const s = setup({ html: '<form class="addon-optin"></form>' });
    const form = s.frame.querySelector('form');
    s.ios[0].cb([{ target: form, isIntersecting: true, intersectionRatio: 1 }]);
    await flushAll(s.analytics);
    expect(types(s.sent, 'cta_impression')[0].props).toMatchObject({ cta: 'lead1', kind: 'lead_capture' });
  });
  it('sends scroll milestones once each (the visible part on load counts)', async () => {
    const s = setup();
    // 800px viewport / 2000px page = 40% at load: 25 reached
    expect(types(s.analytics._state().queue, 'scroll_depth').map((e) => e.props.v)).toEqual([25]);
    s.win.scrollY = 1200; s.win.dispatchEvent(new Event('scroll'));
    await new Promise((r) => setTimeout(r, 200));
    s.win.dispatchEvent(new Event('scroll'));
    await new Promise((r) => setTimeout(r, 200));
    expect(types(s.analytics._state().queue, 'scroll_depth').map((e) => e.props.v)).toEqual([25, 50, 75, 100]);
    s.heat.destroy();
  });
  it('batches continuous playback into per-second ranges, not per tick', async () => {
    const s = setup();
    for (let t = 0; t <= 5; t += 0.5) s.heat.onPlayerChange({ playing: true, time: t, duration: 60 });
    s.heat.onPlayerChange({ playing: false, time: 5, duration: 60 });
    const wb = types(s.analytics._state().queue, 'watch_buckets');
    expect(wb).toHaveLength(1);
    expect(wb[0].props.r).toEqual([[0, 5]]);
    // replay of the first seconds after a seek = a second range event for the same seconds
    for (let t = 1; t <= 3; t += 0.5) s.heat.onPlayerChange({ playing: true, time: t, duration: 60 });
    s.heat.onPlayerChange({ playing: false, time: 3, duration: 60 });
    expect(types(s.analytics._state().queue, 'watch_buckets')[1].props.r).toEqual([[1, 3]]);
    s.heat.destroy();
  });
});

describe('singleLeadClipId', () => {
  it('returns the id only when there is exactly one lead-form clip', () => {
    const p = (n) => ({ tracks: [{ items: Array.from({ length: n }, (_, i) => ({ id: `l${i}`, type: 'lead-form' })) }] });
    expect(singleLeadClipId(p(1))).toBe('l0');
    expect(singleLeadClipId(p(2))).toBeNull();
    expect(singleLeadClipId(p(0))).toBeNull();
    expect(singleLeadClipId(null)).toBeNull();
  });
});
