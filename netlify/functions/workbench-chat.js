/**
 * Netlify function: workbench-chat
 *
 * AI chat editing for the SmartVid Workbench (Motion Workbench port).
 * The client sends the user's instruction, the current project (compacted)
 * and the card catalog; the model answers with a short reply plus a list of
 * edit operations. The client validates every operation against the card
 * schemas before applying it (see apps/shotcraft/workbench/src/ai/ops.ts), so
 * this function never mutates anything itself.
 *
 * POST body: { message: string, history?: {role,content}[], project: object, cards: object[] }
 * Returns:   { ok: true, reply: string, ops: object[] } | { ok: false, error }
 *
 * BYOK: SmartVid users bring their own OpenAI key (API key modal). The Workbench
 * sends it in the X-OpenAI-Key header and the request runs on that key. There is no
 * fallback to a platform key. The key is used for this one OpenAI call only: never
 * logged, stored or echoed back.
 */

const TIMEOUT_MS = 60_000;
const MODEL = process.env.OPENAI_RESPONSES_TEXT_MODEL || 'gpt-5.6-sol';
const MAX_BODY_CHARS = 200_000;
const MAX_MESSAGE_CHARS = 4_000;
const MAX_HISTORY = 12;

export const INSTRUCTIONS = `You are the editing assistant inside SmartVid Workbench, a multi-track video editor.
The user describes an edit in plain language. You change the project ONLY by returning operations.

Timeline facts:
- All times are in FRAMES at project.fps (e.g. 30 fps → 2 seconds = 60 frames).
- tracks[0] is the TOP layer; later tracks render underneath.
- Each clip shows a card (cardId). Card props must match that card's schema keys.
- Media cards: "video-clip", "image-clip", "audio-clip" (prop "file" is a URL — never invent URLs; only reuse files already in the project).
- Text cards (e.g. "text-basic", "inkpress-title-card", "inkpress-caption") are for titles and captions.

Return a JSON object: {"reply": string, "ops": Op[]}. "reply" is one or two short sentences describing what you changed (or asking a clarifying question with "ops": []).
Op types (use exact field names, ids must exist unless creating):
- {"op":"update_clip","clipId":string,"start"?:number,"duration"?:number,"inOffset"?:number,"speed"?:number,"opacity"?:number,"scale"?:number,"x"?:number,"y"?:number,"label"?:string}
- {"op":"set_props","clipId":string,"props":object}
- {"op":"add_clip","cardId":string,"trackId"?:string,"start":number,"duration"?:number,"props"?:object,"label"?:string}
- {"op":"remove_clip","clipId":string}
- {"op":"split_clip","clipId":string,"at":number}
- {"op":"move_clip_to_track","clipId":string,"trackId":string}
- {"op":"add_track","name":string}
- {"op":"remove_track","trackId":string}
- {"op":"set_project","name"?:string,"background"?:string}
Rules: speed 0.25–4, opacity 0–1, durations ≥ 2 frames, never overlap edits you weren't asked for, keep ops minimal.`;

const fetchWithTimeout = async (url, options = {}, timeoutMs = TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export function extractText(data) {
  if (!data) return '';
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  for (const msg of (data.output || []).filter((o) => o.type === 'message')) {
    const chunks = (msg.content || []).filter((c) => c.type === 'output_text').map((c) => c.text);
    if (chunks.length) return chunks.join('\n').trim();
  }
  return '';
}

/** Parse the model's JSON answer; tolerate ```json fences. */
export function parseModelAnswer(text) {
  const cleaned = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const parsed = JSON.parse(cleaned);
  const reply = typeof parsed.reply === 'string' ? parsed.reply.slice(0, 2000) : '';
  const ops = Array.isArray(parsed.ops) ? parsed.ops.filter((o) => o && typeof o === 'object' && typeof o.op === 'string').slice(0, 100) : [];
  return { reply, ops };
}

export const NEED_KEY_MESSAGE = 'AI editing uses your own OpenAI key. Add it in SmartVid → Settings → API keys (OpenAI API Key).';

/** Read and sanity-check the user's OpenAI key (header names are case-insensitive). */
export function userOpenAIKey(headers = {}) {
  const raw = Object.entries(headers).find(([k]) => k.toLowerCase() === 'x-openai-key')?.[1];
  const key = typeof raw === 'string' ? raw.trim() : '';
  return /^sk-[A-Za-z0-9_-]{20,}$/.test(key) ? key : null;
}

async function chat(event) {
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  const apiKey = userOpenAIKey(event.headers);
  if (!apiKey) return json(401, { ok: false, error: NEED_KEY_MESSAGE });
  if ((event.body || '').length > MAX_BODY_CHARS) return json(413, { ok: false, error: 'Project is too large for AI editing.' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON body' });
  }
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, MAX_MESSAGE_CHARS) : '';
  if (!message) return json(400, { ok: false, error: 'Missing message' });
  if (!body.project || typeof body.project !== 'object') return json(400, { ok: false, error: 'Missing project' });

  const history = (Array.isArray(body.history) ? body.history : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));

  const context = `CARD CATALOG (id, name, schema):\n${JSON.stringify(body.cards || [])}\n\nCURRENT PROJECT:\n${JSON.stringify(body.project)}`;

  let res;
  try {
    res = await fetchWithTimeout('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        instructions: INSTRUCTIONS,
        input: [{ role: 'user', content: context }, ...history, { role: 'user', content: message }],
        text: { format: { type: 'json_object' } },
      }),
    });
  } catch (e) {
    return json(502, { ok: false, error: e?.name === 'AbortError' ? 'AI request timed out' : 'AI request failed' });
  }
  if (!res.ok) {
    if (res.status === 401) return json(401, { ok: false, error: 'OpenAI rejected your API key. Check it in SmartVid → Settings → API keys.' });
    if (res.status === 429) return json(429, { ok: false, error: 'Your OpenAI account is rate-limited or out of credit. Check your OpenAI billing, then try again.' });
    let detail = '';
    try { detail = (await res.json())?.error?.message || ''; } catch { /* ignore */ }
    return json(502, { ok: false, error: `AI service error (${res.status})${detail ? `: ${detail}` : ''}` });
  }

  let answer;
  try {
    answer = parseModelAnswer(extractText(await res.json()));
  } catch {
    return json(502, { ok: false, error: 'The AI returned an unreadable answer. Try rephrasing.' });
  }
  return json(200, { ok: true, ...answer });
}

export const handler = chat;
