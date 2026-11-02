// Smart Website Builder Studio — embedded iframe wrapper for the Website Builder app
// (the apps/openthorn sub-app). It always opens on the builder Dashboard.
// In dev, this points at a separate Vite dev server on :5173.
// In production, it loads the static build from /openthorn/.

const isDev = import.meta.env.DEV;
const OPENTHORN_DEV_URL = 'http://localhost:5173/dashboard';
const OPENTHORN_PROD_PATH = '/openthorn/dashboard';

export function OpenThornStudio() {
  const container = document.createElement('div');
  container.style.cssText = 'width:100%;height:100%;display:flex;flex-direction:column;background:#050505;';

  const header = document.createElement('div');
  header.style.cssText = `
    display:flex;align-items:center;justify-content:space-between;
    padding:10px 16px;background:#050505;border-bottom:1px solid #27272a;
    flex-shrink:0;
  `;
  header.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="width:8px;height:8px;border-radius:50%;background:#d9ff00;box-shadow:0 0 8px rgba(217,255,0,0.45);"></span>
      <span style="color:#fff;font-weight:600;font-size:14px;font-family:Inter,system-ui,sans-serif;">Smart Website Builder</span>
      <span style="color:#a1a1aa;font-size:12px;font-family:Inter,system-ui,sans-serif;">Bring your own AI key</span>
    </div>
  `;
  container.appendChild(header);

  const iframe = document.createElement('iframe');
  iframe.src = isDev ? OPENTHORN_DEV_URL : OPENTHORN_PROD_PATH;
  iframe.style.cssText = `
    flex:1;width:100%;border:none;background:#050505;
    display:block;
  `;
  iframe.setAttribute('loading', 'lazy');
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals');
  iframe.setAttribute('title', 'Smart Website Builder');
  container.appendChild(iframe);

  return container;
}
