// netlify/functions/landing-rewrite.js
// AI rewrite for landing-page copy, on the OpenAI Responses API with the signed-in
// user's own key (BYOK, X-OpenAI-Key). The client sends ONLY text values (id + text);
// the model returns the same ids with new text, so sections, layout, links, images
// and form fields can never be changed by it. The client also re-checks every answer.

import { withClerkAuth } from './_shared/clerkAuth.js';
import { userOpenAIKey, NEED_OPENAI_KEY, BAD_OPENAI_KEY, OPENAI_NO_CREDIT } from './_shared/byok.js';

const MODEL = process.env.OPENAI_LANDING_MODEL || process.env.OPENAI_RESPONSES_TEXT_MODEL || 'gpt-5.6-sol';
const TIMEOUT_MS = 90_000;
const MAX_BODY = 120_000;
export const MAX_ITEMS = 80;
export const MAX_TEXT = 700;

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const fail = (statusCode, code, message) => json(statusCode, { ok: false, error: { code, message } });

export const SCHEMA = {
  type: 'object',
  properties: { items: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' } }, required: ['id', 'text'], additionalProperties: false } } },
  required: ['items'],
  additionalProperties: false,
};

const INSTRUCTIONS = `You rewrite the copy of one landing page. You receive a list of short texts, each with an id and a "role" hint (headline, button, label, quote, name, stat, text).
Rules:
- Return EVERY id exactly once, in any order, with new text for it. Never add, drop or rename ids.
- Keep each text about the same length (within ~30%) and the same kind of text: a button stays a short button label, a headline stays a headline, a quote stays a quote, a stat stays a number-like stat.
- Keep every {{token|fallback}} placeholder and every [[highlight]] marker exactly as written (same text, same count), and keep line breaks where they are.
- Do not add HTML, markdown, emoji, links or contact details.
- Follow the user's instruction for tone, audience and business. Names, quotes and numbers are placeholders: invent plausible, clearly generic ones that fit the business, never real people or companies.
- Write in the language of the page unless told otherwise.`;

export function buildRequest(input) {
  const items = Array.isArray(input?.items) ? input.items : null;
  if (!items || !items.length) return { error: 'No text to rewrite.' };
  if (items.length > MAX_ITEMS) return { error: `Send at most ${MAX_ITEMS} texts at a time.` };
  const clean = [];
  for (const it of items) {
    if (!it || typeof it.id !== 'string' || typeof it.text !== 'string' || !it.text.trim()) return { error: 'Each item needs an id and text.' };
    if (it.text.length > MAX_TEXT) return { error: 'One of the texts is too long.' };
    clean.push({ id: it.id.slice(0, 40), role: String(it.role || 'text').slice(0, 20), text: it.text });
  }
  const instruction = String(input?.instruction || '').slice(0, 600);
  const ctx = String(input?.context || '').slice(0, 400);
  const user = `${ctx ? `Page: ${ctx}\n` : ''}Instruction: ${instruction || 'Make the copy clearer and more engaging.'}\n\nTEXTS (JSON):\n${JSON.stringify(clean)}`;
  return { body: { model: MODEL, instructions: INSTRUCTIONS, input: [{ role: 'user', content: user }], text: { format: { type: 'json_schema', name: 'landing_rewrite', schema: SCHEMA, strict: true } }, store: false }, ids: clean.map((c) => c.id) };
}

export function parseOutput(data) {
  let text = typeof data?.output_text === 'string' ? data.output_text : '';
  if (!text) {
    text = (Array.isArray(data?.output) ? data.output : []).filter((o) => o.type === 'message').flatMap((o) => o.content || []).filter((c) => c.type === 'output_text').map((c) => c.text).join('');
  }
  try { return JSON.parse(text); } catch { return null; }
}

export async function handle(body, { key, fetchImpl = fetch } = {}) {
  if (!key) return fail(401, 'need_key', NEED_OPENAI_KEY);
  const req = buildRequest(body?.input ?? body);
  if (req.error) return fail(400, 'bad_request', req.error);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl('https://api.openai.com/v1/responses', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(req.body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) return fail(401, 'bad_key', BAD_OPENAI_KEY);
      if (res.status === 429) return fail(429, 'no_credit', OPENAI_NO_CREDIT);
      return fail(502, 'provider_error', 'The AI service returned an error.');
    }
    const out = parseOutput(data);
    if (!out || !Array.isArray(out.items)) return fail(502, 'bad_output', 'The AI returned an unreadable answer. Try again.');
    // Only ids we sent come back; anything else is dropped.
    const allowed = new Set(req.ids);
    const items = out.items.filter((i) => i && allowed.has(i.id) && typeof i.text === 'string').map((i) => ({ id: i.id, text: i.text }));
    return json(200, { ok: true, items, model: data.model || MODEL });
  } catch (e) {
    return fail(e?.name === 'AbortError' ? 504 : 502, 'provider_error', e?.name === 'AbortError' ? 'The AI took too long.' : 'The AI service is unreachable.');
  } finally {
    clearTimeout(timer);
  }
}

export const handler = withClerkAuth(async (event) => {
  if (event.httpMethod !== 'POST') return fail(405, 'method_not_allowed', 'Use POST');
  if ((event.body || '').length > MAX_BODY) return fail(413, 'too_large', 'Request too large');
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return fail(400, 'bad_request', 'Body must be JSON'); }
  return handle(body, { key: userOpenAIKey(event.headers) });
});
