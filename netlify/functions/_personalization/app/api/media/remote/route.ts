import { NextRequest, NextResponse } from '../../../../shims/next-server';
import {
  isProxiableRemoteMediaHost,
  parseProxiableRemoteMediaUrl,
} from '../../../../src/shared/personalization/preview/remoteMedia';

/**
 * Same-origin streaming proxy for remote preview videos.
 *
 * The AI-viral demo library is hosted on `cdn.seedance2prompt.com`, which does
 * not send `Access-Control-Allow-Origin` and is not in the CSP `connect-src`.
 * The Remotion preview (`@remotion/media` <Video>, mediabunny `UrlSource`)
 * reads media with `fetch()` + `Range`, so those videos could not be played.
 * Proxying through this route keeps the browser on its own origin. Bytes are
 * streamed through unchanged; `Range` is forwarded so the player can seek.
 *
 * Only exact hostnames in `REMOTE_MEDIA_ALLOWED_HOSTS` are fetched, and
 * redirects are followed manually with every hop re-checked, so the route
 * cannot be aimed at arbitrary hosts.
 */

const MAX_UPSTREAM_REDIRECTS = 3;

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const target = parseProxiableRemoteMediaUrl(req.nextUrl.searchParams.get('url'));
  if (!target) {
    return NextResponse.json({ error: 'URL is missing or not an allowed media host' }, { status: 400 });
  }

  const headers: Record<string, string> = { 'User-Agent': 'OpenHiggsBolt-Personalization-Preview' };
  const range = req.headers.get('range');
  if (range) headers.Range = range;

  let upstream: Response;
  try {
    upstream = await fetchUpstream(target, headers, AbortSignal.timeout(30_000));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upstream fetch failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!upstream.ok && upstream.status !== 206) {
    await upstream.body?.cancel().catch(() => {});
    const status = upstream.status === 404 ? 404 : upstream.status === 416 ? 416 : 502;
    const errorHeaders: Record<string, string> = {};
    const unsatisfiedRange = upstream.headers.get('content-range');
    if (status === 416 && unsatisfiedRange) errorHeaders['Content-Range'] = unsatisfiedRange;
    return NextResponse.json({ error: `Upstream returned ${upstream.status}` }, { status, headers: errorHeaders });
  }

  const contentType = upstream.headers.get('content-type') || '';
  if (!/^(video|audio)\//i.test(contentType) && !/^application\/octet-stream/i.test(contentType)) {
    await upstream.body?.cancel().catch(() => {});
    return NextResponse.json({ error: 'Upstream did not return media' }, { status: 415 });
  }

  const responseHeaders = new Headers();
  responseHeaders.set(
    'Content-Type',
    /^application\/octet-stream/i.test(contentType) ? 'video/mp4' : contentType,
  );
  responseHeaders.set('Accept-Ranges', upstream.headers.get('accept-ranges') || 'bytes');
  // fetch() decodes gzip/br bodies, so the upstream length would be wrong then.
  if (!upstream.headers.get('content-encoding')) {
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) responseHeaders.set('Content-Length', contentLength);
  }
  const contentRange = upstream.headers.get('content-range');
  if (contentRange) responseHeaders.set('Content-Range', contentRange);
  const etag = upstream.headers.get('etag');
  if (etag) responseHeaders.set('ETag', etag);
  responseHeaders.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');

  return new Response(upstream.body, {
    status: upstream.status === 206 ? 206 : 200,
    headers: responseHeaders,
  });
}

async function fetchUpstream(
  initialUrl: URL,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<Response> {
  let currentUrl = initialUrl;

  for (let hop = 0; hop <= MAX_UPSTREAM_REDIRECTS; hop += 1) {
    const response = await fetch(currentUrl, { headers, redirect: 'manual', signal });
    const isRedirect = response.status >= 300 && response.status < 400;
    if (!isRedirect) return response;

    const location = response.headers.get('location');
    await response.body?.cancel().catch(() => {});
    if (!location) return response;

    let nextUrl: URL;
    try {
      nextUrl = new URL(location, currentUrl);
    } catch {
      throw new Error('Upstream returned an unusable redirect target');
    }
    if (nextUrl.protocol !== 'https:' || !isProxiableRemoteMediaHost(nextUrl.hostname)) {
      throw new Error(`Upstream redirect left the allowed hosts (${nextUrl.hostname})`);
    }
    currentUrl = nextUrl;
  }

  throw new Error('Upstream redirect chain was too long');
}
