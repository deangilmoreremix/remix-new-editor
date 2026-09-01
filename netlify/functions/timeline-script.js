/**
 * Netlify function: timeline-script
 *
 * Handles script AI operations for the Template Generator modal.
 * Uses OpenAI Responses API (NOT Chat Completions).
 *
 * Endpoints (POST):
 *   body = {
 *     action: 'generate' | 'rewrite' | 'shorten' | 'expand' | 'applyCta' | 'changeTone' | 'changeAudience' | 'optimizeForVoice',
 *     niche: string,
 *     existingScript: string,
 *     tone: 'conversational' | 'professional' | 'energetic' | 'warm' | 'dramatic' | 'tutorial' | 'commercial' | 'whisper',
 *     audience: 'general' | 'business' | 'consumer' | 'youth' | 'professionals' | 'creators',
 *     cta: string,
 *     duration: number (seconds),
 *     platform: string,
 *     aspectRatio: string,
 *     templateContext: { name?, basePrompt?, description? },
 *     personalizationEnabled: boolean,
 *     previousResponseId: string (optional, for stateful chaining),
 *   }
 *
 * Returns: { ok: true, text, responseId, model } | { ok: false, error }
 *
 * Model: uses the current SmartVideo Responses API text model
 * (resolved via the same pattern as intelligence-api.js — gpt-5.6 family).
 *
 * Security: OPENAI_API_KEY is read from process.env only. Never echoed back.
 */

const TIMEOUT_MS = 60_000;

