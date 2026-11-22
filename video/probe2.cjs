const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 const ctx=await b.newContext({viewport:{width:1920,height:1080},colorScheme:'dark'});
 await ctx.addInitScript(()=>{try{sessionStorage.setItem('setup_popup_shown','1')}catch{}});
 let p=await ctx.newPage(); await p.goto('http://127.0.0.1:3100/#/video'); await p.waitForTimeout(12000);
 await p.getByRole('button',{name:/Seedance Lite/}).first().click(); await p.waitForTimeout(1500);
 console.log('PICKER', JSON.stringify(await p.evaluate(()=>{
   const sc=[...document.querySelectorAll('*')].filter(e=>e.scrollHeight>e.clientHeight+50&&e.clientHeight>200&&e.clientHeight<700&&getComputedStyle(e).overflowY!=='visible'&&e.getBoundingClientRect().left<700);
   return sc.map(e=>({tag:e.tagName,cls:String(e.className).slice(0,70),id:e.id,ch:e.clientHeight,sh:e.scrollHeight,kids:e.children.length,txt:e.innerText.slice(0,60).replace(/\n/g,'|')}))})));
 await p.close();
 p=await ctx.newPage(); await p.goto('http://127.0.0.1:3100/#/apps'); await p.waitForTimeout(12000);
 console.log('HUB', JSON.stringify(await p.evaluate(()=>({h:document.documentElement.scrollHeight,
   headings:[...document.querySelectorAll('h2,h3')].map(e=>e.innerText.trim()).slice(0,20),
   cards:document.querySelectorAll('[data-app-id],[data-studio],a[href*="#/"]').length,
   sample:[...document.querySelectorAll('[data-app-id],[data-studio]')].slice(0,3).map(e=>e.outerHTML.slice(0,160))}))));
 await p.close();
 p=await ctx.newPage(); await p.goto('http://127.0.0.1:3100/#/cinema'); await p.waitForTimeout(12000);
 console.log('CINEMA', JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('button,select')].map(e=>(e.innerText||e.getAttribute('aria-label')||'').trim().replace(/\s+/g,' ').slice(0,28)).filter(Boolean).slice(0,45))));
 await p.close(); await b.close();
})();
