// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { mountPushCard } from '../pushCard.js';

const KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
const tick = () => new Promise((r) => setTimeout(r, 0));

function setup({ vapidKey = KEY, permission = 'default', request = 'granted', withSw = true } = {}) {
  let current = null;
  const sub = { endpoint: 'https://push.example/abc', toJSON: () => ({ endpoint: 'https://push.example/abc', keys: { p256dh: 'P', auth: 'A' } }), unsubscribe: vi.fn(async () => true) };
  const reg = { pushManager: { subscribe: vi.fn(async () => { current = sub; return sub; }), getSubscription: vi.fn(async () => current) }, showNotification: vi.fn(async () => {}) };
  const Notification = { permission, requestPermission: vi.fn(async () => { Notification.permission = request; return request; }) };
  const env = { navigator: { userAgent: 'Chrome', serviceWorker: { getRegistration: vi.fn(async () => (withSw ? reg : undefined)) } }, Notification, PushManager: function PushManager() {} };
  const calls = [];
  const client = { from: (t) => ({ delete: () => ({ eq: async () => { calls.push(['delete', t]); return { error: null }; } }), insert: async (r) => { calls.push(['insert', t, r.endpoint]); return { error: null }; } }) };
  const onPushPref = vi.fn(async () => {});
  const host = document.createElement('div'); document.body.appendChild(host);
  const card = mountPushCard(host, { getClient: async () => client, pushEnabled: false, onPushPref, vapidKey, env });
  return { host, card, reg, env, calls, onPushPref, Notification };
}

describe('push card', () => {
  it('without a VAPID key it says push is not set up and shows no controls', async () => {
    const { host, card } = setup({ vapidKey: '' });
    await card.ready;
    expect(host.textContent).toContain("Push notifications aren't set up on this site yet");
    expect(host.querySelector('button')).toBeNull();
    expect(host.querySelector('input')).toBeNull();
  });
  it('in dev (no service worker) it explains push works on the deployed site', async () => {
    const { host, card } = setup({ withSw: false });
    await card.ready;
    expect(host.textContent).toContain('deployed site');
    expect(host.querySelector('button')).toBeNull();
  });
  it('does not ask for permission on load, only from the Enable click, then saves the row and the preference', async () => {
    const { host, card, Notification, calls, onPushPref } = setup();
    await card.ready;
    expect(Notification.requestPermission).not.toHaveBeenCalled();
    host.querySelector('[data-push-toggle]').click();
    await tick(); await tick(); await tick();
    expect(Notification.requestPermission).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([['delete', 'push_subscriptions'], ['insert', 'push_subscriptions', 'https://push.example/abc']]);
    expect(onPushPref).toHaveBeenCalledWith(true);
    expect(host.querySelector('[data-push-toggle]').textContent).toBe('Disable on this device');
    expect(host.querySelector('[data-push-test]')).not.toBeNull();
  });
  it('blocked permission shows how to re-enable', async () => {
    const { host, card } = setup({ permission: 'denied' });
    await card.ready;
    expect(host.querySelector('[data-push-status]').textContent).toMatch(/site settings/);
    expect(host.querySelector('[data-push-toggle]')).toBeNull();
  });
  it('the preference toggle saves retarget_preferences.push and the buttons are labelled', async () => {
    const { host, card, onPushPref } = setup();
    await card.ready;
    const box = host.querySelector('[name=push]');
    box.checked = true; box.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();
    expect(onPushPref).toHaveBeenCalledWith(true);
    expect(host.querySelector('section').getAttribute('aria-labelledby')).toBe('sv-push-title');
  });
});
