/**
 * Netlify function: agent-audio
 *
 * Voiceover (text-to-speech) and background music for the timeline
 * editor (AI Agent and Smart Speech), generated on server keys:
 *   - MiniMax Speech HD through MuAPI (MUAPI_API_KEY): narration, default
 *   - OpenAI text-to-speech (OPENAI_API_KEY): gpt-4o-mini-tts, optional
 *   - Suno through MuAPI: music
 * MuAPI generation can take minutes, longer than a function may run, so
 * the browser submits a job and then polls for its result. OpenAI speech
 * is synchronous and comes back as a data: URL.
 *
 * POST /api/agent-audio   (Clerk session required)
 *   { action: 'submit', kind: 'tts', text, voice, speed, pitch? }               (MiniMax)
 *   { action: 'submit', kind: 'tts', provider: 'openai', text, voice, speed, instructions? }
 *   { action: 'submit', kind: 'music', prompt, genre, mood, duration }
 *     → { ok, requestId } | { ok, status: 'done', url }
 *   { action: 'status', requestId }
 *     → { ok, status: 'pending' | 'done' | 'failed', url?, error? }
 */
import { withClerkAuth } from './_shared/clerkAuth.js';
import { muapiPost, extractRealUrl, musicPayload } from './cinegenProviders.js';

export const VOICES = [
  'Wise_Woman', 'Friendly_Person', 'Inspirational_girl', 'Deep_Voice_Man', 'Calm_Woman', 'Casual_Guy',
  'Lively_Girl', 'Patient_Man', 'Young_Knight', 'Determined_Man', 'Lovely_Girl', 'Decent_Boy',
  'Imposing_Manner', 'Elegant_Man', 'Abbess', 'Sweet_Girl_2', 'Exuberant_Girl',
];
const TTS_MODEL = process.env.MUAPI_TTS_MODEL || 'minimax-speech-2.6-hd';

// OpenAI speech (https://platform.openai.com/docs/guides/text-to-speech).
// OpenAI's usage policy requires telling listeners the voice is AI-generated;
// the published player shows that notice.
export const OPENAI_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
const OPENAI_MAX_CHARS = 1500; // keeps the base64 reply well under the function response limit
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

/** Validated MuAPI request for a submit body, or an error string. */
export function buildRequest(body) {
  if (body.kind === 'tts' && body.provider === 'openai') {
    const text = String(body.text || '').trim();
    if (!text) return { error: 'text is required' };
    if (text.length > OPENAI_MAX_CHARS) return { error: `text is too long (max ${OPENAI_MAX_CHARS} characters)` };
    const payload = {
      model: OPENAI_TTS_MODEL,
      input: text,
      voice: OPENAI_VOICES.includes(body.voice) ? body.voice : 'marin',
      speed: Math.max(0.25, Math.min(4, Number(body.speed) || 1)),
      response_format: 'mp3',
    };
    const instructions = String(body.instructions || '').trim().slice(0, 500);
    if (instructions && !/^tts-1/.test(OPENAI_TTS_MODEL)) payload.instructions = instructions;
    return { provider: 'openai', payload };
  }
  if (body.kind === 'tts') {
    const text = String(body.text || '').trim();
    if (!text) return { error: 'text is required' };
    if (text.length > 3000) return { error: 'text is too long (max 3000 characters)' };
    const voice = VOICES.includes(body.voice) ? body.voice : 'Wise_Woman';
    const speed = Math.max(0.5, Math.min(2, Number(body.speed) || 1));
    const pitch = Math.max(-12, Math.min(12, Math.round(Number(body.pitch) || 0)));
    return { endpoint: `/${TTS_MODEL}`, payload: { prompt: text, text, voice_id: voice, voice, speed, ...(pitch ? { pitch } : {}) } };
  }
  if (body.kind === 'music') {
    if (!body.prompt && !body.genre && !body.mood) return { error: 'prompt, genre or mood is required' };
    return {
      endpoint: '/suno-create-music',
      payload: musicPayload({
        prompt: String(body.prompt || '').slice(0, 500), genre: body.genre ? String(body.genre).slice(0, 60) : undefined,
        mood: body.mood ? String(body.mood).slice(0, 60) : undefined, duration: body.duration, instrumental: true,
      }),
    };
  }
  return { error: 'kind must be tts or music' };
}

/** OpenAI speech → data: URL (mp3). */
export async function openaiSpeech(payload, { fetchImpl = fetch, apiKey = process.env.OPENAI_API_KEY } = {}) {
  const res = await fetchImpl('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`OpenAI speech HTTP ${res.status} ${detail.slice(0, 200)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:audio/mpeg;base64,${buf.toString('base64')}`;
}

export async function handle(body, userId, { fetchImpl = fetch } = {}) {
  const openai = body.action === 'submit' && body.kind === 'tts' && body.provider === 'openai';
  if (openai && !process.env.OPENAI_API_KEY) return fail(503, 'not_configured', 'OpenAI voices are not configured on the server (OPENAI_API_KEY).');
  if (!openai && !process.env.MUAPI_API_KEY) return fail(503, 'not_configured', 'Voiceover and music are not configured on the server (MUAPI_API_KEY).');
  if (body.action === 'submit') {
    if (rateLimited(userId)) return fail(429, 'rate_limited', 'Too many audio requests — wait a few minutes.');
    const req = buildRequest(body);
    if (req.error) return fail(400, 'bad_request', req.error);
    if (req.provider === 'openai') {
      try {
        return json(200, { ok: true, status: 'done', url: await openaiSpeech(req.payload, { fetchImpl }) });
      } catch (err) {
        console.error('[agent-audio] openai failed', err?.message);
        return fail(502, 'provider_error', 'The OpenAI voice service returned an error.');
      }
    }
    try {
      const res = await muapiPost(req.endpoint, req.payload);
      const requestId = res.request_id || res.id;
      if (requestId) return json(200, { ok: true, requestId: String(requestId) });
      const url = extractRealUrl(res);
      return url ? json(200, { ok: true, status: 'done', url }) : fail(502, 'provider_error', 'The audio service returned no result.');
    } catch (err) {
      console.error('[agent-audio] submit failed', err?.message);
      return fail(502, 'provider_error', 'The audio service returned an error.');
    }
  }
  if (body.action === 'status') {
    const id = String(body.requestId || '');
    if (!/^[A-Za-z0-9_-]{4,128}$/.test(id)) return fail(400, 'bad_request', 'Invalid requestId');
    try {
      const data = await muapiPost(`/predictions/${encodeURIComponent(id)}/result`, {});
      const status = String(data.status || '').toLowerCase();
      if (['completed', 'succeeded', 'success'].includes(status)) {
        const url = extractRealUrl(data);
        return url ? json(200, { ok: true, status: 'done', url }) : json(200, { ok: true, status: 'failed', error: 'No audio was produced.' });
      }
      if (['failed', 'error'].includes(status)) return json(200, { ok: true, status: 'failed', error: 'Generation failed.' });
      return json(200, { ok: true, status: 'pending' });
    } catch (err) {
      console.error('[agent-audio] status failed', err?.message);
      return json(200, { ok: true, status: 'pending' }); // transient — the client keeps polling until its timeout
    }
  }
  return fail(400, 'bad_request', 'Unknown action');
}

export const handler = withClerkAuth(async (event) => {
  if (event.httpMethod !== 'POST') return fail(405, 'method_not_allowed', 'Use POST');
  if ((event.body || '').length > 20_000) return fail(413, 'too_large', 'Request too large');
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return fail(400, 'bad_request', 'Body must be JSON'); }
  return handle(body, event.auth.userId);
});
