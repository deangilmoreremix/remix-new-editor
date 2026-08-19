import { apiKeyManager } from './apiKeyManager.js';
import openaiConfig from './config/openaiConfig.js';

// ---------------------------------------------------------------------------
// Social post copy enhancer
//
// Uses the user's own OpenAI key (from apiKeyManager, consistent with
// gtmResponses.js / openaiResponses.js) to improve social-post copy via the
// OpenAI Responses API. Returns the improved text only.
//
// The OpenAI key is supplied by the caller (Settings > OpenAI API Key) and sent
// directly to api.openai.com — the same client-side pattern the rest of the
// app uses for OpenAI calls.
// ---------------------------------------------------------------------------

const RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = openaiConfig.getResponsesModel?.() || 'gpt-4.1-mini';

// Tonalities are sourced verbatim from the GTM Skills repo
// (https://gtm-skills.com/free-tools/tonalities) in lib/tonalities.js.
// Each carries a verbatim `description` (the repo's tagline) used as the
// authoritative voice cue; the repo's full sales-scenario templates are
// intentionally excluded (see lib/tonalities.js for rationale).
export { TONALITIES, getTonality } from './tonalities.js';

const FIELD_LABEL = {
  title: 'title',
  description: 'description',
  caption: 'caption',
  tags: 'comma-separated hashtag list',
};

// Optional overrides so the caller (e.g. a "reroll" path) can ask for a
// different creative angle on the current text rather than a generic polish.
function buildSystemPrompt(field, platform, tone, opts = {}) {
  const what = FIELD_LABEL[field] || 'text';
  const goal = opts.goal ? ` ${opts.goal}` : '';
  const lines = [
    'You are an elite social-media growth copywriter. Your only job is to turn the user\'s text into a scroll-stopping, high-engagement post that drives clicks and likes.',
    `Improve the user's ${what} for ${platform}, but favor wording that also performs across Instagram, TikTok, YouTube Shorts, LinkedIn, and X${goal}.`,
    'Write for short-form AI-generated video: every output must hook in the first few words, lead with a clear benefit, then pay off with a punchy close that invites a click, watch, save, comment, or share.',
    'Use a strong, curiosity-driven opener; front-load the core value; keep it concise and impactful; end with an action- or engagement-driving line.',
    'Emojis are encouraged — add relevant emojis to boost scannability and engagement. Keep or improve relevant hashtags (3-5 max).',
    'Preserve the original meaning and any factual details. Do not fabricate claims. If relevant hashtags exist, keep/improve them.',
    'Return ONLY the improved text — no quotation marks, no commentary, no markdown code fences, no bullet lists.',
  ];
  if (tone) {
    if (tone.label) lines.push(`Write in the style of "${tone.label}".`);
    if (tone.description) lines.push(`Voice guidance: ${tone.description}`);
  }
  // Iteration support: the user may reroll on already-AI-assisted text. Treat it
  // as a refinement pass — strengthen the hook/angle without losing prior polish.
  lines.push('If the input is already polished or AI-assisted, refine it further: try a stronger hook, tighter phrasing, or a fresh angle, while preserving what already works.');
  return lines.join(' ');
}

/**
 * Enhance a piece of post copy with OpenAI.
 * @param {object} opts
 * @param {string} opts.text        Current field text.
 * @param {string} opts.field       One of 'title' | 'description' | 'caption' | 'tags'.
 * @param {string} opts.platform    Platform label (e.g. 'YouTube', 'TikTok', 'Instagram').
  * @param {object} [opts.tone]      Tonality descriptor from TONALITIES ({ label, description }).
  * @param {string} [opts.model]     OpenAI Responses API model id (defaults to openaiConfig.getResponsesModel()).
  * @param {AbortSignal} [opts.signal]
  * @param {string} [opts.goal]      Optional creative angle for a reroll (e.g. 'try a humor angle').
  * @param {string} [opts.previousResponseId] Optional previous response id for multi-turn reroll.
  * @returns {Promise<{text: string, responseId: string}>} The improved text and response id.
  */
export async function enhanceSocialPostText({ text, field = 'caption', platform = 'Instagram', tone, model, signal, goal, previousResponseId } = {}) {
  const key = apiKeyManager.getOpenAIKey?.();
  if (!key) {
    throw new Error('Add your OpenAI API key in Settings to use Enhance writing.');
  }

  const trimmed = (text || '').trim();
  if (!trimmed) {
    throw new Error('Write something first, then enhance it.');
  }

  const body = {
    model: model || DEFAULT_MODEL,
    input: [{ role: 'user', content: trimmed }],
    instructions: buildSystemPrompt(field, platform, tone, goal ? { goal } : {}),
    temperature: 0.8,
    max_tokens: 500,
    store: true,
    include: ['input_tokens', 'output_tokens'],
  };
  if (previousResponseId) {
    body.previous_response_id = previousResponseId;
  }

  const res = await fetch(RESPONSES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`OpenAI Responses API returned ${res.status}: ${txt.slice(0, 200)}`);
  }

  const data = await res.json();
  const out = data?.output?.[0]?.content?.[0]?.text?.trim();
  return { text: out || trimmed, responseId: data?.id || '' };
}

export default enhanceSocialPostText;
