import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { sanitizeText, sanitizeDeep, extractOutputs, DONE, FAILED } from './sanitize.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class BrandedApiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = 'BrandedApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Client for the brand's gateway. The gateway contract is brand-neutral:
 *   POST {gw}/generate        { endpoint, payload }      -> { request_id | outputs }
 *   GET  {gw}/result/{id}                                -> { status, outputs, error }
 *   POST {gw}/estimate        { endpoint, payload }      -> { cost }
 *   POST {gw}/upload          multipart file | { source_url } -> { url }
 *   GET  {gw}/balance                                    -> { balance }
 */
export function createGatewayClient({ gatewayUrl, apiKey, brandName, fetchImpl = fetch, pollIntervalMs = 2000 }) {
  if (!gatewayUrl) throw new Error(`${brandName}: gateway URL is not configured`);
  const base = gatewayUrl.replace(/\/+$/, '');

  async function call(path, { method = 'GET', body, headers = {} } = {}) {
    if (!apiKey) {
      throw new BrandedApiError(`Missing ${brandName} API key. Set it in the MCP server environment.`, { status: 401, code: 'NO_KEY' });
    }
    let res;
    try {
      res = await fetchImpl(`${base}${path}`, {
        method,
        headers: { Authorization: `Bearer ${apiKey}`, ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...headers },
        body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
      });
    } catch (err) {
      throw new BrandedApiError(`Could not reach ${brandName}: ${sanitizeText(err.message, brandName)}`, { code: 'NETWORK' });
    }
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!res.ok) {
      const detail = data?.error?.message || data?.error || data?.detail?.error || data?.detail || data?.message || res.statusText;
      const msg = typeof detail === 'string' ? detail : JSON.stringify(detail);
      throw new BrandedApiError(sanitizeText(msg, brandName), { status: res.status });
    }
    return sanitizeDeep(data, brandName);
  }

  return {
    brandName,
    submit: (endpoint, payload) => call('/generate', { method: 'POST', body: { endpoint, payload } }),
    result: (id) => call(`/result/${encodeURIComponent(id)}`),
    estimate: (endpoint, payload) => call('/estimate', { method: 'POST', body: { endpoint, payload } }),
    balance: () => call('/balance'),
    /** Run one of the brand's studio functions (as the signed-in key owner). Returns the function's own JSON. */
    studio: (name, body) => call(`/studio/${encodeURIComponent(name)}`, { method: 'POST', body }),
    sleep,
    async upload({ url, filePath }) {
      if (url) return call('/upload', { method: 'POST', body: { source_url: url } });
      const buf = await readFile(filePath);
      const form = new FormData();
      form.append('file', new Blob([buf]), basename(filePath));
      return call('/upload', { method: 'POST', body: form });
    },

    /**
     * Poll until done, failed or timeout. On timeout resolves with status 'processing'
     * so the caller can hand the request_id back for a later `get_result`.
     */
    async wait(requestId, { timeoutMs = 120_000 } = {}) {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const r = await call(`/result/${encodeURIComponent(requestId)}`);
        const status = String(r.status || '').toLowerCase();
        if (DONE.has(status)) return { status: 'completed', request_id: requestId, outputs: extractOutputs(r) };
        if (FAILED.has(status)) return { status: 'failed', request_id: requestId, error: sanitizeText(r.error || r.detail || 'Generation failed', brandName) };
        if (Date.now() >= deadline) return { status: 'processing', request_id: requestId };
        await sleep(pollIntervalMs);
      }
    },
  };
}
