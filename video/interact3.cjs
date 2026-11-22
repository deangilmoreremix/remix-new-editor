const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs=require('fs'),path=require('path');
const out=(n)=>{const d=path.join(__dirname,'captures',n);fs.mkdirSync(d,{recursive:true});return d};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 async function session(name,route,fn,rec=false){
  const dir=out(name);
  const ctx=await b.newContext({viewport:{width:1920,height:1080},colorScheme:'dark',...(rec?{recordVideo:{dir,size:{width:1920,height:1080}}}:{})});
  await ctx.addInitScript(()=>{try{sessionStorage.setItem('setup_popup_shown','1')}catch{}});
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:3100/#/'+route,{waitUntil:'domcontentloaded',timeout:60000}); await p.waitForTimeout(12000);
  const shot=(f)=>p.screenshot({path:path.join(dir,f+'.png')});
  try{ await fn(p,shot); console.log(name,'ok'); }catch(e){ console.log(name,'FAILED',String(e).slice(0,160)); }
  if(errs.length) console.log('  pageerrors',errs.length,errs[0].slice(0,100));
  await ctx.close();
 }
 const scrollMain=(p,y)=>p.evaluate((y)=>{const e=[...document.querySelectorAll('*')].filter(e=>e.scrollHeight>e.clientHeight+100&&e.clientHeight>700&&['auto','scroll'].includes(getComputedStyle(e).overflowY)).sort((a,b)=>b.scrollHeight-a.scrollHeight)[0];if(e){e.scrollTo({top:y,behavior:'instant'});return e.scrollHeight}return -1},y);
 await session('02-apps-hub','apps',async(p,shot)=>{
  const sh=await scrollMain(p,0); console.log('hub scrollHeight',sh);
  for(let i=1;i<=3;i++){ await scrollMain(p,i*700); await p.waitForTimeout(800); await shot('c-scroll'+i); }
  console.log('hub counts', JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('h2,h3')].map(e=>e.innerText.replace(/\s+/g,' ').trim()).filter(t=>/apps|My Work/i.test(t)))));
 });
 await session('05-cinema-studio','cinema',async(p,shot)=>{
  await p.getByText('Cinema Prompt Builder').first().click(); await p.waitForTimeout(1200);
  await p.getByText('Cinema Prompt Builder').first().scrollIntoViewIfNeeded(); await p.waitForTimeout(600); await shot('c-builder-open');
  for(const t of ['85mm','f/1.4','Dolly In','Anamorphic']){ const l=p.getByText(t,{exact:true}).first(); if(await l.count()){await l.click({timeout:3000}).catch(()=>{}); await p.waitForTimeout(400);} }
  await shot('d-builder-selected');
 });
 await session('01-video-studio','video',async(p,shot)=>{
  await p.getByRole('button',{name:'Advanced'}).first().click(); await p.waitForTimeout(1200); await shot('c-advanced');
  await p.keyboard.press('Escape'); await p.getByRole('button',{name:/Motion & Style/}).first().click(); await p.waitForTimeout(1200); await shot('d-motion-style');
 });
 await session('07-edit-tools','edit',async(p,shot)=>{ await scrollMain(p,500); await p.waitForTimeout(700); await shot('c-scroll'); });
 await session('12-templates','templates',async(p,shot)=>{ await scrollMain(p,700); await p.waitForTimeout(900); await shot('c-scroll'); });
 await session('15-library','library',async(p,shot)=>{
  console.log('library btns',JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('button')].map(e=>e.innerText.trim().replace(/\s+/g,' ').slice(0,24)).filter(Boolean).slice(0,40))));
 });
 await session('15c-stock','media-hub',async(p,shot)=>{ await shot('a'); });
 for (const [n,r] of [['06-storyboard','storyboard'],['08-character','character'],['09-avatar','avatar'],['09b-lipsync','lipsync'],['10-ai-vfx','ai-vfx'],['13-video-agent','video-agent']]){
  await session(n,r,async(p,shot)=>{ await shot('b-settled'); await scrollMain(p,600); await p.waitForTimeout(700); await shot('c-scroll'); });
 }
 await b.close();
})();
