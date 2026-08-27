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
  caption: 'gpt-5.6-luna',      // Cheap, fast for simple captions
  hashtag: 'gpt-5.6-luna',      // Simple task, lowest cost
  ideas: 'gpt-5.6-terra',       // Needs reasoning for content strategy
  abTest: 'gpt-5.6-terra',      // Needs creative diversity
  repurpose: 'gpt-5.6-sol',      // Complex multi-step transformation
  analyze: 'gpt-5.6-sol',       // Complex brand voice analysis
  calendar: 'gpt-5.6-terra',    // Structured output, moderate reasoning
};

// Platform-specific constraints
const PLATFORM_LIMITS = {
  x: { chars: 280, hashtags: 2, name: 'X (Twitter)' },
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

/**
 * Call the OpenAI Responses API via Supabase edge function.
 * @param {string} model - Model ID
 * @param {string} instructions - System instructions
 * @param {string} input - User input/prompt
 * @param {object} [options] - Additional options (text format, reasoning, etc.)
 * @returns {Promise<object>} API response
 */
async function callResponsesAPI(model, instructions, input, options = {}) {
  const apiKey = openaiConfig.getApiKey();
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Add your key in Settings.');
  }

  const body = {
    model,
    instructions,
    input,
  };

  // Add structured output format if specified
  if (options.textFormat) {
    body.text = { format: options.textFormat };
  }

  // Add reasoning effort for complex tasks
  if (options.reasoning) {
    body.reasoning = { effort: options.reasoning };
  }

  // Route through Supabase edge function (hides API key from browser)
  const baseUrl = import.meta.env?.VITE_SUPABASE_URL || '';
  const edgeFnUrl = `${baseUrl}/functions/v1/openai-proxy`;

  if (baseUrl) {
    const resp = await fetch(edgeFnUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`API error: ${resp.status}`);
    return resp.json();
  }

  // Fallback: direct API call (requires API key in browser - not recommended for production)
  const resp = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`API error: ${resp.status}`);
  return resp.json();
}

/**
 * Extract text output from a Responses API result.
 * @param {object} response
 * @returns {string}
 */
function extractText(response) {
  return response.output_text || '';
}

/**
 * Generate a platform-specific caption.
 * @param {object} params
 * @param {string} params.platform - Platform ID (instagram, tiktok, linkedin, etc.)
 * @param {string} params.tone - Tone of voice (professional, casual, funny, inspirational)
 * @param {string} params.content - Description of the content/video
 * @param {string} [params.cta] - Call to action
 * @param {string} [params.model] - Model override (default: gpt-5.6-luna)
 * @returns {Promise<{ caption: string, platform: string }}>
 */
export async function generateCaption({ platform, tone, content, cta, model }) {
  const limits = PLATFORM_LIMITS[platform] || PLATFORM_LIMITS.instagram;
  const selectedModel = model || MODELS.caption;

  const instructions = `Write an engaging ${limits.name} caption. Tone: ${tone || 'professional'}. Maximum ${limits.characters || limits.chars} characters. ${cta ? `Include this call to action: "${cta}".` : ''} Do not include hashtags — those are generated separately.`;

  const input = `Content description: ${content}`;

  const response = await callResponsesAPI(selectedModel, instructions, input);
  const caption = extractText(response).trim();

  return { caption, platform, model: selectedModel };
}

/**
 * Generate captions for multiple platforms at once.
 * @param {object} params
 * @param {string[]} params.platforms - Array of platform IDs
 * @param {string} params.tone - Tone of voice
 * @param {string} params.content - Description of the content
 * @param {string} [params.model] - Model override
 * @returns {Promise<Array<{ platform: string, caption: string }>>}
 */
export async function generateMultiPlatformCaptions({ platforms, tone, content, model }) {
  const results = await Promise.all(
    platforms.map(platform =>
      generateCaption({ platform, tone, content, model })
    )
  );
  return results;
}

/**
 * Generate optimized hashtags for a post.
 * @param {object} params
 * @param {string} params.platform - Platform ID
 * @param {string} params.caption - The post caption
 * @param {number} [params.count=10] - Number of hashtags
 * @param {string} [params.model] - Model override (default: gpt-5.6-luna)
 * @returns <Promise<{ hashtags: string[], reachEstimate: string }>>
 */
