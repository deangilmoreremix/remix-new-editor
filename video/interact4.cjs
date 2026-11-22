const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path=require('path');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 const scrollMain=(p,y)=>p.evaluate((y)=>{const e=[...document.querySelectorAll('*')].filter(e=>e.scrollHeight>e.clientHeight+100&&e.clientHeight>700&&['auto','scroll'].includes(getComputedStyle(e).overflowY)).sort((a,b)=>b.scrollHeight-a.scrollHeight)[0];if(e)e.scrollTo({top:y,behavior:'instant'})},y);
 for (const [n,route,fn] of [
  ['05-cinema-studio','cinema',async(p)=>{await p.getByText('Cinema Prompt Builder').first().click();await p.waitForTimeout(1000);await scrollMain(p,420);}],
  ['01-video-studio','video',async(p)=>{await p.getByRole('button',{name:/Motion & Style/}).first().click();await p.waitForTimeout(1000);await scrollMain(p,300);}],
 ]){
  const ctx=await b.newContext({viewport:{width:1920,height:1080},colorScheme:'dark'});
  await ctx.addInitScript(()=>{try{sessionStorage.setItem('setup_popup_shown','1')}catch{}});
  const p=await ctx.newPage(); await p.goto('http://127.0.0.1:3100/#/'+route); await p.waitForTimeout(12000);
  await fn(p); await p.waitForTimeout(800);
  await p.screenshot({path:path.join(__dirname,'captures',n,'e-controls.png')}); await ctx.close();
 }
 await b.close();
})();
