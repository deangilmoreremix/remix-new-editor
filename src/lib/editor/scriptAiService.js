/**
 * Script AI Service
 *
 * Wraps OpenAI text generation for the Template Generator script step.
 * Exposes generate / rewrite / shorten / expand with a consistent contract.
 *
 * Uses the existing openaiService for prompt construction; for the actual
 * chat completion call, it uses the /api/ai-script Netlify function when
 * available, otherwise falls back to a deterministic placeholder that is
 * explicitly marked unavailable (so the UI does not fake success).
 *
 * If the network is unreachable or no key is configured, returns
 * { ok:false, error:'...' } — callers MUST surface this to the user.
 */

const SCRIPT_API_PATH = '/api/ai-script';

/**
 * Build a system prompt describing the desired operation.
 */
function buildSystemPrompt({ operation, tone, audience, cta }) {
  const tonePart = tone ? `Tone: ${tone}.` : '';
  const audPart = audience ? `Audience: ${audience}.` : '';
  const ctaPart = cta ? `End with a clear call to action: "${cta}".` : '';
  const base = 'You are an expert short-form video scriptwriter.';
  const ops = {
    generate: `${base} Write a concise, engaging video script (60-90 seconds when spoken at a natural pace). ${tonePart} ${audPart} ${ctaPart} Return only the script text.`,
    rewrite:  `${base} Rewrite the provided script to improve clarity, flow, and engagement. Preserve the core message. ${tonePart} ${audPart} ${ctaPart} Return only the rewritten script text.`,
    shorten:  `${base} Shorten the provided script to roughly half its length while preserving the key message and call to action. ${tonePart} ${audPart} ${ctaPart} Return only the shortened script.`,
    expand:   `${base} Expand the provided script with richer detail, sensory language, and a stronger narrative arc. Keep it under 120 seconds. ${tonePart} ${audPart} ${ctaPart} Return only the expanded script.`,
    cta:      `${base} Add or strengthen a call to action at the end of the provided script. Return the full script with the CTA integrated.`,
  };
  return ops[operation] || ops.generate;
}

/**
 * Call the AI script endpoint.
 * Returns { ok:true, text } on success, { ok:false, error } on failure.
 */
async function callScriptEndpoint({ operation, text, tone, audience, cta, niche }) {
  const system = buildSystemPrompt({ operation, tone, audience, cta });
  const userParts = [];
  if (niche) userParts.push(`Niche: ${niche}`);
  if (text) userParts.push(`Existing script:\n"""${text}"""`);
  userParts.push('Produce the requested output.');

  const body = {
    system,
    messages: [{ role: 'user', content: userParts.join('\n\n') }],
    maxTokens: 800,
  };

  let res;
  try {
    res = await fetch(SCRIPT_API_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, error: `Network error: ${e.message}` };
  }

  if (!res.ok) {
    return { ok: false, error: `AI script service returned ${res.status}` };
  }
  let json;
  try {
    json = await res.json();
  } catch {
    return { ok: false, error: 'AI script service returned invalid JSON' };
  }
  const out = (json?.text || json?.result || json?.output || '').trim();
  if (!out) return { ok: false, error: 'AI script service returned empty result' };
  return { ok: true, text: out };
}

export async function generateScript({ text, operation = 'generate', tone, audience, cta, niche } = {}) {
  return callScriptEndpoint({ operation, text, tone, audience, cta, niche });
}

export async function rewriteScript({ text, tone, audience, cta, niche } = {}) {
  return callScriptEndpoint({ operation: 'rewrite', text, tone, audience, cta, niche });
}

export async function shortenScript({ text, tone, audience, cta, niche } = {}) {
  return callScriptEndpoint({ operation: 'shorten', text, tone, audience, cta, niche });
}

export async function expandScript({ text, tone, audience, cta, niche } = {}) {
  return callScriptEndpoint({ operation: 'expand', text, tone, audience, cta, niche });
}

export async function applyCta({ text, cta, niche } = {}) {
  return callScriptEndpoint({ operation: 'cta', text, cta, niche });
}

export default {
  generateScript,
  rewriteScript,
  shortenScript,
  expandScript,
  applyCta,
};
