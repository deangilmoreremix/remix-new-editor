// Warmbly Studio: cold email, warmup, unified inbox, CRM and automations.
//
// Hosts the vendored upstream Warmbly dashboard (apps/warmbly-web, built to public/warmbly-app/ by
// `npm run build:warmbly`) in a same-origin iframe. The dashboard runs on recorded demo data until a real
// Warmbly backend is configured (see apps/warmbly-web/UPSTREAM.md). When the build is missing (a dev checkout
// that has not run build:warmbly) the earlier in-repo React studio (apps/warmbly-studio) is shown instead.
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

const APP_BASE = '/warmbly-app';
// Studio deep links (#/warmbly/<view>) → dashboard routes.
const VIEW_ROUTES = {
  dashboard: '/app/analytics', campaigns: '/app/campaigns', inbox: '/app/unibox', contacts: '/app/contacts',
  pipeline: '/app/crm/deals', mailboxes: '/app/emails', deliverability: '/app/deliverability',
  automations: '/app/automations', integrations: '/app/integrations', settings: '/app/settings/profile',
};

async function dashboardIsBuilt() {
  try {
    const res = await fetch(`${APP_BASE}/index.html`, { cache: 'no-store' });
    if (!res.ok) return false;
    // A dev server answers unknown paths with the host's own index.html, so check it is the dashboard's.
    return (await res.text()).includes(`${APP_BASE}/assets/`);
  } catch {
    return false;
  }
}

export function WarmblyStudio() {
  const container = document.createElement('div');
  Object.assign(container.style, { width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' });
  // Pin to the viewport below the header (the app shell grows with the sidebar).
  const fit = () => {
    const header = document.querySelector('#app > header, header');
    const top = header ? Math.round(header.getBoundingClientRect().height) : 56;
    container.style.height = `calc(100dvh - ${top}px)`;
    container.style.position = 'sticky';
    container.style.top = `${top}px`;
  };
  fit();
  requestAnimationFrame(fit);
  window.addEventListener('resize', fit);

  const host = document.createElement('div');
  Object.assign(host.style, { position: 'relative', flex: '1 1 0%', minHeight: '0', height: '100%' });
  container.appendChild(host);

  let root = null;
  let disposed = false;
  const view = (window.location.hash.match(/#\/warmbly\/([\w-]+)/) || [])[1];

  dashboardIsBuilt().then(async (built) => {
    if (disposed) return;
    if (built) {
      const iframe = document.createElement('iframe');
      iframe.src = `${APP_BASE}${VIEW_ROUTES[view] || '/app/emails'}`;
      iframe.title = 'Warmbly Studio';
      Object.assign(iframe.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', border: '0', background: '#fff' });
      iframe.setAttribute('allow', 'clipboard-read; clipboard-write; fullscreen');
      host.appendChild(iframe);
      return;
    }
    try {
      const { WarmblyStudio: Studio } = await import('@smartvideo/warmbly-studio');
      if (disposed) return;
      host.style.padding = '12px';
      root = createRoot(host);
      root.render(createElement(Studio, {
        initialView: view,
        onNavigate: (v) => { try { window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/warmbly/${v}`); } catch { /* ignore */ } },
      }));
    } catch (e) {
      host.textContent = `Could not load Warmbly Studio: ${e?.message || e}. Run \`npm run build:warmbly\`.`;
    }
  });

  container.cleanup = () => {
    disposed = true;
    window.removeEventListener('resize', fit);
    try { root?.unmount(); } catch { /* ignore */ }
  };
  return container;
}

export default WarmblyStudio;
