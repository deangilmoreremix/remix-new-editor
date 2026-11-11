import { NextResponse } from '../../../../../shims/next-server';
import { safeApiJson } from '../../../../../src/lib/safeApiResponse';
import { requireApiEntitlement, entitlementForbiddenResponse } from '../../../../../src/access/apiRequireEntitlement';
import { ENTITLEMENTS } from '../../../../../src/access/entitlements';

export const dynamic = "force-dynamic";

const MUAPI_BASE = 'https://api.muapi.ai';

const GENERATION_GET_PATTERNS = [
  /\/gpt-image-2$/,
  /\/text-to-video$/,
  /\/image-generation$/,
  /\/video-generation$/,
  /\/predictions\/[^/]+\/result$/,
];

function isGenerationGet(path) {
  return GENERATION_GET_PATTERNS.some((re) => re.test(path));
}

function getApiKey(request) {
    const headerKey = request.headers.get('x-api-key');
    if (headerKey) return headerKey;
    
    // Cookie-based auth removed for security (CWE-522)
    return null;
}

// Build the upstream request headers as a strict allowlist. We forward
// ONLY what MuAPI needs (content type + the api key). Everything else from the
// incoming browser request — including referer, user-agent, sec-fetch-*, and
// any present auth/custom headers — is deliberately dropped so nothing is
// leaked to the third-party upstream.
function buildUpstreamHeaders(request, apiKey) {
    const headers = new Headers();
    const contentType = request.headers.get('content-type');
    if (contentType) headers.set('content-type', contentType);
    if (apiKey) headers.set('x-api-key', apiKey);
    return headers;
}

// Proxies /api/api/v1/* -> https://api.muapi.ai/api/v1/*
// This is required because the AiAgent library hardcodes a double /api/api
export async function GET(request, { params }) {
    const slug = await params;
    const pathSegments = slug.path || [];
    const path = pathSegments.join('/');

    if (isGenerationGet(path)) {
      const entitlementCheck = await requireApiEntitlement(ENTITLEMENTS.SMARTVIDEO_GO);
      if (!entitlementCheck.allowed) {
        if (entitlementCheck.status === 401) {
          return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
        }
        return entitlementForbiddenResponse(ENTITLEMENTS.SMARTVIDEO_GO);
      }
    }

    const { search } = new URL(request.url);
    const targetUrl = `${MUAPI_BASE}/api/v1/${path}${search}`;

    const apiKey = getApiKey(request);
    if (!apiKey) {
        return NextResponse.json({ error: 'Unauthorized: Missing API key' }, { status: 401 });
    }

    const headers = buildUpstreamHeaders(request, apiKey);

    try {
        const response = await fetch(targetUrl, { headers, method: 'GET', signal: AbortSignal.timeout(60000) });
        const data = await safeApiJson(response);
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        // Never echo the upstream error body to the client; surface a generic
        // message and rely on server logs for diagnostics.
        const isAbort = error?.name === 'AbortError' || error?.name === 'TimeoutError';
        return NextResponse.json(
            { error: isAbort ? 'Upstream request timed out' : 'Upstream request failed' },
            { status: isAbort ? 504 : 502 }
        );
    }
}

export async function POST(request, { params }) {
    const slug = await params;
    const pathSegments = slug.path || [];
    const path = pathSegments.join('/');

    const entitlementCheck = await requireApiEntitlement(ENTITLEMENTS.SMARTVIDEO_GO);
    if (!entitlementCheck.allowed) {
      if (entitlementCheck.status === 401) {
        return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
      }
      return entitlementForbiddenResponse(ENTITLEMENTS.SMARTVIDEO_GO);
    }

    const { search } = new URL(request.url);
    const targetUrl = `${MUAPI_BASE}/api/v1/${path}${search}`;

    const apiKey = getApiKey(request);
    if (!apiKey) {
        return NextResponse.json({ error: 'Unauthorized: Missing API key' }, { status: 401 });
    }

    const headers = buildUpstreamHeaders(request, apiKey);

    try {
        const body = await request.arrayBuffer();
        const response = await fetch(targetUrl, { method: 'POST', headers, body, signal: AbortSignal.timeout(60000) });
        const data = await safeApiJson(response);
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        const isAbort = error?.name === 'AbortError' || error?.name === 'TimeoutError';
        return NextResponse.json(
            { error: isAbort ? 'Upstream request timed out' : 'Upstream request failed' },
            { status: isAbort ? 504 : 502 }
        );
    }
}
