/**
 * Client side of the AI Video Agent: runs the tool loop in the browser.
 * Each model step goes through /api/video-agent (keys stay on the server);
 * tool calls run locally against the timeline (tools.js).
 *
 * History is provider-neutral (see netlify/functions/video-agent.js). The
 * assistant's raw output is kept and sent back unchanged, so reasoning and
 * tool-call blocks round-trip correctly. Every tool call gets a result —
 * including after Stop — so the history stays valid.
 */
export const MAX_STEPS = 25;
export const AGENT_ENDPOINT = '/api/video-agent';

async function authHeader() {
  try {
    const token = await globalThis.window?.Clerk?.session?.getToken?.();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/** One model step on the server. */
export async function fetchAgentStep({ provider, messages, tools, signal }) {
  const res = await fetch(AGENT_ENDPOINT, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ provider, messages, tools }),
  });
  const data = await res.json().catch(() => null);
  if (res.status === 401) throw new Error('Sign in to use the AI Video agent.');
  if (!res.ok || !data?.ok) throw new Error(data?.error?.message || `The AI service is unavailable (HTTP ${res.status}).`);
  return data;
}

const abortError = () => Object.assign(new Error('Stopped'), { name: 'AbortError' });

/**
 * Run one user turn to completion (or until MAX_STEPS / Stop).
 * Mutates and returns `history`.
 *
 * @param {object} o
 *   history      neutral message array (kept across turns)
 *   text         the user's message
 *   tools        { definitions, run(name, args) } from createAgentTools
 *   provider     'openai' | 'anthropic'
 *   step         (optional) override of fetchAgentStep, for tests
 *   onEvent      ({ type: 'assistant'|'tool-start'|'tool-done'|'limit', ... })
 *   signal       AbortSignal (Stop)
 */
export async function runAgentTurn({ history, text, tools, provider = 'openai', step = fetchAgentStep, onEvent, signal, maxSteps = MAX_STEPS }) {
  history.push({ role: 'user', text: String(text) });
  for (let i = 0; i < maxSteps; i += 1) {
    if (signal?.aborted) throw abortError();
    const res = await step({ provider, messages: history, tools: tools.definitions, signal });
    history.push({ role: 'assistant', provider: res.provider, raw: res.raw, text: res.text || '' });
    if (res.text) onEvent?.({ type: 'assistant', text: res.text });
    const calls = Array.isArray(res.toolCalls) ? res.toolCalls : [];
    if (!calls.length) return history;
    const results = [];
    for (const call of calls) {
      if (signal?.aborted) {
        results.push({ id: call.id, name: call.name, content: 'Cancelled: the user pressed Stop.', isError: true });
        continue;
      }
      onEvent?.({ type: 'tool-start', id: call.id, name: call.name, args: call.args });
      const out = await tools.run(call.name, call.args);
      results.push({ id: call.id, name: call.name, content: out.content, isError: !out.ok });
      onEvent?.({ type: 'tool-done', id: call.id, name: call.name, ok: out.ok, content: out.content, image: out.image });
    }
    history.push({ role: 'tool_results', results });
    if (signal?.aborted) throw abortError();
  }
  // The history ends with tool results; the next user message continues it.
  onEvent?.({ type: 'limit', steps: maxSteps });
  return history;
}

/** Friendly one-line label for a tool call in the chat. */
export function describeToolCall(name, args = {}) {
  const a = args || {};
  switch (name) {
    case 'get_timeline': return 'Reading the timeline';
    case 'search_stock': return `Searching ${a.source || 'stock'} ${a.kind || ''} for “${a.query || ''}”`;
    case 'add_media_clip': return `Adding ${a.kind || 'media'} at ${a.start ?? 'playhead'}s`;
    case 'add_overlay': return `Adding ${String(a.type || 'overlay').replace('overlay-', '')}${a.options?.text ? ` “${String(a.options.text).slice(0, 40)}”` : ''}`;
    case 'add_video_transition': return `Adding ${a.transition} transition at ${a.at}s`;
    case 'add_interactive': return `Adding ${a.type}`;
    case 'list_effects': return 'Looking up effects';
    case 'add_effect': return `Adding ${a.effect} effect`;
    case 'set_keyframes': return `Animating ${a.property}`;
    case 'add_captions': return a.source_clip_id ? 'Transcribing captions' : 'Adding captions';
    case 'remove_background': return 'Removing the background';
    case 'create_animation': return `Creating animation “${a.title || ''}”`;
    case 'update_clip': return 'Updating a clip';
    case 'remove_clip': return 'Removing a clip';
    case 'set_duration': return `Setting length to ${a.seconds}s`;
    case 'preview_frame': return `Previewing ${a.time}s`;
    case 'export_video': return 'Exporting the video';
    default: return name;
  }
}
