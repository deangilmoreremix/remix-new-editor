import { describe, it, expect } from 'vitest';
import { parseBrandHtml, looksBlocked, isThin, mergeScrapes, BASE64_PLACEHOLDER } from '../_personalization/src/server/brandStaticScrape';

const HTML = `<!doctype html><html><head><title> Acme Rockets </title>
<meta name="description" content="Friendly rockets"><meta property="og:image" content="/og.jpg">
<meta property="og:video" content="https://cdn.acme.test/promo.mp4"><link rel="icon" href="/fav.png">
<link href="https://fonts.googleapis.com/css?family=Poppins:400|Open+Sans" rel="stylesheet">
<style>body{font-family:'Montserrat', sans-serif;color:#112233} .hero{background:#c81e1e}</style></head>
<body><h1>Rockets for everyone</h1><script>var x=1</script>
<img src="/img/logo.svg" alt="Acme logo"><img src="/a.png" srcset="/a-1x.png 1x, /a-2x.png 2x">
<picture><source srcset="/p-400.webp 400w, /p-800.webp 800w"></picture>
<video src="/hero.webm" poster="/poster.jpg"><source src="/alt.mp4"></video>
<a href="/files/clip.mp4">clip</a><a href="javascript:void(0)">x</a></body></html>`;

describe('parseBrandHtml (free Cheerio fallback)', () => {
  const r = parseBrandHtml(HTML, 'https://acme.test/');
  it('reads title, description, og image, favicon and text (scripts excluded)', () => {
    expect(r.title).toBe('Acme Rockets');
    expect(r.description).toBe('Friendly rockets');
    expect(r.ogImage).toBe('https://acme.test/og.jpg');
    expect(r.favicon).toBe('https://acme.test/fav.png');
    expect(r.bodyText).toContain('Rockets for everyone');
    expect(r.bodyText).not.toContain('var x');
  });
  it('finds logos, the widest srcset image, picture sources and CSS-linked images', () => {
    expect(r.logoCandidates).toEqual(['https://acme.test/img/logo.svg']);
    expect(r.images).toContain('https://acme.test/a-2x.png');
    expect(r.images).toContain('https://acme.test/p-800.webp');
    expect(r.images).toContain('https://acme.test/poster.jpg');
  });
  it('finds videos from <video>, <source>, og:video and plain links; ignores javascript: links', () => {
    expect(r.videos).toEqual(expect.arrayContaining(['https://acme.test/hero.webm', 'https://acme.test/alt.mp4', 'https://cdn.acme.test/promo.mp4', 'https://acme.test/files/clip.mp4']));
    expect(JSON.stringify(r)).not.toContain('javascript:');
  });
  it('reads declared colours and fonts (incl. Google Fonts links)', () => {
    expect(r.rawColors).toEqual(expect.arrayContaining(['#112233', '#c81e1e']));
    expect(r.fonts).toEqual(expect.arrayContaining(['Montserrat', 'sans-serif', 'Poppins', 'Open Sans']));
  });
  it('is capped so a huge page cannot bloat the response', () => {
    const many = Array.from({ length: 200 }, (_, i) => `<img src="/i${i}.png">`).join('');
    expect(parseBrandHtml(`<html><body>${many}</body></html>`, 'https://a.test/').images.length).toBe(30);
  });
});

describe('looksBlocked', () => {
  it('flags block pages and empty scrapes', () => {
    for (const t of ['Robot Check', 'Access Denied', 'Just a moment...', 'Attention Required! | Cloudflare', 'Sorry! Something went wrong!']) expect(looksBlocked({ title: t, bodyText: 'short' })).toBe(true);
    expect(looksBlocked({ title: '', bodyText: '' })).toBe(true);
    expect(looksBlocked({ title: '', bodyText: 'tiny' })).toBe(true);
    expect(looksBlocked(null)).toBe(true);
  });
  it('does not flag real pages, even ones with block-ish words in a long article', () => {
    expect(looksBlocked({ title: 'Acme Rockets', bodyText: 'x'.repeat(300) })).toBe(false);
    expect(looksBlocked({ title: 'Access Denied: a history of locks', bodyText: 'word '.repeat(300) })).toBe(false);
    expect(looksBlocked({ title: 'Example Domain', bodyText: 'This domain is for use in documentation examples without needing permission. '.repeat(3) })).toBe(false);
  });
});

