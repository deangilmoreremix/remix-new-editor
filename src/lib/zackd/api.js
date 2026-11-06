// Zack D studio: client for /api/zackd (BYOK: user's own MuAPI + OpenAI keys).
import { apiKeyManager } from '../apiKeyManager.js';

const POLL_MS = 4000;
const JOB_TIMEOUT_MS = { image: 4 * 60_000, clip: 12 * 60_000, tts: 4 * 60_000, music: 8 * 60_000, captions: 15 * 60_000 };

async function clerkToken() {
  try {
    const session = window.Clerk?.session;
    return session && typeof session.getToken === 'function' ? (await session.getToken()) || null : null;
  } catch { return null; }
}

export class ZackDError extends Error {
  constructor(message, code) { super(message); this.name = 'ZackDError'; this.code = code; }
}

export async function call(body, { signal } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = await clerkToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let muapi = null; let openai = null;
  try { muapi = apiKeyManager.getMuapiKey(); openai = apiKeyManager.getOpenAIKey(); } catch { /* keys optional until a step needs one */ }
  if (muapi) headers['X-MuAPI-Key'] = muapi;
  if (openai) headers['X-OpenAI-Key'] = openai;

  let res;
  try {
    res = await fetch('/api/zackd', { method: 'POST', headers, body: JSON.stringify(body), signal });
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    throw new ZackDError('Could not reach the server. Check your connection.', 'network');
  }
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON error page */ }
  if (!res.ok || !data?.ok) {
    throw new ZackDError(data?.error?.message || `Request failed (${res.status}).`, data?.error?.code || 'error');
  }
  return data;
}

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
});

/**
 * Submit a media job and poll until it finishes. If the job fails and a fallback
 * model exists (image / clip), resubmit once on the fallback.
 * @returns {{ url: string, model: string }}
 */
export async function runJob(submitBody, { signal, onStatus } = {}) {
  const timeout = JOB_TIMEOUT_MS[submitBody.kind] || 5 * 60_000;
  let attempt = submitBody.attempt || 0;
  for (;;) {
    const sub = await call({ action: 'submit', ...submitBody, attempt }, { signal });
    if (sub.status === 'done') return { url: sub.url, model: sub.model };
    const deadline = Date.now() + timeout;
    let failed = false;
    while (Date.now() < deadline) {
      await sleep(POLL_MS, signal);
      const st = await call({ action: 'status', requestId: sub.requestId }, { signal });
      onStatus?.(st.status, sub.model);
      if (st.status === 'done') return { url: st.url, model: sub.model };
      if (st.status === 'failed') { failed = true; break; }
    }
    if (failed && sub.hasFallback && attempt === sub.attempt) { attempt = sub.attempt + 1; continue; }
    throw new ZackDError(failed ? 'The generation failed. Try again.' : 'The generation timed out. Try again.', failed ? 'failed' : 'timeout');
  }
}

/** Run `fn(item, index)` over items with at most `limit` in flight; per-item errors are returned, not thrown. */
export async function pool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next; next += 1;
      try { results[i] = { ok: true, value: await fn(items[i], i) }; } catch (error) { results[i] = { ok: false, error }; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
