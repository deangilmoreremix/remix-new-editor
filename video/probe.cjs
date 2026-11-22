const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 const ctx=await b.newContext({viewport:{width:1920,height:1080},colorScheme:'dark'});
 await ctx.addInitScript(()=>{try{sessionStorage.setItem('setup_popup_shown','1')}catch{}});
 for (const r of process.argv.slice(2)){
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message.slice(0,120)));
  await p.goto('http://127.0.0.1:3100/#/'+r,{waitUntil:'domcontentloaded',timeout:60000}); await p.waitForTimeout(15000);
  const info=await p.evaluate(()=>({textLen:document.body.innerText.length,
    textareas:[...document.querySelectorAll('textarea,input[type=text]')].map(e=>e.placeholder||e.id).slice(0,6),
    btns:[...document.querySelectorAll('main button, #app button, button')].map(e=>(e.innerText||e.getAttribute('aria-label')||e.id||'').trim().replace(/\s+/g,' ').slice(0,30)).filter(Boolean).slice(0,60)}));
  console.log('\n##',r,JSON.stringify(info), errs.join('|')); await p.close();
 }
 await b.close();
})();
