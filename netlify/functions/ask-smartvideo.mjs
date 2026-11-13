/**
 * Ask SmartVideo — in-app help assistant endpoint (POST /api/ask-smartvideo).
 *
 * Retrieval-grounded: the question is matched against the studio registry
 * (_shared/askSearch.js) and only those sources are given to the model. BYOK:
 * runs on the caller's own OpenAI key (X-OpenAI-Key), never a platform key.
 * Streams Server-Sent Events: `sources`, `delta`*, `done` | `error`.
 */
import { verifyClerkToken } from './_shared/clerkAuth.js';
import { userOpenAIKey, NEED_OPENAI_KEY, openAIKeyError } from './_shared/byok.js';
import { search, sanitizeMessages, retrievalQuery, buildSourcesBlock, SYSTEM_PROMPT, NO_ANSWER } from './_shared/askSearch.js';

const MODEL = () => process.env.ASK_SMARTVIDEO_MODEL || 'gpt-4o-mini';
const TIMEOUT_MS = 45_000;

// Best-effort limiter. State is per function instance, so the real ceiling is
// higher on a busy deployment; the user's own OpenAI account is the hard limit.
const PER_MIN = 10;
const PER_DAY = 150;
const hits = new Map();
export function rateLimited(userId, now = Date.now()) {
  const arr = (hits.get(userId) || []).filter((t) => now - t < 86_400_000);
  const recent = arr.filter((t) => now - t < 60_000).length;
  if (recent >= PER_MIN || arr.length >= PER_DAY) { hits.set(userId, arr); return recent >= PER_MIN ? 60 : 3600; }
  arr.push(now);
  hits.set(userId, arr);
  return 0;
}

const json = (status, body, extra = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
});
const sse = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
const publicSource = (r, i) => ({
  id: `S${i + 1}`, title: r.chunk.title, url: r.chunk.url, kind: r.chunk.kind, studioId: r.chunk.studioId,
  ...(r.chunk.studios ? { studios: r.chunk.studios } : {}), ...(r.chunk.guideUrl ? { guideUrl: r.chunk.guideUrl } : {}),
});

/** Parse OpenAI's SSE stream, tolerating `data:` lines split across network chunks. */
export async function* openAIDeltas(body) {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (value) buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch { /* incomplete JSON can't happen here: lines are only parsed once complete */ }
    }
    if (done) return;
  }
}

export async function handle(req, { fetchImpl = fetch, verify = verifyClerkToken } = {}) {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' }, { Allow: 'POST' });

  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const auth = await verify(bearer);
  if (!auth?.userId) return json(401, { error: 'Sign in to use Ask SmartVideo.', code: 'auth' });

  const key = userOpenAIKey(Object.fromEntries(req.headers));
  if (!key) return json(409, { error: NEED_OPENAI_KEY, code: 'need_key' });

  let payload;
  try { payload = await req.json(); } catch { return json(400, { error: 'Invalid JSON body.' }); }
  const messages = sanitizeMessages(payload?.messages);
  if (!messages) return json(400, { error: 'Send a question to ask.' });

  const retryAfter = rateLimited(auth.userId);
  if (retryAfter) return json(429, { error: 'You are asking too fast. Please wait a moment.', code: 'rate' }, { 'Retry-After': String(retryAfter) });

  const studioId = typeof payload.studioId === 'string' && payload.studioId.length <= 60 ? payload.studioId : null;
  const results = search(retrievalQuery(messages), { studioId, limit: 6 });
  const sources = results.map(publicSource);
  const enc = new TextEncoder();
  // A whole walkthrough (many steps with exact button names) needs more room than a short answer.
  const maxTokens = results.some((r) => r.chunk.kind === 'journey') ? 1400 : 700;
  let upstreamAbort = null;

  const stream = new ReadableStream({
    // The browser closed the panel / cleared the chat: stop the OpenAI request so the user's key isn't billed for it.
    cancel() { upstreamAbort?.abort(); },
    async start(controller) {
      const send = (e, d) => { try { controller.enqueue(enc.encode(sse(e, d))); } catch { /* the client went away */ } };
      try {
        send('sources', sources);
        if (!results.length) {
          send('delta', { text: NO_ANSWER });
          send('done', { grounded: false });
          return;
        }
        const ac = new AbortController();
        upstreamAbort = ac;
        const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
        try {
          const res = await fetchImpl('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            signal: ac.signal,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify({
              model: MODEL(),
              stream: true,
              temperature: 0.2,
              max_tokens: maxTokens,
              messages: [{ role: 'system', content: `${SYSTEM_PROMPT}\n\nSOURCES:\n${buildSourcesBlock(results)}` }, ...messages],
            }),
          });
          if (!res.ok || !res.body) {
            send('error', { message: openAIKeyError(res.status) || `The assistant is unavailable (HTTP ${res.status}).`, code: res.status === 401 ? 'bad_key' : 'upstream' });
            return;
          }
          for await (const text of openAIDeltas(res.body)) send('delta', { text });
          send('done', { grounded: true });
        } finally {
          clearTimeout(timer);
        }
      } catch (err) {
        send('error', { message: err?.name === 'AbortError' ? 'The assistant took too long. Try again.' : 'Connection lost. Try again.', code: 'upstream' });
      } finally {
        try { controller.close(); } catch { /* already cancelled */ }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' },
  });
}

export default (req) => handle(req);

export const config = { path: '/api/ask-smartvideo' };
