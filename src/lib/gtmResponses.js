/**
 * GTM Responses API client
 *
 * Wraps the OpenAI Responses API for GTM Boost prompt generation,
 * streaming, variants, and multi-turn refinement.
 *
 * Falls back to local `gtmContentLibrary` when no OpenAI key is configured
 * or when the API call fails.
 */

import { apiKeyManager } from './apiKeyManager.js';
import { gtmContentLibrary } from './gtmContentLibrary.js';

// ---------------------------------------------------------------------------
// Model options shown in the GTM Boost modal model selector.
// ---------------------------------------------------------------------------
export const GTM_MODEL_OPTIONS = [
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini (fast/cheap)' },
  { id: 'gpt-4o', label: 'GPT-4o (balanced)' },
  { id: 'gpt-4.1', label: 'GPT-4.1 (quality)' },
  { id: 'gpt-5-mini', label: 'GPT-5 Mini (next-gen fast)' },
  { id: 'gpt-5-nano', label: 'GPT-5 Nano (ultra-fast)' },
];

export function resolveGtmModel(selected) {
  if (!selected) return 'gpt-4o-mini';
  const found = GTM_MODEL_OPTIONS.find((m) => m.id === selected);
  return found ? found.id : selected;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getOpenAIKey() {
  return apiKeyManager.getOpenAIKey();
}

function hasOpenAIKey() {
  return apiKeyManager.hasOpenAIKey();
}

function buildSystemPrompt(params) {
  const {
    role,
    industry,
    methodology,
    tonality,
    focus = [],
    cinematicOptions = {},
    templateContext = {},
  } = params;

  const roleContent = (gtmContentLibrary.roles && gtmContentLibrary.roles[role]) || gtmContentLibrary.roles?.sdr || {};
  const industryContent = (gtmContentLibrary.industries && gtmContentLibrary.industries[industry]) || gtmContentLibrary.industries?.saas || {};
  const methodologyContent = (gtmContentLibrary.methodologies && gtmContentLibrary.methodologies[methodology]) || gtmContentLibrary.methodologies?.spin || {};
  const tonalityContent = (gtmContentLibrary.tonalities && gtmContentLibrary.tonalities[tonality]) || gtmContentLibrary.tonalities?.professional || {};

  const focusLabels = focus
    .map((id) => {
      const area = (gtmContentLibrary.focusAreas || []).find((f) => f.id === id);
      return area ? area.label : null;
    })
    .filter(Boolean)
    .join(', ');

  const cinematicElements = [];
  if (cinematicOptions.openingHook) cinematicElements.push('Opening Hook');
  if (cinematicOptions.storytellingStructure) cinematicElements.push('Storytelling Structure');
  if (cinematicOptions.visualElements) cinematicElements.push('Visual Cinematography');
  if (cinematicOptions.audioElements) cinematicElements.push('Audio Excellence');
  if (cinematicOptions.pacingEditing) cinematicElements.push('Pacing & Editing');
  if (cinematicOptions.emotionalEngagement) cinematicElements.push('Emotional Engagement');
  if (cinematicOptions.ctaIntegration) cinematicElements.push('CTA Integration');

  return [
    'You are a master cinematic video director and senior sales enablement expert specializing in GTM (Go-To-Market) methodologies and conversion-optimized content creation.',
    '',
    `Role Context: ${roleContent.description || role}`,
    `Objectives: ${(roleContent.objectives || []).join(', ')}`,
    `Primary KPI: ${roleContent.primaryKPI || 'conversion'}`,
    '',
    `Industry Focus: ${industryContent.description || industry}`,
    `Key Considerations: ${(industryContent.considerations || []).join(', ')}`,
    '',
    `Sales Framework: ${methodologyContent.name || methodology}`,
    `Application: ${methodologyContent.application || ''}`,
    '',
    `Writing Style: ${tonalityContent.name || tonality}`,
    `Guidelines: ${tonalityContent.guidelines || ''}`,
    '',
    focusLabels ? `Focus Areas: ${focusLabels}` : '',
    cinematicElements.length ? `Cinematic Elements: ${cinematicElements.join(', ')}` : '',
    templateContext.category ? `Template Category: ${templateContext.category}` : '',
    templateContext.niche ? `Template Niche: ${templateContext.niche}` : '',
    templateContext.outputType ? `Output Type: ${templateContext.outputType}` : '',
    '',
    'Return ONLY the optimized cinematic prompt — no preamble, no explanation, no labels. The prompt should be ready to paste into a video generation model.',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildUserPrompt(basePrompt) {
  return `Base Prompt: ${basePrompt || '(no base prompt provided — generate a cinematic template-driven prompt for the selections above)'}`;
}

function buildRequestBody(params, previousResponseId) {
  const body = {
    model: resolveGtmModel(params.model),
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: buildUserPrompt(params.basePrompt) },
        ],
      },
    ],
    instructions: buildSystemPrompt(params),
    store: true,
  };

  if (previousResponseId) {
    body.previous_response_id = previousResponseId;
  }

  return body;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Stream a GTM prompt using the OpenAI Responses API.
 */
