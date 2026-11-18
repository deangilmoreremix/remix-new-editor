// Outreach Studio: the standalone Warmbly app (warmbly/web, built to /outreach-app/ by `npm run build:outreach`)
// shown in an iframe that fills the content area, like Website Builder (OpenThornStudio.js).
// Dev: run `pnpm exec vite --port 5180` in warmbly/web (VITE_API_URL points at the Warmbly API).
// It signs in with the same Clerk session as this app (same origin), so it has no sign-in page of its own.

const isDev = import.meta.env.DEV;
const OUTREACH_DEV_URL = 'http://localhost:5180/';
const OUTREACH_PROD_PATH = '/outreach-app/';

export function OutreachStudio() {
  const el = document.createElement('div');
  el.id = 'outreach-studio-page';
  el.style.cssText = 'position:absolute;inset:0;background:#050505;display:flex;flex-direction:column;';
  const frame = document.createElement('iframe');
  frame.title = 'Outreach Studio';
  frame.src = isDev ? OUTREACH_DEV_URL : OUTREACH_PROD_PATH;
  frame.allow = 'clipboard-read; clipboard-write; fullscreen';
  frame.style.cssText = 'flex:1;width:100%;height:100%;border:0;background:#050505;display:block;';
  el.appendChild(frame);
  return el;
}
