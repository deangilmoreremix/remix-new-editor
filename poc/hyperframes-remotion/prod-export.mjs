// Real MP4 export of single catalog items through the PRODUCTION export runner (/export-runner.html, opaque-origin frame, Remotion web renderer,
// WebCodecs). Reports wall time, frames per second, size, adapter-error fail-closed behaviour and saves the MP4.
//   BASE=http://127.0.0.1:3101 SPEC=spec.json OUT=out/exp [FRAMES=60] node prod-export.mjs
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:3101'; const OUT = process.env.OUT || 'out/exp'; const FPS = 30; const FRAMES = +(process.env.FRAMES || 60);
const spec = JSON.parse(readFileSync(process.env.SPEC, 'utf8')); mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH }); const results = []; let idx = 0;
async function worker() {
  while (idx < spec.length) {
    const s = spec[idx++]; const r = { id: s.id }; const ctx = await b.newContext({ viewport: { width: 800, height: 600 } }); const p = await ctx.newPage(); if (process.env.VERBOSE) { p.on('console', (m) => console.log('  [console]', m.type(), m.text().slice(0, 200))); p.on('pageerror', (e) => console.log('  [pageerror]', e.message.slice(0, 200))); }
    try {
      await p.route(`${BASE}/__x`, (rt) => rt.fulfill({ contentType: 'text/html', body: `<body><script>window.__ready=new Promise(r=>addEventListener('message',e=>{if(e.data&&e.data.type==='runner-ready')r()}));window.__run=(model)=>new Promise((res)=>{const id='j'+Math.random();const t0=performance.now();addEventListener('message',function f(e){const m=e.data;if(!m||m.id!==id)return;if(m.type==='done'){removeEventListener('message',f);m.blob.arrayBuffer().then(buf=>res({ok:true,ms:performance.now()-t0,bytes:buf.byteLength,hfErrors:m.hfErrors||{},b64:(()=>{const u=new Uint8Array(buf.slice(0,Math.min(buf.byteLength,6e6)));let s='';for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return btoa(s)})()}))}else if(m.type==='error'){removeEventListener('message',f);res({ok:false,error:m.message})}});document.getElementById('f').contentWindow.postMessage({type:'render',id,model,options:{container:'mp4',quality:'1080p'}},'*')})</script><iframe id="f" sandbox="allow-scripts" src="${BASE}/export-runner.html" style="width:1px;height:1px;position:fixed;right:0;bottom:0;opacity:.01"></iframe></body>` }));
      await p.goto(`${BASE}/__x`); await p.evaluate(() => window.__ready);
      const dur = s.frames || FRAMES; const w = s.width || 1920, h = s.height || 1080;
      const layer = { id: 'L1', kind: 'hyperframes', trackIndex: 99, from: 0, durationInFrames: dur, effects: [], blockId: s.blockId, overrides: s.overrides || {}, blockWidth: w, blockHeight: h, title: s.id };
      const model = { version: 1, fps: FPS, width: w, height: h, durationInFrames: dur, background: '#000000', layers: [layer], audio: [], transitions: [], fonts: [] };
      const res = await Promise.race([p.evaluate((m) => window.__run(m), model), new Promise((_, rej) => setTimeout(() => rej(new Error('export timeout')), +(process.env.TIMEOUT_MS || 240000)))]);
      r.ok = res.ok; r.error = res.error; r.ms = Math.round(res.ms || 0); r.bytes = res.bytes; r.fps = res.ok ? +(dur / (res.ms / 1000)).toFixed(1) : null; r.hfErrors = res.hfErrors;
      if (res.ok && res.b64) writeFileSync(`${OUT}/${s.id}.mp4`, Buffer.from(res.b64, 'base64'));
    } catch (e) { r.ok = false; r.error = String(e).slice(0, 200); }
    await ctx.close(); results.push(r); console.log(JSON.stringify(r).slice(0, 300));
  }
}
await Promise.all(Array.from({ length: +(process.env.CONC || 1) }, worker));
writeFileSync(`${OUT}/results${process.env.TAG || ''}.json`, JSON.stringify(results, null, 1));
await Promise.race([b.close(), new Promise((r) => setTimeout(r, 5000))]); process.exit(0);
