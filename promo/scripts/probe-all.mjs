// Dump the visible interactive controls (id, text, box) of each studio so walkthrough scripts use real selectors.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const routes = (process.argv[2] || 'video,image,cinema,edit,upscale,character,commercial,avatar,lipsync,ai-vfx,effects,storyboard,templates,video-agent,audio,videotools,influencer,animate').split(',');
const srv = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort', '--host', '127.0.0.1'], { cwd: '/home/user/remix-new-editor', stdio: 'ignore' });
for (let i = 0; i < 60; i++) { try { if ((await fetch('http://127.0.0.1:4173')).ok) break; } catch { /* wait */ } await new Promise((r) => setTimeout(r, 1000)); }
const b = await puppeteer.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const out = {};
for (const r of routes) {
  const p = await b.newPage();
  await p.setViewport({ width: 1920, height: 1080 });
  await p.evaluateOnNewDocument(() => sessionStorage.setItem('setup_popup_shown', '1'));
  await p.goto(`http://127.0.0.1:4173/?dev=#/${r}`, { waitUntil: 'domcontentloaded' });
  await new Promise((x) => setTimeout(x, 9000));
  out[r] = await p.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 8 && r.height > 8 && r.top >= 0 && r.top < 1080 && r.left > 90; };
    return [...document.querySelectorAll('button,[role=button],[role=tab],textarea,input,select,summary,a[href^="#"]')].filter(vis).slice(0, 70).map((e) => {
      const r = e.getBoundingClientRect();
      return { t: e.tagName.toLowerCase(), id: e.id || '', txt: (e.innerText || e.getAttribute('aria-label') || e.placeholder || e.title || '').trim().replace(/\s+/g, ' ').slice(0, 40), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    });
  });
  await p.close();
  console.log(r, out[r].length);
}
fs.writeFileSync('analysis/controls.json', JSON.stringify(out, null, 1));
await b.close(); srv.kill('SIGTERM'); process.exit(0);
