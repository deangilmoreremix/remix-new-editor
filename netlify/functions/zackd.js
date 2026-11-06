/**
 * Netlify function: zackd
 *
 * Backend for the Zack D studio (curiosity-loop 3D explainer shorts).
 * Adapted from https://github.com/Anil-matcha/zack-d-films-ai-video-generator
 * (MIT). Runs on the user's own keys (BYOK): X-OpenAI-Key for text steps,
 * X-MuAPI-Key for image / video / speech / music. Stateless: the browser holds
 * the project and calls one step at a time. MuAPI jobs outlive a function
 * invocation, so media steps are submit + status (poll).
 *
 * POST /api/zackd   (Clerk session required)
 *   { action: 'trends', query? }                       → { ok, topics: [{topic, hook, category}] }
 *   { action: 'script', topic, maxBeats? }             → { ok, map }   (normalized beat map)
 *   { action: 'submit', kind: 'image', prompt, aspect?, attempt? }
 *   { action: 'submit', kind: 'clip', imageUrl, prompt, attempt? }
 *   { action: 'submit', kind: 'tts', text, voice?, speed? }
 *   { action: 'submit', kind: 'music', prompt?, mood?, duration? }
 *   { action: 'submit', kind: 'captions', videoUrl, language?, theme? }   (burned-in captions, MuAPI ai-captions)
 *     → { ok, requestId, model, attempt, hasFallback } | { ok, status: 'done', url, model }
 *   { action: 'status', requestId }
 *     → { ok, status: 'pending' | 'done' | 'failed', url?, error? }
 */
import { withClerkAuth } from './_shared/clerkAuth.js';
import { muapiPost, extractRealUrl, musicPayload } from './cinegenProviders.js';
import {
  userMuapiKey, userOpenAIKey, NEED_MUAPI_KEY, NEED_OPENAI_KEY, BAD_MUAPI_KEY, openAIKeyError,
} from './_shared/byok.js';
import {
  ASPECT_RATIO, MODELS, CAPTION_LANGUAGES, CAPTION_THEMES, DEFAULT_CAPTION_LANGUAGE, DEFAULT_CAPTION_THEME, scriptInstructions, trendInstructions, parseJsonLoose, normalizeBeats, ttsPayload,
} from './_shared/zackdPrompts.js';

const RESPONSES_MODEL = process.env.OPENAI_RESPONSES_TEXT_MODEL || 'gpt-5.6-sol';
const TIMEOUT_MS = 90_000;
const RATE = { windowMs: 10 * 60_000, max: 150 };
const hits = new Map();
const IMAGE_ASPECTS = ['9:16', '16:9', '1:1'];

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const fail = (statusCode, code, message) => json(statusCode, { ok: false, error: { code, message } });

function rateLimited(userId) {
  const now = Date.now();
  const list = (hits.get(userId) || []).filter((t) => now - t < RATE.windowMs);
  list.push(now);
  hits.set(userId, list);
  return list.length > RATE.max;
}

function extractText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  return (data?.output || [])
    .filter((o) => o.type === 'message')
    .flatMap((m) => (m.content || []).filter((c) => c.type === 'output_text').map((c) => c.text))
    .join('\n')
    .trim();
}

/** One Responses API call returning parsed JSON, or throws { status, message }. */
async function llmJson(instructions, input, { apiKey, fetchImpl = fetch }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: RESPONSES_MODEL, instructions, input, store: false }),
      signal: controller.signal,
    });
  } catch (e) {
    throw Object.assign(new Error(e?.name === 'AbortError' ? 'The script service timed out.' : 'Could not reach the script service.'), { status: 502 });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const keyProblem = openAIKeyError(res.status);
    throw Object.assign(new Error(keyProblem || `The script service returned an error (${res.status}).`), { status: keyProblem ? res.status : 502 });
  }
  const parsed = parseJsonLoose(extractText(await res.json()));
  if (!parsed) throw Object.assign(new Error('The script service returned an unreadable answer. Try again.'), { status: 502 });
  return parsed;
}

