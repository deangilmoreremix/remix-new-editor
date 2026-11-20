/**
 * Service Worker for Smart Video Academy — Offline Caching
 *
 * Strategies:
 *  - cache-first for media assets (images, gifs, videos, audio)
 *  - stale-while-revalidate for markdown (lessons + templates)
 *  - network-first for everything else
 *
 * Offline mode is surfaced via postMessage to the UI.
 */

const CACHE_ACADEMY = 'academy-v1';
const CACHE_ASSETS  = 'academy-assets-v1';

const ACADEMY_MARKDOWN_PATTERNS = [
  '/academy/*/raw/lessons/*.md',
  '/academy/*/raw/templates/*.md',
];

function isMarkdownAsset(req) {
  const url = new URL(req.url);
  return (
    url.pathname.includes('/academy/') &&
    (url.pathname.endsWith('.md') || url.pathname.match(/\/raw\/(lessons|templates)\//))
  );
}

function isMediaAsset(req) {
  const url = new URL(req.url);
  const path = url.pathname;
  return (
    path.match(/\.(jpg|jpeg|png|webp|gif|mp4|webm|mp3|wav|ogg)(\?.*)?$/i) &&
    (
      path.includes('/images/') ||
      path.includes('/gifs/') ||
      path.includes('/videos/') ||
      path.includes('/audio/') ||
      path.includes('/media/') ||
      path.includes('/academy/')
    )
  );
}

// The Cache API's cache.put() rejects any response whose status is 206
// (Partial Content) — a TypeError that is unsupported by the spec.
// response.ok is true for 206 (it's in the 200–299 range), so we must
// explicitly exclude it. We also exclude opaque responses (status 0)
// from being written since they provide no useful cached body and can
// mask network failures. See: https://developer.mozilla.org/en-US/docs/Web/API/Cache/put#exceptions
function isCacheableResponse(response) {
  return response.ok && response.status !== 206 && response.status !== 0;
}

// ── Install: pre-cache the app shell ─────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_ACADEMY).then((cache) => cache.addAll([
      '/',
      '/index.html',
      '/manifest.json',
    ])).then(() => self.skipWaiting())
  );
});

// ── Activate: prune old caches ────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const VALID = new Set([CACHE_ACADEMY, CACHE_ASSETS]);
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => !VALID.has(n))
          .map((n) => { console.log('[SW] Deleting old cache:', n); return caches.delete(n); })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests (allow CDN/supabase to pass through)
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) {
    if (!url.hostname.includes('cdn') && !url.hostname.includes('supabase')) return;
  }

  event.respondWith(handleRequest(request));
});

async function handleRequest(request) {
  const url = new URL(request.url);

  // ── Navigation / app shell ──────────────────────────────────────────────────
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    try {
      const response = await fetch(request);
      if (isCacheableResponse(response)) {
        const cache = await caches.open(CACHE_ACADEMY);
        cache.put(request, response.clone());
      }
      return response;
    } catch {
      return caches.match('/index.html').then((cached) => cached || new Response('Offline', { status: 503 }));
    }
  }

  // ── Markdown: stale-while-revalidate ───────────────────────────────────────
  if (isMarkdownAsset(request)) {
    const cache = await caches.open(CACHE_ACADEMY);
    const cached = await cache.match(request);

    const networkPromise = fetch(request).then((response) => {
      if (isCacheableResponse(response)) cache.put(request, response.clone());
      return response;
    }).catch(() => cached);

    // Return cached immediately, update in background
    if (cached) {
      networkPromise.catch(() => {});
      return cached;
    }
    return networkPromise;
  }

  // ── Media assets: cache-first ──────────────────────────────────────────────
  if (isMediaAsset(request)) {
    const cache = await caches.open(CACHE_ASSETS);
    const cached = await cache.match(request);
    if (cached) {
      // Revalidate in background
      fetch(request).then((response) => {
        if (isCacheableResponse(response)) cache.put(request, response.clone());
      }).catch(() => {});
      return cached;
    }
    const response = await fetch(request).then((res) => {
      if (isCacheableResponse(res)) {
        cache.put(request, res.clone());
      }
      return res;
    }).catch(() => new Response('Asset unavailable offline', { status: 503 }));
    return response;
  }

  // ── Everything else: network-first, fallback to cache ──────────────────────
  try {
    const response = await fetch(request);
    if (isCacheableResponse(response)) {
      const cache = await caches.open(CACHE_ACADEMY);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return caches.match(request).then((cached) => cached || new Response('Offline', { status: 503 }));
  }
}

