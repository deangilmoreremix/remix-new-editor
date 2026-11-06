/**
 * Netlify function: cinegen (the editor's AI Tools)
 *
 * Four tools, each one MuAPI job, run on the user's own MuAPI key (BYOK, sent
 * as X-MuAPI-Key; see _shared/byok.js). Jobs can take longer than a function
 * may run, so the browser submits and then polls (the agent-audio pattern).
 * Nothing here needs a platform key or any other server.
 *
 * POST /api/cinegen   (Clerk session required)
 *   { action: 'submit', tool, params } → { ok, requestId } | { ok, status: 'done', result }
 *   { action: 'status', tool, requestId, params? } → { ok, status: 'pending'|'done'|'failed', result?, error? }
 *
 * tool:
 *   fill_gap       first (and optional last) frame URL → bridging clip
 *   extend         source frame URL → a clip that continues it
 *   element_create prompt → an image to reuse
 *   shot_board     prompt → several storyboard images
 */
import { withClerkAuth } from './_shared/clerkAuth.js';
import { userMuapiKey, NEED_MUAPI_KEY, BAD_MUAPI_KEY } from './_shared/byok.js';
import { muapiPost, extractRealUrl } from './cinegenProviders.js';

export const TOOLS = ['fill_gap', 'extend', 'element_create', 'shot_board', 'generate'];
export const VIDEO_MODELS = ['seedance-lite-t2v', 'seedance-pro-t2v', 'seedance-pro-t2v-fast'];
const VIDEO_MODEL = 'seedance-2.5-first-last-frame';
const RATE = { windowMs: 10 * 60_000, max: 30 };
const hits = new Map();

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const fail = (statusCode, code, message) => json(statusCode, { ok: false, error: { code, message } });

function rateLimited(userId) {
  const now = Date.now();
  const list = (hits.get(userId) || []).filter((t) => now - t < RATE.windowMs);
  list.push(now);
  hits.set(userId, list);
  return list.length > RATE.max;
}

const clamp = (v, lo, hi, fallback) => Math.min(hi, Math.max(lo, Number.isFinite(Number(v)) ? Number(v) : fallback));
const text = (v, max = 1000) => String(v ?? '').trim().slice(0, max);
const httpUrl = (v) => {
  const s = String(v ?? '').trim();
  return /^https?:\/\/[^\s]{4,2000}$/i.test(s) ? s : '';
};
const ASPECTS = ['1:1', '16:9', '9:16', '4:3', '3:4'];

/** Validated MuAPI request for a tool, or { error }. */
export function buildToolRequest(tool, p = {}) {
  if (tool === 'fill_gap') {
    const first = httpUrl(p.firstFrameUrl);
    if (!first) return { error: 'The frame at the start of the gap is required (an image link).' };
    const last = httpUrl(p.lastFrameUrl) || first;
    return {
      endpoint: '/image-to-video',
      payload: { model: VIDEO_MODEL, first_frame_url: first, last_frame_url: last, prompt: text(p.prompt) || 'Seamless bridge footage', duration: clamp(p.duration, 2, 15, 5) },
    };
  }
  if (tool === 'extend') {
    const src = httpUrl(p.sourceFrameUrl);
    if (!src) return { error: 'The last frame of the clip is required (an image link).' };
    return {
      endpoint: '/image-to-video',
      payload: { model: VIDEO_MODEL, first_frame_url: src, prompt: text(p.prompt) || 'Seamless extension of the previous clip', duration: clamp(p.addedDuration, 1, 15, 5), prompt_extend: true },
    };
  }
  if (tool === 'element_create') {
    const prompt = text(p.prompt);
    if (!prompt) return { error: 'Describe the element to create.' };
    const payload = { model: 'flux-dev', prompt };
    if (ASPECTS.includes(p.aspect_ratio)) payload.aspect_ratio = p.aspect_ratio;
    return { endpoint: '/generate-image', payload };
  }
  if (tool === 'shot_board') {
    const prompt = text(p.prompt);
    if (!prompt) return { error: 'Describe the story to storyboard.' };
    const style = text(p.style, 60) || 'cinematic';
    const aspect = ASPECTS.includes(p.aspect_ratio) ? p.aspect_ratio : '16:9';
    return {
      endpoint: '/generate-image',
      payload: { model: 'flux-dev', prompt: `Shot board: ${prompt}. Style: ${style}. Aspect ratio: ${aspect}.`, aspect_ratio: aspect, n: clamp(p.count, 1, 8, 4) },
    };
  }
  if (tool === 'generate') {
    const prompt = text(p.prompt);
    if (!prompt) return { error: 'Describe what to generate.' };
    const negative = text(p.negative_prompt, 500);
    const aspect = ASPECTS.includes(p.aspect_ratio) ? p.aspect_ratio : '16:9';
    if (p.kind === 'image') {
      const payload = { model: 'flux-dev', prompt: p.style ? `${prompt}. Style: ${text(p.style, 60)}.` : prompt, aspect_ratio: aspect };
      if (negative) payload.negative_prompt = negative;
      return { endpoint: '/generate-image', payload };
    }
    const model = VIDEO_MODELS.includes(p.model) ? p.model : VIDEO_MODELS[0];
    const payload = { prompt: p.style ? `${prompt}. Style: ${text(p.style, 60)}.` : prompt, aspect_ratio: aspect, duration: clamp(p.duration, 3, 12, 5) };
    if (negative) payload.negative_prompt = negative;
    return { endpoint: `/${model}`, payload };
  }
  return { error: 'Unsupported tool' };
}

