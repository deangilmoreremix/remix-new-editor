// OpenAI text-model defaults for Netlify functions. Each call site keeps its own
// env-var override first (e.g. `process.env.OPENAI_RESPONSES_TEXT_MODEL || OPENAI_TEXT_MODEL`).
// Image / TTS / transcription / realtime models are configured where they are used.

/** Default text model (GPT-6.1 Sol). */
export const OPENAI_TEXT_MODEL = 'gpt-6.1-sol';
/** Cheap / background text model (GPT-6 Luna). */
export const OPENAI_FAST_MODEL = 'gpt-6-luna';
