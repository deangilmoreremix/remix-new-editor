// Capture-only baseline of the NEW timeline editor (CineGen workspace) served from a separate worktree.
// Works in an ephemeral browser profile; creates one throwaway project there. Usage: BASE=http://127.0.0.1:3101 node baseline/capture-new-editor.mjs
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:3101'; const out = 'out/baseline-new'; mkdirSync(out, { recursive: true });
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const log = { console: [], pageErrors: [], failed: [], steps: [] };
p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) log.console.push(`${m.type()}: ${m.text().slice(0, 180)}`); });
p.on('pageerror', (e) => log.pageErrors.push(e.message.slice(0, 200)));
p.on('requestfailed', (r) => log.failed.push(r.url().slice(0, 100)));
const text = () => p.evaluate(() => document.body.innerText);
const controls = () => p.evaluate(() => [...document.querySelectorAll('button,[role=tab],[role=menuitemradio]')].filter((e) => e.offsetParent && e.getBoundingClientRect().x > 90).map((e) => (e.getAttribute('aria-label') || e.title || e.textContent).trim().replace(/\s+/g, ' ').slice(0, 24)).filter(Boolean));
const step = async (name) => { await p.waitForTimeout(2500); await p.screenshot({ path: `${out}/${name}.png` }); log.steps.push({ name, controls: await controls() }); };
await p.goto(`${BASE}/#/timeline`, { waitUntil: 'load' });
for (let i = 0; i < 30 && !(await text()).includes('set up your API keys'); i++) await p.waitForTimeout(1000);
await p.mouse.click(883, 75); await p.waitForTimeout(1500);
for (let i = 0; i < 60 && !/Project Manager|Projects/.test(await text()); i++) await p.waitForTimeout(2000);
await step('01-project-manager');
await p.getByRole('button', { name: 'New Project' }).last().click(); await p.waitForTimeout(1500);
await step('02-new-project-form');
await p.getByPlaceholder('Project name...').fill('baseline-capture'); await p.getByRole('button', { name: 'Create' }).click(); await p.waitForTimeout(5000);
await step('03-workspace');
// tabs live inside the workspace, not the app sidebar
for (const tab of ['Elements', 'Spaces', 'Director', 'Edit', 'LLM', 'Export']) {
  const hit = await p.evaluate((t) => { const el = [...document.querySelectorAll('button,[role=tab],[role=menuitemradio]')].find((e) => e.offsetParent && e.getBoundingClientRect().x > 90 && e.textContent.trim() === t); if (el) { el.click(); return true; } return false; }, tab);
  log.steps.push({ name: `tab-${tab}`, clicked: hit });
  if (hit) await step(`tab-${tab}`);
}
writeFileSync(`${out}/capture-log.json`, JSON.stringify(log, null, 1));
console.log('pageErrors', log.pageErrors.length, log.steps.map((s) => `${s.name}:${s.clicked ?? 'shot'}`).join(' '));
await b.close();