/** Validated MuAPI submit request ({ endpoints: [...], payload }) or { error }. */
export function buildSubmit(body) {
  const attempt = Math.max(0, Math.min(1, Number(body.attempt) || 0));
  if (body.kind === 'image') {
    const prompt = String(body.prompt || '').trim();
    if (!prompt) return { error: 'prompt is required' };
    if (prompt.length > 2000) return { error: 'prompt is too long (max 2000 characters)' };
    const aspect = IMAGE_ASPECTS.includes(body.aspect) ? body.aspect : ASPECT_RATIO;
    return { models: MODELS.image, attempt, payload: { prompt, aspect_ratio: aspect } };
  }
  if (body.kind === 'clip') {
    const prompt = String(body.prompt || '').trim();
    const imageUrl = String(body.imageUrl || '').trim();
    if (!prompt) return { error: 'prompt is required' };
    if (!/^https:\/\/[^\s]{4,2000}$/.test(imageUrl)) return { error: 'imageUrl must be an https URL' };
    return { models: MODELS.clip, attempt, payload: { image_url: imageUrl, prompt: prompt.slice(0, 2000), aspect_ratio: ASPECT_RATIO, resolution: '720p' } };
  }
  if (body.kind === 'tts') {
    const text = String(body.text || '').trim();
    if (!text) return { error: 'text is required' };
    if (text.length > 3000) return { error: 'text is too long (max 3000 characters)' };
    return { models: [MODELS.tts], attempt: 0, payload: ttsPayload({ text, voice: body.voice, speed: body.speed }) };
  }
  if (body.kind === 'music') {
    return {
      models: ['suno-create-music'],
      attempt: 0,
      payload: musicPayload({
        prompt: String(body.prompt || 'Tense, curious, playful science documentary underscore').slice(0, 500),
        mood: body.mood ? String(body.mood).slice(0, 60) : 'curious',
        duration: body.duration,
        instrumental: true,
      }),
    };
  }
  if (body.kind === 'captions') {
    const videoUrl = String(body.videoUrl || '').trim();
    if (!/^https:\/\/[^\s]{4,2000}$/.test(videoUrl)) return { error: 'videoUrl must be an https URL' };
    return {
      models: [MODELS.captions],
      attempt: 0,
      payload: {
        video_url: videoUrl,
        language: CAPTION_LANGUAGES.includes(body.language) ? body.language : DEFAULT_CAPTION_LANGUAGE,
        theme: CAPTION_THEMES.some((t) => t.value === body.theme) ? body.theme : DEFAULT_CAPTION_THEME,
      },
    };
  }
  return { error: 'kind must be image, clip, tts, music or captions' };
}

async function submit(body, keys) {
  const req = buildSubmit(body);
  if (req.error) return fail(400, 'bad_request', req.error);
  let lastErr;
  // Start at the requested attempt; if that model's endpoint rejects the job outright, try the fallback once.
  for (let i = req.attempt; i < req.models.length; i += 1) {
    try {
      const res = await muapiPost(`/${req.models[i]}`, req.payload, undefined, keys.muapi);
      const out = { model: req.models[i], attempt: i, hasFallback: i < req.models.length - 1 };
      const requestId = res.request_id || res.id;
      if (requestId) return json(200, { ok: true, requestId: String(requestId), ...out });
      const url = extractRealUrl(res);
      if (url) return json(200, { ok: true, status: 'done', url, ...out });
      lastErr = new Error('no result');
    } catch (err) {
      if ([401, 402, 403].includes(err?.status)) return fail(401, 'bad_key', BAD_MUAPI_KEY);
      lastErr = err;
    }
  }
  console.error('[zackd] submit failed', lastErr?.status || 'error');
  return fail(502, 'provider_error', 'The media service rejected the job. Try again in a moment.');
}

const MUAPI_BASE = 'https://api.muapi.ai/api/v1';

