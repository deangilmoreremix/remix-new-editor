/**
 * Netlify function: video-agent
 *
 * One stateless step of the timeline editor's AI Video Agent. The browser
 * runs the tool loop (src/lib/editor/agent/videoAgent.js): it sends the
 * conversation so far plus the editor's tool list, this function asks the
 * model for the next step, and returns its text and tool calls. The tools
 * run in the browser against the user's own timeline.
 *
 * POST /api/video-agent   (Clerk session required)
 *   body = {
 *     provider: 'openai' | 'anthropic',   // default 'openai'
 *     messages: [                         // neutral history, oldest first
 *       { role: 'user', text },
 *       { role: 'assistant', provider, raw },          // raw = the provider's own output, sent back unchanged
 *       { role: 'tool_results', results: [{ id, name, content, isError }] },
 *     ],
 *     tools: [{ name, description, parameters }],      // JSON Schema
 *   }
 * → { ok: true, provider, model, text, toolCalls: [{ id, name, args }], raw, stopReason }
 * → { ok: false, error: { code, message } }
 *
 * Providers:
 *   OpenAI (default) — Responses API with function tools, OPENAI_API_KEY,
 *     model OPENAI_AGENT_MODEL || OPENAI_RESPONSES_TEXT_MODEL || 'gpt-5.6-sol'.
 *   Anthropic (optional) — Messages API through @anthropic-ai/sdk when
 *     ANTHROPIC_API_KEY is set, model ANTHROPIC_AGENT_MODEL || 'claude-opus-5-5'.
 * Keys never leave the server.
 */
import Anthropic from '@anthropic-ai/sdk';
import { withClerkAuth } from './_shared/clerkAuth.js';
import { userOpenAIKey, NEED_OPENAI_KEY, BAD_OPENAI_KEY, OPENAI_NO_CREDIT } from './_shared/byok.js';
import { AGENT_SYSTEM_PROMPT } from './_shared/videoAgentPrompt.js';

const OPENAI_MODEL = process.env.OPENAI_AGENT_MODEL || process.env.OPENAI_RESPONSES_TEXT_MODEL || 'gpt-5.6-sol';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_AGENT_MODEL || 'claude-opus-5-5';
const ANTHROPIC_EFFORT = process.env.ANTHROPIC_AGENT_EFFORT || 'medium';
const TIMEOUT_MS = 120_000;

const LIMITS = { bodyBytes: 1_500_000, messages: 400, tools: 40, toolResultChars: 60_000 };
const RATE = { windowMs: 10 * 60_000, max: 120 }; // model steps per user per 10 minutes (per warm instance)
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

/** Validate the request shape; returns an error string or null. */
export function validateRequest(body) {
  if (!body || typeof body !== 'object') return 'Body must be JSON';
  const { messages, tools } = body;
  if (!Array.isArray(messages) || !messages.length) return 'messages required';
  if (messages.length > LIMITS.messages) return 'Conversation too long — start a new chat';
  if (!Array.isArray(tools) || tools.length > LIMITS.tools) return 'tools must be an array (max 40)';
  for (const t of tools) {
    if (!t || typeof t.name !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(t.name)) return 'Invalid tool name';
    if (t.parameters && typeof t.parameters !== 'object') return 'Invalid tool parameters';
  }
  for (const m of messages) {
    if (!['user', 'assistant', 'tool_results'].includes(m?.role)) return 'Invalid message role';
    if (m.role === 'user' && typeof m.text !== 'string') return 'User messages need text';
    if (m.role === 'tool_results' && !Array.isArray(m.results)) return 'tool_results need results';
  }
  if (messages[0].role !== 'user') return 'The conversation must start with a user message';
  return null;
}

const clip = (s) => {
  const text = typeof s === 'string' ? s : JSON.stringify(s ?? '');
  return text.length > LIMITS.toolResultChars ? `${text.slice(0, LIMITS.toolResultChars)}… [truncated]` : text;
};

// ------------------------------------------------------------------ OpenAI (Responses API)

export function toOpenAIInput(messages) {
  const input = [];
  messages.forEach((m) => {
    if (m.role === 'user') input.push({ role: 'user', content: m.text });
    else if (m.role === 'assistant') {
      if (m.provider === 'openai' && Array.isArray(m.raw)) input.push(...m.raw);
      else if (m.text) input.push({ role: 'assistant', content: m.text });
    } else if (m.role === 'tool_results') {
      m.results.forEach((r) => input.push({ type: 'function_call_output', call_id: String(r.id), output: clip(r.isError ? `ERROR: ${r.content}` : r.content) }));
    }
  });
  return input;
}

