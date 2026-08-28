// src/components/ControlCenterPage.js
// Embeds the standalone Control Center Next.js app in an iframe.
// Control Center must run as its own service (see README integration notes).
import { mountStudioChrome } from '../lib/studioChrome.js';

const CONTROL_CENTER_DEV = 'http://localhost:3101';
const CONTROL_CENTER_PROD = 'https://control-center.smartvid.app'; // update after deploy

export function ControlCenterPage() {
  const url = import.meta.env.PROD ? CONTROL_CENTER_PROD : CONTROL_CENTER_DEV;

  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col overflow-hidden bg-app-bg';

  mountStudioChrome(container, { currentRoute: 'control-center' });

  const header = document.createElement('div');
  header.className = 'flex items-center justify-between p-4 border-b border-white/5 bg-black/50 shrink-0';
  header.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
      </div>
      <div>
        <h1 class="text-xl font-black text-white">CONTROL CENTER</h1>
        <p class="text-xs text-secondary">Business intelligence dashboard • Local-first</p>
      </div>
    </div>
  `;
  container.appendChild(header);

  const iframe = document.createElement('iframe');
  iframe.src = url;
  iframe.style.cssText = 'flex:1;min-height:0;border:none;width:100%;background:#0b0f19;';
  iframe.setAttribute('allow', 'clipboard-write fullscreen');
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
  iframe.setAttribute('title', 'Control Center');
  iframe.srcdoc = `
    <html>
      <body style="margin:0;background:#0b0f19;color:rgba(255,255,255,0.7);font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;padding:24px;">
        <div style="text-align:center;max-width:420px;">
          <h2 style="margin:0 0 8px;font-size:18px;color:#fff;">Control Center</h2>
          <p style="margin:0 0 16px;font-size:13px;line-height:1.5;">
            This studio loads a separate local service at <strong>${url}</strong>.
          </p>
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.45);">
            Start it with:<br>
             <code style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;">cd apps/control-center && PORT=3101 npm run dev</code>
          </p>
        </div>
      </body>
    </html>
  `;
  container.appendChild(iframe);

  // Attempt to load the real app; if it fails, the browser keeps the srcdoc fallback.
  // We do not touch SmartVideo state here.
  iframe.addEventListener('load', () => {
    // Once the real app responds, the iframe navigates away from srcdoc automatically.
  });

  return container;
}
