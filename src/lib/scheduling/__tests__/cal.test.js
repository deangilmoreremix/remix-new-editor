import { describe, it, expect, vi } from 'vitest';
import { calHost, calUsernameFor, myCalLink, bookingDefaults, wakeCal, schedulingUrl, openScheduling } from '../cal.js';

const HOST = 'https://book.example.com';

describe('calHost', () => {
  it('uses VITE_CAL_HOST, trims slashes and keeps only the origin', () => {
    expect(calHost({ VITE_CAL_HOST: 'https://book.example.com/' })).toBe(HOST);
    expect(calHost({ VITE_CAL_HOST: 'https://book.example.com/some/path' })).toBe(HOST);
  });
  it('refuses plain http (except localhost), credentials and junk', () => {
    expect(calHost({ VITE_CAL_HOST: 'http://book.example.com' })).toBe('');
    expect(calHost({ VITE_CAL_HOST: 'http://localhost:3000' })).toBe('http://localhost:3000');
    expect(calHost({ VITE_CAL_HOST: 'https://a:b@book.example.com' })).toBe('');
    expect(calHost({ VITE_CAL_HOST: 'javascript:alert(1)' })).toBe('');
  });
  it('has a working default', () => {
    expect(calHost({})).toMatch(/^https:\/\/.+\.beam\.cloud$/);
  });
});

describe('calUsernameFor / myCalLink (must match cal-diy ssoUsernameFor)', () => {
  it('uses the same vectors as the Cal.diy tests', () => {
    expect(calUsernameFor('user_2abcDEF123')).toBe('u-2abcdef123');
    expect(calUsernameFor('user_2ab-cd_EF!@#')).toBe('u-2abcdef');
    expect(calUsernameFor(`user_${'a'.repeat(60)}`)).toHaveLength(22);
    expect(calUsernameFor('user_!!!')).toBe('');
    expect(calUsernameFor(null)).toBe('');
  });
  it('builds a booking link, and nothing for a signed-out visitor', () => {
    expect(myCalLink('user_2abcDEF123')).toBe('u-2abcdef123/30min');
    expect(myCalLink('user_2abcDEF123', '15min')).toBe('u-2abcdef123/15min');
    expect(myCalLink('user_2abcDEF123', '../x')).toBe('');
    expect(myCalLink('')).toBe('');
  });
  it('bookingDefaults needs both a host and a user', () => {
    expect(bookingDefaults('user_2abc', { VITE_CAL_HOST: HOST })).toEqual({ host: HOST, link: 'u-2abc/30min' });
    expect(bookingDefaults('', { VITE_CAL_HOST: HOST })).toBeNull();
    expect(bookingDefaults('user_2abc', { VITE_CAL_HOST: 'http://nope.example.com' })).toBeNull();
  });
});

describe('wakeCal', () => {
  const fast = { host: HOST, sleep: async () => {}, intervalMs: 1 };
  it('resolves on the first answer', async () => {
    const fetchImpl = vi.fn(async () => ({ type: 'opaque', status: 0 }));
    await expect(wakeCal({ ...fast, fetchImpl })).resolves.toBe(true);
    expect(fetchImpl.mock.calls[0][0]).toBe(`${HOST}/api/auth/providers`);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ mode: 'no-cors' });
  });
  it('keeps trying while the VM is starting (network errors and 5xx) then succeeds', async () => {
    const answers = [() => { throw new TypeError('fail'); }, () => ({ status: 502 }), () => ({ type: 'opaque', status: 0 })];
    const fetchImpl = vi.fn(async () => answers.shift()());
    const ticks = [];
    await expect(wakeCal({ ...fast, fetchImpl, onTick: (ms) => ticks.push(ms) })).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(ticks).toHaveLength(2);
  });
  it('gives up after the timeout', async () => {
    let t = 0;
    const fetchImpl = vi.fn(async () => { throw new TypeError('down'); });
    await expect(wakeCal({ ...fast, fetchImpl, timeoutMs: 100, now: () => (t += 60) })).rejects.toThrow(/taking too long/);
  });
  it('refuses when there is no host', async () => {
    await expect(wakeCal({ host: '' })).rejects.toThrow(/not set up/);
  });
});

describe('schedulingUrl', () => {
  it('puts the token in the fragment and keeps next inside Cal.diy', () => {
    const u = schedulingUrl('a.b.c', '/availability', HOST);
    expect(u).toBe(`${HOST}/auth/sso#token=a.b.c&next=%2Favailability`);
    expect(new URL(u).search).toBe('');
  });
  it('replaces an unsafe next', () => {
    expect(schedulingUrl('t', 'https://evil.com', HOST)).toContain('next=%2Fevent-types');
    expect(schedulingUrl('t', '//evil.com', HOST)).toContain('next=%2Fevent-types');
  });
});

describe('openScheduling', () => {
  const makeWin = (getToken) => {
    const tab = { document: { title: '' }, location: { href: '' }, opener: 'x', close: vi.fn() };
    return { tab, win: { Clerk: { session: { getToken } }, open: vi.fn(() => tab), location: { assign: vi.fn() } } };
  };
  it('opens the tab first, waits for Cal.diy, then signs in with a fresh token', async () => {
    const order = [];
    const { tab, win } = makeWin(vi.fn(async () => { order.push('token'); return 'jwt.value.here'; }));
    win.open = vi.fn(() => { order.push('open'); return tab; });
    const wake = vi.fn(async () => { order.push('wake'); });
    const status = [];
    await openScheduling({ win, host: HOST, wake, onStatus: (s) => status.push(s) });
    expect(order).toEqual(['open', 'wake', 'token']);
    expect(tab.location.href).toBe(`${HOST}/auth/sso#token=jwt.value.here&next=%2Favailability`);
    expect(tab.opener).toBeNull();
    expect(status).toEqual(['Starting Scheduling…', '']);
  });
  it('falls back to this tab when pop-ups are blocked', async () => {
    const { win } = makeWin(async () => 'tok');
    win.open = vi.fn(() => null);
    await openScheduling({ win, host: HOST, wake: async () => {} });
    expect(win.location.assign).toHaveBeenCalledWith(expect.stringContaining('/auth/sso#token=tok'));
  });
  it('closes the tab and reports when Cal.diy never wakes', async () => {
    const { tab, win } = makeWin(async () => 'tok');
    await expect(openScheduling({ win, host: HOST, wake: async () => { throw new Error('taking too long'); } })).rejects.toThrow('taking too long');
    expect(tab.close).toHaveBeenCalled();
    expect(tab.location.href).toBe('');
  });
  it('asks the person to sign in when there is no session or token, and opens nothing', async () => {
    const open = vi.fn();
    await expect(openScheduling({ win: { open }, host: HOST })).rejects.toThrow(/Sign in/);
    expect(open).not.toHaveBeenCalled();
    const { tab, win } = makeWin(async () => null);
    await expect(openScheduling({ win, host: HOST, wake: async () => {} })).rejects.toThrow(/Sign in again/);
    expect(tab.close).toHaveBeenCalled();
  });
});
