const { chromium } = require('/opt/node-tools/node_modules/playwright'); const path=require('path'), fs=require('fs');
const root=process.argv[2]; const url='file://'+path.join(root,'index.html');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required','--allow-file-access-from-files']});
 for (const rm of ['no-preference','reduce']){
  const p=await (await b.newContext({viewport:{width:1440,height:900},reducedMotion:rm})).newPage(); const bad=[],errs=[];
  p.on('requestfailed',r=>bad.push(r.url().split('/').slice(-2).join('/'))); p.on('pageerror',e=>errs.push(e.message));
  await p.goto(url); await p.waitForTimeout(1500);
  await p.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=700){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,120));}}); await p.waitForTimeout(1500);
  const r=await p.evaluate(()=>({videos:document.querySelectorAll('video').length,imgs:document.querySelectorAll('img').length,posterOK:[...document.querySelectorAll('video[poster]')].length}));
  // every poster URL must exist on disk
  const missing=await p.evaluate(()=>[...document.querySelectorAll('video')].map(v=>v.getAttribute('poster')));
  const gone=missing.filter(m=>!fs.existsSync(path.join(root,m)));
  console.log(`reducedMotion=${rm}: videos=${r.videos} images=${r.imgs} failedRequests=${bad.filter(x=>!/\.mp4$/.test(x)).length} (mp4 requests failing only because this Chromium has no H.264: ${bad.filter(x=>/\.mp4$/.test(x)).length}) pageErrors=${errs.length} missingPosters=${gone.length}`);
 }
 // WebM hero actually plays
 const p2=await (await b.newContext()).newPage(); await p2.goto('file://'+path.join(root,'landing/a-hero-loop.webm')); await p2.waitForTimeout(2500);
 console.log('hero.webm plays in Chromium:',JSON.stringify(await p2.evaluate(()=>{const v=document.querySelector('video');return {paused:v.paused,t:+v.currentTime.toFixed(2),w:v.videoWidth,h:v.videoHeight,err:v.error&&v.error.code}})));
 await b.close();
})();
