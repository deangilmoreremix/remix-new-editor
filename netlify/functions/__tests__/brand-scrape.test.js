/* global Request */
import { describe, it, expect } from 'vitest';
import handler, { rateLimited } from '../brand-scrape.mts';

const post = (body, ip = '203.0.113.1') =>
  new Request('https://x.test/api/scrape', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

describe('POST /api/scrape', () => {
  it('rejects non-POST', async () => {
    expect((await handler(new Request('https://x.test/api/scrape'))).status).toBe(405);
  });
  it('rejects bad JSON and missing url', async () => {
    expect((await handler(post('{nope', '203.0.113.2'))).status).toBe(400);
    expect((await handler(post({}, '203.0.113.3'))).status).toBe(400);
  });
  it.each([
    'http://127.0.0.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://localhost:8888/',
    'http://[::1]/',
    'file:///etc/passwd',
    'https://user:pw@example.com/',
  ])('blocks SSRF target %s before any browser launch', async (url) => {
    const res = await handler(post({ url }, `198.51.100.${Math.floor(Math.random() * 250)}`));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
  });
  it('rate limits per client', () => {
    const t = Date.now();
    const results = Array.from({ length: 8 }, () => rateLimited('rl-test', t));
    expect(results.filter(Boolean).length).toBe(2);
    expect(rateLimited('rl-test', t + 61_000)).toBe(false);
  });
});
