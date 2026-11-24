// HTML for the public studio guide pages: /studios (hub) and /studios/<slug>.
// Pure string functions (no DOM) so the build-time prerender
// (scripts/build-studio-guides.mjs) writes exactly what the browser renders.

import { SITE_NAME, GUIDE_CATEGORIES } from '../../data/studioGuides.core.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Slugs and routes are URL-safe by construction (see studioGuides.test.js); escaped anyway.
const guideHref = (slug) => esc(`/studios/${encodeURIComponent(slug)}/`);
const studioHref = (route) => esc(`/${route}`);

export const GUIDE_CSS = `
.sg{--bg:#050505;--panel:#0a0a0a;--panel2:#141414;--line:rgba(255,255,255,.09);--text:#e7e9ee;--mute:#9aa1ae;--accent:#d9ff00;--accent2:#c4e600;
  background:var(--bg);color:var(--text);min-height:100vh;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased}
.sg *{box-sizing:border-box}
.sg a{color:inherit}
.sg-wrap{max-width:1180px;margin:0 auto;padding:0 20px}
.sg-top{position:sticky;top:0;z-index:20;background:rgba(5,5,5,.9);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.sg-top .sg-wrap{display:flex;align-items:center;gap:16px;height:60px}
.sg-logo{font-weight:800;text-decoration:none;letter-spacing:-.01em;white-space:nowrap}
.sg-logo span{color:var(--accent)}
.sg-top nav{margin-left:auto;display:flex;gap:6px;align-items:center}
.sg-top nav a{text-decoration:none;color:var(--mute);font-size:14px;padding:6px 10px;border-radius:8px;white-space:nowrap}
.sg-top nav a:hover{color:var(--text)}
.sg-btn{display:inline-flex;align-items:center;gap:8px;text-decoration:none;font-weight:700;border-radius:12px;padding:12px 20px;font-size:15px;border:1px solid transparent;transition:.2s}
.sg-btn.primary{background:var(--accent);color:#000 !important}
.sg-btn.primary:hover{background:var(--accent2);box-shadow:0 0 20px rgba(196,230,0,.4)}
.sg-btn.ghost{border-color:rgba(217,255,0,.45);color:#f4ffcc !important}
.sg-btn.ghost:hover{background:rgba(217,255,0,.1)}
.sg-top .sg-btn{padding:8px 14px;font-size:14px}
.sg-crumbs{font-size:13px;color:var(--mute);padding:20px 0 0}
.sg-crumbs a{text-decoration:none;color:var(--mute)}
.sg-crumbs a:hover{color:var(--accent)}
.sg-hero{display:grid;grid-template-columns:1.05fr 1fr;gap:40px;align-items:center;padding:28px 0 48px}
.sg-eyebrow{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--accent2);border:1px solid rgba(217,255,0,.3);background:rgba(217,255,0,.08);padding:5px 12px;border-radius:999px;margin-bottom:16px}
.sg h1{font-size:clamp(32px,5vw,54px);line-height:1.08;margin:0 0 16px;font-weight:900;letter-spacing:-.02em}
.sg h1 em{font-style:normal;color:var(--accent)}
.sg-tag{font-size:20px;font-weight:600;color:var(--text);margin:0 0 12px}
.sg-lead{font-size:18px;color:#c7cbd3;margin:0 0 14px}
.sg-best{font-size:15px;color:var(--mute);margin:0 0 24px}
.sg-cta{display:flex;flex-wrap:wrap;gap:12px}
.sg-shot{border-radius:16px;overflow:hidden;border:1px solid var(--line);background:var(--panel);box-shadow:0 20px 60px rgba(0,0,0,.5)}
.sg-shot img{display:block;width:100%;height:auto;aspect-ratio:16/10;object-fit:cover;object-position:top center}
.sg-toc{border:1px solid var(--line);background:var(--panel);border-radius:14px;padding:16px 20px;margin:0 0 48px}
.sg-toc strong{display:block;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:var(--mute);margin-bottom:8px}
.sg-toc ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px}
.sg-toc a{display:inline-block;text-decoration:none;font-size:14px;padding:5px 12px;border-radius:999px;background:var(--panel2);border:1px solid var(--line)}
.sg-toc a:hover{border-color:var(--accent);color:var(--accent)}
.sg-sec{padding:0 0 56px;scroll-margin-top:80px}
.sg h2{font-size:clamp(24px,3.2vw,34px);margin:0 0 8px;font-weight:800;letter-spacing:-.01em}
.sg-sub{color:var(--mute);margin:0 0 28px;max-width:760px}
.sg h3{font-size:20px;margin:0 0 10px;font-weight:700}
.sg-tour{position:relative;max-width:960px}
.sg-tour video{display:block;width:100%;max-width:960px;aspect-ratio:16/10;border-radius:16px;border:1px solid var(--line);background:#000;box-shadow:0 20px 60px rgba(0,0,0,.5)}
.sg-play{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:96px;height:96px;border-radius:50%;border:0;background:var(--accent);cursor:pointer;display:grid;place-items:center;box-shadow:0 12px 44px rgba(0,0,0,.65),0 0 0 8px rgba(217,255,0,.18);transition:transform .2s,box-shadow .2s}
.sg-play::before{content:"";width:0;height:0;border-style:solid;border-width:17px 0 17px 28px;border-color:transparent transparent transparent #0a0a0c;margin-left:7px}
.sg-play:hover,.sg-play:focus-visible{transform:translate(-50%,-50%) scale(1.07);box-shadow:0 12px 44px rgba(0,0,0,.65),0 0 0 10px rgba(217,255,0,.3)}
.sg-play[hidden]{display:none}
.sg-tour-len{position:absolute;left:16px;top:16px;padding:6px 12px;border-radius:999px;background:rgba(10,10,12,.82);border:1px solid rgba(217,255,0,.45);color:#f4ffcc;font-size:13px;font-weight:700;letter-spacing:.04em;pointer-events:none}
.sg-play[hidden]~.sg-tour-len{display:none}
.sg-overview p{color:#c7cbd3;max-width:860px}
.sg-chips{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 0;padding:0;list-style:none}
.sg-chips li{font-size:13px;padding:6px 12px;border-radius:10px;background:var(--panel2);border:1px solid var(--line);color:#d4d7de}
.sg-feature{display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:start;padding:28px;border:1px solid var(--line);background:var(--panel);border-radius:18px;margin:0 0 20px;scroll-margin-top:80px}
.sg-feature:nth-child(even) .sg-shot{order:2}
.sg-feature .sg-num{font-size:12px;font-weight:800;color:var(--accent);letter-spacing:.12em}
.sg-def{color:#d4d7de;margin:0 0 16px}
.sg-dl{margin:0;display:grid;gap:12px}
.sg-dl div{border-left:2px solid var(--line);padding-left:12px}
.sg-dl dt{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--mute)}
.sg-dl dd{margin:2px 0 0;font-size:15px;color:#d4d7de}
.sg-dl .why{border-color:var(--accent2)}
.sg-dl .need{border-color:var(--accent)}
.sg-dl .limit{border-color:#f59e0b}
.sg-cap{font-size:12px;color:var(--mute);padding:8px 12px;border-top:1px solid var(--line)}
.sg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
.sg-card{border:1px solid var(--line);background:var(--panel);border-radius:14px;padding:20px}
.sg-card p{margin:0;color:#c7cbd3;font-size:15px}
.sg-card .meta{font-size:13px;color:var(--mute);margin-top:8px}
.sg-steps{counter-reset:s;list-style:none;margin:0;padding:0;display:grid;gap:12px;max-width:860px}
.sg-steps li{counter-increment:s;position:relative;padding:14px 16px 14px 56px;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
.sg-steps li::before{content:counter(s);position:absolute;left:14px;top:12px;width:28px;height:28px;border-radius:50%;background:rgba(217,255,0,.15);color:var(--accent);font-weight:800;display:grid;place-items:center;font-size:14px}
.sg-small{list-style:decimal;margin:8px 0 0 18px;padding:0;color:#c7cbd3;font-size:14px}
.sg-ul{margin:0;padding:0 0 0 20px;color:#c7cbd3;display:grid;gap:6px;max-width:860px}
.sg-table{width:100%;border-collapse:collapse;font-size:14px;border:1px solid var(--line);border-radius:12px;overflow:hidden}
.sg-table th,.sg-table td{text-align:left;padding:12px 14px;border-bottom:1px solid var(--line);vertical-align:top}
.sg-table th{background:var(--panel2);font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute)}
.sg-table td{color:#d4d7de}
.sg-req{font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:rgba(217,255,0,.15);color:var(--accent);white-space:nowrap}
.sg-opt{font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--panel2);color:var(--mute);white-space:nowrap}
.sg-scroll{overflow-x:auto}
.sg-gloss{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;margin:0}
.sg-gloss div{border:1px solid var(--line);background:var(--panel);border-radius:12px;padding:14px 16px}
.sg-gloss dt{font-weight:700;color:var(--text)}
.sg-gloss dd{margin:4px 0 0;color:#c7cbd3;font-size:14px}
.sg-faq details{border:1px solid var(--line);background:var(--panel);border-radius:12px;margin:0 0 10px;max-width:900px}
.sg-faq summary{cursor:pointer;padding:16px 18px;font-weight:600;list-style:none}
.sg-faq summary::-webkit-details-marker{display:none}
.sg-faq summary::after{content:'+';float:right;color:var(--accent);font-weight:800}
.sg-faq details[open] summary::after{content:'–'}
.sg-faq details p{margin:0;padding:0 18px 16px;color:#c7cbd3}
.sg-rel{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}
.sg-tile{display:block;text-decoration:none;border:1px solid var(--line);background:var(--panel);border-radius:14px;overflow:hidden;transition:.2s}
.sg-tile:hover{border-color:rgba(217,255,0,.6);transform:translateY(-2px)}
.sg-tile img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;object-position:top center;background:var(--panel2)}
.sg-tile div{padding:14px 16px}
.sg-tile strong{display:block;margin-bottom:4px}
.sg-tile p{margin:0;font-size:14px;color:var(--mute)}
.sg-tile .count{display:inline-block;margin-top:10px;font-size:12px;color:var(--accent);font-weight:700}
.sg-band{border:1px solid rgba(217,255,0,.3);background:linear-gradient(135deg,rgba(217,255,0,.08),rgba(217,255,0,.06),rgba(255,255,255,.02));border-radius:22px;padding:40px;text-align:center;margin:0 0 56px}
.sg-band p{color:#c7cbd3;max-width:640px;margin:8px auto 20px}
.sg-band .sg-cta{justify-content:center}
.sg-foot{border-top:1px solid var(--line);padding:28px 0 40px;font-size:13px;color:var(--mute)}
.sg-foot .sg-wrap{display:flex;flex-wrap:wrap;gap:12px 20px;justify-content:space-between}
.sg-foot nav{display:flex;flex-wrap:wrap;gap:14px}
.sg-foot a{text-decoration:none;color:var(--mute)}
.sg-foot a:hover{color:var(--accent)}
.sg-cat{margin:0 0 48px;scroll-margin-top:80px}
.sg-note{border:1px solid rgba(245,158,11,.4);background:rgba(245,158,11,.08);border-radius:12px;padding:12px 16px;margin:20px 0 0;font-size:14px}
@media (max-width:860px){
  .sg-hero,.sg-feature{grid-template-columns:1fr;gap:20px}
  .sg-feature{padding:18px}
  .sg-feature:nth-child(even) .sg-shot{order:0}
  .sg-top nav a.hide-sm{display:none}
  .sg-band{padding:28px 18px}
}
@media (max-width:480px){.sg-wrap{padding:0 16px}.sg-top nav a:not(.sg-btn){display:none}}
`;

