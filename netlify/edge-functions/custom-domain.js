/* global Netlify, Headers, AbortSignal */
/**
 * Netlify Edge Function: a business's own domain for its videos.
 *
 * videos.acme.com/intro  ->  the player for /v/<business>/intro, with the address bar unchanged.
 * The host's business comes from resolve_custom_domain() (anon key, returns only a slug). The domain must
 * also be added to this Netlify site as a domain alias with DNS pointing here; that step is what allows
 * traffic. The app reads <meta name="sv-route"> to open the right player (src/main.js).
 * Only a host an administrator has verified resolves (see 20261119170000_custom_domain_verified.sql). Hosts of the
 * app itself, previews and anything that does not resolve pass through untouched.
 *
 * The request itself is forwarded unchanged (context.next()): the site's catch-all rule answers a path with no real
 * file with the app shell, and this function only adds the route hint to that shell. Nothing here rewrites the path.
 */
const OWN = /(^|\.)(smartvid\.app|netlify\.app|netlify\.live|localhost)$/;
const SLUG_PATH = /^\/([a-z0-9][a-z0-9-]{1,46}[a-z0-9])\/?$/;

/**
 * Single-segment paths that belong to the app itself (real pages, folders under public/ and routes in netlify.toml).
 * A video on a custom domain can never use one of these as its address. src/test/customDomainEdge.test.js checks this
 * list against public/ and netlify.toml so a new folder cannot be forgotten.
 */
export const APP_PATHS = new Set([
  'academy', 'account', 'admin', 'analytics-demo', 'api', 'app', 'assets', 'auth', 'billing', 'caption-looks', 'dashboard',
  'data', 'director-api', 'edit', 'embed', 'fonts', 'forgot-password', 'guides', 'help', 'hyperframes', 'landing-art',
  'landing-previews', 'landing-videos', 'library-previews', 'login', 'logout', 'luts', 'media', 'mediapipe', 'models',
  'motion-studio', 'new', 'occ-templates', 'openthorn', 'overlay-templates', 'preview', 'private', 'profile', 'public',
  'recorder', 'reset-password', 'screenshots', 'settings', 'signin', 'signup', 'smartwarmupai-api', 'smartwarmupai-app',
  'sound-effects', 'static', 'studios', 'support', 'thumbnails', 'v', 'vidbee', 'watch', 'zackd',
]);

const cache = new Map(); // host -> { slug, at }
const TTL = 60_000;
const FAIL_TTL = 10_000; // a failed lookup is remembered briefly so an outage is not hammered once per request
const MAX_HOSTS = 500;

/** Lower-case, without a trailing dot or port: how the database stores a domain. */
export const normalizeHost = (h) => String(h || '').toLowerCase().replace(/\.$/, '');

function remember(host, slug, ttl) {
  if (cache.size >= MAX_HOSTS) cache.delete(cache.keys().next().value); // oldest first: the map keeps insertion order
  cache.set(host, { slug, at: Date.now(), ttl });
}

async function businessFor(host) {
  const hit = cache.get(host);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.slug;
  const base = (Netlify.env.get('VITE_SUPABASE_URL') || Netlify.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
  const key = Netlify.env.get('VITE_SUPABASE_ANON_KEY') || Netlify.env.get('SUPABASE_ANON_KEY') || '';
  if (!base || !key) return null;
  try {
    const res = await fetch(`${base}/rest/v1/rpc/resolve_custom_domain`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_host: host }),
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) { remember(host, null, FAIL_TTL); return null; }
    const slug = await res.json();
    const value = typeof slug === 'string' ? slug : null;
    remember(host, value, TTL);
    return value;
  } catch {
    remember(host, null, FAIL_TTL);
    return null;
  }
}

export default async (request, context) => {
  const url = new URL(request.url);
  const host = normalizeHost(url.hostname);
  if (OWN.test(host) || request.method !== 'GET') return context.next();
  const match = SLUG_PATH.exec(url.pathname);
  if (!match || APP_PATHS.has(match[1])) return context.next(); // assets, /watch/*, /v/*, the root, the app's own pages
  const business = await businessFor(host);
  if (!business) return context.next();

  const route = `v/${business}/${match[1]}`;
  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (response.status !== 200 || !type.includes('text/html')) return response; // a real file or an error: leave it alone
  const html = await response.text();
  const headers = new Headers(response.headers);
  headers.delete('content-length'); // the body was read and may change length
  headers.delete('content-encoding');
  headers.delete('etag');
  if (!html.includes('<head>') || !html.includes('id="app"')) return new Response(html, { status: 200, headers }); // not the app shell
  headers.delete('x-frame-options');
  headers.set('content-security-policy', 'frame-ancestors *');
  return new Response(html.replace('<head>', `<head><meta name="sv-route" content="${route}">`), { status: 200, headers });
};

// Only top-level single-segment paths (videos.acme.com/intro). A broader path would invoke this function, and count
// toward the site's edge-function usage, for every page, script and API call.
export const config = { path: ['/:slug', '/:slug/'] };
