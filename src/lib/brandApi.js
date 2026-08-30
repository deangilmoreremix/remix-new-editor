// src/lib/brandApi.js
// Shared API client for Brand Studio backend routes.
// Includes timeout, retry, and error normalization.

import { apiKeyManager } from './apiKeyManager.js';

function getBackendBase() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.__BACKEND_URL__) {
    return window.__BACKEND_URL__.replace(/\/$/, '');
  }
  return '';
}

export async function apiCall(path, body, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const retries = opts.retries ?? 2;
  const retryDelayMs = opts.retryDelayMs ?? 1000;

  const backendBase = getBackendBase();
  const url = backendBase ? `${backendBase}${path}` : path;

  const userMuapiKey = apiKeyManager.getMuapiKey();
  const headers = {
    'Content-Type': 'application/json',
    ...(userMuapiKey ? { 'X-User-Muapi-Key': userMuapiKey } : {}),
  };

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let json;
      try {
        json = await res.json();
      } catch {
        throw new Error(`Invalid JSON response from ${path}`);
      }

      if (!res.ok) {
        const error = new Error(json.error || `HTTP ${res.status}`);
        error.status = res.status;
        error.data = json;
        throw error;
      }

      return json.data;
    } catch (e) {
      clearTimeout(timeoutId);
      lastError = e;

      if (e.name === 'AbortError') {
        lastError = new Error(`Request timed out after ${timeoutMs}ms`);
      }

      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * Math.pow(2, attempt)));
        continue;
      }

      throw lastError;
    }
  }

  throw lastError;
}
