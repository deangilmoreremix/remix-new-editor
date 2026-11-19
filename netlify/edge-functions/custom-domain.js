/* global Netlify, Headers, AbortSignal, Request */
/**
 * Netlify Edge Function: a business's own domain for its videos.
 *
 * videos.acme.com/intro  ->  the player for /v/<business>/intro, with the address bar unchanged.
 * The host's business comes from resolve_custom_domain() (anon key, returns only a slug). The domain must
 * also be added to this Netlify site as a domain alias with DNS pointing here; that step is what allows
 * traffic. The app reads <meta name="sv-route"> to open the right player (src/main.js).
 * Only a host an administrator has verified resolves (see 20261119170000_custom_domain_verified.sql). Hosts of the
 * app itself, previews and anything that does not resolve pass through untouched.
 */
const OWN = /(^|\.)(smartvid\.app|netlify\.app|netlify\.live|localhost)$/;
const SLUG_PATH = /^\/([a-z0-9][a-z0-9-]{1,46}[a-z0-9])\/?$/;
const cache = new Map(); // host -> { slug, at }
const TTL = 60_000;

async function businessFor(host) {
  const hit = cache.get(host);
  if (hit && Date.now() - hit.at < TTL) return hit.slug;
  const base = (Netlify.env.get('VITE_SUPABASE_URL') || Netlify.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
  const key = Netlify.env.get('VITE_SUPABASE_ANON_KEY') || Netlify.env.get('SUPABASE_ANON_KEY') || '';
  if (!base || !key) return null;
  const res = await fetch(`${base}/rest/v1/rpc/resolve_custom_domain`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_host: host }),
    signal: AbortSignal.timeout(2500),
  });
  if (!res.ok) return null;
  const slug = await res.json();
  const value = typeof slug === 'string' ? slug : null;
  cache.set(host, { slug: value, at: Date.now() });
  return value;
}

export default async (request, context) => {
  const url = new URL(request.url);
  if (OWN.test(url.hostname) || request.method !== 'GET') return context.next();
  const match = SLUG_PATH.exec(url.pathname);
  if (!match) return context.next(); // assets, /watch/*, /v/*, the root
  let business = null;
  try { business = await businessFor(url.hostname); } catch { /* fall through to the normal site */ }
  if (!business) return context.next();

  const route = `v/${business}/${match[1]}`;
  const response = await context.next(new Request(new URL(`/${route}${url.search}`, url), request));
  const headers = new Headers(response.headers);
  headers.delete('x-frame-options');
  headers.set('content-security-policy', 'frame-ancestors *');
  if (!(headers.get('content-type') || '').includes('text/html')) return new Response(response.body, { status: response.status, headers });
  const html = (await response.text()).replace('<head>', `<head><meta name="sv-route" content="${route}">`);
  return new Response(html, { status: response.status, headers });
};

// Only top-level single-segment paths (videos.acme.com/intro). A broader path would invoke this function, and count
// toward the site's edge-function usage, for every page, script and API call.
export const config = { path: ['/:slug', '/:slug/'] };
