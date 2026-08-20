import { mountStudioChrome } from '../lib/studioChrome.js';
import { getAssetsForStudio } from '../data/exampleGalleryAssets.js';
import ExampleGallery from './studios/ExampleGallery.js';
// AI-VFX Studio Page
// Embeds the ai-vfx studio as an iframe. The iframe src is always '/ai-vfx/'
// (same-origin). In dev, Vite proxies this path to the AI-VFX dev server on
// port 3002 via server.proxy in vite.config.js. In production, the built files
// are served from the /ai-vfx/ directory inside the main app's dist folder.

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
  // Always load from '/ai-vfx/' (same-origin). In dev, Vite proxies this path to
  // the AI-VFX dev server on port 3002 via the server.proxy config in vite.config.js.
  iframe.src = '/ai-vfx/';
  iframe.style.cssText = 'flex:1;min-height:0;border:none;width:100%;background:#0b0f19;';
  iframe.setAttribute('allow', 'clipboard-write');
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
  container.appendChild(iframe);

    const galleryAssets = getAssetsForStudio('ai-vfx');
    if (galleryAssets.length > 0) {
      const gallery = ExampleGallery({ studioId: 'ai-vfx', assets: galleryAssets, maxCards: 20 });
      container.appendChild(gallery);
    }

    return container;
}
