// Single source of truth for reading and building the app's page URLs.
//
// The app is moving from hash routes (`/#/cinema-template`, `/?template=x#/image`) to clean
// paths (`/cinema-template`, `/image?template=x`). Until every writer is switched, and for the
// bookmarks, emails and push notifications already out there, readers must understand both.
//
// Dependency-free on purpose: main.js imports this before anything else loads (the public
// watch pages skip the rest of the app).

const stripSlashes = (s) => s.replace(/^\/+|\/+$/g, '');

/**
 * What page a location points at, whichever URL form it uses.
 *
 *   /cinema-template            → { page: 'cinema-template' }
 *   /?a=1#/image                → { page: 'image', params: { a: '1' }, legacy: true }
 *   /#/edit?asset=7             → { page: 'edit', params: { asset: '7' }, legacy: true }
 *   /watch/abc, /v/biz/slug     → paths stay paths
 *   /#features, /# (anchors)    → ignored; the pathname decides
 *
 * A `#/route` hash wins over the pathname, as it always has. Query params in the hash win over
 * the ones in the real query string. An empty route is `landing`.
 */
export function parseLocation(loc = typeof window === 'undefined' ? null : window.location) {
  const pathname = loc?.pathname || '/';
  const hash = loc?.hash || '';
  const params = Object.fromEntries(new URLSearchParams(loc?.search || '').entries());

  let page = '';
  let legacy = false;
  if (hash.startsWith('#/')) {
    // Drop a second '#' (`#/studios/x#features`): only the part before it is the route.
    const raw = stripSlashes(hash.slice(2).split('#')[0]);
    const q = raw.indexOf('?');
    page = q === -1 ? raw : raw.slice(0, q);
    if (q !== -1) Object.assign(params, Object.fromEntries(new URLSearchParams(raw.slice(q + 1)).entries()));
    legacy = Boolean(page);
  }
  if (!page) page = stripSlashes(pathname).replace(/^index\.html$/, '');

  return { page: page || 'landing', params, legacy };
}

/** `/page?query`, the clean URL for a page. `landing` is the site root. */
export function buildUrl(page, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const path = !page || page === 'landing' ? '/' : `/${stripSlashes(page)}`;
  return qs ? `${path}?${qs}` : path;
}

/**
 * The current route written as a `#/page` hash, whichever form the URL is in. A drop-in for
 * `location.hash` in code that matches routes with a regex (`/^#\/timeline/`).
 */
export function routeHash(loc) {
  const { page } = parseLocation(loc);
  return page === 'landing' ? '' : `#/${page}`;
}

/**
 * Runs `fn` whenever the route may have changed: the browser's Back/Forward, a hand-edited
 * hash, or the router finishing a navigation (`pushState` fires no event of its own).
 * Returns a disposer.
 */
export function onRouteChange(fn) {
  if (typeof window === 'undefined') return () => {};
  const events = ['popstate', 'hashchange', 'sv:route-changed'];
  events.forEach((e) => window.addEventListener(e, fn));
  return () => events.forEach((e) => window.removeEventListener(e, fn));
}
