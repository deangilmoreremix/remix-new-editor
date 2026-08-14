/**
 * GTM Responses API client.
 *
 * Handles the AI-powered GTM cinematic prompt generation using the OpenAI
 * Responses API (https://api.openai.com/v1/responses). Built on the same
 * surface as openaiResponses.js and the ai-thumbnail-generator edge function.
 *
 * Features used from the Responses API:
 *  - Structured Outputs (json_schema, strict) for a labeled, UI-renderable prompt
 *  - Streaming (SSE token deltas) for real-time generation feedback
 *  - Multi-turn refine via previous_response_id (store: true)
 *  - Parallel variant generation (pick best)
 *  - Token usage via include: ['input_tokens','output_tokens']
 *
 * Uses the user's own OpenAI key (from apiKeyManager), consistent with the
 * rest of the app. Fails loudly when the key is missing or the request errors.
 */

import { apiKeyManager } from './apiKeyManager.js';

const RESPONSES_URL = 'https://api.openai.com/v1/responses';

// Default model for the cinematic prompt (cheapest, fast, good for structured drafts).
const DEFAULT_MODEL = 'gpt-4.1-mini';

/**
 * Curated, text-capable model catalog for the GTM Boost model chooser.
 * Descriptions are the EXACT wording published by OpenAI on the model catalog
 * (https://developers.openai.com/api/docs/models/all) so the dropdown matches
 * OpenAI's own positioning. Only text-capable, Responses-API models are listed.
 */
export const GTM_MODEL_OPTIONS = [
  {
    id: 'gpt-4.1-mini',
    label: 'GPT-4.1 mini',
    description: 'Smaller, faster version of GPT-4.1',
    tier: 'Fast & affordable',
  },
  {
    id: 'gpt-4.1',
    label: 'GPT-4.1',
    description: 'Smartest non-reasoning model',
    tier: 'Higher quality',
  },
  {
    id: 'gpt-5.4-mini',
    label: 'GPT-5.4 mini',
    description: 'Our strongest mini model yet for coding, computer use, and subagents',
    tier: 'Strong mini',
  },
  {
    id: 'gpt-5.4',
    label: 'GPT-5.4',
    description: 'A more affordable model for coding and professional work.',
    tier: 'Balanced',
  },
  {
    id: 'gpt-5.6-terra',
    label: 'GPT-5.6 Terra',
    description: 'GPT-5.6 model that balances intelligence and cost',
    tier: 'Frontier (value)',
  },
  {
    id: 'gpt-5.6-sol',
    label: 'GPT-5.6 Sol',
    description: 'Frontier model for complex professional work',
    tier: 'Flagship',
  },
];

const GTM_MODEL_IDS = new Set(GTM_MODEL_OPTIONS.map((m) => m.id));

/**
 * Resolve a user-selected model to a known, safe model id. Falls back to the
 * default when the selection is missing or not in the curated catalog
 * (e.g. a deprecated or mistyped model id).
 */
export function resolveGtmModel(preferred) {
  if (preferred && GTM_MODEL_IDS.has(preferred)) return preferred;
  return DEFAULT_MODEL;
}

function getOpenAIKey() {
  const key = apiKeyManager.getOpenAIKey?.();
  if (!key) {
    throw new Error('OpenAI API key not configured. Add your OpenAI key in Settings to use GTM Boost.');
  }
  return key;
}

/**
 * Structured Outputs schema for a GTM cinematic prompt.
 * strict: true requires all properties present and no additionalProperties.
 */
export const GTM_PROMPT_SCHEMA = {
  type: 'object',
  strict: true,
  additionalProperties: false,
  properties: {
    hook: { type: 'string' },
    storybeat_1: { type: 'string' },
    storybeat_2: { type: 'string' },
    storybeat_3: { type: 'string' },
    visualDirection: { type: 'string' },
    audioDirection: { type: 'string' },
    cta: { type: 'string' },
    estimatedDurationSec: { type: 'integer' },
  },
  required: [
    'hook',
    'storybeat_1',
    'storybeat_2',
    'storybeat_3',
    'visualDirection',
    'audioDirection',
    'cta',
    'estimatedDurationSec',
  ],
};

/**
 * Collapse a structured GTM prompt into a single ready-to-use string, used when
 * copying/loading the prompt into a studio.
 */
export function gtmStructuredToText(p) {
  if (!p || typeof p !== 'object') return '';
  const lines = [
    `🎯 HOOK: ${p.hook || ''}`,
    ``,
    `STORYBEAT 1: ${p.storybeat_1 || ''}`,
    `STORYBEAT 2: ${p.storybeat_2 || ''}`,
    `STORYBEAT 3: ${p.storybeat_3 || ''}`,
    ``,
    `VISUAL DIRECTION: ${p.visualDirection || ''}`,
    `AUDIO DIRECTION: ${p.audioDirection || ''}`,
    `CTA: ${p.cta || ''}`,
    `ESTIMATED DURATION: ${p.estimatedDurationSec ? `${p.estimatedDurationSec}s` : 'n/a'}`,
  ];
  return lines.join('\n');
}

