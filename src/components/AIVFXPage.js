import { mountStudioChrome } from '../lib/studioChrome.js';

// AI-VFX Studio Page
// Embeds the upstream SamurAIGPT/AI-VFX Next.js app as an iframe.
// The iframe src is the AI-VFX app URL. In dev, Vite proxies /ai-vfx
// to the Next.js dev server on port 3000. In production, the Next.js app
// is deployed as a separate Netlify site at ai-vfx.smartvid.app.

const AI_VFX_URL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? '/ai-vfx/'           // dev: Vite proxies to Next.js dev server
  : 'https://ai-vfx.smartvid.app/';  // prod: separate Netlify site

export function AIVFXPage() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col overflow-hidden bg-app-bg';
  mountStudioChrome(container, { currentRoute: 'ai-vfx' });

  const header = document.createElement('div');
  header.className = 'flex items-center justify-between p-4 border-b border-white/5 bg-black/50';
  header.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <path d="M12 2l2.39 6.95H22l-6.19 4.5L18.18 22 12 17.5 5.82 22l2.37-8.55L2 8.95h7.61L12 2z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </div>
      <div>
        <h1 class="text-xl font-black text-white">AI VFX STUDIO</h1>
        <p class="text-xs text-secondary">Visual effects & motion generation</p>
      </div>
    </div>
  `;
  container.appendChild(header);

  const iframe = document.createElement('iframe');
  iframe.src = AI_VFX_URL;
  iframe.style.cssText = 'flex:1;min-height:0;border:none;width:100%;background:#0b0f19;';
  iframe.setAttribute('allow', 'clipboard-write fullscreen');
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-same-origin');
  container.appendChild(iframe);

  return container;
}
