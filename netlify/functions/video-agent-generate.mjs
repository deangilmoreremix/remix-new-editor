/* global Request, Response */
/**
 * Netlify function (v2, streaming): video-agent-generate
 *
 * SmartVid Video Agent = port of Remotion's prompt-to-motion-graphics template.
 * The template's Next.js API route lives in apps/motion-agent/server/generate-route.ts
 * and is bundled (with its skill guides) into ./_shared/videoAgentGenerate.generated.mjs.
 * This wrapper only adds Clerk session auth and request limits; generation, prompt
 * validation, skill detection, targeted edits and the SSE stream are the template's.
 *
 * POST /.netlify/functions/video-agent-generate   (Authorization: Bearer <Clerk token>)
 * Env: OPENAI_API_KEY (required), VIDEO_AGENT_MODEL, VIDEO_AGENT_CLASSIFIER_MODEL (optional).
 */
import { verifyClerkToken } from './_shared/clerkAuth.js';
import { POST } from './_shared/videoAgentGenerate.generated.mjs';

const MAX_BODY_BYTES = 6 * 1024 * 1024; // attached reference frames are base64 data URLs

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token || !(await verifyClerkToken(token))) {
    return json(401, { error: 'Please sign in to SmartVid to use the Video Agent.' });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: 'Request too large. Attach fewer or smaller images.' });

  let body;
  try {
    body = JSON.parse(raw || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }
  if (typeof body.prompt !== 'string' || !body.prompt.trim()) return json(400, { error: 'Missing prompt' });

  return POST(new Request(req.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw }));
};
