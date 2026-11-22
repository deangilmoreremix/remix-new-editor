const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs=require('fs'),path=require('path');
const out=(n)=>{const d=path.join(__dirname,'captures',n);fs.mkdirSync(d,{recursive:true});return d};
const facts={};
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
 // 03 model picker: open, count, scroll (recorded)
 await session('03-model-picker','video',async(p,shot)=>{
  await p.getByRole('button',{name:/Seedance Lite/}).first().click(); await p.waitForTimeout(1200);
  const sel='div.overflow-y-auto.custom-scrollbar';
  facts.pickerRows=await p.evaluate(()=>{const sc=[...document.querySelectorAll('div.overflow-y-auto')].find(e=>e.scrollHeight>5000);return {kids:sc.children.length,names:[...sc.children].map(c=>c.innerText.split('\n')[0]).slice(0,5)}});
  await shot('a-open');
  for(let i=0;i<8;i++){ await p.evaluate(()=>{const sc=[...document.querySelectorAll('div.overflow-y-auto')].find(e=>e.scrollHeight>5000);sc.scrollBy({top:900,behavior:'smooth'})}); await p.waitForTimeout(900); if(i===3) await shot('b-scrolled'); }
 },true);
 // 02 hub
 await session('02-apps-hub','apps',async(p,shot)=>{
  facts.hubText=(await p.innerText('body')).replace(/\s+/g,' ').slice(0,900);
  await shot('a-top');
  const sc=await p.evaluate(()=>{const e=[...document.querySelectorAll('*')].find(e=>e.scrollHeight>e.clientHeight+100&&e.clientHeight>500&&getComputedStyle(e).overflowY!=='visible');return e?{sh:e.scrollHeight,ch:e.clientHeight}:null});
  facts.hubScroller=sc;
  for(let i=1;i<=4;i++){ await p.evaluate((i)=>{const e=[...document.querySelectorAll('*')].find(e=>e.scrollHeight>e.clientHeight+100&&e.clientHeight>500&&getComputedStyle(e).overflowY!=='visible');if(e)e.scrollTo(0,i*900)},i); await p.waitForTimeout(900); await shot('b-scroll'+i); }
 },true);
 // 05 cinema builder
 await session('05-cinema-studio','cinema',async(p,shot)=>{
  await p.getByText('Cinema Prompt Builder').first().scrollIntoViewIfNeeded(); await p.waitForTimeout(800); await shot('a-builder');
  for(const t of ['85mm','Dolly In','Anamorphic','f/1.4']){ const l=p.getByText(t,{exact:true}).first(); if(await l.count()){await l.click().catch(()=>{}); await p.waitForTimeout(500);} }
  await shot('b-selected');
 },true);
 // 11 timeline
 await session('11-timeline','timeline',async(p,shot)=>{
  await shot('a-projects');
  await p.getByRole('button',{name:'New Project'}).first().click(); await p.waitForTimeout(6000); await shot('b-new-project');
 });
 // 14 chat panel
 await session('14-chat','video',async(p,shot)=>{
  await p.getByRole('button',{name:/Ask SmartVideo/}).first().click(); await p.waitForTimeout(1500); await shot('a-open');
  const ta=p.locator('textarea[placeholder^="Ask about"]'); await ta.click(); await ta.pressSequentially('Give me 3 hook ideas for a 15-second product ad',{delay:35}); await shot('b-typed');
 },true);
 fs.writeFileSync(path.join(__dirname,'facts.json'),JSON.stringify(facts,null,1)); console.log(JSON.stringify(facts).slice(0,1500));
 await b.close();
})();
