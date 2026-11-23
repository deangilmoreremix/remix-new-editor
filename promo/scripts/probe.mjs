// One-off DOM probe: node scripts/probe.mjs <route>
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '../..');
const route = process.argv[2] || 'video';
const srv = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort', '--host', '127.0.0.1'], { cwd: REPO, stdio: 'ignore' });
for (let i = 0; i < 60; i++) { try { if ((await fetch('http://127.0.0.1:4173')).ok) break; } catch { /* wait */ } await new Promise((r) => setTimeout(r, 1000)); }
const b = await puppeteer.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1920, height: 1080 });
await p.evaluateOnNewDocument(() => sessionStorage.setItem('setup_popup_shown', '1'));
await p.goto(`http://127.0.0.1:4173/?dev=#/${route}`, { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 10000));
const info = await p.evaluate(() => {
  const m = (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; };
  return {
    textareas: [...document.querySelectorAll('textarea')].map((e) => ({ id: e.id, ph: e.placeholder.slice(0, 50), box: m(e) })),
    ids: [...document.querySelectorAll('[id]')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.id).slice(0, 60),
    videos: [...document.querySelectorAll('video')].map((e) => ({ src: (e.currentSrc || e.src).slice(-60), box: m(e) })).slice(0, 10),
    imgs: [...document.querySelectorAll('img')].filter((e) => e.getBoundingClientRect().width > 80).map((e) => ({ src: e.src.slice(-50), box: m(e) })).slice(0, 12),
  };
});
console.log(JSON.stringify(info, null, 1));
await b.close();
srv.kill('SIGTERM');
process.exit(0);
