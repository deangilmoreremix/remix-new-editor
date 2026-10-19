// src/components/personalize/discovery/__tests__/staticFetch.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeFetch, safeFetchAsset } from '../staticFetch.js';

function makeResponse(status, body, opts = {}) {
  const headers = new Map();
  if (opts.location) headers.set('location', opts.location);
  if (opts.contentType) headers.set('content-type', opts.contentType);
  return {
    status,
    headers: { get: (k) => headers.get(k.toLowerCase()) || null },
    text: async () => body,
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
  };
}

describe('staticFetch.safeFetch', () => {
  let originalFetch;
  let originalLookup;
  let dnsAnswers;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalLookup = require('node:dns').promises.lookup;
    dnsAnswers = { 'example.com': [{ address: '93.184.216.34' }] };
    require('node:dns').promises.lookup = (host, opts) => {
      if (dnsAnswers[host]) return Promise.resolve(dnsAnswers[host]);
      return Promise.reject(new Error('ENOTFOUND'));
    };
  });
  afterEach(() => {
    global.fetch = originalFetch;
    require('node:dns').promises.lookup = originalLookup;
  });

  it('fetches and returns body on 200', async () => {
    global.fetch = vi.fn(async () => makeResponse(200, '<html></html>', { contentType: 'text/html' }));
    const r = await safeFetch('https://example.com/');
    expect(r.ok).toBe(true);
    expect(r.body).toBe('<html></html>');
    expect(r.finalUrl).toBe('https://example.com/');
  });

  it('rejects non-http(s) URLs', async () => {
    const r = await safeFetch('ftp://example.com/');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Protocol/);
  });

  it('rejects private IPs (literal)', async () => {
    const r = await safeFetch('http://127.0.0.1/');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/private IP/);
  });

  it('rejects hostnames that resolve to private IPs', async () => {
    dnsAnswers['evil.com'] = [{ address: '10.0.0.5' }];
    const r = await safeFetch('https://evil.com/');
    expect(r.ok).toBe(false);
  });

  it('follows redirects and re-validates each hop', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(makeResponse(302, '', { location: 'https://example.com/landing' }))
      .mockResolvedValueOnce(makeResponse(200, '<html></html>', { contentType: 'text/html' }));
    const r = await safeFetch('https://example.com/');
    expect(r.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[0][0]).toBe('https://example.com/');
    expect(global.fetch.mock.calls[1][0]).toBe('https://example.com/landing');
  });

  it('aborts on redirect to private host', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(makeResponse(302, '', { location: 'http://127.0.0.1/admin' }));
    const r = await safeFetch('https://example.com/');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/private IP|127\.0\.0\.1/);
  });

  it('times out on slow responses', async () => {
    global.fetch = vi.fn(async (_url, init) => {
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new Error('aborted')));
      });
    });
    const r = await safeFetch('https://example.com/', { timeoutMs: 50 });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/aborted|timeout|error/i);
  });

  it('returns error for non-html content-types', async () => {
    global.fetch = vi.fn(async () => makeResponse(200, '{}', { contentType: 'application/json' }));
    const r = await safeFetch('https://example.com/');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/content-type/);
  });
});

describe('staticFetch.safeFetchAsset', () => {
  let originalLookup;
  beforeEach(() => {
    originalLookup = require('node:dns').promises.lookup;
    require('node:dns').promises.lookup = (host) => {
      if (host === 'cdn.example.com') return Promise.resolve([{ address: '93.184.216.34' }]);
      return Promise.reject(new Error('ENOTFOUND'));
    };
  });
  afterEach(() => {
    require('node:dns').promises.lookup = originalLookup;
  });

  it('rejects junk extension', async () => {
    const r = await safeFetchAsset('https://cdn.example.com/file.exe');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/junk/);
  });

  it('fetches a valid png', async () => {
    const orig = global.fetch;
    global.fetch = vi.fn(async () => makeResponse(200, 'PNGDATA', { contentType: 'image/png' }));
    const r = await safeFetchAsset('https://cdn.example.com/img.png');
    expect(r.ok).toBe(true);
    global.fetch = orig;
  });
});