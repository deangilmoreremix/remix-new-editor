// Tooltip coverage audit. Opens each studio route in the running dev server, collects the visible interactive controls and runs the
// real hover-help resolver (findHelp from components/studio/tooltipLayer.js) on each one. A control is "covered" when it resolves to
// written copy in lib/help/studioHelp.js; "plain" means it only has its own title / data-tooltip text (themed, but no copy);
// "none" means it has no label at all.
//
//   npm run dev:ui-check                              # terminal 1
//   node scripts/audit-tooltip-coverage.mjs           # terminal 2: all default routes
//   node scripts/audit-tooltip-coverage.mjs --routes image,video --verbose
//   node scripts/audit-tooltip-coverage.mjs --check   # exit 1 below the thresholds (95% primary studios, 85% others)
//   node scripts/audit-tooltip-coverage.mjs --out /tmp/coverage.json
//
// Not audited: the sidebar/header chrome (it is the same on every route), the Timeline Editor (.cinegen-root has its own help layer),
// and content items such as example galleries and generated results, which are data, not controls.

import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const BASE = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:3100';
const PRIMARY = ['image', 'video', 'cinema', 'cinema-template', 'edit', 'upscale', 'character', 'commercial', 'influencer', 'brand', 'effects', 'storyboard'];
const OTHERS = ['lipsync', 'videotools', 'avatar', 'audio', 'animate', 'video-pages', 'viral', 'personalizer', 'leadfinder', 'ai-vfx'];
const THRESHOLD = { primary: 0.95, other: 0.85 };

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const routes = opt('routes') ? opt('routes').split(',') : [...PRIMARY, ...OTHERS];
const verbose = flag('verbose');

const SELECTOR = 'button, select, input:not([type=hidden]), textarea, [role=button], [role=tab], [title], [data-tooltip], [data-help]';

// One record per visible control. The page code imports the real resolver from the dev server, so the audit can't drift from the layer.
async function auditRoute(page, route) {
  await page.goto('about:blank'); // fresh boot per route, so one studio's leftover state can't leak into the next
  await page.goto(`${BASE}/?dev#/${route}`, { waitUntil: 'domcontentloaded' });
  // Studios lazy-load, so wait until the page has real controls (outside the sidebar/header) instead of sleeping a fixed time.
  await page.waitForFunction(() => [...document.querySelectorAll('button')].filter((b) => !b.closest('aside, header, nav') && b.getBoundingClientRect().width > 6).length >= 3, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
  return page.evaluate(async ({ selector }) => {
    const { findHelp } = await import('/src/components/studio/tooltipLayer.js');
    // Content, not controls: example galleries and their filter chips, option chips (expressions), generated results.
    const skip = 'aside, header, nav, .cinegen-root, .eg-section, .expr-btn, #viral-media-filter, .viral-rail, .smart-card, #viral-grid, [class*="media-btn"], .sv-demo-rail, .mmx-card, [class*="gallery"], [class*="example-"], [data-example]';
    const records = [];
    const seen = new Set();
    const visible = [...document.querySelectorAll(selector)].filter((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return !(r.width < 6 || r.height < 6 || cs.visibility === 'hidden' || cs.display === 'none') && !el.closest(skip);
    });
    // A row of 6+ sibling buttons with no ids is an option list or card grid (model picker, effect cards, scene chips). Audit it once,
    // as a group: hovering any option should show the list's copy, which a data-help on the list container provides.
    const siblings = new Map();
    visible.forEach((el) => { if (el.tagName === 'BUTTON' && !el.id) siblings.set(el.parentElement, (siblings.get(el.parentElement) || 0) + 1); });
    const groupDone = new Set();
    const labelOf = (el) => (el.dataset.help || (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60)
      || el.getAttribute('aria-label') || el.getAttribute('title') || el.dataset.tooltip || el.getAttribute('placeholder') || '').trim()
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
  }, { selector: SELECTOR });
}

(async () => {
  // AUDIT_CHROMIUM_PATH: use an existing Chromium when the Playwright version here has no matching browser download.
  const browser = await chromium.launch(process.env.AUDIT_CHROMIUM_PATH ? { executablePath: process.env.AUDIT_CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const report = {};
  let failed = false;

  for (const route of routes) {
    let records;
    try { records = await auditRoute(page, route); } catch (e) { report[route] = { error: String(e) }; console.log(`${route.padEnd(18)} ERROR ${String(e).slice(0, 80)}`); failed = true; continue; }
    const covered = records.filter((r) => r.status === 'covered').length;
    const ratio = records.length ? covered / records.length : 1;
    const need = PRIMARY.includes(route) ? THRESHOLD.primary : THRESHOLD.other;
    const gaps = records.filter((r) => r.status !== 'covered');
    report[route] = { total: records.length, covered, ratio: Number(ratio.toFixed(3)), gaps };
    const ok = ratio >= need;
    if (!ok) failed = true;
    console.log(`${route.padEnd(18)} ${String(covered).padStart(3)}/${String(records.length).padEnd(3)} ${(ratio * 100).toFixed(0).padStart(3)}%  ${ok ? 'ok' : `below ${need * 100}%`}`);
    if (verbose || !ok) gaps.forEach((g) => console.log(`    ${g.status.padEnd(5)} ${g.tag.padEnd(8)} ${g.label}`));
  }

  if (opt('out')) writeFileSync(opt('out'), JSON.stringify(report, null, 2));
  await browser.close();
  if (flag('check') && failed) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
