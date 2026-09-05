/**
 * Netlify function: pixabay-search
 *
 * Server-side proxy for Pixabay image + video search.
 * Keeps the PIXABAY_API_KEY secret on the server.
 *
 * POST body: {
 *   type: 'images' | 'videos',
 *   query: string,
 *   page?: number,
 *   perPage?: number,
 *   orientation?: 'all' | 'horizontal' | 'vertical',
 *   minDuration?: number,  // videos only
 *   maxDuration?: number,  // videos only
 * }
 *
 * Returns: { ok: true, hits: [...], total: number }
 *       or { ok: false, error: string }
 *
 * Pixabay API docs:
 *   - Images: GET https://pixabay.com/api/?key=...&q=...&image_type=photo
 *   - Videos: GET https://pixabay.com/api/videos/?key=...&q=...
 */

const TIMEOUT_MS = 30_000;

const fetchWithTimeout = async (url, options = {}, timeoutMs = TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders() };
  }
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed' });
  }

  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) {
    return jsonResponse(503, { ok: false, error: 'PIXABAY_API_KEY not configured on server' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { ok: false, error: 'Invalid JSON body' });
  }

  const { type = 'images', query = '', page = 1, perPage = 15, orientation, minDuration, maxDuration } = body;

  // Build Pixabay URL
  const base = type === 'videos'
    ? 'https://pixabay.com/api/videos/'
    : 'https://pixabay.com/api/';

  const params = new URLSearchParams({
    key: apiKey,
    q: query || '',
    page: String(page),
    per_page: String(Math.min(Math.max(perPage, 3), 200)),
  });

  if (type === 'images') {
    params.set('image_type', 'photo');
    if (orientation && orientation !== 'all') {
      params.set('orientation', orientation);
    }
  } else {
    if (minDuration) params.set('min_duration', String(minDuration));
    if (maxDuration) params.set('max_duration', String(maxDuration));
  }

  const url = `${base}?${params.toString()}`;

  let res;
  try {
    res = await fetchWithTimeout(url, { headers: { 'Accept': 'application/json' } });
  } catch (e) {
    const msg = e?.name === 'AbortError' ? 'Pixabay request timed out' : `Network error: ${e?.message || 'unknown'}`;
    return jsonResponse(502, { ok: false, error: msg });
  }

  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch {}
    return jsonResponse(res.status, { ok: false, error: `Pixabay API error (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ''}` });
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return jsonResponse(502, { ok: false, error: 'Invalid JSON from Pixabay' });
  }

  return jsonResponse(200, {
    ok: true,
    hits: data.hits || [],
    total: data.total || 0,
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
    body: JSON.stringify(body),
  };
}
