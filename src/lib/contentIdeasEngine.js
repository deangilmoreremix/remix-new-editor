/**
 * Content Ideas Engine — generates content calendar ideas, posting strategies,
 * optimal posting times, and brand voice analysis.
 *
 * Routes through the Supabase edge function `/functions/v1/openai-proxy`.
 * Uses gpt-5.6-terra for complex reasoning and gpt-5.6-luna for simple tasks.
 */

import { openaiConfig } from '../lib/config/openaiConfig.js';

const COMPLEX_MODEL = 'gpt-5.6-terra';
const FAST_MODEL = 'gpt-5.6-luna';

function getApiKey() {
  const key = openaiConfig.getApiKey();
  if (!key) throw new Error('OpenAI API key not configured. Add your key in Settings.');
  return key;
}

async function callAPI(model, instructions, input, schema) {
  const apiKey = getApiKey();
  const body = {
    model,
    instructions,
    input,
    text: { format: { type: 'json_schema', schema } },
  };
  const baseUrl = import.meta.env?.VITE_SUPABASE_URL || '';
  const url = baseUrl ? `${baseUrl}/functions/v1/openai-proxy` : 'https://api.openai.com/v1/responses';
  const headers = { 'Content-Type': 'application/json' };
  if (!baseUrl) headers['Authorization'] = `Bearer ${apiKey}`;
  const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!resp.ok) throw new Error(`API error: ${resp.status}`);
  const json = await resp.json();
  return json.output_text || '';
}

export async function generateContentIdeas(days = 30, niche = 'general', platform = 'instagram') {
  const instructions = `Generate ${days} days of content ideas for a ${niche} brand on ${platform}. Return JSON: { "ideas": [{ "day": 1, "title": "...", "format": "reel/carousel/story", "topic": "...", "hook": "...", "caption": "...", "hashtags": [...], "cta": "...", "bestTime": "HH:MM" }] }`;
  const schema = { type: 'object', properties: { ideas: { type: 'array', items: { type: 'object', properties: { day: { type: 'integer' }, title: { type: 'string' }, format: { type: 'string' }, topic: { type: 'string' }, hook: { type: 'string' }, caption: { type: 'string' }, hashtags: { type: 'array', items: { type: 'string' } }, cta: { type: 'string' }, bestTime: { type: 'string' } }, required: ['day', 'title', 'format', 'topic', 'hook', 'caption', 'hashtags', 'cta'] } } }, required: ['ideas'] };
  const text = await callAPI(COMPLEX_MODEL, instructions, `Generate ${days} ideas`, schema);
  try { return JSON.parse(text).ideas; } catch { return []; }
}

export async function generateBestTimes(platform = 'instagram') {
  const instructions = `Predict optimal posting times for ${platform}. Return JSON: { "times": [{ "day": "Monday", "hours": ["09:00", "12:00", "18:00"], "reason": "..." }] }`;
  const schema = { type: 'object', properties: { times: { type: 'array', items: { type: 'object', properties: { day: { type: 'string' }, hours: { type: 'array', items: { type: 'string' } }, reason: { type: 'string' } }, required: ['day', 'hours', 'reason'] } } }, required: ['times'] };
  const text = await callAPI(COMPLEX_MODEL, instructions, `Best times for ${platform}`, schema);
  try { return JSON.parse(text).times; } catch { return []; }
}

export async function analyzeBrandVoice(caption, guidelines) {
  const instructions = `Score this caption against brand voice guidelines. Return JSON: { "sentiment": "positive|neutral|negative", "tone_match": 0-100, "suggestions": [...] }`;
  const schema = { type: 'object', properties: { sentiment: { type: 'string' }, tone_match: { type: 'integer' }, suggestions: { type: 'array', items: { type: 'string' } } }, required: ['sentiment', 'tone_match', 'suggestions'] };
  const text = await callAPI(COMPLEX_MODEL, instructions, `Caption: ${caption}\nGuidelines: ${guidelines}`, schema);
  try { return JSON.parse(text); } catch { return { sentiment: 'neutral', tone_match: 50, suggestions: [] }; }
}

export default { generateContentIdeas, generateBestTimes, analyzeBrandVoice };
