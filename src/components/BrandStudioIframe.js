// src/components/BrandStudioIframe.js
// Hosts Brand Studio inside smartvid.app as an iframe, using the same build.
// The iframe loads the app's own /brand route with ?iframe=true so it can
// detect embedded mode and skip its own chrome.

import { mountStudioChrome } from '../lib/studioChrome.js';
import { navigate } from '../lib/router.js';

const BRAND_STUDIO_IFRAME_URL = '/brand?iframe=true';

export function BrandStudioIframe() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col overflow-hidden bg-app-bg';
  mountStudioChrome(container, { currentRoute: 'brand', title: 'Brand Studio' });

  const iframe = document.createElement('iframe');
  iframe.src = BRAND_STUDIO_IFRAME_URL;
  iframe.style.cssText = 'flex:1;min-height:0;border:none;width:100%;background:#0b0f19;';
  iframe.setAttribute('allow', 'clipboard-write fullscreen');
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups-to-escape-same-origin');
  container.appendChild(iframe);

  const handleMessage = (event) => {
    if (!event.data || event.data.source !== 'brand-studio-iframe') return;
    
    switch (event.data.type) {
      case 'navigate-request':
        if (event.data.route) {
          navigate(event.data.route, event.data.params || {});
        }
        break;
      case 'save':
        // Handle save from iframe if needed
        console.log('[BrandStudioIframe] Save requested:', event.data.payload);
        break;
      case 'error':
        console.error('[BrandStudioIframe] iframe error:', event.data.error);
        break;
      default:
        break;
    }
  };

  window.addEventListener('message', handleMessage);

  container.cleanup = () => {
    window.removeEventListener('message', handleMessage);
    iframe.src = 'about:blank';
  };

  return container;
}
