import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Webhook-Signature",
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

// Map legacy endpoint names to current muapi API names
function normalizeLegacyEndpoint(endpoint: string): string {
  const map: Record<string, string> = {
    // Image generation - codebase adds -image suffix, muapi doesn't
    'flux-dev-image': 'flux-dev',
    'flux-schnell-image': 'flux-schnell',
    'flux-dev-lora': 'flux-dev-lora',
    // Video / I2V routes - already mostly correct
    'latentsync-video': 'latent-sync',
    'generate_wan_ai_effects': 'ai-video-effects',
    // Upscalers - muapi uses -er suffix
    'ai-image-upscale': 'ai-image-upscaler',
    'ai-video-upscaler': 'ai-video-upscaler',
    'video-watermark-remover': 'video-watermark-remover',
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

    const muapiKey = Deno.env.get('MUAPI_API_KEY');
    if (!muapiKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: API key not set' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const muapiUrl = `https://api.muapi.ai/api/v1/${normalizedEndpoint}`;

    console.log(`[muapi-proxy] Forwarding ${generationType ?? 'request'} to ${endpoint} (normalized: ${normalizedEndpoint})`);

    const contentType = req.headers.get('content-type') || '';
    const isMultipart = contentType.startsWith('multipart/');
    const method = (generationType === 'poll' || generationType === 'list') ? 'GET' : 'POST';
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'x-api-key': muapiKey
      }
    };

    if (isMultipart) {
      fetchOptions.body = req.body;
      (fetchOptions.headers as Record<string, string>)['content-type'] = contentType;
    } else if (method === 'POST') {
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