/** MuAPI result lookup. The endpoint is GET-only (POST answers 405). */
async function muapiGet(path, key, fetchImpl = fetch) {
  const res = await fetchImpl(`${MUAPI_BASE}${path}`, { headers: { 'x-api-key': key } });
  if (!res.ok) throw Object.assign(new Error(`MuAPI ${path} failed: ${res.status}`), { status: res.status });
  return res.json();
}

async function status(body, keys, fetchImpl) {
  const id = String(body.requestId || '');
  if (!/^[A-Za-z0-9_-]{4,128}$/.test(id)) return fail(400, 'bad_request', 'Invalid requestId');
  try {
    const data = await muapiGet(`/predictions/${encodeURIComponent(id)}/result`, keys.muapi, fetchImpl);
    const st = String(data.status || '').toLowerCase();
    if (['completed', 'succeeded', 'success'].includes(st)) {
      // ai-captions answers with { video: <url> }; other models use outputs[0] / url.
      const url = extractRealUrl(data) || extractRealUrl({ url: typeof data.video === 'string' ? data.video : data.video?.url });
      return json(200, url ? { ok: true, status: 'done', url } : { ok: true, status: 'failed', error: 'Nothing was produced.' });
    }
    if (['failed', 'error'].includes(st)) return json(200, { ok: true, status: 'failed', error: 'Generation failed.' });
    return json(200, { ok: true, status: 'pending' });
  } catch (err) {
    if ([401, 402, 403].includes(err?.status)) return fail(401, 'bad_key', BAD_MUAPI_KEY);
    if (err?.status === 404) return json(200, { ok: true, status: 'failed', error: 'The job was not found.' });
    return json(200, { ok: true, status: 'pending' }); // transient (5xx / network): the client keeps polling until its own timeout
  }
}

export async function handle(body, userId, { fetchImpl = fetch, keys = {} } = {}) {
  const action = body?.action;
  const text = action === 'trends' || action === 'script';
  if (text && !keys.openai) return fail(401, 'need_key', NEED_OPENAI_KEY);
  if (!text && !keys.muapi) return fail(401, 'need_key', NEED_MUAPI_KEY);
  if (!['trends', 'script', 'submit', 'status'].includes(action)) return fail(400, 'bad_request', 'Unknown action');
  if (rateLimited(userId)) return fail(429, 'rate_limited', 'Too many requests. Wait a few minutes.');

  try {
    if (action === 'trends') {
      const query = String(body.query || '').trim().slice(0, 200);
      const out = await llmJson(trendInstructions(), query ? `Niche or keyword: ${query}` : 'Any strong topics right now.', { apiKey: keys.openai, fetchImpl });
      const topics = (Array.isArray(out.topics) ? out.topics : []).slice(0, 8)
        .map((t) => ({ topic: String(t?.topic || '').slice(0, 160), hook: String(t?.hook || '').slice(0, 300), category: String(t?.category || '').slice(0, 60) }))
        .filter((t) => t.topic);
      return topics.length ? json(200, { ok: true, topics }) : fail(502, 'provider_error', 'No topics came back. Try again.');
    }
    if (action === 'script') {
      const topic = String(body.topic || '').trim().slice(0, 200);
      if (!topic) return fail(400, 'bad_request', 'topic is required');
      const out = await llmJson(scriptInstructions({ maxBeats: body.maxBeats }), `Topic: ${topic}`, { apiKey: keys.openai, fetchImpl });
      return json(200, { ok: true, map: normalizeBeats(out, { topic }) });
    }
  } catch (err) {
    return fail(err?.status && err.status < 600 ? err.status : 502, 'provider_error', err?.message || 'Request failed.');
  }
  return action === 'submit' ? submit(body, keys) : status(body, keys, fetchImpl);
}

export const handler = withClerkAuth(async (event) => {
  if (event.httpMethod !== 'POST') return fail(405, 'method_not_allowed', 'Use POST');
  if ((event.body || '').length > 20_000) return fail(413, 'too_large', 'Request too large');
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return fail(400, 'bad_request', 'Body must be JSON'); }
  return handle(body, event.auth.userId, { keys: { muapi: userMuapiKey(event.headers), openai: userOpenAIKey(event.headers) } });
});