export async function generateHashtags({ platform, caption, count = 10, model }) {
  const limits = PLATFORM_LIMITS[platform] || PLATFORM_LIMITS.instagram;
  const maxTags = Math.min(count, limits.hashtags);
  const selectedModel = model || MODELS.hashtag;

  const instructions = `Generate ${maxTags} optimized hashtags for a ${limits.name} post. Mix of popular and niche hashtags. Return as a JSON array of strings (without # prefix). Include a reach_estimate field: "low", "medium", or "high".`;

  const input = `Post caption: ${caption}\nPlatform: ${limits.name}`;

  const response = await callResponsesAPI(selectedModel, instructions, input, {
    textFormat: {
      type: 'json_schema',
      name: 'hashtag_response',
      schema: {
        type: 'object',
        properties: {
          hashtags: { type: 'array', items: { type: 'string' } },
          reach_estimate: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['hashtags', 'reach_estimate'],
      },
    },
  });

  const text = extractText(response);
  try {
    const parsed = JSON.parse(text);
    return { hashtags: parsed.hashtags.map(h => h.startsWith('#') ? h : `#${h}`), reachEstimate: parsed.reach_estimate, model: selectedModel };
  } catch {
    return { hashtags: [], reachEstimate: 'unknown', model: selectedModel };
  }
}

/**
 * Generate A/B test caption variations.
 * @param {object} params
 * @param {string} params.platform - Platform ID
 * @param {string} params.topic - Post topic
 * @param {number} [params.count=3] - Number of variations
 * @param {string} [params.model] - Model override (default: gpt-5.6-terra)
 * @returns <Promise<Array<{ hook: string, caption: string }>>>
 */
export async function generateABVariations({ platform, topic, count = 3, model }) {
  const limits = PLATFORM_LIMITS[platform] || PLATFORM_LIMITS.instagram;
  const selectedModel = model || MODELS.abTest;

  const instructions = `Write ${count} different caption variations for A/B testing on ${limits.name}. Each should use a different hook style: question, statistic, story, quote, how-to. Maximum ${limits.chars} characters each. Return as JSON array with "hook" (hook type) and "caption" fields.`;

  const input = `Topic: ${topic}`;

  const response = await callResponsesAPI(selectedModel, instructions, input, {
    textFormat: {
      type: 'json_schema',
      name: 'ab_variations',
      schema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            hook: { type: 'string' },
            caption: { type: 'string' },
          },
          required: ['hook', 'caption'],
        },
      },
    },
  });

  const text = extractText(response);
  try {
    return JSON.parse(text);
  } catch {
    return [{ hook: 'default', caption: text }];
  }
}

/**
 * Generate content ideas for a niche/platform.
 * @param {object} params
 * @param {string} params.niche - Content niche
 * @param {string} params.platform - Platform ID
 * @param {string} params.brandName - Brand name
 * @param {string} params.audience - Target audience description
 * @param {string} params.goals - Content goals
 * @param {number} [params.days=30] - Number of days to generate
 * @returns {Promise<Array<{ date: string, content_type: string, hook: string, best_time: string }>>>
 */
export async function generateContentIdeas({ niche, platform, brandName, audience, goals, days = 30, model }) {
  const limits = PLATFORM_LIMITS[platform] || PLATFORM_LIMITS.instagram;
  const selectedModel = model || MODELS.ideas;

  const instructions = `Generate ${days} days of content ideas for a ${niche} brand on ${limits.name}. Return as JSON array with: date (YYYY-MM-DD), content_type (video/image/carousel/story/poll), hook (attention-grabbing first line), best_time (HH:MM format in UTC).`;

  const input = `Brand: ${brandName}\nTarget audience: ${audience}\nGoals: ${goals}`;

  const response = await callResponsesAPI(selectedModel, instructions, input, {
    textFormat: {
      type: 'json_schema',
      name: 'content_ideas',
      schema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string' },
            content_type: { type: 'string' },
            hook: { type: 'string' },
            best_time: { type: 'string' },
          },
          required: ['date', 'content_type', 'hook', 'best_time'],
        },
      },
    },
  });

  const text = extractText(response);
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

