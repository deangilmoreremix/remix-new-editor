// Warmbly Studio: cold email, warmup, unified inbox, CRM and automations.
//
// The studio UI lives in apps/warmbly-studio (React) and talks to a WarmblyAdapter. It runs on the
// built-in local sandbox adapter until the Warmbly backend is connected; swap in a remote adapter
// here (createRemoteAdapter) and nothing else changes.
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

export function WarmblyStudio() {
  const container = document.createElement('div');
  container.className = 'w-full flex flex-col overflow-hidden bg-app-bg';
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
  host.className = 'relative flex-1 min-h-0 p-3';
  host.style.height = '100%';
  container.appendChild(host);

  let root = null;
  let disposed = false;
  // Lazy-load the studio so it stays out of the main bundle.
  import('@smartvideo/warmbly-studio').then(({ WarmblyStudio: Studio }) => {
    if (disposed) return;
    const initial = (window.location.hash.match(/#\/warmbly\/([\w-]+)/) || [])[1];
    root = createRoot(host);
    root.render(createElement(Studio, {
      initialView: initial,
      onNavigate: (view) => { try { window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/warmbly/${view}`); } catch { /* ignore */ } },
    }));
  }).catch((e) => {
    host.textContent = `Could not load Warmbly Studio: ${e?.message || e}`;
  });

  container.cleanup = () => {
    disposed = true;
    window.removeEventListener('resize', fit);
    try { root?.unmount(); } catch { /* ignore */ }
  };
  return container;
}

export default WarmblyStudio;
