// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openAlerts, installPushMessageListener, consumeAlertsMarker } from '../openAlerts.js';

// The push helpers in public/sw.js sit between markers; evaluate exactly that shipped code.
const swSource = readFileSync(resolve(__dirname, '../../../../public/sw.js'), 'utf8');
const region = swSource.split('// <push-logic>')[1].split('// </push-logic>')[0];
const sw = new Function(`${region}; return { parsePushPayload, resolvePushUrl, buildNotificationOptions, coldOpenUrl, pickAppWindow };`)();

describe('sw.js push payload handling', () => {
  it('parses a server payload', () => {
    const p = sw.parsePushPayload(JSON.stringify({ title: 'New lead', body: 'Ann signed up', tag: 't1', type: 'new_lead', notificationId: 'n1', videoId: 'v1', url: '/#/timeline' }));
    expect(p).toEqual({ title: 'New lead', body: 'Ann signed up', tag: 't1', type: 'new_lead', notificationId: 'n1', videoId: 'v1', url: '/#/timeline' });
  });
  it.each([[null], [''], ['   '], ['not json {'], ['[1,2]'], ['42'], ['null'], [undefined]])('tolerates malformed payload %j', (raw) => {
    const p = sw.parsePushPayload(raw);
    expect(p.title).toBe('SmartVideo');
    expect(p.tag).toBe('smartvideo-alert');
    expect(p.body).toBe('');
  });
  it('ignores non-string fields and caps lengths', () => {
    const p = sw.parsePushPayload(JSON.stringify({ title: 5, body: 'x'.repeat(1000), url: { a: 1 } }));
    expect(p.title).toBe('SmartVideo');
    expect(p.body).toHaveLength(300);
    expect(p.url).toBe('');
  });
  it('builds options: icon/badge, not sticky, click data', () => {
    const o = sw.buildNotificationOptions(sw.parsePushPayload(JSON.stringify({ title: 'a', tag: 'k', type: 'milestone', notificationId: 'n', videoId: 'v' })));
    expect(o).toMatchObject({ tag: 'k', icon: '/favicon.webp', badge: '/favicon.webp', requireInteraction: false, data: { url: '/#/timeline', type: 'milestone', notificationId: 'n', videoId: 'v' } });
  });
});

describe('sw.js click routing', () => {
  it('only follows same-origin paths', () => {
    expect(sw.resolvePushUrl('/#/timeline')).toBe('/#/timeline');
    expect(sw.resolvePushUrl('https://evil.example/')).toBe('/#/timeline');
    expect(sw.resolvePushUrl('//evil.example')).toBe('/#/timeline');
    expect(sw.resolvePushUrl('javascript:alert(1)')).toBe('/#/timeline');
    expect(sw.resolvePushUrl(undefined)).toBe('/#/timeline');
  });
  it('cold open adds the alerts marker before the hash', () => {
    expect(sw.coldOpenUrl('/#/timeline')).toBe('/?alerts=1#/timeline');
    expect(sw.coldOpenUrl('/app?x=1#/timeline')).toBe('/app?x=1&alerts=1#/timeline');
    expect(sw.coldOpenUrl('https://evil.example')).toBe('/?alerts=1#/timeline');
  });
  it('prefers a focused window of this origin and ignores foreign origins', () => {
    const a = { url: 'https://app.test/', focused: false, visibilityState: 'hidden' };
    const b = { url: 'https://app.test/#/x', focused: true, visibilityState: 'visible' };
    const x = { url: 'https://other.test/', focused: true };
    expect(sw.pickAppWindow([a, x, b], 'https://app.test')).toBe(b);
    expect(sw.pickAppWindow([x], 'https://app.test')).toBeNull();
    expect(sw.pickAppWindow([], 'https://app.test')).toBeNull();
  });
  it('never picks a motion-agent window either', () => {
    const agent = { url: 'https://app.test/motion-agent/', focused: true, visibilityState: 'visible' };
    const editor = { url: 'https://app.test/#/timeline', focused: false, visibilityState: 'hidden' };
    expect(sw.pickAppWindow([agent, editor], 'https://app.test')).toBe(editor);
    expect(sw.pickAppWindow([agent], 'https://app.test')).toBeNull();
  });
  it('never picks a workbench window: it has no alerts listener, so the click would do nothing', () => {
    const bench = { url: 'https://app.test/workbench-app/index.html#/x', focused: true, visibilityState: 'visible' };
    const editor = { url: 'https://app.test/#/timeline', focused: false, visibilityState: 'hidden' };
    expect(sw.pickAppWindow([bench, editor], 'https://app.test')).toBe(editor);
    expect(sw.pickAppWindow([bench], 'https://app.test')).toBeNull();   // only a workbench is open: the caller opens a new window
  });
  it('registers the push and notificationclick handlers and keeps the caching handlers', () => {
    for (const ev of ['install', 'activate', 'fetch', 'message', 'push', 'notificationclick']) expect(swSource).toContain(`addEventListener('${ev}'`);
  });
});

describe('page side of a notification click', () => {
  const win = (hash = '') => {
    const store = new Map();
    const w = new globalThis.EventTarget();
    Object.assign(w, { sessionStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }, location: { hash, href: `https://app.test/?alerts=1${hash}` }, history: { replaceState: vi.fn() }, navigator: {} });
    return w;
  };
  it('from another page: sets the flag and navigates to the editor', () => {
    const w = win('#/home'); openAlerts({ win: w });
    expect(w.sessionStorage.getItem('remix_open_projects')).toBe('1');
    expect(w.location.hash).toBe('#/timeline');
  });
  it('inside the editor: dispatches remix:open-projects', () => {
    const w = win('#/timeline'); const seen = vi.fn(); w.addEventListener('remix:open-projects', seen);
    openAlerts({ win: w });
    expect(seen).toHaveBeenCalled();
  });
  it('reacts to the service worker message and cleans up', () => {
    const w = win('#/timeline'); const sws = new globalThis.EventTarget(); w.navigator = { serviceWorker: sws };
    const seen = vi.fn(); w.addEventListener('remix:open-projects', seen);
    const off = installPushMessageListener({ win: w });
    sws.dispatchEvent(Object.assign(new Event('message'), { data: { type: 'other' } })); expect(seen).not.toHaveBeenCalled();
    sws.dispatchEvent(Object.assign(new Event('message'), { data: { type: 'remix:open-alerts' } })); expect(seen).toHaveBeenCalledTimes(1);
    off(); sws.dispatchEvent(Object.assign(new Event('message'), { data: { type: 'remix:open-alerts' } })); expect(seen).toHaveBeenCalledTimes(1);
  });
  it('?alerts=1 on load is removed and acted on', () => {
    const w = win('#/home');
    expect(consumeAlertsMarker({ win: w })).toBe(true);
    expect(w.history.replaceState).toHaveBeenCalledWith(null, '', '/#/home');
    expect(w.sessionStorage.getItem('remix_open_projects')).toBe('1');
    const w2 = win(''); w2.location.href = 'https://app.test/#/home';
    expect(consumeAlertsMarker({ win: w2 })).toBe(false);
  });
});
