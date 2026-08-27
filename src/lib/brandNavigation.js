// src/lib/brandNavigation.js
// Brand Studio navigation helper that works both standalone and inside an iframe.

import { navigate as routerNavigate, getQueryParam } from './router.js';

const isIframe = getQueryParam('iframe') === 'true';

export function navigate(route, params = {}) {
  if (isIframe) {
    postMessage({ type: 'navigate-request', route, params });
  } else {
    routerNavigate(route, params);
  }
}

export function isIframeMode() {
  return isIframe;
}

function postMessage(data) {
  if (typeof window !== 'undefined' && window.parent !== window) {
    window.parent.postMessage({ source: 'brand-studio-iframe', ...data }, '*');
  }
}