/** A finished MuAPI job → the result the editor uses. */
export function normalizeResult(tool, data, p = {}) {
  const requestId = data?.request_id || data?.id || null;
  if (tool === 'shot_board') {
    const urls = (Array.isArray(data?.outputs) ? data.outputs : []).map((u) => extractRealUrl({ url: u })).filter(Boolean);
    return urls.length ? { success: true, tool, urls, count: urls.length, requestId } : { success: false, tool, error: 'The provider returned no images.' };
  }
  const url = extractRealUrl(data);
  if (!url) return { success: false, tool, error: 'The provider returned no usable result.' };
  if (tool === 'generate') return { success: true, tool, url, kind: p.kind === 'image' ? 'image' : 'video', duration: clamp(p.duration, 3, 12, 5), requestId };
  if (tool === 'fill_gap') return { success: true, tool, url, duration: clamp(p.duration, 2, 15, 5), requestId };
  if (tool === 'extend') return { success: true, tool, url, addedDuration: clamp(p.addedDuration, 1, 15, 5), direction: 'after', requestId };
  return { success: true, tool, url, element: { name: text(p.name, 60) || 'Element', type: 'image', description: text(p.prompt), url }, requestId };
}

const authFailure = (err) => (err?.status === 401 || err?.status === 402 || err?.status === 403) ? fail(401, 'bad_key', BAD_MUAPI_KEY) : null;

export async function handle(body, userId, { key = null, post = muapiPost } = {}) {
  if (!key) return fail(401, 'need_key', NEED_MUAPI_KEY);
  const tool = String(body.tool || '');
  if (!TOOLS.includes(tool)) return fail(400, 'bad_request', 'Unsupported tool');
  const params = body.params && typeof body.params === 'object' ? body.params : {};

  if (body.action === 'submit') {
    if (rateLimited(userId)) return fail(429, 'rate_limited', 'Too many AI tool requests. Wait a few minutes.');
    const req = buildToolRequest(tool, params);
    if (req.error) return fail(400, 'bad_request', req.error);
    try {
      const res = await post(req.endpoint, req.payload, undefined, key);
      const requestId = res.request_id || res.id;
      if (requestId) return json(200, { ok: true, requestId: String(requestId) });
      return json(200, { ok: true, status: 'done', result: normalizeResult(tool, res, params) });
    } catch (err) {
      const auth = authFailure(err);
      if (auth) return auth;
      console.error('[cinegen] submit failed', tool, err?.status || 'error');
      return fail(502, 'provider_error', 'The AI service returned an error.');
    }
  }

  if (body.action === 'status') {
    const id = String(body.requestId || '');
    if (!/^[A-Za-z0-9_-]{4,128}$/.test(id)) return fail(400, 'bad_request', 'Invalid requestId');
    try {
      const data = await post(`/predictions/${encodeURIComponent(id)}/result`, {}, undefined, key);
      const status = String(data.status || '').toLowerCase();
      if (['completed', 'succeeded', 'success'].includes(status)) return json(200, { ok: true, status: 'done', result: normalizeResult(tool, data, params) });
      if (['failed', 'error'].includes(status)) return json(200, { ok: true, status: 'failed', error: 'The AI service could not make this.' });
      return json(200, { ok: true, status: 'pending' });
    } catch (err) {
      const auth = authFailure(err);
      if (auth) return auth;
      return json(200, { ok: true, status: 'pending' }); // transient: the browser keeps polling until its timeout
    }
  }
  return fail(400, 'bad_request', 'Unknown action');
}

export const handler = withClerkAuth(async (event) => {
  if (event.httpMethod !== 'POST') return fail(405, 'method_not_allowed', 'Use POST');
  if ((event.body || '').length > 20_000) return fail(413, 'too_large', 'Request too large');
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return fail(400, 'bad_request', 'Body must be JSON'); }
  return handle(body, event.auth.userId, { key: userMuapiKey(event.headers) });
});
