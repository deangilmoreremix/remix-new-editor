/**
 * OpenAI Responses API client (used by Render Studio's AI Auto-Edit planning).
 *
 * The Responses API (https://api.openai.com/v1/responses) is used ONLY for the
 * language/planning part of AI Auto-Edit: given the metadata returned by the
 * Director finishing agents (subtitle segments, detected scenes/highlights),
 * it assembles a validated edit plan as structured JSON. It does NOT perform any
 * video operation — those stay on Director/VideoDB.
 *
 * Uses the user's own OpenAI key (from apiKeyManager), consistent with
 * openaiService.js. Fails loudly when the key is missing or the request errors.
 */

import { apiKeyManager } from './apiKeyManager.js';

const RESPONSES_URL = 'https://api.openai.com/v1/responses';
const PLANNER_MODEL = 'gpt-4.1';

function getOpenAIKey() {
  const key = apiKeyManager.getOpenAIKey?.();
  if (!key) {
    throw new Error('OpenAI API key not configured. Add your OpenAI key in Settings to use AI Auto-Edit planning.');
  }
  return key;
}

// JSON schema for Structured Outputs (strict mode).
const EDIT_PLAN_SCHEMA = {
  type: 'object',
  strict: true,
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    sceneOrder: {
      type: 'array',
      items: {
        type: 'object',
        strict: true,
        additionalProperties: false,
        properties: {
          index: { type: 'integer' },
          startTime: { type: 'number' },
          endTime: { type: 'number' },
          reason: { type: 'string' },
        },
        required: ['index', 'startTime', 'endTime', 'reason'],
      },
    },
    highlightCount: { type: 'integer' },
    captionStyle: { type: 'string' },
    subtitleSegmentCount: { type: 'integer' },
    recommendedExportProfile: { type: 'string' },
  },
  required: [
    'summary',
    'sceneOrder',
    'highlightCount',
    'captionStyle',
    'subtitleSegmentCount',
    'recommendedExportProfile',
  ],
};

/**
 * Build the edit plan from Director-returned metadata.
 * @param {object} meta
 * @param {Array} [meta.scenes]   detected scenes [{startTime,endTime,...}]
 * @param {Array} [meta.highlights] detected highlights [{startTime,endTime,...}]
 * @param {object} [meta.subtitles] { segments:[{start,end,text}] }
 * @param {string} [meta.captionStyle] selected preset caption style
 * @returns {Promise<object>} validated edit plan (matches EDIT_PLAN_SCHEMA)
 */
export async function planAutoEdit(meta = {}, { signal } = {}) {
  const key = getOpenAIKey();

  const input = [
    {
      role: 'system',
      content:
        'You are a video post-production editor. Given detected scenes, highlights, and ' +
        'subtitle segments from a video, produce a concise edit plan. Order scenes for ' +
        'the best narrative, summarize the video, and recommend an export profile. ' +
        'Respond ONLY with the structured schema.',
    },
    {
      role: 'user',
      content:
        'Video metadata:\n' +
        JSON.stringify(
          {
            scenes: meta.scenes || [],
            highlights: meta.highlights || [],
            subtitleSegmentCount: (meta.subtitles?.segments || []).length,
            captionStyle: meta.captionStyle || 'minimal-premium',
          },
          null,
          2
        ),
    },
  ];

  let res;
  try {
    res = await fetch(RESPONSES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: PLANNER_MODEL,
        input,
        text: {
          format: {
            type: 'json_schema',
            name: 'edit_plan',
            schema: EDIT_PLAN_SCHEMA,
            strict: true,
          },
        },
      }),
      signal,
    });
  } catch (err) {
    throw new Error(`OpenAI Responses API request failed: ${err.message}`);
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`OpenAI Responses API returned ${res.status}: ${txt.slice(0, 200)}`);
  }

  const json = await res.json();
  const text = json?.output?.[0]?.content?.[0]?.text;
  if (!text) {
    throw new Error('OpenAI Responses API returned no structured content');
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`Failed to parse edit plan JSON: ${e.message}`);
  }
}

export const openaiResponses = { planAutoEdit };
export default openaiResponses;
