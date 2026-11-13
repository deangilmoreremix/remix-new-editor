const { chromium } = require('playwright'); const fs=require('fs'); const { execSync } = require('child_process');
const tokens=JSON.parse(fs.readFileSync(__dirname+'/tokens.json','utf8'));
const sql=(q)=>execSync(`PGPASSWORD=browsertest psql -h 127.0.0.1 -U postgres -d svbrowser -Atc "${q}"`).toString().trim();
const post=(vid,i)=>execSync(`curl -s -m 20 -X POST http://127.0.0.1:8890/api/video-events -H 'content-type: application/json' -d '{"video":"${vid}","session":"cgov-session-00${i}-abcdef","viewer":"abcdef0123456789abcdef012345678${i}","events":[{"type":"page_open","seq":0},{"type":"play","seq":1,"t":0},{"type":"cta_click","seq":2,"clip":"c1"},{"type":"lead_submit","seq":3,"clip":"f1"}]}'`).toString();
(async()=>{
 const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1440,height:900},bypassCSP:true});
 await ctx.addInitScript((s)=>{sessionStorage.setItem('setup_popup_shown','1'); window.Clerk={loaded:true,user:{id:s},session:{getToken:async()=>'x'},addListener(){return()=>{}},load:async()=>{}};},'userA');
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e.message).slice(0,160)));
 await p.route('**/.netlify/functions/supabase-token',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({token:tokens.userA,expires_in:3600})}));
 await p.route('**/api/video-events',r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}));
 const mk=async(name)=>{ await p.getByTitle('New project').waitFor({timeout:120000}); await p.getByTitle('New project').click(); await p.locator('input').first().fill(name); await p.keyboard.press('Enter'); await p.waitForURL(/project=/,{timeout:60000}); await p.waitForTimeout(3500); };
 await p.goto('http://127.0.0.1:3100/#/timeline',{waitUntil:'domcontentloaded'});
 await mk('Roof promo');
 await p.locator('.top-nav button',{hasText:/^LEADS$/i}).first().click(); await p.getByTestId('publish-btn').waitFor(); await p.getByTestId('publish-btn').click(); await p.waitForTimeout(4000);
 const vid=sql(`select id from published_videos where project_id in (select id from timeline_projects where settings->>'source'='cinegen') order by created_at desc limit 1`);
 for (const i of [1,2,3,4]) post(vid,i);
 // second project, NOT published: Analytics tab should still show the overview
 await p.locator('.top-nav svg').first().click().catch(()=>{});
 await p.goto('http://127.0.0.1:3100/#/timeline',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(1500);
 await mk('Second video (unpublished)');
 await p.locator('.top-nav button',{hasText:/^ANALYTICS$/i}).first().click(); await p.waitForTimeout(5000);
 console.log('UNPUBLISHED TAB:', (await p.getByTestId('analytics-tab').innerText()).replace(/\n+/g,' | ').slice(0,420));
 await p.screenshot({path:__dirname+'/shots/cg-unpublished-overview.png'});
 // home overview
 await p.goto('http://127.0.0.1:3100/#/timeline',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(1500);
 await p.getByTestId('home-view-videos').waitFor({timeout:120000}); await p.getByTestId('home-view-videos').click(); await p.waitForTimeout(5000);
 console.log('HOME OVERVIEW:', (await p.getByTestId('published-overview').innerText()).replace(/\n+/g,' | ').slice(0,420));
 await p.screenshot({path:__dirname+'/shots/cg-home-overview.png'});
 await p.locator('[data-act="analytics"]').first().click().catch(()=>console.log('no analytics button')); await p.waitForTimeout(4000);
 console.log('CARD -> ANALYTICS:', (await p.getByTestId('published-overview').innerText()).replace(/\n+/g,' | ').slice(0,200));
 await p.screenshot({path:__dirname+'/shots/cg-home-card-analytics.png'});
 console.log('ERRS',JSON.stringify(errs.slice(0,5)));
 await b.close();
})();
