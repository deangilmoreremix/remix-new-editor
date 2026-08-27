import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock apiKeyManager before importing the module
vi.mock('../apiKeyManager.js', () => ({
  apiKeyManager: {
    getOpenAIKey: vi.fn(),
  },
}));

import { apiKeyManager } from '../apiKeyManager.js';
import {
  generateContentIdeas,
  generateBestTimes,
  analyzeBrandVoice,
  generateContentCalendar,
  MODELS,
} from '../contentIdeasEngine.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_KEY = 'sk-test-valid-key-1234567890';

function mockFetchResponse(data, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  };
}

const SAMPLE_IDEAS_RESPONSE = {
  output: [{
    content: [{
      text: JSON.stringify({
        ideas: [
          { day: 1, title: 'Morning Routine', format: 'reel', topic: 'Productivity', hook: 'Start your day right', caption: 'Here is my morning routine...', hashtags: ['#morning', '#routine'], cta: 'Follow for more', bestTime: '08:00' },
          { day: 2, title: 'Healthy Meal Prep', format: 'carousel', topic: 'Nutrition', hook: 'Meal prep made easy', caption: '5 meals in 1 hour...', hashtags: ['#mealprep', '#healthy'], cta: 'Save this post', bestTime: '12:00' },
        ],
      }),
    }],
  }],
};

const SAMPLE_TIMES_RESPONSE = {
  output: [{
    content: [{
      text: JSON.stringify({
        recommendations: [
          { dayOfWeek: 'Monday', times: [{ time: '08:00', score: 85, reason: 'High engagement' }] },
        ],
        summary: 'Best times are mornings',
      }),
    }],
  }],
};

const SAMPLE_VOICE_RESPONSE = {
  output: [{
    content: [{
      text: JSON.stringify({
        overallScore: 82,
        analyses: [
          { caption: 'Great post!', score: 82, strengths: ['Clear tone'], weaknesses: ['Too long'], suggestions: ['Shorten it'] },
        ],
      }),
    }],
  }],
};