/**
 * Repurpose content into multiple platform formats.
 * @param {object} params
 * @param {string} params.content - Original content
 * @param {string[]} params.platforms - Target platforms
 * @returns {Promise<Array<{ platform: string, format: string, content: string }>>>
 */
export async function repurposeContent({ content, platforms, model }) {
  const platformNames = platforms.map(p => PLATFORM_LIMITS[p]?.name || p).join(', ');
  const selectedModel = model || MODELS.repurpose;

  const instructions = `Repurpose this content into formats optimized for: ${platformNames}. Return as JSON array with: platform, format (thread/post/caption/script/story), and content fields.`;

  const input = content;

  const response = await callResponsesAPI(selectedModel, instructions, input, {
    textFormat: {
      type: 'json_schema',
      name: 'repurposed_content',
      schema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            platform: { type: 'string' },
            format: { type: 'string' },
            content: { type: 'string' },
          },
          required: ['platform', 'format', 'content'],
        },
      },
    },
  });

  const text = extractText(response);
  try {
    return JSON.parse(text);
  } catch {
    return [{ platform: platforms[0], format: 'post', content: text }];
  }
}

/**
 * Analyze caption against brand voice guidelines.
 * @param {object} params
 * @param {string} params.caption - The caption to analyze
 * @param {string} params.guidelines - Brand voice guidelines
 * @returns {Promise<{ sentiment: string, toneMatch: number, suggestions: string[] }>}
 */
export async function analyzeBrandVoice({ caption, guidelines, model }) {
  const selectedModel = model || MODELS.analyze;

  const instructions = `Score this caption against brand voice guidelines. Return JSON with: sentiment (positive/neutral/negative), tone_match (0-100 percentage), suggestions (array of improvement strings).`;

  const input = `Caption: ${caption}\n\nBrand guidelines: ${guidelines}`;

  const response = await callResponsesAPI(selectedModel, instructions, input, {
    textFormat: {
      type: 'json_schema',
      name: 'voice_analysis',
      schema: {
        type: 'object',
        properties: {
          sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
          tone_match: { type: 'integer', minimum: 0, maximum: 100 },
          suggestions: { type: 'array', items: { type: 'string' } },
        },
        required: ['sentiment', 'tone_match', 'suggestions'],
      },
    },
  });

  const text = extractText(response);
  try {
    return JSON.parse(text);
  } catch {
    return { sentiment: 'neutral', tone_match: 50, suggestions: [] };
  }
}

/**
 * Generate a full content calendar.
 * @param {object} params
 * @param {string[]} params.platforms - Target platforms
 * @param {string} params.niche - Content niche
 * @param {number} [params.frequency=3] - Posts per week
 * @returns {Promise<Array<{ date: string, platform: string, caption: string, hashtags: string[], best_time: string, content_type: string }>>>
 */
export async function generateContentCalendar({ platforms, niche, frequency = 3, model }) {
  const selectedModel = model || MODELS.calendar;
  const totalPosts = frequency * 4; // 4 weeks

  const instructions = `Generate a ${totalPosts}-post content calendar for a ${niche} brand. Platforms: ${platforms.join(', ')}. Frequency: ${frequency} posts/week. Return JSON array with: date (YYYY-MM-DD), platform, caption, hashtags (array), best_time (HH:MM UTC), content_type (video/image/carousel).`;

  const input = `Create a diverse content calendar with varied content types and posting times.`;

  const response = await callResponsesAPI(selectedModel, instructions, input, {
    textFormat: {
      type: 'json_schema',
      name: 'content_calendar',
      schema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string' },
            platform: { type: 'string' },
            caption: { type: 'string' },
            hashtags: { type: 'array', items: { type: 'string' } },
            best_time: { type: 'string' },
            content_type: { type: 'string' },
          },
          required: ['date', 'platform', 'caption', 'hashtags', 'best_time', 'content_type'],
        },
      },
    },
  });

  const text = extractText(response);
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

export default {
  generateCaption,
  generateMultiPlatformCaptions,
  generateHashtags,
  generateABVariations,
  generateContentIdeas,
  repurposeContent,
  analyzeBrandVoice,
  generateContentCalendar,
  PLATFORM_LIMITS,
  MODELS,
};
