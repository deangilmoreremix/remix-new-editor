/**
 * Netlify function: watch-voice (public, no sign-in)
 *
 * Smart Speech personalized lines for the published player (/watch/<id>):
 * "Hi {{firstname}}" spoken with the viewer's name from the link. The text
 * always comes from the published project, never from the request; the
 * viewer only supplies token values, which are cleaned and length-limited.
 * When a value is missing the player keeps the clip's pre-rendered
 * fallback audio.
 *
 * BYOK: SmartVid runs on each user's own keys, which stay in their browser, so
 * a viewer's request has no key to use. This function only speaks when a
 * platform key is configured (MUAPI_API_KEY / OPENAI_API_KEY); otherwise it
 * answers 503 and the player plays the fallback line.
 *
 * POST /api/watch-voice
 *   { action: 'submit', publishedId, clipId, tokens: { firstname: 'Ann' } }
 *     → { ok, status: 'done', url } | { ok, requestId } | 422 use_fallback
 *   { action: 'status', requestId }
 *     → { ok, status: 'pending' | 'done' | 'failed', url? }
 */
import { createHash } from 'node:crypto';
import { muapiPost, extractRealUrl } from './cinegenProviders.js';
import { buildRequest, openaiSpeech } from './agent-audio.js';

export const MAX_LINE = 70; // personalized line limit (upstream: 70 characters)
const MAX_RESOLVED = 140;
const RATE = { windowMs: 10 * 60_000, max: 20 };
const hits = new Map();
const cache = new Map(); // hash → url (MiniMax CDN link or OpenAI data URL)
const CACHE_MAX = 200;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});
const fail = (statusCode, code, message) => json(statusCode, { ok: false, error: { code, message } });

function rateLimited(key) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < RATE.windowMs);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.delete(hits.keys().next().value);
  return list.length > RATE.max;
}

function remember(key, url) {
  cache.set(key, url);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
}