import { gtmSkillsPromptForContext } from './gtmSkillsData.js';

/**
 * Build the GTM system persona used for both generation and refine.
 */
function buildInstructions() {
  const exampleNote = [
    'You have access to a real GTM skills library (gtm-skills.com, MIT) with roles,',
    'industries, methodologies (MEDDPICC, SPIN, Challenger, Sandler, Value/Gap Selling)',
    'and 250+ concrete sales prompt examples. The user\'s selected context (role/',
    'industry/methodology) retrieves the most relevant real examples, injected into',
    'the input under "REAL GTM SKILL EXAMPLES". Mirror their structure, depth, and',
    'bracketed-variable style when shaping the cinematic prompt — they are the gold',
    'standard for this domain.',
  ].join(' ');

  return [
    'You are a world-class cinematic prompt engineer for AI video generation and a senior GTM (Go-To-Market) sales enablement expert.',
    'Given a base concept plus GTM context (role, industry, sales methodology, writing style, conversion focus, cinematic elements),',
    'produce a single, premium, conversion-optimized cinematic video prompt.',
    'Return it as structured sections (hook, three story beats, visual direction, audio direction, CTA, estimated duration).',
    'Weave the GTM context into the actual wording — do not just append a label list.',
    exampleNote,
    'Output ONLY the structured schema. No markdown, no preamble.',
  ].join(' ');
}

/**
 * Retrieve real GTM skill examples relevant to the selected context and render
 * them as a block to ground the model. Returns "" when nothing matches.
 */
function buildSkillContext(params) {
  try {
    const examples = gtmSkillsPromptForContext({
      role: params.role,
      industry: params.industry,
      methodology: params.methodology,
      limit: 3,
    });
    if (!examples) return '';
    return `\n\nREAL GTM SKILL EXAMPLES (retrieved from gtm-skills library):\n${examples}`;
  } catch {
    return '';
  }
}

/**
 * Compose the user input text from GTM selections.
 */
export function buildGTMInput(params) {
  const {
    basePrompt,
    role,
    industry,
    methodology,
    tonality,
    focus = [],
    cinematicOptions = {},
  } = params;

  const ctx = [
    `Target role: ${role}`,
    `Industry: ${industry}`,
    `Sales methodology: ${methodology}`,
    `Writing style/tonality: ${tonality}`,
    focus.length ? `Conversion focus: ${focus.join(', ')}` : null,
    cinematicOptions?.openingHook ? 'Emphasize a strong opening hook' : null,
    cinematicOptions?.storytellingStructure ? 'Use a clear 3-act storytelling structure' : null,
    cinematicOptions?.visualElements ? 'Include specific cinematography, lighting and composition details' : null,
    cinematicOptions?.audioElements ? 'Include audio direction (music, SFX, tone)' : null,
    cinematicOptions?.pacingEditing ? 'Specify pacing, rhythm and edit style' : null,
    cinematicOptions?.emotionalEngagement ? 'Emphasize emotional beats and audience empathy' : null,
    cinematicOptions?.ctaIntegration ? 'End with a clear, conversion-focused CTA' : null,
  ].filter(Boolean);

  const skillContext = buildSkillContext({ role, industry, methodology, limit: 3 });

  return `GTM CONTEXT:\n${ctx.join('\n')}\n\nBASE PROMPT:\n${basePrompt}${skillContext}`;
}

/**
 * Generate a structured GTM prompt (non-streaming).
 * @returns {Promise<{prompt: object, responseId: string, usage: object}>}
 */
export async function generateGTMPrompt(params, { signal } = {}) {
  const key = getOpenAIKey();

  const res = await fetch(RESPONSES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: resolveGtmModel(params.model),
      instructions: buildInstructions(),
      input: buildGTMInput(params),
      store: true,
      temperature: 0.7,
      text: {
        format: {
          type: 'json_schema',
          name: 'gtm_cinematic_prompt',
          schema: GTM_PROMPT_SCHEMA,
          strict: true,
        },
      },
      include: ['input_tokens', 'output_tokens'],
    }),
    signal,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`OpenAI Responses API returned ${res.status}: ${txt.slice(0, 200)}`);
  }

  const json = await res.json();
  const text = json?.output?.[0]?.content?.[0]?.text;
  if (!text) throw new Error('OpenAI Responses API returned no structured content');

  let prompt;
  try {
    prompt = JSON.parse(text);
  } catch (e) {
    throw new Error(`Failed to parse GTM prompt JSON: ${e.message}`);
  }

  const usage = extractUsage(json);
  return { prompt, responseId: json?.id || '', usage };
}

