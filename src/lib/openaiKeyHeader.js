// BYOK: SmartVid runs on each user's own OpenAI key (Settings → API keys).
// Spread into a fetch's headers for any server function that calls OpenAI:
//   headers: { 'Content-Type': 'application/json', ...openaiKeyHeader() }
// The server (netlify/functions/_shared/byok.js) uses only this key.
import { apiKeyManager } from './apiKeyManager.js';

export function openaiKeyHeader(manager = apiKeyManager) {
  try {
    const key = manager.getOpenAIKey?.();
    return key ? { 'X-OpenAI-Key': key } : {};
  } catch {
    return {};
  }
}
