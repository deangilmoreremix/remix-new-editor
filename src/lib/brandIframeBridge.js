// src/lib/brandIframeBridge.js
// Parent ↔ Brand Studio iframe communication contract.
// - iframe listens for: init, select-brand, navigate
// - iframe emits: ready, save, error, navigate-request

const ORIGIN_WHITELIST = [window.location.origin];

function postMessage(data) {
  if (typeof window !== 'undefined' && window.parent !== window) {
    window.parent.postMessage({ source: 'brand-studio-iframe', ...data }, '*');
  }
}

function listen(callback) {
  if (typeof window === 'undefined') return () => {};
  const handler = (event) => {
    if (!event.data || event.data.source !== 'brand-studio-parent') return;
    callback(event.data);
  };
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}

export function initBrandIframeBridge(getBrands, getCampaigns, onNavigate) {
  const stop = listen((msg) => {
    switch (msg.type) {
      case 'init':
        postMessage({
          type: 'ready',
          brands: getBrands(),
          campaigns: getCampaigns(),
          user: msg.user || null,
        });
        break;
      case 'select-brand':
        if (onNavigate) onNavigate('brand-dna', { id: msg.brandId });
        break;
      case 'navigate':
        if (onNavigate) onNavigate(msg.route, msg.params || {});
        break;
      default:
        break;
    }
  });

  return {
    emitSave(payload) {
      postMessage({ type: 'save', payload });
    },
    emitError(error) {
      postMessage({ type: 'error', error: String(error) });
    },
    emitNavigateRequest(route, params = {}) {
      postMessage({ type: 'navigate-request', route, params });
    },
    destroy() {
      stop();
    },
  };
}
