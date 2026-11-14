/*
 * Owner push notifications (Stage 11). A separate worker from /sw.js (the offline cache) on purpose: its own scope (/push/), so
 * registering it never replaces the caching worker. It does exactly two things: show a notification when a push arrives, and open the
 * app when the notification is clicked. It never fetches, caches or runs anything from the message.
 *
 * Browsers require every push to show a notification (userVisibleOnly), so an unreadable message still shows a generic one.
 */
const DEFAULT_TITLE = 'SmartVideo';
const clip = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, n) : '');

function readMessage(event) {
  try {
    const d = event.data && event.data.json();
    return d && typeof d === 'object' && !Array.isArray(d) ? d : {};
  } catch (_) {
    try { return { body: event.data.text() }; } catch (__) { return {}; }
  }
}
/** Only a path inside this site: a message can never send the owner to another site. */
function safeTarget(u) {
  try {
    const url = new URL(typeof u === 'string' ? u : '/', self.location.origin);
    return url.origin === self.location.origin ? `${url.pathname}${url.search}${url.hash}` : '/';
  } catch (_) { return '/'; }
}

self.addEventListener('push', (event) => {
  const d = readMessage(event);
  const options = { body: clip(d.body, 200), data: { url: safeTarget(d.url) } };
  const tag = clip(d.tag, 60); if (tag) options.tag = tag;
  event.waitUntil(self.registration.showNotification(clip(d.title, 80) || DEFAULT_TITLE, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(safeTarget(event.notification && event.notification.data && event.notification.data.url), self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        try { if (new URL(w.url).origin === self.location.origin && 'focus' in w) return w.focus().then((c) => (c && 'navigate' in c ? c.navigate(target) : c)); } catch (_) { /* next */ }
      }
      return self.clients.openWindow(target);
    }),
  );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
