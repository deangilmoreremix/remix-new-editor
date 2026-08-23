/**
 * Distributed Rate Limiter
 *
 * Supabase-backed rate limiter that works across multiple Deno instances
 * and Deno regions. The previous in-memory Map implementation was
 * per-instance, meaning a user could bypass limits by hitting different
 * regions or triggering cold starts on Supabase edge.
 *
 * Usage:
 *   const limiter = new DistributedRateLimiter(supabaseClient);
 *   const result = await limiter.check("muapi-proxy", clientId, 100, 60);
 *   if (!result.allowed) {
 *     return new Response(JSON.stringify({ error: "Rate limited" }), {
 *       status: 429,
 *       headers: { "Retry-After": String(result.retryAfterSeconds) }
 *     });
 *   }
 *
 * The check is atomic: the database function `rate_limit_check` uses an
 * UPSERT with a unique constraint on (scope, key, window_start) to
 * ensure that concurrent requests cannot exceed the limit.
 */

interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  /** Seconds until the current window resets. */
  retryAfterSeconds: number;
  /** ISO timestamp of the start of the current window. */
  windowStart: string;
  /** ISO timestamp when the window resets. */
  resetAt: string;
}

interface RateLimitLogger {
  (
    level: "info" | "warn" | "error",
    event: string,
    fields?: Record<string, unknown>
  ): void;
}

interface SupabaseClientLike {
  rpc(
    fn: string,
    params: Record<string, unknown>
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}

interface DistributedRateLimiterOptions {
  /** When true, RPC or network errors cause requests to be denied (allowed: false).
   *  When false (default), errors fail open and allow the request through.
   *  Production services should set this to true to prevent abuse during outages.
   */
  failClosed?: boolean;
  /** Injected logger. When omitted, logs are suppressed. */
  log?: RateLimitLogger;
}

// The shape returned by the `rate_limit_check` database function.
interface RateLimitCheckRow {
  allowed: boolean;
  count: number;
  limit: number;
  window_start: string;
  reset_at: string;
}

function isRateLimitCheckRow(
  value: unknown
): value is RateLimitCheckRow {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.allowed === "boolean" &&
    typeof row.count === "number" &&
    typeof row.limit === "number" &&
    typeof row.window_start === "string" &&
    typeof row.reset_at === "string"
  );
}

export class DistributedRateLimiter {
  private supabase: SupabaseClientLike;
  private failClosed: boolean;
  private logFn?: RateLimitLogger;

  constructor(
    supabase: SupabaseClientLike,
    options?: DistributedRateLimiterOptions
  ) {
    if (!supabase) {
      throw new Error("DistributedRateLimiter requires a Supabase client");
    }
    this.supabase = supabase;
    this.failClosed = options?.failClosed ?? false;
    this.logFn = options?.log;
  }

  private log(
    level: "info" | "warn" | "error",
    event: string,
    fields?: Record<string, unknown>
  ): void {
    if (this.logFn) {
      this.logFn(level, event, fields);
    }
  }

