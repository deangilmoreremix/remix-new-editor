// HTML for the public SmartWarmupAI feature pages: /email-warmup/ (hub) and /email-warmup/<slug>/.
// Pure string functions (no DOM). scripts/build-warmup-pages.mjs writes them as standalone static pages.
// Every page starts with the same header row: the SmartWarmupAI logo, one link per feature page, and an
// "Open studio" button that goes to the SmartWarmupAI studio (/smartwarmupai).

import { WARMUP_PAGES, PRODUCT_PAGES, USE_CASE_PAGES, LEARN, WARMUP_BASE, STUDIO_PATH, PRODUCT, HUB } from '../../data/warmupPages.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const pageHref = (slug) => `${WARMUP_BASE}/${slug}/`;

export const WARMUP_CSS = `
:root{--bg:#0b0b0d;--panel:#131316;--panel2:#1b1b20;--line:rgba(255,255,255,.1);--text:#ecedf0;--mute:#a0a5b0;--accent:#e8590c;--accent2:#ff7a2e;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:inherit}
.w{max-width:1120px;margin:0 auto;padding:0 20px}
.top{position:sticky;top:0;z-index:20;background:rgba(11,11,13,.92);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.top .w{display:flex;align-items:center;gap:16px;height:60px}
.logo{font-weight:800;text-decoration:none;white-space:nowrap;letter-spacing:-.01em}
.logo span{color:var(--accent2)}
.top nav{display:flex;gap:2px;align-items:center;overflow-x:auto;flex:1;min-width:0;scrollbar-width:none}
.top nav::-webkit-scrollbar{display:none}
.top nav a{text-decoration:none;color:var(--mute);font-size:14px;padding:6px 10px;border-radius:8px;white-space:nowrap}
.sep{flex:none;width:1px;height:18px;background:var(--line);margin:0 6px}
.top nav a:hover{color:var(--text)}
.top nav a[aria-current=page]{color:var(--text);background:var(--panel2)}
.btn{display:inline-flex;align-items:center;gap:8px;text-decoration:none;font-weight:700;border-radius:12px;padding:12px 20px;font-size:15px;border:1px solid transparent;white-space:nowrap}
.btn.primary{background:var(--accent);color:#fff}
.btn.primary:hover{background:var(--accent2)}
.btn.ghost{border-color:rgba(255,122,46,.5);color:#ffd9c2}
.btn.ghost:hover{background:rgba(255,122,46,.1)}
.top .btn{padding:8px 14px;font-size:14px}
.crumbs{font-size:13px;color:var(--mute);padding:20px 0 0}
.crumbs a{text-decoration:none}
.crumbs a:hover{color:var(--accent2)}
.hero{display:grid;grid-template-columns:1fr 1.1fr;gap:40px;align-items:center;padding:28px 0 56px}
.eyebrow{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--accent2);border:1px solid rgba(255,122,46,.35);background:rgba(232,89,12,.1);padding:5px 12px;border-radius:999px;margin-bottom:16px}
h1{font-size:clamp(32px,5vw,52px);line-height:1.08;margin:0 0 16px;font-weight:900;letter-spacing:-.02em}
.lead{font-size:18px;color:#c9ccd4;margin:0 0 24px}
.cta{display:flex;flex-wrap:wrap;gap:12px}
.shot{margin:0;border-radius:16px;overflow:hidden;border:1px solid var(--line);background:var(--panel);box-shadow:0 20px 60px rgba(0,0,0,.5)}
.shot img{display:block;width:100%;height:auto;aspect-ratio:16/10;object-fit:cover;object-position:top center}
.sec{padding:0 0 56px}
h2{font-size:clamp(24px,3.2vw,34px);margin:0 0 8px;font-weight:800;letter-spacing:-.01em}
.sub{color:var(--mute);margin:0 0 28px;max-width:720px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px}
.card{border:1px solid var(--line);background:var(--panel);border-radius:14px;padding:20px}
.card h3{margin:0 0 8px;font-size:17px}
.card p{margin:0;color:#c9ccd4;font-size:15px}
a.card{display:block;text-decoration:none;overflow:hidden;padding:0;transition:.2s}
a.card:hover{border-color:rgba(255,122,46,.7);transform:translateY(-2px)}
a.card img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;object-position:top center;background:var(--panel2)}
a.card div{padding:16px 18px 18px}
.steps{counter-reset:s;list-style:none;margin:0;padding:0;display:grid;gap:12px;max-width:820px}
.steps li{counter-increment:s;position:relative;padding:14px 16px 14px 56px;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
.steps li::before{content:counter(s);position:absolute;left:14px;top:12px;width:28px;height:28px;border-radius:50%;background:rgba(232,89,12,.2);color:var(--accent2);font-weight:800;display:grid;place-items:center;font-size:14px}
.steps strong{display:block}
.note{border:1px solid rgba(245,158,11,.4);background:rgba(245,158,11,.08);border-radius:12px;padding:12px 16px;margin:20px 0 0;font-size:14px;max-width:820px}
.faq details{border:1px solid var(--line);background:var(--panel);border-radius:12px;margin:0 0 10px;max-width:860px}
.faq summary{cursor:pointer;padding:16px 18px;font-weight:600;list-style:none}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:'+';float:right;color:var(--accent2);font-weight:800}
.faq details[open] summary::after{content:'–'}
.faq details p{margin:0;padding:0 18px 16px;color:#c9ccd4}
.band{border:1px solid rgba(255,122,46,.35);background:linear-gradient(135deg,rgba(232,89,12,.14),rgba(255,255,255,.02));border-radius:22px;padding:40px;text-align:center;margin:0 0 56px}
.band p{color:#c9ccd4;max-width:600px;margin:8px auto 20px}
.band .cta{justify-content:center}
.foot{border-top:1px solid var(--line);padding:28px 0 40px;font-size:13px;color:var(--mute)}
.foot .w{display:flex;flex-wrap:wrap;gap:12px 20px;justify-content:space-between}
.foot nav{display:flex;flex-wrap:wrap;gap:14px}
.foot a{text-decoration:none}
.foot a:hover{color:var(--accent2)}
@media (max-width:860px){.hero{grid-template-columns:1fr;gap:24px}.top .btn{display:none}}
@media (max-width:480px){.w{padding:0 16px}}
`;

