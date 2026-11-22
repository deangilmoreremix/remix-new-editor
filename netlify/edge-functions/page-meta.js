/* global Netlify, Headers, AbortSignal */
/**
 * Netlify Edge Function for video landing pages (/p/<slug>).
 *
 * 1. Link previews: social crawlers and chat apps don't run the SPA, so the
 *    title / description / poster for a published page are read from Supabase
 *    (anon key, published rows only) and written into the HTML <head>.
 *    Personal links (?c=) deliberately get the page's generic copy: tokens such
 *    as a contact's name are never put in a cacheable, crawlable preview.
 * 2. Embedding: /p/<slug>?embed=1 may be framed anywhere. The site-wide header
 *    rule sends X-Frame-Options: SAMEORIGIN, and Netlify merges header rules
 *    instead of overriding them, so framing headers are rewritten here. Only
 *    the embed variant is relaxed; a normal page stays unframeable.
 */
const ID = /^[A-Za-z0-9_-]{8,32}$/;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const https = (u) => (/^https:\/\//i.test(String(u || '')) ? String(u) : '');
// Preview text: drop {{token|fallback}} markers, keeping the fallback.
const plain = (s) => String(s ?? '').replace(/\{\{\s*[a-zA-Z0-9_]{1,40}\s*(?:\|([^}]{0,80}))?\}\}/g, (_, fb) => (fb || '').trim()).replace(/\[\[|\]\]/g, '').replace(/\s+/g, ' ').trim();

async function loadPage(id) {
  const base = (Netlify.env.get('VITE_SUPABASE_URL') || Netlify.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
  const key = Netlify.env.get('VITE_SUPABASE_ANON_KEY') || Netlify.env.get('SUPABASE_ANON_KEY') || '';
  if (!base || !key) return null;
  const res = await fetch(`${base}/rest/v1/landing_pages?id=eq.${encodeURIComponent(id)}&published=eq.true&select=title,poster_url,config`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(2500),
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

export default async (request, context) => {
  const url = new URL(request.url);
  const response = await context.next();
  const headers = new Headers(response.headers);

  if (url.searchParams.get('embed') === '1') {
    headers.delete('x-frame-options');
    headers.set('content-security-policy', 'frame-ancestors *');
  }

  const type = headers.get('content-type') || '';
  const id = decodeURIComponent(url.pathname.replace(/^\/p\//, '').split('/')[0] || '');
  if (!type.includes('text/html') || !ID.test(id)) {
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }

  let page = null;
  try { page = await loadPage(id); } catch { /* previews are best-effort */ }

  let html = await response.text();
  if (page) {
    const title = esc(plain(page.title) || 'Video');
    const description = esc((plain(page.config?.subhead) || plain(page.config?.headline) || 'Watch this video').slice(0, 200));
    const image = https(page.poster_url);
    const tags = [
      `<meta property="og:type" content="video.other">`,
      `<meta property="og:title" content="${title}">`,
      `<meta property="og:description" content="${description}">`,
      `<meta property="og:url" content="${esc(`${url.origin}/p/${id}`)}">`,
      `<meta name="description" content="${description}">`,
      `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`,
      `<meta name="twitter:title" content="${title}">`,
      image ? `<meta property="og:image" content="${esc(image)}">` : '',
      image ? `<meta name="twitter:image" content="${esc(image)}">` : '',
    ].filter(Boolean).join('\n    ');
    html = /<title>[\s\S]*?<\/title>/i.test(html)
      ? html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`)
      : html;
    html = html.replace(/<\/head>/i, `    ${tags}\n  </head>`);
    headers.set('cache-control', 'public, max-age=0, s-maxage=60');
  }
  headers.delete('content-length');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
};

export const config = { path: '/p/*' };