// BYOK: runs on the user's own OpenAI key (X-OpenAI-Key from Settings → API keys).
async function stepOpenAI(messages, tools, key) {
  if (!key) return { error: fail(401, 'need_key', NEED_OPENAI_KEY) };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        instructions: AGENT_SYSTEM_PROMPT,
        input: toOpenAIInput(messages),
        tools: tools.map((t) => ({ type: 'function', name: t.name, description: t.description || '', parameters: t.parameters || { type: 'object', properties: {} } })),
        tool_choice: 'auto',
        parallel_tool_calls: true,
        // Stateless: reasoning items come back encrypted and are replayed by the client.
        store: false,
        include: ['reasoning.encrypted_content'],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('[video-agent] OpenAI error', res.status);
      if (res.status === 401) return { error: fail(401, 'bad_key', BAD_OPENAI_KEY) };
      if (res.status === 429) return { error: fail(429, 'no_credit', OPENAI_NO_CREDIT) };
      return { error: fail(502, 'provider_error', 'The AI service returned an error.') };
    }
    const output = Array.isArray(data.output) ? data.output : [];
    const text = output.filter((o) => o.type === 'message').flatMap((o) => o.content || []).filter((c) => c.type === 'output_text').map((c) => c.text).join('\n');
    const toolCalls = output.filter((o) => o.type === 'function_call').map((o) => ({ id: o.call_id, name: o.name, args: safeParse(o.arguments) }));
    return { result: { provider: 'openai', model: data.model || OPENAI_MODEL, text, toolCalls, raw: output, stopReason: toolCalls.length ? 'tool_use' : (data.status || 'completed') } };
  } finally {
    clearTimeout(timer);
  }
}

// ------------------------------------------------------------------ Anthropic (Messages API via SDK)

export function toAnthropicMessages(messages) {
  const out = [];
  messages.forEach((m) => {
    if (m.role === 'user') out.push({ role: 'user', content: m.text });
    else if (m.role === 'assistant') {
      // Content (including thinking blocks) is sent back exactly as received.
      if (m.provider === 'anthropic' && Array.isArray(m.raw)) out.push({ role: 'assistant', content: m.raw });
      else if (m.text) out.push({ role: 'assistant', content: m.text });
    } else if (m.role === 'tool_results') {
      // All results of one turn go back in a single user message.
      out.push({
        role: 'user',
        content: m.results.map((r) => ({ type: 'tool_result', tool_use_id: String(r.id), content: clip(r.content), ...(r.isError ? { is_error: true } : {}) })),
      });
    }
  });
  return out;
}

let anthropicClient = null;

async function stepAnthropic(messages, tools) {
  if (!process.env.ANTHROPIC_API_KEY) return { error: fail(503, 'not_configured', 'Claude is not configured on the server (ANTHROPIC_API_KEY). Choose OpenAI instead.') };
  anthropicClient ||= new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 2 });
  try {
    const message = await anthropicClient.beta.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default', // on a policy decline, the API retries on a suitable fallback model
      output_config: { effort: ANTHROPIC_EFFORT },
      // The static system prompt (and the tool list before it) is cached.
      system: [{ type: 'text', text: AGENT_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools: tools.map((t) => ({ name: t.name, description: t.description || '', input_schema: t.parameters || { type: 'object', properties: {} } })),
      tool_choice: { type: 'auto' },
      messages: toAnthropicMessages(messages),
    });
    if (message.stop_reason === 'refusal') {
      return { result: { provider: 'anthropic', model: message.model, text: "I can't help with that request.", toolCalls: [], raw: [{ type: 'text', text: "I can't help with that request." }], stopReason: 'refusal' } };
    }
    const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    // A turn cut off by max_tokens may hold an incomplete tool call — don't run it.
    const toolCalls = message.stop_reason === 'max_tokens' ? [] : message.content.filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id, name: b.name, args: b.input || {} }));
    return { result: { provider: 'anthropic', model: message.model, text, toolCalls, raw: message.content, stopReason: message.stop_reason } };
  } catch (err) {
    console.error('[video-agent] Anthropic error', err?.status, err?.message);
    const busy = err instanceof Anthropic.RateLimitError || err?.status === 529;
    return { error: fail(502, 'provider_error', busy ? 'Claude is busy — try again in a moment.' : 'The AI service returned an error.') };
  }
}

function safeParse(s) {
  try { return s ? JSON.parse(s) : {}; } catch { return { _invalidJson: String(s).slice(0, 2000) }; }
}

export async function step(body, { openaiKey = null } = {}) {
  const err = validateRequest(body);
  if (err) return fail(400, 'bad_request', err);
  const provider = body.provider === 'anthropic' ? 'anthropic' : 'openai';
  const { result, error } = provider === 'anthropic' ? await stepAnthropic(body.messages, body.tools) : await stepOpenAI(body.messages, body.tools, openaiKey);
  return error || json(200, { ok: true, ...result });
}

export const handler = withClerkAuth(async (event) => {
  if (event.httpMethod === 'GET') {
    return json(200, { ok: true, providers: { openai: !!userOpenAIKey(event.headers), anthropic: !!process.env.ANTHROPIC_API_KEY } });
  }
  if (event.httpMethod !== 'POST') return fail(405, 'method_not_allowed', 'Use POST');
  if ((event.body || '').length > LIMITS.bodyBytes) return fail(413, 'too_large', 'Request too large');
  if (rateLimited(event.auth.userId)) return fail(429, 'rate_limited', 'Too many AI steps — wait a few minutes.');
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return fail(400, 'bad_request', 'Body must be JSON'); }
  try {
    return await step(body, { openaiKey: userOpenAIKey(event.headers) });
  } catch (e) {
    console.error('[video-agent] failed', e?.message);
    return fail(500, 'internal', 'The AI step failed.');
  }
});
