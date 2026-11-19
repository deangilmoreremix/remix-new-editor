/* global document, navigator, OffscreenCanvas, console */
// Stage 6 spike: does this Chromium expose the HTML-in-canvas API (drawElementImage / captureElementImage) that @gl-transitions/remotion needs via makeHtmlInCanvasPresentation? Result recorded in docs/stage-6/STAGE_6_REPORT.md.
const { chromium } = require('playwright-core');
(async()=>{
 for (const args of [[],['--enable-features=CanvasDrawElement','--enable-blink-features=CanvasDrawElement']]) {
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',...args]});
  const pg = await b.newPage();
  const r = await pg.evaluate(()=>{ const c=document.createElement('canvas'); const x=c.getContext('2d'); const oc=new OffscreenCanvas(4,4);
   return {ua:navigator.userAgent, drawElementImage: typeof x.drawElementImage, requestPaint: typeof c.requestPaint, captureElementImage: typeof c.captureElementImage, webgl2: !!document.createElement('canvas').getContext('webgl2'), offscreenWebgl2: !!oc.getContext('webgl2'), videoDecoder: typeof VideoDecoder, videoEncoder: typeof VideoEncoder}; });
  console.log(JSON.stringify(args), JSON.stringify(r)); await b.close(); }
})();
