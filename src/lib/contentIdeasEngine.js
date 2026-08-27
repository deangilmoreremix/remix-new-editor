/**
 * Content Ideas Engine — generates content calendar ideas, posting strategies,
 * optimal posting times, and brand voice analysis.
 *
 * Routes through the Supabase edge function `/functions/v1/openai-proxy`.
 * Uses gpt-5.6-terra for complex reasoning and gpt-5.6-luna for simple tasks.
 */

import { apiKeyManager } from './apiKeyManager.js';

const OPENAI_PROXY_URL = (typeof window !== 'undefined' && window.__MUAPI_PROXY_URL__)
  || (typeof import.meta !== 'undefined' && import.meta.env?.DEV
    ? '/functions/v1/openai-proxy'
    : (import.meta.env?.VITE_SUPABASE_URL
      ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openai-proxy`
      : '/functions/v1/openai-proxy'));

const FAST_MODEL = 'gpt-5.6-luna';

/**
 * Available models with pricing (per 1M tokens).
 * @type {Record<string, { input: number, output: number, label: string }>}
 */
export const MODELS = {
  'gpt-5.6-luna': { input: 0.20, output: 1.20, label: 'Luna — Fastest, lowest cost' },
  'gpt-5.6-terra': { input: 2.00, output: 12.00, label: 'Terra — Balanced reasoning' },
  'gpt-5.6-sol': { input: 4.00, output: 20.00, label: 'Sol — Maximum capability' },
};

// ---------------------------------------------------------------------------
// JSON Schemas for structured outputs
// ---------------------------------------------------------------------------

const CONTENT_IDEA_SCHEMA = {
  type: 'object',
  properties: {
    ideas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          day: { type: 'integer', description: 'Day number (1-indexed)' },
          title: { type: 'string', description: 'Content piece title' },
          format: { type: 'string', description: 'Content format (e.g. reel, carousel, story, tweet)' },
          topic: { type: 'string', description: 'Core topic or theme' },
          hook: { type: 'string', description: 'Opening hook / first line' },
          caption: { type: 'string', description: 'Suggested caption text' },
          hashtags: { type: 'array', items: { type: 'string' }, description: 'Suggested hashtags' },
          cta: { type: 'string', description: 'Call to action' },
          bestTime: { type: 'string', description: 'Suggested posting time' },
        },
        required: ['day', 'title', 'format', 'topic', 'hook', 'caption', 'hashtags', 'cta'],
      },
    },
  },
  required: ['ideas'],
};

const BEST_TIMES_SCHEMA = {
  type: 'object',
  properties: {
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          dayOfWeek: { type: 'string' },
          times: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                time: { type: 'string', description: 'Time in HH:MM format (24h)' },
                score: { type: 'number', description: 'Engagement score 0-100' },
                reason: { type: 'string' },
              },
              required: ['time', 'score', 'reason'],
            },
          },
        },
        required: ['dayOfWeek', 'times'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['recommendations', 'summary'],
};

const BRAND_VOICE_SCHEMA = {
  type: 'object',
  properties: {
    overallScore: { type: 'number', description: 'Overall brand voice alignment 0-100' },
    analyses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          caption: { type: 'string' },
          score: { type: 'number', description: 'Score 0-100' },
          strengths: { type: 'array', items: { type: 'string' } },
          weaknesses: { type: 'array', items: { type: 'string' } },
          suggestions: { type: 'array', items: { type: 'string' } },
        },
        required: ['caption', 'score', 'strengths', 'weaknesses', 'suggestions'],
      },
    },
  },
  required: ['overallScore', 'analyses'],
};

const CONTENT_CALENDAR_SCHEMA = {
  type: 'object',
  properties: {
    calendar: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          week: { type: 'integer' },
          platform: { type: 'string' },
          posts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string', description: 'ISO date (YYYY-MM-DD)' },
                time: { type: 'string', description: 'Posting time HH:MM' },
                format: { type: 'string' },
                topic: { type: 'string' },
                status: { type: 'string', enum: ['draft', 'scheduled', 'published'] },
              },
              required: ['date', 'time', 'format', 'topic', 'status'],
            },
          },
        },
        required: ['week', 'platform', 'posts'],
      },
    },
    strategy: { type: 'string', description: 'Overall content strategy summary' },
  },
  required: ['calendar', 'strategy'],
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getOpenAIKey() {
  const key = apiKeyManager.getOpenAIKey?.();
  if (!key) {
    throw new Error('OpenAI API key not configured. Add your OpenAI API key in Settings.');
  }
  return key;
}

async function callOpenAI({ systemPrompt, userPrompt, model, schema, signal }) {
  const key = getOpenAIKey();

  const response = await fetch(OPENAI_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
    },
    body: JSON.stringify({
      model: model || FAST_MODEL,
      input: userPrompt,
      instructions: systemPrompt,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'structured_output',
          strict: true,
          schema,
        },
      },
      temperature: 0.7,
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`openai-proxy returned ${response.status}: ${errorText.slice(0, 300)}`);
  }

  const data = await response.json();
  const text = data?.output?.[0]?.content?.[0]?.text
    || data?.outputs?.[0]
    || data?.text
    || data?.content;

  if (!text) {
    throw new Error('No content returned from openai-proxy');
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate N days of content ideas for a given niche and platform.
 * @param {Object} params
 * @param {string} params.niche - Content niche (e.g. "fitness", "SaaS", "food")
 * @param {string} params.platform - Target platform (e.g. "Instagram", "TikTok", "LinkedIn")
 * @param {string} params.brandName - Brand or creator name
 * @param {string} params.audience - Target audience description
 * @param {string[]} params.goals - Content goals (e.g. ["awareness", "engagement", "leads"])
 * @param {number} params.days - Number of days to generate ideas for
 * @param {string} [params.model] - OpenAI model override (default: gpt-5.6-luna)
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<{ ideas: Array }>}
 */
export async function generateContentIdeas({
  niche,
  platform,
  brandName,
  audience,
  goals = [],
  days = 7,
  model,
  signal,
}) {
  if (!niche) throw new Error('niche is required');
  if (!platform) throw new Error('platform is required');
  if (!days || days < 1) throw new Error('days must be at least 1');

  const systemPrompt = `You are a senior social media strategist who creates high-performing content calendars.
Generate exactly ${days} unique, actionable content ideas for the ${platform} platform.
Each idea must include a scroll-stopping hook, a full caption, relevant hashtags, and a clear CTA.
Vary formats across reels, carousels, stories, static posts, and platform-native features.`;

  const userPrompt = `Generate ${days} days of content ideas:
- Niche: ${niche}
- Platform: ${platform}
- Brand: ${brandName || 'Unknown'}
- Audience: ${audience || 'General'}
- Goals: ${goals.join(', ') || 'engagement'}

Return a JSON object with an "ideas" array. Each idea must have: day, title, format, topic, hook, caption, hashtags (array), cta, bestTime.`;

  return callOpenAI({
    systemPrompt,
    userPrompt,
    model,
    schema: CONTENT_IDEA_SCHEMA,
    signal,
  });
}

/**
 * Predict optimal posting times based on platform and engagement data.
 * @param {Object} params
 * @param {string} params.platform - Target platform
 * @param {Object} [params.engagementData] - Optional engagement data by day/time
 * @param {string} [params.model] - OpenAI model override (default: gpt-5.6-luna)
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<{ recommendations: Array, summary: string }>}
 */
export async function generateBestTimes({
  platform,
  engagementData = {},
  model,
  signal,
}) {
  if (!platform) throw new Error('platform is required');

  const systemPrompt = `You are a social media analytics expert who determines optimal posting times.
Analyze the platform and any provided engagement data to recommend the best posting times for each day of the week.
Each recommendation should include a time, an engagement score (0-100), and a brief reason.`;

  const userPrompt = `Recommend optimal posting times for ${platform}.
${Object.keys(engagementData).length > 0 ? `Engagement data: ${JSON.stringify(engagementData)}` : 'No engagement data provided — use platform best practices.'}

Return a JSON object with a "recommendations" array (one entry per day of the week) and a "summary" string.`;

  return callOpenAI({
    systemPrompt,
    userPrompt,
    model,
    schema: BEST_TIMES_SCHEMA,
    signal,
  });
}

/**
 * Score captions against a brand voice and guidelines.
 * @param {Object} params
 * @param {string[]} params.captions - Captions to analyze
 * @param {Object} [params.brandGuidelines] - Brand voice guidelines
 * @param {string} [params.brandGuidelines.tone] - Desired tone (e.g. "professional", "casual")
 * @param {string} [params.brandGuidelines.dos] - Things to include
 * @param {string} [params.brandGuidelines.donts] - Things to avoid
 * @param {string} [params.model] - OpenAI model override (default: gpt-5.6-luna)
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<{ overallScore: number, analyses: Array }>}
 */
export async function analyzeBrandVoice({
  captions,
  brandGuidelines = {},
  model,
  signal,
}) {
  if (!captions || !Array.isArray(captions) || captions.length === 0) {
    throw new Error('captions array is required');
  }

  const systemPrompt = `You are a brand voice analyst. Score each caption against the provided brand guidelines.
For each caption, provide a score (0-100), strengths, weaknesses, and actionable suggestions for improvement.
Calculate an overall score as the average of individual scores.`;

  const userPrompt = `Analyze these captions against the brand voice:
Captions:
${captions.map((c, i) => `${i + 1}. "${c}"`).join('\n')}

Brand Guidelines:
- Tone: ${brandGuidelines.tone || 'Not specified'}
- Do: ${brandGuidelines.dos || 'Not specified'}
- Don't: ${brandGuidelines.donts || 'Not specified'}

Return a JSON object with "overallScore" (number) and "analyses" array.`;

  return callOpenAI({
    systemPrompt,
    userPrompt,
    model,
    schema: BRAND_VOICE_SCHEMA,
    signal,
  });
}

/**
 * Generate a full content calendar across multiple platforms.
 * @param {Object} params
 * @param {string[]} params.platforms - Platforms to include
 * @param {string} params.niche - Content niche
 * @param {Object} [params.frequency] - Posting frequency per platform (e.g. { Instagram: 5 })
 * @param {number} [params.weeks=4] - Number of weeks to plan
 * @param {string} [params.model] - OpenAI model override (default: gpt-5.6-luna)
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<{ calendar: Array, strategy: string }>}
 */
export async function generateContentCalendar({
  platforms,
  niche,
  frequency = {},
  weeks = 4,
  model,
  signal,
}) {
  if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
    throw new Error('platforms array is required');
  }
  if (!niche) throw new Error('niche is required');

  const systemPrompt = `You are a content operations manager who builds multi-platform content calendars.
Create a ${weeks}-week content calendar covering all specified platforms.
Assign realistic dates and optimal posting times. Vary content formats and topics to maintain audience interest.
Include a strategy summary explaining the overall approach.`;

  const userPrompt = `Generate a ${weeks}-week content calendar:
- Platforms: ${platforms.join(', ')}
- Niche: ${niche}
- Frequency: ${Object.keys(frequency).length > 0 ? JSON.stringify(frequency) : '3-5 posts per week per platform'}

Return a JSON object with a "calendar" array (grouped by week and platform) and a "strategy" string.`;

  return callOpenAI({
    systemPrompt,
    userPrompt,
    model,
    schema: CONTENT_CALENDAR_SCHEMA,
    signal,
  });
}

export default {
  generateContentIdeas,
  generateBestTimes,
  analyzeBrandVoice,
  generateContentCalendar,
  MODELS,
};
