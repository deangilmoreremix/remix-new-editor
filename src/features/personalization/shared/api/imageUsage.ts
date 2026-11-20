/** OpenAI bills Images 2.6 output at $30 per million image output tokens. Input rates are not included here. */
export const IMAGES_26_OUTPUT_USD_PER_MILLION = 30;

export interface UsageSummary {
  outputTokens?: number
  inputTokens?: number
  /** Estimated cost of the output tokens only (Images 2.6). */
  estimatedOutputUsd?: number
  text: string
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined);

/** A short, honest summary of what a request used. Returns null when OpenAI sent no usage. */
export function describeUsage(usage: unknown, model?: string): UsageSummary | null {
  if (!usage || typeof usage !== 'object') return null;
  const u = usage as Record<string, unknown>;
  const outputTokens = num(u.output_tokens);
  const inputTokens = num(u.input_tokens);
  if (outputTokens === undefined && inputTokens === undefined) return null;
  const parts: string[] = [];
  if (outputTokens !== undefined) parts.push(`${outputTokens.toLocaleString('en-US')} output tokens`);
  if (inputTokens !== undefined) parts.push(`${inputTokens.toLocaleString('en-US')} input tokens`);
  let estimatedOutputUsd: number | undefined;
  if (outputTokens !== undefined && model && /^gpt-image-2\.6-/.test(model)) {
    estimatedOutputUsd = (outputTokens * IMAGES_26_OUTPUT_USD_PER_MILLION) / 1_000_000;
    parts.push(`about $${estimatedOutputUsd < 0.01 ? estimatedOutputUsd.toFixed(4) : estimatedOutputUsd.toFixed(2)} for the picture`);
  }
  return { outputTokens, inputTokens, estimatedOutputUsd, text: `OpenAI used ${parts.join(', ')}.` };
}
