import { getCliProviderLabel, getDefaultModelForCliProvider, type CliLlmProviderId } from '@cinegen/lib/llm/claude-code-session';
import { cancelCliCopilotChat, invokeCliCopilotChat } from '@cinegen/lib/llm/cli-copilot-client';
import type { CopilotVisualRefInput } from '@cinegen/lib/llm/copilot-visual-refs';
import type { LlmImageAttachment } from '@cinegen/lib/llm/image-attachments';
import { decodeLocalMediaUrl } from '@cinegen/lib/media/asset-local-storage';
import { getApiKey, getOpenAiApiKey } from '@cinegen/lib/utils/api-key';
import {
  FAL_DIRECTOR_LLM_LABEL,
  FAL_DIRECTOR_LLM_MODEL,
  HIGGSFIELD_DIRECTOR_LLM_LABEL,
  HIGGSFIELD_DIRECTOR_LLM_MODEL,
  HIGGSFIELD_LLM_CLI_SUPPORTED,
  LUNA_DIRECTOR_LLM_LABEL,
  LUNA_DIRECTOR_LLM_MODEL,
  OPENAI_DIRECTOR_LLM_LABEL,
  cliTransportFor,
  type DirectorLlmProvider,
} from './cli-provider';
import { extractJsonValue } from './llm-jobs';
import { priceOpenAiUsage, type OpenAiPricedUsage, type OpenAiTokenUsage } from '@cinegen/lib/llm/openai-usage';

export const DIRECTOR_CLI_TIMEOUT_MS = 120_000;
/** Full-coverage shotlist responses run to dozens of detailed clips — give
 *  them far longer than the quick jobs before declaring the model hung. */
export const DIRECTOR_SHOTLIST_TIMEOUT_MS = 300_000;

/** Fast model per CLI for high-volume structured jobs (shotlist batches):
 *  the default Sonnet takes minutes per batch, which reads as a hang. */
const FAST_CLI_MODELS: Record<string, string> = { 'claude-code': 'haiku' };

export function directorCliJobPrompt(systemPrompt: string, userPrompt: string): {
  systemPrompt: string;
  userMessage: string;
} {
  return {
    systemPrompt: `${systemPrompt.trim()}\n\nReturn ONLY a JSON object. No markdown fences, no preamble, no tools, no file search.`,
    userMessage: userPrompt.trim(),
  };
}

function cliVisualRefsFromUrls(urls: string[]): CopilotVisualRefInput[] {
  return urls.flatMap((url, index) => {
    const fileRef = decodeLocalMediaUrl(url);
    if (!fileRef) return [];
    return [{
      label: `mood-${index + 1}`,
      kind: 'asset',
      mediaType: 'image',
      fileRef,
    }];
  });
}

/** Gemini IPC already inlines @paths from visualRefs. Claude/Codex json jobs do not. */
function withCliImageMentions(
  provider: DirectorLlmProvider,
  userMessage: string,
  refs: CopilotVisualRefInput[],
): string {
  if (refs.length === 0 || provider === 'gemini') return userMessage;
  const paths = refs.map((ref) => `@${ref.fileRef}`).join(' ');
  return `${paths}\n\n${userMessage}`;
}

function providerLabel(provider: DirectorLlmProvider): string {
    if (provider === 'luna') return LUNA_DIRECTOR_LLM_LABEL;
  if (provider === 'openai') return OPENAI_DIRECTOR_LLM_LABEL;
  return getCliProviderLabel(provider);
}

function cliJobModel(provider: DirectorLlmProvider, cli: CliLlmProviderId, fast?: boolean): string {
  if (provider === 'luna') return LUNA_DIRECTOR_LLM_MODEL;
  return (fast && FAST_CLI_MODELS[cli]) || getDefaultModelForCliProvider(cli);
}

async function invokeOpenAiLlm(prompt: { systemPrompt: string; userMessage: string }, imageUrls: string[] = []): Promise<{
  message: string;
  usage?: OpenAiPricedUsage;
}> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) throw new Error('No OpenAI API key. Add your own key in Settings → API keys (OpenAI API Key).');
  const result = await window.electronAPI.llm.openaiChat({
    apiKey,
    model: LUNA_DIRECTOR_LLM_MODEL,
    systemPrompt: prompt.systemPrompt,
    userMessage: prompt.userMessage,
    ...(imageUrls.length > 0 ? { imageUrls } : {}),
  });
  const text = result.message?.trim() ?? '';
  if (!text) throw new Error('OpenAI returned no text output.');
  const raw = result.usage;
  const usage = raw && (raw.promptTokens > 0 || raw.completionTokens > 0)
    ? priceOpenAiUsage({
      promptTokens: raw.promptTokens,
      completionTokens: raw.completionTokens,
      totalTokens: raw.totalTokens,
      cachedTokens: raw.cachedTokens ?? 0,
      cacheWriteTokens: raw.cacheWriteTokens ?? 0,
    } satisfies OpenAiTokenUsage)
    : undefined;
  return { message: text, ...(usage ? { usage } : {}) };
}

