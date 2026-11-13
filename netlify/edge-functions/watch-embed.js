/* global Headers */
/**
 * Netlify Edge Function: let the public video player (/watch/<id> and /v/<business>/<slug>) be
 * embedded on any website. The site-wide header rule (netlify.toml) sends
 * X-Frame-Options: SAMEORIGIN and a restrictive frame-ancestors CSP, and
 * Netlify merges header rules rather than overriding them, so the player's
 * framing headers are rewritten here instead. Only framing changes; every
 * other security header is kept.
 */
export default async (request, context) => {
  const response = await context.next();
  const headers = new Headers(response.headers);
  headers.delete('x-frame-options');
  headers.set('content-security-policy', 'frame-ancestors *');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};

export const config = { path: ['/watch/*', '/v/*'] };
