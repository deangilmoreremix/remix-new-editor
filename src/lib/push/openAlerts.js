import { routeHash } from '../routeUrl.js';
/**
 * Page side of a notification click. The service worker cannot touch sessionStorage, so it either
 * posts { type: 'remix:open-alerts' } to an open window or opens `/timeline?alerts=1`. Both end up doing
 * exactly what the header bell does: leave the `remix_open_projects` flag and open the Timeline Editor
 * (or tell it to show the alerts when it is already open).
 */
const OPEN_FLAG = 'remix_open_projects';

export function openAlerts({ win = globalThis } = {}) {
  try { win.sessionStorage.setItem(OPEN_FLAG, '1'); } catch { /* the event below still works on the editor page */ }
  const hash = routeHash(win.location);
  if (/^#\/timeline(?![-\w])|^#\/timeline-classic/.test(hash)) {
    if (/^#\/timeline-classic/.test(hash)) { try { win.sessionStorage.removeItem(OPEN_FLAG); } catch { /* ignore */ } }
    win.dispatchEvent(new CustomEvent('remix:open-projects'));
  } else if (win.location) {
    // the editor's Analytics tab reads the flag on mount
    if (typeof win.navigate === 'function') win.navigate('timeline');
    else win.location.assign?.('/timeline');
  }
}

/** Listens for the service worker's message; returns a disposer. */
export function installPushMessageListener({ win = globalThis } = {}) {
  const sw = win.navigator?.serviceWorker;
  if (!sw?.addEventListener) return () => {};
  const onMessage = (event) => { if (event?.data?.type === 'remix:open-alerts') openAlerts({ win }); };
  sw.addEventListener('message', onMessage);
  return () => sw.removeEventListener('message', onMessage);
}

/** Cold start from a notification: `?alerts=1` is removed from the address bar and turned into the same action. */
export function consumeAlertsMarker({ win = globalThis } = {}) {
  try {
    const url = new URL(win.location.href);
    if (url.searchParams.get('alerts') !== '1') return false;
    url.searchParams.delete('alerts');
    win.history?.replaceState?.(null, '', url.pathname + url.search + url.hash);
    openAlerts({ win });
    return true;
  } catch { return false; }
}
