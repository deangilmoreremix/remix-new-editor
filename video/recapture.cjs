// Re-capture real app frames with numeric count badges hidden (no claims in videos until confirmed).
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs=require('fs'),path=require('path');
const OUT=path.join(__dirname,'clean'); fs.mkdirSync(OUT,{recursive:true});
const HIDE=()=>{
  const re=/\d+\+|\b\d+\s+(?:\w+\s+){0,2}(?:models?|tools?|methods?|examples?|apps?|features?|templates?|styles?|presets?|items?|voices?|languages?|cameras?|effects?|studios?)\b/i;
  const run=()=>{ document.querySelectorAll('*').forEach(e=>{ if(e.childElementCount===0){ const t=(e.textContent||'').trim(); if(t.length<200&&(re.test(t)||/^\d{1,3}$/.test(t)&&parseFloat(getComputedStyle(e).fontSize)<=13)) e.style.visibility='hidden'; } }); };
  const strip=()=>{ document.querySelectorAll('*').forEach(e=>{ if(e.childElementCount===0){ const t=e.textContent||''; if(/\s*[·•]\s*\d+\s*$/.test(t)) e.textContent=t.replace(/\s*[·•]\s*\d+\s*$/,''); } }); };
  const run2=()=>{run();strip();};
  setInterval(run2,300); new MutationObserver(run2).observe(document,{subtree:true,childList:true,characterData:true});
};
const log={};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 const scrollMain=(p,y)=>p.evaluate((y)=>{const e=[...document.querySelectorAll('*')].filter(e=>e.scrollHeight>e.clientHeight+100&&e.clientHeight>700&&['auto','scroll'].includes(getComputedStyle(e).overflowY)).sort((a,b)=>b.scrollHeight-a.scrollHeight)[0];if(e)e.scrollTo({top:y,behavior:'instant'})},y);
 async function session(name,route,fn,rec=false){
  const ctx=await b.newContext({viewport:{width:1920,height:1080},colorScheme:'dark',...(rec?{recordVideo:{dir:path.join(OUT,'rec-'+name),size:{width:1920,height:1080}}}:{})});
  await ctx.addInitScript(()=>{try{sessionStorage.setItem('setup_popup_shown','1')}catch{}}); await ctx.addInitScript(HIDE);
  const p=await ctx.newPage(); const T0=Date.now(); const mark=(k)=>{log[name]=log[name]||{}; log[name][k]=(Date.now()-T0)/1000;};
  await p.goto('http://127.0.0.1:3100/#/'+route,{waitUntil:'domcontentloaded',timeout:60000}); await p.waitForTimeout(12000);
  const shot=async(f)=>{ await p.waitForTimeout(450); const v=await p.evaluate(()=>{const re=/\d+\+|\b\d+\s+(?:\w+\s+){0,2}(?:models?|tools?|methods?|examples?|apps?|features?|templates?|styles?|presets?|items?|voices?|languages?|cameras?|effects?|studios?)\b/i;return [...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&getComputedStyle(e).visibility!=='hidden'&&re.test((e.textContent||'').trim())&&e.getBoundingClientRect().width>0).map(e=>e.textContent.trim().slice(0,60))}); if(v.length) console.log('  VIOLATION',f,JSON.stringify(v.slice(0,4))); await p.screenshot({path:path.join(OUT,f+'.png')}); };
  try{ await fn(p,shot,mark); console.log(name,'ok'); }catch(e){ console.log(name,'FAILED',String(e).slice(0,150)); }
  await ctx.close();
 }
 await session('video-typing','video',async(p,shot,mark)=>{
  await shot('video-empty'); const ta=p.locator('textarea[placeholder^="Describe the video"]'); await p.waitForTimeout(500); mark('type0'); await ta.click();
  await ta.pressSequentially('A neon-lit street at night, slow dolly forward, rain on asphalt, cinematic',{delay:55}); mark('type1'); await p.waitForTimeout(900); await shot('video-typed');
  await p.getByRole('button',{name:/Motion & Style/}).first().click(); await p.waitForTimeout(1000); await scrollMain(p,300); await p.waitForTimeout(600); await shot('video-motion');
 },true);
 await session('picker','video',async(p,shot,mark)=>{
  await p.waitForTimeout(500); mark('open0'); await p.getByRole('button',{name:/Seedance Lite/}).first().click(); await p.waitForTimeout(1500); await shot('picker-open');
  mark('scroll0'); for(let i=0;i<9;i++){ await p.evaluate(()=>{const sc=[...document.querySelectorAll('div.overflow-y-auto')].find(e=>e.scrollHeight>5000);sc.scrollBy({top:260,behavior:'smooth'})}); await p.waitForTimeout(700);} mark('scroll1'); await shot('picker-scrolled');
 },true);
 await session('hub','apps',async(p,shot)=>{ await scrollMain(p,0); await shot('hub-0'); for(const [i,y] of [[1,560],[2,1120],[3,1500]]){ await scrollMain(p,y); await p.waitForTimeout(700); await shot('hub-'+i);} });
 await session('image','image',async(p,shot)=>{ const ta=p.locator('textarea[placeholder^="Describe the image"]'); await ta.click(); await ta.pressSequentially('Product photo of a matte black wireless headphone on a marble pedestal, soft studio light',{delay:20}); await shot('image-typed'); await p.getByRole('button',{name:'Advanced'}).first().click(); await p.waitForTimeout(1000); await scrollMain(p,420); await p.waitForTimeout(500); await shot('image-advanced'); });
 await session('cinema','cinema',async(p,shot)=>{ await shot('cinema-top'); await p.getByText('Cinema Prompt Builder').first().click(); await p.waitForTimeout(1000); await scrollMain(p,430); await p.waitForTimeout(700); await shot('cinema-builder'); });
 for (const [n,r] of [['director','director'],['edit','edit'],['character','character'],['avatar','avatar'],['lipsync','lipsync'],['aivfx','ai-vfx'],['effects','effects'],['templates','templates'],['upscale','upscale']])
  await session(n,r,async(p,shot)=>{ await shot(n+'-0'); await scrollMain(p,560); await p.waitForTimeout(700); await shot(n+'-1'); });
 fs.writeFileSync(path.join(OUT,'marks.json'),JSON.stringify(log,null,1)); console.log(JSON.stringify(log));
 await b.close();
})();