/** The header row shared by every page: logo, a link per feature page, and the studio button. */
export function headerHtml(currentSlug = '') {
  const link = (p) => `<a href="${esc(pageHref(p.slug))}"${p.slug === currentSlug ? ' aria-current="page"' : ''}>${esc(p.nav)}</a>`;
  const links = `${PRODUCT_PAGES.map(link).join('')}<span class="sep" aria-hidden="true"></span>${USE_CASE_PAGES.map(link).join('')}`;
  return `<header class="top"><div class="w">
  <a class="logo" href="${WARMUP_BASE}/">${esc(PRODUCT.replace(/AI$/, ''))}<span>AI</span></a>
  <nav aria-label="${esc(PRODUCT)} features">${links}</nav>
  <a class="btn primary" href="${STUDIO_PATH}">Open studio</a>
</div></header>`;
}

function footerHtml() {
  return `<footer class="foot"><div class="w"><span>${esc(PRODUCT)} · part of SmartVideo</span>
  <nav aria-label="More"><a href="${WARMUP_BASE}/">All features</a><a href="${STUDIO_PATH}">Studio</a><a href="/studios/smartwarmupai/">Studio guide</a><a href="/smartwarmupai-help/">Help</a></nav></div></footer>`;
}

const img = (src, alt, eager) =>
  `<img src="${esc(src)}" alt="${esc(alt)}" width="1440" height="900"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">`;

/** Full HTML (the <body> content) for one feature page. */
export function renderPageHtml(p) {
  const related = (p.group === 'use-case' ? PRODUCT_PAGES : PRODUCT_PAGES.filter((x) => x.slug !== p.slug)).slice(0, 4);
  return `${headerHtml(p.slug)}
<main>
<div class="w">
  <div class="crumbs"><a href="${WARMUP_BASE}/">${esc(PRODUCT)}</a> › ${esc(p.nav)}</div>
  <section class="hero">
    <div><span class="eyebrow">${esc(p.nav)}</span><h1>${esc(p.h1)}</h1><p class="lead">${esc(p.lead)}</p>
      <div class="cta"><a class="btn primary" href="${esc(p.studio)}">${esc(p.studioLabel)}</a><a class="btn ghost" href="${WARMUP_BASE}/">All features</a></div></div>
    <figure class="shot">${img(p.shot, `${p.nav} in ${PRODUCT}`, true)}</figure>
  </section>
  <section class="sec"><h2>What you get</h2><p class="sub">${esc(p.description)}</p>
    <div class="grid">${p.cards.map((c) => `<div class="card"><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p></div>`).join('')}</div>
    ${p.note ? `<p class="note">${esc(p.note)}</p>` : ''}</section>
  <section class="sec"><h2>How it works</h2><p class="sub">The same steps you follow in the studio.</p>
    <ol class="steps">${p.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></section>
  <section class="sec faq"><h2>Questions</h2><p class="sub"></p>${p.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</section>
  <section class="sec"><h2>More features</h2><p class="sub"></p>
    <div class="grid">${related.map((r) => `<a class="card" href="${esc(pageHref(r.slug))}">${img(r.shot, `${r.nav} in ${PRODUCT}`)}<div><h3>${esc(r.nav)}</h3><p>${esc(r.title)}</p></div></a>`).join('')}</div></section>
  <section class="band"><h2>Try ${esc(p.nav)} in the studio</h2><p>Open ${esc(PRODUCT)} and explore it on a sample workspace.</p>
    <div class="cta"><a class="btn primary" href="${esc(p.studio)}">${esc(p.studioLabel)}</a></div></section>
</div>
</main>
${footerHtml()}`;
}