describe('thin pages, merging and placeholders', () => {
  it('isThin: a real title with next to no text is thin', () => {
    expect(isThin({ bodyText: '' })).toBe(true);
    expect(isThin({ bodyText: 'x'.repeat(499) })).toBe(true);
    expect(isThin({ bodyText: 'x'.repeat(500) })).toBe(false);
  });
  it('bare base64 lazy-load placeholders are not image URLs', () => {
    const r = parseBrandHtml('<html><body><img src="R0lGODlhAQABAHAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="><img src="/real.jpg"></body></html>', 'https://a.test/');
    expect(r.images).toEqual(['https://a.test/real.jpg']);
  });
  it('tracking beacons and pixels are not site images', () => {
    const r = parseBrandHtml('<html><body><img src="https://fls-na.amazon.com/1/batch/1/OP/x$uedata=s:/rd/uedata?a=1.png"><img src="/img/tracking-pixel.gif"><img src="https://www.facebook.com/tr?id=1&ev=PageView.png"><img src="/hero.jpg"></body></html>', 'https://a.test/');
    expect(r.images).toEqual(['https://a.test/hero.jpg']);
  });
  it('mergeScrapes keeps the browser screenshot and unions media', () => {
    const b = { title: 'b', description: '', bodyText: '', ogImage: null, favicon: null, url: 'u', logoCandidates: ['L1'], fonts: ['A'], rawColors: ['c1'], screenshot: 'S', images: ['i1'], videos: [] };
    const f = { ...b, title: 'f', bodyText: 'text', screenshot: null, logoCandidates: ['L2'], fonts: ['B'], rawColors: ['c2'], images: ['i2'], videos: ['v1'] };
    expect(mergeScrapes(b, f)).toMatchObject({ title: 'f', bodyText: 'text', screenshot: 'S', logoCandidates: ['L1', 'L2'], fonts: ['A', 'B'], rawColors: ['c1'], images: ['i1', 'i2'], videos: ['v1'] });
  });
});

describe('review follow-ups', () => {
  it('a real brand with "robot" in its name is not a block page, but a Robot Check page is', () => {
    expect(looksBlocked({ title: 'Acme Robotics', bodyText: 'We build warehouse robots. '.repeat(15) })).toBe(false);
    expect(looksBlocked({ title: 'Robot Check', bodyText: 'Enter the characters you see below' })).toBe(true);
    expect(looksBlocked({ title: 'Are you a robot?', bodyText: 'Please verify.' })).toBe(true);
  });
  it('a valid extensionless relative path is kept; only inline base64 placeholders are dropped', () => {
    const r = parseBrandHtml('<html><body><img src="/images/products/collections/summerwear/dresses"><img src="data-less-placeholder-iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk"><img src="R0lGODlhAQABAHAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="></body></html>', 'https://a.test/');
    expect(r.images).toContain('https://a.test/images/products/collections/summerwear/dresses');
    expect(r.images.some((u) => u.includes('R0lGOD'))).toBe(false);
    expect(BASE64_PLACEHOLDER.test('/images/products/collections/summerwear/dresses')).toBe(false);
    expect(BASE64_PLACEHOLDER.test('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk')).toBe(true);
  });
  it('resolves relative media against the page URL it is given (the post-redirect URL)', () => {
    const r = parseBrandHtml('<html><body><img src="hero.jpg"><link rel="icon" href="fav.png"></body></html>', 'https://www.example.com/en/');
    expect(r.images).toContain('https://www.example.com/en/hero.jpg');
    expect(r.favicon).toBe('https://www.example.com/en/fav.png');
  });
  it('does not invent a favicon the page never declared', () => {
    expect(parseBrandHtml('<html><head><title>x</title></head><body>hi</body></html>', 'https://a.test/').favicon).toBeNull();
  });
  it('mergeScrapes keeps browser metadata (og image, description, favicon) the static copy lacks', () => {
    const base = { url: 'u', title: '', description: '', bodyText: '', ogImage: null, favicon: null, logoCandidates: [], fonts: [], rawColors: [], screenshot: null, images: [], videos: [] };
    const b = { ...base, title: 'B', description: 'from js', ogImage: 'https://x/og.png', favicon: 'https://x/f.ico', screenshot: 'S' };
    const f = { ...base, title: '', bodyText: 'lots of text' };
    expect(mergeScrapes(b, f)).toMatchObject({ title: 'B', description: 'from js', ogImage: 'https://x/og.png', favicon: 'https://x/f.ico', bodyText: 'lots of text', screenshot: 'S' });
    expect(mergeScrapes(b, { ...f, description: 'static', ogImage: 'https://x/s.png' })).toMatchObject({ description: 'static', ogImage: 'https://x/s.png' });
  });
});
