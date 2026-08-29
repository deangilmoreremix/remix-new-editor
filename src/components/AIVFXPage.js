import { mountStudioChrome } from '../lib/studioChrome.js';

// AI-VFX Studio Page
// Embeds the upstream SamurAIGPT/AI-VFX Next.js app as an iframe.
// In dev, requests to /ai-vfx/* are proxied by vite.config.js to the
// Next.js dev server at localhost:3000. In production, the Next.js app
// is built as a static export and served from the same host under /ai-vfx/.

const AI_VFX_URL = 'http://localhost:3000/';

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

  const loadingOverlay = document.createElement('div');
  loadingOverlay.className = 'flex-1 flex items-center justify-center bg-app-bg';
  loadingOverlay.innerHTML = `
    <div class="text-center">
      <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
      <p class="text-sm text-secondary">Loading AI VFX Studio...</p>
    </div>
  `;
  container.appendChild(loadingOverlay);

  const iframe = document.createElement('iframe');
  iframe.src = AI_VFX_URL;
  iframe.style.cssText = 'flex:1;min-height:0;border:none;width:100%;background:#0b0f19;position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;transition:opacity 0.3s ease-in;';
  iframe.setAttribute('allow', 'clipboard-write fullscreen');
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-same-origin');
  iframe.onload = () => {
    iframe.style.opacity = '1';
    loadingOverlay.remove();
  };
  container.appendChild(iframe);

  return container;
}
