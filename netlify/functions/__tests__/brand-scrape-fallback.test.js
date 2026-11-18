/* global Request */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const browser = vi.hoisted(() => ({ scrapeBrandSite: vi.fn() }));
const stat = vi.hoisted(() => ({ scrapeBrandStatic: vi.fn() }));
vi.mock('../_personalization/src/server/browserDiscovery', () => {
  class BrowserSsrfError extends Error {}
  return { BrowserSsrfError, scrapeBrandSite: browser.scrapeBrandSite };
});
vi.mock('../_personalization/src/server/brandStaticScrape', async () => {
  const actual = await vi.importActual('../_personalization/src/server/brandStaticScrape');
  return { ...actual, scrapeBrandStatic: stat.scrapeBrandStatic };
});

const good = (extra = {}) => ({ url: 'https://s.test', title: 'Acme', description: 'd', bodyText: 'We make friendly rockets. '.repeat(20), ogImage: null, favicon: null, logoCandidates: [], fonts: ['Inter'], rawColors: ['#336699'], screenshot: 'abc', images: ['https://s.test/a.png'], videos: [], ...extra });
let n = 0;
const call = async (url = 'https://s.test') => {
  const { default: handler } = await import('../brand-scrape.mts');
  const res = await handler(new Request('https://x.test/api/scrape', { method: 'POST', headers: { 'x-nf-client-connection-ip': `198.51.100.${++n}` }, body: JSON.stringify({ url }) }));
  return { status: res.status, body: await res.json() };
};

beforeEach(() => { vi.clearAllMocks(); });

describe('/api/scrape fallback', () => {
  it('uses the browser result when it is real content (no fallback)', async () => {
    browser.scrapeBrandSite.mockResolvedValue(good());
    const r = await call();
    expect(r.body.data.title).toBe('Acme');
    expect(stat.scrapeBrandStatic).not.toHaveBeenCalled();
  });
  it('a captcha/robot page from Chromium falls back to the static fetch', async () => {
    browser.scrapeBrandSite.mockResolvedValue(good({ title: 'Robot Check', bodyText: 'Enter the characters you see below', screenshot: 'wallshot' }));
    stat.scrapeBrandStatic.mockResolvedValue(good({ title: 'Real Brand', screenshot: null }));
    const r = await call();
    expect(r.body.data.title).toBe('Real Brand');
    expect(r.body.data.screenshot).toBeNull(); // the block page's screenshot is not passed on
  });
  it('an empty Chromium page falls back too', async () => {
    browser.scrapeBrandSite.mockResolvedValue(good({ title: '', bodyText: '', screenshot: 'x' }));
    stat.scrapeBrandStatic.mockResolvedValue(good({ title: 'Static Title' }));
    expect((await call()).body.data.title).toBe('Static Title');
  });
  it('when both are blocked the block page text is dropped and the result is flagged', async () => {
    browser.scrapeBrandSite.mockResolvedValue(good({ title: 'Access Denied', bodyText: 'denied', images: ['https://s.test/wall.png'] }));
    stat.scrapeBrandStatic.mockResolvedValue(null);
    const r = await call();
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ title: '', bodyText: '', screenshot: null, images: [], blocked: true });
  });
  it('a browser crash still works through the static fallback', async () => {
    browser.scrapeBrandSite.mockRejectedValue(new Error('browser died'));
    stat.scrapeBrandStatic.mockResolvedValue(good({ title: 'Static Only' }));
    expect((await call()).body.data.title).toBe('Static Only');
  });
  it('a browser crash and no static page is a 502', async () => {
    browser.scrapeBrandSite.mockRejectedValue(new Error('browser died'));
    stat.scrapeBrandStatic.mockResolvedValue(null);
    expect((await call()).status).toBe(502);
  });
  it('a thin page (real title, almost no text) takes the richer static text but keeps the browser screenshot and colours', async () => {
    browser.scrapeBrandSite.mockResolvedValue(good({ title: 'nytimes.com', bodyText: '', screenshot: 'realshot', rawColors: ['rgb(1,2,3)'], fonts: ['Georgia'] }));
    stat.scrapeBrandStatic.mockResolvedValue(good({ title: 'The New York Times', bodyText: 'News. '.repeat(200), screenshot: null, rawColors: ['#ffffff'], fonts: ['Cheltenham'] }));
    const r = await call();
    expect(r.body.data.title).toBe('The New York Times');
    expect(r.body.data.bodyText.length).toBeGreaterThan(500);
    expect(r.body.data.screenshot).toBe('realshot');
    expect(r.body.data.rawColors).toEqual(['rgb(1,2,3)']);
    expect(r.body.data.fonts).toEqual(expect.arrayContaining(['Georgia', 'Cheltenham']));
    expect(r.body.data.blocked).toBeUndefined();
  });
  it('a thin page whose static copy is no better is left as the browser saw it', async () => {
    browser.scrapeBrandSite.mockResolvedValue(good({ title: 'Tiny Site', bodyText: 'Just a few words here, but a real page, with a real screenshot.' }));
    stat.scrapeBrandStatic.mockResolvedValue(good({ title: 'Tiny Site', bodyText: 'short' }));
    const r = await call();
    expect(r.body.data.title).toBe('Tiny Site');
    expect(r.body.data.screenshot).toBe('abc');
  });
  it('an SSRF rejection is a 400 and never triggers the fallback', async () => {
    const { BrowserSsrfError } = await import('../_personalization/src/server/browserDiscovery');
    browser.scrapeBrandSite.mockRejectedValue(new BrowserSsrfError('private range'));
    const r = await call('http://10.0.0.1/');
    expect(r.status).toBe(400);
    expect(stat.scrapeBrandStatic).not.toHaveBeenCalled();
  });
});
