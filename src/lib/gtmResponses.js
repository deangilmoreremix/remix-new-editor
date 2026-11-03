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
 *  - Token usage from the response `usage` object (always returned)
 *  - Studio-aware output: every studio gets a prompt shaped for its model
 *    (see gtmStudioProfiles.js)
 *
 * Uses the user's own OpenAI key (from apiKeyManager), consistent with the
 * rest of the app. Fails loudly when the key is missing or the request errors.
 */

import { apiKeyManager } from './apiKeyManager.js';
import { getGtmStudioProfile, GTM_STUDIO_SCHEMA, normalizeGtmResult } from './gtmStudioProfiles.js';

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
  // Studio-aware results carry a ready-to-paste prompt.
  if (typeof p.finalPrompt === 'string' && p.finalPrompt.trim()) return p.finalPrompt.trim();
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
 * Build the GTM system persona for a studio. The output contract (what the
 * ready-to-paste `finalPrompt` must look like and which sections to return)
 * comes from the studio profile, so Image Studio gets an image prompt, Avatar
 * Studio a spoken script, Audio Studio a music/voice brief, and so on.
 */
export function buildInstructions(appTheme, outputType) {
  const profile = getGtmStudioProfile(appTheme, { outputType });
  const exampleNote = [
    'You have access to a real GTM skills library (gtm-skills.com, MIT) with roles,',
    'industries, methodologies (MEDDPICC, SPIN, Challenger, Sandler, Value/Gap Selling)',
    'and 250+ concrete sales prompt examples. When the input contains',
    '"REAL GTM SKILL EXAMPLES", borrow their buyer insight and messaging angle —',
    'never copy their format into the final prompt.',
  ].join(' ');

  return [
    `You are a senior GTM (Go-To-Market) strategist and an expert prompt engineer for ${profile.studioName}, which generates ${profile.kindLabel.toLowerCase()}s.`,
    'Turn the base idea plus GTM context (target role, industry, sales methodology, writing style, conversion goal) into a conversion-optimized result for this studio.',
    'Weave the buyer insight into the actual wording — do not just append a list of labels.',
    ...profile.finalPromptRules,
    `sections: return these labelled parts in this order, each 1–2 sentences: ${profile.sections.join(', ')}.`,
    'angle: one sentence naming the GTM angle you chose and why it converts for this audience.',
    'cta: the single call to action.',
    profile.hasDuration
      ? 'estimatedDurationSec: realistic runtime in seconds.'
      : 'estimatedDurationSec: 0 (this output is a still).',
    exampleNote,
    'Output ONLY the JSON schema. No markdown, no preamble.',
  ].join('\n');
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
    angle,
    focus = [],
    cinematicOptions = {},
    appTheme,
    outputType,
  } = params;

  const profile = getGtmStudioProfile(appTheme, { outputType });
  const enhancementLines = (profile.enhancements || [])
    .filter((e) => cinematicOptions?.[e.key])
    .map((e) => `- ${e.instruction}`);

  const ctx = [
    `Studio: ${profile.studioName} (${profile.kindLabel})`,
    role ? `Target role: ${role}` : null,
    industry ? `Industry: ${industry}` : null,
    methodology ? `Sales methodology: ${methodology}` : null,
    tonality ? `Writing style/tonality: ${tonality}` : null,
    angle ? `Content angle: ${angle}` : null,
    focus.length ? `Conversion goal: ${focus.join(', ')}` : null,
    enhancementLines.length ? `Must include:\n${enhancementLines.join('\n')}` : null,
  ].filter(Boolean);

  const skillContext = buildSkillContext({ role, industry, methodology, limit: 3 });

  return `GTM CONTEXT:\n${ctx.join('\n')}\n\nBASE PROMPT:\n${basePrompt}${skillContext}`;
}

/** GPT-5-family / o-series reasoning models reject `temperature`. */
function isReasoningModel(model) {
  return /^(gpt-5|o\d)/i.test(String(model || ''));
}

/**
 * Build a Responses API request body. Notes on what was wrong before:
 *  - `include: ['input_tokens','output_tokens']` is not a valid include value
 *    (the API 400s); usage is always returned on the response.
 *  - `temperature` is rejected by reasoning models (every gpt-5.x option).
 * Both made every AI call fail and silently fall back to the offline template.
 */
function buildRequestBody({ model, appTheme, outputType, input, previousResponseId, stream = false }) {
  const resolved = resolveGtmModel(model);
  const body = {
    model: resolved,
    instructions: buildInstructions(appTheme, outputType),
    input,
    store: true,
    text: {
      format: {
        type: 'json_schema',
        name: 'gtm_studio_prompt',
        schema: GTM_STUDIO_SCHEMA,
        strict: true,
      },
    },
  };
  if (!isReasoningModel(resolved)) body.temperature = 0.7;
  if (previousResponseId) body.previous_response_id = previousResponseId;
  if (stream) body.stream = true;
  return body;
}

/**
 * Pull the assistant text out of a Responses API payload. Reasoning models put
 * a `reasoning` item first, so `output[0].content[0].text` is not reliable.
 */
