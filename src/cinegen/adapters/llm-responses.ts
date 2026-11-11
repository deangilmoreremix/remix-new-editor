// [remix] One free-form OpenAI Responses call (user's own key) via /api/timeline-llm task "raw".
import { openaiKeyHeader } from '../../lib/openaiKeyHeader.js';

export async function authHeader(): Promise<Record<string, string>> {
  try {
    const token = await (window as unknown as { Clerk?: { session?: { getToken?: () => Promise<string> } } }).Clerk?.session?.getToken?.();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch { return {}; }
}

/** One free-form Responses API call (user's own OpenAI key) via /api/timeline-llm task "raw". */
export async function responsesChat(input: { system?: string; user: string; images?: string[]; json?: boolean }) {
  const res = await fetch('/api/timeline-llm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()), ...openaiKeyHeader() },
    body: JSON.stringify({ task: 'raw', input }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(data?.error?.message || `The AI is unavailable (HTTP ${res.status}). Add your OpenAI key in Settings.`);
  const u = data.usage ?? {};
  return {
    message: String(data.data?.text ?? ''),
    usage: { promptTokens: u.input_tokens ?? 0, completionTokens: u.output_tokens ?? 0, totalTokens: u.total_tokens ?? 0, cachedTokens: u.input_tokens_details?.cached_tokens ?? 0 },
  };
}


