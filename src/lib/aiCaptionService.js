/**
 * AI Caption Service for Smart Video Scheduler
 *
 * Uses OpenAI Responses API (GPT-5.6 Luna/Terra/Sol) to generate:
 * - Platform-specific captions
 * - Hashtag suggestions
 * - Content ideas
 * - A/B test variations
 * - Content repurposing
 *
 * Routes through Supabase edge function to hide API keys and avoid CORS.
 */

import { openaiConfig } from './config/openaiConfig.js';

// Model selection based on task complexity
const MODELS = {
  caption: 'gpt-5.6-luna',
  hashtag: 'gpt-5.6-luna',
  ideas: 'gpt-5.6-terra',
  abTest: 'gpt-5.6-terra',
  repurpose: 'gpt-5.6-sol',
  analyze: 'gpt-5.6-sol',
  calendar: 'gpt-5.6-terra',
};

// Platform-specific constraints
const PLATFORM_LIMITS = {
  x: { chars: 280, hashtags: 2, name: 'X (Twitter)' },
  twitter: { chars: 280, hashtags: 2, name: 'X (Twitter)' },
  instagram: { chars: 2200, hashtags: 30, name: 'Instagram' },
  tiktok: { chars: 2200, hashtags: 5, name: 'TikTok' },
  linkedin: { chars: 3000, hashtags: 5, name: 'LinkedIn' },
  youtube: { chars: 5000, hashtags: 15, name: 'YouTube' },
  facebook: { chars: 63206, hashtags: 5, name: 'Facebook' },
  pinterest: { chars: 500, hashtags: 20, name: 'Pinterest' },
  threads: { chars: 500, hashtags: 5, name: 'Threads' },
  bluesky: { chars: 300, hashtags: 3, name: 'Bluesky' },
  mastodon: { chars: 500, hashtags: 5, name: 'Mastodon' },
  reddit: { chars: 300, hashtags: 0, name: 'Reddit' },
  vimeo: { chars: 5000, hashtags: 15, name: 'Vimeo' },
  google_business: { chars: 1500, hashtags: 10, name: 'Google Business' },
  devto: { chars: 500, hashtags: 4, name: 'Dev.to' },
};

