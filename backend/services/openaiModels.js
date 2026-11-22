/**
 * openaiModels.js
 *
 * Central OpenAI text-model ids for backend services.
 *   OPENAI_TEXT_MODEL — default model for agent reasoning / generation.
 *   OPENAI_FAST_MODEL — cheap model for background / utility calls
 *                       (translation, classification).
 *
 * These are GPT-6 reasoning models: do not send `temperature`, and use
 * `max_completion_tokens` (chat/completions) or `max_output_tokens`
 * (Responses API) instead of `max_tokens`.
 */

export const OPENAI_TEXT_MODEL = 'gpt-6.1-sol';
export const OPENAI_FAST_MODEL = 'gpt-6-luna';
