import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// muapi-proxy — forwards requests to api.muapi.ai on behalf of the client.
//
// Auth model (user-key-required, no server fallback):
//   Every request MUST carry a Muapi API key supplied by the caller. Accepted
//   sources (in priority order for JSON bodies):
//     1. body.muapi_api_key
//     2. body.params.muapi_api_key
//     3. x-api-key request header
//   For multipart uploads only the x-api-key header is inspected.
//
//   The proxy does NOT read MUAPI_API_KEY from the environment. If no key is
//   supplied, the request is rejected with HTTP 500 and a clear error message.
//
//   A dev-bypass placeholder ("dev") is accepted so developers can exercise
//   the proxy locally without a real Muapi key; remove or guard this bypass
//   in production deployments.
//
// Other behaviors preserved:
//   - OpenAI key forwarding (user-supplied openai_api_key, stripped from body)
//   - Rate limiting, CSRF, endpoint validation, unwrapResponse

// --- Constants ---

const UPSTREAM_TIMEOUT_MS = 30_000;
const MAX_BUFFER_BYTES = 100 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_RETRIES = 2;
const RETRYABLE_STATUSES = new Set([502, 503, 429]);

// --- Output Integrity ---

const KNOWN_STATIC_PATTERNS = [
  '/muapi/homepage/',
  '/muapi/demo/',
  '/muapi/sandbox/',
  '/webassets/videomodels/',
  '/webassets/',
  '/placeholder/',
  '/sample/',
  '/static/demo/',
];

function isStaticPlaceholderUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return KNOWN_STATIC_PATTERNS.some(pattern => lower.includes(pattern));
}

function extractOutputUrls(result: any): string[] {
  const urls: string[] = [];
  if (Array.isArray(result.outputs)) urls.push(...result.outputs);
  if (Array.isArray(result.images)) urls.push(...result.images);
  if (result.url) urls.push(result.url);
  if (result.output?.url) urls.push(result.output.url);
  if (result.video?.url) urls.push(result.video.url);
  if (result.audio?.url) urls.push(result.audio.url);
  return urls.filter(Boolean);
}

function validateOutputIntegrity(result: any, requestId: string): { ok: boolean; reason?: string } {
  const urls = extractOutputUrls(result);

  if (urls.length === 0) {
    return { ok: false, reason: 'no_output_urls' };
  }

  const staticUrls = urls.filter(isStaticPlaceholderUrl);
  if (staticUrls.length > 0) {
    return {
      ok: false,
      reason: `static_placeholder_detected: ${staticUrls[0]}`,
    };
  }

  return { ok: true };
}

// --- CORS helpers ---
function sniffMimeType(chunk: Uint8Array): string | null {
  if (chunk.length < 4) return null;
  const bytes = chunk;
  if (
    bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF
  ) return 'image/jpeg';
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47
  ) return 'image/png';
  if (
    bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46
  ) return 'image/gif';
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
  ) return 'image/webp';
  if (
    bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x00 &&
    (bytes[3] === 0x1C || bytes[3] === 0x20) && bytes[4] === 0x66 && bytes[5] === 0x74
  ) return 'video/mp4';
  if (
    bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3
  ) return 'video/webm';
  return null;
}

function sizeLimitForMime(mime: string | null): number {
  if (!mime) return MAX_IMAGE_BYTES;
  if (mime.startsWith('video/')) return MAX_VIDEO_BYTES;
  return MAX_IMAGE_BYTES;
}

// --- CORS helpers ---

function getAllowedOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS') || '';
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function getCorsHeaders(req: Request): Record<string, string> {
  const allowedOrigins = getAllowedOrigins();
  const requestOrigin = req.headers.get('origin') || '';

  const originHeader: string =
    requestOrigin && allowedOrigins.includes(requestOrigin)
      ? requestOrigin
      : allowedOrigins.length > 0
        ? allowedOrigins[0]
        : '*';

  if (originHeader === '*' && Deno.env.get('ENVIRONMENT') !== 'development') {
    console.warn('[muapi-proxy] ALLOWED_ORIGINS not set; falling back to wildcard CORS in production');
  }

  return {
    'Access-Control-Allow-Origin': originHeader,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Webhook-Signature, X-Endpoint, X-Api-Key',
    'Vary': 'Origin',
  };
}

