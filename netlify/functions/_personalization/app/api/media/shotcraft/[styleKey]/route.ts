import { NextRequest, NextResponse } from '../../../../../shims/next-server';

/**
 * Same-origin proxy for the upstream ShotCraft preview clips.
 *
 * WHY THIS EXISTS
 * ---------------
 * The Motion Studio preview clips are published by the upstream `video-shotcraft`
 * repository as GitHub release assets. Two browser policies make a direct
 * cross-origin reference unusable in the Step 4 preview:
 *
 *   1. CORS — GitHub release assets do not send `Access-Control-Allow-Origin`,
 *      so any `fetch()`-based media loader is rejected. The Remotion player
 *      (mediabunny `UrlSource`) slices the clip with `fetch()` + `Range`
 *      requests, so it fails outright.
 *   2. CSP — `connect-src` would have to allow the upstream host for that
 *      fetch, which would widen the app's outbound allow-list for every page.
 *
 * Proxying through this route fixes both: the browser only ever talks to its
 * own origin, so there is no CORS pre-flight and no new CSP origin is needed
 * for `connect-src`. The bytes served are the *existing* upstream MP4s — this
 * route never generates, re-encodes or substitutes a video.
 *
 * `Range` support is forwarded verbatim so the player can seek.
 *
 * WHICH UPSTREAM
 * --------------
 * The clips are published twice: as GitHub release assets under the
 * `gallery-media` tag, and as the published site media at
 * `vincentwei1021.github.io/video-shotcraft/media`. The two are NOT always the
 * same bytes: upstream re-uploads a clip when it is revised, and the release
 * asset is frozen at the time of the release. A byte-level comparison of the
 * current catalogue (150 style keys) found the release mirror serving the
 * OLDER cut for re-uploaded clips (e.g. `basic-3d-scene`, `multiplane`,
 * `split-text-stagger`) while the site origin serves the current one, and the
 * release mirror also sends `application/octet-stream` where the site origin
 * sends `video/mp4`.
 *
 * The site origin is therefore the primary source of truth here, and the
 * release asset is kept as a fallback so a single upstream outage cannot take
 * the whole Motion Studio library offline. Both origins carry all 150 clips.
 */

// The upstream bases are compile-time constants. The request path only ever
// selects a file name inside them, so this route cannot be pointed at another
// host (no SSRF surface).
const UPSTREAM_PRIMARY_BASE = 'https://vincentwei1021.github.io/video-shotcraft/media';
const UPSTREAM_FALLBACK_BASE =
  'https://github.com/Vincentwei1021/video-shotcraft/releases/download/gallery-media';

/** Only lowercase kebab-case style keys are accepted (e.g. `basic-3d-scene`). */
const STYLE_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,80}$/;

/**
 * Hosts the upstream redirect chain is allowed to reach.
 *
 * The site origin serves the media directly. The fallback release asset is
 * served by `github.com`, which redirects to `release-assets.githubusercontent.com`
 * (an Azure-backed asset CDN). Redirects are followed manually so that every
 * hop is validated BEFORE the request is made — `redirect: 'follow'` would let
 * an unexpected `Location` aim the server at an arbitrary host.
 */
const ALLOWED_UPSTREAM_HOSTS = ['github.com', 'vincentwei1021.github.io'];
const ALLOWED_UPSTREAM_HOST_SUFFIXES = ['.githubusercontent.com', '.github.io'];

function isAllowedUpstreamHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    ALLOWED_UPSTREAM_HOSTS.includes(host) ||
    ALLOWED_UPSTREAM_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
  );
}

