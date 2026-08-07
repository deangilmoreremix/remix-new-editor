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
//   the proxy locally without a real Muapi key; it resolves to an empty string
//   upstream. Remove or guard this bypass in production deployments.
//
// Other behaviors preserved:
//   - OpenAI key forwarding (user-supplied openai_api_key, stripped from body)
//   - CORS headers (unchanged)
//   - Rate limiting, CSRF, endpoint validation, unwrapResponse

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Webhook-Signature, X-Endpoint, X-Api-Key",
};

// Rate limiting - simple in-memory store (use Redis for multi-instance deployments)
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
  if (!endpoint || typeof endpoint !== 'string') return false;
  const trimmed = endpoint.trim();
  if (!trimmed) return false;
  // Block path traversal but allow dots, hyphens, underscores, and slashes
  if (trimmed.includes('..') || trimmed.startsWith('/') || trimmed.includes('//')) return false;
  return /^[a-z0-9][a-z0-9_.\/-]*$/.test(trimmed);
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
      headers: corsHeaders,
    });
  }

  // Rate limiting
  const clientId = getClientId(req);
  if (!checkRateLimit(clientId)) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
      {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' }
      }
    );
  }

  try {
    const csrf = verifyCsrfProtection(req, { reason: '' });
    if (!csrf.ok) {
      console.log(JSON.stringify({ type: 'csrf.rejected', reason: csrf.reason, ip: req.headers.get('cf-connecting-ip') }));
      return new Response(
        JSON.stringify({ error: 'Forbidden', reason: csrf.reason }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
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
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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

      // Buffer the multipart body so we can set Content-Length. Some upstream
      // servers reject chunked multipart uploads; a known length is required.
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      if (req.body) {
        for await (const chunk of req.body) {
          chunks.push(chunk);
          totalBytes += chunk.length;
        }
      }
      const bodyBuffer = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        bodyBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      const forwardHeaders: Record<string, string> = {
        'x-api-key': effectiveApiKey,
        'content-type': contentType,
      };
      if (totalBytes > 0) {
        forwardHeaders['content-length'] = String(totalBytes);
      }

      const muapiResponse = await fetch(muapiUrl, {
        method: 'POST',
        headers: forwardHeaders,
        body: bodyBuffer,
      });

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
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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

      return new Response(
        JSON.stringify(result),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!validateEndpoint(endpoint)) {
      console.error(`[muapi-proxy] Blocked invalid endpoint: ${endpoint}`);
      return new Response(
        JSON.stringify({ error: 'Invalid endpoint' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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

    const method = (generationType === 'poll' || generationType === 'list') ? 'GET' : 'POST';
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'x-api-key': effectiveApiKey,
        ...(openaiApiKey ? { 'openai-api-key': openaiApiKey } : {}),
      }
    };

    if (method === 'POST') {
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    let result = await muapiResponse.json();
    result = unwrapResponse(result);

    console.log(`[muapi-proxy] Success: ${JSON.stringify(result).slice(0, 100)}`);

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