// --- Retry logic ---

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  signal: AbortSignal
): Promise<Response> {
  let attempt = 0;
  while (true) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    try {
      const mergedSignal = AbortSignal.any([signal, controller.signal]);
      const response = await fetch(url, { ...init, signal: mergedSignal });
      clearTimeout(timeoutId);

      if (
        !RETRYABLE_STATUSES.has(response.status) ||
        attempt >= MAX_RETRIES
      ) {
        return response;
      }

      const backoffMs = 500 * Math.pow(2, attempt);
      console.warn(
        `[muapi-proxy] Retrying ${url} after ${response.status} ` +
          `(attempt ${attempt + 1}/${MAX_RETRIES}, backoff ${backoffMs}ms)`
      );
      await new Promise(r => setTimeout(r, backoffMs));
      attempt++;
    } catch (err) {
      clearTimeout(timeoutId);
      if (attempt >= MAX_RETRIES) throw err;
      const backoffMs = 500 * Math.pow(2, attempt);
      console.warn(
        `[muapi-proxy] Upstream error for ${url}: ${(err as Error).message}. ` +
          `Retrying (attempt ${attempt + 1}/${MAX_RETRIES}, backoff ${backoffMs}ms)`
      );
      await new Promise(r => setTimeout(r, backoffMs));
      attempt++;
    }
  }
}

// --- Body stream setup ---

function setupMultipartBodyStream(
  req: Request
): { passThrough: PassThrough; sizeLimit: number; totalBytes: number } {
  const contentType = req.headers.get('content-type') || '';
  const isVideo = contentType.includes('video');

  const passThrough = new PassThrough();
  let totalBytes = 0;
  let mimeSniffed = false;
  let detectedMime: string | null = null;
  const sniffBuffer = new Uint8Array(12);
  let sniffOffset = 0;

  if (!req.body) {
    return { passThrough, sizeLimit: isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES, totalBytes: 0 };
  }

  (async () => {
    try {
      for await (const chunk of req.body as ReadableStream<Uint8Array>) {
        if (!mimeSniffed && sniffOffset < sniffBuffer.length) {
          const need = Math.min(chunk.length, sniffBuffer.length - sniffOffset);
          sniffBuffer.set(chunk.subarray(0, need), sniffOffset);
          sniffOffset += need;
          if (sniffOffset >= sniffBuffer.length) {
            detectedMime = sniffMimeType(sniffBuffer);
            mimeSniffed = true;
          }
        }

        totalBytes += chunk.length;

        if (totalBytes > MAX_BUFFER_BYTES) {
          passThrough.destroy(
            new Error(`Request body exceeds maximum allowed size of ${MAX_BUFFER_BYTES} bytes`)
          );
          return;
        }

        passThrough.write(chunk);
      }
      passThrough.end();
    } catch {
      passThrough.destroy();
    }
  })();

  const sizeLimit = sizeLimitForMime(detectedMime ?? (isVideo ? 'video/placeholder' : 'image/placeholder'));

  return { passThrough, sizeLimit, totalBytes };
}

