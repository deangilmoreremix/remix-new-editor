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
      if (response.ok) {
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
      if (response.ok) cache.put(request, response.clone());
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
        if (response.ok) cache.put(request, response.clone());
      }).catch(() => {});
      return cached;
    }
    const response = await fetch(request).then((res) => {
      if (res.ok) {
        cache.put(request, res.clone());
      }
      return res;
    }).catch(() => new Response('Asset unavailable offline', { status: 503 }));
    return response;
  }

  // ── Everything else: network-first, fallback to cache ──────────────────────
  try {
    const response = await fetch(request);
    if (response.ok) {
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
            if (res.ok) {
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
