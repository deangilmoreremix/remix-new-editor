// Captures the real Backlot board (local tool in this repo) for the fictional demo project "backlot-demo-run" ("The Last Lighthouse").
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'backlot', 'serve', '--port', '4750'], { cwd: '/home/user/remix-new-editor', stdio: 'ignore' });
for (let i = 0; i < 40; i++) { try { if ((await fetch('http://127.0.0.1:4750/')).ok) break; } catch { /* wait */ } await new Promise((r) => setTimeout(r, 1000)); }
const b = await puppeteer.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
await p.goto('http://127.0.0.1:4750/p/backlot-demo-run', { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 4000));
// hide anything that looks like spend/billing text
await p.addStyleTag({ content: '[class*="cost"],[class*="spend"],[class*="budget"],[id*="cost"]{visibility:hidden!important}' });
// hide the simulator's fake tool-event feed and the storyboard strip (placeholder model name, $0.00 and unrelated poster art)
await p.evaluate(() => {
  const hideAt = (x, y, minW, maxW, minH) => {
    let e = document.elementFromPoint(x, y);
    while (e && e.parentElement) { const r = e.getBoundingClientRect(); if (r.width >= minW && r.width <= maxW && r.height >= minH) { e.style.visibility = 'hidden'; return true; } e = e.parentElement; }
    return false;
  };
  hideAt(1450, 380, 280, 450, 200);
  hideAt(700, 980, 600, 1900, 100);
});
const txt = await p.evaluate(() => document.body.innerText.slice(0, 1500));
console.log(txt);
await p.screenshot({ path: 'public/textures/live/backlot-full.png' });
await b.close(); srv.kill('SIGTERM'); process.exit(0);
