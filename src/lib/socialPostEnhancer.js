import { apiKeyManager } from './apiKeyManager.js';

// ---------------------------------------------------------------------------
// Social post copy enhancer
//
// Uses the user's own OpenAI key (from apiKeyManager, consistent with
// gtmResponses.js / openaiResponses.js) to improve social-post copy via the
// OpenAI Chat Completions API. Returns the improved text only.
//
// The OpenAI key is supplied by the caller (Settings > OpenAI API Key) and sent
// directly to api.openai.com — the same client-side pattern the rest of the
// app uses for OpenAI calls.
// ---------------------------------------------------------------------------

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-5.6-luna';

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
  * @param {string} [opts.model]     OpenAI model id (defaults to gpt-5.6-luna).
  * @param {AbortSignal} [opts.signal]
  * @param {string} [opts.goal]      Optional creative angle for a reroll (e.g. 'try a humor angle').
  * @returns {Promise<string>} The improved text.
  */
export async function enhanceSocialPostText({ text, field = 'caption', platform = 'Instagram', tone, model, signal, goal } = {}) {
  const key = apiKeyManager.getOpenAIKey?.();
  if (!key) {
    throw new Error('Add your OpenAI API key in Settings to use Enhance writing.');
  }

  const trimmed = (text || '').trim();
  if (!trimmed) {
    throw new Error('Write something first, then enhance it.');
  }

  const res = await fetch(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      temperature: 0.8,
      max_tokens: 500,
      messages: [
        { role: 'system', content: buildSystemPrompt(field, platform, tone, goal ? { goal } : {}) },
        { role: 'user', content: trimmed },
      ],
    }),
    signal,
  });

  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json())?.error?.message || '';
    } catch {
      /* ignore parse errors */
    }
    throw new Error(`OpenAI request failed (${res.status})${detail ? `: ${detail}` : ''}`);
  }

  const data = await res.json();
  const out = data?.choices?.[0]?.message?.content?.trim();
  return out || trimmed;
}

export default enhanceSocialPostText;
