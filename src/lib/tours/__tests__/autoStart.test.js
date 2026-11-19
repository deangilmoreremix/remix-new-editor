// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initTours } from '../autoStart.js';

const T = '2026-11-20T10:00:00.000Z';
function setup({ seen = {}, disabled = false, blocked = () => false, page = 'image' } = {}) {
  let current = page;
  const state = { ...seen, ...(disabled ? { __disabled__: { version: 1, seenAt: T } } : {}) };
  const started = [];
  let active = false;
  const runner = {
    isTourActive: () => active,
    startTour: vi.fn(async (def, opts) => { started.push({ id: def.id, replay: !!opts.replay }); active = true; setTimeout(() => { active = false; opts.onFinish?.('done', def); }, 10); return { started: true, steps: def.steps.length }; }),
  };
  const markSeen = vi.fn(async (uid, id, version, cur) => ({ ...(cur || {}), [id]: { version, seenAt: T } }));
  const setDisabled = vi.fn(async (uid, off, cur) => ({ ...(cur || {}), __disabled__: { version: 1, seenAt: T } }));
  const api = initTours({
    getPage: () => current, pollMs: 5, maxWaitMs: 500,
    userId: () => 'u1', loadState: async () => ({ ...state }), markSeen, setDisabled, reset: async () => ({}),
    runner: async () => runner, blocked,
  });
  return { api, started, markSeen, setDisabled, setPage: (p) => { current = p; }, runner };
}
const settle = (ms = 150) => new Promise((r) => setTimeout(r, ms));

describe('tour auto-start', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('shows the app tour first, then the studio tour, once each', async () => {
    const t = setup();
    await t.api.schedule('image');
    expect(t.started.map((s) => s.id)).toEqual(['app', 'image']);
    expect(t.markSeen).toHaveBeenCalledWith('u1', 'app', 1, expect.anything());
    expect(t.markSeen).toHaveBeenCalledWith('u1', 'image', expect.any(Number), expect.anything());
    t.api.destroy();
  });
  it('skips tours already seen, and shows only the studio tour after the app tour', async () => {
    const t = setup({ seen: { app: { version: 1, seenAt: T } }, page: 'video' });
    await t.api.schedule('video');
    expect(t.started.map((s) => s.id)).toEqual(['video']);
    const t2 = setup({ seen: { app: { version: 1, seenAt: T }, image: { version: 99, seenAt: T } } });
    await t2.api.schedule('image');
    expect(t2.started).toEqual([]);
    t.api.destroy(); t2.api.destroy();
  });
  it('does nothing when tours are turned off, or the page has no tour', async () => {
    const off = setup({ disabled: true });
    await off.api.schedule('image');
    expect(off.started).toEqual([]);
    const none = setup({ seen: { app: { version: 1, seenAt: T } } });
    await none.api.schedule('settings');
    expect(none.started).toEqual([]);
    off.api.destroy(); none.api.destroy();
  });
  it('waits while a modal is open, and gives up if you leave the page', async () => {
    let open = true;
    const t = setup({ blocked: () => open, seen: { app: { version: 1, seenAt: T } } });
    const p = t.api.schedule('image');
    await settle(40);
    expect(t.started).toEqual([]);
    open = false;
    await p;
    expect(t.started.map((s) => s.id)).toEqual(['image']);
    const t2 = setup({ blocked: () => true, seen: { app: { version: 1, seenAt: T } } });
    const p2 = t2.api.schedule('image');
    t2.setPage('video');
    await p2;
    expect(t2.started).toEqual([]);
    t.api.destroy(); t2.api.destroy();
  });
  it('replay ignores "seen" and "off", and never records anything', async () => {
    const t = setup({ seen: { app: { version: 1, seenAt: T }, image: { version: 9, seenAt: T } }, disabled: true });
    await t.api.replay('image');
    await settle(40);
    expect(t.started).toEqual([{ id: 'image', replay: true }]);
    expect(t.markSeen).not.toHaveBeenCalled();
    await t.api.replay('some-page-without-a-tour');
    expect(t.started.at(-1)).toEqual({ id: 'app', replay: true });
    t.api.destroy();
  });
  it('listens for the app:route-ready event', async () => {
    const t = setup({ seen: { app: { version: 1, seenAt: T } } });
    window.dispatchEvent(new CustomEvent('app:route-ready', { detail: { page: 'image' } }));
    await settle(80);
    expect(t.started.map((s) => s.id)).toEqual(['image']);
    t.api.destroy();
  });
});