/** Full HTML (the <body> content) for the hub page. */
export function renderHubHtml() {
  return `${headerHtml('')}
<main>
<div class="w">
  <section class="hero">
    <div><span class="eyebrow">${esc(PRODUCT)}</span><h1>${esc(HUB.h1)}</h1><p class="lead">${esc(HUB.lead)}</p>
      <div class="cta"><a class="btn primary" href="${STUDIO_PATH}">Open studio</a><a class="btn ghost" href="${pageHref('warmup')}">See how warmup works</a></div></div>
    <figure class="shot">${img(HUB.shot, `${PRODUCT} workspace`, true)}</figure>
  </section>
  <section class="sec"><h2>How it works</h2><p class="sub">Four steps from a new mailbox to a campaign that lands.</p>
    <ol class="steps">${HUB.steps.map((s) => `<li><strong><a href="${esc(pageHref(s.slug))}">${esc(s.title)}</a></strong>${esc(s.text)}</li>`).join('')}</ol></section>
  <section class="sec"><h2>Everything in one workspace</h2><p class="sub">Each feature has its own page, with screenshots from the studio.</p>
    <div class="grid">${PRODUCT_PAGES.map((p) => `<a class="card" href="${esc(pageHref(p.slug))}">${img(p.shot, `${p.nav} in ${PRODUCT}`)}<div><h3>${esc(p.nav)}</h3><p>${esc(p.title)}</p></div></a>`).join('')}</div>
    <p class="note">${esc(HUB.demoNote)}</p></section>
  <section class="sec"><h2>Built for your team</h2><p class="sub">See how different teams use it.</p>
    <div class="grid">${USE_CASE_PAGES.map((p) => `<a class="card" href="${esc(pageHref(p.slug))}">${img(p.shot, `${p.nav} use case`)}<div><h3>${esc(p.nav)}</h3><p>${esc(p.title)}</p></div></a>`).join('')}</div></section>
  <section class="sec"><h2>Learn</h2><p class="sub">Articles on warmup, deliverability and cold email in the Help site.</p>
    <div class="grid">${LEARN.map((l) => `<a class="card" href="${esc(l.href)}"><div><h3>${esc(l.label)}</h3></div></a>`).join('')}</div></section>
  <section class="band"><h2>Start in the studio</h2><p>Connect a mailbox, start warmup and send your first sequence.</p>
    <div class="cta"><a class="btn primary" href="${STUDIO_PATH}">Open studio</a></div></section>
</div>
</main>
${footerHtml()}`;
}

/** <head> data for a page; `p` is null for the hub. */
export function pageHead(p, origin) {
  const title = p ? `${p.title} | ${PRODUCT}` : `${HUB.title} | ${PRODUCT}`;
  const description = p ? p.description : HUB.description;
  const canonical = `${origin}${p ? pageHref(p.slug) : `${WARMUP_BASE}/`}`;
  const image = `${origin}${p ? p.shot : HUB.shot}`;
  const jsonLd = {
    '@context': 'https://schema.org', '@type': p ? 'WebPage' : 'CollectionPage', name: title, description, url: canonical,
    isPartOf: { '@type': 'WebSite', name: PRODUCT, url: `${origin}${WARMUP_BASE}/` },
  };
  return { title, description, canonical, image, jsonLd };
}

/** A complete standalone HTML document. */
export function renderDocument(p, origin) {
  const h = pageHead(p, origin);
  const meta = (k, v, attr = 'name') => `<meta ${attr}="${k}" content="${esc(v)}">`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(h.title)}</title>
${meta('description', h.description)}
<link rel="canonical" href="${esc(h.canonical)}">
<link rel="icon" href="/favicon.webp">
${meta('og:title', h.title, 'property')}${meta('og:description', h.description, 'property')}${meta('og:url', h.canonical, 'property')}${meta('og:image', h.image, 'property')}${meta('og:type', 'website', 'property')}
${meta('twitter:card', 'summary_large_image')}${meta('twitter:title', h.title)}${meta('twitter:description', h.description)}${meta('twitter:image', h.image)}
<script type="application/ld+json">${JSON.stringify(h.jsonLd).replace(/</g, '\\u003c')}</script>
<style>${WARMUP_CSS}</style>
</head>
<body>
${p ? renderPageHtml(p) : renderHubHtml()}
</body>
</html>
`;
}
