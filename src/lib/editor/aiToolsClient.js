/**
 * AI Tools client (the editor's CineGen-derived tools). The older
 * src/lib/cinegenIntegration.js is left as it was; this replaces it for the
 * editor.
 *
 * Four tools run through /api/cinegen on the user's own MuAPI key (BYOK, from
 * Settings → API keys): Fill Gap, Extend, Element and Shot Board. The server
 * submits a MuAPI job; this polls until it is done, so a long generation
 * never has to fit in one request.
 */
import { apiKeyManager } from '../apiKeyManager.js';

export const TIMELINE_AI_TOOLS = {
  FILL_GAP: 'fill_gap',
  EXTEND: 'extend',
  ELEMENT_CREATE: 'element_create',
  SHOT_BOARD: 'shot_board',
  GENERATE: 'generate',
};

export const AI_TOOL_INFO = {
  fill_gap: { label: 'Fill Gap', icon: '🧩', description: 'Make footage that bridges two moments, from a start frame and an end frame.' },
  extend: { label: 'Extend', icon: '➡️', description: 'Continue a clip: a new clip that carries on from its last frame.' },
  element_create: { label: 'Element', icon: '🖼️', description: 'Create an image from a description, to reuse in your video.' },
  shot_board: { label: 'Shot Board', icon: '🎞️', description: 'Storyboard a scene as several images.' },
  generate: { label: 'Generate', icon: '✨', description: 'Make a new video clip or image from a description.' },
};

export const GENERATE_VIDEO_MODELS = [['seedance-lite-t2v', 'Seedance Lite (fast)'], ['seedance-pro-t2v', 'Seedance Pro'], ['seedance-pro-t2v-fast', 'Seedance Pro Fast']];

export const AI_TOOLS_ENDPOINT = '/api/cinegen';
export const NEED_KEY_MESSAGE = 'AI Tools use your own MuAPI key. Add it in Settings → API keys (MuAPI API Key).';

async function authHeader() {
  try {
    const token = await globalThis.window?.Clerk?.session?.getToken?.();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(Object.assign(new Error('Cancelled'), { name: 'AbortError' })); }, { once: true });
});

async function call(body, { fetchImpl = fetch, signal, keyManager = apiKeyManager } = {}) {
  const key = keyManager?.getMuapiKey?.();
  const res = await fetchImpl(AI_TOOLS_ENDPOINT, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', ...(await authHeader()), ...(key && key !== 'dev' ? { 'X-MuAPI-Key': key } : {}) },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(data?.error?.message || (res.status === 401 ? 'Sign in to use the AI Tools.' : `The AI service is unavailable (HTTP ${res.status}).`));
  return data;
}

/**
 * Run one tool. Always resolves: { success: true, tool, url | urls, ... } or { success: false, error }.
 * @param {string} tool    one of TIMELINE_AI_TOOLS
 * @param {object} params  tool inputs (see netlify/functions/cinegen.js)
 */
export async function runTimelineAITool(tool, params = {}, { fetchImpl, signal, keyManager = apiKeyManager, pollMs = 3000, timeoutMs = 5 * 60_000, onProgress } = {}) {
  if (!Object.values(TIMELINE_AI_TOOLS).includes(tool)) return { success: false, tool, error: 'Choose one of the AI Tools: Fill Gap, Extend, Element or Shot Board.' };
  const key = keyManager?.getMuapiKey?.();
  if (!key || key === 'dev') return { success: false, tool, code: 'need_key', error: NEED_KEY_MESSAGE };
  try {
    const first = await call({ action: 'submit', tool, params }, { fetchImpl, signal, keyManager });
    if (first.status === 'done') return first.result;
    const started = Date.now();
    for (;;) {
      if (Date.now() - started > timeoutMs) return { success: false, tool, error: 'This is taking too long. Try again in a moment.' };
      await sleep(pollMs, signal);
      onProgress?.({ elapsedSec: Math.round((Date.now() - started) / 1000) });
      const res = await call({ action: 'status', tool, requestId: first.requestId, params }, { fetchImpl, signal, keyManager });
      if (res.status === 'done') return res.result;
      if (res.status === 'failed') return { success: false, tool, error: res.error || 'The AI service could not make this.' };
    }
  } catch (error) {
    if (error?.name === 'AbortError') return { success: false, tool, error: 'Stopped.' };
    return { success: false, tool, error: error?.message || 'Tool execution failed' };
  }
}

export function getTimelineAITools() {
  return Object.values(TIMELINE_AI_TOOLS);
}