/**
 * Stream a structured GTM prompt token-by-token.
 * @param {object} params GTM selections
 * @param {function} onDelta Called with incremental text chunks (raw streamed text)
 * @param {function} onDone  Called with { prompt, responseId, usage } when complete
 */
export async function streamGTMPrompt(params, { onDelta, onDone, onError, signal } = {}) {
  const key = getOpenAIKey();

  const res = await fetch(`${RESPONSES_URL}?stream=true`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      model: resolveGtmModel(params.model),
      instructions: buildInstructions(),
      input: buildGTMInput(params),
      store: true,
      temperature: 0.7,
      text: {
        format: {
          type: 'json_schema',
          name: 'gtm_cinematic_prompt',
          schema: GTM_PROMPT_SCHEMA,
          strict: true,
        },
      },
      include: ['input_tokens', 'output_tokens'],
      stream: true,
    }),
    signal,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`OpenAI Responses API returned ${res.status}: ${txt.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let usage = null;
  let responseId = '';

  const parseEvents = () => {
    const events = [];
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const line = raw.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') {
        events.push({ done: true });
        continue;
      }
      try {
        events.push(JSON.parse(payload));
      } catch {
        /* ignore malformed */
      }
    }
    return events;
  };

  let rawText = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      for (const ev of parseEvents()) {
        if (ev.done) continue;
        if (ev.id) responseId = ev.id;
        if (ev.response?.usage) usage = extractUsage(ev.response);
        const delta = ev?.delta?.text || ev?.delta || '';
        if (typeof delta === 'string' && delta) {
          rawText += delta;
          onDelta?.(delta, rawText);
        }
      }
    }
  } catch (err) {
    onError?.(err);
    throw err;
  }

  // The streamed text is the JSON-schema string; parse into a structured object.
  let prompt;
  try {
    prompt = JSON.parse(rawText);
  } catch {
    prompt = { hook: rawText };
  }

  const result = { prompt, responseId, usage: usage || { inputTokens: 0, outputTokens: 0 } };
  onDone?.(result);
  return result;
}

/**
 * Multi-turn refine: continue from a previous response using previous_response_id.
 * @returns {Promise<{prompt: object, responseId: string, usage: object}>}
 */
export async function refineGTMPrompt(previousResponseId, refineInstruction, { signal, model } = {}) {
  const key = getOpenAIKey();

  const res = await fetch(RESPONSES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: resolveGtmModel(model),
      instructions: buildInstructions(),
      input: [{ role: 'user', content: refineInstruction }],
      previous_response_id: previousResponseId,
      store: true,
      temperature: 0.7,
      text: {
        format: {
          type: 'json_schema',
          name: 'gtm_cinematic_prompt',
          schema: GTM_PROMPT_SCHEMA,
          strict: true,
        },
      },
      include: ['input_tokens', 'output_tokens'],
    }),
    signal,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`OpenAI Responses API returned ${res.status}: ${txt.slice(0, 200)}`);
  }

  const json = await res.json();
  const text = json?.output?.[0]?.content?.[0]?.text;
  if (!text) throw new Error('OpenAI Responses API returned no structured content');

  let prompt;
  try {
    prompt = JSON.parse(text);
  } catch (e) {
    throw new Error(`Failed to parse GTM prompt JSON: ${e.message}`);
  }

  return { prompt, responseId: json?.id || '', usage: extractUsage(json) };
}

/**
 * Generate N parallel variants; returns all parsed prompts (caller picks best).
 * @returns {Promise<Array<{prompt: object, responseId: string, usage: object}>>}
 */
export async function generateGTMVariants(params, { count = 3, signal } = {}) {
  const results = await Promise.all(
    Array.from({ length: count }).map(() =>
      generateGTMPrompt(params, { signal }).catch((err) => ({ error: err.message }))
    )
  );
  return results.filter((r) => r && r.prompt);
}

function extractUsage(json) {
  const u = json?.usage || {};
  return {
    inputTokens: u.input_tokens ?? u.inputTokens ?? 0,
    outputTokens: u.output_tokens ?? u.outputTokens ?? 0,
  };
}

export const gtmResponses = {
  generateGTMPrompt,
  streamGTMPrompt,
  refineGTMPrompt,
  generateGTMVariants,
  gtmStructuredToText,
  buildGTMInput,
  GTM_PROMPT_SCHEMA,
  GTM_MODEL_OPTIONS,
  resolveGtmModel,
};
export default gtmResponses;
