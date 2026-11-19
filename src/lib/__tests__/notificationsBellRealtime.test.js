// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNotificationsBell } from '../notificationsBell.js';

const client = (n) => ({ rpc: vi.fn(async () => ({ data: n, error: null })) });
// a server whose unread count can change, like the real one when a new alert row is inserted
const live = (n) => { const s = { n }; return { s, rpc: vi.fn(async () => ({ data: s.n, error: null })) }; };
const tick = () => new Promise((r) => setTimeout(r, 0));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function fakeRealtime({ status = 'SUBSCRIBED' } = {}) {
  const state = { handlers: [], filters: [], removed: [], token: 't1', userId: 'user_1' };
  const rc = {
    channel: vi.fn(() => {
      const ch = { on: (type, filter, fn) => { state.filters.push(filter); state.handlers.push(fn); return ch; }, subscribe: (cb) => { cb?.(status); return ch; } };
      return ch;
    }),
    removeChannel: vi.fn(async (ch) => { state.removed.push(ch); }),
  };
  state.client = rc;
  state.getRealtime = vi.fn(async () => (state.userId ? { client: rc, userId: state.userId, token: state.token } : null));
  return state;
}
const insert = async (rt, row) => { rt.handlers.forEach((h) => h({ new: row })); await tick(); await tick(); };
const toast = () => document.body.querySelector('[aria-live=polite]');
const setVisibility = (v) => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });

beforeEach(() => { setVisibility('visible'); document.body.innerHTML = ''; });

describe('notifications bell realtime', () => {
  it('subscribes to INSERTs filtered by the owner id', async () => {
    const rt = fakeRealtime();
    const bell = createNotificationsBell({ getClient: async () => client(0), isSignedIn: () => true, getRealtime: rt.getRealtime });
    await tick(); await tick();
    expect(rt.filters).toEqual([{ event: 'INSERT', schema: 'public', table: 'owner_notifications', filter: 'clerk_user_id=eq.user_1' }]);
    bell.destroy();
  });
  it('an INSERT bumps the badge immediately, fires remix:notifications-changed and toasts while visible', async () => {
    const rt = fakeRealtime(); const changed = vi.fn();
    window.addEventListener('remix:notifications-changed', changed);
    const srv = live(2);
    const bell = createNotificationsBell({ getClient: async () => srv, isSignedIn: () => true, getRealtime: rt.getRealtime });
    await tick(); await tick();
    srv.s.n = 3;                              // the new alert row is now in the server's count
    await insert(rt, { id: 'n1', type: 'new_lead', title: 'Ann <b>Lee</b>', read_at: null });
    expect(bell._count()).toBe(3);
    expect(bell.element.querySelector('[role=status]').textContent).toBe('3');
    expect(changed).toHaveBeenCalled();
    expect(toast().textContent).toContain('New lead: Ann <b>Lee</b>'); // shown as text, never as markup
    expect(toast().querySelector('b')).toBeNull();
    window.removeEventListener('remix:notifications-changed', changed);
    bell.destroy();
  });
  it('a hidden page gets the badge but no toast (push covers it)', async () => {
    const rt = fakeRealtime(); setVisibility('hidden');
    const srv = live(0);
    const bell = createNotificationsBell({ getClient: async () => srv, isSignedIn: () => true, getRealtime: rt.getRealtime });
    await tick(); await tick();
    srv.s.n = 1;
    await insert(rt, { id: 'n1', type: 'milestone', title: 'x', read_at: null });
    expect(bell._count()).toBe(1);
    expect(toast()).toBeNull();
    bell.destroy();
  });
  it('already-read rows are ignored', async () => {
    const rt = fakeRealtime();
    const bell = createNotificationsBell({ getClient: async () => client(0), isSignedIn: () => true, getRealtime: rt.getRealtime });
    await tick(); await tick();
    await insert(rt, { id: 'n1', type: 'milestone', title: 'x', read_at: '2026-01-01' });
    expect(bell._count()).toBe(0);
    bell.destroy();
  });
  it('a channel error removes the channel silently and polling keeps working', async () => {
    const rt = fakeRealtime({ status: 'CHANNEL_ERROR' });
    const c = client(4);
    const bell = createNotificationsBell({ getClient: async () => c, isSignedIn: () => true, getRealtime: rt.getRealtime });
    await tick(); await tick();
    expect(rt.client.removeChannel).toHaveBeenCalled();
    c.rpc.mockClear(); await bell.refresh();
    expect(c.rpc).toHaveBeenCalledWith('owner_unread_notifications');
    bell.destroy();
  });
  it('a throwing realtime setup never breaks the bell', async () => {
    const bell = createNotificationsBell({ getClient: async () => client(5), isSignedIn: () => true, getRealtime: async () => { throw new Error('unauthorised'); } });
    await tick(); await tick();
    expect(bell._count()).toBe(5);
    bell.destroy();
  });
  it('without getRealtime nothing changes', async () => {
    const bell = createNotificationsBell({ getClient: async () => client(1), isSignedIn: () => true });
    await tick(); await tick();
    expect(bell._count()).toBe(1);
    bell.destroy();
  });
  it('token refresh re-subscribes, sign-out tears down, destroy removes the channel and toast', async () => {
    const rt = fakeRealtime(); let signedIn = true;
    const bell = createNotificationsBell({ getClient: async () => client(0), isSignedIn: () => signedIn, getRealtime: rt.getRealtime, realtimeCheckMs: 20 });
    await tick(); await tick();
    expect(rt.client.channel).toHaveBeenCalledTimes(1);
    rt.token = 't2';
    await wait(60);
    expect(rt.client.channel).toHaveBeenCalledTimes(2);
    expect(rt.removed).toHaveLength(1);
    signedIn = false;
    await wait(60);
    expect(rt.removed).toHaveLength(2);
    signedIn = true; await wait(60);
    await insert(rt, { id: 'n9', type: 'new_lead', title: 'x', read_at: null });
    expect(toast()).not.toBeNull();
    bell.destroy(); await tick();
    expect(rt.removed).toHaveLength(3);
    expect(toast()).toBeNull();
  });
});

