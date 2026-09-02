/**
 * MuAPI Key & Credit Validation Utility
 *
 * Proactively validates whether a user-supplied MuAPI key is:
 *   - invalid/expired
 *   - in sandbox/demo mode (returns static placeholder content)
 *   - active and returning real generations
 *
 * This runs on app startup and when the user opens Settings > API Keys,
 * giving immediate feedback before any generation attempt.
 */

const STATIC_OUTPUT_PATTERNS = [
  '/muapi/homepage/',
  '/muapi/demo/',
  '/muapi/sandbox/',
  '/webassets/videomodels/',
  '/webassets/',
  '/placeholder/',
  '/sample/',
  '/static/demo/',
];

export type KeyValidationMode = 'live' | 'sandbox' | 'invalid' | 'no_credits' | 'unknown';

export interface KeyValidationResult {
  valid: boolean;
  mode: KeyValidationMode;
  message: string;
  checkedAt: string;
}

function isStaticUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return STATIC_OUTPUT_PATTERNS.some(pattern => lower.includes(pattern));
}

function extractOutputUrls(result: Record<string, unknown>): string[] {
  const urls: string[] = [];
  if (Array.isArray(result.outputs)) urls.push(...result.outputs);
  if (Array.isArray(result.images)) urls.push(...result.images);
  if (typeof result.url === 'string') urls.push(result.url);

  const output = result.output as Record<string, unknown> | undefined;
  if (output && typeof output.url === 'string') urls.push(output.url);

  const video = result.video as Record<string, unknown> | undefined;
  if (video && typeof video.url === 'string') urls.push(video.url);

  const audio = result.audio as Record<string, unknown> | undefined;
  if (audio && typeof audio.url === 'string') urls.push(audio.url);

  return urls.filter(Boolean);
}

async function pollForStaticCheck(
  proxyUrl: string,
  apiKey: string,
  requestId: string,
  maxAttempts = 5,
  intervalMs = 2000
): Promise<{ status: string; urls: string[] }> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, intervalMs));

    try {
      const res = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          endpoint: `predictions/${requestId}/result`,
          params: {},
          generationType: 'poll',
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        if (res.status === 404) {
          return { status: 'not_found', urls: [] };
        }
        continue;
      }

      const data = (await res.json()) as Record<string, unknown>;
      const status = typeof data.status === 'string' ? data.status.toLowerCase() : 'unknown';

      if (status === 'completed' || status === 'succeeded' || status === 'success') {
        return { status, urls: extractOutputUrls(data) };
      }

      if (status === 'failed' || status === 'error') {
        return { status, urls: [] };
      }
    } catch {
      // transient network error — retry
    }
  }

  return { status: 'timeout', urls: [] };
}

/**
 * Validates a MuAPI key by submitting a lightweight generation request
 * and inspecting whether the result is unique or static/demo content.
 *
 * @param proxyUrl - The Supabase muapi-proxy URL
 * @param apiKey - The user-supplied MuAPI key
 * @returns KeyValidationResult with mode and message
 */
export async function validateMuapiKey(
  proxyUrl: string,
  apiKey: string
): Promise<KeyValidationResult> {
  const checkedAt = new Date().toISOString();

  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
    return {
      valid: false,
      mode: 'invalid',
      message: 'API key is missing or too short.',
      checkedAt,
    };
  }

  try {
    // Submit a minimal validation request
    const submitRes = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        endpoint: 'flux-dev-image',
        params: {
          prompt: 'validation check',
          model: 'flux-dev',
          width: 256,
          height: 256,
          num_outputs: 1,
        },
        generationType: 'image',
        studioType: 'validation',
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (submitRes.status === 401 || submitRes.status === 403) {
      return {
        valid: false,
        mode: 'invalid',
        message: 'API key is invalid or expired.',
        checkedAt,
      };
    }

    if (submitRes.status === 429) {
      return {
        valid: false,
        mode: 'no_credits',
        message: 'Rate limited — possible credit exhaustion.',
        checkedAt,
      };
    }

    if (!submitRes.ok) {
      const text = await submitRes.text().catch(() => '');
      return {
        valid: false,
        mode: 'invalid',
        message: `Validation request failed: ${submitRes.status} ${text.slice(0, 100)}`,
        checkedAt,
      };
    }

    const submitData = (await submitRes.json()) as Record<string, unknown>;
    const requestId = typeof submitData.request_id === 'string' ? submitData.request_id
      : typeof submitData.id === 'string' ? submitData.id
      : null;

    if (!requestId) {
      // Some endpoints may return immediately with outputs or an error
      if (submitData.error) {
        return {
          valid: false,
          mode: 'invalid',
          message: `Upstream error: ${submitData.error}`,
          checkedAt,
        };
      }

      const urls = extractOutputUrls(submitData);
      const hasStatic = urls.some(isStaticUrl);
      if (hasStatic) {
        return {
          valid: true,
          mode: 'sandbox',
          message: 'Key is valid but returns demo content. Upgrade to a live key with credits.',
          checkedAt,
        };
      }

      return {
        valid: true,
        mode: 'live',
        message: 'Key is active and returned real content.',
        checkedAt,
      };
    }

    // Poll briefly to inspect the actual output
    const { status, urls } = await pollForStaticCheck(proxyUrl, apiKey, requestId);

    if (status === 'failed' || status === 'error') {
      return {
        valid: false,
        mode: 'invalid',
        message: 'Generation validation failed on upstream.',
        checkedAt,
      };
    }

    const hasStatic = urls.some(isStaticUrl);
    if (hasStatic) {
      return {
        valid: true,
        mode: 'sandbox',
        message: 'Key is valid but returns demo content. Upgrade to a live key with credits.',
        checkedAt,
      };
    }

    if (status === 'timeout') {
      return {
        valid: true,
        mode: 'sandbox',
        message: 'Could not verify uniqueness within timeout. Key may be in sandbox mode.',
        checkedAt,
      };
    }

    return {
      valid: true,
      mode: 'live',
      message: 'Key is active and returning real generations.',
      checkedAt,
    };
  } catch (error) {
    return {
      valid: false,
      mode: 'invalid',
      message: `Validation error: ${error instanceof Error ? error.message : 'unknown error'}`,
      checkedAt,
    };
  }
}
