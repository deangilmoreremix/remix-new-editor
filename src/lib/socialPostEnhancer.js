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

function buildSystemPrompt(field, platform, tone) {
  const what = FIELD_LABEL[field] || 'text';
  const lines = [
    'You are a social media copywriter for a brand that posts short-form AI-generated video.',
    `Improve the user's ${what} for ${platform}.`,
    'Make it engaging, on-brand, and optimized for that platform\'s audience and conventions.',
    'Preserve the original meaning and any factual details; keep or improve relevant hashtags.',
    'Return ONLY the improved text — no quotation marks, no commentary, no markdown code fences.',
  ];
  if (tone) {
    if (tone.label) lines.push(`Write in the style of "${tone.label}".`);
    if (tone.description) lines.push(`Voice guidance: ${tone.description}`);
  }
  return lines.join(' ');
}

/**
 * Enhance a piece of post copy with OpenAI.
 * @param {object} opts
 * @param {string} opts.text        Current field text.
 * @param {string} opts.field       One of 'title' | 'description' | 'caption' | 'tags'.
 * @param {string} opts.platform    Platform label (e.g. 'YouTube', 'TikTok', 'Instagram').
 * @param {object} [opts.tone]      Tonality descriptor from TONALITIES ({ label, blurb }).
 * @param {string} [opts.model]     OpenAI model id (defaults to gpt-5.6-luna).
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<string>} The improved text.
 */
export async function enhanceSocialPostText({ text, field = 'caption', platform = 'Instagram', tone, model, signal } = {}) {
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
        { role: 'system', content: buildSystemPrompt(field, platform, tone) },
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
