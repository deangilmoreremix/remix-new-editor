// Real MP4 export of single catalog items through the PRODUCTION export runner (/export-runner.html, opaque-origin frame, Remotion web renderer,
// WebCodecs). Reports wall time, frames per second, size, adapter-error fail-closed behaviour and saves the MP4.
//   BASE=http://127.0.0.1:3101 SPEC=spec.json OUT=out/mem [FRAMES=60] node prod-export.mjs
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:3101'; const OUT = process.env.OUT || 'out/mem'; const FPS = 30; const FRAMES = +(process.env.FRAMES || 60);
const spec = JSON.parse(readFileSync(process.env.SPEC, 'utf8')); mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH }); const results = []; let idx = 0;
import { execSync } from 'node:child_process';
const rss = () => { try { return Math.round(execSync("ps -eo rss,args | grep -E 'chrome|chromium' | grep -v grep | awk '{s+=$1} END {print s/1024}'").toString().trim()); } catch { return null; } };
const N = +(process.env.LOOP || 10); const s = spec[0]; const ctx = await b.newContext({ viewport: { width: 800, height: 600 } }); const p = await ctx.newPage();
await p.route(`${BASE}/__x`, (rt) => rt.fulfill({ contentType: 'text/html', body: `<body><script>window.__ready=new Promise(r=>addEventListener('message',e=>{if(e.data&&e.data.type==='runner-ready')r()}));window.__run=(model)=>new Promise((res)=>{const id='j'+Math.random();const t0=performance.now();addEventListener('message',function f(e){const m=e.data;if(!m||m.id!==id)return;if(m.type==='done'){removeEventListener('message',f);res({ok:true,ms:performance.now()-t0,bytes:m.blob.size,hf:Object.keys(m.hfErrors||{}).length})}else if(m.type==='error'){removeEventListener('message',f);res({ok:false,error:m.message})}});document.getElementById('f').contentWindow.postMessage({type:'render',id,model,options:{container:'mp4',quality:'1080p'}},'*')})</script><iframe id="f" sandbox="allow-scripts" src="${BASE}/export-runner.html" style="width:1px;height:1px;position:fixed;right:0;bottom:0;opacity:.01"></iframe></body>` }));
await p.goto(`${BASE}/__x`); await p.evaluate(() => window.__ready);
const w = s.width || 1920, h = s.height || 1080; const dur = FRAMES; const cdp = await ctx.newCDPSession(p); await cdp.send('Performance.enable');
const heap = async () => { const m = (await cdp.send('Performance.getMetrics')).metrics; return Math.round((m.find((x) => x.name === 'JSHeapUsedSize')?.value || 0) / 1048576); };
const rows = [];
for (let i = 0; i < N; i++) {
  const layer = { id: 'L1', kind: 'hyperframes', trackIndex: 99, from: 0, durationInFrames: dur, effects: [], blockId: s.blockId, overrides: s.overrides || {}, blockWidth: w, blockHeight: h, title: s.id };
  const model = { version: 1, fps: FPS, width: w, height: h, durationInFrames: dur, background: '#000000', layers: [layer], audio: [], transitions: [], fonts: [] };
  const r = await p.evaluate((m) => window.__run(m), model);
  const row = { i: i + 1, ok: r.ok, ms: Math.round(r.ms || 0), bytes: r.bytes, hostHeapMB: await heap(), chromeRssMB: rss(), error: r.error }; rows.push(row); console.log(JSON.stringify(row));
}
writeFileSync(`${OUT}/memory-${s.id}.json`, JSON.stringify(rows, null, 1)); await b.close(); process.exit(0);