function topBar() {
  return `<header class="sg-top"><div class="sg-wrap">
  <a class="sg-logo" href="/">Smart Video <span>AI Studio</span></a>
  <nav aria-label="Main">
    <a href="/studios/" class="hide-sm">All studio guides</a>
    <a href="/apps" class="hide-sm">Open the app</a>
    <a href="/signup" class="sg-btn primary">Get started</a>
  </nav></div></header>`;
}

function footer(guides) {
  const cats = GUIDE_CATEGORIES.map((c) => `<a href="/studios/#${esc(slugCat(c.id))}">${esc(c.title)}</a>`).join('');
  return `<footer class="sg-foot"><div class="sg-wrap">
  <span>© ${new Date().getFullYear()} ${esc(SITE_NAME)} · ${guides} studio guides</span>
  <nav aria-label="Guides">${cats}<a href="/">Home</a></nav></div></footer>`;
}

const slugCat = (id) => 'cat-' + id.toLowerCase().replace(/[^a-z0-9]+/g, '-');

function img(src, alt, eager = false) {
  return `<img src="${esc(src)}" alt="${esc(alt)}" width="1440" height="900" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}

function section(id, title, sub, body) {
  return `<section class="sg-sec" id="${id}" aria-labelledby="${id}-h"><h2 id="${id}-h">${esc(title)}</h2>${sub ? `<p class="sg-sub">${esc(sub)}</p>` : ''}${body}</section>`;
}

function featureCard(g, f, i) {
  const rows = [
    f.whyToUse && `<div class="why"><dt>Why use it</dt><dd>${esc(f.whyToUse)}</dd></div>`,
    f.inputRequired && `<div class="need"><dt>What you need</dt><dd>${esc(f.inputRequired)}</dd></div>`,
    f.restrictions && `<div class="limit"><dt>Limits and rules</dt><dd>${esc(f.restrictions)}</dd></div>`,
  ].filter(Boolean).join('');
  return `<article class="sg-feature" id="feature-${esc(f.id)}">
  <figure class="sg-shot" style="margin:0"><a href="${esc(f.screenshot)}" target="_blank" rel="noopener" title="Open full-size screenshot">${img(f.screenshot, `${f.name} in ${g.name}`)}</a><figcaption class="sg-cap">${esc(f.name)}${f.hasOwnScreenshot ? '' : ` · ${esc(g.name)}`}</figcaption></figure>
  <div><div class="sg-num">FEATURE ${String(i + 1).padStart(2, '0')}</div><h3>${esc(f.name)}</h3>
  <p class="sg-def"><strong>What it is:</strong> ${esc(f.definition)}</p><dl class="sg-dl">${rows}</dl></div></article>`;
}

/**
 * Make the tour video's play button work. The events are bound here, not as inline attributes, because the dev server's
 * content security policy blocks inline handlers. Call it after the guide HTML is in the page. Safe to call twice.
 */
export function wireTourVideo(root = document) {
  root.querySelectorAll('.sg-tour').forEach((box) => {
    const video = box.querySelector('video');
    const play = box.querySelector('.sg-play');
    if (!video || !play || box.dataset.wired) return;
    box.dataset.wired = '1';
    // If playback cannot start (for example the file failed to load), uncover the player so its own controls and
    // error message are visible and the viewer can retry, instead of leaving the big button over a dead video.
    play.addEventListener('click', () => {
      video.play().catch((err) => { play.hidden = true; console.warn('[guide] tour video could not start:', err && err.message); });
    });
    video.addEventListener('play', () => { play.hidden = true; });
    video.addEventListener('ended', () => { play.hidden = false; });
  });
}

/** Full HTML (inside #app) for one studio guide. */
export function renderGuideHtml(g, allCount) {
  const toc = [];
  const parts = [];
  const add = (id, label, html) => { if (html) { toc.push([id, label]); parts.push(html); } };

  const mm = g.tour ? `${Math.floor(g.tour.seconds / 60)}:${String(g.tour.seconds % 60).padStart(2, '0')}` : '';
  add('tour', 'Video tour', g.tour && section('tour', `Watch the ${g.name} tour`, `A ${mm} captioned walkthrough of the studio, with a sample file and prompt.`,
    // The poster is the guide's own overview screenshot (a /guides/<slug>/ file); a guide without one has a generic fallback
    // thumbnail elsewhere, so use the tour's own frame instead.
    `<div class="sg-tour"><video controls preload="none" playsinline poster="${esc(/^\/guides\//.test(g.overview || '') ? g.overview : g.tour.poster)}" src="${esc(g.tour.video)}" aria-label="${esc(g.name)} tour video"></video><button type="button" class="sg-play" aria-label="Play the ${esc(g.name)} tour video, ${mm}"></button><span class="sg-tour-len">VIDEO · ${mm}</span></div>`));

  add('overview', 'Overview', section('overview', `What is ${g.name}?`, '', `<div class="sg-overview">
    <p>${esc(g.fullDescription || g.description)}</p>
    ${g.whenToUse.length ? `<h3 style="margin-top:24px">When to use it</h3><ul class="sg-ul">${g.whenToUse.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${g.keyFeatures.length ? `<ul class="sg-chips" aria-label="Key features">${g.keyFeatures.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>` : ''}</div>`));

  add('features', `Features (${g.features.length})`, g.features.length && section('features', `Every ${g.name} feature, explained`,
    `${g.features.length} features, each with a definition, why you would use it, what it needs and its limits.`,
    g.features.map((f, i) => featureCard(g, f, i)).join('')));

  add('how-it-works', 'How it works', g.steps.length && section('how-it-works', `How to use ${g.name}`, g.howToUse ? '' : '',
    `<ol class="sg-steps">${g.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`));

  add('modes', 'Modes', g.modes.length && section('modes', 'Generation modes', 'The ways this studio can work, and when to pick each one.',
    `<div class="sg-grid">${g.modes.map((m) => `<div class="sg-card"><h3>${esc(m.mode)}</h3><p>${esc(m.description)}</p>${m.useCase ? `<div class="meta">Best for: ${esc(m.useCase)}</div>` : ''}</div>`).join('')}</div>`));

  add('inputs', 'Inputs & outputs', (g.inputs.length || g.outputs.length) && section('inputs', 'Inputs and outputs', 'What you give the studio, and what you get back.',
    `${g.inputs.length ? `<div class="sg-scroll"><table class="sg-table"><thead><tr><th>Input</th><th>Description</th><th>When to use</th><th>Rules</th></tr></thead><tbody>${g.inputs.map((x) => `<tr><td><strong>${esc(x.name)}</strong><br>${x.required ? '<span class="sg-req">Required</span>' : '<span class="sg-opt">Optional</span>'}</td><td>${esc(x.description)}</td><td>${esc(x.whenToUse)}</td><td>${esc(x.restrictions)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${g.outputs.length ? `<h3 style="margin-top:28px">What you get</h3><ul class="sg-ul">${g.outputs.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}`));

  add('use-cases', 'Use cases', (g.useCases.length || g.workflows.length) && section('use-cases', 'Use cases and example workflows', 'Real jobs you can do, step by step.',
    `<div class="sg-grid">${g.useCases.map((u) => `<div class="sg-card"><h3>${esc(u.title)}</h3>${u.description ? `<p>${esc(u.description)}</p>` : ''}${arr(u.steps).length ? `<ol class="sg-small">${u.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}${u.expectedOutput ? `<div class="meta">Result: ${esc(u.expectedOutput)}</div>` : ''}</div>`).join('')}
    ${g.workflows.map((w) => `<div class="sg-card"><h3>${esc(w.title)}</h3>${arr(w.steps).length ? `<ol class="sg-small">${w.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}</div>`).join('')}</div>`));

  add('tips', 'Tips', g.tips.length && section('tips', 'Tips and best practices', '', `<ul class="sg-ul">${g.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`));

  add('limitations', 'Limitations', (g.limitations.length || g.problems.length) && section('limitations', 'Limitations and troubleshooting', 'Know the limits before you start, and how to fix common problems.',
    `${g.limitations.length ? `<div class="sg-scroll"><table class="sg-table"><thead><tr><th>Limitation</th><th>What it means</th><th>Workaround</th></tr></thead><tbody>${g.limitations.map((l) => `<tr><td><strong>${esc(l.limitation)}</strong></td><td>${esc(l.impact)}</td><td>${esc(l.workaround)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${g.problems.length ? `<div class="sg-grid" style="margin-top:20px">${g.problems.map((p) => `<div class="sg-card"><h3>${esc(p.problem)}</h3>${p.whyItHappens ? `<p><strong>Why:</strong> ${esc(p.whyItHappens)}</p>` : ''}${p.howToFix ? `<div class="meta"><strong>Fix:</strong> ${esc(p.howToFix)}</div>` : ''}</div>`).join('')}</div>` : ''}`));

  add('glossary', 'Glossary', g.glossary.length && section('glossary', 'Glossary', `Terms used in ${g.name}.`,
    `<dl class="sg-gloss">${g.glossary.map((x) => `<div><dt>${esc(x.term)}</dt><dd>${esc(x.definition)}</dd></div>`).join('')}</dl>`));

  add('faq', 'FAQ', g.faqs.length && section('faq', 'Frequently asked questions', '',
    `<div class="sg-faq">${g.faqs.map((q) => `<details><summary>${esc(q.question)}</summary><p>${esc(q.answer)}</p></details>`).join('')}</div>`));

  add('related', 'Related studios', g.related.length && section('related', 'Related studios', 'Studios that work well alongside this one.',
    `<div class="sg-rel">${g.related.map((r) => `<a class="sg-tile" href="${guideHref(r.slug)}">${img(r.thumbnail, r.name)}<div><strong>${esc(r.name)}</strong><p>${esc(r.why || r.shortDescription)}</p></div></a>`).join('')}</div>`));

  return `<div class="sg" data-guide="${esc(g.slug)}">${topBar()}<main class="sg-wrap">
  <nav class="sg-crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/studios/">Studio guides</a> / <span aria-current="page">${esc(g.name)}</span></nav>
  <section class="sg-hero"><div>
    <span class="sg-eyebrow">${esc(categoryTitle(g.category))} · Feature guide</span>
    <h1>${esc(g.name)} <em>Feature Guide</em></h1>
    ${g.shortDescription ? `<p class="sg-tag">${esc(g.shortDescription)}</p>` : ''}
    <p class="sg-lead">${esc(g.description)}</p>
    ${g.bestFor ? `<p class="sg-best"><strong>Best for:</strong> ${esc(g.bestFor)}</p>` : ''}
    <div class="sg-cta"><a class="sg-btn primary" href="${studioHref(g.route)}">Open ${esc(g.name)} →</a>${g.tour ? `<a class="sg-btn ghost" href="#tour"><span aria-hidden="true">▶</span> Watch the tour · ${Math.floor(g.tour.seconds / 60)}:${String(g.tour.seconds % 60).padStart(2, '0')}</a>` : ''}<a class="sg-btn ghost" href="#features">See all ${g.features.length} features</a></div>
  </div><figure class="sg-shot" style="margin:0">${img(g.overview, `${g.name} screenshot`, true)}</figure></section>
  <nav class="sg-toc" aria-label="On this page"><strong>On this page</strong><ul>${toc.map(([id, l]) => `<li><a href="#${id}">${esc(l)}</a></li>`).join('')}</ul></nav>
  ${parts.join('')}
  <div class="sg-band"><h2>Try ${esc(g.name)} now</h2><p>Open the studio and put these features to work, or browse the guides for all ${allCount} studios.</p>
  <div class="sg-cta"><a class="sg-btn primary" href="${studioHref(g.route)}">Open ${esc(g.name)}</a><a class="sg-btn ghost" href="/studios/">All studio guides</a></div></div>
  </main>${footer(allCount)}</div>`;
}

const arr = (v) => (Array.isArray(v) ? v : []);
const categoryTitle = (id) => GUIDE_CATEGORIES.find((c) => c.id === id)?.title || id;

/** Full HTML (inside #app) for the /studios hub. */
export function renderHubHtml(groups, total, notFound = '') {
  const featureTotal = groups.reduce((n, c) => n + c.guides.reduce((m, g) => m + g.features.length, 0), 0);
  return `<div class="sg" data-guide="hub">${topBar()}<main class="sg-wrap">
  <nav class="sg-crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <span aria-current="page">Studio guides</span></nav>
  ${notFound ? `<div class="sg-note">We couldn't find a guide called “${esc(notFound)}”. Here are all of them.</div>` : ''}
  <section class="sg-hero" style="grid-template-columns:1fr"><div>
    <span class="sg-eyebrow">Feature guides</span>
    <h1>Every studio in ${esc(SITE_NAME)}, <em>explained</em></h1>
    <p class="sg-lead">${total} studios and ${featureTotal} features. Each guide covers what the studio does, every feature with a definition and screenshot, how to use it, inputs and outputs, limits, a glossary and FAQs.</p>
    <div class="sg-cta"><a class="sg-btn primary" href="/apps">Open the app</a><a class="sg-btn ghost" href="/signup">Get started</a></div>
  </div></section>
  <nav class="sg-toc" aria-label="Categories"><strong>Categories</strong><ul>${groups.map((c) => `<li><a href="#${slugCat(c.id)}">${esc(c.title)} (${c.guides.length})</a></li>`).join('')}</ul></nav>
  ${groups.map((c) => `<section class="sg-cat" id="${slugCat(c.id)}" aria-labelledby="${slugCat(c.id)}-h"><h2 id="${slugCat(c.id)}-h">${esc(c.title)}</h2><p class="sg-sub">${esc(c.blurb)}</p>
    <div class="sg-rel">${c.guides.map((g) => `<a class="sg-tile" href="${guideHref(g.slug)}">${img(g.thumbnail, g.name)}<div><strong>${esc(g.name)}</strong><p>${esc(g.shortDescription)}</p><span class="count">${g.features.length} features →</span></div></a>`).join('')}</div></section>`).join('')}
  </main>${footer(total)}</div>`;
}

/** Head metadata for a guide (or the hub when g is null). */
export function guideHead(g, origin, groups) {
  const o = String(origin || '').replace(/\/$/, '');
  const abs = (p) => (/^https?:/.test(p) ? p : o + p);
  if (!g) {
    const all = groups.flatMap((c) => c.guides);
    const url = `${o}/studios/`;
    return {
      title: `All Studio Feature Guides | ${SITE_NAME}`,
      description: `Guides to all ${all.length} studios in ${SITE_NAME}: every feature defined and shown, how to use it, inputs, outputs, limits and FAQs.`,
      keywords: 'ai video studio guide, ai image studio features, smart video ai studio features, ai video tools guide',
      canonical: url,
      image: abs('/thumbnails/heroes/video.webp'),
      jsonLd: [
        {
 '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Studio Feature Guides', url,
          mainEntity: { '@type': 'ItemList', itemListElement: all.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name, url: `${o}/studios/${x.slug}/` })) } 
},
        {
 '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${o}/` },
          { '@type': 'ListItem', position: 2, name: 'Studio guides', item: url }] 
},
      ],
    };
  }
  const url = `${o}/studios/${g.slug}/`;
  const jsonLd = [
    {
 '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: g.name, applicationCategory: 'MultimediaApplication', operatingSystem: 'Web',
      description: g.description, url, image: abs(g.overview), featureList: g.features.map((f) => f.name).join(', '),
      isPartOf: { '@type': 'SoftwareApplication', name: SITE_NAME, url: `${o}/` } 
},
    {
 '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${o}/` },
      { '@type': 'ListItem', position: 2, name: 'Studio guides', item: `${o}/studios/` },
      { '@type': 'ListItem', position: 3, name: g.name, item: url }] 
},
  ];
  if (g.steps.length) jsonLd.push({ '@context': 'https://schema.org', '@type': 'HowTo', name: `How to use ${g.name}`, step: g.steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, text: s })) });
  if (g.faqs.length) jsonLd.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: g.faqs.map((q) => ({ '@type': 'Question', name: q.question, acceptedAnswer: { '@type': 'Answer', text: q.answer } })) });
  return { title: g.seo.title, description: g.seo.description, keywords: g.seo.keywords, canonical: url, image: abs(g.overview), jsonLd };
}

/** The <head> tags for guideHead() output, as an HTML string (build time). */
export function headTagsHtml(h) {
  return [
    `<title>${esc(h.title)}</title>`,
    `<meta name="description" content="${esc(h.description)}" />`,
    `<meta name="keywords" content="${esc(h.keywords)}" />`,
    `<link rel="canonical" href="${esc(h.canonical)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(SITE_NAME)}" />`,
    `<meta property="og:title" content="${esc(h.title)}" />`,
    `<meta property="og:description" content="${esc(h.description)}" />`,
    `<meta property="og:url" content="${esc(h.canonical)}" />`,
    `<meta property="og:image" content="${esc(h.image)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(h.title)}" />`,
    `<meta name="twitter:description" content="${esc(h.description)}" />`,
    `<meta name="twitter:image" content="${esc(h.image)}" />`,
    ...h.jsonLd.map((j) => `<script type="application/ld+json" data-guide-ld>${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`),
  ].join('\n    ');
}
