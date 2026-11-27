// whenClerkUser: one-shot "SmartVid account is here" hook used by Website Builder and Video Pages
// (no separate sign-in screen, no leaked Clerk listeners, bounded retry when Clerk is missing).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@clerk/clerk-js', () => ({ Clerk: class {} }));

const fakeClerk = ({ userId = null, sync = false } = {}) => {
  const listeners = new Set();
  const clerk = {
    loaded: true,
    user: userId ? { id: userId } : null,
    unsubscribed: 0,
    addListener(cb) {
      listeners.add(cb);
      if (sync) cb({ user: clerk.user });
      return () => { clerk.unsubscribed += 1; listeners.delete(cb); };
    },
    signIn(id) { clerk.user = { id }; [...listeners].forEach((cb) => cb({ user: clerk.user })); },
    get listenerCount() { return listeners.size; },
  };
  return clerk;
};

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('whenClerkUser', () => {
  let whenClerkUser;
  beforeEach(async () => {
    vi.resetModules();
    ({ whenClerkUser } = await import('../clerkInit.js'));
  });
  afterEach(() => { delete window.Clerk; vi.useRealTimers(); });

  it('fires once right away when a user is already signed in', async () => {
    window.Clerk = fakeClerk({ userId: 'u1' });
    const onUser = vi.fn();
    whenClerkUser(onUser);
    await flush();
    expect(onUser).toHaveBeenCalledTimes(1);
    expect(window.Clerk.listenerCount).toBe(0);
  });

  it('waits for a sign-in, fires once, and removes its listener', async () => {
    window.Clerk = fakeClerk();
    const onUser = vi.fn();
    whenClerkUser(onUser);
    await flush();
    expect(onUser).not.toHaveBeenCalled();
    expect(window.Clerk.listenerCount).toBe(1);
    window.Clerk.signIn('u1');
    window.Clerk.signIn('u1'); // a later notification must not fire again
    expect(onUser).toHaveBeenCalledTimes(1);
    expect(window.Clerk.listenerCount).toBe(0);
  });

  it('cancel removes the listener when the page closes before sign-in', async () => {
    window.Clerk = fakeClerk();
    const onUser = vi.fn();
    const cancel = whenClerkUser(onUser);
    await flush();
    cancel();
    expect(window.Clerk.listenerCount).toBe(0);
    window.Clerk.signIn('u1');
    expect(onUser).not.toHaveBeenCalled();
  });

  it('handles Clerk calling the listener synchronously', async () => {
    const clerk = fakeClerk({ sync: true });
    clerk.user = null;
    window.Clerk = clerk;
    const onUser = vi.fn();
    whenClerkUser(onUser);
    await flush();
    clerk.signIn('u1');
    expect(onUser).toHaveBeenCalledTimes(1);
    expect(clerk.listenerCount).toBe(0);
  });
});
