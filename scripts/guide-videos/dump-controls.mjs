// Lists the visible controls in a studio, for writing demo steps: node scripts/guide-videos/dump-controls.mjs <route>
import { chromium } from 'playwright';
const [,, route] = process.argv;
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH, args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.addInitScript(() => { localStorage.setItem('muapi_key','tour-placeholder-key'); localStorage.setItem('openai_key','tour-placeholder-key'); });
await p.goto(`http://localhost:3100/?dev=#/${route}`); await p.waitForTimeout(12000);
const rows = await p.evaluate(() => [...document.querySelectorAll('button,input,textarea,select,[role=tab],[role=button],label')].filter(e=>e.offsetParent||e.type==='file').map(e=>`${e.tagName.toLowerCase()}${e.id?'#'+e.id:''}${e.type?'['+e.type+(e.accept?' '+e.accept:'')+']':''} "${(e.getAttribute('aria-label')||e.title||e.getAttribute('data-tooltip')||e.placeholder||e.innerText||'').trim().replace(/\s+/g,' ').slice(0,40)}"`));
await p.screenshot({path: process.env.SHOT||"/tmp/dump.png"}); console.log(rows.join('\n')); await b.close();