/** Maximum number of upstream redirects that will be followed. */
const MAX_UPSTREAM_REDIRECTS = 5;

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ styleKey?: string }> },
): Promise<Response> {
  const { styleKey } = await params;

  // The catalog stores the URL as `/api/media/shotcraft/<styleKey>.mp4`; the
  // upstream file is `<styleKey>.mp4`, so an optional extension on
  // the incoming path is stripped before validation.
  const key = typeof styleKey === 'string' ? styleKey.replace(/\.mp4$/i, '') : '';

  if (!key || !STYLE_KEY_PATTERN.test(key)) {
    return NextResponse.json({ error: 'Invalid media key' }, { status: 400 });
  }

  // Primary first (current upstream bytes), release asset as the fallback.
  const upstreamCandidates = [
    `${UPSTREAM_PRIMARY_BASE}/${key}.mp4`,
    `${UPSTREAM_FALLBACK_BASE}/${key}.mp4`,
  ];

  // Forward the client's Range header so the player can seek, and ask the
  // upstream for the exact bytes requested.
  const range = req.headers.get('range');
  const headers: Record<string, string> = { 'User-Agent': 'OpenHiggsBolt-Personalization-Preview' };
  if (range) headers.Range = range;

  // One deadline for the whole redirect chain, not one per hop.
  const signal = AbortSignal.timeout(30_000);

  let upstream: Response | null = null;
  let failureMessage = 'Upstream fetch failed';

  for (let i = 0; i < upstreamCandidates.length; i += 1) {
    const candidate = upstreamCandidates[i];
    const isLastCandidate = i === upstreamCandidates.length - 1;

    try {
      const response = await fetchUpstream(candidate, headers, signal);
      upstream = response;

      // A miss (unknown key), an unsatisfiable range or an upstream fault is
      // worth retrying against the other origin — but only when one is left.
      const retryable = response.status === 404 || response.status === 416 || response.status >= 500;
      if (!retryable || isLastCandidate) break;
    } catch (err) {
      failureMessage = err instanceof Error ? err.message : 'Upstream fetch failed';
      if (isLastCandidate) break;
    }
  }

  if (!upstream) {
    return NextResponse.json({ error: failureMessage }, { status: 502 });
  }

  // A 4xx from the upstream is a client-visible condition and must not be
  // masked as a 502: 404 = unknown style key, 416 = unsatisfiable range.
  // 5xx is an upstream fault and is reported as 502.
  if (!upstream.ok && upstream.status !== 206) {
    const status = upstream.status === 404 ? 404 : upstream.status === 416 ? 416 : 502;
    const errorHeaders: Record<string, string> = {};
    const unsatisfiedRange = upstream.headers.get('content-range');
    if (status === 416 && unsatisfiedRange) errorHeaders['Content-Range'] = unsatisfiedRange;
    return NextResponse.json(
      { error: `Upstream returned ${upstream.status}` },
      { status, headers: errorHeaders },
    );
  }

  const responseHeaders = new Headers();
  // The site origin serves `video/mp4`; the release-asset fallback serves
  // `application/octet-stream`. This route only ever serves MP4s, so the real
  // media type is declared explicitly rather than forwarded — the player needs
  // to know it is a video.
  responseHeaders.set('Content-Type', 'video/mp4');
  responseHeaders.set('Accept-Ranges', upstream.headers.get('accept-ranges') || 'bytes');

  // `fetch()` transparently decodes a gzip/br encoded body but leaves the
  // upstream headers untouched, so in that case the upstream Content-Length
  // no longer describes the bytes being streamed. Drop both headers and let
  // the runtime frame the response instead of sending a wrong length.
  if (!upstream.headers.get('content-encoding')) {
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) responseHeaders.set('Content-Length', contentLength);
  }

  const contentRange = upstream.headers.get('content-range');
  if (contentRange) responseHeaders.set('Content-Range', contentRange);

  // Upstream re-uploads a clip under the same file name when it is revised
  // (the release mirror is frozen at release time, the site origin is not), so
  // a long `immutable` TTL would pin a stale cut in the CDN for a year. One
  // hour plus stale-while-revalidate keeps the previews fast while still
  // picking up an upstream revision within the hour.
  responseHeaders.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');

  return new Response(upstream.body, {
    status: upstream.status === 206 ? 206 : 200,
    headers: responseHeaders,
  });
}

/**
 * Fetch the upstream release asset, following GitHub's redirect chain
 * manually so every hop is checked against the allowed host list before the
 * request is issued. An unexpected `Location` aborts the chain instead of
 * being fetched.
 */
async function fetchUpstream(
  initialUrl: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<Response> {
  let currentUrl = initialUrl;

  for (let hop = 0; hop <= MAX_UPSTREAM_REDIRECTS; hop += 1) {
    const response = await fetch(currentUrl, { headers, redirect: 'manual', signal });

    const isRedirect = response.status >= 300 && response.status < 400;
    if (!isRedirect) return response;

    const location = response.headers.get('location');
    // Release the redirect response body so the socket is not left dangling.
    await response.body?.cancel().catch(() => {});
    if (!location) return response;

    let nextUrl: URL;
    try {
      nextUrl = new URL(location, currentUrl);
    } catch {
      throw new Error('Upstream returned an unusable redirect target');
    }
    if (!isAllowedUpstreamHost(nextUrl.hostname)) {
      throw new Error(`Upstream redirect left the allowed hosts (${nextUrl.hostname})`);
    }
    currentUrl = nextUrl.toString();
  }

  throw new Error('Upstream redirect chain was too long');
}