function extractOutputText(json) {
  if (typeof json?.output_text === 'string' && json.output_text) return json.output_text;
  for (const item of json?.output || []) {
    if (item?.type !== 'message') continue;
    for (const part of item.content || []) {
      if (part?.type === 'output_text' && part.text) return part.text;
      if (part?.type === 'refusal' && part.refusal) throw new Error(`Model refused: ${part.refusal}`);
    }
  }
  return '';
}

function parseStudioResult(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`Failed to parse GTM prompt JSON: ${e.message}`);
  }
  const normalized = normalizeGtmResult(parsed);
  if (!normalized || !normalized.finalPrompt) throw new Error('GTM response did not include a prompt');
  return normalized;
}

async function postResponses(body, signal) {
  const key = getOpenAIKey();
  const res = await fetch(RESPONSES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      ...(body.stream ? { Accept: 'text/event-stream' } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`OpenAI Responses API returned ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res;
}

/**
 * Generate a studio-shaped GTM prompt (non-streaming).
 * @param {object} params GTM selections + `appTheme`
 * @returns {Promise<{prompt: object, responseId: string, usage: object}>}
 */
export async function generateGTMPrompt(params, { signal } = {}) {
  const body = buildRequestBody({ model: params.model, appTheme: params.appTheme, outputType: params.outputType, input: buildGTMInput(params) });
  const res = await postResponses(body, signal);
  const json = await res.json();
  const text = extractOutputText(json);
  if (!text) throw new Error('OpenAI Responses API returned no structured content');
  return { prompt: parseStudioResult(text), responseId: json?.id || '', usage: extractUsage(json) };
}

/**
 * Stream a studio-shaped GTM prompt token-by-token.
 * @param {object} params GTM selections + `appTheme`
 * @param {function} onDelta Called with (chunk, fullTextSoFar)
 * @param {function} onDone  Called with { prompt, responseId, usage } when complete
 */
export async function streamGTMPrompt(params, { onDelta, onDone, onError, signal } = {}) {
  const body = buildRequestBody({ model: params.model, appTheme: params.appTheme, outputType: params.outputType, input: buildGTMInput(params), stream: true });
  const res = await postResponses(body, signal);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let usage = null;
  let responseId = '';
  let rawText = '';
  let streamError = null;

  const handleEvent = (ev) => {
    switch (ev?.type) {
      case 'response.created':
      case 'response.in_progress':
        if (ev.response?.id) responseId = ev.response.id;
        break;
      case 'response.output_text.delta':
        if (typeof ev.delta === 'string' && ev.delta) {
          rawText += ev.delta;
          onDelta?.(ev.delta, rawText);
        }
        break;
      case 'response.refusal.delta':
        streamError = new Error('The model refused this request. Try rephrasing the idea.');
        break;
      case 'response.completed':
        if (ev.response?.id) responseId = ev.response.id;
        if (ev.response?.usage) usage = extractUsage(ev.response);
        if (!rawText) rawText = extractOutputText(ev.response) || rawText;
        break;
      case 'response.failed':
      case 'response.incomplete':
        streamError = new Error(ev.response?.error?.message || ev.response?.incomplete_details?.reason || 'Generation did not complete');
        break;
      case 'error':
        streamError = new Error(ev.message || ev.error?.message || 'Streaming error');
        break;
      default:
        break;
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const line = raw.split('\n').find((l) => l.startsWith('data:'));
        if (!line) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try { handleEvent(JSON.parse(payload)); } catch { /* ignore malformed */ }
      }
    }
    if (streamError) throw streamError;
    if (!rawText) throw new Error('OpenAI Responses API returned no content');
  } catch (err) {
    onError?.(err);
    throw err;
  }

  const result = {
    prompt: parseStudioResult(rawText),
    responseId,
    usage: usage || { inputTokens: 0, outputTokens: 0 },
  };
  onDone?.(result);
  return result;
}

/**
 * Multi-turn refine: continue from a previous response using previous_response_id.
 * @returns {Promise<{prompt: object, responseId: string, usage: object}>}
 */
export async function refineGTMPrompt(previousResponseId, refineInstruction, { signal, model, appTheme, outputType } = {}) {
  const body = buildRequestBody({
    model,
    appTheme,
    outputType,
    input: [{ role: 'user', content: refineInstruction }],
    previousResponseId,
  });
  const res = await postResponses(body, signal);
  const json = await res.json();
  const text = extractOutputText(json);
  if (!text) throw new Error('OpenAI Responses API returned no structured content');
  return { prompt: parseStudioResult(text), responseId: json?.id || '', usage: extractUsage(json) };
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
  const ok = results.filter((r) => r && r.prompt);
  if (ok.length === 0) {
    const firstError = results.find((r) => r?.error)?.error;
    throw new Error(firstError || 'No variants returned');
  }
  return ok;
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
  GTM_STUDIO_SCHEMA,
  GTM_MODEL_OPTIONS,
  resolveGtmModel,
};
export default gtmResponses;