const fetchWithTimeout = async (url, options = {}, timeoutMs = TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const RESPONSES_MODEL = process.env.OPENAI_RESPONSES_TEXT_MODEL || 'gpt-5.6';

const ACTION_INSTRUCTIONS = {
  generate: `You are an expert short-form video scriptwriter.
Write a complete, ready-to-shoot video script.
- Hook the viewer in the first sentence.
- Keep it under 90 seconds when spoken at a natural pace (~225 words).
- Match the requested tone and audience.
- End with the requested CTA verbatim.
- Return only the script text, no headings, no stage directions.`,

  rewrite: `You are an expert short-form video scriptwriter.
Rewrite the provided script to improve clarity, flow, and engagement.
- Preserve the core message and the CTA verbatim.
- Match the requested tone and audience.
- Keep similar length unless the source is clearly bloated.
- Return only the rewritten script text.`,

  shorten: `You are an expert short-form video scriptwriter.
Shorten the provided script to roughly half its length.
- Preserve the hook, the primary message, and the CTA verbatim.
- Preserve any personalization tokens (e.g. {{first_name}}).
- Return only the shortened script text.`,

  expand: `You are an expert short-form video scriptwriter.
Expand the provided script with richer detail, sensory language, and a stronger narrative arc.
- Keep the total under 120 seconds when spoken.
- Preserve the CTA and any personalization tokens.
- Return only the expanded script text.`,

  applyCta: `You are an expert short-form video scriptwriter.
Add or strengthen the call to action at the end of the provided script.
- Place the CTA verbatim as the final sentence.
- Preserve the rest of the script.
- Return only the script with the integrated CTA.`,

  changeTone: `You are an expert short-form video scriptwriter.
Adjust the tone of the provided script.
- Keep the same content and CTA verbatim.
- Return only the retoned script text.`,

  changeAudience: `You are an expert short-form video scriptwriter.
Adapt the provided script for the requested target audience.
- Preserve the CTA and any personalization tokens.
- Return only the adapted script text.`,

  optimizeForVoice: `You are an expert short-form video scriptwriter.
Optimize the provided script for AI voice narration (TTS).
- Use clear sentence boundaries, avoid tongue-twisters.
- Mark pauses with a single "..." where natural.
- Spell out acronyms the first time.
- Preserve the CTA and any personalization tokens.
- Return only the optimized script text.`,
};

function buildContextBlock(input) {
  const ctx = [];
  if (input.niche) ctx.push(`Niche/Industry: ${input.niche}`);
  if (input.templateContext?.name) ctx.push(`Template: ${input.templateContext.name}`);
  if (input.templateContext?.basePrompt) ctx.push(`Template base prompt: ${input.templateContext.basePrompt}`);
  if (input.templateContext?.description) ctx.push(`Template description: ${input.templateContext.description}`);
  if (input.duration) ctx.push(`Target duration: ${input.duration} seconds`);
  if (input.platform) ctx.push(`Platform: ${input.platform}`);
  if (input.aspectRatio) ctx.push(`Aspect ratio: ${input.aspectRatio}`);
  if (input.tone) ctx.push(`Tone: ${input.tone}`);
  if (input.audience) ctx.push(`Target audience: ${input.audience}`);
  if (input.cta) ctx.push(`Required CTA: "${input.cta}"`);
  if (input.personalizationEnabled) ctx.push(`Personalization tokens are supported (e.g. {{first_name}}). Preserve any tokens in the existing script.`);
  return ctx.length > 0 ? `CONTEXT:\n${ctx.join('\n')}\n\n` : '';
}

function buildInputText(input) {
  const ctx = buildContextBlock(input);
  const existing = input.existingScript?.trim();
  if (input.action === 'generate') {
    return `${ctx}Write a fresh script.`;
  }
  if (existing) {
    return `${ctx}Existing script:\n"""\n${existing}\n"""\n\nPerform the requested action on the existing script.`;
  }
  // No existing script + non-generate action: generate from context
  return `${ctx}No existing script provided. Write a fresh script that matches the context.`;
}

function extractText(responsesData) {
  if (!responsesData) return '';
  // Preferred: top-level output_text (Responses API convenience)
  if (typeof responsesData.output_text === 'string' && responsesData.output_text.trim()) {
    return responsesData.output_text.trim();
  }
  // Fallback: walk output[].content[]
  const messageOutputs = (responsesData.output || []).filter(o => o.type === 'message');
  for (const msg of messageOutputs) {
    const textChunks = (msg.content || []).filter(c => c.type === 'output_text').map(c => c.text);
    if (textChunks.length) return textChunks.join('\n').trim();
  }
  return '';
}

export async function handler(event) {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders(),
    };
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return jsonResponse(503, { ok: false, error: 'OPENAI_API_KEY not configured on server' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { ok: false, error: 'Invalid JSON body' });
  }

  const action = body.action;
  if (!action || !ACTION_INSTRUCTIONS[action]) {
    return jsonResponse(400, { ok: false, error: `Unknown action: ${action}` });
  }

  const instructions = ACTION_INSTRUCTIONS[action];
  const userText = buildInputText(body);

  const requestBody = {
    model: RESPONSES_MODEL,
    instructions,
    input: [
      { role: 'user', content: userText },
    ],
  };
  if (body.previousResponseId) {
    requestBody.previous_response_id = body.previousResponseId;
  }

  let openaiRes;
  try {
    openaiRes = await fetchWithTimeout('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(requestBody),
    });
  } catch (e) {
    const msg = e?.name === 'AbortError' ? 'OpenAI request timed out' : `Network error: ${e?.message || 'unknown'}`;
    return jsonResponse(502, { ok: false, error: msg });
  }

  if (!openaiRes.ok) {
    let detail = '';
    try {
      const errJson = await openaiRes.json();
      detail = errJson?.error?.message || errJson?.details || '';
    } catch {
      try { detail = await openaiRes.text(); } catch {}
    }
    return jsonResponse(openaiRes.status, {
      ok: false,
      error: `OpenAI Responses API error (${openaiRes.status})${detail ? `: ${detail}` : ''}`,
    });
  }

  let data;
  try {
    data = await openaiRes.json();
  } catch {
    return jsonResponse(502, { ok: false, error: 'Invalid JSON from OpenAI Responses API' });
  }

  const text = extractText(data);
  if (!text) {
    return jsonResponse(502, { ok: false, error: 'OpenAI returned empty output' });
  }

  return jsonResponse(200, {
    ok: true,
    text,
    responseId: data.id || null,
    model: data.model || RESPONSES_MODEL,
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
    body: JSON.stringify(body),
  };
}