async function streamGTMPrompt(params, callbacks = {}) {
  if (!hasOpenAIKey()) {
    const err = new Error('OpenAI API key not configured');
    callbacks.onError?.(err);
    throw err;
  }

  const key = getOpenAIKey();
  if (!key) {
    const err = new Error('OpenAI API key not configured');
    callbacks.onError?.(err);
    throw err;
  }

  const body = buildRequestBody(params);

  const response = await fetch('https://api.openai.com/v1/responses?stream=true', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
    signal: callbacks.signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    const err = new Error(`Responses API error: ${error.error?.message || error.details || response.statusText}`);
    callbacks.onError?.(err);
    throw err;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResponse = null;

  const processLine = (line) => {
    if (!line.startsWith('data:')) return;
    const payload = line.slice(5).trim();
    if (payload === '[DONE]') return;
    let event;
    try {
      event = JSON.parse(payload);
    } catch {
      return;
    }

    if (event.type === 'response.output_text.delta' || event.type === 'output_text.delta') {
      const delta = event.delta || event.content || '';
      callbacks.onDelta?.(delta, delta);
    } else if (event.type === 'response.completed' || event.type === 'response.done') {
      finalResponse = event.response || event;
    } else if (event.type === 'error') {
      const err = new Error(event.error?.message || 'Stream error');
      callbacks.onError?.(err);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) processLine(trimmed);
    }
  }

  if (!finalResponse) {
    const err = new Error('Responses API stream ended without a completed response');
    callbacks.onError?.(err);
    throw err;
  }

  const result = parseResponsesOutput(finalResponse);
  callbacks.onDone?.(result);
  return result;
}

/**
 * Generate multiple GTM prompt variants.
 */
async function generateGTMVariants(params, options = {}) {
  if (!hasOpenAIKey()) {
    throw new Error('OpenAI API key not configured');
  }

  const key = getOpenAIKey();
  if (!key) {
    throw new Error('OpenAI API key not configured');
  }

  const count = Math.min(options.count || 3, 5);
  const promises = [];

  for (let i = 0; i < count; i++) {
    const body = buildRequestBody(params);
    body.temperature = 0.7 + i * 0.1;

    promises.push(
      fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body),
      }).then(async (res) => {
        if (!res.ok) {
          const error = await res.json().catch(() => ({ error: { message: 'Unknown error' } }));
          throw new Error(`Responses API error: ${error.error?.message || error.details || res.statusText}`);
        }
        const data = await res.json();
        return parseResponsesOutput(data);
      })
    );
  }

  try {
    const results = await Promise.all(promises);
    return results.map((r) => ({
      prompt: r.prompt,
      responseId: r.responseId,
      usage: r.usage,
    }));
  } catch (err) {
    console.warn('[gtmResponses] Variant generation failed:', err);
    throw err;
  }
}

/**
 * Refine a previous GTM prompt using multi-turn Responses API.
 */
async function refineGTMPrompt(previousResponseId, instruction, options = {}) {
  if (!hasOpenAIKey()) {
    throw new Error('OpenAI API key not configured');
  }

  const key = getOpenAIKey();
  if (!key) {
    throw new Error('OpenAI API key not configured');
  }

  if (!previousResponseId) {
    throw new Error('previousResponseId is required for refinement');
  }

  const body = {
    model: resolveGtmModel(options.model),
    previous_response_id: previousResponseId,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: instruction },
        ],
      },
    ],
    store: true,
  };

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(`Responses API refine error: ${error.error?.message || error.details || response.statusText}`);
  }

  const data = await response.json();
  return parseResponsesOutput(data);
}

// ---------------------------------------------------------------------------
// Output parsing
// ---------------------------------------------------------------------------

/**
 * Convert structured Responses API output to plain text.
 */
export function gtmStructuredToText(structured) {
  if (!structured || typeof structured !== 'object') return '';

  if (typeof structured === 'string') return structured;

  if (structured.prompt && typeof structured.prompt === 'string') {
    return structured.prompt;
  }

  if (Array.isArray(structured.output)) {
    const parts = [];
    for (const item of structured.output) {
      if (item.type === 'output_text' || item.type === 'message') {
        const text = item.text || item.content || '';
        if (text) parts.push(text);
      } else if (typeof item === 'string') {
        parts.push(item);
      }
    }
    if (parts.length) return parts.join('\n');
  }

  if (Array.isArray(structured.content)) {
    const parts = [];
    for (const item of structured.content) {
      if (item.type === 'text' || item.type === 'output_text') {
        const text = item.text || '';
        if (text) parts.push(text);
      }
    }
    if (parts.length) return parts.join('\n');
  }

  return '';
}

function parseResponsesOutput(data) {
  let promptText = '';
  let responseId = data.id || '';
  const usage = data.usage || null;

  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (item.type === 'output_text' || item.type === 'message') {
        const text = item.text || item.content || '';
        if (text) promptText += text;
      }
    }
  }

  if (!promptText && Array.isArray(data.content)) {
    for (const item of data.content) {
      if (item.type === 'text' || item.type === 'output_text') {
        const text = item.text || '';
        if (text) promptText += text;
      }
    }
  }

  if (!promptText) {
    promptText = gtmStructuredToText(data);
  }

  return {
    prompt: promptText || data.output_text || '',
    responseId,
    usage,
  };
}

export const gtmResponses = {
  streamGTMPrompt,
  generateGTMVariants,
  refineGTMPrompt,
};