describe('notifications bell realtime: owner changes', () => {
  it('an alert that arrives after sign-out is dropped, and the old channel is removed', async () => {
    const rt = fakeRealtime(); let signedIn = true;
    const bell = createNotificationsBell({ getClient: async () => client(0), isSignedIn: () => signedIn, getRealtime: rt.getRealtime });
    await tick(); await tick();
    signedIn = false;                        // signed out; the periodic check has not run yet
    await insert(rt, { id: 'n9', type: 'new_lead', title: 'Previous owner lead', read_at: null });
    expect(bell._count()).toBe(0);
    expect(toast()).toBeNull();
    expect(rt.removed.length).toBeGreaterThan(0);   // the channel itself is removed, not just ignored
    bell.destroy();
  });
  it('an alert for the previous account after a switch is dropped and that channel is removed', async () => {
    const rt = fakeRealtime();
    const bell = createNotificationsBell({ getClient: async () => client(0), isSignedIn: () => true, getRealtime: rt.getRealtime });
    await tick(); await tick();
    rt.userId = 'user_2';                    // another account signed in; the old channel is still open
    await insert(rt, { id: 'n8', type: 'new_lead', title: 'Account one lead', read_at: null });
    expect(bell._count()).toBe(0);
    expect(toast()).toBeNull();
    expect(rt.removed.length).toBeGreaterThan(0);
    bell.destroy();
  });
});

