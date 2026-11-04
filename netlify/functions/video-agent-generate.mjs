/* global Request, Response */
/**
 * Netlify function (v2, streaming): video-agent-generate
 *
 * SmartVid Video Agent = port of Remotion's prompt-to-motion-graphics template.
 * The template's Next.js API route lives in apps/motion-agent/server/generate-route.ts
 * and is bundled (with its skill guides) into ./_shared/videoAgentGenerate.generated.mjs.
 * This wrapper only checks the user's key and request limits; generation, prompt
 * validation, skill detection, targeted edits and the SSE stream are the template's.
 *
 * BYOK: the request runs on the user's own OpenAI key (SmartVid's API key modal),
 * sent as X-OpenAI-Key. No platform key fallback. The key is only forwarded to OpenAI:
 * never logged, stored or echoed back.
 *
 * POST /.netlify/functions/video-agent-generate   (X-OpenAI-Key: sk-...)
 * Env (optional): VIDEO_AGENT_MODEL, VIDEO_AGENT_CLASSIFIER_MODEL.
 */
import { POST } from './_shared/videoAgentGenerate.generated.mjs';

export const NEED_KEY_MESSAGE = 'The Video Agent uses your own OpenAI key. Add it in SmartVid → Settings → API keys (OpenAI API Key).';
const KEY_RE = /^sk-[A-Za-z0-9_-]{20,}$/;

const MAX_BODY_BYTES = 6 * 1024 * 1024; // attached reference frames are base64 data URLs

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const apiKey = (req.headers.get('x-openai-key') || '').trim();
  if (!KEY_RE.test(apiKey)) return json(401, { error: NEED_KEY_MESSAGE });

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: 'Request too large. Attach fewer or smaller images.' });

  let body;
  try {
    body = JSON.parse(raw || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }
  if (typeof body.prompt !== 'string' || !body.prompt.trim()) return json(400, { error: 'Missing prompt' });

  return POST(new Request(req.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-OpenAI-Key': apiKey }, body: raw }));
};
