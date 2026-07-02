import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BACKEND_URL = Deno.env.get('VIDEO_AGENT_BACKEND_URL') || '';

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function proxyRequest(targetPath: string, init: RequestInit) {
  if (!BACKEND_URL) {
    return jsonResponse({ error: 'VIDEO_AGENT_BACKEND_URL is not configured' }, 500);
  }

  const target = `${BACKEND_URL.replace(/\/$/, '')}${targetPath}`;
  return fetch(target, init).then(async (response) => {
    const contentType = response.headers.get('content-type') || 'application/json';
    const data = contentType.includes('application/json') ? await response.json() : await response.text();
    return jsonResponse(data as Record<string, unknown>, response.status);
  }).catch((error) => {
    return jsonResponse({ error: 'Video agent proxy failed', message: error.message }, 502);
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const url = new URL(req.url);
  const jobId = url.searchParams.get('jobId');

  if (req.method === "GET" && jobId) {
    return proxyRequest(`/videoagent/job/${encodeURIComponent(jobId)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  if (req.method === "POST") {
    let body = {};
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    if (req.url.includes('/workflow')) {
      return proxyRequest('/videoagent/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }

    return proxyRequest('/videoagent/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
});
