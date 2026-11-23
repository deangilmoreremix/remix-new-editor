import { describe, it, expect, vi, afterEach } from 'vitest';
import { onOwnerNotification, ensureLiveAlerts, isOutreachAlertFor, _setLiveAlertDeps } from '../liveAlerts.js';
import { createNotificationsBell } from '../notificationsBell.js';

const flush = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)); };

function fakeClient() {
  const ch = { handlers: [], subscribed: false, on(type, filter, fn) { this.handlers.push({ type, filter, fn }); return this; }, subscribe() { this.subscribed = true; return this; } };
  return {
    ch,
    channel: vi.fn(() => ch),
    removeChannel: vi.fn(),
    realtime: { setAuth: vi.fn() },
    insert(row) { ch.handlers.forEach((h) => h.fn({ new: row })); },
  };
}

describe('live alerts', () => {
  afterEach(() => _setLiveAlertDeps(null));

  it('subscribes once with the owner token, fans out inserts, and closes with the last listener', async () => {
    const client = fakeClient();
    _setLiveAlertDeps(async () => ({ client, prime: async () => 'jwt-owner' }));
    const a = vi.fn(); const b = vi.fn();
    const stopA = onOwnerNotification(a);
    const stopB = onOwnerNotification(b);
    await flush();
    expect(client.channel).toHaveBeenCalledTimes(1);
    expect(client.realtime.setAuth).toHaveBeenCalledWith('jwt-owner');
    expect(client.ch.handlers[0].filter).toEqual({ event: 'INSERT', schema: 'public', table: 'owner_notifications' });
    client.insert({ id: 1, title: 'Mike Ross is watching your video' });
    expect(a).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    expect(b).toHaveBeenCalledTimes(1);
    stopA();
    expect(client.removeChannel).not.toHaveBeenCalled();
    stopB();
    expect(client.removeChannel).toHaveBeenCalledWith(client.ch);
  });

  it('waits while signed out and connects on a later ensure', async () => {
    const client = fakeClient();
    let token = null;
    _setLiveAlertDeps(async () => ({ client, prime: async () => token }));
    const stop = onOwnerNotification(() => {});
    await flush();
    expect(client.channel).not.toHaveBeenCalled();
    token = 'jwt';
    await ensureLiveAlerts();
    expect(client.channel).toHaveBeenCalledTimes(1);
    stop();
  });

  it('tells this campaign\'s outreach alerts apart', () => {
    expect(isOutreachAlertFor({ video_id: 'v1', dedupe_key: 'outreach:v1:c1:play' }, 'v1')).toBe(true);
    expect(isOutreachAlertFor({ video_id: 'v1', dedupe_key: 'milestone:v1' }, 'v1')).toBe(false);
    expect(isOutreachAlertFor({ video_id: 'v2', dedupe_key: 'outreach:v2:c1:play' }, 'v1')).toBe(false);
    expect(isOutreachAlertFor({ video_id: 'v1', dedupe_key: 'outreach:v1:c1:play' }, null)).toBe(false);
  });

  it('the bell refreshes at once on a live alert and stops listening on destroy', async () => {
    let fire = null;
    const stop = vi.fn();
    const rpc = vi.fn(async () => ({ data: 2, error: null }));
    const bell = createNotificationsBell({ getClient: async () => ({ rpc }), isSignedIn: () => true, live: { listen: (fn) => { fire = fn; return stop; }, ensure: vi.fn() } });
    await flush();
    const before = rpc.mock.calls.length;
    fire({ id: 9 });
    await flush();
    expect(rpc.mock.calls.length).toBe(before + 1);
    expect(bell._count()).toBe(2);
    bell.destroy();
    expect(stop).toHaveBeenCalled();
  });
});
