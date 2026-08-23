/**
 * Shared error sanitization utilities for Supabase edge functions.
 *
 * Prevents information leakage by stripping sensitive data (API keys,
 * internal IDs, stack traces, database details) from error messages
 * returned to clients, and mapping known upstream errors to friendly
 * user-facing messages.
 */

const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/i,
  /sk-proj-[a-zA-Z0-9_-]+/i,
  /sk-svcacct-[a-zA-Z0-9_-]+/i,
  /project_[a-zA-Z0-9]{20,}/i,
  /Bearer\s+[a-zA-Z0-9_\-\.]+/i,
  /[a-f0-9]{32,}/i,
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
  /\bat\s+[^\n]+\n/,
  /\bat\s+\(/,
  /stack\s+trace/i,
  /database_error/i,
  /pg_[a-zA-Z0-9]+/i,
  /postgresql/i,
  /ENOENT/i,
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
  /ESOCKETTIMEDOUT/i,
];

function containsSensitiveData(message: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(message));
}

interface KnownErrorInfo {
  status?: number;
  code?: string;
  message?: string;
}

function detectOpenAIAuthError(error: unknown): { status: number; message: string } | null {
  const info = error as KnownErrorInfo;
  const status = info.status;
  const code = info.code;
  const message = info.message ? String(info.message).toLowerCase() : "";

  if (
    status === 401 ||
    code === "invalid_api_key" ||
    code === "authentication_error" ||
    message.includes("invalid api key") ||
    message.includes("incorrect api key") ||
    message.includes("authentication") ||
    message.includes("unauthorized")
  ) {
    return { status: 401, message: "Authentication failed. Please check your API key." };
  }
  return null;
}

function detectRateLimitError(error: unknown): { status: number; message: string } | null {
  const info = error as KnownErrorInfo;
  const status = info.status;
  const code = info.code;
  const message = info.message ? String(info.message).toLowerCase() : "";

  if (
    status === 429 ||
    code === "rate_limit_exceeded" ||
    code === "too_many_requests" ||
    message.includes("rate limit") ||
    message.includes("quota") ||
    message.includes("too many requests")
  ) {
    return { status: 429, message: "Rate limit exceeded. Please try again later." };
  }
  return null;
}

function detectTimeoutError(error: unknown): { status: number; message: string } | null {
  const info = error as KnownErrorInfo & { name?: string };
  const code = info.code;
  const name = info.name;
  const message = info.message ? String(info.message).toLowerCase() : "";

  if (
    name === "AbortError" ||
    code === "ETIMEDOUT" ||
    code === "ESOCKETTIMEDOUT" ||
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("deadline exceeded")
  ) {
    return { status: 504, message: "Gateway timeout. Please try again." };
  }
  return null;
}

export function classifyUpstreamError(
  error: unknown,
  defaultStatus = 502
): { status: number; message: string } {
  const info = error as KnownErrorInfo;
  const extractedStatus = typeof info.status === "number" ? info.status : defaultStatus;

  const authMatch = detectOpenAIAuthError(error);
  if (authMatch) return authMatch;

  const rateLimitMatch = detectRateLimitError(error);
  if (rateLimitMatch) return rateLimitMatch;

  const timeoutMatch = detectTimeoutError(error);
  if (timeoutMatch) return timeoutMatch;

  let rawMessage = "";
  if (error instanceof Error) {
    rawMessage = error.message;
  } else if (typeof error === "string") {
    rawMessage = error;
  } else if (error && typeof error === "object" && "message" in error) {
    rawMessage = String((error as { message: unknown }).message);
  }

  if (containsSensitiveData(rawMessage)) {
    return { status: 502, message: "Upstream service error" };
  }

  if (rawMessage.trim()) {
    return { status: extractedStatus, message: rawMessage };
  }

  return { status: 502, message: "Upstream service error" };
}

export function sanitizeErrorMessage(message: string | undefined, fallback = "Upstream service error"): string {
  if (!message) return fallback;
  return containsSensitiveData(message) ? fallback : message;
}

export function safeUpstreamError(error: unknown, defaultStatus = 502): { status: number; message: string } {
  return classifyUpstreamError(error, defaultStatus);
}
