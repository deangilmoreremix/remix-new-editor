// Optional Turnstile widget: off without a site key, renders and exposes the token with one, and its token reaches lead-capture.
import { describe, it, expect, vi } from 'vitest';
import { turnstileSiteKey, mountTurnstile } from '../turnstile.js';
import { submitViewerLead } from '../publishClient.js';

describe('turnstileSiteKey', () => {
  it('is empty unless VITE_TURNSTILE_SITE_KEY looks like a key', () => {
    expect(turnstileSiteKey({})).toBe('');
    expect(turnstileSiteKey({ VITE_TURNSTILE_SITE_KEY: '  ' })).toBe('');
    expect(turnstileSiteKey({ VITE_TURNSTILE_SITE_KEY: 'bad key!' })).toBe('');
    expect(turnstileSiteKey({ VITE_TURNSTILE_SITE_KEY: ' 0x4AAAAAAAabcdef ' })).toBe('0x4AAAAAAAabcdef');
  });
});

describe('mountTurnstile', () => {
  it('renders the widget and exposes the solved token, until it expires or is reset', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    let opts;
    const api = { render: vi.fn((_el, o) => { opts = o; return 'w1'; }), reset: vi.fn() };
    const t = mountTurnstile(container, 'SITEKEY123', { load: async () => api });
    expect(t.token()).toBe('');
    await vi.waitFor(() => expect(t.isReady()).toBe(true));
    expect(opts.sitekey).toBe('SITEKEY123');
    opts.callback('tok-1');
    expect(t.token()).toBe('tok-1');
    opts['expired-callback']();
    expect(t.token()).toBe('');
    opts.callback('tok-2');
    t.reset();
    expect(t.token()).toBe('');
    expect(api.reset).toHaveBeenCalledWith('w1');
  });
  it('stays quiet when the script cannot load', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const t = mountTurnstile(container, 'SITEKEY123', { load: async () => null });
    await Promise.resolve();
    expect(t.isReady()).toBe(false);
    expect(t.token()).toBe('');
    expect(() => t.reset()).not.toThrow();
  });
});

describe('submitViewerLead + Turnstile', () => {
  const cfg = (fetchImpl) => ({ url: 'https://x.supabase.co', key: 'k', fetchImpl });
  it('sends the token as cf-turnstile-response (not in the signals) and passes duplicate through', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, stored: true, duplicate: true }) }));
    const res = await submitViewerLead({ publishedId: 'Abc123XyZ9', clipId: 'a', kind: 'lead-form', data: { EMAIL: 'a@b.co' }, signals: { hp: '', ms: 3000, turnstile: 'tok' } }, cfg(fetchImpl));
    const sent = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(sent['cf-turnstile-response']).toBe('tok');
    expect(sent.signals).toEqual({ hp: '', ms: 3000 });
    expect(res).toEqual({ stored: true, duplicate: true, error: null });
  });
  it('sends nothing extra when there is no token', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, stored: true }) }));
    const res = await submitViewerLead({ publishedId: 'Abc123XyZ9', clipId: 'a', kind: 'lead-form', data: { EMAIL: 'a@b.co' }, signals: { hp: '' } }, cfg(fetchImpl));
    expect('cf-turnstile-response' in JSON.parse(fetchImpl.mock.calls[0][1].body)).toBe(false);
    expect(res).toEqual({ stored: true, error: null });
  });
});
