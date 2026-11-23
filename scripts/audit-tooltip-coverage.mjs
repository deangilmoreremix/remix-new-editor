// Tooltip coverage audit. Opens each studio route in the running dev server, collects the visible interactive controls and runs the
// real hover-help resolver (findHelp from components/studio/tooltipLayer.js) on each one. A control is "covered" when it resolves to
// written copy in lib/help/studioHelp.js; "plain" means it only has its own title / data-tooltip text (themed, but no copy);
// "none" means it has no label at all.
//
//   npm run dev:ui-check                                   # terminal 1
//   node scripts/audit-tooltip-coverage.mjs                # terminal 2: the default studio list
//   node scripts/audit-tooltip-coverage.mjs --all          # every route in src/lib/router.js (read from the file, so new routes are included)
//   node scripts/audit-tooltip-coverage.mjs --chrome       # also audit the sidebar + header once (reported as the pseudo-route "chrome")
//   node scripts/audit-tooltip-coverage.mjs --states       # also click each tab / toggle and add the controls it reveals
//   node scripts/audit-tooltip-coverage.mjs --routes image,video --verbose
//   node scripts/audit-tooltip-coverage.mjs --all --chrome --states --check   # exit 1 below the thresholds (95% primary, 85% others)
//   node scripts/audit-tooltip-coverage.mjs --out /tmp/coverage.json
//
// --states only clicks [role=tab] and button[aria-pressed] controls that are not selected yet, never anything whose label looks like it
// runs, deletes, pays or signs out, and at most 12 per route. Everything is merged by control, so a control seen in two states counts once.
//
// Not audited: the Timeline Editor (.cinegen-root has its own help layer) and content items such as example galleries and generated
// results, which are data, not controls. The sidebar/header are audited only with --chrome, because they are the same on every route.

import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:3100';
const PRIMARY = ['image', 'video', 'cinema', 'cinema-template', 'edit', 'upscale', 'character', 'commercial', 'influencer', 'brand', 'effects', 'storyboard'];
const OTHERS = ['lipsync', 'videotools', 'avatar', 'audio', 'animate', 'video-pages', 'viral', 'personalizer', 'leadfinder', 'ai-vfx'];
const THRESHOLD = { primary: 0.95, other: 0.85 };
// Timeline Editor family: its own help layer covers it.
const OWN_HELP = /^(timeline|cinegen)/;
// Landing / marketing pages (call-to-action buttons, model catalogues), not studio features. They are audited and reported as their own
// bucket, but do not fail --check: whether they should get tooltips is a product decision, not something to guess.
const MARKETING = new Set(['text-to-image', 'image-to-image', 'text-to-video', 'image-to-video', 'video-to-video', 'video-watermark', 'effects-page', 'cinema-page',
  'influencer-page', 'commercial-page', 'upscale-page', 'storyboard-page', 'character-page', 'smart-video-scheduler', 'brightbean']);
// Never click these in --states: they run jobs, delete, spend credits or end the session.
const DANGEROUS = /generate|run\b|delete|remove|publish|pay|buy|checkout|upgrade|subscribe|sign ?out|log ?out|submit|send|export|render|clear|reset/i;
const MAX_STATES = 12;

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const verbose = flag('verbose');