async function callResponsesAPI(model, instructions, input, options = {}) {
  const apiKey = openaiConfig.getApiKey();
  if (!apiKey) throw new Error('OpenAI API key not configured. Add your key in Settings.');

  const body = { model, instructions, input };
  if (options.textFormat) body.text = { format: options.textFormat };
  if (options.reasoning) body.reasoning = { effort: options.reasoning };

  const baseUrl = import.meta.env?.VITE_SUPABASE_URL || '';
  if (baseUrl) {
    const resp = await fetch(`${baseUrl}/functions/v1/openai-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`API error: ${resp.status}`);
    return resp.json();
  }

  const resp = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`API error: ${resp.status}`);
  return resp.json();
}

function extractText(response) {
  return response.output_text || '';
}

export async function generateCaption({ platform, tone, content, cta, model }) {
  const limits = PLATFORM_LIMITS[platform] || PLATFORM_LIMITS.instagram;
  const selectedModel = model || MODELS.caption;
  const instructions = `Write an engaging ${limits.name} caption. Tone: ${tone || 'professional'}. Maximum ${limits.chars} characters. ${cta ? `Include this call to action: "${cta}".` : ''} Do not include hashtags.`;
  const response = await callResponsesAPI(selectedModel, instructions, `Content description: ${content}`);
  return { caption: extractText(response).trim(), platform, model: selectedModel };
}

export async function generateMultiPlatformCaptions({ platforms, tone, content, model }) {
  return Promise.all(platforms.map(p => generateCaption({ platform: p, tone, content, model })));
}

export async function generateHashtags({ platform, caption, count = 10, model }) {
  const limits = PLATFORM_LIMITS[platform] || PLATFORM_LIMITS.instagram;
  const maxTags = Math.min(count, limits.hashtags);
  const selectedModel = model || MODELS.hashtag;
  const instructions = `Generate ${maxTags} optimized hashtags for a ${limits.name} post. Return JSON: { "hashtags": [...], "reach_estimate": "low|medium|high" }`;
  const response = await callResponsesAPI(selectedModel, instructions, `Post: ${caption}`, {
    textFormat: { type: 'json_schema', schema: { type: 'object', properties: { hashtags: { type: 'array', items: { type: 'string' } }, reach_estimate: { type: 'string' } }, required: ['hashtags', 'reach_estimate'] } }
  });
  try {
    const parsed = JSON.parse(extractText(response));
    return { hashtags: parsed.hashtags.map(h => h.startsWith('#') ? h : `#${h}`), reachEstimate: parsed.reach_estimate, model: selectedModel };
  } catch {
    return { hashtags: [], reachEstimate: 'unknown', model: selectedModel };
  }
}

export async function generateABVariations({ platform, topic, count = 3, model }) {
  const selectedModel = model || MODELS.abTest;
  const instructions = `Write ${count} A/B caption variations for ${platform}. Different hooks: question, statistic, story, quote, how-to. Return JSON array: [{ "hook": "...", "caption": "..." }]`;
  const response = await callResponsesAPI(selectedModel, instructions, `Topic: ${topic}`, {
    textFormat: { type: 'json_schema', schema: { type: 'array', items: { type: 'object', properties: { hook: { type: 'string' }, caption: { type: 'string' } }, required: ['hook', 'caption'] } } }
  });
  try { return JSON.parse(extractText(response)); } catch { return [{ hook: 'default', caption: extractText(response) }]; }
}

export async function generateContentIdeas({ niche, platform, brandName, audience, goals, days = 30, model }) {
  const selectedModel = model || MODELS.ideas;
  const instructions = `Generate ${days} days of content ideas for "${brandName}" (${niche}) on ${platform}. Return JSON array: [{ "date": "YYYY-MM-DD", "content_type": "...", "hook": "...", "best_time": "HH:MM" }]`;
  const response = await callResponsesAPI(selectedModel, instructions, `Audience: ${audience}. Goals: ${goals}`, {
    textFormat: { type: 'json_schema', schema: { type: 'array', items: { type: 'object', properties: { date: { type: 'string' }, content_type: { type: 'string' }, hook: { type: 'string' }, best_time: { type: 'string' } }, required: ['date', 'content_type', 'hook', 'best_time'] } } }
  });
  try { return JSON.parse(extractText(response)); } catch { return []; }
}

export async function repurposeContent({ content, platforms, model }) {
  const selectedModel = model || MODELS.repurpose;
  const instructions = `Repurpose this content for: ${platforms.join(', ')}. Return JSON array: [{ "platform": "...", "format": "...", "content": "..." }]`;
  const response = await callResponsesAPI(selectedModel, instructions, content, {
    textFormat: { type: 'json_schema', schema: { type: 'array', items: { type: 'object', properties: { platform: { type: 'string' }, format: { type: 'string' }, content: { type: 'string' } }, required: ['platform', 'format', 'content'] } } }
  });
  try { return JSON.parse(extractText(response)); } catch { return [{ platform: platforms[0], format: 'post', content: extractText(response) }]; }
}

export async function analyzeBrandVoice({ caption, guidelines, model }) {
  const selectedModel = model || MODELS.analyze;
  const instructions = `Score this caption against brand voice. Return JSON: { "sentiment": "positive|neutral|negative", "tone_match": 0-100, "suggestions": [...] }`;
  const response = await callResponsesAPI(selectedModel, instructions, `Caption: ${caption}\nGuidelines: ${guidelines}`, {
    textFormat: { type: 'json_schema', schema: { type: 'object', properties: { sentiment: { type: 'string' }, tone_match: { type: 'integer' }, suggestions: { type: 'array', items: { type: 'string' } } }, required: ['sentiment', 'tone_match', 'suggestions'] } }
  });
  try { return JSON.parse(extractText(response)); } catch { return { sentiment: 'neutral', tone_match: 50, suggestions: [] }; }
}

export async function generateContentCalendar({ platforms, niche, frequency = 3, model }) {
  const selectedModel = model || MODELS.calendar;
  const totalPosts = frequency * 4;
  const instructions = `Generate a ${totalPosts}-post content calendar for "${niche}". Platforms: ${platforms.join(', ')}. Return JSON array: [{ "date": "YYYY-MM-DD", "platform": "...", "caption": "...", "hashtags": [...], "best_time": "HH:MM", "content_type": "..." }]`;
  const response = await callResponsesAPI(selectedModel, instructions, `Frequency: ${frequency} posts/week`, {
    textFormat: { type: 'json_schema', schema: { type: 'array', items: { type: 'object', properties: { date: { type: 'string' }, platform: { type: 'string' }, caption: { type: 'string' }, hashtags: { type: 'array', items: { type: 'string' } }, best_time: { type: 'string' }, content_type: { type: 'string' } }, required: ['date', 'platform', 'caption', 'hashtags', 'best_time', 'content_type'] } } }
  });
  try { return JSON.parse(extractText(response)); } catch { return []; }
}

export default {
  generateCaption, generateMultiPlatformCaptions, generateHashtags,
  generateABVariations, generateContentIdeas, repurposeContent,
  analyzeBrandVoice, generateContentCalendar,
  PLATFORM_LIMITS, MODELS,
};