// --- Rate limiting ---
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 100; // requests per window
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(clientId);
  
  if (!record || now > record.resetTime) {
    rateLimitStore.set(clientId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  record.count++;
  return true;
}

interface GenerateRequest {
  endpoint: string;
  params?: Record<string, any>;
  generationType?: 'image' | 'video' | 'i2i' | 'i2v' | 'v2v' | 'poll' | 'upload' | 'audio' | 'avatar' | 'text' | 'train' | 'video-tool' | 'lipsync' | 'list';
  studioType?: string;
  // Optional upstream HTTP method (e.g. 'PATCH' / 'DELETE') for account
  // management endpoints. When present it overrides the GET/POST default.
  apiMethod?: string;
}

function unwrapResponse(body: any): any {
  if (!body || typeof body !== 'object') return body;
  if (body.data && typeof body.data === 'object') {
    const unwrapped = { ...body.data };
    // Preserve sibling fields like video, audio, urls, etc. that live next to `data`
    Object.keys(body).forEach((key) => {
      if (key !== 'data') {
        (unwrapped as any)[key] = (body as any)[key];
      }
    });
    return unwrapped;
  }
  return body;
}

function validateEndpoint(endpoint: string): boolean {
  // Allow standard muapi endpoint paths while preventing path traversal / SSRF.
  // Supported shapes include:
  //   - predictions/<id>/result
  //   - <model-name>
  //   - <category>-<model>
//   - specialized app endpoints like ai-image-upscale, generate_wan_ai_effects, suno-create-music
  //   - social endpoints with a query string, e.g. social/ext/accounts?external_user_id=user_123
  if (!endpoint || typeof endpoint !== 'string') return false;
  const trimmed = endpoint.trim();
  if (!trimmed) return false;

  // Split off an optional query string so we can validate the path and the
  // query portion independently. Social listing needs ?external_user_id=...
  const [path, query] = trimmed.split('?');

  // Block path traversal but allow dots, hyphens, underscores, and slashes
if (path.includes('..') || path.startsWith('/') || path.includes('//')) return false;
  if (!/^[a-z0-9][a-z0-9_.\/-]*$/.test(path)) return false;

  // Query string (if present) must be a safe, url-encoded set of key=value pairs.
  if (query !== undefined) {
    if (query === '') return false;
    if (!/^[a-z0-9_.\-=&%]*$/i.test(query)) return false;
  }
  return true;
}

// Map legacy/short endpoint names to the real muapi API names.
// IMPORTANT: the client already sends the canonical muapi route names
// (e.g. `flux-dev-image`, `latentsync-video`, `generate_wan_ai_effects`,
// `ai-image-upscale`). The earlier mapping stripped suffixes *away* from the
// real names, which 404'd. This map only helps if a caller passes the old
// short form; canonical names pass straight through.
function normalizeLegacyEndpoint(endpoint: string): string {
  const map: Record<string, string> = {
    'flux-dev': 'flux-dev-image',
    'flux-schnell': 'flux-schnell-image',
    'latent-sync': 'latentsync-video',
    'ai-video-effects': 'generate_wan_ai_effects',
    'ai-image-upscaler': 'ai-image-upscale',
  };
  return map[endpoint] || endpoint;
}

function getClientId(req: Request): string {
  // Use API key or IP as client identifier
  const apiKey = req.headers.get('x-api-key');
  if (apiKey) {
    // Hash the API key for privacy
    let hash = 0;
    for (let i = 0; i < apiKey.length; i++) {
      hash = ((hash << 5) - hash) + apiKey.charCodeAt(i);
      hash |= 0;
    }
    return `key_${Math.abs(hash).toString(36)}`;
  }
  return `ip_${req.headers.get('cf-connecting-ip') || 'unknown'}`;
}

function verifyCsrfProtection(req: Request, auth: { reason: string }): { ok: boolean; reason?: string } {
  // Skip CSRF check for trusted callers (service role, ALLOW_UNAUTHENTICATED bypass)
  if (auth.reason === 'service_role' || auth.reason === 'ALLOW_UNAUTHENTICATED') {
    return { ok: true };
  }
  // Check Sec-Fetch-Site: reject cross-site requests
  const secFetchSite = req.headers.get('sec-fetch-site');
  if (secFetchSite && secFetchSite === 'cross-site') {
    return { ok: false, reason: 'cross-site request blocked' };
  }
  // Check Origin against APP_ORIGIN env var
  const origin = req.headers.get('origin');
  const appOrigin = Deno.env.get('APP_ORIGIN');
  if (origin && appOrigin && origin !== appOrigin) {
    return { ok: false, reason: 'origin mismatch' };
  }
  return { ok: true };
}

Deno.serve(async (req: Request) => {
   if (req.method === "OPTIONS") {
     return new Response(null, {
       status: 200,
       headers: getCorsHeaders(req),
     });
   }

  // Rate limiting
  const clientId = getClientId(req);
  if (!checkRateLimit(clientId)) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
      {
        status: 429,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json', 'Retry-After': '60' }
      }
    );
  }

  try {
    const csrf = verifyCsrfProtection(req, { reason: '' });
    if (!csrf.ok) {
      console.log(JSON.stringify({ type: 'csrf.rejected', reason: csrf.reason, ip: req.headers.get('cf-connecting-ip') }));
      return new Response(
        JSON.stringify({ error: 'Forbidden', reason: csrf.reason }),
        { status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const contentType = req.headers.get('content-type') || '';
    const isMultipart = contentType.startsWith('multipart/');

    if (isMultipart) {
      const endpoint = req.headers.get('x-endpoint');
      if (!endpoint || !validateEndpoint(endpoint)) {
        return new Response(
          JSON.stringify({ error: 'Invalid or missing endpoint for multipart request' }),
          {
            status: 400,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
          }
        );
      }

      const contentType = req.headers.get('content-type') || '';
      const isVideo = contentType.includes('video');

      const incomingContentLength = req.headers.get('content-length');
      if (incomingContentLength) {
        const declaredSize = Number(incomingContentLength);
        if (!Number.isFinite(declaredSize)) {
          return new Response(
            JSON.stringify({ error: 'Invalid Content-Length header' }),
            { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
          );
        }
        const maxAllowed = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
        if (declaredSize > maxAllowed) {
          return new Response(
            JSON.stringify({
              error: `Payload Too Large: ${isVideo ? 'video' : 'image'} uploads are limited to ${maxAllowed} bytes (${(maxAllowed / 1024 / 1024).toFixed(0)} MB)`
            }),
            { status: 413, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
          );
        }
      }

      // Multipart requests cannot carry body-embedded keys; require the
      // user-supplied key via the x-api-key header.
      const userApiKey = req.headers.get('x-api-key');

      if (!userApiKey || userApiKey === '') {
        return new Response(
          JSON.stringify({
            error: 'No Muapi API key was provided in the request. Set your key in Settings and retry.'
          }),
          {
            status: 500,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
          }
        );
      }

      // Dev-bypass: allow a known placeholder value so developers can test the
      // proxy locally without supplying a real Muapi key. Production callers
      // must always supply their actual key.
      const isDev = Deno.env.get('ENVIRONMENT') === 'development';
      const DEV_BYPASS_KEY = 'dev';
      const effectiveApiKey = (isDev && userApiKey === DEV_BYPASS_KEY) ? '' : userApiKey;

      const normalizedEndpoint = normalizeLegacyEndpoint(endpoint);
      const muapiUrl = `https://api.muapi.ai/api/v1/${normalizedEndpoint}`;

      const { passThrough, sizeLimit } = setupMultipartBodyStream(req);

      const forwardHeaders: Record<string, string> = {
        'x-api-key': effectiveApiKey,
        'content-type': contentType,
      };
      if (incomingContentLength) {
        forwardHeaders['content-length'] = incomingContentLength;
      }

      let errorResponse: Response | null = null;
      passThrough.on('error', () => {
        if (!errorResponse) {
          errorResponse = new Response(
            JSON.stringify({ error: `Payload Too Large: body exceeds ${sizeLimit} bytes` }),
            { status: 413, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
          );
        }
      });

      const muapiResponse = await fetchWithRetry(muapiUrl, {
        method: 'POST',
        headers: forwardHeaders,
        body: passThrough,
      }, AbortSignal.timeout(UPSTREAM_TIMEOUT_MS));

      if (errorResponse) return errorResponse;

      if (!muapiResponse.ok) {
        const errorText = await muapiResponse.text();
        console.error(`[muapi-proxy] API error: ${muapiResponse.status} - ${errorText}`);

        return new Response(
          JSON.stringify({
            error: `API Request Failed: ${muapiResponse.status} ${muapiResponse.statusText}`,
            details: errorText.slice(0, 200)
          }),
          {
            status: muapiResponse.status,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
          }
        );
      }

      let result;
      try {
        result = await muapiResponse.json();
      } catch {
        result = { error: 'Invalid JSON response from API' };
      }
      result = unwrapResponse(result);

      // NEW: Validate output integrity for completed results
      const completionStatuses = new Set(['completed', 'succeeded', 'success']);
      if (result.status && completionStatuses.has(result.status.toLowerCase())) {
        const validation = validateOutputIntegrity(result, result.id || result.request_id);
        if (!validation.ok) {
          console.error(`[muapi-proxy] Blocked static/demo output: ${validation.reason}`);
          return new Response(
            JSON.stringify({
              error: 'static_placeholder_detected',
              reason: validation.reason,
              message: 'The upstream service returned a placeholder or demo asset instead of a unique generation. Please verify your API key has active credits.',
              request_id: result.id || result.request_id,
            }),
            {
              status: 422,
              headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
            }
          );
        }
      }

      return new Response(
        JSON.stringify(result),
        {
          status: 200,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
        }
      );
    }

    const body: GenerateRequest = await req.json();
    const { endpoint, params, generationType, studioType } = body;

    // Validate endpoint to prevent SSRF
    if (!endpoint || typeof endpoint !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid endpoint' }),
        {
          status: 400,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
        }
      );
    }

    if (!validateEndpoint(endpoint)) {
      console.error(`[muapi-proxy] Blocked invalid endpoint: ${endpoint}`);
      return new Response(
        JSON.stringify({ error: 'Invalid endpoint' }),
        {
          status: 400,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
        }
      );
    }

    // Normalize legacy endpoint names to match current muapi API
    const normalizedEndpoint = normalizeLegacyEndpoint(endpoint);

    // Resolve the per-user Muapi API key. Accepted sources, in priority order:
    //   1. body.muapi_api_key
    //   2. body.params.muapi_api_key
    //   3. x-api-key header
    // The proxy does NOT read a server-side MUAPI_API_KEY env var. If no key is
    // supplied by the caller, the request is rejected so upstream auth is never
    // silently satisfied by server configuration.
    let userApiKey: string | undefined;
    if (typeof body.muapi_api_key === 'string') {
      userApiKey = body.muapi_api_key;
    } else if (params && typeof (params as Record<string, unknown>).muapi_api_key === 'string') {
      userApiKey = (params as Record<string, unknown>).muapi_api_key as string;
    } else {
      userApiKey = req.headers.get('x-api-key') || undefined;
    }

    if (!userApiKey) {
      return new Response(
        JSON.stringify({
          error: 'No Muapi API key was provided in the request. Set your key in Settings and retry.'
        }),
        {
          status: 500,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
        }
      );
    }

    // Dev-bypass: allow a known placeholder value so developers can test the
    // proxy locally without supplying a real Muapi key. Production callers
    // must always supply their actual key.
    const isDev = Deno.env.get('ENVIRONMENT') === 'development';
    const DEV_BYPASS_KEY = 'dev';
    const effectiveApiKey = (isDev && userApiKey === DEV_BYPASS_KEY) ? '' : userApiKey;

    // Strip the key from the request body before forwarding so it is never
    // leaked as a model parameter to muapi.ai.
    if (typeof body.muapi_api_key === 'string') {
      delete body.muapi_api_key;
    }
    if (params && typeof (params as Record<string, unknown>).muapi_api_key === 'string') {
      delete (params as Record<string, unknown>).muapi_api_key;
    }

    // If the client supplied a user-owned OpenAI key (Settings > OpenAI API Key),
    // extract it and forward it as a header to muapi.ai so OpenAI-backed models
    // are billed against the user's own OpenAI account.
    let openaiApiKey: string | undefined;
    if (typeof body.openai_api_key === 'string') {
      openaiApiKey = body.openai_api_key;
    } else if (params && typeof (params as Record<string, unknown>).openai_api_key === 'string') {
      openaiApiKey = (params as Record<string, unknown>).openai_api_key as string;
      delete (params as Record<string, unknown>).openai_api_key;
    }

    const muapiUrl = `https://api.muapi.ai/api/v1/${normalizedEndpoint}`;

    console.log(`[muapi-proxy] Forwarding ${generationType ?? 'request'} to ${endpoint} (normalized: ${normalizedEndpoint})`);

    const defaultMethod = (generationType === 'poll' || generationType === 'list') ? 'GET' : 'POST';
    // Allow the caller to request a specific upstream verb (e.g. PATCH/DELETE
    // for account management). Falls back to the GET/POST default otherwise.
    const upstreamMethod =
      (typeof body.apiMethod === 'string' && body.apiMethod.trim())
        ? body.apiMethod.trim().toUpperCase()
        : defaultMethod;

    const fetchOptions: RequestInit = {
      method: upstreamMethod,
      headers: {
        'x-api-key': effectiveApiKey,
        ...(openaiApiKey ? { 'openai-api-key': openaiApiKey } : {}),
      }
    };

    if (upstreamMethod !== 'GET') {
      fetchOptions.headers['content-type'] = 'application/json';
      fetchOptions.body = JSON.stringify(params ?? {});
    }

    const muapiResponse = await fetch(muapiUrl, fetchOptions);

    if (!muapiResponse.ok) {
      const errorText = await muapiResponse.text();
      console.error(`[muapi-proxy] API error: ${muapiResponse.status} - ${errorText}`);

      return new Response(
        JSON.stringify({
          error: `API Request Failed: ${muapiResponse.status} ${muapiResponse.statusText}`,
          details: errorText.slice(0, 200)
        }),
        {
          status: muapiResponse.status,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
        }
      );
    }

    let result = await muapiResponse.json();
    result = unwrapResponse(result);

    // NEW: Validate output integrity for completed results
    const completionStatuses = new Set(['completed', 'succeeded', 'success']);
    if (result.status && completionStatuses.has(result.status.toLowerCase())) {
      const validation = validateOutputIntegrity(result, result.id || result.request_id);
      if (!validation.ok) {
        console.error(`[muapi-proxy] Blocked static/demo output: ${validation.reason}`);
        return new Response(
          JSON.stringify({
            error: 'static_placeholder_detected',
            reason: validation.reason,
            message: 'The upstream service returned a placeholder or demo asset instead of a unique generation. Please verify your API key has active credits.',
            request_id: result.id || result.request_id,
          }),
          {
            status: 422,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
          }
        );
      }
    }

    console.log(`[muapi-proxy] Success: ${JSON.stringify(result).slice(0, 100)}`);

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[muapi-proxy] Error:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      }
    );
  }
});
