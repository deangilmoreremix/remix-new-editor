// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { isSafePushEndpoint, sendToSubscriptions } from '../_shared/pushAdapter.js';

describe('isSafePushEndpoint', () => {
  it('accepts public https push services', () => {
    ['https://fcm.googleapis.com/fcm/send/abc', 'https://updates.push.services.mozilla.com/wpush/v2/xyz', 'https://web.push.apple.com/Q123', 'https://wns2-par02p.notify.windows.com/?token=1', 'https://push.example/1', 'https://fcm.googleapis.com:443/x']
      .forEach((u) => expect(isSafePushEndpoint(u), u).toBe(true));
  });
  it('rejects anything that could reach the server\'s own network', () => {
    ['http://fcm.googleapis.com/x', 'https://127.0.0.1/x', 'https://127.1/x', 'https://0x7f.0.0.1/x', 'https://2130706433/x', 'https://10.0.0.5/x', 'https://169.254.169.254/latest/meta-data',
      'https://192.168.1.10/x', 'https://[::1]/x', 'https://[fd00::1]/x', 'https://localhost/x', 'https://db.internal/x', 'https://printer.local/x', 'https://intranet/x',
      'https://user:pw@fcm.googleapis.com/x', 'https://fcm.googleapis.com:8443/x', 'https://fcm.googleapis.com./x', 'ftp://fcm.googleapis.com/x', 'javascript:alert(1)', '', null, undefined, 'not a url']
      .forEach((u) => expect(isSafePushEndpoint(u), String(u)).toBe(false));
  });
});

describe('sendToSubscriptions with an unsafe endpoint', () => {
  it('never connects to it, removes it, and still sends to the safe ones', async () => {
    const calls = [];
    const call = vi.fn(async (path, init = {}) => { calls.push({ path, method: init.method }); return null; });
    const wp = { sendNotification: vi.fn(async () => ({ statusCode: 201 })) };
    const subs = [
      { id: 'bad', endpoint: 'https://169.254.169.254/latest', p256dh: 'k', auth: 'a', failure_count: 0 },
      { id: 'good', endpoint: 'https://fcm.googleapis.com/fcm/send/1', p256dh: 'k', auth: 'a', failure_count: 0 },
    ];
    const out = await sendToSubscriptions({ call, wp, subs, payload: { t: 1 } });
    expect(out).toEqual({ sent: 1, failed: 0, removed: 1 });
    expect(wp.sendNotification).toHaveBeenCalledTimes(1);
    expect(wp.sendNotification.mock.calls[0][0].endpoint).toBe('https://fcm.googleapis.com/fcm/send/1');
    expect(calls).toContainEqual({ path: 'owner_push_subscriptions?id=eq.bad', method: 'DELETE' });
  });
});
