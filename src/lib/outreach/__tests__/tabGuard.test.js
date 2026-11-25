import { describe, it, expect, vi } from 'vitest';
import { createTabGuard } from '../tabGuard.js';

const flush = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); };

// A small LockManager with one exclusive lock: ifAvailable, steal and a FIFO queue, like the browser's.
function fakeLocks() {
  let holder = null; // { done, reject }
  const queue = [];
  const grant = (entry) => {
    let done;
    const finished = new Promise((r) => { done = r; });
    holder = { done, reject: entry.reject };
    Promise.resolve(entry.cb({ name: 'x' })).then((v) => { if (holder?.done === done) { holder = null; next(); } entry.resolve(v); }, entry.reject);
    return finished;
  };
  const next = () => { if (!holder && queue.length) grant(queue.shift()); };
  return {
    request(name, opts, cb) {
      if (typeof opts === 'function') { cb = opts; opts = {}; }
      return new Promise((resolve, reject) => {
        const entry = { cb, resolve, reject };
        if (opts.steal) {
          const old = holder; holder = null;
          old?.reject(Object.assign(new Error('stolen'), { name: 'AbortError' }));
          grant(entry);
        } else if (!holder) grant(entry);
        else if (opts.ifAvailable) Promise.resolve(cb(null)).then(resolve, reject);
        else queue.push(entry);
      });
    },
  };
}

// BroadcastChannel between "tabs" in one test.
function fakeChannelClass() {
  const all = new Set();
  return class {
    constructor() { this.l = new Set(); all.add(this); }
    addEventListener(t, f) { this.l.add(f); }
    removeEventListener(t, f) { this.l.delete(f); }
    postMessage(data) { for (const c of all) if (c !== this) c.l.forEach((f) => f({ data })); }
    close() { all.delete(this); }
  };
}

describe('createTabGuard', () => {
  it('lets the first tab edit, blocks the second, and hands over on take over', async () => {
    const locks = fakeLocks(); const Channel = fakeChannelClass();
    const a = vi.fn(); const b = vi.fn();
    const tabA = createTabGuard({ locks, Channel, onChange: a });
    await flush();
    const tabB = createTabGuard({ locks, Channel, onChange: b });
    await flush();
    expect(tabA.active()).toBe(true);
    expect(tabB.active()).toBe(false);
    expect(b).toHaveBeenLastCalledWith(false);

    tabB.takeOver();
    await flush();
    expect(tabB.active()).toBe(true);
    expect(tabA.active()).toBe(false);
    expect(a).toHaveBeenLastCalledWith(false);

    // When the editing tab closes, the waiting tab gets editing back by itself.
    tabB.destroy();
    await flush();
    expect(tabA.active()).toBe(true);
    tabA.destroy();
  });

  it('tells other tabs when the draft was saved', async () => {
    const locks = fakeLocks(); const Channel = fakeChannelClass();
    const remoteA = vi.fn(); const remoteB = vi.fn();
    const tabA = createTabGuard({ locks, Channel, onRemoteSave: remoteA });
    const tabB = createTabGuard({ locks, Channel, onRemoteSave: remoteB });
    await flush();
    tabA.saved();
    expect(remoteB).toHaveBeenCalledTimes(1);
    expect(remoteA).not.toHaveBeenCalled();
    tabA.destroy(); tabB.destroy();
  });

  it('without Web Locks every tab edits, and saves are noticed through the storage event', () => {
    const listeners = {};
    const win = { addEventListener: (t, f) => { listeners[t] = f; }, removeEventListener: (t) => { delete listeners[t]; } };
    const remote = vi.fn();
    const g = createTabGuard({ locks: null, Channel: null, win, onRemoteSave: remote });
    expect(g.supported).toBe(false);
    expect(g.active()).toBe(true);
    listeners.storage({ key: 'outreach-draft-v1' });
    listeners.storage({ key: 'something-else' });
    expect(remote).toHaveBeenCalledTimes(1);
    g.takeOver(); g.saved();
    g.destroy();
    expect(listeners.storage).toBeUndefined();
  });
});
