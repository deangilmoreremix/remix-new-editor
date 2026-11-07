// [remix] Real browser implementations of the parts of CineGen's `window.electronAPI` this editor needs.
// Registered into the shim (electron-shim.ts) so CineGen's own code paths run unchanged.
import { registerElectronApi } from './electron-shim';
import { uploadFileToStorage } from '../../lib/supabase.js';
import { openaiKeyHeader } from '../../lib/openaiKeyHeader.js';

async function authHeader(): Promise<Record<string, string>> {
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

export function registerWebApi() {
  registerElectronApi('llm', {
    // CineGen's OpenAI path: { apiKey, model, systemPrompt, userMessage, imageUrls, jsonObject } -> { message, usage }
    openaiChat: async (p: unknown) => {
      const a = p as { systemPrompt?: string; userMessage: string; imageUrls?: string[]; jsonObject?: boolean };
      return responsesChat({ system: a.systemPrompt, user: a.userMessage, images: a.imageUrls, json: a.jsonObject !== false });
    },
    // Detected CLIs (Claude Code / Codex / Gemini) are desktop-only.
    cliDetect: async () => ({ providers: [] }),
    localModels: async () => [],
  });
  registerElectronApi('elements', {
    // CineGen uploads reference images/frames and expects { url }. We store them in our storage bucket.
    upload: async (file: unknown) => {
      const f = file as { buffer: ArrayBuffer; name: string; type: string };
      const blob = new File([f.buffer], f.name, { type: f.type });
      const url = await uploadFileToStorage(blob);
      return { url };
    },
  });
}
