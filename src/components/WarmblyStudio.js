// Warmbly Studio: the standalone Warmbly app (warmbly/web, built to /warmbly-app/ by `npm run build:warmbly`)
// shown in an iframe that fills the content area, like Website Builder (OpenThornStudio.js).
// It is served from this app's own origin in dev and production (Warmbly's dev server forbids framing, so run
// `npm run build:warmbly` first). Override the address with VITE_WARMBLY_URL.
// It signs in with the same Clerk session as this app (same origin), so it has no sign-in page of its own.

const WARMBLY_PATH = '/warmbly-app/';

export function WarmblyStudio() {
  const url = import.meta.env?.VITE_WARMBLY_URL || WARMBLY_PATH;
  const el = document.createElement('div');
  el.id = 'warmbly-studio-page';
  el.style.cssText = 'position:absolute;inset:0;background:#050505;display:flex;flex-direction:column;';
  const frame = document.createElement('iframe');
  frame.title = 'Warmbly Studio';
  frame.src = url;
  frame.allow = 'clipboard-read; clipboard-write; fullscreen';
  frame.style.cssText = 'flex:1;width:100%;height:100%;border:0;background:#050505;display:block;';
  el.appendChild(frame);
  return el;
}
