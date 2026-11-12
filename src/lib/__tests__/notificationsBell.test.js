// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNotificationsBell, OPEN_FLAG } from '../notificationsBell.js';

const client = (n, error = null) => ({ rpc: vi.fn(async (name) => ({ data: name === 'owner_unread_notifications' ? n : null, error })) });
const tick = () => new Promise((r) => setTimeout(r, 0));
beforeEach(() => {
  const m = new Map();
  vi.stubGlobal('sessionStorage', { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } });
  window.location.hash = '';
});

describe('notifications bell', () => {
  it('shows the real unread count from the owner-only RPC', async () => {
    const c = client(7);
    const bell = createNotificationsBell({ getClient: async () => c, isSignedIn: () => true });
    await tick(); await tick();
    expect(c.rpc).toHaveBeenCalledWith('owner_unread_notifications');
    expect(bell.element.querySelector('[role=status]').textContent).toBe('7');
    expect(bell.element.getAttribute('aria-label')).toBe('Video alerts, 7 unread');
    expect(bell.element.classList.contains('hidden')).toBe(false);
    bell.destroy();
  });
  it('is hidden for signed-out visitors and never queries', async () => {
    const c = client(3);
    const bell = createNotificationsBell({ getClient: async () => c, isSignedIn: () => false });
    await tick();
    expect(bell.element.classList.contains('hidden')).toBe(true);
    expect(c.rpc).not.toHaveBeenCalled();
    bell.destroy();
  });
  it('shows no badge at zero, caps at 99+, and keeps the old count if the query fails', async () => {
    let n = 0; const c = { rpc: vi.fn(async () => ({ data: n, error: null })) };
    const bell = createNotificationsBell({ getClient: async () => c, isSignedIn: () => true });
    await tick(); await tick();
    expect(bell.element.querySelector('[role=status]').classList.contains('hidden')).toBe(true);
    n = 250; await bell.refresh(); expect(bell.element.querySelector('[role=status]').textContent).toBe('99+');
    c.rpc = vi.fn(async () => ({ data: null, error: { message: 'x' } })); await bell.refresh();
    expect(bell._count()).toBe(250);
    bell.destroy();
  });
  it('on another page it navigates to the classic timeline editor (hosts Projects) and leaves a flag; on the timeline it opens Projects directly', async () => {
    const navigate = vi.fn(); const opened = vi.fn();
    window.addEventListener('remix:open-projects', opened);
    const bell = createNotificationsBell({ getClient: async () => client(1), isSignedIn: () => true, navigate });
    await tick(); await tick();
    bell.element.click();
    expect(navigate).toHaveBeenCalledWith('timeline-classic');
    expect(sessionStorage.getItem(OPEN_FLAG)).toBe('1');
    window.location.hash = '#/timeline-classic';
    bell.element.click();
    expect(opened).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(OPEN_FLAG)).toBeNull();
    window.removeEventListener('remix:open-projects', opened);
    bell.destroy();
  });
});
