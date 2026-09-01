/**
 * Script AI Service
 *
 * Frontend wrapper for the Template Generator script operations.
 * Calls the secure Netlify function at /api/timeline-script which uses
 * the OpenAI Responses API (NOT Chat Completions).
 *
 * If the endpoint is unavailable, returns { ok:false, error } so the
 * UI can surface the real failure rather than fake success.
 *
 * Supports stateful chaining via previousResponseId when the server
 * returns a responseId.
 */

const SCRIPT_API_PATH = '/api/timeline-script';

// Stateful chain — kept per-browser-session so sequential refinements
// (Generate → Rewrite → Shorten) can use previous_response_id.
let lastResponseId = null;

export function getLastScriptResponseId() { return lastResponseId; }
export function resetScriptResponseChain() { lastResponseId = null; }

async function callScriptEndpoint(payload) {
  let res;
  try {
    res = await fetch(SCRIPT_API_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, previousResponseId: lastResponseId }),
    });
  } catch (e) {
    return { ok: false, error: `Network error: ${e.message}` };
  }

  if (!res.ok) {
    let detail = '';
    try {
      const err = await res.json();
      detail = err?.error || '';
    } catch {}
    return { ok: false, error: `Script service returned ${res.status}${detail ? `: ${detail}` : ''}` };
  }

  let json;
  try {
    json = await res.json();
  } catch {
    return { ok: false, error: 'Script service returned invalid JSON' };
  }

  if (!json.ok) {
    return { ok: false, error: json.error || 'Script service error' };
  }

  if (json.responseId) {
    lastResponseId = json.responseId;
  }

  return { ok: true, text: json.text, responseId: json.responseId || null, model: json.model || null };
}

export async function generateScript({
  niche,
  templateContext,
  tone = 'conversational',
  audience = 'general',
  cta = '',
  duration,
  platform,
  aspectRatio,
  personalizationEnabled = false,
} = {}) {
  return callScriptEndpoint({
    action: 'generate',
    niche,
    existingScript: '',
    tone,
    audience,
    cta,
    duration,
    platform,
    aspectRatio,
    templateContext,
    personalizationEnabled,
  });
}

export async function rewriteScript(params = {}) {
  return callScriptEndpoint({ action: 'rewrite', ...params });
}

export async function shortenScript(params = {}) {
  return callScriptEndpoint({ action: 'shorten', ...params });
}

export async function expandScript(params = {}) {
  return callScriptEndpoint({ action: 'expand', ...params });
}

export async function applyCta(params = {}) {
  return callScriptEndpoint({ action: 'applyCta', ...params });
}

export async function changeTone(params = {}) {
  return callScriptEndpoint({ action: 'changeTone', ...params });
}

export async function changeAudience(params = {}) {
  return callScriptEndpoint({ action: 'changeAudience', ...params });
}

export async function optimizeForVoice(params = {}) {
  return callScriptEndpoint({ action: 'optimizeForVoice', ...params });
}

export default {
  generateScript,
  rewriteScript,
  shortenScript,
  expandScript,
  applyCta,
  changeTone,
  changeAudience,
  optimizeForVoice,
  getLastScriptResponseId,
  resetScriptResponseChain,
};