// ── Background Sync: update academy cache when back online ────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'CACHE_ACADEMY_URLS') {
    const { urls } = event.data;
    event.waitUntil(
      Promise.all(
        urls.map((u) =>
          fetch(u).then((res) => {
            if (isCacheableResponse(res)) {
              const cache = caches.open(CACHE_ACADEMY);
              return cache.then((c) => c.put(u, res.clone()));
            }
            return null;
          }).catch(() => null)
        )
      )
    );
  }
});

// ── Web Push ──────────────────────────────────────────────────────────────────
// The pure helpers between the markers below are evaluated verbatim by
// src/lib/push/__tests__/swPush.test.js (it extracts this region from sw.js), so
// the tested code and the shipped code cannot drift apart. Keep them free of
// `self`/`event` access: only the handlers underneath touch the worker globals.
// <push-logic>
const PUSH_DEFAULT_URL = '/#/timeline';
const PUSH_ICON = '/favicon.webp';

// Tolerates empty, non-JSON and non-object payloads; every field is optional.
function parsePushPayload(raw) {
  let data = null;
  try {
    if (raw && typeof raw === 'object') data = raw;
    else if (typeof raw === 'string' && raw.trim()) data = JSON.parse(raw);
  } catch { data = null; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
  const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
  return {
    title: str(data.title, 120) || 'SmartVideo',
    body: str(data.body, 300),
    tag: str(data.tag, 80) || 'smartvideo-alert',
    type: str(data.type, 40),
    notificationId: str(data.notificationId, 80),
    videoId: str(data.videoId, 80),
    url: str(data.url, 300),
  };
}

// Only same-origin paths are followed; anything else falls back to the alerts view.
function resolvePushUrl(url) {
  if (typeof url !== 'string' || url[0] !== '/' || url[1] === '/' || url[1] === '\\') return PUSH_DEFAULT_URL;
  return url;
}

function buildNotificationOptions(p) {
  return {
    body: p.body,
    tag: p.tag,
    icon: PUSH_ICON,
    badge: PUSH_ICON,
    requireInteraction: false,
    data: { url: resolvePushUrl(p.url), type: p.type, notificationId: p.notificationId, videoId: p.videoId },
  };
}

// With no window open the page is opened with ?alerts=1, which the page turns into the same
// "open my alerts" action the header bell performs (a service worker cannot touch sessionStorage).
function coldOpenUrl(url) {
  const safe = resolvePushUrl(url);
  const i = safe.indexOf('#');
  const path = i === -1 ? safe : safe.slice(0, i);
  const hash = i === -1 ? '' : safe.slice(i);
  return path + (path.includes('?') ? '&' : '?') + 'alerts=1' + hash;
}

// Prefer a focused/visible window, otherwise any window of this origin.
function pickAppWindow(windows, origin) {
  const own = (windows || []).filter((w) => { try { return new URL(w.url).origin === origin; } catch { return false; } });
  return own.find((w) => w.focused) || own.find((w) => w.visibilityState === 'visible') || own[0] || null;
}
// </push-logic>

self.addEventListener('push', (event) => {
  let raw = null;
  try { raw = event.data ? event.data.text() : null; } catch { raw = null; }
  const p = parsePushPayload(raw);
  event.waitUntil(self.registration.showNotification(p.title, buildNotificationOptions(p)));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = pickAppWindow(windows, self.location.origin);
    if (win) {
      try { win.postMessage({ type: 'remix:open-alerts', notificationId: data.notificationId || '', videoId: data.videoId || '' }); } catch { /* window went away */ }
      if (typeof win.focus === 'function') { try { await win.focus(); } catch { /* focus can be refused */ } }
      return undefined;
    }
    return self.clients.openWindow ? self.clients.openWindow(coldOpenUrl(data.url)) : undefined;
  })());
});
