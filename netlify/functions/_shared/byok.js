/**
 * BYOK: SmartVid users bring their own MuAPI and OpenAI keys (Settings → API
 * keys). The browser sends them per request as X-MuAPI-Key / X-OpenAI-Key and
 * functions run on those keys. There is no platform-key fallback, and keys are
 * never logged or stored.
 */
const header = (headers = {}, name) => Object.entries(headers || {}).find(([k]) => k.toLowerCase() === name)?.[1];

export function userOpenAIKey(headers) {
  const key = String(header(headers, 'x-openai-key') || '').trim();
  return /^sk-[A-Za-z0-9_-]{20,}$/.test(key) ? key : null;
}

export function userMuapiKey(headers) {
  const key = String(header(headers, 'x-muapi-key') || '').trim();
  // MuAPI keys are opaque tokens; reject anything that isn't a plausible header value.
  return /^[A-Za-z0-9._-]{16,200}$/.test(key) ? key : null;
}

/** MailerLite API token (Integrations → API). Opaque, long, header-safe. */
export function userMailerLiteKey(headers) {
  const key = String(header(headers, 'x-mailerlite-key') || '').trim();
  return /^[A-Za-z0-9._-]{20,4000}$/.test(key) ? key : null;
}

export const NEED_MAILERLITE_KEY = 'Add your MailerLite API token to sync contacts (MailerLite → Integrations → API).';
export const BAD_MAILERLITE_KEY = 'MailerLite rejected your API token. Create a new one in MailerLite → Integrations → API.';

export const NEED_MUAPI_KEY = 'This uses your own MuAPI key. Add it in SmartVid → Settings → API keys (MuAPI API Key).';
export const NEED_OPENAI_KEY = 'This uses your own OpenAI key. Add it in SmartVid → Settings → API keys (OpenAI API Key).';
export const BAD_OPENAI_KEY = 'OpenAI rejected your API key. Check it in SmartVid → Settings → API keys.';
export const OPENAI_NO_CREDIT = 'Your OpenAI account is rate-limited or out of credit. Check your OpenAI billing, then try again.';
export const BAD_MUAPI_KEY = 'MuAPI rejected your API key, or the account is out of credit. Check it in SmartVid → Settings → API keys.';

/** A clear message for OpenAI failures caused by the user's own key/account, or null. */
export function openAIKeyError(status) {
  if (status === 401) return BAD_OPENAI_KEY;
  if (status === 429) return OPENAI_NO_CREDIT;
  return null;
}
