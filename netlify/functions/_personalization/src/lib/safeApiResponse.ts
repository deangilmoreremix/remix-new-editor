import { NextResponse } from '../../shims/next-server';

/**
 * Safely parses an upstream Response body without crashing on non-JSON payloads.
 *
 * Behavior:
 * - empty body -> {}
 * - valid JSON -> parsed object
 * - plain text / HTML / invalid JSON -> { message: text }
 *
 * Never throws. Never exposes full upstream error bodies verbatim.
 */
export async function safeApiJson(res: Response) {
  const text = await res.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export function upstreamErrorResponse(upstream: Response, parsed: unknown) {
  const status = upstream.status;
  const isAuth = status === 401;
  const isForbidden = status === 403;
  const message = isAuth
    ? 'UNAUTHENTICATED'
    : isForbidden
      ? 'PAYMENT_REQUIRED'
      : typeof parsed === 'object' && parsed !== null && 'error' in parsed
        ? String((parsed as Record<string, unknown>).error)
        : typeof parsed === 'object' && parsed !== null && 'message' in parsed
          ? String((parsed as Record<string, unknown>).message)
          : `Upstream error (${status})`;

  return NextResponse.json({ error: message }, { status });
}
