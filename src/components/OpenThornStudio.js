// OpenThorn Studio — embedded iframe wrapper for the OpenThorn app.
// In dev, this points at a separate Vite dev server on :5173.
// In production, it loads the static build from /openthorn/.

const isDev = import.meta.env.DEV;
const OPENTHORN_DEV_URL = 'http://localhost:5173';
const OPENTHORN_PROD_PATH = '/openthorn/';

export function OpenThornStudio() {
  const container = document.createElement('div');
  container.style.cssText = 'width:100%;height:100%;display:flex;flex-direction:column;';

  const header = document.createElement('div');
  header.style.cssText = `
    display:flex;align-items:center;justify-content:space-between;
    padding:10px 16px;background:#0a0d16;border-bottom:1px solid rgba(255,255,255,0.06);
    flex-shrink:0;
  `;
  header.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="width:10px;height:10px;border-radius:50%;background:#10b981;box-shadow:0 0 8px #10b98188;"></span>
      <span style="color:#fff;font-weight:600;font-size:14px;font-family:system-ui,sans-serif;">OpenThorn</span>
      <span style="color:#6b7280;font-size:12px;font-family:system-ui,sans-serif;">BYOK AI Website Builder</span>
    </div>
    <a href="https://github.com/deangilmoraremix/OpenThorn" target="_blank" rel="noopener noreferrer"
       style="color:#9ca3af;font-size:12px;text-decoration:none;font-family:system-ui,sans-serif;">
      View on GitHub ↗
    </a>
  `;
  container.appendChild(header);

  const iframe = document.createElement('iframe');
  iframe.src = isDev ? OPENTHORN_DEV_URL : OPENTHORN_PROD_PATH;
  iframe.style.cssText = `
    flex:1;width:100%;border:none;background:#020205;
    display:block;
  `;
  iframe.setAttribute('loading', 'lazy');
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals');
  iframe.setAttribute('title', 'OpenThorn Studio');
  container.appendChild(iframe);

  return container;
}