// Every key of pageLoaders in the router, so a route added later is audited without touching this script.
function allRoutes() {
  const src = readFileSync(new URL('../src/lib/router.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('const pageLoaders = {'));
  const block = body.slice(0, body.indexOf('\n};'));
  return [...block.matchAll(/^\s*'?([a-z][a-z0-9-]*)'?\s*:/gm)].map((m) => m[1]).filter((r) => !OWN_HELP.test(r));
}

let routes = opt('routes') ? opt('routes').split(',') : flag('all') ? allRoutes() : [...PRIMARY, ...OTHERS];
routes = [...new Set(routes)];

const SELECTOR = 'button, select, input:not([type=hidden]), textarea, [role=button], [role=tab], [title], [data-tooltip], [data-help]';

// Runs in the page. scope 'studio' = everything except the sidebar/header; scope 'chrome' = only the sidebar/header.
// The page imports the real resolver from the dev server, so the audit can't drift from the layer.
async function collect(page, scope) {
  return page.evaluate(async ({ selector, scope }) => {
    const { findHelp } = await import('/src/components/studio/tooltipLayer.js');
    const CHROME = 'aside, header, nav';
    // Content, not controls: example galleries and their filter chips, option chips (expressions), generated results.
    const content = '.cinegen-root, .eg-section, .expr-btn, #viral-media-filter, .viral-rail, .smart-card, #viral-grid, [class*="media-btn"], .sv-demo-rail, .mmx-card, [class*="gallery"], [class*="example-"], [data-example], [data-searchable]:not([data-studio])';
    const records = [];
    const seen = new Set();
    const visible = [...document.querySelectorAll(selector)].filter((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width < 6 || r.height < 6 || cs.visibility === 'hidden' || cs.display === 'none') return false;
      if (el.tagName === 'IFRAME') return false; // the layer cannot see pointer events inside an embedded app
      if (el.closest(content)) return false;
      return scope === 'chrome' ? !!el.closest(CHROME) : !el.closest(CHROME);
    });
    // A row of 6+ sibling buttons with no ids is an option list or card grid (model picker, effect cards, scene chips). Audit it once,
    // as a group: hovering any option should show the list's copy, which a data-help on the list container provides.
    const siblings = new Map();
    visible.forEach((el) => { if (el.tagName === 'BUTTON' && !el.id) siblings.set(el.parentElement, (siblings.get(el.parentElement) || 0) + 1); });
    const groupDone = new Set();
    const labelOf = (el) => (el.dataset.help || (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60)
      || el.getAttribute('aria-label') || el.getAttribute('title') || el.dataset.tooltip || el.getAttribute('placeholder') || '').trim()
      || (el.closest('[data-sidebar-item]') ? `[sidebar ${el.closest('[data-sidebar-item]').dataset.sidebarItem}]` : '')
      || `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`;
    // Written copy always carries a summary; the plain title / data-tooltip fallback is just { name }.
    // findHelp walks up to 6 ancestors, and a hit on an ancestor still means hovering this control shows help.
    const statusOf = (el) => { const hit = findHelp(el); return hit ? (hit.entry.summary ? 'covered' : 'plain') : 'none'; };
    visible.forEach((el) => {
      const group = el.tagName === 'BUTTON' && !el.id && siblings.get(el.parentElement) >= 6;
      let target = el;
      let status;
      let name;
      if (group) {
        if (groupDone.has(el.parentElement)) return;
        groupDone.add(el.parentElement);
        // The group is covered only if EVERY option is; otherwise report the first one that is not.
        const members = visible.filter((m) => m.parentElement === el.parentElement && m.tagName === 'BUTTON' && !m.id);
        const bad = members.filter((m) => statusOf(m) !== 'covered');
        target = bad[0] || el;
        status = bad.length ? statusOf(target) : 'covered';
        name = `[${members.length} options${bad.length ? `, ${bad.length} uncovered` : ''}] ${labelOf(target)}`;
      } else {
        name = labelOf(el);
        status = statusOf(el);
      }
      const dedupe = `${target.tagName}|${name}`;
      if (seen.has(dedupe)) return;
      seen.add(dedupe);
      records.push({ label: name, tag: target.tagName.toLowerCase(), id: target.id || '', status });
    });
    return records;
  }, { selector: SELECTOR, scope });
}

// Click the first tab / toggle that is not selected yet and is safe to click. Returns its label, or null when none is left.
async function clickNextState(page, done) {
  return page.evaluate(({ done, danger }) => {
    const re = new RegExp(danger, 'i');
    const candidates = [...document.querySelectorAll('[role=tab], button[aria-pressed]')].filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 6 || r.height < 6 || el.closest('aside, header, nav, .cinegen-root') || el.disabled) return false;
      if (el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-pressed') === 'true') return false;
      const label = (el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');
      return label && !re.test(label) && !done.includes(label);
    });
    const el = candidates[0];
    if (!el) return null;
    const label = (el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');
    el.click();
    return label;
  }, { done, danger: DANGEROUS.source });
}

async function openRoute(page, route) {
  await page.goto('about:blank'); // fresh boot per route, so one studio's leftover state can't leak into the next
  await page.goto(`${BASE}/?dev#/${route}`, { waitUntil: 'domcontentloaded' });
  // Studios lazy-load, so wait until the page has real controls (outside the sidebar/header) instead of sleeping a fixed time.
  await page.waitForFunction(() => [...document.querySelectorAll('button')].filter((b) => !b.closest('aside, header, nav') && b.getBoundingClientRect().width > 6).length >= 3, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
}

async function auditRoute(page, route, scope) {
  await openRoute(page, route);
  const merged = new Map();
  const add = (records) => records.forEach((r) => { const k = `${r.tag}|${r.label}`; if (!merged.has(k) || (merged.get(k).status !== 'covered' && r.status === 'covered')) merged.set(k, r); });
  add(await collect(page, scope));
  let states = 0;
  if (flag('states') && scope === 'studio') {
    const done = [];
    for (let i = 0; i < MAX_STATES; i++) {
      const label = await clickNextState(page, done);
      if (!label) break;
      done.push(label); states++;
      await page.waitForTimeout(350);
      add(await collect(page, scope));
    }
  }
  return { records: [...merged.values()], states };
}

(async () => {
  // AUDIT_CHROMIUM_PATH: use an existing Chromium when the Playwright version here has no matching browser download.
  const browser = await chromium.launch(process.env.AUDIT_CHROMIUM_PATH ? { executablePath: process.env.AUDIT_CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const report = {};
  let failed = false;

  const jobs = routes.map((route) => ({ name: route, route, scope: 'studio' }));
  if (flag('chrome')) jobs.unshift({ name: 'chrome', route: routes[0] || 'image', scope: 'chrome' });

  for (const { name, route, scope } of jobs) {
    let result;
    try { result = await auditRoute(page, route, scope); } catch (e) { report[name] = { error: String(e) }; console.log(`${name.padEnd(22)} ERROR ${String(e).slice(0, 80)}`); failed = true; continue; }
    const { records, states } = result;
    const covered = records.filter((r) => r.status === 'covered').length;
    const ratio = records.length ? covered / records.length : 1;
    const bucket = MARKETING.has(name) ? 'marketing' : 'studio';
    const need = PRIMARY.includes(name) ? THRESHOLD.primary : THRESHOLD.other;
    const gaps = records.filter((r) => r.status !== 'covered');
    report[name] = { bucket, total: records.length, covered, ratio: Number(ratio.toFixed(3)), states, gaps };
    const ok = ratio >= need || bucket === 'marketing';
    if (!ok) failed = true;
    console.log(`${name.padEnd(22)} ${String(covered).padStart(3)}/${String(records.length).padEnd(3)} ${(ratio * 100).toFixed(0).padStart(3)}%  ${ratio >= need ? 'ok' : bucket === 'marketing' ? 'marketing page (not gated)' : `below ${need * 100}%`}${states ? `  (+${states} states)` : ''}${records.length === 0 ? '  NO CONTROLS FOUND' : ''}`);
    if (verbose || !ok) gaps.forEach((g) => console.log(`    ${g.status.padEnd(5)} ${g.tag.padEnd(8)} ${g.id ? `#${g.id} ` : ''}${g.label}`));
  }

  if (opt('out')) writeFileSync(opt('out'), JSON.stringify(report, null, 2));
  await browser.close();
  if (flag('check') && failed) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