async function invokeHostedLlm(
  provider: DirectorLlmProvider,
  prompt: { systemPrompt: string; userMessage: string },
  imageUrls: string[] = [],
): Promise<{ message: string; usage?: OpenAiPricedUsage }> {
  // [remix] The web editor runs the Director on the OpenAI Responses API (the fal / Higgsfield / CLI paths are gone).
  void provider;
  return invokeOpenAiLlm(prompt, imageUrls);
}

export async function runDirectorJsonJob(
  systemPrompt: string,
  userPrompt: string,
  provider: DirectorLlmProvider,
  requestId: string = crypto.randomUUID(),
  signal?: AbortSignal,
  options?: {
    timeoutMs?: number;
    fast?: boolean;
    resumeSessionId?: string;
    onSession?: (sessionId: string) => void;
    onUsage?: (usage: OpenAiPricedUsage) => void;
    /** Mood-board (or other) stills. Look-bible rewrite is the intended caller. */
    imageUrls?: string[];
  },
): Promise<unknown> {
  const timeoutMs = options?.timeoutMs ?? DIRECTOR_CLI_TIMEOUT_MS;
  const imageUrls = (options?.imageUrls ?? []).map((url) => url.trim()).filter(Boolean);
  const visualRefs = cliVisualRefsFromUrls(imageUrls);
  const prompt = directorCliJobPrompt(
    systemPrompt,
    withCliImageMentions(provider, userPrompt, visualRefs),
  );
  const cli = cliTransportFor(provider);
  const cancel = () => {
    // Hosted calls (fal, OpenAI, Higgsfield) cannot be cancelled; only local CLI LLM
    // jobs have a kill switch.
    if (cli) void cancelCliCopilotChat(cli, requestId);
  };
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    if (signal?.aborted) {
      cancel();
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    onAbort = () => {
      cancel();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
  const timedOut = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      cancel();
      reject(new Error(cli
        ? 'Timed out waiting for the CLI. Cancel and try again, or pick another CLI.'
        : 'Timed out waiting for the hosted model. Try again, or pick a CLI.'));
    }, timeoutMs);
  });

  try {
    const invoke = cli
      ? invokeCliCopilotChat(cli, {
        requestId,
        model: cliJobModel(provider, cli, options?.fast),
        injectProjectContext: false,
        purpose: 'json-job',
        resumeSessionId: options?.resumeSessionId,
        systemPrompt: prompt.systemPrompt,
        userMessage: prompt.userMessage,
        ...(visualRefs.length > 0 ? { visualRefs } : {}),
      })
      : invokeHostedLlm(provider, prompt, imageUrls);
    const response = await Promise.race([invoke, timedOut, aborted]);
    if ('sessionId' in response && response.sessionId) options?.onSession?.(response.sessionId);
    if (provider === 'openai' && response.usage && 'cost' in response.usage) {
      options?.onUsage?.(response.usage as OpenAiPricedUsage);
    }
    return extractJsonValue(response.message ?? '');
  } catch (error) {
    if (error instanceof DOMException) throw error;
    const detail = error instanceof Error ? error.message : 'Director LLM job failed.';
    throw new Error(`${providerLabel(provider)}: ${detail}`);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (onAbort) signal?.removeEventListener('abort', onAbort);
  }
}

/** Freeform chat for the header Assistant — same providers as Director LLM, no JSON contract. */
export async function runDirectorTextJob(
  systemPrompt: string,
  userMessage: string,
  provider: DirectorLlmProvider,
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>,
  images: LlmImageAttachment[] = [],
): Promise<string> {
  const prompt = { systemPrompt: systemPrompt.trim(), userMessage: userMessage.trim() };
  const cli = cliTransportFor(provider);
  if (cli) {
    const result = await invokeCliCopilotChat(cli, {
      purpose: 'copilot',
      injectProjectContext: true,
      model: cliJobModel(provider, cli),
      systemPrompt: prompt.systemPrompt,
      userMessage: prompt.userMessage,
      messages,
      images,
    });
    const text = result.message?.trim() ?? '';
    if (!text) throw new Error('The model returned no output.');
    return text;
  }
  if (provider === 'openai') {
    const apiKey = getOpenAiApiKey();
    if (!apiKey) throw new Error('No OpenAI API key. Add your own key in Settings → API keys (OpenAI API Key).');
    const history = (messages ?? []).map((row) => `${row.role === 'user' ? 'User' : 'Assistant'}:\n${row.content}`).join('\n\n');
    const result = await window.electronAPI.llm.openaiChat({
      apiKey,
      model: LUNA_DIRECTOR_LLM_MODEL,
      systemPrompt: prompt.systemPrompt,
      userMessage: history || prompt.userMessage,
      jsonObject: false,
      imageUrls: images.map(image => image.dataUrl),
    });
    const text = result.message?.trim() ?? '';
    if (!text) throw new Error('OpenAI returned no text output.');
    return text;
  }
  const hosted = await invokeHostedLlm(provider, {
    systemPrompt: prompt.systemPrompt,
    userMessage: (messages ?? []).length > 1
      ? (messages ?? []).map((row) => `${row.role === 'user' ? 'User' : 'Assistant'}:\n${row.content}`).join('\n\n')
      : prompt.userMessage,
  }, images.map(image => image.dataUrl));
  return hosted.message;
}