describe('notifications bell realtime: synchronous owner id', () => {
  it('an alert is dropped when the owner changes while its lookup is still pending', async () => {
    const rt = fakeRealtime(); let cur = 'user_1'; let slow = false; let release; const gate = new Promise((r) => { release = r; });
    const getRealtime = vi.fn(async () => { if (slow) await gate; return rt.getRealtime(); });
    const bell = createNotificationsBell({ getClient: async () => client(0), isSignedIn: () => true, getRealtime, getCurrentUserId: () => cur });
    await tick(); await tick();
    slow = true;
    rt.handlers.forEach((h) => h({ new: { id: 'n7', type: 'new_lead', title: 'Previous owner lead', read_at: null } })); // lookup now pending
    cur = 'user_2';                                  // the account switched meanwhile
    release(); await tick(); await tick();
    expect(bell._count()).toBe(0);
    expect(toast()).toBeNull();
    expect(rt.removed.length).toBeGreaterThan(0);
    bell.destroy();
  });
  it('a sign-out removes the channel within seconds, with no alert arriving', async () => {
    const rt = fakeRealtime(); let signedIn = true; let cur = 'user_1';
    const bell = createNotificationsBell({ getClient: async () => client(0), isSignedIn: () => signedIn, getRealtime: rt.getRealtime, getCurrentUserId: () => cur, identityCheckMs: 20 });
    await tick(); await tick();
    expect(rt.removed.length).toBe(0);
    signedIn = false; cur = '';
    await wait(120);
    expect(rt.removed.length).toBeGreaterThan(0);
    bell.destroy();
  });
  it('an account switch with no alert replaces the channel with one for the new owner', async () => {
    const rt = fakeRealtime(); let cur = 'user_1';
    const bell = createNotificationsBell({ getClient: async () => client(0), isSignedIn: () => true, getRealtime: rt.getRealtime, getCurrentUserId: () => cur, identityCheckMs: 20 });
    await tick(); await tick();
    cur = 'user_2'; rt.userId = 'user_2';
    await wait(150);
    expect(rt.removed.length).toBeGreaterThan(0);
    expect(rt.filters[rt.filters.length - 1].filter).toBe('clerk_user_id=eq.user_2');
    bell.destroy();
  });
  it('the previous owner\'s unread number is cleared when the channel is dropped', async () => {
    const rt = fakeRealtime(); let cur = 'user_1';
    const srv = live(7);
    const bell = createNotificationsBell({ getClient: async () => srv, isSignedIn: () => true, getRealtime: rt.getRealtime, getCurrentUserId: () => cur });
    await tick(); await tick();
    expect(bell._count()).toBe(7);
    cur = 'user_2'; rt.userId = 'user_2'; srv.s.n = 0;   // another account (nothing unread), and an alert for the old one arrives
    rt.handlers.forEach((h) => h({ new: { id: 'n3', type: 'new_lead', title: 'x', read_at: null } }));
    await tick(); await tick();
    expect(bell._count()).toBe(0);
    expect(bell.element.querySelector('[role=status]').classList.contains('hidden')).toBe(true);   // the badge is hidden, not showing the old owner's number
    bell.destroy();
  });
  it('after an account switch the new owner\'s existing unread count appears without waiting for another alert', async () => {
    const rt = fakeRealtime(); let cur = 'user_1';
    const srv = live(7);
    const bell = createNotificationsBell({ getClient: async () => srv, isSignedIn: () => true, getRealtime: rt.getRealtime, getCurrentUserId: () => cur, identityCheckMs: 20 });
    await tick(); await tick();
    expect(bell._count()).toBe(7);
    cur = 'user_2'; rt.userId = 'user_2'; srv.s.n = 3;   // the other account already has 3 unread
    await wait(150);
    expect(rt.filters[rt.filters.length - 1].filter).toBe('clerk_user_id=eq.user_2');
    expect(bell._count()).toBe(3);
    bell.destroy();
  });
  it('an alert on the old channel after an account switch drops it and reconnects for the new owner', async () => {
    const rt = fakeRealtime(); let cur = 'user_1';
    const bell = createNotificationsBell({ getClient: async () => client(0), isSignedIn: () => true, getRealtime: rt.getRealtime, getCurrentUserId: () => cur, identityCheckMs: 100000 });
    await tick(); await tick();
    cur = 'user_2'; rt.userId = 'user_2';
    rt.handlers[0]({ new: { id: 'n9', type: 'new_lead', title: 'x', read_at: null } });
    await wait(50);
    expect(rt.filters[rt.filters.length - 1].filter).toBe('clerk_user_id=eq.user_2');
    bell.destroy();
  });
  it('the badge is also cleared when the owner changes during the asynchronous lookup', async () => {
    const rt = fakeRealtime(); let cur = 'user_1'; let slow = false; let release; const gate = new Promise((r) => { release = r; });
    const getRealtime = vi.fn(async () => { if (slow) await gate; return rt.getRealtime(); });
    const srv = live(5);
    const bell = createNotificationsBell({ getClient: async () => srv, isSignedIn: () => true, getRealtime, getCurrentUserId: () => cur });
    await tick(); await tick();
    expect(bell._count()).toBe(5);
    slow = true;
    rt.handlers.forEach((h) => h({ new: { id: 'n4', type: 'new_lead', title: 'x', read_at: null } }));
    cur = 'user_2'; rt.userId = 'user_2'; srv.s.n = 0; release(); await tick(); await tick();
    expect(bell._count()).toBe(0);
    bell.destroy();
  });
  it('a getCurrentUserId that throws never breaks alerts or the identity timer', async () => {
    const rt = fakeRealtime(); let boom = false;
    const srv = live(0);
    const bell = createNotificationsBell({ getClient: async () => srv, isSignedIn: () => true, getRealtime: rt.getRealtime, getCurrentUserId: () => { if (boom) throw new Error('host failure'); return 'user_1'; }, identityCheckMs: 20 });
    await tick(); await tick();
    boom = true; srv.s.n = 1;
    await insert(rt, { id: 'n5', type: 'milestone', title: 'still works', read_at: null });
    await wait(80);                                   // the timer ran several times without an uncaught error
    expect(bell._count()).toBe(1);
    expect(rt.removed.length).toBe(0);                // an unreadable id is treated as "unchanged"
    bell.destroy();
  });
});
