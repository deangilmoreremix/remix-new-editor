const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs=require('fs'),path=require('path');
const out=(n)=>{const d=path.join(__dirname,'captures',n);fs.mkdirSync(d,{recursive:true});return d};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 async function session(name,route,fn){
  const dir=out(name);
  const ctx=await b.newContext({viewport:{width:1920,height:1080},colorScheme:'dark',recordVideo:{dir,size:{width:1920,height:1080}}});
  await ctx.addInitScript(()=>{try{sessionStorage.setItem('setup_popup_shown','1')}catch{}});
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:3100/#/'+route,{waitUntil:'domcontentloaded',timeout:60000}); await p.waitForTimeout(12000);
  const shot=(f)=>p.screenshot({path:path.join(dir,f+'.png')});
  try{ await fn(p,shot,dir); }catch(e){ console.log(name,'FAILED',String(e).slice(0,200)); }
  console.log(name,'pageerrors:',errs.length, errs[0]||'');
  await ctx.close();
 }
 // 01 hero: type prompt in Video Studio
 await session('01-video-studio','video',async(p,shot)=>{
  await shot('a-empty');
  const ta=p.locator('textarea[placeholder^="Describe the video"]');
  await ta.click(); await ta.pressSequentially('A neon-lit street at night, slow dolly forward, rain on asphalt, cinematic',{delay:45});
  await p.waitForTimeout(600); await shot('b-typed');
 });
 // 03 model picker
 await session('03-model-picker','video',async(p,shot,dir)=>{
  await p.getByRole('button',{name:/Seedance Lite/}).first().click(); await p.waitForTimeout(1500); await shot('a-open');
  const info=await p.evaluate(()=>{const els=[...document.querySelectorAll('[class*=picker],[class*=model],[role=listbox],[role=dialog]')].filter(e=>e.offsetParent&&e.getBoundingClientRect().height>200);return els.slice(0,5).map(e=>({cls:String(e.className).slice(0,60),h:Math.round(e.getBoundingClientRect().height),items:e.querySelectorAll('button,[role=option],li').length,sh:e.scrollHeight}))});
  console.log('picker candidates',JSON.stringify(info));
 });
 // 04 image studio
 await session('04-image-studio','image',async(p,shot)=>{
  await shot('a-empty');
  const ta=p.locator('textarea[placeholder^="Describe the image"]');
  await ta.click(); await ta.pressSequentially('Product photo of a matte black wireless headphone on a marble pedestal, soft studio light',{delay:40});
  await shot('b-typed');
  await p.getByRole('button',{name:'Advanced'}).first().click(); await p.waitForTimeout(1200); await shot('c-advanced');
 });
 await b.close();
})();
