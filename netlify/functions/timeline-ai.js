// netlify/functions/timeline-ai.js
// Paid generation for the Timeline Editor, on MuAPI only (no fal):
//   fill_gap        first + last frame → video that bridges a gap
//   extend_after    a clip's own video → a continuation
//   extend_before   a clip's first frame → a lead-in that ends on it
//   layers          image → separated layers (Seedream)
//   watermark_remove video → the same video without a watermark
//   shot_video       one still (storyboard frame) → a short clip
//   music            prompt (+ lyrics) → a music track or one composition section
//
// Submit/status like agent-audio.js: `submit` starts the MuAPI job and returns
// a requestId at once; the browser polls `status` (Netlify functions can't
// wait minutes for a render). Runs on the signed-in user's own MuAPI key
// (BYOK, X-MuAPI-Key); there is no platform-key fallback.

import { withClerkAuth } from './_shared/clerkAuth.js';
import { userMuapiKey, NEED_MUAPI_KEY, BAD_MUAPI_KEY } from './_shared/byok.js';
import { muapiPost } from './cinegenProviders.js';
import { liveModel, buildLivePayload } from '../../src/lib/muapi/liveCatalog.js';
import { findCatalogModel } from '../../src/lib/muapi/genericModels.js';
import {
  buildFirstLastFramePayload,
  buildVideoExtendPayload,
  buildExtendBeforePayload,
  buildLayerPayload,
  buildWatermarkPayload,
  buildImageToVideoPayload,
  buildMusicPayload,
  buildGenericPayload,
  resultUrls,
} from '../../src/lib/muapi/frameModels.js';

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const fail = (statusCode, code, message) => json(statusCode, { ok: false, error: { code, message } });

const STATIC_PATTERNS = ['/muapi/homepage/', '/muapi/demo/', '/muapi/sandbox/', '/static/demo/', '/webassets/', '/placeholder/'];
const realUrls = (data) => resultUrls(data).filter((u) => !STATIC_PATTERNS.some((p) => u.toLowerCase().includes(p)));

const BUILDERS = {
  fill_gap: buildFirstLastFramePayload,
  extend_after: buildVideoExtendPayload,
  extend_before: buildExtendBeforePayload,
  layers: buildLayerPayload,
  watermark_remove: buildWatermarkPayload,
  shot_video: buildImageToVideoPayload,
  music: buildMusicPayload,
  generate: buildGenericPayload, // any catalog model (Spaces)
};

// Light per-user throttle (per function instance).
const recent = new Map();
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 30;
function rateLimited(userId) {
  const now = Date.now();
  const list = (recent.get(userId) || []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  recent.set(userId, list);
  return list.length > MAX_PER_WINDOW;
}

/** Build the MuAPI request for a submit body. Exported for tests. */
export function buildSubmit(body = {}) {
  const build = BUILDERS[body.tool];
  if (!build) return { error: `Unknown tool: ${body.tool}` };
  try {
    return build(body.params || {});
  } catch (err) {
    return { error: err?.message || 'Invalid request' };
  }
}

export async function handle(body, userId, { keys = {}, post = muapiPost, fetchImpl } = {}) {
  if (!keys.muapi) return fail(401, 'need_key', NEED_MUAPI_KEY);

  if (body.action === 'submit') {
    if (rateLimited(userId || 'anon')) return fail(429, 'rate_limited', 'Too many AI requests — wait a few minutes.');
    let req;
    if (body.tool === 'generate' && body.params?.model && !findCatalogModel(body.params.model)) {
      // Not in the bundled snapshot: use MuAPI's live catalog (ElevenLabs, Whisper, Suno sounds, ...).
      try {
        const m = await liveModel(String(body.params.model), { fetchImpl });
        req = m ? buildLivePayload(m, body.params.inputs) : { error: `Unknown model: ${body.params.model}` };
      } catch (err) { req = { error: err?.message || 'Invalid request' }; }
    } else {
      req = buildSubmit(body);
    }
    if (req.error) return fail(400, 'bad_request', req.error);
    try {
      const res = await post(req.endpoint, req.payload, undefined, keys.muapi);
      const requestId = res.request_id || res.id;
      if (requestId) return json(200, { ok: true, status: 'pending', requestId: String(requestId), model: req.model });
      const urls = realUrls(res);
      return urls.length ? json(200, { ok: true, status: 'done', urls, url: urls[0], model: req.model }) : fail(502, 'provider_error', 'MuAPI returned no result.');
    } catch (err) {
      if ([401, 402, 403].includes(err?.status)) return fail(401, 'bad_key', BAD_MUAPI_KEY);
      console.error('[timeline-ai] submit failed', body.tool, err?.status || 'error');
      return fail(502, 'provider_error', 'MuAPI returned an error. Try again or pick another model.');
    }
  }

  if (body.action === 'status') {
    const id = String(body.requestId || '');
    if (!/^[A-Za-z0-9_-]{4,128}$/.test(id)) return fail(400, 'bad_request', 'Invalid requestId');
    try {
      const data = await post(`/predictions/${encodeURIComponent(id)}/result`, {}, undefined, keys.muapi);
      const status = String(data.status || '').toLowerCase();
      if (['completed', 'succeeded', 'success'].includes(status)) {
        const urls = realUrls(data);
        return urls.length ? json(200, { ok: true, status: 'done', urls, url: urls[0] }) : json(200, { ok: true, status: 'failed', error: 'No output was produced.' });
      }
      if (['failed', 'error'].includes(status)) return json(200, { ok: true, status: 'failed', error: String(data.error || 'Generation failed.').slice(0, 300) });
      return json(200, { ok: true, status: 'pending' });
    } catch (err) {
      if ([401, 402, 403].includes(err?.status)) return fail(401, 'bad_key', BAD_MUAPI_KEY);
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
  return handle(body, event.auth.userId, { keys: { muapi: userMuapiKey(event.headers) } });
});