const normKey = (k) => String(k).toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Token value a viewer may send: letters, digits, spaces and simple punctuation. */
export function cleanTokenValue(v) {
  return String(v ?? '').normalize('NFC').replace(/[^\p{L}\p{N} .,'&-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 40);
}

/**
 * Fill {{tokens}} (also {{d token "default"}}) from the viewer's values.
 * Returns null when a token has no value, so the player keeps the fallback.
 */
export function resolveLine(template, tokens = {}) {
  const values = {};
  Object.entries(tokens || {}).forEach(([k, v]) => {
    const clean = cleanTokenValue(v);
    if (clean) values[normKey(k)] = clean;
  });
  let missing = false;
  const text = String(template || '').replace(/\{\{\s*(?:d\s+)?([a-zA-Z0-9_ -]+?)(?:\s+"([^"]*)")?\s*\}\}/g, (_, name, def) => {
    const v = values[normKey(name)] || cleanTokenValue(def);
    if (!v) missing = true;
    return v || '';
  });
  return missing ? null : text.replace(/\s+/g, ' ').trim();
}

/** The Smart Speech clip of a published project, or null. */
export function findVoiceClip(project, clipId) {
  for (const track of project?.tracks || []) {
    for (const clip of track.items || track.clips || []) {
      if (String(clip.id) === String(clipId) && clip.tts?.personalized) return clip;
    }
  }
  return null;
}

async function loadProject(publishedId, { fetchImpl }) {
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw Object.assign(new Error('not configured'), { code: 'not_configured' });
  // The table is not publicly readable; get_published_video() returns the
  // sanitized project of a published video (null when missing / unpublished).
  const res = await fetchImpl(`${url}/rest/v1/rpc/get_published_video`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ p_id: publishedId }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const video = await res.json();
  return video?.project || null;
}

export async function handle(body, { ip = 'unknown', fetchImpl = fetch } = {}) {
  if (body.action === 'status') {
    const id = String(body.requestId || '');
    if (!/^[A-Za-z0-9_-]{4,128}$/.test(id)) return fail(400, 'bad_request', 'Invalid requestId');
    if (!process.env.MUAPI_API_KEY) return fail(503, 'not_configured', 'Voice service is not configured');
    try {
      const data = await muapiPost(`/predictions/${encodeURIComponent(id)}/result`, {});
      const status = String(data.status || '').toLowerCase();
      if (['completed', 'succeeded', 'success'].includes(status)) {
        const url = extractRealUrl(data);
        if (url && body.cacheKey && /^[a-f0-9]{64}$/.test(body.cacheKey)) remember(body.cacheKey, url);
        return json(200, url ? { ok: true, status: 'done', url } : { ok: true, status: 'failed' });
      }
      if (['failed', 'error'].includes(status)) return json(200, { ok: true, status: 'failed' });
      return json(200, { ok: true, status: 'pending' });
    } catch {
      return json(200, { ok: true, status: 'pending' });
    }
  }
  if (body.action !== 'submit') return fail(400, 'bad_request', 'Unknown action');
  const publishedId = String(body.publishedId || '');
  if (!/^[A-Za-z0-9_-]{8,32}$/.test(publishedId)) return fail(400, 'bad_request', 'Invalid video');
  if (rateLimited(ip)) return fail(429, 'rate_limited', 'Too many requests');

  let project;
  try {
    project = await loadProject(publishedId, { fetchImpl });
  } catch (err) {
    if (err.code === 'not_configured') return fail(503, 'not_configured', 'Voice service is not configured');
    return fail(502, 'upstream_error', 'Could not load the video');
  }
  const clip = project && findVoiceClip(project, body.clipId);
  if (!clip) return fail(404, 'not_found', 'No personalized voice for this clip');
  const tts = clip.tts;
  if (String(tts.text || '').length > MAX_LINE) return fail(422, 'use_fallback', 'Line too long to personalize');
  const line = resolveLine(tts.text, body.tokens);
  if (!line || line.length > MAX_RESOLVED) return fail(422, 'use_fallback', 'Missing personalization values');

  const provider = tts.provider === 'openai' ? 'openai' : 'minimax';
  const req = buildRequest({ kind: 'tts', provider, text: line, voice: tts.voice, speed: tts.speed, pitch: tts.pitch, instructions: tts.instructions });
  if (req.error) return fail(422, 'use_fallback', req.error);
  const cacheKey = createHash('sha256').update(JSON.stringify([provider, req.payload])).digest('hex');
  if (cache.has(cacheKey)) return json(200, { ok: true, status: 'done', url: cache.get(cacheKey), cached: true });

  if (provider === 'openai') {
    if (!process.env.OPENAI_API_KEY) return fail(503, 'not_configured', 'Voice service is not configured');
    try {
      const url = await openaiSpeech(req.payload, { fetchImpl });
      remember(cacheKey, url);
      return json(200, { ok: true, status: 'done', url });
    } catch (err) {
      console.error('[watch-voice] openai failed', err?.message);
      return fail(502, 'provider_error', 'Voice generation failed');
    }
  }
  if (!process.env.MUAPI_API_KEY) return fail(503, 'not_configured', 'Voice service is not configured');
  try {
    const res = await muapiPost(req.endpoint, req.payload);
    const requestId = res.request_id || res.id;
    if (requestId) return json(200, { ok: true, requestId: String(requestId), cacheKey });
    const url = extractRealUrl(res);
    if (url) remember(cacheKey, url);
    return url ? json(200, { ok: true, status: 'done', url }) : fail(502, 'provider_error', 'Voice generation failed');
  } catch (err) {
    console.error('[watch-voice] minimax failed', err?.message);
    return fail(502, 'provider_error', 'Voice generation failed');
  }
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') return fail(405, 'method_not_allowed', 'Use POST');
  if ((event.body || '').length > 4000) return fail(413, 'too_large', 'Request too large');
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return fail(400, 'bad_request', 'Body must be JSON'); }
  const ip = event.headers?.['x-nf-client-connection-ip'] || event.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  return handle(body, { ip });
}
