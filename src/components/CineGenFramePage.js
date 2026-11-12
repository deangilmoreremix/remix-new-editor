// #/timeline: the unmodified CineGen web app (apps/cinegen/web) shown in an iframe that fills the content area.
// Address: VITE_CINEGEN_URL (the CINEGEN_URL setting; only VITE_-prefixed variables reach browser code), falling back to
// VITE_CINEGEN_WEB_URL, then http://localhost:5174 in dev. src/cinegen is no longer mounted from this route.
export function CineGenFramePage() {
  const env = (import.meta.env || {});
  const url = env.VITE_CINEGEN_URL || env.VITE_CINEGEN_WEB_URL || (env.DEV ? 'http://localhost:5174' : '');
  const el = document.createElement('div');
  el.id = 'cinegen-frame-page';
  el.style.cssText = 'position:absolute;inset:0;background:#05070b;display:flex;flex-direction:column;';
  if (!url) {
    el.innerHTML = '<div style="margin:auto;max-width:520px;padding:24px;color:#cbd5e1;font:14px system-ui;text-align:center"><strong>CineGen server not configured.</strong><br>Set VITE_CINEGEN_URL to the address where apps/cinegen/web is hosted.</div>';
    return el;
  }
  const frame = document.createElement('iframe');
  frame.title = 'CineGen';
  frame.src = url;
  frame.allow = 'autoplay; fullscreen; clipboard-read; clipboard-write; microphone; camera; display-capture';
  frame.style.cssText = 'flex:1;width:100%;height:100%;border:0;background:#05070b;';
  el.appendChild(frame);
  return el;
}