const SAMPLE_CALENDAR_RESPONSE = {
  output: [{
    content: [{
      text: JSON.stringify({
        calendar: [
          { week: 1, platform: 'Instagram', posts: [{ date: '2026-09-01', time: '09:00', format: 'reel', topic: 'Tips', status: 'draft' }] },
        ],
        strategy: 'Focus on educational content',
      }),
    }],
  }],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('contentIdeasEngine', () => {
  let fetchSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    apiKeyManager.getOpenAIKey.mockReturnValue(VALID_KEY);
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // ---- MODELS export ----

  describe('MODELS', () => {
    it('exports pricing for all three GPT-5.6 models', () => {
      expect(MODELS['gpt-5.6-luna']).toEqual({ input: 0.20, output: 1.20, label: expect.any(String) });
      expect(MODELS['gpt-5.6-terra']).toEqual({ input: 2.00, output: 12.00, label: expect.any(String) });
      expect(MODELS['gpt-5.6-sol']).toEqual({ input: 4.00, output: 20.00, label: expect.any(String) });
    });
  });

  // ---- Auth ----

  describe('authentication', () => {
    it('throws when no OpenAI key is configured', async () => {
      apiKeyManager.getOpenAIKey.mockReturnValue(null);
      await expect(generateContentIdeas({ niche: 'fitness', platform: 'Instagram' }))
        .rejects.toThrow('OpenAI API key not configured');
    });

    it('sends the user API key in the x-api-key header for all functions', async () => {
      fetchSpy.mockResolvedValue(mockFetchResponse(SAMPLE_IDEAS_RESPONSE));
      fetchSpy.mockResolvedValue(mockFetchResponse(SAMPLE_TIMES_RESPONSE));
      fetchSpy.mockResolvedValue(mockFetchResponse(SAMPLE_VOICE_RESPONSE));
      fetchSpy.mockResolvedValue(mockFetchResponse(SAMPLE_CALENDAR_RESPONSE));

      await generateContentIdeas({ niche: 'fitness', platform: 'Instagram' });
      await generateBestTimes({ platform: 'TikTok' });
      await analyzeBrandVoice({ captions: ['test'] });
      await generateContentCalendar({ platforms: ['Instagram'], niche: 'fitness' });

      for (const call of fetchSpy.mock.calls) {
        const options = call[1];
        expect(options.headers['x-api-key']).toBe(VALID_KEY);
      }
    });
  });

  // ---- generateContentIdeas ----

  describe('generateContentIdeas', () => {
    it('validates required params', async () => {
      await expect(generateContentIdeas({ platform: 'Instagram' }))
        .rejects.toThrow('niche is required');
      await expect(generateContentIdeas({ niche: 'fitness' }))
        .rejects.toThrow('platform is required');
      await expect(generateContentIdeas({ niche: 'fitness', platform: 'Instagram', days: 0 }))
        .rejects.toThrow('days must be at least 1');
    });

    it('calls the proxy with correct payload and returns parsed ideas', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(SAMPLE_IDEAS_RESPONSE));

      const result = await generateContentIdeas({
        niche: 'fitness',
        platform: 'Instagram',
        brandName: 'FitBrand',
        audience: 'Beginners',
        goals: ['engagement'],
        days: 2,
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toContain('/functions/v1/openai-proxy');
      expect(options.method).toBe('POST');
      expect(options.headers['x-api-key']).toBe(VALID_KEY);

      const body = JSON.parse(options.body);
      expect(body.model).toBe('gpt-5.6-luna');
      expect(body.input).toContain('fitness');
      expect(body.input).toContain('Instagram');
      expect(body.response_format.type).toBe('json_schema');

      expect(result.ideas).toHaveLength(2);
      expect(result.ideas[0].title).toBe('Morning Routine');
    });

    it('uses the model override when provided', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(SAMPLE_IDEAS_RESPONSE));

      await generateContentIdeas({
        niche: 'fitness',
        platform: 'Instagram',
        model: 'gpt-5.6-terra',
      });

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.model).toBe('gpt-5.6-terra');
    });
  });

  // ---- generateBestTimes ----

  describe('generateBestTimes', () => {
    it('validates platform is required', async () => {
      await expect(generateBestTimes({}))
        .rejects.toThrow('platform is required');
    });

    it('returns parsed recommendations', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(SAMPLE_TIMES_RESPONSE));

      const result = await generateBestTimes({ platform: 'TikTok' });

      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations[0].dayOfWeek).toBe('Monday');
      expect(result.summary).toBe('Best times are mornings');

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.model).toBe('gpt-5.6-luna');
    });

    it('passes engagement data in the prompt', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(SAMPLE_TIMES_RESPONSE));

      await generateBestTimes({
        platform: 'LinkedIn',
        engagementData: { Monday: { '09:00': 120 } },
      });

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.input).toContain('Engagement data');
      expect(body.input).toContain('Monday');
    });
  });

  // ---- analyzeBrandVoice ----

  describe('analyzeBrandVoice', () => {
    it('validates captions array is required', async () => {
      await expect(analyzeBrandVoice({}))
        .rejects.toThrow('captions array is required');
      await expect(analyzeBrandVoice({ captions: [] }))
        .rejects.toThrow('captions array is required');
    });

    it('returns parsed brand voice analysis', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(SAMPLE_VOICE_RESPONSE));

      const result = await analyzeBrandVoice({
        captions: ['Great post!', 'Check this out'],
        brandGuidelines: { tone: 'professional', dos: 'be concise', donts: 'use jargon' },
      });

      expect(result.overallScore).toBe(82);
      expect(result.analyses).toHaveLength(1);
      expect(result.analyses[0].caption).toBe('Great post!');

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.input).toContain('Great post!');
      expect(body.input).toContain('professional');
    });
  });

  // ---- generateContentCalendar ----

  describe('generateContentCalendar', () => {
    it('validates platforms array is required', async () => {
      await expect(generateContentCalendar({ niche: 'fitness' }))
        .rejects.toThrow('platforms array is required');
      await expect(generateContentCalendar({ niche: 'fitness', platforms: [] }))
        .rejects.toThrow('platforms array is required');
      await expect(generateContentCalendar({ platforms: ['Instagram'] }))
        .rejects.toThrow('niche is required');
    });

    it('returns parsed calendar', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(SAMPLE_CALENDAR_RESPONSE));

      const result = await generateContentCalendar({
        platforms: ['Instagram', 'TikTok'],
        niche: 'SaaS',
        weeks: 2,
      });

      expect(result.calendar).toHaveLength(1);
      expect(result.calendar[0].platform).toBe('Instagram');
      expect(result.strategy).toBe('Focus on educational content');

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.input).toContain('Instagram');
      expect(body.input).toContain('TikTok');
      expect(body.input).toContain('SaaS');
    });

    it('uses model override', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(SAMPLE_CALENDAR_RESPONSE));

      await generateContentCalendar({
        platforms: ['Instagram'],
        niche: 'fitness',
        model: 'gpt-5.6-sol',
      });

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.model).toBe('gpt-5.6-sol');
    });
  });

  // ---- Error handling ----

  describe('error handling', () => {
    it('throws on non-ok response from proxy', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ error: 'Bad request' }, false, 400));

      await expect(generateContentIdeas({ niche: 'fitness', platform: 'Instagram' }))
        .rejects.toThrow('openai-proxy returned 400');
    });

    it('throws when response has no text content', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ output: [] }));

      await expect(generateContentIdeas({ niche: 'fitness', platform: 'Instagram' }))
        .rejects.toThrow('No content returned');
    });

    it('returns raw text when JSON parsing fails', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({
        output: [{ content: [{ text: 'plain text response' }] }],
      }));

      const result = await generateContentIdeas({ niche: 'fitness', platform: 'Instagram' });
      expect(result).toBe('plain text response');
    });
  });
});
