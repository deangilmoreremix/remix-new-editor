const { chromium } = require('playwright'); const fs=require('fs');
const B=process.env.HARNESS_DIR||__dirname;
const tokens=JSON.parse(fs.readFileSync(`${B}/tokens.json`,'utf8'));
const results=[]; const check=(n,ok,d='')=>{results.push(ok); console.log(`${ok?'PASS':'FAIL'}  ${n}${d?'  — '+d:''}`)};
(async()=>{
 const browser=await chromium.launch(); const ctx=await browser.newContext({viewport:{width:1440,height:900},bypassCSP:true});
 await ctx.addInitScript((s)=>{sessionStorage.setItem('setup_popup_shown','1'); window.Clerk={loaded:true,user:{id:s},session:{getToken:async()=>'x'},addListener(){return()=>{}},load:async()=>{}};},'userA');
 const page=await ctx.newPage();
 await page.route('**/.netlify/functions/supabase-token',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({token:tokens.userA,expires_in:3600})}));
 await page.goto('http://127.0.0.1:3100/#/timeline',{waitUntil:'domcontentloaded'});
 await page.locator('.floating-rail').waitFor({timeout:30000});
 // reference colours from the EDITOR's own components (before opening Projects)
 const ref=await page.evaluate(()=>{ const cs=(sel,props)=>{const e=document.querySelector(sel); if(!e) return null; const c=getComputedStyle(e); return Object.fromEntries(props.map(p=>[p,c[p]]));};
   const root=getComputedStyle(document.documentElement);
   return { tokens:{cyan:root.getPropertyValue('--cyan').trim(), emerald:root.getPropertyValue('--emerald').trim()},
     sideCard:cs('.side-card:not(#projectsPanel)',['backgroundColor','borderTopColor']),
     primaryBtn:cs('#agentPanel .primary-btn',['backgroundImage','color']),
     activeRail:cs('.rail-btn.active',['backgroundColor','borderTopColor','color']),
     cardTitle:cs('#agentPanel .card-title',['color']),
     textInput:cs('.text-input',['backgroundColor','borderTopColor']),
     body:cs('body',['backgroundColor','color']) }; });
 await page.locator('.floating-rail').getByRole('button',{name:/Projects/}).first().click(); await page.addStyleTag({content:'#floatingRail{display:none!important}'});
 await page.locator('.prj-card').first().waitFor({timeout:20000}); await page.waitForTimeout(600);
 const mine=async()=>page.evaluate(()=>{ const cs=(sel,props)=>{const e=document.querySelector(sel); if(!e) return null; const c=getComputedStyle(e); return Object.fromEntries(props.map(p=>[p,c[p]]));};
   return { panel:cs('#projectsPanel',['backgroundColor','borderTopColor']), newBtn:cs('.prj-new',['backgroundImage','color']), search:cs('.prj-searchbox',['backgroundColor','borderTopColor']), chipPub:cs('.prj-chip.is-published',['backgroundColor','color']), card:cs('.prj-card',['backgroundColor','borderTopColor']) }; });
 const m1=await mine();
 check('panel surface + border equal the editor side-card', m1.panel.backgroundColor===ref.sideCard.backgroundColor && m1.panel.borderTopColor===ref.sideCard.borderTopColor, `${m1.panel.backgroundColor} vs ${ref.sideCard.backgroundColor}`);
 check('"New project" button uses the editor primary-button gradient and text colour', m1.newBtn.backgroundImage===ref.primaryBtn.backgroundImage && m1.newBtn.color===ref.primaryBtn.color, m1.newBtn.color);
 check('search box matches the editor text-input surface', m1.search.backgroundColor===ref.textInput.backgroundColor || /rgba\(0, 0, 0, 0\.2\)|rgba\(255, 255, 255, 0\.05\)/.test(m1.search.backgroundColor), m1.search.backgroundColor);
 check('Published chip is the editor emerald (success) colour, not a custom green', /rgba\(52, 211, 153, 0\.1\)/.test(m1.chipPub.backgroundColor) && m1.chipPub.color==='rgb(187, 247, 208)', `${m1.chipPub.backgroundColor} / ${m1.chipPub.color}`);
 await page.locator('.prj-card').filter({has:page.getByRole('heading',{name:'Kitchen Renovation Promo',exact:true})}).locator('[data-act="details"]').click();
 await page.locator('.prj-tabs').getByRole('tab',{name:'Analytics'}).click(); await page.locator('.sv-analytics h1').waitFor(); await page.waitForTimeout(1200);
 await page.locator('.sv-tabs').getByRole('button',{name:'Overview'}).click();
 const a=await page.evaluate(()=>{ const cs=(sel,props)=>{const e=document.querySelector(sel); if(!e) return null; const c=getComputedStyle(e); return Object.fromEntries(props.map(p=>[p,c[p]]));};
   const line=document.querySelector('.sv-chart-box polyline'); const dot=document.querySelector('.sv-chart-box circle');
   return { cls:document.querySelector('main.sv-analytics').className, card:cs('.sv-card',['backgroundColor','borderTopColor']), primary:cs('.sv-primary-btn',['backgroundImage','color']), activeSeg:cs('.sv-segment .active',['backgroundColor','color','boxShadow']), activeTab:cs('.sv-tabs .active',['backgroundColor','color']), status:cs('.sv-status-published',['backgroundColor','color']), value:cs('.sv-stat-value',['color']), muted:cs('.sv-stat-label',['color']), title:cs('.sv-analytics h1',['color']), lineStroke:getComputedStyle(line).stroke, dotFill:getComputedStyle(dot).fill, unread:cs('.sv-op-unread',['backgroundColor']), bgPage:getComputedStyle(document.body).backgroundColor }; });
 check('Analytics uses the editor theme class (and not the supplied light/dark/blue)', /sv-editor/.test(a.cls) && !/sv-dark/.test(a.cls), a.cls);
 check('Analytics cards use the same surface and border as an editor side-card', a.card.backgroundColor===ref.sideCard.backgroundColor && a.card.borderTopColor===ref.sideCard.borderTopColor, `${a.card.backgroundColor} | ${a.card.borderTopColor}`);
 check('"Plan follow-up" button has the editor primary gradient + dark text', a.primary.backgroundImage===ref.primaryBtn.backgroundImage && a.primary.color===ref.primaryBtn.color, a.primary.color);
 check('active period button is the editor active state (cyan-soft fill, #cffafe text, cyan edge)', a.activeSeg.backgroundColor===ref.activeRail.backgroundColor && a.activeSeg.color===ref.activeRail.color && /217, 255, 0|color\(srgb/.test(a.activeSeg.boxShadow), `${a.activeSeg.backgroundColor} ${a.activeSeg.color} ${a.activeSeg.boxShadow.slice(0,60)}`);
 check('active tab matches the same active state', a.activeTab.backgroundColor===ref.activeRail.backgroundColor && a.activeTab.color===ref.activeRail.color, `tab bg=${a.activeTab.backgroundColor} color=${a.activeTab.color} | editor active bg=${ref.activeRail.backgroundColor} color=${ref.activeRail.color}`);
 const liveAccent=await page.evaluate(()=>{const e=document.createElement('i'); e.style.color='var(--cyan)'; document.body.appendChild(e); const c=getComputedStyle(e).color; e.remove(); return c;});
 const liveAccent2=await page.evaluate(()=>{const e=document.createElement('i'); e.style.color='var(--emerald)'; document.body.appendChild(e); const c=getComputedStyle(e).color; e.remove(); return c;});
 check(`chart line + dots use the editor's LIVE accent (${liveAccent})`, a.lineStroke===liveAccent && a.dotFill===liveAccent, `${a.lineStroke} / ${a.dotFill}`);
 check('published status pill is emerald/success, not the supplied green', /rgba\(52, 211, 153, 0\.1\)/.test(a.status.backgroundColor) && a.status.color==='rgb(187, 247, 208)', `${a.status.backgroundColor} / ${a.status.color}`);
 check('unread dot is the editor danger red', a.unread===null || a.unread.backgroundColor==='rgb(239, 68, 68)');
 await page.locator('.sv-tabs').getByRole('button',{name:'Engagement'}).click(); await page.waitForTimeout(600);
 const h=await page.evaluate(()=>{ const bars=[...document.querySelectorAll('.sv-heatmap span')]; const set=new Set(bars.map(b=>getComputedStyle(b).backgroundColor)); const fill=document.querySelector('.sv-progress span'); return { colors:[...set], progress:getComputedStyle(fill).backgroundImage }; });
 check('heat-map bars use the editor accent + secondary accent (no blue/green from the supplied design)', h.colors.length===2 && h.colors.includes(liveAccent) && h.colors.includes(liveAccent2), JSON.stringify(h.colors)+` vs ${liveAccent} / ${liveAccent2}`);
 check('engagement bars use the editor accent gradient', h.progress.includes(liveAccent) && h.progress.includes(liveAccent2), h.progress.slice(0,90));
 // WCAG AA contrast for the text colours the tab actually uses, composited over the real background
 const contrast=await page.evaluate(()=>{ const parse=(c)=>{const m=c.match(/[\d.]+/g).map(Number); return {r:m[0],g:m[1],b:m[2],a:m[3]===undefined?1:m[3]};}; const over=(f,b)=>({r:f.r*f.a+b.r*(1-f.a),g:f.g*f.a+b.g*(1-f.a),b:f.b*f.a+b.b*(1-f.a),a:1});
   const lum=(c)=>{const f=(v)=>{v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)}; return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b)}; const ratio=(a,b)=>{const L1=lum(a),L2=lum(b); return (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05)};
   const bgOf=(el)=>{ let layers=[]; for(let e=el;e;e=e.parentElement){ const c=parse(getComputedStyle(e).backgroundColor); if(c.a>0) layers.push(c); if(c.a===1) break; } let base={r:7,g:9,b:13,a:1}; for(const l of layers.reverse()) base=over(l,base); return base; };
   const out={}; for(const [k,sel] of Object.entries({'stat label':'.sv-stat-label','stat value':'.sv-stat-value','subtitle':'.sv-subtitle','breadcrumb':'.sv-breadcrumb','inactive tab':'.sv-tabs button:not(.active)','active tab':'.sv-tabs .active','section name':'.sv-section strong','opportunity title':'.sv-op-content strong','opportunity text':'.sv-op-content span','footer note':'.sv-footer-note'})){ const el=document.querySelector(sel); if(!el) continue; const fg=over(parse(getComputedStyle(el).color),bgOf(el)); out[k]=Math.round(ratio(fg,bgOf(el))*100)/100; } return out; });
 const low=Object.entries(contrast).filter(([,v])=>v<4.5);
 check('WCAG AA (>= 4.5:1) for every text style on its real background', low.length===0, low.length?JSON.stringify(low):JSON.stringify(contrast));
 console.log(`\n${results.filter(Boolean).length}/${results.length} palette checks passed`);
 await browser.close(); process.exit(results.every(Boolean)?0:1);
})().catch(e=>{console.error('SCRIPT ERROR',e); process.exit(2);});
