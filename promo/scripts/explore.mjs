// Exploratory pass: click safe controls in one studio and screenshot each state. Usage: node scripts/explore.mjs video
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const route = process.argv[2] || 'video';
const steps = JSON.parse(process.argv[3] || '[]');
const srv = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort', '--host', '127.0.0.1'], { cwd: '/home/user/remix-new-editor', stdio: 'ignore' });
for (let i = 0; i < 60; i++) { try { if ((await fetch('http://127.0.0.1:4173')).ok) break; } catch { /* wait */ } await new Promise((r) => setTimeout(r, 1000)); }
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, colorScheme: 'dark' });
await ctx.addInitScript(() => { try { sessionStorage.setItem('setup_popup_shown', '1'); } catch { /* ignore */ } });
const p = await ctx.newPage();
await p.goto(`http://127.0.0.1:4173/?dev=#/${route}`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(9000);
let n = 0;
const shot = async (label) => { await p.screenshot({ path: `out/explore/${route}-${String(n++).padStart(2, '0')}-${label}.png` }); };
await shot('start');
for (const s of steps) {
  try {
    if (s.click) await p.click(s.click, { timeout: 4000 });
    if (s.text) await p.getByText(s.text, { exact: !!s.exact }).filter({ visible: true }).first().click({ timeout: 4000 });
    if (s.type) { await p.click(s.type.sel); await p.keyboard.type(s.type.text, { delay: 30 }); }
    if (s.key) await p.keyboard.press(s.key);
    if (s.scroll) await p.evaluate((y) => { const e = [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 100 && e.clientHeight > 500 && ['auto', 'scroll'].includes(getComputedStyle(e).overflowY)).sort((a, b) => b.scrollHeight - a.scrollHeight)[0]; (e || window).scrollBy({ top: y }); }, s.scroll);
  } catch (e) { console.log('  step failed', JSON.stringify(s).slice(0, 80), String(e).slice(0, 60)); }
  await p.waitForTimeout(s.wait ?? 1200);
  await shot(s.label || 'step');
}
await b.close(); srv.kill('SIGTERM'); process.exit(0);
