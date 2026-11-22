// Capture real, un-mocked app screens at 1920x1080 (dark). No API key, no generation.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const SHOTS = [
 ['02-apps-hub','apps'],['03-model-picker','video'],['04-image-studio','image'],['05-cinema-studio','cinema'],
 ['05b-director','director'],['06-storyboard','storyboard'],['07-edit-tools','edit'],['07b-upscale','upscale'],
 ['08-character','character'],['08b-influencer','influencer'],['09-avatar','avatar'],['09b-lipsync','lipsync'],
 ['10-ai-vfx','ai-vfx'],['10b-effects','effects'],['11-timeline','timeline'],['11b-render','render'],
 ['12-templates','templates'],['12b-commercial','commercial'],['13-video-agent','video-agent'],['14-chat','chat'],
 ['14b-assist','assist'],['15-library','library'],['15b-community','community'],['15c-stock','pexels-media'],
 ['01-video-studio','video'],['16-agency','campaign'],
];
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 const ctx=await b.newContext({viewport:{width:1920,height:1080},colorScheme:'dark'});
 await ctx.addInitScript(()=>{try{sessionStorage.setItem('setup_popup_shown','1')}catch{}});
 const report=[];
 for (const [name,route] of SHOTS){
  const p=await ctx.newPage(); const errs=[];
  p.on('pageerror',e=>errs.push(e.message));
  const dir=path.join(__dirname,'captures',name); fs.mkdirSync(dir,{recursive:true});
  try{
   await p.goto(`http://127.0.0.1:3100/#/${route}`,{waitUntil:'domcontentloaded',timeout:60000});
   await p.waitForTimeout(6000);
   const text=(await p.innerText('body')).replace(/\s+/g,' ');
   await p.screenshot({path:path.join(dir,'frame.png')});
   report.push({name,route,len:text.length,errs,modal:!!(await p.$('[data-auth-modal]'))||/set up your API keys/i.test(text),snippet:text.slice(0,140)});
  }catch(e){report.push({name,route,fail:String(e).slice(0,120)})}
  await p.close();
 }
 fs.writeFileSync(path.join(__dirname,'capture-survey.json'),JSON.stringify(report,null,1));
 console.log(report.map(r=>`${r.name}\t${r.fail||('len='+r.len+' modal='+r.modal+' errs='+r.errs.length)}`).join('\n'));
 await b.close();
})();