  /**
   * Check (and atomically increment) a rate limit.
   *
   * @param scope — identifier for the rate limit bucket (e.g. "muapi-proxy")
   * @param key — identifier for the caller (user ID, IP hash, API key hash)
   * @param limit — max requests allowed in the window
   * @param windowSeconds — window size in seconds
   * @returns RateLimitResult with allowed flag, count, and reset time
   */
  async check(
    scope: string,
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<RateLimitResult> {
    try {
      const { data, error } = await this.supabase.rpc("rate_limit_check", {
        p_scope: scope,
        p_key: key,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      });

      if (error) {
        const message = `[rate-limiter] RPC error: ${error.message}`;
        if (this.failClosed) {
          this.log("error", "rate_limit.rpc_error", { scope, key, error: error.message });
          return {
            allowed: false,
            count: 0,
            limit,
            retryAfterSeconds: 0,
            windowStart: new Date().toISOString(),
            resetAt: new Date(Date.now() + windowSeconds * 1000).toISOString(),
          };
        }
        this.log("warn", "rate_limit.rpc_error_fail_open", { scope, key, error: error.message });
        return {
          allowed: true,
          count: 0,
          limit,
          retryAfterSeconds: 0,
          windowStart: new Date().toISOString(),
          resetAt: new Date(Date.now() + windowSeconds * 1000).toISOString(),
        };
      }

      if (!isRateLimitCheckRow(data)) {
        const message = `[rate-limiter] Unexpected RPC response shape`;
        if (this.failClosed) {
          this.log("error", "rate_limit.invalid_response", { scope, key, data });
          return {
            allowed: false,
            count: 0,
            limit,
            retryAfterSeconds: 0,
            windowStart: new Date().toISOString(),
            resetAt: new Date(Date.now() + windowSeconds * 1000).toISOString(),
          };
        }
        this.log("warn", "rate_limit.invalid_response_fail_open", { scope, key, data });
        return {
          allowed: true,
          count: 0,
          limit,
          retryAfterSeconds: 0,
          windowStart: new Date().toISOString(),
          resetAt: new Date(Date.now() + windowSeconds * 1000).toISOString(),
        };
      }

      const resetAtMs = new Date(data.reset_at).getTime();
      const retryAfterSeconds = Math.max(0, Math.ceil((resetAtMs - Date.now()) / 1000));

      return {
        allowed: data.allowed,
        count: data.count,
        limit: data.limit,
        retryAfterSeconds,
        windowStart: data.window_start,
        resetAt: data.reset_at,
      };
    } catch (err) {
      const message = `[rate-limiter] Unexpected error: ${err instanceof Error ? err.message : String(err)}`;
      if (this.failClosed) {
        this.log("error", "rate_limit.unexpected_error", { scope, key, error: err instanceof Error ? err.message : String(err) });
        return {
          allowed: false,
          count: 0,
          limit,
          retryAfterSeconds: 0,
          windowStart: new Date().toISOString(),
          resetAt: new Date(Date.now() + windowSeconds * 1000).toISOString(),
        };
      }
      this.log("warn", "rate_limit.unexpected_error_fail_open", { scope, key, error: err instanceof Error ? err.message : String(err) });
      return {
        allowed: true,
        count: 0,
        limit,
        retryAfterSeconds: 0,
        windowStart: new Date().toISOString(),
        resetAt: new Date(Date.now() + windowSeconds * 1000).toISOString(),
      };
    }
  }

  /**
   * Build a 429 response with standard rate limit headers.
   */
  buildRateLimitedResponse(result: RateLimitResult, corsHeaders: Record<string, string>): Response {
    const body = JSON.stringify({
      error: "Rate limit exceeded",
      retryAfterSeconds: result.retryAfterSeconds,
    });
    return new Response(body, {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.floor(new Date(result.resetAt).getTime() / 1000)),
      },
    });
  }
}

/**
 * Create a client identifier from a request. Uses the same priority
 * as the previous in-memory limiter: API key hash > IP address.
 * Returns a string safe to use as a database key.
 *
 * Falls back to a stable per-client (User-Agent + Accept-Language)
 * bucket, or a per-endpoint bucket (request URL), when no standard
 * identifier headers are present. This prevents the rate limiter from
 * being bypassed via a unique-per-request bucket.
 */
export function getClientIdFromRequest(req: Request): string {
  const apiKey = req.headers.get("x-api-key") || req.headers.get("apikey") || "";
  if (apiKey) {
    let hash = 0;
    for (let i = 0; i < apiKey.length; i++) {
      hash = ((hash << 5) - hash) + apiKey.charCodeAt(i);
      hash |= 0;
    }
    return `key_${Math.abs(hash).toString(36)}`;
  }
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for");
  if (ip) {
    return `ip_${ip}`;
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    return "auth_" + simpleHash(authHeader);
  }
  const userAgent = req.headers.get("user-agent") || "";
  const acceptLang = req.headers.get("accept-language") || "";
  if (userAgent || acceptLang) {
    return "ua_" + simpleHash(userAgent + "|" + acceptLang);
  }
  return "anon_" + simpleHash(req.url);
}

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
